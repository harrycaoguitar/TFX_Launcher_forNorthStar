"use strict";

const path = require("path");
const fs = require("fs");
const {ipcMain,dialog} = require("electron");
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
    const ctx = context(conf), runtime = await inspectRuntime(conf,ctx), component = await engine().inspect(ctx.profile);
    const outdated=runtime.runtimeState === "outdated";
    const runtimeReady = runtime.runtimeState === "global";
    const installed = component.verified === true && runtimeReady;
    const damaged = runtimeReady && (component.state === "damaged" || component.state === "conflict") || ["damaged","outdated"].includes(runtime.runtimeState);
    return {ok:true,installed,verified:installed,version:component.version,runtimeVersion:runtime.version,runtimeState:runtime.runtimeState,
      state:installed?"installed":damaged?"damaged":"missing",componentState:component.state,
      runtimeInstalled:Boolean(runtimeReady),outdated:Boolean(outdated),...(!runtimeReady?{error:runtime.error,code:runtime.code}:component.error?{error:component.error,code:component.code}:{})};
  } catch (error) {return {ok:false,installed:false,verified:false,version:require("./vanilla-plus").VERSION,state:"missing",error:error.message,code:error.code||"VANILLA_CLIENT_STATUS"};}
}
async function inspectRuntime(conf,ctx) {
  const runtime = await clients.status("global",conf,ctx.root);
  if (!runtime.ok) throw Object.assign(Error(runtime.error),{code:"VANILLA_CLIENT_STATUS"});
  // Root-level CN loaders also identify partial or mixed installations. A
  // cached client or a global client in another game folder is not sufficient.
  const cn = runtime.installedRegion === "cn" || fs.existsSync(path.join(ctx.root,"Northstar.dll")) || fs.existsSync(path.join(ctx.root,"launcher.dll"));
  const version = runtime.selectedVersion || runtime.installedVersion;
  let runtimeState,code,error;
  if (cn) {runtimeState="cn";code="VANILLA_RUNTIME_CN";error="游戏根目录安装的是国服北极星，原版带 Mod 需要国际服框架。确认替换后会保留用户模组。";}
  else if (!runtime.installed || !runtime.active) {runtimeState="missing";code="VANILLA_RUNTIME_MISSING";error="游戏根目录未安装国际服北极星框架，无法带 Mod 启动原版。请先安装国际服框架。";}
  else if (runtime.installState === "damaged" || runtime.pending) {runtimeState="damaged";code="VANILLA_RUNTIME_DAMAGED";error="游戏根目录的国际服北极星框架不完整，请先修复框架。";}
  else if (!version || require("./releases").compareVersions(version,MIN_RUNTIME_VERSION)<0) {runtimeState="outdated";code="VANILLA_RUNTIME_OUTDATED";error=`官服 Mod 模式需要国际服 Northstar ${MIN_RUNTIME_VERSION} 或更新版本，请更新游戏根目录的国际服框架。`;}
  else runtimeState="global";
  return {runtimeState,version,code,error};
}
async function ensure({conf = settings(),allowInstall = false,repair = false,replaceCn = false,guard} = {}) {
  conf = Object.freeze({...conf});
  await guard?.(); const ctx = context(conf);
  const before = await inspectRuntime(conf,ctx);
  if (before.runtimeState !== "global" && (!allowInstall || before.runtimeState === "cn" && !replaceCn)) throw Object.assign(Error(before.error),{code:before.code});
  let component = await engine().inspect(ctx.profile);
  if (!component.verified && !allowInstall) throw Object.assign(Error("官服 Mod 组件尚未安装或需要修复，请先在开始游戏页面安装 VanillaPlus。"),{code:"VANILLA_CLIENT_NOT_INSTALLED"});
  send({phase:"preparing",percent:0});
  if (!component.verified) {
    component = await engine().install(ctx.profile,{guard,onProgress:value=>send({...value,phase:"installing",percent:Math.round(Math.max(0,Math.min(100,value.percent||0))*.4)})});
  }
  const componentChanged=component.changed===true;
  await guard?.(); component = await engine().inspect(ctx.profile);
  if (!component.verified) throw Object.assign(Error("VanillaPlus 安装校验失败，请重新安装官服 Mod 组件。"),{code:"VANILLA_CLIENT_NOT_INSTALLED"});
  send({phase:"preparing",percent:40});
  const runtime = await clients.ensure({conf:{...conf,northstarRegion:"global"},gameRoot:ctx.root,allowInstall,repair:repair || before.runtimeState === "cn",refresh:allowInstall,guard,onProgress:value=>send({phase:"preparing",percent:40+Math.round(Math.max(0,Math.min(100,value.percent||0))*.55)})});
  if (require("./releases").compareVersions(runtime.version,MIN_RUNTIME_VERSION)<0) throw Object.assign(Error("游戏根目录的国际服北极星框架版本过旧，请先更新框架。"),{code:"VANILLA_RUNTIME_OUTDATED"});
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
      const runtimeState = await inspectRuntime(conf,selected);
      const replaceCn = runtimeState.runtimeState === "cn";
      if (replaceCn) {
        const lang=require("../lang");
        const answer=await dialog.showMessageBox(require("../win")(),{
          type:"question",title:lang("official_runtime.replaceTitle"),message:lang("official_runtime.replaceMessage"),
          detail:selected.root+"\n\n"+lang("official_runtime.replaceDetail"),buttons:[lang("official_runtime.replaceConfirm"),lang("official_runtime.cancel")],defaultId:1,cancelId:1,noLink:true
        });
        if (answer.response!==0) return {ok:false,canceled:true};
        await guard();
      }
      const value = await ensure({conf,allowInstall:true,replaceCn,repair:options.repair===true||runtimeState.runtimeState==="damaged",guard});
      ipcMain.emit("gui-getmods"); ipcMain.emit("get-version");
      return {ok:true,...value};
    });
  } catch (error) {send({phase:"failed",percent:0,message:error.message});result={ok:false,error:error.message,code:error.code||"VANILLA_CLIENT_INSTALL"};}
  result.status = await status(conf); return result;
}
ipcMain.handle("vanilla-client-status",()=>status());
ipcMain.handle("vanilla-client-install",(_event,options={})=>install(options));
module.exports = {context,status,ensure,install};
