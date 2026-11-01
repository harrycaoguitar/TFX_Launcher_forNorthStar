"use strict";

const path = require("path");
const {ipcMain} = require("electron");
const settings = require("./settings"), clients = require("./northstar-clients");
const network = require("./northstar-region"), {splitArguments} = require("./launch-session");
const gate = require("./dds-operation-gate");
const external = value => value.replace(/app\.asar([\\/])/,"app.asar.unpacked$1");
const bundleRoot = external(path.join(__dirname,"../tools/vanilla-plus"));
const MIN_RUNTIME_VERSION = "1.21.0";
let manager;
const engine = () => manager || (manager = require("./vanilla-plus").createManager({bundleRoot}));
function send(payload) {try {require("../win")().send("vanilla-client-progress",payload);} catch (_) {}}
function context(conf) {
  const root = require("./game-roots").resolveGameRoot(conf, {gameVersion: "vanilla"});
  if (!root) throw Object.assign(Error("请先选择有效的 Titanfall 2 游戏目录。"),{code:"GAME_DIRECTORY_INVALID"});
  return {root,profile:network.resolveProfile(root,splitArguments(conf.nsargs||""))};
}
async function status(configuration = settings()) {
  const conf = {...configuration};
  try {
    const ctx = context(conf), component = await engine().inspect(ctx.profile), runtime = await clients.status("cn",conf);
    const runtimeVersion=runtime.selectedVersion || (runtime.active?runtime.installedVersion:null);
    const outdated=runtime.installed && (!runtimeVersion || require("./releases").compareVersions(runtimeVersion,MIN_RUNTIME_VERSION)<0);
    const runtimeReady = runtime.installed && runtime.installState !== "damaged" && !outdated;
    const installed = component.verified === true && runtimeReady;
    const damaged = component.state === "damaged" || component.state === "conflict" || runtime.installState === "damaged" || outdated;
    return {ok:true,installed,verified:installed,version:component.version,runtimeVersion:runtime.selectedVersion||runtime.version,
      state:installed?"installed":damaged?"damaged":"missing",componentState:component.state,
      runtimeInstalled:Boolean(runtimeReady),outdated:Boolean(outdated),...(component.error?{error:component.error,code:component.code}:runtime.error?{error:runtime.error}:{})};
  } catch (error) {return {ok:false,installed:false,verified:false,version:require("./vanilla-plus").VERSION,state:"missing",error:error.message,code:error.code||"VANILLA_CLIENT_STATUS"};}
}
async function ensure({conf = settings(),allowInstall = false,repair = false,guard} = {}) {
  conf = Object.freeze({...conf});
  await guard?.(); const ctx = context(conf);
  let component = await engine().inspect(ctx.profile);
  if (!component.verified) {
    if (!allowInstall) throw Object.assign(Error("官服 Mod 组件尚未安装或需要修复，请先在开始游戏页面安装 VanillaPlus。"),{code:"VANILLA_CLIENT_NOT_INSTALLED"});
    component = await engine().install(ctx.profile,{guard,onProgress:value=>send({...value,phase:"installing",percent:Math.round(Math.max(0,Math.min(100,value.percent||0))*.4)})});
  }
  await guard?.();
  send({phase:"preparing",percent:40});
  const runtime = await clients.ensure({conf:{...conf,northstarRegion:"cn"},allowInstall,repair,refresh:allowInstall,guard,onProgress:value=>send({phase:"preparing",percent:40+Math.round(Math.max(0,Math.min(100,value.percent||0))*.55)})});
  if (require("./releases").compareVersions(runtime.version,MIN_RUNTIME_VERSION) < 0) throw Object.assign(Error(`官服 Mod 模式需要 Northstar ${MIN_RUNTIME_VERSION} 或更新版本，请安装或更新国服加载组件。`),{code:"VANILLA_RUNTIME_OUTDATED"});
  const componentChanged=component.changed===true;
  send({phase:"verifying",percent:96});
  await guard?.(); component = await engine().inspect(ctx.profile);
  if (!component.verified) throw Object.assign(Error("VanillaPlus 安装校验失败，请重新安装官服 Mod 组件。"),{code:"VANILLA_CLIENT_NOT_INSTALLED"});
  send({phase:"done",percent:100});
  return {componentVersion:component.version,version:runtime.version,profile:ctx.profile,changed:runtime.changed||componentChanged};
}
async function stopped(gameRoot) {
  const snapshot = await require("./is_running").snapshot();
  if (!snapshot?.ok) throw Object.assign(Error("无法确认游戏进程，请稍后重试。"),{code:"PROCESS_QUERY_FAILED"});
  if (require("./game-roots").hasGame(snapshot, gameRoot)) throw Object.assign(Error("请先退出所选游戏目录中的 Titanfall 2，再安装官服 Mod 组件。"),{code:"GAME_ALREADY_RUNNING"});
}
function unchanged(conf) {
  const current = settings();
  if (current.gamepath!==conf.gamepath || current.globalGamepath!==conf.globalGamepath || current.nsargs!==conf.nsargs || current.vanillaModsEnabled!==conf.vanillaModsEnabled || current.modProfileServer!==conf.modProfileServer || current.independentServerMods!==conf.independentServerMods) throw Object.assign(Error("启动模式或游戏目录已改变，请重新安装所选组件。"),{code:"SELECTION_CHANGED"});
}
async function install(options = {}) {
  const conf = Object.freeze({...settings()}); let result;
  try {
    result = await gate.run("vanilla-client-install",async()=>{
      unchanged(conf); const selected=context(conf); await stopped(selected.root);
      const guard = async()=>{unchanged(conf);await stopped(selected.root);};
      send({phase:"checking",percent:0});
      const runtimeState = await clients.status("cn",conf);
      const value = await ensure({conf,allowInstall:true,repair:options.repair===true||runtimeState.installState==="damaged",guard});
      ipcMain.emit("gui-getmods"); ipcMain.emit("get-version");
      return {ok:true,...value};
    });
  } catch (error) {send({phase:"failed",percent:0,message:error.message});result={ok:false,error:error.message,code:error.code||"VANILLA_CLIENT_INSTALL"};}
  result.status = await status(conf); return result;
}
ipcMain.handle("vanilla-client-status",()=>status());
ipcMain.handle("vanilla-client-install",(_event,options={})=>install(options));
module.exports = {context,status,ensure,install};
