"use strict";
const path = require("path");
const fs = require("fs");
const {app,ipcMain,dialog,BrowserWindow,shell} = require("electron");
const {DdsEngine,errorText} = require("./dds-engine");
const settings = require("./settings");
const isRunning = require("./is_running");
const gameRoots = require("./game-roots");
const protection = require("./dds-guard");
const gate = require("./dds-operation-gate");
const {OfflineSkinPack,productionDirectories}=require("./offline-skin-pack");
const skinPreview=require("./skin-conflict-preview");

let sender;
const engine = new DdsEngine({
  // Backups must survive cache cleanup and portable-runtime extraction cleanup.
  baseDir:path.join(app.getPath("appData"),"fold-launcher","dds"),
  offlinePack:new OfflineSkinPack({directories:productionDirectories()}),
  isGameRunning:async()=>gameRoots.hasGame(await isRunning.snapshot(),gamePath()),
  progress:data=>{if(sender&&!sender.isDestroyed())sender.send("dds-progress",data);}
});
let selectedPackageId;
let selectionRevision=0, inspectingRevision, selectionError="";
const gamePath=()=>gameRoots.gameRootForProfile(settings());
const clearSelection=()=>{selectedPackageId=undefined;inspectingRevision=undefined;selectionError="";return ++selectionRevision;};
function currentPackage(input={}) {
  if(inspectingRevision!==undefined || !selectedPackageId || (input.packageId!==undefined&&input.packageId!==selectedPackageId) || (input.selectionRevision!==undefined&&input.selectionRevision!==selectionRevision))throw Error("请先重新导入并校验 DDS 皮肤，之前的选择已失效");
  return selectedPackageId;
}
async function response(event,action) {
  if(engine.busy||engine.sharedImportBusy) return {ok:false,error:"另一个皮肤操作正在执行"};
  sender=event.sender;
  try{return {ok:true,...await action()};}
  catch(err){const message=errorText(err);if(sender&&!sender.isDestroyed())sender.send("dds-progress",{phase:"error",percent:0,message});let current={};try{current=await status();}catch{}return {ok:false,...current,error:message,selectionRevision,...(!selectedPackageId?{package:null,original:null,conflictPreview:null}:{})};}
}
const status = async(root=gamePath())=>{
  // Stamp the package snapshot before awaiting, so a delayed status response can
  // never claim to describe a newer import attempt.
  const revision=selectionRevision,packageId=selectedPackageId,error=selectionError;
  const analysis=await engine.status(root,packageId);
  const conflictPreview=await skinPreview.forStatus({format:"dds",engine,gamePath:root,packageId,analysis,settings:settings(),getSettings:settings,isCurrent:()=>revision===selectionRevision&&packageId===selectedPackageId&&root===gamePath()&&inspectingRevision===undefined});
  return {...analysis,conflictPreview,protection:await protection.status(root),selectionRevision:revision,selectionError:error};
};
async function importResponse(event,readPackage,{sharedImport=false}={}) {
  if(engine.busy||gate.busy||engine.sharedImportBusy&&!sharedImport)return {ok:false,error:"另一个皮肤操作正在执行",selectionRevision};
  const revision=clearSelection();inspectingRevision=revision;sender=event.sender;
  const empty={package:null,original:null,conflictPreview:null,selectionRevision:revision};
  try {
    const pkg=await readPackage();
    if(revision!==selectionRevision)return {ok:false,...empty,error:"DDS 选择已更新，请重新确认当前皮肤包"};
    if(!pkg)return {ok:true,...empty,cancelled:true};
    selectedPackageId=pkg.id;inspectingRevision=undefined;
    return {ok:true,...await status()};
  }catch(err){
    const message=errorText(err);
    if(revision===selectionRevision){selectedPackageId=undefined;selectionError=message;if(!event.sender.isDestroyed())event.sender.send("dds-progress",{phase:"error",percent:0,message});}
    return {ok:false,...empty,error:message};
  }finally{if(inspectingRevision===revision)inspectingRevision=undefined;}
}
ipcMain.handle("dds-status",async()=>({ok:true,...await status()}));
ipcMain.handle("dds-preview",async(_event,input={})=>{
  try {currentPackage(input);return {ok:true,...await status()};}
  catch(error){return {ok:false,error:errorText(error),package:null,conflictPreview:null,selectionRevision};}
});
ipcMain.handle("dds-clear",async()=>{
  if(engine.busy||gate.busy||engine.sharedImportBusy)return {ok:false,error:"另一个皮肤操作正在执行",selectionRevision};
  clearSelection();return {ok:true,package:null,original:null,conflictPreview:null,selectionRevision,selectionError:""};
});
ipcMain.handle("dds-select",async(event,options={})=>importResponse(event,async()=>{
  const folder=options.kind==="folder";
  const selection=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{
    title:folder?"选择 DDS 皮肤文件夹":"选择 DDS 皮肤或 ZIP 皮肤包",
    properties:folder?["openDirectory"]:["openFile"],
    ...(folder?{}:{filters:[{name:"DDS 皮肤包",extensions:["zip","dds"]}]})
  });
  if(selection.canceled||!selection.filePaths.length)return null;
  return engine.inspect(selection.filePaths[0]);
}));
ipcMain.handle("dds-inspect",async(event,input)=>importResponse(event,async()=>{
  if(typeof input?.path!=="string"||!path.isAbsolute(input.path))throw Error("请选择本地 DDS 皮肤包");
  return engine.inspect(input.path);
}));
async function installSelected(root,packageId,input={}) {
  const revision=selectionRevision;
  let candidate,warning;
  try {candidate=await protection.prepareCapture(root);}catch(err){warning=errorText(err);}
  if(root!==gamePath()||revision!==selectionRevision||packageId!==currentPackage(input))throw Error("请先重新导入并校验 DDS 皮肤，之前的选择已失效");
  const result=await engine.install(root,packageId);
  if(candidate)try {await protection.commitCapture(root,candidate);}catch(err){warning=errorText(err);}
  return {result,...(warning?{protectionWarning:warning}:{})};
}
ipcMain.handle("dds-install",async(event,input={})=>response(event,async()=>gate.run("dds-install",async()=>{
  const root=gamePath(),result=await installSelected(root,currentPackage(input),input);
  return {...result,...await status(root)};
})));
ipcMain.handle("dds-restore",async(event,input={})=>response(event,async()=>gate.run("dds-restore",async()=>{
  const root=gamePath();
  const result=await engine.restore(root,input.backupId);
  return {result,...await status(root)};
})));
ipcMain.handle("dds-delete-backup",async(event,input={})=>response(event,async()=>gate.run("dds-delete-backup",async()=>{
  const root=gamePath(),result=await engine.deleteBackup(root,input.backupId);
  return {result,...await status(root)};
})));
ipcMain.handle("dds-protection-status",async()=>{
  const root=gamePath();let ready=false;
  try {ready=typeof root==="string"&&path.isAbsolute(root)&&fs.statSync(path.join(root,"Titanfall2.exe")).isFile();} catch (_) {}
  return {ok:true,protection:await protection.status(root),game:{ready,path:root||""},running:await engine.isGameRunning(),busy:Boolean(gate.busy||engine.busy||protection.busy)};
});
ipcMain.handle("dds-protection-set",async(event,input={})=>response(event,async()=>gate.run("dds-settings",async()=>({protection:await protection.setEnabled(gamePath(),input.enabled)}))));
ipcMain.handle("dds-protection-capture",async event=>response(event,async()=>gate.run("dds-settings",async()=>({protection:await protection.capture(gamePath())}))));
ipcMain.handle("dds-open-backups",async()=>{
  await engine.initialize();
  const error=await shell.openPath(path.join(engine.baseDir,"backups"));
  return error?{ok:false,error}:{ok:true};
});
ipcMain.handle("dds-originals-select",async(event,input={})=>response(event,async()=>gate.run("dds-originals-select",async()=>{
  const packageId=currentPackage(input),revision=selectionRevision;
  const root=gamePath(),folder=input.kind==="folder",selection=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),folder?{title:"选择完整原版游戏目录或资源文件夹",properties:["openDirectory"]}:{title:"选择未修改的原版 pc_stream.starpak",properties:["openFile"],filters:[{name:"原版游戏资源",extensions:["starpak"]}]});
  if(selection.canceled||!selection.filePaths.length)return {cancelled:true};
  if(revision!==selectionRevision||packageId!==currentPackage(input))throw Error("请先重新导入并校验 DDS 皮肤，之前的选择已失效");
  await engine.importOriginals(root,packageId,selection.filePaths[0]);
  if(engine.prepareSkinRepairSource)await engine.prepareSkinRepairSource(root,engine.packages.get(packageId),selection.filePaths[0]);
  return await status(root);
})));
require("./skin-resource-download").register("dds",{engine,currentPackage,revision:()=>selectionRevision,gamePath,status,response,install:installSelected});
// Shared importer adopts a package through the same revision-safe boundary.
engine.importSelection=(event,source)=>importResponse(event,()=>engine.inspect(source),{sharedImport:true});
engine.invalidateSelection=()=>clearSelection();
engine.isImportBusy=()=>Boolean(engine.busy||engine.sharedImportBusy||gate.busy||inspectingRevision!==undefined);
module.exports=engine;
