"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const filename = path.resolve(__dirname,"../src/modules/vanilla-client.js"), source = fs.readFileSync(filename,"utf8");
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const state = {
    conf:{gamepath:"D:/fixture/Titanfall2",nsargs:"",vanillaModsEnabled:true,modProfileServer:"vanilla",independentServerMods:false,northstarRegion:"cn"},
    component:{installed:false,verified:false,state:"missing",version:"2.5.1"},
    runtime:{ok:true,installed:false,active:false,installState:"not-installed",version:"1.31.13",selectedVersion:null},
    valid:true,snapshot:{ok:true,processes:[]},calls:[],profiles:[],progress:[],writes:[],handlers:new Map(),emits:[],beforeGate:null,beforeEngineInstall:null,beforeRuntimeEnsure:null,
    engineProgress:[0,25,80,100],runtimeProgress:[0,20,80,100],snapshotCount:0,beforeSnapshot:null
  };
  const engine = {
    async inspect(profile) {state.calls.push(["inspect",profile]); return {...state.component};},
    async install(profile,options) {
      state.calls.push(["component-install",profile]); await state.beforeEngineInstall?.(); await options.guard?.();
      for (const percent of state.engineProgress) options.onProgress?.({percent,stage:"copy"});
      await options.guard?.(); state.writes.push("component");
      state.component = {installed:true,verified:true,state:"installed",version:"2.5.1"}; return {...state.component,changed:true};
    }
  };
  const clients = {
    async status(region,conf) {state.calls.push(["runtime-status",region,clone(conf)]); return {...state.runtime};},
    async ensure(options) {
      state.calls.push(["runtime-ensure",{...clone(options),guard:typeof options.guard}]);
      await state.beforeRuntimeEnsure?.(); await options.guard?.();
      if (!state.runtime.installed && !options.allowInstall) throw Object.assign(Error("runtime missing"),{code:"NORTHSTAR_CLIENT_NOT_INSTALLED"});
      for (const percent of state.runtimeProgress) options.onProgress?.({percent});
      await options.guard?.();
      const changed = !state.runtime.installed;
      if (changed || options.repair) state.writes.push("runtime");
      state.runtime = {...state.runtime,installed:true,active:true,installState:"installed",selectedVersion:state.runtime.version};
      return {version:state.runtime.version,changed};
    }
  };
  const compareVersions = (a,b) => {const left=String(a).split(".").map(Number),right=String(b).split(".").map(Number);for(let i=0;i<3;i++){const value=(left[i]||0)-(right[i]||0);if(value)return value;}return 0;};
  const stubs = {
    fs,
    path,
    electron:{ipcMain:{handle:(name,fn) => state.handlers.set(name,fn),emit:name => state.emits.push(name)}},
    "./settings":() => ({...state.conf}),
    "./northstar-clients":clients,
    "./northstar-region":{OFFICIAL_PROFILE:"R2Titanfall",resolveProfile:(root,args,forcedProfile) => {state.profiles.push({root,args,forcedProfile});return path.join(root,forcedProfile||"R2Northstar");}},
    "./game-roots":{...require("../src/modules/game-roots"),resolveGameRoot:conf => state.valid ? conf.gamepath : null},
    "./launch-session":{splitArguments:value => value.split(/\s+/).filter(Boolean),hasGame:value => value.processes.some(item => /titanfall2|northstarlauncher/i.test(item.image))},
    "./dds-operation-gate":{run:async (name,fn) => {state.calls.push(["gate",name]); await state.beforeGate?.(); return fn();}},
    "./vanilla-plus":{VERSION:"2.5.1",createManager:options => {state.calls.push(["create-engine",clone(options)]); return engine;}},
    "./findgame":{validateGamePath:value => state.valid ? value : null},
    "./releases":{compareVersions},
    "./is_running":{snapshot:async () => {state.snapshotCount++; await state.beforeSnapshot?.(state.snapshotCount); return clone(state.snapshot);}},
    "../win":() => ({send:(channel,payload) => {assert.equal(channel,"vanilla-client-progress"); state.progress.push(clone(payload));}})
  };
  const module = {exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:name => {if (!(name in stubs)) throw Error("Unexpected require: "+name); return stubs[name];},__dirname:path.dirname(filename)},{filename});
  return {state,api:module.exports};
}
function installed(f,{version="1.31.13"} = {}) {
  f.state.component = {installed:true,verified:true,state:"installed",version:"2.5.1"};
  f.state.runtime = {ok:true,installed:true,active:true,installState:"installed",version,selectedVersion:version,installedVersion:version};
}
test("status is read-only and exposes missing explicit installation without downloading or launching", async () => {
  const f = fixture(), result = await f.api.status();
  assert.equal(result.ok,true); assert.equal(result.installed,false); assert.equal(result.state,"missing"); assert.equal(result.componentState,"missing");
  assert.deepEqual(f.state.writes,[]); assert.equal(f.state.calls.some(call => /install|ensure|gate/.test(call[0])),false);
  assert.equal(f.state.handlers.has("vanilla-client-status"),true); assert.equal(f.state.handlers.has("vanilla-client-install"),true); assert.deepEqual(f.state.emits,[]);
});
test("verified VanillaPlus still needs repair when the installed global runtime predates 1.21", async () => {
  const f = fixture(); installed(f,{version:"1.20.9"});
  const value = await f.api.status(); assert.equal(value.installed,false); assert.equal(value.outdated,true); assert.equal(value.runtimeInstalled,false); assert.equal(value.state,"damaged"); assert.deepEqual(f.state.writes,[]);
  f.state.runtime = {...f.state.runtime,version:"1.31.13",selectedVersion:"1.31.13"};
  assert.equal((await f.api.status()).installed,true);
});
test("missing or damaged VanillaPlus cannot launch and does not implicitly download a runtime", async () => {
  for (const component of [{installed:false,verified:false,state:"missing",version:"2.5.1"},{installed:true,verified:false,state:"damaged",version:"2.5.1"}]) {
    const f = fixture(); installed(f); f.state.component = component;
    await assert.rejects(f.api.ensure(),{code:"VANILLA_CLIENT_NOT_INSTALLED"});
    assert.deepEqual(f.state.writes,[]); assert.equal(f.state.calls.some(call => call[0] === "runtime-ensure"),false);
  }
});
test("a missing global runtime cannot launch despite a verified compatibility package", async () => {
  const f = fixture(); f.state.component = {installed:true,verified:true,state:"installed",version:"2.5.1"};
  await assert.rejects(f.api.ensure(),{code:"VANILLA_RUNTIME_MISSING"}); assert.deepEqual(f.state.writes,[]);
  assert.equal(f.state.calls.some(call => call[0] === "runtime-ensure"),false);
});
test("explicit install refreshes runtime metadata and installs the global compatibility runtime", async () => {
  const f = fixture(), result = await f.api.install();
  assert.equal(result.ok,true); assert.equal(result.status.installed,true); assert.equal(result.version,"1.31.13"); assert.equal(result.componentVersion,"2.5.1");
  assert.deepEqual(f.state.writes,["component","runtime"]);
  const request = f.state.calls.find(call => call[0] === "runtime-ensure")[1];
  assert.equal(request.allowInstall,true); assert.equal(request.refresh,true); assert.equal(request.conf.northstarRegion,"global");
  assert.equal(f.state.conf.northstarRegion,"cn"); assert.deepEqual(f.state.emits,["gui-getmods","get-version"]);
});
test("VanillaPlus uses R2Titanfall for its Global Northstar framework",async()=>{
  const f=fixture();installed(f);const result=await f.api.ensure();
  assert.equal(result.profile,path.join(f.state.conf.gamepath,"R2Titanfall"));
  assert.equal(f.state.profiles.at(-1).forcedProfile,"R2Titanfall");
  const runtime=f.state.calls.filter(call=>["runtime-status","runtime-ensure"].includes(call[0]));
  assert.equal(runtime[0][1],"global");assert.equal(runtime[0][2].nsargs,"-profile=R2Titanfall");
  assert.equal(runtime[1][1].conf.northstarRegion,"global");assert.equal(runtime[1][1].conf.nsargs,"-profile=R2Titanfall");
});
test("runtime repair is explicit and also selected automatically for a damaged global client", async () => {
  for (const explicit of [false,true]) {
    const f = fixture(); installed(f); if (!explicit) Object.assign(f.state.runtime,{installState:"damaged",active:false});
    const result = await f.api.install({repair:explicit}); assert.equal(result.ok,true);
    assert.equal(f.state.calls.find(call => call[0] === "runtime-ensure")[1].repair,true); assert.deepEqual(f.state.writes,["runtime"]);
  }
});
test("capture changes before acquiring the write gate reject installation without writes", async () => {
  for (const [key,value] of [["gamepath","D:/Other/Titanfall2"],["nsargs","-profile=Other"],["vanillaModsEnabled",false],["modProfileServer","global"],["independentServerMods",true]]) {
    const f = fixture(); f.state.beforeGate = () => {f.state.conf[key]=value;};
    const result = await f.api.install(); assert.equal(result.ok,false,key); assert.equal(result.code,"SELECTION_CHANGED",key); assert.deepEqual(f.state.writes,[],key);
  }
});
test("a game already running or unqueryable prevents component and runtime writes", async () => {
  for (const [snapshot,code] of [[{ok:true,processes:[{image:"Titanfall2.exe",pid:12}]},"GAME_ALREADY_RUNNING"],[{ok:false,processes:[]},"PROCESS_QUERY_FAILED"]]) {
    const f = fixture(); f.state.snapshot = snapshot; const result = await f.api.install();
    assert.equal(result.ok,false); assert.equal(result.code,code); assert.deepEqual(f.state.writes,[]); assert.equal(f.state.calls.some(call => call[0] === "component-install"),false);
  }
});
test("stale selections and newly started games are checked again inside installer writes", async () => {
  for (const cause of ["selection","game"]) {
    const f = fixture(); f.state.beforeEngineInstall = () => {if(cause==="selection")f.state.conf.gamepath="D:/Other/Titanfall2";else f.state.snapshot={ok:true,processes:[{image:"Titanfall2.exe",pid:44}]};};
    const result = await f.api.install(); assert.equal(result.ok,false); assert.equal(result.code,cause === "selection" ? "SELECTION_CHANGED" : "GAME_ALREADY_RUNNING"); assert.deepEqual(f.state.writes,[]);
  }
});
test("runtime guards still prevent writes after component installation if the selected mode changes", async () => {
  const f = fixture(); f.state.beforeRuntimeEnsure = () => {f.state.conf.modProfileServer="cn";};
  const result = await f.api.install(); assert.equal(result.ok,false); assert.equal(result.code,"SELECTION_CHANGED"); assert.deepEqual(f.state.writes,["component"]); assert.deepEqual(f.state.emits,[]);
});
test("progress spans both installation stages and monotonically finishes at 100", async () => {
  const f = fixture(), result = await f.api.install(); assert.equal(result.ok,true);
  const values = f.state.progress.map(item => item.percent); assert.equal(values[0],0); assert.equal(values.at(-1),100);
  assert.ok(values.every((value,index) => value>=0 && value<=100 && (index===0 || value>=values[index-1])));
  assert.ok(f.state.progress.some(item => item.phase==="installing" && item.percent===40));
  assert.ok(f.state.progress.some(item => item.phase==="preparing" && item.percent===95));
  assert.deepEqual(f.state.progress.at(-1),{phase:"done",percent:100});
});
test("outdated runtime and final package verification cannot report success", async () => {
  const older = fixture(); installed(older,{version:"1.20.9"});
  await assert.rejects(older.api.ensure(),{code:"VANILLA_RUNTIME_OUTDATED"}); assert.equal(older.state.progress.some(item => item.phase==="done"),false);
  const changed = fixture(); installed(changed); changed.state.beforeRuntimeEnsure = () => {changed.state.component.verified=false;changed.state.component.state="damaged";};
  await assert.rejects(changed.api.ensure({allowInstall:true}),{code:"VANILLA_CLIENT_NOT_INSTALLED"}); assert.equal(changed.state.progress.some(item => item.phase==="done"),false);
});
test("invalid game selection is reported without creating or installing anything", async () => {
  const f = fixture(); f.state.valid=false;
  const result = await f.api.status(); assert.equal(result.ok,false); assert.equal(result.code,"GAME_DIRECTORY_INVALID");
  const install = await f.api.install(); assert.equal(install.ok,false); assert.equal(install.code,"GAME_DIRECTORY_INVALID"); assert.deepEqual(f.state.writes,[]); assert.equal(f.state.calls.some(call => call[0]==="create-engine"),false);
});
test("a newly installed component is reflected as a change even if the runtime was already current", async () => {
  const f = fixture(); installed(f); f.state.component = {installed:false,verified:false,state:"missing",version:"2.5.1"};
  const result = await f.api.install(); assert.equal(result.ok,true); assert.deepEqual(f.state.writes,["component"]); assert.equal(result.changed,true);
});
