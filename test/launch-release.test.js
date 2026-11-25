"use strict";
const os = require("node:os");
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),vm=require("vm"),{EventEmitter}=require("events");
const source=path.resolve(__dirname,".."),realSession=require("../src/modules/launch-session"),network=require("../src/modules/northstar-region");
const base=fs.mkdtempSync(path.join(os.tmpdir(), "tfx-launch-release-"));
function harness(changePhase,options={}){
  const root=fs.mkdtempSync(path.join(base,"game-")),profile=path.join(root,"R2Northstar"),data=path.join(root,"owned-userData"),conf={gamepath:root,globalGamepath:options.region==="global"?root:"",nsargs:options.args||"-multiple",northstarRegion:options.region||"cn",vanillaModsEnabled:options.officialMods===true,modProfileServer:options.officialMods?"official":options.region||"cn"},events=[];
  for(const name of ["Titanfall2.exe","NorthstarLauncher.exe","Northstar.dll","bin/x64_retail/launcher.dll","bin/x64_retail/tier0.dll"]){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,name.endsWith("Northstar.dll")?options.legacyConsole?"fixture":"fixture -noallocconsole":"fixture");}fs.mkdirSync(path.join(root,"r2"));fs.mkdirSync(profile);
  if(options.officialMods){fs.mkdirSync(path.join(root,"R2Titanfall"),{recursive:true});fs.writeFileSync(path.join(root,"R2Titanfall/Northstar.dll"),"fixture -noallocconsole");}
  if(options.region==="global"||options.officialMods)fs.writeFileSync(path.join(profile,"Northstar.dll"),"fixture -noallocconsole");
  if(options.officialMods)fs.writeFileSync(path.join(root,"bin/x64_retail/wsock32.dll"),"fixture");
  let spawns=0,ensures=0,busy=false,helpers=0,helperClosed=0,spawnedFile,spawnedArgs,recoveryConf,officialProfile;
  function change(phase){events.push(phase);if(changePhase===phase){if(options.officialMods)conf.vanillaModsEnabled=false;else conf.northstarRegion="global";}}
  class Confirmation{begin(){return {promise:Promise.resolve({ok:true,pid:900})};}spawned(){}fail(){}observe(){}entered(){}ready(){}}
  const stubs={fs,path,child_process:{spawn(file,args){spawns++;spawnedFile=file;spawnedArgs=args;const child=new EventEmitter();child.pid=900;child.unref=()=>{};queueMicrotask(()=>child.emit("spawn"));return child;},execFile(file,args,settings,callback){assert.equal(file,"powershell.exe");assert.equal(settings.windowsHide,true);helpers++;change("console-helper");const helper=new EventEmitter();helper.stdout=new EventEmitter();helper.stdin=new EventEmitter();helper.stdin.end=()=>{helperClosed++;queueMicrotask(()=>callback(null,"console-hidden"));};queueMicrotask(()=>helper.stdout.emit("data","vyra-console-ready"));return helper;}},electron:{app:{getPath:()=>data,getVersion:()=>"1.0.3-beta.1",quit(){}},ipcMain:{on(){},emit(){},handle(){}},dialog:{showSaveDialog:async()=>({canceled:true})}},"../lang":x=>x,"./settings":()=>conf,"./console":{info(){},warn(){},error(){}},"./dds-guard":{beforeLaunch:async()=>{change("skin-protection");return {ok:true};}},"../win":()=>({isDestroyed:()=>false,send(){}}),"./dds-operation-gate":{run:async(name,action)=>{busy=true;try{return await action();}finally{busy=false;}}},"./is_running":{speedUp(){},onSnapshot(){},snapshot:async()=>({ok:true,processes:options.externalDuringHelper&&helpers?[{image:"Titanfall2.exe",pid:77,executablePath:path.join(root,"Titanfall2.exe")}]:[]})},"./findgame":{validateGamePath:value=>value===root?root:false},"./launch-session":{...realSession,LaunchConfirmation:Confirmation},"./northstar-region":network,"./northstar-clients":{ensure:async({guard})=>{ensures++;change("client-await");await guard?.();return {version:"1.17.7"};},recover:async value=>{recoveryConf={...value};return {}; }},"./mod-enabled-state":{prepare:async()=>({}),assertReady(){}},"./mod-compatibility":{prepare:async()=>({applied:[],restored:[]})},"./northstar-health":require("../src/modules/northstar-health"),"./northstar-readiness":{NorthstarReadiness:class{}},"./ea-account":{launchProfile:async()=>null},"./ea-emulator":{stop:async()=>{},start:async()=>({stop:async()=>{},env:{}})},"./ea-emulator-launch":{resolve:options=>options},"./dds":{busy:false},"./skin-switch":{getActive:()=>({assertReady:async()=>{}})}};
  stubs["./game-roots"]=require("../src/modules/game-roots");
  stubs["./launcher-version"]=()=>"1.1.1";
  stubs["./launch-diagnostics"]=require("../src/modules/launch-diagnostics");stubs["./diagnostic-export"]=require("../src/modules/diagnostic-export");
  stubs["./official-launch"]=require("../src/modules/official-launch");
  stubs["./clean-loader-proxy"]=require("../src/modules/clean-loader-proxy");
  stubs["./server-mod-profiles"]={prepare:async()=>({}),prepareShared:async()=>{change("community-state");return {};},assertNorthstarReady(){},prepareOfficial:async profile=>{officialProfile=profile;change("official-state");return {};},assertOfficialReady(){change("official-assert");}};
  stubs["./vanilla-client"]={ensure:async({guard})=>{ensures++;change("official-client");await guard?.();return {version:"1.31.13"};}};
  stubs["./steam-game-launch"]={resolve:async()=>{change("steam-route");return options.steamRoute ? {executable:path.join(root,"Steam.exe"),argsPrefix:["-applaunch","1237970"]} : null;}};
  stubs["./ea-handoff"]={prepare:async({guard})=>{change("ea-preparation");await guard?.();await options.platformWait;if(options.platformError)throw Error("platform fixture failure");return {cold:false,ready:true};}};
  const file=path.join(source,"src/modules/launch.js"),module={exports:{}};vm.runInNewContext("(function(require,module,exports){"+fs.readFileSync(file,"utf8")+"\n})",{Buffer,process,console,setTimeout,clearTimeout,Date,queueMicrotask},{filename:file})(id=>{if(!Object.hasOwn(stubs,id))throw Error("unstubbed "+id);return stubs[id];},module,module.exports);
  return {launch:module.exports,conf,diagnostic:()=>JSON.parse(fs.readFileSync(path.join(data,"launch-diagnostics.json"),"utf8")),counts:()=>({spawns,ensures,busy,helpers,helperClosed,spawnedFile,spawnedArgs,recoveryConf,officialProfile}),events};
}
for(const phase of ["client-await","skin-protection","ea-preparation"])test("selection changed during "+phase+" cannot spawn captured client and releases gate",async()=>{const f=harness(phase),result=await f.launch("northstar");assert.equal(result.ok,false);assert.match(result.error,/客户端选择或游戏目录已改变/);assert.equal(f.counts().spawns,0);assert.equal(f.counts().busy,false);});
test("unchanged client and original-game launches spawn once after protection and release gate",async()=>{for(const mode of ["northstar","vanilla"]){const f=harness(),result=await f.launch(mode);assert.equal(result.ok,true);assert.equal(f.counts().spawns,1);assert.equal(f.counts().busy,false);assert.equal(f.counts().ensures,mode==="northstar"?1:0);}});

test("ordinary Vanilla recovery stays on the selected game root when the saved Global root is missing",async()=>{
  const f=harness(null,{region:"global"});f.conf.globalGamepath=path.join(base,"missing-global-game");
  assert.equal((await f.launch("vanilla")).ok,true);
  assert.equal(f.counts().recoveryConf.gamepath,f.conf.gamepath);assert.equal(f.counts().recoveryConf.northstarRegion,"cn");
});

test("legacy console preparation overlaps platform readiness and neither starts the game early",async()=>{
  let release;const platformWait=new Promise(resolve=>{release=resolve;});const f=harness(null,{legacyConsole:true,platformWait});
  const result=f.launch("northstar");for(let i=0;i<100&&!f.counts().helpers;i++)await new Promise(resolve=>setTimeout(resolve,2));
  assert.equal(f.counts().helpers,1);assert.equal(f.counts().spawns,0);assert.equal(f.counts().busy,true);
  release();assert.equal((await result).ok,true);assert.equal(f.counts().spawns,1);assert.equal(f.counts().helperClosed,1);
});

test("parallel console preparation retains final selection and external-game guards",async()=>{
  for(const [phase,options,error]of[["console-helper",{},/客户端选择或游戏目录已改变/],[null,{externalDuringHelper:true},/所选游戏目录已有游戏或北极星启动进程/]]){
    const f=harness(phase,{legacyConsole:true,...options}),result=await f.launch("northstar");
    assert.equal(result.ok,false);assert.match(result.error,error);assert.equal(f.counts().spawns,0);
    assert.equal(f.counts().helperClosed,1);assert.equal(f.counts().busy,false);
  }
});

test("a rejected platform preparation closes an already prepared owned console helper",async()=>{
  const f=harness(null,{legacyConsole:true,platformError:true}),result=await f.launch("northstar");
  assert.equal(result.ok,false);assert.match(result.error,/platform fixture failure/);
  assert.equal(f.counts().helpers,1);assert.equal(f.counts().helperClosed,1);assert.equal(f.counts().spawns,0);assert.equal(f.counts().busy,false);
});

test("the faster pipeline spawns the selected CN or Global client and exact masterserver argument",async()=>{
  for(const region of["cn","global"]){const f=harness(null,{region}),result=await f.launch("northstar");
    assert.equal(result.ok,true,result.error);assert.equal(path.basename(f.counts().spawnedFile),"NorthstarLauncher.exe");
    const args=f.counts().spawnedArgs;assert.equal(args[args.indexOf("+ns_masterserver_hostname")+1],network.HOSTS[region]);
    assert.equal(f.counts().spawns,1);
  }
});

test("actual launch adapter persists bounded structured success and failure facts without local paths or arguments",async()=>{
  const success=harness(null,{region:"global"}),successResult=await success.launch("northstar");assert.equal(successResult.ok,true,successResult.error);
  const report=success.diagnostic();assert.equal(report.schema,1);assert.equal(report.state,"confirmed");assert.equal(report.region,"global");assert.equal(report.appVersion,"1.1.1");assert.equal(report.clientVersion,"1.17.7");
  assert.equal(report.stages.find(item=>item.code==="confirmation").status,"observed");assert.equal(report.attempts,1);
  assert(!JSON.stringify(report).includes(success.conf.gamepath));assert(!JSON.stringify(report).includes("-multiple"));assert(!Object.hasOwn(report,"error"));
  const failure=harness(null,{platformError:true});assert.equal((await failure.launch("northstar")).ok,false);
  const failed=failure.diagnostic();assert.equal(failed.state,"failed");assert.equal(failed.outcome.code,"ea-failed");assert.equal(failed.outcome.causeKnown,false);
  assert(!JSON.stringify(failed).includes("platform fixture failure"));assert.equal(failed.stages.find(item=>item.code==="game").status,"unconfirmed");
});
test("invalid selected directory is a proven preflight condition and never attempts to start a game",async()=>{
  const f=harness();f.conf.gamepath="invalid fixture directory";
  const result=await f.launch("northstar");assert.equal(result.ok,false);assert.equal(result.code,"GAME_DIRECTORY_INVALID");assert.equal(f.counts().spawns,0);
  const report=f.diagnostic();assert.equal(report.outcome.evidenceCode,"GAME_DIRECTORY_INVALID");assert.equal(report.outcome.causeKnown,true);assert.equal(report.stages.find(item=>item.code==="preflight").status,"failed");
});

test("official Mod mode uses the purchased executable with global loader and VanillaPlus even when CN was remembered",async()=>{
  const f=harness(null,{officialMods:true,region:"cn",args:"-multiple -northstar -vanilla +ns_masterserver_hostname stale.invalid -novid"});
  assert.equal((await f.launch("vanilla")).ok,true);
  const result=f.counts();assert.equal(path.basename(result.spawnedFile),"Titanfall2.exe");
  assert.equal(result.ensures,1);assert.equal(result.spawnedArgs.filter(arg=>arg==="-vanilla").length,1);
  assert(result.spawnedArgs.includes("-northstar"));assert(result.spawnedArgs.includes("-profile=R2Titanfall"));assert(result.spawnedArgs.includes("-novid"));
  assert.equal(result.officialProfile,path.join(f.conf.gamepath,"R2Titanfall"));
  assert(!result.spawnedArgs.some(arg=>arg.includes("ns_masterserver")));assert(!result.spawnedArgs.includes("stale.invalid"));
  assert(f.events.indexOf("official-state")<f.events.indexOf("official-assert"));assert(!f.events.includes("community-state"));
});

test("a verified Steam installation dispatches the exact official Mod arguments through Steam",async()=>{
  const f=harness(null,{officialMods:true,steamRoute:true});assert.equal((await f.launch("vanilla")).ok,true);
  assert.equal(path.basename(f.counts().spawnedFile),"Steam.exe");assert.deepEqual(Array.from(f.counts().spawnedArgs.slice(0,2)),["-applaunch","1237970"]);
  assert(f.counts().spawnedArgs.includes("-northstar"));assert(f.counts().spawnedArgs.includes("-vanilla"));assert.equal(f.counts().spawns,1);
  const changed=harness("steam-route",{officialMods:true,steamRoute:true});assert.equal((await changed.launch("vanilla")).ok,false);assert.equal(changed.counts().spawns,0);
});

test("official clean mode strips stale loader arguments and restores an existing autoload marker",async()=>{
  const f=harness(null,{args:"-multiple -northstar -vanilla -profile=old +ns_auth_allow_insecure 1 -novid"});
  const marker=path.join(f.conf.gamepath,"run_northstar.txt"),before=Buffer.from("1\r\n");fs.writeFileSync(marker,before);
  assert.equal((await f.launch("vanilla")).ok,true);
  const result=f.counts();assert.equal(path.basename(result.spawnedFile),"Titanfall2.exe");assert.deepEqual(Array.from(result.spawnedArgs),["-multiple","-novid"]);
  assert.deepEqual(fs.readFileSync(marker),before);assert(!f.events.includes("official-state"));assert(!f.events.includes("community-state"));
});

test("official mode changed during component check cannot launch the stale selected mode",async()=>{
  const f=harness("official-client",{officialMods:true});assert.equal((await f.launch("vanilla")).code,"SELECTION_CHANGED");
  assert.equal(f.counts().spawns,0);assert.equal(f.counts().busy,false);
});

test.after(() => {
  assert.equal(path.dirname(base), path.resolve(os.tmpdir()));
  assert(path.basename(base).startsWith("tfx-launch-release-"));
  const stat = fs.lstatSync(base); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(base, {recursive: true, force: true});
});
