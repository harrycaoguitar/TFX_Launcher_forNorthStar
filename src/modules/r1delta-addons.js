'use strict';
// Delta uses the purchased game's r1/addons and r1/addonlist.txt even when its
// native executable is kept in TFX's separate, versioned core directory.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {parse}=require('./keyvalues');
const {extractZip,scanTree,treeDigestAsync}=require('./local-mod-import');
const {validateGame,hashFile}=require('./r1delta-core');
const MAX_BYTES=2*1024*1024*1024;
function safeName(name){
  if(typeof name!=='string'||!name||name.length>120||name==='.'||name==='..'||/[<>:"/\\|?*\x00-\x1f\x7f]/u.test(name)||/[. ]$/u.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw Error('Addon 名称无效');
  return name;
}
async function regular(target,kind){
  const stat=await fs.lstat(target);
  if(stat.isSymbolicLink()||kind==='directory'&&!stat.isDirectory()||kind==='file'&&(!stat.isFile()||stat.nlink!==1))throw Error('Addon 路径包含链接或非普通文件');
  return stat;
}
async function existing(target){try{return await fs.lstat(target);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function directory(target){const stat=await existing(target);if(stat)await regular(target,'directory');else await fs.mkdir(target);}
const field=(object,key)=>Object.entries(object||{}).find(([name])=>name.toLowerCase()===key)?.[1];
async function metadata(folder,fallback){
  const name=path.join(folder,'addoninfo.txt'),stat=await regular(name,'file');if(stat.size>1024*1024)throw Error('addoninfo.txt 超过大小限制');
  return metadataBytes(await fs.readFile(name),fallback);
}
function metadataBytes(bytes,fallback){
  const source=bytes.subarray(0,2).equals(Buffer.from([255,254]))?bytes.subarray(2).toString('utf16le'):bytes.toString('utf8');
  const data=parse(source),info=field(data,'addoninfo');if(!info||typeof info!=='object')throw Error('addoninfo.txt 格式无效');
  const text=(key,empty='')=>typeof field(info,key)==='string'?field(info,key).slice(0,2000):empty;
  return {title:text('addontitle',fallback),author:text('addonauthor'),version:text('addonversion'),description:text('addondescription')};
}
async function checkVpk(target){
  return (await inspectVpk(target)).size;
}
async function inspectVpk(target){
  const stat=await regular(target,'file');if(stat.size<12||stat.size>MAX_BYTES)throw Error('VPK 文件大小无效');
  const handle=await fs.open(target,'r');try{const header=Buffer.alloc(28);await handle.read(header,0,Math.min(28,stat.size),0);
    const major=header.readUInt16LE(4),minor=header.readUInt16LE(6),respawn=major===2&&minor>=1;
    if(header.readUInt32LE(0)!==0x55aa1234||![1,2].includes(major)||major===2&&minor>3)throw Error('不是有效的 Delta VPK 模组');
    const treeSize=header.readUInt32LE(8),embedded=major===1?0:header.readUInt32LE(12);
    const start=major===1?12:respawn&&stat.size===16+treeSize+embedded?16:28;
    if(!treeSize||treeSize>32*1024*1024||start+treeSize+embedded>stat.size)throw Error('VPK 索引不完整');
    if(/(?:_dir|_\d{3})\.vpk$/i.test(path.basename(target)))throw Error('请选择完整的单文件 Addon VPK，分卷 VPK 请按作者说明安装');
    const tree=Buffer.alloc(treeSize);if((await handle.read(tree,0,treeSize,start)).bytesRead!==treeSize)throw Error('VPK 索引不完整');
    let offset=0,info=null,entries=0;
    function need(size){if(offset+size>tree.length)throw Error('VPK 索引不完整');}
    function string(){const end=tree.indexOf(0,offset);if(end<0)throw Error('VPK 索引不完整');const value=tree.toString('utf8',offset,end);offset=end+1;return value;}
    for(let ext=string();ext;ext=string())for(let dir=string();dir;dir=string())for(let name=string();name;name=string()){
      entries++;need(8);const preload=tree.readUInt16LE(offset+4),index=tree.readUInt16LE(offset+6);offset+=8;const chunks=[];
      if(respawn){let marker;do{need(32);chunks.push({at:tree.readBigUInt64LE(offset+6),size:tree.readBigUInt64LE(offset+14),decoded:tree.readBigUInt64LE(offset+22)});marker=tree.readUInt16LE(offset+30);offset+=32;}while(marker!==0xffff);}
      else{need(10);chunks.push({at:BigInt(tree.readUInt32LE(offset)),size:BigInt(tree.readUInt32LE(offset+4)),decoded:BigInt(tree.readUInt32LE(offset+4))});if(tree.readUInt16LE(offset+8)!==0xffff)throw Error('VPK 索引不完整');offset+=10;}
      const limit=BigInt(major===1?stat.size-start-treeSize:embedded);
      for(const chunk of chunks){if(chunk.size>0n&&index!==0x7fff)throw Error('请选择完整的单文件 Addon VPK，分卷 VPK 请按作者说明安装');if(chunk.size>0n&&chunk.at+chunk.size>limit)throw Error('VPK 索引不完整');}
      need(preload);const prefix=tree.subarray(offset,offset+preload);offset+=preload;
      if(dir===' '&&name.toLowerCase()==='addoninfo'&&ext.toLowerCase()==='txt'){
        const size=chunks.reduce((n,c)=>n+c.size,BigInt(preload));
        if(size<=1024n*1024n&&chunks.every(c=>c.size===c.decoded)){
          const parts=[prefix];for(const chunk of chunks){const bytes=Buffer.alloc(Number(chunk.size));if(bytes.length&&(await handle.read(bytes,0,bytes.length,start+treeSize+Number(chunk.at))).bytesRead!==bytes.length)throw Error('VPK 索引不完整');parts.push(bytes);}
          info=metadataBytes(Buffer.concat(parts),path.basename(target,'.vpk'));
        }
      }
    }
    if(!entries||tree.subarray(offset).some(value=>value!==0))throw Error('VPK 索引不完整');
    return {size:stat.size,info};
  }finally{await handle.close();}
}
async function readStates(filename){
  if(!await existing(filename))return new Map();const stat=await regular(filename,'file');if(!stat.size||stat.size>1024*1024)throw Error('addonlist.txt 无效，请先修复该文件');
  // Delta reads a flat list in source order; duplicate names replace earlier
  // entries, including duplicates with different letter case.
  const source=await fs.readFile(filename,'utf8');let offset=0;
  function token(){
    for(;;){while(/\s/.test(source[offset]||'')&&offset<source.length)offset++;
      if(source.slice(offset,offset+2)!=='//')break;
      const end=source.indexOf('\n',offset);offset=end<0?source.length:end+1;
    }
    if(offset===source.length)return null;
    const first=source[offset++];if(first==='{'||first==='}')return {brace:first};
    if(first!=='"'){const start=offset-1;while(offset<source.length&&!/[\s{}]/.test(source[offset])&&source.slice(offset,offset+2)!=='//')offset++;return {value:source.slice(start,offset)};}
    let value='';while(offset<source.length){const ch=source[offset++];if(ch==='"')return {value};
      if(/[\r\n\0]/.test(ch))throw Error('addonlist.txt 格式无效');
      if(ch!=='\\'){value+=ch;continue;}
      if(offset===source.length)break;const next=source[offset++];
      value+=({'\\':'\\','"':'"',n:'\n',r:'\r',t:'\t'})[next]??'\\'+next;
    }throw Error('addonlist.txt 格式无效');
  }
  if(token()?.value?.toLowerCase()!=='addonlist'||token()?.brace!=='{')throw Error('addonlist.txt 格式无效');
  const states=new Map();for(;;){const name=token();if(name?.brace==='}')break;
    if(!name?.value)throw Error('addonlist.txt 格式无效');safeName(name.value);const value=token()?.value;
    if(typeof value!=='string'||!/^[-]?\d+$/.test(value)||Number(value)<-2147483648||Number(value)>2147483647)throw Error('addonlist.txt 状态无效');
    states.set(name.value.toLowerCase(),{name:name.value,enabled:Number(value)!==0});
    if(states.size>4096)throw Error('addonlist.txt 格式无效');
  }
  if(token()!==null)throw Error('addonlist.txt 格式无效');return states;
}
async function writeStates(filename,states){
  const temp=filename+'.tfx-'+crypto.randomUUID()+'.tmp';
  const quote=value=>JSON.stringify(value);
  try{await fs.writeFile(temp,'"AddonList"\n{\n'+[...states.values()].map(row=>'\t'+quote(row.name)+'\t"'+(row.enabled?'1':'0')+'"').join('\n')+'\n}\n',{flag:'wx'});await fs.rename(temp,filename);}
  finally{await fs.rm(temp,{force:true});}
}
async function backupState(gamepath,filename,bytes,kind){
  const root=path.join(gamepath,'r1','.tfx-addon-backups'),record=path.join(root,crypto.randomUUID());
  await fs.mkdir(record,{recursive:true});
  await fs.writeFile(path.join(record,'before.json'),JSON.stringify({gamepath,kind,addonlist:bytes?.toString('base64')??null,createdAt:new Date().toISOString()},null,2));
  return record;
}
async function scanAddons(gamepath){
  const r1=path.join(gamepath,'r1'),addons=path.join(r1,'addons'),list=path.join(r1,'addonlist.txt');
  if(!await existing(r1))return {addonsPath:addons,addons:[]};await regular(r1,'directory');
  const states=await readStates(list);if(!await existing(addons))return {addonsPath:addons,addons:[]};await regular(addons,'directory');
  const items=[];
  for(const entry of await fs.readdir(addons,{withFileTypes:true})){
    if(entry.isSymbolicLink()||!entry.isDirectory()&&!/\.vpk$/i.test(entry.name))continue;
    safeName(entry.name);const file=path.join(addons,entry.name),type=entry.isDirectory()?'folder':'vpk';
    let info={title:entry.name.replace(/\.vpk$/i,''),author:'',version:'',description:''},error='';
    try{if(type==='folder')info=await metadata(file,entry.name);else info=(await inspectVpk(file)).info||info;}catch(cause){error=cause.message;}
    items.push({id:entry.name,name:entry.name,type,...info,enabled:states.get(entry.name.toLowerCase())?.enabled===true,valid:!error,error});
  }
  return {addonsPath:addons,addons:items.sort((a,b)=>a.title.localeCompare(b.title))};
}
function createService({core,app,dialog,shell,processes=require('./is_running'),tempBase}){
  let selected=null,busy=false;
  async function context(){const status=await core.status(true);if(!status.gameInstalled||!await validateGame(status.gamepath))throw Error('请先选择泰坦陨落 1 游戏目录');await regular(status.gamepath,'directory');return status;}
  async function list(){const status=await core.status(true);return {ok:true,...(status.gameInstalled?await scanAddons(status.gamepath):{addons:[],addonsPath:''}),gamepath:status.gamepath,gameInstalled:status.gameInstalled,installed:status.installed,busy};}
  async function locked(task){if(busy)throw Error('另一个 Addon 操作正在进行');busy=true;try{return await task();}finally{busy=false;}}
  async function writable(expected){
    const current=await context();if(current.gamepath!==expected||current.busy||current.running)throw Error('游戏目录已变化或 Delta 正在运行，请退出游戏后重试');
    const snapshot=await processes.snapshot();if(!snapshot.ok)throw Error('无法检查泰坦陨落 1 进程，请稍后重试');
    if(snapshot.processes.some(row=>String(row.image||'').toLowerCase()==='titanfall.exe'))throw Error('请先退出泰坦陨落 1 再修改 Addon');
  }
  async function clear(){if(selected){await fs.rm(selected.work,{recursive:true,force:true});selected=null;}return {ok:true};}
  async function inspect(input={},progress=()=>{}){return locked(async()=>{
    await clear();let source=input.path;
    if(!source){const result=await dialog.showOpenDialog({title:'选择 Delta Addon',properties:[input.kind==='folder'?'openDirectory':'openFile'],...(input.kind==='folder'?{}:{filters:[{name:'Delta Addon',extensions:['zip','vpk']}]})});if(result.canceled||!result.filePaths?.[0])return {ok:true,canceled:true};source=result.filePaths[0];}
    if(typeof source!=='string'||!path.isAbsolute(source))throw Error('请选择本机 Addon 文件');
    progress({stage:'reading',phase:'reading',sourceName:path.basename(source)});
    const stat=await regular(source),work=await fs.mkdtemp(path.join(tempBase||app.getPath('temp'),'tfx-r1-addon-')),payload=path.join(work,'payload');
    try{
      let entryRoot=payload;
      if(stat.isDirectory()){await scanTree(source);await fs.cp(source,payload,{recursive:true,force:false,errorOnExist:true});}
      else if(/\.zip$/i.test(source)){await fs.mkdir(payload);await extractZip(source,payload);}
      else if(/\.vpk$/i.test(source)){await checkVpk(source);await fs.mkdir(payload);await fs.copyFile(source,path.join(payload,safeName(path.basename(source))));}
      else throw Error('支持 ZIP、单文件 VPK 或包含 addoninfo.txt 的文件夹');
      await scanTree(entryRoot);
      const entries=[];
      async function discover(folder,depth=0){
        if(await existing(path.join(folder,'addoninfo.txt'))){const name=safeName(folder===payload?(stat.isDirectory()?path.basename(source):path.basename(source,path.extname(source))):path.basename(folder)),info=await metadata(folder,name);entries.push({name,type:'folder',source:folder,...info});return;}
        if(depth>5)return;
        for(const entry of await fs.readdir(folder,{withFileTypes:true})){
          const name=path.join(folder,entry.name);if(entry.isDirectory())await discover(name,depth+1);
          else if(/\.vpk$/i.test(entry.name)){const vpk=await inspectVpk(name);entries.push({name:safeName(entry.name),type:'vpk',source:name,...(vpk.info||{title:entry.name.replace(/\.vpk$/i,''),author:'',version:'',description:''})});}
        }
      }
      await discover(payload);
      if(!entries.length)throw Error('未找到 Delta Addon：文件夹需包含 addoninfo.txt，北极星 mod.json 模组不适用于泰坦陨落 1');
      const names=new Set();for(const entry of entries){const key=entry.name.toLowerCase();if(names.has(key))throw Error('包内有同名 Addon，请拆分后导入');names.add(key);entry.digest=entry.type==='folder'?await treeDigestAsync(entry.source):await hashFile(entry.source);}
      const current=await list(),preview=entries.map(({source,digest,...item})=>({...item,replaces:current.addons.some(row=>row.name.toLowerCase()===item.name.toLowerCase())}));
      selected={work,entries,token:crypto.randomUUID(),gamepath:current.gamepath};return {ok:true,token:selected.token,sourceName:path.basename(source),entries:preview};
    }catch(error){await fs.rm(work,{recursive:true,force:true});throw error;}
  });}
  async function install(input={},progress=()=>{}){return locked(async()=>{
    if(!selected||selected.token!==input.token)throw Error('导入预览已失效，请重新选择');
    const status=await context();if(status.gamepath!==selected.gamepath)throw Error('游戏目录已变化，请重新选择 Addon');await writable(status.gamepath);
    const r1=path.join(status.gamepath,'r1');await directory(r1);const addons=path.join(r1,'addons');await directory(addons);
    const listFile=path.join(r1,'addonlist.txt'),states=await readStates(listFile),before=await existing(listFile)?await fs.readFile(listFile):null;
    const installed=await scanAddons(status.gamepath),operations=[];
    for(const entry of selected.entries){
      const digest=entry.type==='folder'?await treeDigestAsync(entry.source):await hashFile(entry.source);if(digest!==entry.digest)throw Error('预览文件已变化，请重新选择');
      const old=installed.addons.find(row=>row.name.toLowerCase()===entry.name.toLowerCase()),name=old?.name||entry.name,target=path.join(addons,name);
      if(await existing(target)&&!input.replace)throw Error('存在同名 Addon，请确认替换');
      if(await existing(target))await regular(target,old?.type==='folder'?'directory':'file');
      operations.push({...entry,name,target,hadOld:!!await existing(target)});
    }
    const recovery=path.join(r1,'.tfx-addon-backups');await directory(recovery);const record=path.join(recovery,crypto.randomUUID());await fs.mkdir(record);
    await fs.writeFile(path.join(record,'before.json'),JSON.stringify({gamepath:status.gamepath,addonlist:before?.toString('base64')??null,entries:operations.map(({name,hadOld})=>({name,hadOld}))},null,2));
    const done=[];
    try{
      for(const [index,entry]of operations.entries()){
        await writable(status.gamepath);progress({phase:'正在安装 Delta Addon',percent:Math.round(index/operations.length*90)});
        const stage=path.join(record,'new-'+index);if(entry.type==='folder')await fs.cp(entry.source,stage,{recursive:true});else await fs.copyFile(entry.source,stage);
        const operation={...entry,backup:path.join(record,'old-'+index),committed:false,moved:false};done.push(operation);
        if(entry.hadOld){await fs.rename(entry.target,operation.backup);operation.moved=true;}
        await fs.rename(stage,entry.target);operation.committed=true;states.set(entry.name.toLowerCase(),{name:entry.name,enabled:states.get(entry.name.toLowerCase())?.enabled??true});
      }
      await writeStates(listFile,states);await fs.writeFile(path.join(record,'complete.json'),JSON.stringify({completedAt:new Date().toISOString()}));
    }catch(error){
      for(const entry of done.reverse()){if(entry.committed)await fs.rm(entry.target,{recursive:true,force:true});if(entry.moved)await fs.rename(entry.backup,entry.target);}
      if(before)await fs.writeFile(listFile,before);else await fs.rm(listFile,{force:true});throw error;
    }
    await clear();progress({phase:'Delta Addon 安装完成',percent:100});return {...await list(),busy:false,backupPath:record};
  });}
  async function setEnabled(input){return locked(async()=>{
    if(typeof input?.enabled!=='boolean')throw Error('Addon 状态无效');const status=await context();await writable(status.gamepath);
    const data=await scanAddons(status.gamepath),item=data.addons.find(row=>row.id===input.id);if(!item)throw Error('Addon 不存在');if(input.enabled&&!item.valid)throw Error(item.error);
    const filename=path.join(status.gamepath,'r1/addonlist.txt'),before=await existing(filename)?await fs.readFile(filename):null,states=await readStates(filename);await backupState(status.gamepath,filename,before,'toggle');states.set(item.name.toLowerCase(),{name:item.name,enabled:input.enabled});await writeStates(filename,states);return {...await list(),busy:false};
  });}
  async function remove(input){return locked(async()=>{
    const status=await context();await writable(status.gamepath);const data=await scanAddons(status.gamepath),item=data.addons.find(row=>row.id===input?.id);if(!item)throw Error('Addon 不存在');
    const source=path.join(data.addonsPath,safeName(item.name));await regular(source,item.type==='folder'?'directory':'file');if(item.type==='folder')await scanTree(source);
    const r1=path.join(status.gamepath,'r1'),recovery=path.join(r1,'.tfx-addon-backups');await directory(recovery);const record=path.join(recovery,crypto.randomUUID());await fs.mkdir(record);
    const filename=path.join(r1,'addonlist.txt'),states=await readStates(filename),before=await existing(filename)?await fs.readFile(filename):null;
    await fs.writeFile(path.join(record,'removed.json'),JSON.stringify({name:item.name,addonlist:before?.toString('base64')??null}));const target=path.join(record,item.name);await fs.rename(source,target);
    try{states.delete(item.name.toLowerCase());await writeStates(filename,states);}catch(error){await fs.rename(target,source);throw error;}return {...await list(),busy:false,backupPath:record};
  });}
  async function open(kind='addons'){const status=await context(),r1=path.join(status.gamepath,'r1');await directory(r1);const target=path.join(r1,kind==='backups'?'.tfx-addon-backups':'addons');await directory(target);const error=await shell.openPath(target);if(error)throw Error(error);return {ok:true};}
  return {list,inspect,install,setEnabled,remove,clear:()=>locked(clear),open};
}
function register(electron,core,options={}){
  const service=createService({...electron,core,...options});
  const send=event=>value=>{if(!event.sender.isDestroyed())event.sender.send('r1delta-addon-progress',value);};
  const handlers={'r1delta-addons-list':()=>service.list(),'r1delta-addons-inspect':(event,input)=>service.inspect(input,send(event)),'r1delta-addons-clear':()=>service.clear(),'r1delta-addons-install':(event,input)=>service.install(input,send(event)),'r1delta-addons-toggle':(_event,input)=>service.setEnabled(input),'r1delta-addons-remove':(_event,input)=>service.remove(input),'r1delta-addons-open':(_event,kind)=>service.open(kind)};
  for(const [channel,handler]of Object.entries(handlers))electron.ipcMain.handle(channel,async(...args)=>{try{return await handler(...args);}catch(error){console.error('[R1Delta Addons]',channel,error);return {ok:false,error:error.message};}});
  electron.app.on?.('before-quit',()=>{service.clear().catch(()=>{});});return service;
}
module.exports={createService,register,safeName,readStates,writeStates,scanAddons,metadata,metadataBytes,inspectVpk,checkVpk};
