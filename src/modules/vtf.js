"use strict";
const path=require("path"),{app,ipcMain,dialog,BrowserWindow,shell}=require("electron");
const {VtfEngine,errorText}=require("./vtf-engine"),{VtfImportCache}=require("./vtf-cache"),settings=require("./settings"),isRunning=require("./is_running");
const gate=require("./dds-operation-gate");
const protection=require("./dds-guard");
const {OfflineSkinPack,productionDirectories}=require("./offline-skin-pack");
const skinPreview=require("./skin-conflict-preview");
const gameRoots=require("./game-roots");
const toolsDir=path.join(__dirname,"../tools/vtf").replace(/app\.asar([\\/])/,"app.asar.unpacked$1");
let sender,selectedPackageId,operation,quitting=false,quitReady=false;const gamePath=()=>gameRoots.gameRootForProfile(settings());
let selectionRevision=0,selectionError="";
function clearSelection(){selectedPackageId=undefined;selectionError="";++selectionRevision;}
function currentPackage(input={}){if(!selectedPackageId||(input.packageId!==undefined&&input.packageId!==selectedPackageId)||(input.selectionRevision!==undefined&&input.selectionRevision!==selectionRevision))throw Error("请先重新导入并校验兼容的 VTF 皮肤，之前的选择已失效");return selectedPackageId;}
const baseDir=path.join(app.getPath("appData"),"fold-launcher","vtf"),cache=new VtfImportCache(baseDir),ready=cache.initialize();ready.catch(()=>{});
const engine=new VtfEngine({baseDir,packagesDir:cache.sessionDir,toolsDir,offlinePack:new OfflineSkinPack({directories:productionDirectories()}),isGameRunning:async()=>gameRoots.hasGame(await isRunning.snapshot(),gamePath()),progress:data=>{if(sender&&!sender.isDestroyed())sender.send("vtf-progress",data);}});
async function response(event,action,importing=false,sharedImport=false){
  if(quitting)return {ok:false,error:"启动器正在退出"};if(operation||engine.busy||engine.sharedImportBusy&&!sharedImport)return {ok:false,error:"另一个 VTF 操作正在执行"};sender=event.sender;
  // Reserve the operation before any asynchronous file picker or cache work.
  if(importing)clearSelection();
  operation=(async()=>{try{await ready;return {ok:true,...await action(),selectionRevision};}catch(err){const message=errorText(err);if(importing){selectedPackageId=undefined;selectionError=message;await cache.releaseExcept(engine).catch(()=>{});}if(sender&&!sender.isDestroyed())sender.send("vtf-progress",{phase:"error",percent:0,message});let current={};try{current=await status();}catch{}return {ok:false,...current,error:message,selectionRevision,...(!selectedPackageId?{package:null,conflictPreview:null}:{} )};}})();
  try{return await operation;}finally{operation=null;}
}
const status=async(root=gamePath(),packageId=selectedPackageId)=>{
  const revision=selectionRevision,analysis=await engine.status(root,packageId);
  const conflictPreview=await skinPreview.forStatus({format:"vtf",engine,gamePath:root,packageId,analysis,settings:settings(),getSettings:settings,isCurrent:()=>revision===selectionRevision&&packageId===selectedPackageId&&root===gamePath()});
  return {...analysis,conflictPreview,protection:await protection.status(root)};
};
async function inspect(source){
  const pkg=await engine.inspect(source);selectedPackageId=pkg.id;
  const warnings=await cache.releaseExcept(engine,pkg.id);
  return {...await status(),package:pkg,...(warnings.length?{cacheWarning:"皮肤已导入，旧临时缓存将在退出后重试清理"}:{})};
}
ipcMain.handle("vtf-status",async()=>{try{await ready;const revision=selectionRevision,packageId=selectedPackageId,error=selectionError;return {ok:true,...await status(gamePath(),packageId),selectionRevision:revision,selectionError:error};}catch(err){return {ok:false,error:errorText(err),selectionRevision,package:null,conflictPreview:null};}});
ipcMain.handle("vtf-preview",async(_event,input={})=>{
  try {await ready;currentPackage(input);return {ok:true,...await status(),selectionRevision};}
  catch(error){return {ok:false,error:errorText(error),package:null,conflictPreview:null,selectionRevision};}
});
ipcMain.handle("vtf-select",async(event,options={})=>response(event,async()=>{const folder=options.kind==="folder";const selected=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:folder?"选择 VTF 皮肤文件夹":"选择 VTF 皮肤压缩包",properties:folder?["openDirectory"]:["openFile"],...(folder?{}:{filters:[{name:"VTF 皮肤压缩包",extensions:["zip","7z","rar","tar","gz","bz2","xz","tgz","tbz2","txz","cab"]},{name:"所有文件",extensions:["*"]}]})});if(selected.canceled||!selected.filePaths.length){await cache.releaseExcept(engine);return {cancelled:true,package:null,conflictPreview:null};}return inspect(selected.filePaths[0]);},true));
ipcMain.handle("vtf-inspect",async(event,input)=>response(event,async()=>{if(typeof input?.path!=="string"||!path.isAbsolute(input.path))throw Error("请选择本地 VTF 皮肤包");return inspect(input.path);},true));
ipcMain.handle("vtf-clear",async(event)=>response(event,async()=>{clearSelection();const warnings=await cache.releaseExcept(engine);return {...await status(),...(warnings.length?{cacheWarning:"选择已清除，临时缓存将在退出后重试清理"}:{})};}));
async function installSelected(root,packageId,input={}) {
  const revision=selectionRevision;let candidate,warning;
  try {candidate=await protection.prepareCapture(root);}catch(error){warning=errorText(error);}
  if(root!==gamePath()||revision!==selectionRevision||packageId!==currentPackage(input))throw Error("VTF 选择或游戏目录已更新，请重新确认当前皮肤包");
  const result=await engine.install(root,packageId);
  if(candidate)try{await protection.commitCapture(root,candidate);}catch(error){warning=errorText(error);}
  return {result,...(warning?{protectionWarning:warning}:{})};
}
ipcMain.handle("vtf-install",async(event,input={})=>response(event,async()=>gate.run("vtf-write",async()=>{
  const root=gamePath(),result=await installSelected(root,currentPackage(input),input);
  return {...result,...await status(root)};
})));
ipcMain.handle("vtf-restore",async(event,input={})=>response(event,async()=>gate.run("vtf-write",async()=>{const root=gamePath(),result=await engine.restore(root,input.backupId);return {result,...await status(root)};})));
ipcMain.handle("vtf-delete-backup",async(event,input={})=>response(event,async()=>gate.run("vtf-delete-backup",async()=>{const root=gamePath(),result=await engine.deleteBackup(root,input.backupId);return {result,...await status(root)};})));
ipcMain.handle("vtf-open-backups",async(event)=>response(event,async()=>{await engine.initialize();const error=await shell.openPath(path.join(engine.baseDir,"backups"));if(error)throw Error(error);return {};}));
ipcMain.handle("vtf-originals-select",async(event,input={})=>response(event,async()=>gate.run("vtf-resource-repair",async()=>{
  const root=gamePath(),packageId=currentPackage(input),revision=selectionRevision;
  const selected=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:"选择完整原版游戏目录或资源文件夹",properties:["openDirectory"]});
  if(selected.canceled||!selected.filePaths.length)return {cancelled:true};
  if(root!==gamePath()||revision!==selectionRevision||packageId!==currentPackage(input))throw Error("VTF 选择或游戏目录已更新，请重新确认当前皮肤包");
  const result=await engine.repairResources(root,packageId,selected.filePaths[0]);if(engine.prepareSkinRepairSource)await engine.prepareSkinRepairSource(root,engine.packages.get(packageId),selected.filePaths[0]);return {result,...await status(root)};
})));
require("./skin-resource-download").register("vtf",{engine,currentPackage,revision:()=>selectionRevision,gamePath,status,response,install:installSelected});
engine.importSelection=(event,source)=>response(event,()=>inspect(source),true,true);
engine.invalidateSelection=()=>clearSelection();
engine.isImportBusy=()=>Boolean(operation||engine.busy||engine.sharedImportBusy||gate.busy||quitting);
app.on("before-quit",event=>{
  if(quitReady)return;event.preventDefault();if(quitting)return;quitting=true;
  // Never remove assets while an import/install operation still reads them.
  Promise.resolve(operation).then(()=>ready).then(()=>cache.close(engine)).catch(err=>console.warn("VTF 临时缓存将在下次启动时清理：",errorText(err))).finally(()=>{quitReady=true;app.quit();});
});
module.exports=engine;
