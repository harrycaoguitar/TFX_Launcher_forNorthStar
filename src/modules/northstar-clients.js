"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const {app,ipcMain} = require("electron");
const settings = require("./settings"), network = require("./northstar-region");
const {splitArguments} = require("./launch-session");
const {createClientSwitcher,validateManifest,validateBundle} = require("./northstar-client");
const {ClientBundleCache} = require("./northstar-client-cache");
const win = require("../win");
const gate = require("./dds-operation-gate");
const external = value => value.replace(/app\.asar([\\/])/,"app.asar.unpacked$1");
const dataRoot = fs.existsSync("D:/") ? "D:/TFX-Launcher-Data/northstar-clients" : path.join(app.getPath("userData"),"northstar-clients");
function send(channel,payload) {try {win().send(channel,payload);} catch (_) {}}
let activeRegion = null, singleton;
const cache = new ClientBundleCache({sourceRoot:external(path.join(__dirname,"../tools/clients")),toolsDir:external(path.join(__dirname,"../tools/vtf")),cacheRoot:path.join(dataRoot,"bundles"),validateURL:(...args)=>require("./releases").isClientAssetURL(...args),progress:payload=>send("ns-update-event",{key:"cli.update.downloading",progress:payload.percent,btn_text:payload.percent+"%"})});
function engine() {
  if (!singleton) singleton = createClientSwitcher({bundleRoot:cache.sourceRoot,stateRoot:path.join(dataRoot,"transactions"),bundleProvider:channel=>cache.descriptor(channel),processCheck:()=>require("./is_running").snapshot(),progress:payload=>send("northstar-client-progress",{...payload,region:payload.channel||activeRegion,phase:payload.phase==="recovering"?"checking":payload.phase})});
  return singleton;
}
function context(conf = settings(), selectedRegion = network.normalize(conf.northstarRegion), explicitRoot) {
  const gameRoot = explicitRoot || require("./game-roots").resolveGameRoot(conf, {gameVersion: "northstar", region: selectedRegion});
  const profilePath = network.resolveProfile(gameRoot,splitArguments(conf.nsargs||""));
  if(path.resolve(profilePath).toLowerCase()===path.resolve(gameRoot).toLowerCase())throw Error("北极星配置目录必须位于游戏目录内");
  return {gameRoot,profile:path.relative(gameRoot,profilePath).split(path.sep).join("/")};
}
async function metadata(filename) {
  const stat=await fs.promises.lstat(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8*1024*1024)throw Error("北极星客户端清单体积无效");
  return JSON.parse(await fs.promises.readFile(filename,"utf8"));
}
async function trustedProxyFingerprints(gameRoot, fingerprint) {
  const conf=settings(), selectedRegion=network.normalize(conf.northstarRegion), selection=context(conf,selectedRegion,gameRoot), ctx=await engine().context(selection.gameRoot,selection.profile), result=[];
  const proxy="bin/x64_retail/wsock32.dll";
  const matches=manifest=>manifest.files.some(file=>file.path.toLowerCase()===proxy&&(!fingerprint||file.size===fingerprint.size&&file.sha256===fingerprint.sha256));
  const add=async(directory,channel,expectedDigest)=>{
    const bundle=await validateBundle(directory,channel);
    if(expectedDigest&&bundle.digest!==expectedDigest)throw Error("北极星更新缓存清单与索引不一致");
    const file=bundle.files.get(proxy);result.push({size:file.size,sha256:file.sha256});
  };
  for(const channel of ["cn","global"]){
    // This path is a previously recognized installation, never the current
    // game DLL. Validate every payload before allowing its proxy to move.
    const snapshot=path.join(ctx.state,"channel-cache",channel), snapshotManifest=path.join(snapshot,"manifest.json");
    require("./mod-enabled-state").checked(snapshotManifest);
    if(fs.existsSync(snapshotManifest)){
      const manifest=validateManifest(await metadata(snapshotManifest),channel), provenance=manifest.provenance;
      if(matches(manifest)){
        if(provenance?.kind!=="private-installed-snapshot"||typeof provenance.gameRoot!=="string"||path.resolve(provenance.gameRoot).toLowerCase()!==ctx.root.toLowerCase()||typeof provenance.profile!=="string"||provenance.profile.toLowerCase()!==ctx.profile.toLowerCase())throw Error("北极星本地客户端快照来源无效");
        await add(snapshot,channel,crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex"));if(fingerprint)return result;
      }
    }
    const pointer=path.join(cache.cacheRoot,"updates",channel+".json");await cache.safeCachePath(pointer);
    if(!fs.existsSync(pointer))continue;
    const ref=await metadata(pointer);
    if(ref.channel!==channel||!/^[a-f0-9]{64}$/.test(ref.directory))throw Error("北极星更新缓存索引无效");
    const directory=path.join(cache.cacheRoot,"updates",ref.directory);await cache.safeCachePath(path.join(directory,"manifest.json"));
    const manifest=validateManifest(await metadata(path.join(directory,"manifest.json")),channel);
    if(crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex")!==ref.directory)throw Error("北极星更新缓存清单与索引不一致");
    if(!matches(manifest))continue;
    const source=manifest.source,repository=channel==="global"?"R2Northstar/Northstar":"R2NorthstarCN/R2NorthstarCN_Launcher";
    const validURL=source&&[manifest.version,manifest.version.startsWith("v")?manifest.version.slice(1):"v"+manifest.version].some(tag=>require("./releases").isClientAssetURL(source.url,tag,undefined,channel));
    if(source?.repository!==repository||!/^[a-f0-9]{64}$/.test(source.archiveSha256)||!validURL)throw Error("北极星更新缓存来源无效");
    await add(directory,channel,ref.directory);if(fingerprint)return result;
  }
  return result;
}
async function targetVersion(region,info,conf,explicitRoot) {
  let manifest=validateManifest(await metadata(path.join(cache.sourceRoot,region,"manifest.json")),region);
  const pointer=path.join(cache.cacheRoot,"updates",region+".json");
  await cache.safeCachePath(pointer);
  if(fs.existsSync(pointer)){
    const ref=await metadata(pointer);
    if(ref.channel!==region||!/^[a-f0-9]{64}$/.test(ref.directory))throw Error("北极星更新缓存索引无效");
    const candidatePath=path.join(cache.cacheRoot,"updates",ref.directory,"manifest.json");
    await cache.safeCachePath(candidatePath);
    const candidate=validateManifest(await metadata(candidatePath),region);
    if(crypto.createHash("sha256").update(JSON.stringify(candidate)).digest("hex")!==ref.directory)throw Error("北极星更新缓存索引无效");
    manifest=candidate;
  }
  let version=manifest.version;
  const snapshot=info?.backupRoot&&path.join(info.backupRoot,"channel-cache",region,"manifest.json");
  if(snapshot&&fs.existsSync(snapshot)){
    const local=validateManifest(await metadata(snapshot),region), ctx=context(conf,region,explicitRoot);
    if(local.provenance?.kind!=="private-installed-snapshot"||path.resolve(local.provenance.gameRoot).toLowerCase()!==path.resolve(ctx.gameRoot).toLowerCase()||local.provenance.profile.toLowerCase()!==ctx.profile.toLowerCase())throw Error("北极星本地客户端快照来源无效");
    if(require("./releases").compareVersions(local.version,version)>0)version=local.version;
  }
  if(region==="cn"&&info?.installed?.channel==="cn"&&info.installed.recognized&&require("./releases").compareVersions(info.installed.version,version)>0)version=info.installed.version;
  return version;
}
async function status(region, configuration, explicitRoot) {
  const conf={...(configuration||settings())};
  region = network.normalize(region || conf.northstarRegion);
  try {
    const info = await engine().inspect({...context(conf,region,explicitRoot),includeAvailable:false}), version=await targetVersion(region,info,conf,explicitRoot);
    const selected=info.available?.[region]||info.channels?.[region];
    const active=selected?.active ?? (info.installed?.channel===region);
    const installed=selected?.installed ?? active;
    const error=selected?.error||info.availableError;
    const damaged=selected?.damaged===true || selected?.installState==="damaged" || Boolean(error) || Boolean(active&&!info.ready&&!info.pending?.length);
    return {ok:true,region,version,installed:Boolean(installed),active:Boolean(active),installState:damaged?"damaged":installed?"installed":"not-installed",state:damaged?"needs-repair":installed?(active?"active":"standby"):"missing",selectedVersion:selected?.version|| (active?info.installed?.version:null),installedRegion:info.installed?.channel||null,installedVersion:info.installed?.version||"unknown",ready:Boolean(info.ready&&active&&!damaged),pending:info.pending?.length>0,...(error?{error}:{})};
  } catch(error) {
    // Display the bundled target even before the game directory is selected;
    // status never downloads, changes game files or captures an installed client.
    let version="unknown";try {version=JSON.parse(await fs.promises.readFile(path.join(cache.sourceRoot,region,"manifest.json"),"utf8")).version;}catch(_){}
    return {ok:false,region,version,installed:false,active:false,installState:"not-installed",state:"missing",selectedVersion:null,installedRegion:null,installedVersion:"unknown",ready:false,pending:false,error:error.message};
  }
}
async function ensure({conf=settings(),gameRoot,directory,repair=false,allowInstall=false,refresh=false,guard,onProgress}={}) {
  conf=Object.freeze({...conf});
  let selectionGuard=guard;
  const guardSelection=async()=>{
    if(!selectionGuard)return;
    try {await selectionGuard();}
    catch(error) {
      // Stop the write once, then let rollback check only the actual game
      // processes. A changed UI selection must never block safe restoration.
      selectionGuard=null;throw error;
    }
  };
  const region=network.normalize(conf.northstarRegion);
  const progress = payload => {
    const value={...payload,region:payload.channel||region,phase:payload.phase==="recovering"?"checking":payload.phase};
    send("northstar-client-progress",value);
    try {onProgress?.(value);} catch (_) { /* A display callback must not abort a file transaction. */ }
  };
  activeRegion=region;
  try {
    progress({region,phase:"checking",percent:0});
    await guardSelection();
    const args={...context(conf,region,gameRoot),channel:region,repair:repair===true,allowInstall:allowInstall===true,refresh:refresh===true,refreshClient:Boolean(directory)};
    const switcher=directory||guard||onProgress?createClientSwitcher({bundleRoot:cache.sourceRoot,stateRoot:path.join(dataRoot,"transactions"),bundleProvider:async channel=>directory&&channel===region?{directory,preferSnapshot:false}:cache.descriptor(channel),processCheck:async()=>{await guardSelection();const snapshot=await require("./is_running").snapshot();await guardSelection();return snapshot;},progress}):engine();
    const result=await switcher.ensure(args);await switcher.assertReady(args);
    ipcMain.emit("get-version");ipcMain.emit("gui-getmods");return result;
  } catch(error) {
    send("northstar-client-progress",{region,phase:"failed",percent:0,message:error.message});throw error;
  } finally {activeRegion=null;}
}
async function assertReady(conf=settings()) {return engine().assertReady(context(conf));}
async function recover(conf=settings()) {return engine().recover(context(conf));}
async function stopped(gameRoot) {
  const snapshot=await require("./is_running").snapshot();
  if(!snapshot?.ok)throw Error("无法确认游戏进程，已停止北极星文件切换");
  if(require("./game-roots").hasGame(snapshot,gameRoot))throw Error("请先退出所选游戏目录中的 Titanfall 2 及北极星进程，再安装客户端");
}
function requestOptions(options) {
  return options===undefined ? {} : options&&typeof options==="object"&&!Array.isArray(options) ? options : null;
}
function invalidRequest() {
  return {ok:false,error:"北极星客户端请求参数无效",code:"INVALID_REQUEST"};
}
function selectedUnchanged(conf) {
  const current=settings();
  if(network.normalize(current.northstarRegion)!==conf.northstarRegion||current.gamepath!==conf.gamepath||current.globalGamepath!==conf.globalGamepath||current.nsargs!==conf.nsargs)throw Error("客户端选择或游戏目录已改变，请重新安装所选客户端。");
}
async function install(options={}) {
  options=requestOptions(options);
  if(!options)return invalidRequest();
  const original={...settings()}, region=options.region===undefined?network.normalize(original.northstarRegion):options.region;
  if(!["cn","global"].includes(region))return {ok:false,region,error:"请选择国服或全球服北极星客户端",code:"INVALID_REGION"};
  const conf=Object.freeze({...original,northstarRegion:region});
  let result;
  try {
    result=await gate.run("client-install",async()=>{
      selectedUnchanged(conf);const selection=context(conf,region);await stopped(selection.gameRoot);
      // Explicit install is offline-capable. A validated newer cached release
      // may be used; a distribution cache alone is never an installed client.
      const value=await ensure({conf,allowInstall:true,refresh:true,repair:options.repair===true,guard:()=>selectedUnchanged(conf)});
      return {ok:true,region,...value};
    });
  } catch(error) {
    send("northstar-client-progress",{region,phase:"failed",percent:0,message:error.message});
    result={ok:false,region,error:error.message,code:error.code||"INSTALL_FAILED"};
  }
  // Refresh from the captured game/profile rather than a different selection
  // made while the operation was completing. No installation ever spawns.
  if(result.ok) result.status=await status(region,conf);
  return result;
}
ipcMain.handle("northstar-client-status",(_event,options={})=>{
  options=requestOptions(options);
  return options ? status(options.region) : invalidRequest();
});
ipcMain.handle("northstar-client-install",(_event,options={})=>install(options));
module.exports={status,ensure,assertReady,recover,install,cache,context,trustedProxyFingerprints};
