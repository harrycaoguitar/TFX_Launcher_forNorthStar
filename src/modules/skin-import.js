"use strict";
// One content-based import boundary. The existing engines still own validation,
// installation and recovery; probing never reads or writes the game directory.
const fs=require("fs"),fsp=fs.promises,path=require("path"),crypto=require("crypto");
const {safeAssetPath}=require("./vtf-vpk");
const {assertUnlinkedAncestors}=require("./backup-records");
const {inspectModDirectory,treeDigestAsync}=require("./local-mod-import");
const MAX_FILES=20000,SKIN_FILES=2000,MAX_BYTES=4*1024**3,DDS_BYTES=512*1024**2,MOD_BYTES=2*1024**3;
const NOTES=/\.(?:txt|md|png|jpe?g|webp)$/i;
const DDS_NOTES=/\.(?:docx?|pdf|rtf|url)$/i;
const VTF_ASSETS=/\.(?:vtf|vmt|mdl|vvd|vtx|phy|ani)$/i;
const messages=Object.freeze({
  busy:"另一个皮肤操作正在执行，请等待完成后再导入。",
  source:"请选择本地皮肤 / Mod 文件、压缩包或完整文件夹。",
  mixed:"这个皮肤包同时包含 DDS 和 VTF 资源。请将两种皮肤分开导入，避免安装错误。",
  empty:"未发现兼容的 DDS / VTF 皮肤或北极星 Mod。Mod 包必须包含有效的 mod.json。",
  archive:"无法读取这个皮肤压缩包，文件可能已损坏、加密或不是受支持的压缩包。",
  unsafe:"皮肤包包含不安全的路径、链接或非普通文件，已停止导入。",
  limit:"皮肤包的文件数量、层级或解压体积超过支持范围。",
  unsupported:"包内包含不支持的文件。请选择完整 DDS / VTF 皮肤，或包含有效 mod.json 的北极星 Mod。",
  changed:"导入过程中皮肤文件发生变化，请重新导入。",
  modUnavailable:"Mod 安装服务暂不可用，请重新启动启动器后再试。",
  modSelection:"这个 Mod 导入已失效，请重新拖入文件后安装。",
  looseVtf:"单独的 VTF 文件无法确定游戏资源路径。请选择保留 materials / models 结构的完整皮肤文件夹或压缩包。"
});
function safeName(value){
  try{return safeAssetPath(String(value).replace(/\\/g,"/"));}catch{throw Error(messages.unsafe);}
}
function classify(entries){
  const files=entries.filter(entry=>!entry.directory),mod=files.some(entry=>/(?:^|\/)mod\.json$/i.test(entry.name)),dds=files.some(entry=>/\.dds$/i.test(entry.name)),vtf=files.some(entry=>/\.vtf$/i.test(entry.name));
  if(mod){
    const bytes=files.reduce((total,entry)=>{if(!Number.isSafeInteger(entry.bytes)||entry.bytes<0)throw Error(messages.limit);return total+entry.bytes;},0);
    if(files.length>MAX_FILES||bytes>MOD_BYTES)throw Error(messages.limit);
    return "mod";
  }
  if(dds&&vtf)throw Error(messages.mixed);
  if(!dds&&!vtf)throw Error(messages.empty);
  const format=dds?"dds":"vtf";
  let bytes=0,count=0;
  for(const entry of files){
    if(!Number.isSafeInteger(entry.bytes)||entry.bytes<0)throw Error(messages.limit);
    bytes+=entry.bytes;count++;
    if(!NOTES.test(entry.name)&&!(format==="dds"?/\.dds$/i.test(entry.name)||DDS_NOTES.test(entry.name):VTF_ASSETS.test(entry.name)))throw Error(messages.unsupported);
  }
  if(count>SKIN_FILES||bytes>MAX_BYTES||(format==="dds"&&bytes>DDS_BYTES))throw Error(messages.limit);
  return format;
}
function isIcepickDefinition(definition){return Boolean(definition&&typeof definition==="object"&&(definition.ApiId||definition.CustomScripts||definition.CustomScript));}
function parseListing(listing){
  const entries=[],seen=new Set();
  for(const block of String(listing).split(/\r?\n\r?\n/)){
    const values={};for(const line of block.split(/\r?\n/)){const match=line.match(/^([^=]+) = (.*)$/);if(match)values[match[1].trim()]=match[2];}
    if(!values.Path)continue;
    const name=safeName(values.Path),key=name.toLowerCase();
    if(seen.has(key)||values["Symbolic Link"]||values["Hard Link"]||values["Copy Link"]||values["Alternate Stream"]==="+"||/^l/.test(values.Mode||"")||/^L/.test(values.Attributes||"")||/(?:^|\s)l[rwx-]{3}/.test(values.Attributes||""))throw Error(messages.unsafe);
    seen.add(key);if(values.Encrypted==="+")throw Error(messages.archive);
    const directory=values.Folder==="+"||/^D/.test(values.Attributes||"");
    const bytes=directory?0:Number(values.Size);if(!Number.isSafeInteger(bytes)||bytes<0)throw Error(messages.limit);
    entries.push({name,bytes,directory});if(entries.length>MAX_FILES)throw Error(messages.limit);
  }
  // A file cannot also be an ancestor of another output path.
  const files=new Set(entries.filter(entry=>!entry.directory).map(entry=>entry.name.toLowerCase()));
  for(const entry of entries){const parts=entry.name.toLowerCase().split("/");for(let i=1;i<parts.length;i++)if(files.has(parts.slice(0,i).join("/")))throw Error(messages.unsafe);}
  return entries;
}
async function scanDirectory(root){
  const entries=[];let total=0;
  async function visit(directory,relative="",depth=0){
    if(depth>40)throw Error(messages.limit);
    await assertUnlinkedAncestors(directory,messages.unsafe);
    const before=await fsp.lstat(directory);if(!before.isDirectory()||before.isSymbolicLink())throw Error(messages.unsafe);
    const names=new Set();
    for(const item of await fsp.readdir(directory,{withFileTypes:true})){
      const key=item.name.toLowerCase();if(names.has(key))throw Error(messages.unsafe);names.add(key);
      const name=safeName(relative?relative+"/"+item.name:item.name),source=path.join(directory,item.name),stat=await fsp.lstat(source);
      if(stat.isSymbolicLink()||!stat.isFile()&&!stat.isDirectory())throw Error(messages.unsafe);
      if(stat.isDirectory())await visit(source,name,depth+1);
      else{entries.push({name,bytes:stat.size,directory:false,identity:signature(stat)});total+=stat.size;if(entries.length>MAX_FILES||total>MAX_BYTES)throw Error(messages.limit);}
    }
    await assertUnlinkedAncestors(directory,messages.unsafe);if(signature(await fsp.lstat(directory))!==signature(before))throw Error(messages.changed);
  }
  await visit(root);return entries;
}
function signature(stat){return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`;}
class SkinImporter{
	constructor({dds,vtf,mods,icepick,BrowserWindow,stagingDir}){this.engines={dds,vtf};this.mods=mods;this.icepick=icepick;this.BrowserWindow=BrowserWindow;this.stagingDir=stagingDir||path.join(dds.baseDir,"unified-import");this.busy=false;this.pendingMod=null;}
  isBusy(){return this.busy||Object.values(this.engines).some(engine=>engine.isImportBusy())||Boolean(this.mods?.isImportBusy?.());}
  reserve(value){for(const engine of Object.values(this.engines))engine.sharedImportBusy=value;if(this.mods)this.mods.sharedImportBusy=value;}
  invalidate(){for(const engine of Object.values(this.engines))engine.invalidateSelection();}
  async discardMod(){const selected=this.pendingMod;this.pendingMod=null;if(selected?.temporary)await fsp.rm(selected.temporary,{recursive:true,force:true}).catch(()=>{});}
  async clear(){if(this.isBusy())return {ok:false,error:messages.busy};this.busy=true;this.reserve(true);this.invalidate();try{await this.discardMod();return {ok:true,package:null};}finally{this.reserve(false);this.busy=false;}}
  progress(event,update){try{if(!event?.sender?.isDestroyed?.())event?.sender?.send?.("skin-import-progress",{format:"mod",...update});}catch{}}
  async install(event,input={}){
    if(this.isBusy())return {ok:false,format:"mod",error:messages.busy};
    this.busy=true;this.reserve(true);
    try{
      const selected=this.pendingMod;
      if(!selected||typeof input.id!=="string"||input.id!==selected.id)throw Error(messages.modSelection);
      if(typeof this.mods?.install!=="function")throw Error(messages.modUnavailable);
      this.progress(event,{phase:"installing",percent:5,estimate:true});
      await assertUnlinkedAncestors(selected.input,messages.unsafe);
      if(await treeDigestAsync(selected.input)!==selected.digest)throw Error(messages.changed);
      const result=await this.mods.install(selected.input,{sharedImport:true,preparedSnapshot:true,destname:selected.destname,onProgress:update=>this.progress(event,update)});
      this.progress(event,{phase:result?.ok?"complete":"failed",percent:result?.ok?100:90,estimate:false});
      return {...result,ok:Boolean(result?.ok),format:"mod",sourceName:selected.name,modNames:selected.names,files:selected.files};
    }catch(error){return {ok:false,format:"mod",error:error.message||String(error)};}
    finally{await this.discardMod();this.reserve(false);this.busy=false;try{if(!this.isBusy())event?.sender?.send?.("set-buttons",true);}catch{}}
  }
  async run(event,readSource){
    if(this.isBusy())return {ok:false,error:messages.busy,package:null};
    this.busy=true;this.reserve(true);this.invalidate();let temporary,format;
    try{
      await this.discardMod();
      const source=await readSource();if(!source)return {ok:true,cancelled:true,package:null};
      if(typeof source!=="string"||!path.isAbsolute(source))throw Error(messages.source);
      await assertUnlinkedAncestors(source,messages.unsafe);
      const stat=await fsp.lstat(source);if(stat.isSymbolicLink()||!stat.isFile()&&!stat.isDirectory())throw Error(messages.unsafe);
      let entries,loose=false,zip=false;
      if(stat.isDirectory())entries=await scanDirectory(source);
      else{
        const handle=await fsp.open(source,"r"),magic=Buffer.alloc(4);try{await handle.read(magic,0,4,0);}finally{await handle.close();}
        zip=[0x04034b50,0x06054b50,0x08074b50].includes(magic.readUInt32LE(0));
        if(magic.toString("ascii")==="DDS "){entries=[{name:path.basename(source,path.extname(source))+".dds",bytes:stat.size}];loose=true;}
        else if(magic.toString("ascii")==="VTF\0")throw Error(messages.looseVtf);
        else{try{entries=parseListing(await this.engines.vtf.tool(["l","-ba","-slt","-sccUTF-8",source]));}catch(error){if(Object.values(messages).includes(error.message))throw error;throw Error(messages.archive);}}
      }
      format=classify(entries);const engine=this.engines[format];
      if(signature(await fsp.lstat(source))!==signature(stat))throw Error(messages.changed);
      let input=source;
      if(format==="mod"){
        if(typeof this.mods?.install!=="function")throw Error(messages.modUnavailable);
        await fsp.mkdir(this.stagingDir,{recursive:true});temporary=await fsp.mkdtemp(path.join(this.stagingDir,"mod-"));
        const base=stat.isDirectory()?path.basename(source):path.basename(source,path.extname(source));input=path.join(temporary,base||"Mod");
        const free=await fsp.statfs(this.stagingDir),needed=entries.reduce((sum,entry)=>sum+entry.bytes,0)*2+32*1024**2;
        if(Number(free.bavail)*Number(free.bsize)<needed)throw Error("磁盘剩余空间不足，请清理空间后重新导入 Mod。");
        if(stat.isDirectory())await fsp.cp(source,input,{recursive:true,dereference:false,errorOnExist:true,force:false});
        else{
          await fsp.mkdir(input);
          try{await this.engines.vtf.tool(["x","-y","-sccUTF-8","-o"+input,source]);}catch{throw Error(messages.archive);}
        }
        const actual=await scanDirectory(input),declared=new Map(entries.filter(entry=>!entry.directory).map(entry=>[entry.name.toLowerCase(),entry.bytes]));
        const sourceName=path.basename(source),baseName=stat.isDirectory()?sourceName:path.basename(source,path.extname(source));
        if(classify(actual)!=="mod"||actual.length!==declared.size||actual.some(entry=>declared.get(entry.name.toLowerCase())!==entry.bytes))throw Error(messages.changed);
        const inspected=await inspectModDirectory(input,{sourceName:baseName});
        if(stat.isDirectory()){
          const current=await scanDirectory(source),original=new Map(entries.map(entry=>[entry.name,entry.identity]));
          if(current.length!==entries.length||current.some(entry=>original.get(entry.name)!==entry.identity))throw Error(messages.changed);
        }else if(signature(await fsp.lstat(source))!==signature(stat))throw Error(messages.changed);
        const icepickDefinitionPath=inspected.plan.length===1?path.join(inspected.plan[0].directory,"mod.json"):"";
        let icepickDefinition=null;
        if(icepickDefinitionPath)try{icepickDefinition=JSON.parse(await fsp.readFile(icepickDefinitionPath,"utf8"));}catch{}
        if(isIcepickDefinition(icepickDefinition)){
          if(typeof this.icepick?.installSource!=="function")throw Error("Icepick 安装服务暂不可用，请重新启动启动器后再试。");
			const parent=this.BrowserWindow?.fromWebContents?.(event?.sender);
          const icepickName=String(icepickDefinition.ApiId||icepickDefinition.Name||baseName);
			const installed=await this.icepick.installSource(inspected.plan[0].directory,icepickName,{parent});
          if(!installed?.ok)return {ok:false,format:"icepick",sourceName,error:installed?.error||"Icepick Mod 未安装。",canceled:Boolean(installed?.canceled)};
          const displayName=installed.name||baseName;
          return {ok:true,format:"icepick",sourceName,installed:true,state:{ok:true,package:{id:displayName,name:displayName}}};
        }
        const id=crypto.randomBytes(18).toString("hex"),files=actual.map(({name,bytes})=>({name,bytes}));
        this.pendingMod={id,input,temporary,digest:await treeDigestAsync(input),name:sourceName,names:inspected.names,files,destname:inspected.plan.length===1&&inspected.plan[0].directory===input?inspected.plan[0].folder:undefined};
        temporary=null;
        return {ok:true,format,sourceName,state:{ok:true,package:{id,name:sourceName,sourcePath:source,files,count:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0),modCount:inspected.modCount,modNames:inspected.names}}};
      }
      // VTF already has a safe general extractor. DDS ZIP keeps its native CRC-
      // checked streaming reader; other DDS archives are extracted exactly once.
      if(format==="vtf"&&!stat.isDirectory()&&/\.(?:dds|vtf)$/i.test(source)){
        // A readable archive may itself have an incorrect skin extension. Give
        // the existing VTF engine a neutral archive name without extracting it.
        await fsp.mkdir(this.stagingDir,{recursive:true});temporary=await fsp.mkdtemp(path.join(this.stagingDir,"package-"));
        input=path.join(temporary,path.basename(source,path.extname(source))+".archive");await fsp.copyFile(source,input,fs.constants.COPYFILE_EXCL);
      }else if(format==="dds"&&loose&&!/\.dds$/i.test(source)){
        await fsp.mkdir(this.stagingDir,{recursive:true});temporary=await fsp.mkdtemp(path.join(this.stagingDir,"package-"));
        input=path.join(temporary,path.basename(source,path.extname(source))+".dds");await fsp.copyFile(source,input,fs.constants.COPYFILE_EXCL);
      }else if(format==="dds"&&!stat.isDirectory()&&!loose&&!(zip&&/\.zip$/i.test(source))){
        await fsp.mkdir(this.stagingDir,{recursive:true});temporary=await fsp.mkdtemp(path.join(this.stagingDir,"package-"));
        const folder=path.basename(source,path.extname(source));input=path.join(temporary,folder||"skin");await fsp.mkdir(input);
        const free=await fsp.statfs(this.stagingDir),needed=entries.reduce((sum,entry)=>sum+entry.bytes,0)*2+32*1024**2;
        if(Number(free.bavail)*Number(free.bsize)<needed)throw Error("磁盘剩余空间不足，请清理空间后重新导入皮肤。");
        try{await this.engines.vtf.tool(["x","-y","-sccUTF-8","-o"+input,source]);}catch{throw Error(messages.archive);}
        const actual=await scanDirectory(input);if(classify(actual)!==format)throw Error(messages.changed);
        const declared=new Map(entries.filter(entry=>!entry.directory).map(entry=>[entry.name.toLowerCase(),entry.bytes]));
        if(actual.length!==declared.size||actual.some(entry=>declared.get(entry.name.toLowerCase())!==entry.bytes))throw Error(messages.changed);
      }
      const state=await engine.importSelection(event,input);
      if(!state?.ok){this.invalidate();return {ok:false,format,sourceName:path.basename(source),state,error:state?.error||messages.empty,package:null};}
      if(stat.isDirectory()){
        const current=await scanDirectory(source),original=new Map(entries.map(entry=>[entry.name,entry.identity]));
        if(current.length!==entries.length||current.some(entry=>original.get(entry.name)!==entry.identity))throw Error(messages.changed);
      }else if(signature(await fsp.lstat(source))!==signature(stat))throw Error(messages.changed);
      if(state.package){
        const stored=engine.packages?.get(state.package.id);
        if(stored){stored.name=path.basename(source);stored.sourcePath=source;}
        state.package={...state.package,name:path.basename(source),sourcePath:source};
      }
      return {ok:true,format,sourceName:path.basename(source),state};
    }catch(error){this.invalidate();await this.discardMod();return {ok:false,format,package:null,error:error.message||String(error)};}
    finally{if(temporary)await fsp.rm(temporary,{recursive:true,force:true}).catch(()=>{});this.reserve(false);this.busy=false;}
  }
}
function register({ipcMain,dialog,BrowserWindow,dds,vtf,mods,icepick,app}){
	const importer=new SkinImporter({dds,vtf,mods,icepick,BrowserWindow});
  ipcMain.handle("skin-import-inspect",(event,input={})=>importer.run(event,()=>input.path));
  ipcMain.handle("skin-import-install",(event,input={})=>importer.install(event,input));
  ipcMain.handle("skin-import-clear",()=>importer.clear());
  app?.on?.("before-quit",()=>{importer.discardMod().catch(()=>{});});
  ipcMain.handle("skin-import-select",(event,input={})=>importer.run(event,async()=>{
    const folder=input.kind==="folder",selection=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{
      title:folder?"选择皮肤 / Mod 文件夹":"选择 DDS / VTF 皮肤或北极星 Mod",properties:[folder?"openDirectory":"openFile"],
      ...(folder?{}:{filters:[{name:"皮肤 / Mod 文件或压缩包",extensions:["zip","7z","rar","dds","tar","gz","bz2","xz","tgz","tbz2","txz","cab"]},{name:"所有文件",extensions:["*"]}]})
    });
    return selection.canceled?null:selection.filePaths[0];
  }));
  return importer;
}
module.exports={SkinImporter,register,classify,isIcepickDefinition,parseListing,scanDirectory,messages};
