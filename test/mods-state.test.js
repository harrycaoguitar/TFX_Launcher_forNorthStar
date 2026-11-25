"use strict";
const os = require("node:os");
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),vm=require("vm"),adapter=require("../src/modules/mod-enabled-state");
const {EventEmitter}=require("events");
const source=fs.readFileSync(path.join(__dirname,"../src/modules/mods.js"),"utf8"),root=fs.mkdtempSync(path.join(os.tmpdir(), "tfx-mods-state-"));
function fixture(states={},nsargs=""){
  const base=fs.mkdtempSync(path.join(root,"case-")),gamepath=path.join(base,"game"),userData=path.join(base,"data");fs.mkdirSync(gamepath);fs.mkdirSync(userData);fs.writeFileSync(path.join(gamepath,"NorthstarLauncher.exe"),"fixture");fs.writeFileSync(path.join(gamepath,"Titanfall2.exe"),"fixture");
  const profile=path.join(gamepath,nsargs?"Custom Profile":"R2Northstar"),file=path.join(profile,"enabledmods.json");fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(file,JSON.stringify(states));
  const put=(name,version="1.0",folder=name,pack)=>{const dest=path.join(profile,pack?"packages":"mods",...(pack?[pack,"mods"]:[]),folder,"mod.json");fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify({Name:name,Version:version}));if(pack)fs.writeFileSync(path.join(profile,"packages",pack,"manifest.json"),JSON.stringify({name:"Package",version_number:"9.0"}));return dest;};
  for(const name of adapter.CORE_NAMES)put(name,"1.18.0");put("Personal.Off");put("Personal.On");
  const settings={gamepath,nsargs},events=[],fakefs={...fs,watch:()=>({on(){},close(){}})},noop=()=>{},lang=x=>x;lang.getLocale=()=>"zh-CN";
  const app=new EventEmitter();app.getPath=()=>userData;let gateBusy=false;
  const gate={get busy(){return gateBusy;},async run(_label,action){if(gateBusy)throw Error("Operation already active");gateBusy=true;try{return await action();}finally{gateBusy=false;}}};
  const modules={"fs-extra":fakefs,"./dds-operation-gate":gate,"./is_running":{snapshot:async()=>({ok:true,processes:[]})},"./local-mod-import":{importLocalMod:noop,messages:{}},electron:{app,ipcMain:{on:noop,handle:noop},dialog:{}},"./json":p=>{try{return JSON.parse(fs.readFileSync(p));}catch(_){return false;}},"./update":{northstar:{updating:false}},"./version":{northstar:()=>"1.18.0"},"./settings":()=>settings,"./mod-added-times":require("../src/modules/mod-added-times"),"./mod-enabled-state":adapter,"./server-mod-profiles":require("../src/modules/server-mod-profiles"),"./northstar-region":require("../src/modules/northstar-region"),"./launch-session":require("../src/modules/launch-session"),"./console":{error:noop,ok:noop},"../win":()=>({log:x=>events.push(["log",x]),send:(...x)=>events.push(x)}),"../lang":lang,"./packages":{list:()=>({})}};
  const filename=path.join(__dirname,"../src/modules/mods.js"),localRequire=require("node:module").createRequire(filename);
  const context={require:id=>Object.hasOwn(modules,id)?modules[id]:localRequire(id),module:{exports:{}},process:{pid:process.pid,argv:[]},Buffer,setTimeout,clearTimeout};vm.runInNewContext(source,context,{filename});
  return {base,gamepath,profile,file,put,settings,events,app,mods:context.module.exports,setGateBusy:value=>{gateBusy=value;},read:()=>JSON.parse(fs.readFileSync(file)),bytes:()=>fs.readFileSync(file)};
}
test("both schemas display actual enabled booleans and exact core directories",()=>{
  for(const states of [{"Personal.Off":false,"Personal.On":true},{Version:1,"Personal.Off":{"1.0":false},"Personal.On":{"1.0":true}}]){
    const f=fixture(states),list=f.mods.list({readOnly:true}).all;
    assert.equal(list.find(x=>x.name==="Personal.Off").disabled,true);assert.equal(list.find(x=>x.name==="Personal.On").disabled,false);
    assert.equal(list.filter(x=>x.required).length,3);
  }
});
test("explicit Global toggle updates actual mod version, preserving other version choices",()=>{
  const f=fixture({Version:1,"Personal.Off":{"0.8":false,"1.0":false},"Personal.On":{"1.0":true}}),r=f.mods.setState({names:["Personal.Off"],enabled:true});assert.equal(r.ok,true);assert.deepEqual(f.read()["Personal.Off"],{"0.8":false,"1.0":true});assert.equal(f.read()["Personal.On"]["1.0"],true);
});
test("packaged mod uses mod.json Version rather than archive version when toggling",()=>{
  const f=fixture({Version:1,"Package.Child":{"1.2":false,"9.0":true}});f.put("Package.Child","1.2","Child","Author-Package-9.0");const child=f.mods.list({readOnly:true}).all.find(x=>x.name==="Package.Child");assert.equal(child.version,"9.0");assert.equal(child.stateVersion,"1.2");assert.equal(child.disabled,true);
  assert.equal(f.mods.setState({names:["Package.Child"],enabled:true}).ok,true);assert.deepEqual(f.read()["Package.Child"],{"1.2":true,"9.0":true});
});
test("core disable, legacy toggle, and individual removal reject without modifying files",()=>{
  const f=fixture({"Personal.Off":false});const before=f.bytes();
  for(const r of [f.mods.setState({names:["Northstar.Client"],enabled:false}),f.mods.modfile.disable("Northstar.Client"),f.mods.toggle("Northstar.Client"),f.mods.remove("Northstar.Client")]){assert.equal(r.ok,false);assert.equal(r.code,"CORE_REQUIRED");assert.deepEqual(f.bytes(),before);assert.ok(fs.existsSync(path.join(f.profile,"mods/Northstar.Client/mod.json")));}
});
test("bulk toggle excludes cores and atomically inverts every personal installed version once",()=>{
  const f=fixture({Version:1,"Northstar.Client":{"1.18.0":true},"Personal.Off":{"1.0":false},"Personal.On":{"1.0":true}});f.put("Personal.Off","1.0","Duplicate.Off");
  const r=f.mods.toggle("allmods");assert.equal(r.ok,true);assert.equal(f.read()["Personal.Off"]["1.0"],true);assert.equal(f.read()["Personal.On"]["1.0"],false);assert.equal(f.read()["Northstar.Client"]["1.18.0"],true);
});
test("bulk removal preserves all core files and removes personal folders",()=>{
  const f=fixture({"Personal.Off":false});assert.equal(f.mods.remove("allmods"),true);for(const name of adapter.CORE_NAMES)assert.ok(fs.existsSync(path.join(f.profile,"mods",name,"mod.json")));assert.equal(fs.existsSync(path.join(f.profile,"mods/Personal.Off")),false);assert.equal(fs.existsSync(path.join(f.profile,"mods/Personal.On")),false);
});
test("regeneration preserves false and uninstalled choices while repairing only cores",()=>{
  const f=fixture({Version:1,"Northstar.Client":{"1.18.0":false},"Personal.Off":{"1.0":false,"0.8":true},Uninstalled:{"4":false}});assert.equal(f.mods.modfile.gen().ok,true);assert.deepEqual(f.read()["Personal.Off"],{"1.0":false,"0.8":true});assert.deepEqual(f.read().Uninstalled,{"4":false});assert.equal(f.read()["Northstar.Client"]["1.18.0"],true);
});
test("legacy get/set/toggle preserve both schemas and respect current mod version",()=>{
  for(const format of ["flat","versioned"]){const f=fixture(format==="flat"?{"Personal.Off":false}:{Version:1,"Personal.Off":{"1.0":false,"old":false}});assert.equal(f.mods.modfile.get("Personal.Off"),false);assert.equal(f.mods.modfile.enable("Personal.Off").ok,true);assert.equal(f.mods.modfile.get("Personal.Off"),true);assert.equal(f.mods.modfile.toggle("Personal.Off").ok,true);assert.equal(f.mods.modfile.get("Personal.Off"),false);if(format==="versioned")assert.equal(f.read()["Personal.Off"].old,false);}
});
test("custom profile selection reads and writes only that profile",()=>{
  const f=fixture({"Personal.Off":false},'-profile "Custom Profile"');const defaultDir=path.join(f.gamepath,"R2Northstar");fs.mkdirSync(defaultDir);const defaultFile=path.join(defaultDir,"enabledmods.json"),defaultBytes=Buffer.from('{"other": false}');fs.writeFileSync(defaultFile,defaultBytes);
  assert.equal(f.mods.setState({names:["Personal.Off"],enabled:true}).ok,true);assert.equal(f.read()["Personal.Off"],true);assert.deepEqual(fs.readFileSync(defaultFile),defaultBytes);
});
test("invalid requests, malformed configs, and unknown versions reject without writes",()=>{
  const f=fixture({Version:1,"Personal.Off":{"1.0":false}}),initial=f.bytes();for(const request of [{names:["Absent"],enabled:true},{names:["Personal.Off"],enabled:1},{names:["Northstar.Client","Personal.Off"],enabled:false}]){assert.equal(f.mods.setState(request).ok,false);assert.deepEqual(f.bytes(),initial);}
  fs.writeFileSync(f.file,"{bad");const malformed=f.bytes();assert.equal(f.mods.setState({names:["Personal.Off"],enabled:true}).ok,false);assert.deepEqual(f.bytes(),malformed);
  fs.writeFileSync(f.file,JSON.stringify({Version:1}));f.put("Unknown.Version","");const unknown=f.bytes();assert.equal(f.mods.setState({names:["Unknown.Version"],enabled:false}).ok,false);assert.deepEqual(f.bytes(),unknown);
});
test("missing remembered game folder does not prevent module initialization",()=>{
  const f=fixture();fs.rmSync(f.gamepath,{recursive:true});f.settings.gamepath=path.join(f.base,"missing-game");assert.deepEqual(Array.from(f.mods.list({readOnly:true}).all),[]);
});
test("both schemas preserve state during shared intake and active game operations, then permit guarded updates",async()=>{
  for(const states of [{"Personal.Off":false},{Version:1,"Personal.Off":{"1.0":false}}]){
    const f=fixture(states),before=f.bytes(),request={names:["Personal.Off"],enabled:true};
    f.mods.sharedImportBusy=true;assert.equal(f.mods.setState(request).code,"busy");assert.equal((await f.mods.setStateAsync(request)).code,"busy");assert.deepEqual(f.bytes(),before);
    f.mods.sharedImportBusy=false;f.setGateBusy(true);assert.equal(f.mods.setState(request).code,"busy");assert.deepEqual(f.bytes(),before);
    f.setGateBusy(false);assert.equal((await f.mods.setStateAsync(request)).ok,true);assert.equal(f.mods.modfile.get("Personal.Off"),true);
  }
});

test.after(() => {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith("tfx-mods-state-"));
  const stat = fs.lstatSync(root); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(root, {recursive: true, force: true});
});
