"use strict";
const fs=require("fs"),fsp=fs.promises,path=require("path"),crypto=require("crypto"),{execFile}=require("child_process");
const {parseIndex,serializeIndex,safeAssetPath,flagsFor,createAssetLookup,streamArchive,verifyArchive,hash,hashFile,MAX_INDEX_BYTES,readIndexFile}=require("./vtf-vpk");
const {deletionPolicy,readBackupManifest,removeBackupDirectory,assertUnlinkedAncestors,readRecord}=require("./backup-records");
const {VtfResourceRecovery}=require("./vtf-resource-recovery");
const {VtfOriginals}=require("./vtf-originals");
const INDEX_NAME="englishclient_mp_common.bsp.pak000_dir.vpk",MAX_BYTES=4*1024*1024*1024,MAX_FILES=2000;
const ASSETS=new Set([".vtf",".vmt",".mdl",".vvd",".vtx",".phy",".ani"]);
const NOTE=/\.(txt|md|png|jpe?g|webp)$/i;
const id=()=>crypto.randomUUID(),validId=x=>typeof x==="string"&&/^[a-f0-9-]{36}$/.test(x),errorText=e=>e.message||String(e);
const archiveName=index=>`client_mp_common.bsp.pak000_${String(index).padStart(3,"0")}.vpk`;
const {sameRoot:equalPath}=require("./game-roots");
const resourcePathError="皮肤资源路径包含链接或非普通文件，已停止资源读写。";
async function acquireGameLock(gamePath){
  if(!gamePath)throw Error("请先选择泰坦陨落 2 游戏目录");const directory=await fsp.realpath(path.resolve(gamePath)),file=path.join(directory,".vyra-vtf.lock"),token=id(),temporary=path.join(directory,`.vyra-vtf-${token}.lock.tmp`);
  if(process.platform!=="win32")throw Error("VTF 游戏事务锁需要 Windows 系统");
  // The OS mutex serializes stale-file recovery as well as the entire write.
  // Token rechecks alone cannot prevent another recoverer unlinking a new lock.
  // Keep the established VTF mutex identity while allowing DDS-only installs
  // before a VPK directory exists. The root lock file never changes location.
  let canonical;try{canonical=await fsp.realpath(path.join(directory,'vpk'));}catch(error){if(error.code!=='ENOENT')throw error;canonical=path.join(directory,'vpk');}const mutexName="Global\\VYRA-VTF-"+hash(Buffer.from(canonical.toLowerCase()));
  const script=`$ErrorActionPreference='Stop';$m=[System.Threading.Mutex]::new($false,'${mutexName}');$held=$false;try{try{$held=$m.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$held=$true};if(-not $held){[Console]::Out.WriteLine('BUSY');exit 2};[Console]::Out.WriteLine('LOCKED');[Console]::Out.Flush();[void][Console]::In.ReadLine()}finally{if($held){$m.ReleaseMutex()};$m.Dispose()}`;
  let helper,finished=false,helperResult,finishHelper,acquired=false;
  const exited=new Promise(resolve=>{finishHelper=resolve;});
  const helperError=err=>err?.code==="ENOENT"?"未找到 Windows PowerShell":err?.signal?"辅助进程意外终止":`辅助进程退出（${err?.code??"未知状态"}）`;
  await new Promise((resolve,reject)=>{
    let output="",settled=false;const timer=setTimeout(()=>{if(!settled){settled=true;helper.kill();reject(Error("VTF 系统事务锁启动超时，已停止资源写入"));}},10000);
    helper=execFile("powershell.exe",["-NoProfile","-NonInteractive","-WindowStyle","Hidden","-EncodedCommand",Buffer.from(script,"utf16le").toString("base64")],{windowsHide:true,encoding:"utf8",maxBuffer:64*1024},(err,stdout,stderr)=>{
      finished=true;helperResult={err,stderr};finishHelper();clearTimeout(timer);
      if(!settled){settled=true;reject(Error(stdout.includes("BUSY")?"另一个启动器正在安装或恢复 VTF 皮肤，请等待该操作完成":`VTF 系统事务锁无法启动，已停止资源写入：${stderr.trim()||helperError(err)}`));}
    });
    helper.stdout.on("data",chunk=>{output+=chunk;if(!settled&&output.includes("LOCKED")){settled=true;acquired=true;clearTimeout(timer);resolve();}});
    helper.stdin.on("error",()=>{});
  });
  let released=false;
  const releaseMutex=async()=>{if(released)return;released=true;if(!finished)helper.stdin.end("\n");let timer;await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>{helper.kill();reject(Error("VTF 系统事务锁释放超时"));},5000);})]).finally(()=>clearTimeout(timer));if(helperResult?.err)throw Error(`VTF 系统事务锁异常退出：${helperResult.stderr.trim()||helperError(helperResult.err)}`);};
  let published=false;
  try{
    await fsp.writeFile(temporary,JSON.stringify({version:1,pid:process.pid,token,createdAt:new Date().toISOString()}),{flag:"wx"});
    for(let attempt=0;attempt<3;attempt++){
      if(finished)throw Error("VTF 系统事务锁辅助进程已退出，已停止资源写入");
      try{await fsp.link(temporary,file);published=true;break;}
      catch(err){if(err.code!=="EEXIST")throw err;let current;
        try{current=JSON.parse(await fsp.readFile(file,"utf8"));}catch(readError){if(readError.code==="ENOENT")continue;throw Error("VTF 事务锁无法读取，请保留文件并检查正在运行的启动器");}
        if(current.version!==1||!validId(current.token)||!Number.isInteger(current.pid)||current.pid<=0)throw Error("VTF 事务锁无效，已停止资源写入");
        let alive=true;try{process.kill(current.pid,0);}catch(processError){if(processError.code==="ESRCH")alive=false;}
        if(alive)throw Error("另一个启动器正在安装或恢复 VTF 皮肤，请等待该操作完成");
        // Recheck the identity before unlinking an abandoned lock.
        const latest=JSON.parse(await fsp.readFile(file,"utf8"));if(latest.token===current.token)await fsp.unlink(file);
      }
    }if(!published)throw Error("VTF 资源正在被另一个程序操作，请稍后重试");
    await fsp.rm(temporary,{force:true});
    return async()=>{try{const current=JSON.parse(await fsp.readFile(file,"utf8"));if(current.token===token)await fsp.unlink(file);}catch(err){if(err.code!=="ENOENT")throw err;}finally{await releaseMutex();}};
  }catch(err){try{await fsp.rm(temporary,{force:true});if(published){const current=JSON.parse(await fsp.readFile(file,"utf8"));if(current.token===token)await fsp.unlink(file);}}finally{if(acquired)await releaseMutex();}throw err;}
}
async function writeJson(file,obj){const temporary=file+".tmp";await fsp.writeFile(temporary,JSON.stringify(obj,null,2),"utf8");await fsp.rename(temporary,file);}
async function freeSpace(directory,needed){const info=await fsp.statfs(directory);if(Number(info.bavail)*Number(info.bsize)<needed+32*1024*1024)throw Error("磁盘剩余空间不足，请至少预留皮肤解压体积的两倍空间");}
function cleanInputPath(value){if(typeof value!=="string"||value.length>1024||value.includes("\0"))throw Error("压缩包路径无效");return safeAssetPath(value.replace(/\\/g,"/"));}
function assetLocation(value){
  const clean=cleanInputPath(value),parts=clean.split("/"),extension=path.posix.extname(clean).toLowerCase();
  if(extension===".dds")throw Error("这不是兼容的 VTF 皮肤，而是 DDS 皮肤。请到「DDS 安装」导入。");
  if(!ASSETS.has(extension)){if(NOTE.test(clean))return null;throw Error(`皮肤包包含不支持的文件：${path.posix.basename(clean)}`);}
  const root=parts.findIndex(p=>/^(materials|models)$/i.test(p));if(root<0||root===parts.length-1)throw Error("VTF 皮肤必须保留 materials / models 的原始文件夹结构");
  const asset=parts.slice(root).join("/");if(extension===".vtf"||extension===".vmt"){if(parts[root].toLowerCase()!=="materials")throw Error("皮肤和材质必须位于 materials 文件夹内");}
  else if(parts[root].toLowerCase()!=="models")throw Error("模型必须位于 models 文件夹内");
  return {path:asset,prefix:parts.slice(0,root).join("/")};
}
async function readAssetInfo(file,type,bytes){
  const fd=await fsp.open(file,"r");
  const read=async(offset,length)=>{if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>bytes)throw Error("VTF 的资源偏移或文件长度无效");const buffer=Buffer.alloc(length),result=await fd.read(buffer,0,length,offset);if(result.bytesRead!==length)throw Error("皮肤文件不完整");return buffer;};
  try{
    const b=await read(0,Math.min(bytes,96));
    if(type!=="vtf"){
      if(type==="mdl"&&b.toString("ascii",0,4)!=="IDST")throw Error(`${path.basename(file)} 不是受支持的 Titanfall 模型`);
      if(type==="vmt"&&(bytes>2*1024*1024||b.includes(0)))throw Error("VMT 材质不是受支持的文本格式");return {};
    }
    if(b.length<64||b.toString("ascii",0,4)!=="VTF\0"||b.readUInt32LE(4)!==7||b.readUInt32LE(8)>5)throw Error(`${path.basename(file)} 不是有效的 VTF 7.x 皮肤`);
    const minor=b.readUInt32LE(8),header=b.readUInt32LE(12),width=b.readUInt16LE(16),height=b.readUInt16LE(18),flags=b.readUInt32LE(20),frames=b.readUInt16LE(24),firstFrame=b.readUInt16LE(26),format=b.readInt32LE(52),mipmaps=b[56],lowFormat=b.readInt32LE(57),lowWidth=b[61],lowHeight=b[62];
    const minimumHeader=minor>=2?80:64;
    if(header<minimumHeader||header>4096||header>=bytes||!width||!height||width>16384||height>16384||!frames||firstFrame!==0xffff&&firstFrame>=frames)throw Error("VTF 的标头、尺寸、帧数或文件长度无效");
    const fullHeader=await read(0,header),depth=minor>=2?fullHeader.readUInt16LE(63):1;
    if(!depth||depth>2048||!mipmaps||mipmaps>Math.floor(Math.log2(Math.max(width,height,depth)))+1)throw Error("VTF 的深度或 mipmap 层数无效");
    // Standard Valve ImageFormat values with an unambiguous byte/block layout.
    // Paletted P8 and platform-specific depth formats are intentionally rejected.
    const pixels=new Map([[0,4],[1,4],[2,3],[3,3],[4,2],[5,1],[6,2],[8,1],[9,3],[10,3],[11,4],[12,4],[16,4],[17,2],[18,2],[19,2],[21,2],[22,2],[23,4],[24,8],[25,8],[26,4],[27,4],[28,12],[29,16]]),blocks=new Map([[13,8],[14,16],[15,16],[20,8]]);
    const imageBytes=(fmt,w,h,d=1)=>{if(blocks.has(fmt))return Math.max(1,Math.ceil(w/4))*Math.max(1,Math.ceil(h/4))*d*blocks.get(fmt);if(pixels.has(fmt))return w*h*d*pixels.get(fmt);throw Error(`VTF 使用了暂不支持的像素格式 ${fmt}`);};
    const cubemap=!!(flags&0x4000),faces=cubemap?(minor<5&&firstFrame!==0xffff?7:6):1;
    if(cubemap&&depth!==1)throw Error("暂不支持带体积深度的 VTF 立方体皮肤");
    let highBytes=0;for(let level=0;level<mipmaps;level++)highBytes+=imageBytes(format,Math.max(1,width>>level),Math.max(1,height>>level),Math.max(1,depth>>level))*frames*faces;
    if(!Number.isSafeInteger(highBytes)||highBytes<=0||highBytes>MAX_BYTES)throw Error("VTF 声明的皮肤数据长度超过支持范围");
    if((!lowWidth)!==(!lowHeight)||lowWidth>16||lowHeight>16)throw Error("VTF 缩略皮肤尺寸无效");
    const lowBytes=lowWidth&&lowHeight?imageBytes(lowFormat,lowWidth,lowHeight):0;
    if(lowBytes===0&&lowFormat!==-1&&!pixels.has(lowFormat)&&!blocks.has(lowFormat))throw Error("VTF 缩略皮肤格式无效");
    const ranges=[];const addRange=(offset,length,kind)=>{if(!Number.isSafeInteger(offset)||offset<header||offset+length>bytes)throw Error(`VTF 的${kind}数据被截断或资源偏移无效`);ranges.push({offset,end:offset+length,kind});};
    if(minor<3){if(lowBytes)addRange(header,lowBytes,"缩略皮肤");addRange(header+lowBytes,highBytes,"主皮肤");}
    else{
      const count=fullHeader.readUInt32LE(68);if(!count||count>32||80+count*8>header)throw Error("VTF 资源字典长度无效或缺少主皮肤资源");
      const seen=new Set();let hasHigh=false,hasLow=false;
      for(let index=0;index<count;index++){
        const at=80+index*8,tag=fullHeader.readUIntLE(at,3),resourceFlags=fullHeader[at+3],offset=fullHeader.readUInt32LE(at+4);
        if(seen.has(tag)||resourceFlags!==0&&resourceFlags!==2)throw Error("VTF 资源字典含有重复标记或不支持的资源标志");seen.add(tag);
        if(tag===0x30){if(resourceFlags)throw Error("VTF 主皮肤不能使用内联资源标志");addRange(offset,highBytes,"主皮肤");hasHigh=true;}
        else if(tag===1){if(resourceFlags||!lowBytes)throw Error("VTF 缩略皮肤资源与标头不一致");addRange(offset,lowBytes,"缩略皮肤");hasLow=true;}
        else if(resourceFlags!==2){const size=(await read(offset,4)).readUInt32LE(0);addRange(offset,4+size,"附加资源");}
      }
      if(!hasHigh||lowBytes&&!hasLow)throw Error("VTF 资源字典缺少主皮肤或缩略皮肤");
    }
    ranges.sort((a,b)=>a.offset-b.offset);for(let i=1;i<ranges.length;i++)if(ranges[i].offset<ranges[i-1].end)throw Error("VTF 的资源数据区域相互重叠");
    return {width,height,frames,depth,mipmaps,faces,format};
  }finally{await fd.close();}
}
async function walk(directory,relative="",depth=0){
  if(depth>40)throw Error("皮肤文件夹层级过深");const out=[];
  for(const e of await fsp.readdir(directory,{withFileTypes:true})){const rel=relative?relative+"/"+e.name:e.name,location=path.join(directory,e.name);cleanInputPath(rel);
    if(e.isSymbolicLink())throw Error("皮肤包不支持链接文件");if(e.isDirectory())out.push(...await walk(location,rel,depth+1));else if(e.isFile()){const stat=await fsp.lstat(location);if(stat.isSymbolicLink()||!stat.isFile())throw Error("皮肤包包含非普通文件");out.push({source:location,relative:rel,bytes:stat.size});}
    if(out.length>MAX_FILES)throw Error(`皮肤包文件数量超过 ${MAX_FILES}`);
  }return out;
}
class VtfEngine{
  constructor(options){this.baseDir=options.baseDir;this.packagesDir=options.packagesDir||path.join(this.baseDir,"packages");this.toolsDir=options.toolsDir;this.isGameRunning=options.isGameRunning|| (async()=>false);this.emit=options.progress||(()=>{});this.packages=new Map();this.busy=false;this.originals=new VtfOriginals({baseDir:this.baseDir,offlinePack:options.offlinePack,...(options.manifestProvider?{manifestProvider:options.manifestProvider}:{})});this.resources=new VtfResourceRecovery({baseDir:this.baseDir,offlinePack:options.offlinePack,isGameRunning:()=>this.isGameRunning(),progress:data=>this.emit(data),...(options.manifestProvider?{manifestProvider:options.manifestProvider}:{})});}
  progress(phase,percent,message){this.emit({phase,percent:Math.max(0,Math.min(100,Math.round(percent))),message});}
  async initialize(){await fsp.mkdir(this.packagesDir,{recursive:true});await fsp.mkdir(path.join(this.baseDir,"backups"),{recursive:true});}
  tool(args){return new Promise((resolve,reject)=>execFile(path.join(this.toolsDir,"7z.exe"),args,{windowsHide:true,encoding:"utf8",maxBuffer:8*1024*1024,timeout:15*60*1000},(err,stdout,stderr)=>{if(err)return reject(Error(`VTF 压缩包读取失败：${stderr.trim()||err.message}`));resolve(stdout);}));}
  async extract(source,destination){
    const listing=await this.tool(["l","-ba","-slt","-sccUTF-8",source]);let total=0,count=0;const seen=new Set();
    // Classify the package before unrelated readme files can mask its format.
    if(listing.split(/\r?\n/).some(line=>/^Path = .*\.dds$/i.test(line)))throw Error("这不是兼容的 VTF 皮肤，而是 DDS 皮肤。请到「DDS 安装」导入。");
    for(const block of listing.split(/\r?\n\r?\n/)){if(!block.trim())continue;const values={};for(const line of block.split(/\r?\n/)){const m=line.match(/^([^=]+) = (.*)$/);if(m)values[m[1].trim()]=m[2];}
      if(!values.Path)continue;const clean=cleanInputPath(values.Path),key=clean.toLowerCase();if(seen.has(key))throw Error("压缩包包含重复路径");seen.add(key);
      if(values["Symbolic Link"]||values["Hard Link"]||values["Copy Link"]||values["Alternate Stream"]==="+"||/^l/.test(values.Mode||"")||/^L/.test(values.Attributes||"")||/(?:^|\s)l[rwx-]{3}/.test(values.Attributes||""))throw Error("压缩包不支持符号链接或硬链接");
      if(values.Encrypted==="+")throw Error("暂不支持带密码的皮肤包");const directory=values.Folder==="+"||/^D/.test(values.Attributes||"");if(directory)continue;
      if(++count>MAX_FILES)throw Error("压缩包文件数量过多");const size=Number(values.Size);if(!Number.isSafeInteger(size)||size<0)throw Error("压缩包文件长度无效");total+=size;if(total>MAX_BYTES)throw Error("皮肤包解压后超过 4 GB");assetLocation(clean);
    }
    if(!count)throw Error("压缩包中没有皮肤文件");await freeSpace(this.baseDir,total*2+MAX_INDEX_BYTES);await fsp.mkdir(destination,{recursive:true});
    await this.tool(["x","-y","-sccUTF-8","-o"+destination,source]);const actual=await walk(destination);if(actual.reduce((n,f)=>n+f.bytes,0)>MAX_BYTES)throw Error("解压后的皮肤包超过 4 GB");return actual;
  }
  async inspect(sourcePath){
    if(this.busy)throw Error("另一个 VTF 操作正在执行");this.busy=true;const packageId=id(),dir=path.join(this.packagesDir,packageId);
    try{
      await this.initialize();await fsp.mkdir(dir,{recursive:true});
      this.progress("inspect",0,"正在读取 VTF 皮肤包");const stat=await fsp.stat(sourcePath);let inputs;
      if(stat.isDirectory())inputs=await walk(sourcePath);else if(/\.dds$/i.test(sourcePath))throw Error("这不是兼容的 VTF 皮肤，而是 DDS 皮肤。请到「DDS 安装」导入。");else if(/\.vtf$/i.test(sourcePath))throw Error("单独的 VTF 文件无法确定游戏资源路径。请选择保留 materials / models 结构的完整皮肤文件夹或压缩包。");else if(stat.isFile()){try{inputs=await this.extract(sourcePath,path.join(dir,"extracted"));}catch(error){if(error.message.startsWith("VTF 压缩包读取失败："))throw Error("这个文件不是可读取的皮肤压缩包，或压缩包已损坏。请选择包含兼容 VTF 资源的压缩包或完整文件夹。");throw error;}}else throw Error("请选择完整的 VTF 皮肤文件夹或可读取的压缩包。");
      const selected=[],seen=new Set(),prefixes=new Set();let total=0;
      if(inputs.some(file=>/\.dds$/i.test(file.relative)))throw Error("这不是兼容的 VTF 皮肤，而是 DDS 皮肤。请到「DDS 安装」导入。");
      for(const file of inputs){const location=assetLocation(file.relative);if(!location)continue;const key=location.path.toLowerCase();if(seen.has(key))throw Error("皮肤包包含重名游戏资源");seen.add(key);prefixes.add(location.prefix);if(!file.bytes)throw Error("皮肤包包含空资源文件");total+=file.bytes;if(total>MAX_BYTES)throw Error("皮肤包资源总大小超过 4 GB");selected.push({...file,path:location.path,type:path.posix.extname(location.path).slice(1).toLowerCase()});}
      if(!selected.some(f=>f.type==="vtf"))throw Error("这不是兼容的 VTF 皮肤：所选项目中没有 VTF 皮肤。");if(prefixes.size!==1)throw Error("请选择一个皮肤包；当前文件夹中存在多个不同的皮肤根目录");
      await freeSpace(this.baseDir,stat.isDirectory()?total+MAX_INDEX_BYTES:MAX_INDEX_BYTES);
      const files=[];let finished=0;
      for(const file of selected){const copy=path.join(dir,"assets",...file.path.split("/"));await fsp.mkdir(path.dirname(copy),{recursive:true});await fsp.copyFile(file.source,copy,fs.constants.COPYFILE_EXCL);
        const copied=await fsp.stat(copy);if(copied.size!==file.bytes)throw Error("导入过程中皮肤文件发生了变化");const info=await readAssetInfo(copy,file.type,file.bytes),sha256=await hashFile(copy);files.push({source:copy,path:file.path,name:path.posix.basename(file.path),type:file.type,bytes:file.bytes,sha256,...info});finished+=file.bytes;this.progress("inspect",5+finished/total*94,`校验 ${file.path}`);
      }
      const pkg={id:packageId,dir,name:path.basename(sourcePath),sourcePath,files,count:files.length,bytes:total};this.packages.set(packageId,pkg);
      // Remove extraction staging after stable private copies have been hashed.
      await fsp.rm(path.join(dir,"extracted"),{recursive:true,force:true});this.progress("inspect",100,`${files.length} 个 VTF / 材质 / 模型资源校验通过`);return this.publicPackage(pkg);
    }catch(err){await fsp.rm(dir,{recursive:true,force:true});throw err;}finally{this.busy=false;}
  }
  publicPackage(pkg){return {id:pkg.id,name:pkg.name,sourcePath:pkg.sourcePath,count:pkg.count,bytes:pkg.bytes,textures:pkg.files.filter(f=>f.type==="vtf").length,animated:pkg.files.filter(f=>f.frames>1).length,files:pkg.files.map(({path,name,type,bytes,width,height,frames})=>({path,name,type,bytes,width,height,frames}))};}
  async readGame(gamePath,pkg){
    if(!gamePath)throw Error("请先选择泰坦陨落 2 游戏目录");const root=path.resolve(gamePath),vpkDir=path.join(root,"vpk"),indexPath=path.join(vpkDir,INDEX_NAME);
    if(!(await fsp.stat(path.join(root,"Titanfall2.exe"))).isFile())throw Error("目录中未找到 Titanfall2.exe");
    await assertUnlinkedAncestors(indexPath,resourcePathError);const indexStat=await fsp.lstat(indexPath);
    if(!indexStat.isFile()||indexStat.nlink!==1||indexStat.size>MAX_INDEX_BYTES)throw Error("游戏 common 索引文件无效或超过支持的大小");
    const index=await readIndexFile(indexPath),parsed=parseIndex(index),stats=new Map();await fsp.access(indexPath,fs.constants.R_OK|fs.constants.W_OK);await fsp.access(vpkDir,fs.constants.W_OK);
    for(const entry of parsed.entries){if(!stats.has(entry.index)){const archive=path.join(vpkDir,archiveName(entry.index));await assertUnlinkedAncestors(archive,resourcePathError);const s=await fsp.lstat(archive);if(!s.isFile())throw Error("common 归档不是普通文件");stats.set(entry.index,s.size);}
      for(const c of entry.chunks)if(c.offset+c.compressedSize>stats.get(entry.index))throw Error("common VPK 归档长度与索引不一致");
    }
    if(pkg){const lookup=createAssetLookup(parsed.entries);for(const f of pkg.files)flagsFor(f.path,parsed.entries,lookup);}return {path:root,vpkDir,indexPath,index,parsed,stats};
  }
  async gameStatus(gamePath,pkg){try{if(!gamePath)throw Error("请先选择泰坦陨落 2 游戏目录");const root=path.resolve(gamePath),resource=await this.resources.inspect(root);delete resource.parsed;if(!resource.ready)return {path:root,...resource};const g=await this.readGame(root,pkg);return {path:g.path,...resource,archiveCount:g.stats.size,indexPath:g.indexPath};}catch(err){return {path:gamePath?path.resolve(gamePath):"",ready:false,canRepair:false,issues:[],error:gamePath?`common VPK 不完整或不兼容：${errorText(err)}`:errorText(err)};}}
  async repairResources(gamePath,packageId,source){return this.exclusively(async()=>{const pkg=this.packages.get(packageId);if(!pkg)throw Error("请重新导入并校验 VTF 皮肤包");const result=await this.resources.repair(path.resolve(gamePath),source);if(source){const original=await this.originals.prepare(path.resolve(gamePath),source);return {...result,original:original.status};}return result;},gamePath);}
  async manifests(gamePath){await this.initialize();if(!gamePath)return [];const list=[];for(const e of await fsp.readdir(path.join(this.baseDir,"backups"),{withFileTypes:true})){if(!e.isDirectory()||!validId(e.name))continue;try{const m=(await readRecord(path.join(this.baseDir,'backups'),e.name,gamePath,'manifest.json',{allowOtherGames:true})).manifest;if(equalPath(m.gamePath,gamePath)){this.validateManifest(m,e.name,gamePath);list.push(m);}}catch(err){if(err.code!=='ENOENT')throw Error("VTF 备份记录无效或不属于当前游戏目录");}}
    return list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  async backups(gamePath){return (await this.manifests(gamePath)).map(m=>({id:m.id,name:m.name,createdAt:m.createdAt,state:m.state,count:m.files.length,bytes:m.archiveBytes||m.bytes||0,archive:m.archiveName,...(m.skinSwitchId?{skinSwitchId:m.skinSwitchId}:{}),...deletionPolicy(m)}));}
  async deleteBackup(gamePath,backupId){return this.exclusively(async()=>{const record=await readBackupManifest(this.baseDir,backupId,gamePath);this.validateManifest(record.manifest,backupId,gamePath);const policy=deletionPolicy(record.manifest);if(!policy.canDelete)throw Error(policy.deleteReason);return removeBackupDirectory(this.baseDir,backupId,record);},gamePath);}
  async status(gamePath,packageId){const pkg=this.packages.get(packageId),manifests=await this.manifests(gamePath);const pending=manifests.filter(m=>["preparing","pending"].includes(m.state));let original=null;if(pkg&&gamePath)try{original=(await this.originals.prepare(path.resolve(gamePath))).status;}catch(error){original={state:"error",complete:false,reason:errorText(error)};}return {game:await this.gameStatus(gamePath,pkg),original,package:pkg?this.publicPackage(pkg):null,backups:await this.backups(gamePath),busy:this.busy,pending:pending.map(m=>m.id),conflicts:pkg?manifests.filter(m=>m.state==="installed"&&m.files.some(r=>pkg.files.some(f=>f.path.toLowerCase()===r.path.toLowerCase()))).map(m=>({id:m.id,name:m.name})):[]};}
  async exclusively(action,gamePath){if(this.busy)throw Error("另一个 VTF 操作正在执行");this.busy=true;let release;try{if(await this.isGameRunning())throw Error("请先退出游戏，再安装或恢复皮肤");if(!this.externalGameLock)release=await acquireGameLock(gamePath);return await action();}finally{try{if(release)await release();}finally{this.busy=false;}}}
  async pickArchive(game){const occupied=new Set(game.parsed.entries.map(e=>e.index));for(const file of await fsp.readdir(game.vpkDir)){const match=file.match(/^client_mp_common\.bsp\.pak000_(\d+)\.vpk$/i);if(match)occupied.add(Number(match[1]));}for(let i=0;i<1000;i++)if(!occupied.has(i))return i;throw Error("common VPK 没有可用的新归档编号");}
  async install(gamePath,packageId,options={}){return this.exclusively(async()=>{
    await this.initialize();const pkg=this.packages.get(packageId);if(!pkg)throw Error("请重新导入并校验 VTF 皮肤包");const pending=(await this.manifests(gamePath)).find(m=>["preparing","pending"].includes(m.state));if(pending)throw Error("检测到上次未完成的 VTF 操作，请先恢复该备份");
    const resource=await this.gameStatus(gamePath,pkg);if(!resource.ready&&resource.canRepair)await this.resources.repair(path.resolve(gamePath));else if(!resource.ready)throw Error(resource.error);
    const game=await this.readGame(gamePath,pkg);await freeSpace(game.vpkDir,pkg.bytes+MAX_INDEX_BYTES);await freeSpace(this.baseDir,MAX_INDEX_BYTES*2);
    const backupId=id(),dir=path.join(this.baseDir,"backups",backupId),file=path.join(dir,"manifest.json"),archiveIndex=await this.pickArchive(game);
    const newest=(await this.manifests(game.path)).reduce((value,record)=>Math.max(value,Date.parse(record.createdAt)),0);
    const manifest={version:1,id:backupId,name:pkg.name,gamePath:game.path,createdAt:new Date(Math.max(Date.now(),newest+1)).toISOString(),state:"preparing",indexName:INDEX_NAME,beforeHash:hash(game.index),archiveIndex,archiveName:archiveName(archiveIndex),archivePublished:false,stageArchive:`.vyra-vtf-${backupId}.archive.tmp`,stageIndex:`.vyra-vtf-${backupId}.index.tmp`,bytes:pkg.bytes,files:pkg.files.map(({path,bytes,sha256,type,frames})=>({path,bytes,sha256,type,frames})),...(options.skinSwitchId?{skinSwitchId:options.skinSwitchId}:{})};
    await fsp.mkdir(dir,{recursive:true});await fsp.writeFile(path.join(dir,"before-index.vpk"),game.index);await writeJson(file,manifest);
    const stageArchive=path.join(game.vpkDir,manifest.stageArchive),stageIndex=path.join(game.vpkDir,manifest.stageIndex),destination=path.join(game.vpkDir,manifest.archiveName);let publicationIdentity,publicationLinked=false,publicationStageReleased=false;
    try{
      this.progress("backup",0,"原 common 索引已备份；正在构建新的皮肤归档");let last=-1;
      const packed=await streamArchive(pkg.files,stageArchive,archiveIndex,game.parsed.entries,(done,total,name)=>{const p=Math.floor(done/total*65);if(p!==last){last=p;this.progress("install",p,`打包 ${name}`);}});
      const replacement=new Map(packed.entries.map(e=>[e.path.toLowerCase(),e]));const entries=game.parsed.entries.map(e=>{const key=e.path.toLowerCase(),newEntry=replacement.get(key);replacement.delete(key);return newEntry||e;});entries.push(...replacement.values());
      const after=serializeIndex(entries),parsedAfter=parseIndex(after);
      manifest.afterHash=hash(after);manifest.archiveHash=packed.sha256;manifest.archiveBytes=packed.bytes;manifest.state="pending";await fsp.writeFile(path.join(dir,"after-index.vpk"),after);await writeJson(file,manifest);
      if(options.beforeWrite)await options.beforeWrite({manifest,dir});
      await fsp.writeFile(stageIndex,after,{flag:"wx"});const staged=await fsp.open(stageIndex,"r+");try{await staged.sync();}finally{await staged.close();}
      if(await this.isGameRunning())throw Error("游戏已启动，安装已取消");if(hash(await readIndexFile(game.indexPath))!==manifest.beforeHash)throw Error("common 索引被其他程序修改，安装已取消");
      // An atomic, no-overwrite link publishes a fully written same-volume file;
      // a process crash can never leave a half-copied archive under a game name.
      // NTFS supports this; incompatible filesystems stop before index changes.
      await assertUnlinkedAncestors(stageArchive,resourcePathError);const stagedArchive=await fsp.lstat(stageArchive);
      if(!stagedArchive.isFile()||stagedArchive.nlink!==1||stagedArchive.size!==packed.bytes)throw Error("待发布的皮肤归档已变化");
      publicationIdentity=stagedArchive;await fsp.link(stageArchive,destination);publicationLinked=true;manifest.archivePublished=true;await writeJson(file,manifest);
      const published=await fsp.lstat(destination);
      if(!published.isFile()||published.dev!==stagedArchive.dev||published.ino!==stagedArchive.ino||published.size!==stagedArchive.size||published.mtimeMs!==stagedArchive.mtimeMs||published.nlink!==2)throw Error("发布后的皮肤归档身份不一致");
      // Verify the published inode once, before the live index can reference it.
      // This same read checks every asset SHA/CRC and the complete archive SHA;
      // a separate staging read plus another full published hash adds no data
      // coverage. Index publication still waits for all checks and fsyncs.
      await verifyArchive(parsedAfter.entries,destination,pkg.files,(done,total)=>{const p=65+Math.floor(done/total*25);if(p!==last){last=p;this.progress("verify",p,"正在逐块校验 VTF、材质和模型");}},{bytes:packed.bytes,sha256:packed.sha256,index:archiveIndex,links:2});
      const stageIdentity=await fsp.lstat(stageArchive),publishedIdentity=await fsp.lstat(destination);
      if(stageIdentity.dev!==publishedIdentity.dev||stageIdentity.ino!==publishedIdentity.ino||stageIdentity.nlink!==2||publishedIdentity.nlink!==2)throw Error("发布后的皮肤归档身份不一致");await fsp.unlink(stageArchive);publicationStageReleased=true;
      if(hash(await readIndexFile(game.indexPath))!==manifest.beforeHash)throw Error("common 索引被其他程序修改，安装已取消");if(await this.isGameRunning())throw Error("游戏已启动，安装已取消");await fsp.rename(stageIndex,game.indexPath);
      if(hash(await readIndexFile(game.indexPath))!==manifest.afterHash)throw Error("安装后的 common 索引校验失败");manifest.state="installed";await writeJson(file,manifest);
      this.progress("complete",100,`${pkg.count} 个 VTF 皮肤资源已安装，原归档保持完整`);return {backupId,count:pkg.count,bytes:pkg.bytes,archive:manifest.archiveName};
    }catch(err){
      try{
        if(publicationLinked){
          if(!publicationStageReleased){
            if(!await this.discardUnreferencedArchive(manifest,dir,publicationIdentity))throw Error("新归档身份或 common 索引已变化，自动恢复已停止以保留当前文件");
            manifest.archivePublished=false;await writeJson(file,manifest);
          }else{
            await assertUnlinkedAncestors(destination,resourcePathError);const published=await fsp.lstat(destination);
            if(!published.isFile()||published.dev!==publicationIdentity.dev||published.ino!==publicationIdentity.ino||published.nlink!==1)throw Error("新归档身份已变化，自动恢复已停止以保留当前文件");
          }
        }
        await this.restoreManifest(manifest,dir,true);manifest.state="rolled-back";manifest.failure=errorText(err);await writeJson(file,manifest);
      }catch(rollbackError){manifest.failure=errorText(err);manifest.recoveryError=errorText(rollbackError);await writeJson(file,manifest);throw Error(`安装未完成，已保留恢复备份 ${backupId}：${errorText(rollbackError)}`);}
      throw err;
    }
  },gamePath);}
  async discardUnreferencedArchive(m,dir,identity){
    // A failed readback may leave corrupt bytes in our own newly linked inode.
    // They can be discarded without trusting their hash only while the live
    // index is unchanged and both private/public names still prove ownership.
    const vpkDir=path.join(m.gamePath,"vpk"),indexPath=path.join(vpkDir,INDEX_NAME),archivePath=path.join(vpkDir,m.archiveName),stagePath=path.join(vpkDir,m.stageArchive);
    const before=await fsp.readFile(path.join(dir,"before-index.vpk"));
    if(hash(before)!==m.beforeHash||parseIndex(before).entries.some(entry=>entry.index===m.archiveIndex)||hash(await readIndexFile(indexPath))!==m.beforeHash)return false;
    let stage,published;try{await assertUnlinkedAncestors(stagePath,resourcePathError);await assertUnlinkedAncestors(archivePath,resourcePathError);stage=await fsp.lstat(stagePath);published=await fsp.lstat(archivePath);}catch(error){if(error.code==='ENOENT')return false;throw error;}
    const owned=value=>value.isFile()&&value.dev===identity.dev&&value.ino===identity.ino&&value.nlink===2;
    if(!owned(stage)||!owned(published))return false;
    if(hash(await readIndexFile(indexPath))!==m.beforeHash)return false;
    await fsp.unlink(archivePath);return true;
  }
  validateManifest(m,backupId,gamePath){if(m.version!==1||m.id!==backupId||!equalPath(m.gamePath,gamePath)||!Number.isFinite(Date.parse(m.createdAt))||!["preparing","pending","installed","restored","rolled-back","cancelled"].includes(m.state)||m.indexName!==INDEX_NAME||!Number.isInteger(m.archiveIndex)||m.archiveIndex<0||m.archiveIndex>999||m.archiveName!==archiveName(m.archiveIndex)||m.stageArchive!==`.vyra-vtf-${backupId}.archive.tmp`||m.stageIndex!==`.vyra-vtf-${backupId}.index.tmp`||!Array.isArray(m.files)||m.files.length>MAX_FILES||!/^[a-f0-9]{64}$/.test(m.beforeHash)||m.afterHash&&!/^[a-f0-9]{64}$/.test(m.afterHash)||m.archiveHash&&!/^[a-f0-9]{64}$/.test(m.archiveHash))throw Error("VTF 备份记录无效或不属于当前游戏目录");const seen=new Set();for(const file of m.files){const clean=safeAssetPath(file.path).toLowerCase();if(seen.has(clean)||!Number.isSafeInteger(file.bytes)||file.bytes<=0||file.bytes>MAX_BYTES||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error("VTF 备份记录无效或不属于当前游戏目录");seen.add(clean);}}
  async restoreManifest(m,dir,automatic=false){
    this.validateManifest(m,m.id,m.gamePath);const vpkDir=path.join(m.gamePath,"vpk"),indexPath=path.join(vpkDir,INDEX_NAME),archivePath=path.join(vpkDir,m.archiveName),before=await fsp.readFile(path.join(dir,"before-index.vpk"));
    if(hash(before)!==m.beforeHash)throw Error("备份中的原 common 索引已损坏");parseIndex(before);const current=hash(await readIndexFile(indexPath));
    if(current!==m.beforeHash&&current!==m.afterHash)throw Error("common 索引已被后续安装或其他程序修改。请先恢复较新的 VTF 备份");
    let archiveExists=false;try{await fsp.access(archivePath);archiveExists=true;}catch(err){if(err.code!=="ENOENT")throw err;}
    let ownedArchive=!!m.archivePublished;
    if(archiveExists&&!ownedArchive){
      // A crash after atomic publication but before journal update is recoverable
      // only when the staging and destination names refer to the same inode.
      try{const stage=await fsp.stat(path.join(vpkDir,m.stageArchive)),published=await fsp.stat(archivePath);ownedArchive=stage.dev===published.dev&&stage.ino===published.ino;}catch(err){if(err.code!=="ENOENT")throw err;}
    }
    if(archiveExists&&ownedArchive&&(!m.archiveHash||await hashFile(archivePath)!==m.archiveHash)){
      // A failed exclusive copy can leave a partial file, but never remove an
      // unrelated archive that won the number race before this transaction.
      if(!automatic)throw Error("安装后的皮肤归档已被修改，恢复已停止以保留当前文件");throw Error("新归档未通过校验，请检查恢复备份，原索引未被覆盖");
    }
    this.progress("restore",20,"备份校验通过，正在恢复原 common 索引");
    if(current!==m.beforeHash){const temporary=path.join(vpkDir,`.vyra-vtf-${m.id}.restore.tmp`);await fsp.writeFile(temporary,before);const h=await fsp.open(temporary,"r+");try{await h.sync();}finally{await h.close();}if(hash(await readIndexFile(indexPath))!==current)throw Error("恢复期间 common 索引发生变化");if(await this.isGameRunning()){await fsp.rm(temporary,{force:true});throw Error("游戏已启动，请先退出游戏再恢复皮肤");}await fsp.rename(temporary,indexPath);}
    if(hash(await readIndexFile(indexPath))!==m.beforeHash)throw Error("恢复后的 common 索引校验失败");
    if(archiveExists&&ownedArchive)await fsp.unlink(archivePath);await fsp.rm(path.join(vpkDir,m.stageArchive),{force:true});await fsp.rm(path.join(vpkDir,m.stageIndex),{force:true});
  }
  async restore(gamePath,backupId){return this.exclusively(async()=>{
    if(!validId(backupId))throw Error("VTF 备份编号无效");const {dir,file,manifest}=await readBackupManifest(this.baseDir,backupId,gamePath);this.validateManifest(manifest,backupId,gamePath);
    if(!["installed","pending","preparing"].includes(manifest.state))throw Error("这个 VTF 备份已经恢复或没有完成安装");
    await this.restoreManifest(manifest,dir);manifest.state="restored";manifest.restoredAt=new Date().toISOString();await writeJson(file,manifest);this.progress("complete",100,"安装前的 common 索引已精确恢复，新增归档已移除");return {backupId,count:manifest.files.length};
  },gamePath);}
}
module.exports={VtfEngine,INDEX_NAME,archiveName,assetLocation,errorText,MAX_BYTES,MAX_FILES,acquireGameLock};
