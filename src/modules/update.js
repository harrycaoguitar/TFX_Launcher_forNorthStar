"use strict";
const fs = require("fs"), path = require("path");
const {ipcMain,app} = require("electron");
const settings = require("./settings"), releases = require("./releases"), clients = require("./northstar-clients");
const gate = require("./dds-operation-gate"), running = require("./is_running");
const network = require("./northstar-region"), win = require("../win"), console = require("./console");
const update = {};
function send(value) {try {win().send("ns-update-event",value);}catch(_) {}}
function errorMessage(error) {return settings().uiLanguage === "en-US" ? "Northstar client update failed: " + error.message : "北极星客户端更新失败：" + error.message;}
async function stopped(gameRoot) {
  const snapshot = await running.snapshot();
  if (!snapshot?.ok) throw Error("无法确认游戏进程，已停止北极星文件切换");
  if (require("./game-roots").hasGame(snapshot, gameRoot)) throw Error("请先退出所选游戏目录中的 Titanfall 2 及北极星进程，再切换客户端文件");
}
async function available(conf, force=false, githubOnly=false) {
  const region = network.normalize(conf.northstarRegion), local = await clients.status(region,conf);
  if (!local.ok || !local.installed) {
    const error=Error(local.error||"所选北极星客户端尚未安装，请先点击安装客户端。");
    error.code="NOT_INSTALLED";error.region=region;error.status=local;throw error;
  }
  const latest = await releases.latest.northstar({region,force,githubOnly});
  if (!latest) throw Error("无法从 GitHub 确认北极星正式版本，请稍后重试。");
  const localVersion=local.selectedVersion||(local.active?local.installedVersion:null);
  const comparison=releases.compareVersions(localVersion,latest.version);
  if (comparison === null) throw Error("无法确认已安装版本，已停止更新以避免降级。");
  return {region,local,localVersion,latest,newer:comparison<0};
}
update.northstar = async (forceInstall, expected) => {
  if (update.northstar.updating) return {ok:false,pending:true};
  update.northstar.updating = true;
  const conf = Object.freeze({...settings()}), region = network.normalize(conf.northstarRegion);
  const guard=()=>{const current=settings();if(network.normalize(current.northstarRegion)!==region||current.gamepath!==conf.gamepath||current.globalGamepath!==conf.globalGamepath||current.nsargs!==conf.nsargs)throw Error("客户端选择已改变，请重新检查更新。");};
  try {
    return await gate.run("client-update",async()=>{
      const selection=clients.context(conf); await stopped(selection.gameRoot);
      send("cli.update.checking");
      if(expected&&expected.region!==region)throw Error("客户端区域已改变，请重新检查更新。");
      const check = await available(conf,true,Boolean(expected));
      if(expected&&expected.version!==check.latest.version)throw Error("GitHub 发布版本已改变，请重新检查更新。");
      // Preserve newer local CN builds; compare only versions of one family.
      const forceDownload=forceInstall===true&&releases.compareVersions(check.localVersion,check.latest.version)===0;
      if (!check.newer&&!forceDownload) {
        if(expected){send("cli.update.uptodate_short");return {ok:true,status:"up-to-date",region,version:check.localVersion};}
        guard();
        const result = await clients.ensure({conf,repair:forceInstall===true,allowInstall:false,refresh:true,guard}); send("cli.update.uptodate_short"); return {ok:true,...result};
      }
      send("cli.update.downloading");
      const directory = await clients.cache.update(check.latest);
      guard();
      await stopped(selection.gameRoot);
      const result = await clients.ensure({conf,directory,repair:forceInstall===true,allowInstall:false,refresh:true,guard});
      send("cli.update.uptodate_short"); return {ok:true,...result,version:check.latest.version,region,status:"updated"};
    });
  } catch(error) {
    console.error(errorMessage(error)); send("cli.update.check_failed");
    try {win().log(errorMessage(error));}catch(_){}
    return {ok:false,region,error:error.message,...(error.code?{code:error.code}:{}),...(error.code==="NOT_INSTALLED"?{requiresInstall:true,status:error.status}:{})};
  } finally {update.northstar.updating=false;}
};
update.northstar.updating=false;
ipcMain.on("update-northstar",(_event,force)=>{void update.northstar(force);});
ipcMain.handle("northstar-update-check",async()=>{
  const conf={...settings()},region=network.normalize(conf.northstarRegion);
  try {
    const result=await available(conf,true,true);
    return {ok:true,region,status:result.newer?"available":"up-to-date",localVersion:result.localVersion,latestVersion:result.latest.version};
  } catch(error) {
    return {ok:false,region,status:error.code==="NOT_INSTALLED"?"not-installed":"error",error:error.message};
  }
});
ipcMain.handle("northstar-update-install",(_event,input)=>{
  if(!["cn","global"].includes(input?.region)||typeof input?.version!=="string"||!/^v?\d+\.\d+(?:\.\d+){0,2}$/i.test(input.version))
    return {ok:false,error:"请先检查北极星更新。"};
  return update.northstar(false,input);
});
// Validated offline clients and transaction backups survive cache cleanup.
async function clearCache(){
  const directory=path.join(app.getPath("userData"),"Temp");
  try{return await gate.run("clear-download-cache",async()=>{
    const fsp=fs.promises,items=[];
    async function collect(folder){
      for(const name of await fsp.readdir(folder)){
        const target=path.join(folder,name),entry=await fsp.lstat(target);
        if(entry.isSymbolicLink())continue;
        if(entry.isDirectory())await collect(target);
        else if(entry.isFile())items.push([target,entry.size]);
      }
    }
    const stat=await fsp.lstat(directory).catch(error=>{if(error.code==="ENOENT")return null;throw error;});
    if(!stat)return {ok:true,files:0,bytes:0};
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error("下载缓存路径不是普通目录。");
    await collect(directory);
    let files=0,bytes=0;
    for(const [filename,size] of items){await fsp.unlink(filename);files++;bytes+=size;}
    return {ok:true,files,bytes};
  });}catch(error){return {ok:false,error:error.message};}
}
ipcMain.handle("download-cache-clear",clearCache);
ipcMain.on("delete-install-cache",()=>{void clearCache();});
let timer=null, started=false;
update.northstar_autoupdate=()=>{
  if(started||!settings().nsupdate)return;
  started=true;
  async function check(){
    try {
      if(settings().nsupdate&&!gate.busy){
        const conf={...settings()}, snapshot=await running.snapshot();
        const selection=clients.context(conf);
        if(snapshot?.ok&&!require("./game-roots").hasGame(snapshot,selection.gameRoot)){
          const local=await clients.status(network.normalize(conf.northstarRegion),conf);
          if(!local.ok||!local.installed)return;
          const result=await available(conf);
          if(result.newer&&network.normalize(settings().northstarRegion)===result.region&&settings().gamepath===conf.gamepath&&settings().globalGamepath===conf.globalGamepath)await update.northstar();
        }
      }
    }catch(error){console.warn(errorMessage(error));}
    finally{timer=setTimeout(check,15*60*1000);timer.unref?.();}
  }
  void check();
};
app.on("before-quit",()=>{clearTimeout(timer);});
module.exports=update;
