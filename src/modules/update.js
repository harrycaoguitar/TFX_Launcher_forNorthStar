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
async function available(conf, force=false) {
  const region = network.normalize(conf.northstarRegion), local = await clients.status(region,conf);
  if (!local.ok || !local.installed) {
    const error=Error(local.error||"所选北极星客户端尚未安装，请先点击安装客户端。");
    error.code="NOT_INSTALLED";error.region=region;error.status=local;throw error;
  }
  const latest = await releases.latest.northstar({region,force});
  if (!latest) throw Error("未能确认所选频道的北极星客户端正式版本，请稍后重试。");
  const localVersion=local.selectedVersion||local.version, comparison = releases.compareVersions(localVersion,latest.version);
  if (localVersion !== "unknown" && comparison === null) throw Error("北极星客户端版本无法比较");
  return {region,local,localVersion,latest,newer:localVersion==="unknown"||comparison<0};
}
update.northstar = async forceInstall => {
  if (update.northstar.updating) return {ok:false,pending:true};
  update.northstar.updating = true;
  const conf = Object.freeze({...settings()}), region = network.normalize(conf.northstarRegion);
  const guard=()=>{const current=settings();if(network.normalize(current.northstarRegion)!==region||current.gamepath!==conf.gamepath||current.globalGamepath!==conf.globalGamepath||current.nsargs!==conf.nsargs)throw Error("客户端选择已改变，请重新检查更新。");};
  try {
    return await gate.run("client-update",async()=>{
      const selection=clients.context(conf); await stopped(selection.gameRoot);
      send("cli.update.checking");
      const check = await available(conf,true);
      // Preserve newer local CN builds; compare only versions of one family.
      const forceDownload=forceInstall===true&&releases.compareVersions(check.localVersion,check.latest.version)===0;
      if (!check.newer&&!forceDownload) {
        guard();
        const result = await clients.ensure({conf,repair:forceInstall===true,allowInstall:false,refresh:true,guard}); send("cli.update.uptodate_short"); return {ok:true,...result};
      }
      send("cli.update.downloading");
      const directory = await clients.cache.update(check.latest);
      guard();
      await stopped(selection.gameRoot);
      const result = await clients.ensure({conf,directory,repair:forceInstall===true,allowInstall:false,refresh:true,guard});
      send("cli.update.uptodate_short"); return {ok:true,...result};
    });
  } catch(error) {
    console.error(errorMessage(error)); send("cli.update.check_failed");
    try {win().log(errorMessage(error));}catch(_){}
    return {ok:false,region,error:error.message,...(error.code?{code:error.code}:{}),...(error.code==="NOT_INSTALLED"?{requiresInstall:true,status:error.status}:{})};
  } finally {update.northstar.updating=false;}
};
update.northstar.updating=false;
ipcMain.on("update-northstar",(_event,force)=>{void update.northstar(force);});
// Validated offline clients and transaction backups survive cache cleanup.
ipcMain.on("delete-install-cache",()=>{
  if (gate.busy) return;
  const directory=path.join(app.getPath("userData"),"Temp");
  try {const stat=fs.lstatSync(directory);if(stat.isDirectory()&&!stat.isSymbolicLink())fs.rmSync(directory,{recursive:true});}catch(error){if(error.code!=="ENOENT")console.warn(error.message);}
});
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
