"use strict";
const os = require("node:os");
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),vm=require("vm"),crypto=require("crypto");
const {EventEmitter}=require("events");
const source=path.resolve(__dirname,".."), core=require("../src/modules/northstar-client"), network=require("../src/modules/northstar-region"), session=require("../src/modules/launch-session");
const root=fs.mkdtempSync(path.join(os.tmpdir(), "tfx-northstar-install-"));

function loaded(filename,stubs) {
  const file=path.join(source,"src/modules",filename), module={exports:{}};
  const req=id=>Object.hasOwn(stubs,id)?stubs[id]:id==="./game-roots"?loaded("game-roots.js",{"./findgame":stubs["./findgame"]||{validateGamePath:value=>value}}):require(id);
  vm.runInNewContext("(function(require,module,exports,__dirname,__filename){"+fs.readFileSync(file,"utf8")+"\n})",{Buffer,process,console,setTimeout,clearTimeout,Date,Object,URL},{filename:file})(req,module,module.exports,path.dirname(file),file);
  return module.exports;
}
function fixture(options={}) {
  const directory=fs.mkdtempSync(path.join(root,"fixture-")),game=path.join(directory,"game");fs.mkdirSync(path.join(game,"R2Northstar"),{recursive:true});fs.writeFileSync(path.join(game,"Titanfall2.exe"),"fixture");
  const conf={northstarRegion:options.region||"cn",gamepath:game,globalGamepath:game,nsargs:"-northstar",uiLanguage:"zh-CN"},calls=[],messages=[],events=[],handlers=new Map();
  let info={ready:true,installed:null,pending:[],available:{cn:{installed:false,active:false},global:{installed:false,active:false}}},failure=options.failure||null, owner=null, paused=null, running=options.running||false, unreadable=false,snapshotHook=null;
  class Cache {constructor(value){Object.assign(this,value);this.cacheRoot=path.join(directory,"cache");}async descriptor(channel){calls.push({method:"descriptor",channel});return {directory:"bundle-"+channel,expectedDigest:"a".repeat(64)};}async safeCachePath(value){return value;}}
  const client={...core,createClientSwitcher(engineOptions){return {async inspect(input){calls.push({method:"inspect",input});return info;},async ensure(input){calls.push({method:"ensure",input});await engineOptions.processCheck();if(paused)await paused;if(failure)throw failure;if(input.allowInstall!==true&&!info.available[input.channel].installed){const e=Error("所选北极星客户端尚未安装，请先点击安装客户端。");e.code="NOT_INSTALLED";throw e;}await engineOptions.processCheck();const version=input.channel==="cn"?"1.18.0":"1.31.13";info={ready:true,pending:[],installed:{channel:input.channel,version,recognized:true},available:{...info.available,[input.channel]:{installed:true,active:true,version},[input.channel==="cn"?"global":"cn"]:{...info.available[input.channel==="cn"?"global":"cn"],active:false}}};return {channel:input.channel,version};},async assertReady(input){calls.push({method:"assertReady",input});return info;},async recover(){return {recovered:false};}};}};
  const gate={get busy(){return Boolean(owner);},async run(label,action){if(owner)throw Error("游戏启动或 DDS 操作正在进行，请稍后重试");owner=label;calls.push({method:"gate",label});try{return await action();}finally{owner=null;}}};
  const api=loaded("northstar-clients.js",{"electron":{app:{getPath:()=>directory},ipcMain:{handle:(name,handler)=>handlers.set(name,handler),emit:name=>events.push(name)}},"./settings":()=>conf,"./northstar-region":network,"./launch-session":session,"./northstar-client":client,"./northstar-client-cache":{ClientBundleCache:Cache},"./dds-operation-gate":gate,"../win":()=>({send:(channel,payload)=>messages.push({channel,payload})}),"./findgame":{validateGamePath:()=>conf.gamepath===game?game:null},"./is_running":{snapshot:async()=>{await snapshotHook?.();return {ok:!unreadable,processes:running?[{image:"titanfall2.exe",pid:42}]:[]};}},"./releases":{compareVersions:core.compareVersion,isClientAssetURL:()=>true}});
  return {api,conf,calls,messages,events,handlers,gate,setInfo:value=>info=value,setFailure:value=>failure=value,setRunning:value=>running=value,setUnreadable:value=>unreadable=value,setPaused:value=>paused=value,setBusy:value=>owner=value,setSnapshotHook:value=>snapshotHook=value};
}
test("both regions remain missing with only bundled distributions",async()=>{const f=fixture();for(const region of ["cn","global"]){const status=await f.api.status(region);assert.equal(status.ok,true);assert.equal(status.installed,false);assert.equal(status.active,false);assert.equal(status.state,"missing");assert.equal(status.installState,"not-installed");}assert(f.calls.every(call=>call.method==="inspect"&&call.input.includeAvailable===false));assert.equal(f.messages.length,0);});
test("recognized CN is installed independently of absent global",async()=>{const f=fixture();f.setInfo({ready:true,pending:[],installed:{channel:"cn",version:"1.18.0",recognized:true},available:{cn:{installed:true,active:true,version:"1.18.0"},global:{installed:false,active:false}}});const cn=await f.api.status("cn"),global=await f.api.status("global");assert.equal(cn.installed,true);assert.equal(cn.active,true);assert.equal(cn.version,"1.18.0");assert.equal(global.installed,false);assert.equal(global.ready,false);});

test("CN default download uses the GitHub 1.17.7 asset and its recorded digest without a latest request",async()=>{
  const f=fixture(),release=await f.api.cache.releaseProvider("cn");
  assert.equal(release.version,"v1.17.7");assert.equal(release.source,"GitHub");
  assert.equal(release.download_link,"https://github.com/R2NorthstarCN/R2NorthstarCN_Launcher/releases/download/v1.17.7/v1.17.7.zip");
  assert.equal(release.digest,"a42e9d364509d30ecf5e951c373f9547a28a9985a79d6f698751764216a946d2");
});

test("a newer shared CN download does not change the missing channel target or an installed 1.18 client",async()=>{
  const f=fixture(),manifest=JSON.parse(fs.readFileSync(path.join(f.api.cache.sourceRoot,"cn/manifest.json"),"utf8"));
  manifest.version="1.18.0";const digest=crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  const directory=path.join(f.api.cache.cacheRoot,"updates",digest);fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,"manifest.json"),JSON.stringify(manifest));
  fs.writeFileSync(path.join(f.api.cache.cacheRoot,"updates/cn.json"),JSON.stringify({channel:"cn",directory:digest}));
  assert.equal((await f.api.status("cn")).version,"1.17.7");
  f.setInfo({ready:true,pending:[],installed:{channel:"cn",version:"1.18.0",recognized:true},available:{cn:{installed:true,active:true,version:"1.18.0"},global:{installed:false,active:false}}});
  const status=await f.api.status("cn");assert.equal(status.version,"1.18.0");assert.equal(status.selectedVersion,"1.18.0");assert.equal(status.ready,true);
});
test("standby installed channel and damaged active channel have distinct states",async()=>{const f=fixture();f.setInfo({ready:true,pending:[],installed:{channel:"cn",version:"1.18.0"},available:{cn:{installed:true,active:true,damaged:true,error:"core missing"},global:{installed:true,active:false,version:"1.31.13"}}});assert.equal((await f.api.status("cn")).state,"needs-repair");assert.equal((await f.api.status("cn")).ready,false);assert.equal((await f.api.status("global")).state,"standby");});
test("ordinary ensure never authorizes first installation",async()=>{const f=fixture();await assert.rejects(f.api.ensure(),/尚未安装/);assert.equal(f.calls.find(call=>call.method==="ensure").input.allowInstall,false);assert.equal(f.messages.at(-1).payload.phase,"failed");});
test("explicit install IPC installs each family without launching",async()=>{for(const region of ["cn","global"]){const f=fixture({region}),handler=f.handlers.get("northstar-client-install");assert.equal(typeof handler,"function");const result=await handler(null,{region});assert.equal(result.ok,true);assert.equal(result.region,region);assert.equal(result.status.installed,true);assert.equal(result.status.active,true);assert.equal(f.calls.find(call=>call.method==="ensure").input.allowInstall,true);assert.equal(f.calls.find(call=>call.method==="gate").label,"client-install");assert(f.events.includes("get-version"));assert(!f.events.some(value=>value.includes("launch")));assert.equal(f.gate.busy,false);}});
test("install failure releases operation and retry works",async()=>{const f=fixture({failure:Error("disk write failed")});const failed=await f.api.install({region:"cn"});assert.equal(failed.ok,false);assert.match(failed.error,/disk write/);assert.equal((await f.api.status("cn")).installed,false);assert.equal(f.gate.busy,false);f.setFailure(null);assert.equal((await f.api.install({region:"cn"})).ok,true);});
test("strict explicit repair only",async()=>{for(const repair of [true,"true",undefined]){const f=fixture();const result=await f.api.install({region:"cn",repair});assert.equal(result.ok,true);assert.equal(f.calls.find(call=>call.method==="ensure").input.repair,repair===true);}});
test("invalid region refuses before engine operation",async()=>{const f=fixture();const result=await f.api.install({region:"other"});assert.equal(result.ok,false);assert.equal(result.code,"INVALID_REGION");assert.equal(f.calls.length,0);});
test("running, unknown process, and DDS busy block before install",async()=>{for(const kind of ["running","unknown","busy"]){const f=fixture();if(kind==="running")f.setRunning(true);if(kind==="unknown")f.setUnreadable(true);if(kind==="busy")f.setBusy("dds");const result=await f.api.install({region:"cn"});assert.equal(result.ok,false);assert(!f.calls.some(call=>call.method==="ensure"));}});
test("captured settings stay immutable while late selection blocks install",async()=>{const f=fixture();let resume;f.setPaused(new Promise(resolve=>resume=resolve));const pending=f.api.install({region:"cn"});while(!f.calls.some(call=>call.method==="ensure"))await new Promise(resolve=>setTimeout(resolve,1));f.conf.northstarRegion="global";resume();const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/选择或游戏目录已改变/);assert.equal(result.region,"cn");assert.equal((await f.api.status("cn")).region,"cn");assert.equal(f.calls.find(call=>call.method==="ensure").input.channel,"cn");assert.equal(f.gate.busy,false);});
test("selected region mismatch blocks before any install",async()=>{const f=fixture({region:"cn"});const result=await f.api.install({region:"global"});assert.equal(result.ok,false);assert.match(result.error,/选择或游戏目录已改变/);assert(!f.calls.some(call=>call.method==="ensure"));});
function updater(installed=false,options={}) {
  const emitter=new EventEmitter(),conf={northstarRegion:"global",gamepath:"D:/Fixture/Game",nsargs:"",uiLanguage:"zh-CN",nsupdate:true},calls=[],timers=[];
  emitter.handle=()=>{};
  const clients={context:()=>({}),status:async(region,configuration)=>{calls.push({method:"status",region,conf:configuration});return {ok:true,region,version:options.local||"1.31.13",selectedVersion:options.selected||options.local||"1.31.13",installed};},cache:{update:async()=>{calls.push({method:"download"});return "D:/Fixture/cache";}},ensure:async input=>{calls.push({method:"ensure",input});return {channel:"global",version:"1.31.13"};}};
  const api=loaded("update.js",{electron:{ipcMain:emitter,app:{on(){},getPath:()=>"D:/Fixture"}},"./settings":()=>conf,"./releases":{compareVersions:core.compareVersion,latest:{northstar:async()=>{calls.push({method:"release"});return {region:"global",version:"1.31.13"};}}},"./northstar-clients":clients,"./dds-operation-gate":{busy:false,run:async(name,action)=>action()},"./is_running":{snapshot:async()=>({ok:true,processes:[]})},"./launch-session":session,"./northstar-region":network,"../win":()=>({send(){},log(){}}),"./console":{error(){},warn(){}}});
  return {api,calls,emitter};
}
test("explicit update missing channel requires separate installation",async()=>{const f=updater(false);const result=await f.api.northstar(true);assert.equal(result.ok,false);assert.equal(result.requiresInstall,true);assert.equal(result.code,"NOT_INSTALLED");assert(!f.calls.some(call=>["ensure","download","release"].includes(call.method)));assert.equal(f.api.northstar.updating,false);});
test("automatic update does not download or install missing channel",async()=>{const f=updater(false);f.api.northstar_autoupdate();await new Promise(resolve=>setTimeout(resolve,10));assert(!f.calls.some(call=>["ensure","download","release"].includes(call.method)));f.emitter.emit("before-quit");});
test("installed family still updates with first installation disabled",async()=>{const f=updater(true,{local:"1.31.12"}),result=await f.api.northstar();assert.equal(result.ok,true);assert(f.calls.some(call=>call.method==="download"));assert.equal(f.calls.find(call=>call.method==="ensure").input.allowInstall,false);});
test("updates compare actual installed version rather than bundled target",async()=>{const f=updater(true,{local:"1.31.13",selected:"1.31.12"}),result=await f.api.northstar();assert.equal(result.ok,true);assert(f.calls.some(call=>call.method==="download"));assert.equal(f.calls.find(call=>call.method==="ensure").input.refresh,true);});

test("selection changed during awaited process query blocks install before commit",async()=>{const f=fixture();let count=0;f.setSnapshotHook(async()=>{if(++count===2)f.conf.northstarRegion="global";});const result=await f.api.install({region:"cn"});assert.equal(result.ok,false);assert.match(result.error,/选择或游戏目录已改变/);assert.equal((await f.api.status("cn")).installed,false);assert.equal(f.gate.busy,false);});
test("asynchronous client guard is awaited before process query",async()=>{const f=fixture();await assert.rejects(f.api.ensure({guard:async()=>{await Promise.resolve();throw Error("async selection changed");}}),/async selection changed/);assert.equal(f.calls.some(call=>call.method==="ensure"),false);});

test.after(() => {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith("tfx-northstar-install-"));
  const stat = fs.lstatSync(root); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(root, {recursive: true, force: true});
});
