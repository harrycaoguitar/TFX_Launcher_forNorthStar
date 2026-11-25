"use strict";
const os = require("node:os");
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),vm=require("vm"),{EventEmitter}=require("events");
const directory=fs.mkdtempSync(path.join(os.tmpdir(), "tfx-skin-protection-adapter-"));
function fixture(format){
  const base=fs.mkdtempSync(path.join(directory,"case-")),game=path.join(base,"game");fs.mkdirSync(game);fs.writeFileSync(path.join(game,"Titanfall2.exe"),"fixture");
  const callbacks=new Map(),calls=[],saved={gamepath:game},app=new EventEmitter();app.getPath=key=>path.join(base,key);app.quit=()=>{};
  let captureFails=false,commitFails=false,installFails=false,engineStatusCalls=0;
  const protection={busy:false,status:async root=>{calls.push(["protection-status",root]);return {enabled:true,activeCount:1,ddsCount:format==="dds"?1:0,vtfCount:format==="vtf"?1:0,state:"ready"};},prepareCapture:async root=>{calls.push(["prepare",root]);if(captureFails)throw Error("capture warning");return {snapshot:{values:{}}};},commitCapture:async(root,candidate)=>{calls.push(["commit",root,candidate]);if(commitFails)throw Error("commit warning");},setEnabled:async()=>({enabled:false}),capture:async()=>({state:"ready"})};
  class Engine{constructor(options){this.baseDir=options.baseDir;this.busy=false;}async status(root,pkg){engineStatusCalls++;calls.push(["engine-status",root,pkg]);return {game:{ready:true,path:root},package:pkg?{id:pkg}:null,backups:[]};}async inspect(){return {id:"package-id"};}async install(root,pkg){calls.push(["install",root,pkg]);if(installFails)throw Error("install rejected");return {backupId:"backup-id"};}async restore(root,id){calls.push(["restore",root,id]);return {backupId:id};}async deleteBackup(root,id){calls.push(["delete",root,id]);return {backupId:id};}async initialize(){}}
  class Cache{constructor(){this.sessionDir=path.join(base,"cache");}async initialize(){}async releaseExcept(){return [];}async close(){}}
  const gate={busy:false,async run(label,action){calls.push(["gate",label]);return action();}},noop=async()=>false;
  const mocks={electron:{app,ipcMain:{handle:(name,cb)=>callbacks.set(name,cb)},dialog:{},BrowserWindow:{},shell:{}},"./dds-engine":{DdsEngine:Engine,errorText:error=>error.message},"./vtf-engine":{VtfEngine:Engine,errorText:error=>error.message},"./vtf-cache":{VtfImportCache:Cache},"./settings":()=>saved,"./is_running":{game:noop},"./dds-operation-gate":gate,"./dds-guard":protection};
  let resourceAdapter;
  mocks["./is_running"].snapshot=async()=>({ok:true,processes:[]});
  mocks["./skin-resource-download"]={register(_kind,options){resourceAdapter=options;}};
  mocks["./offline-skin-pack"]={OfflineSkinPack:class{},productionDirectories:()=>[]};
  mocks["./skin-conflict-preview"]={forStatus:async options=>{calls.push(["preview",options.format,options.packageId]);return options.packageId&&options.isCurrent()?{version:1,packageId:options.packageId,format:options.format,counts:{replace:1,restore:0,modConflicts:0},items:[],warnings:[],complete:false,blocked:false}:null;}};
  const filename=path.join(__dirname,"../src/modules",format+".js"),localRequire=require("node:module").createRequire(filename),context={require:id=>Object.hasOwn(mocks,id)?mocks[id]:localRequire(id),__dirname:path.dirname(filename),module:{exports:{}},console};
  vm.runInNewContext(fs.readFileSync(filename,"utf8"),context,{filename});
  const event={sender:{isDestroyed:()=>false,send(){}}};
  return {game,calls,callbacks,event,saved,protection,resourceAdapter,setCaptureFailure:()=>{captureFails=true;},setCommitFailure:()=>{commitFails=true;},setInstallFailure:()=>{installFails=true;},statusCalls:()=>engineStatusCalls};
}
test("standalone settings protection status does not scan DDS engine or imported package",async()=>{const f=fixture("dds"),result=await f.callbacks.get("dds-protection-status")();assert.equal(result.ok,true);assert.equal(result.game.ready,true);assert.equal(result.running,false);assert.equal(result.busy,false);assert.equal(result.protection.ddsCount,1);assert.equal(f.statusCalls(),0);});
test("standalone settings status requires an absolute directory containing a regular Titanfall2.exe",async()=>{
  for(const kind of ["missing","directory","relative"]){const f=fixture("dds");if(kind==="relative")f.saved.gamepath="relative/game";else{fs.rmSync(path.join(f.game,"Titanfall2.exe"));if(kind==="directory")fs.mkdirSync(path.join(f.game,"Titanfall2.exe"));}const result=await f.callbacks.get("dds-protection-status")();assert.equal(result.ok,true);assert.equal(result.game.ready,false);assert.equal(f.statusCalls(),0);}
});
test("DDS and VTF installation adapters capture before write, commit after install and return unified status",async()=>{
  for(const format of ["dds","vtf"]){const f=fixture(format);await f.callbacks.get(format+"-inspect")(f.event,{path:path.join(f.game,"Fixture.zip")});f.calls.length=0;const result=await f.callbacks.get(format+"-install")(f.event,{packageId:"package-id"});assert.equal(result.ok,true);assert.equal(result.protection.activeCount,1);assert.deepEqual(f.calls.filter(item=>["prepare","install","commit"].includes(item[0])).map(item=>item[0]),["prepare","install","commit"]);}
});
test("both installation adapters preserve successful install while returning capture or commit warnings",async()=>{
  for(const format of ["dds","vtf"])for(const where of ["capture","commit"]){const f=fixture(format);await f.callbacks.get(format+"-inspect")(f.event,{path:path.join(f.game,"Fixture.zip")});if(where==="capture")f.setCaptureFailure();else f.setCommitFailure();const result=await f.callbacks.get(format+"-install")(f.event,{packageId:"package-id"});assert.equal(result.ok,true);assert.match(result.protectionWarning,new RegExp(where+" warning"));assert.equal(result.protection.activeCount,1);}
});
test("failed installs do not commit compatibility snapshots and errors still return unified protection",async()=>{for(const format of ["dds","vtf"]){const f=fixture(format);await f.callbacks.get(format+"-inspect")(f.event,{path:path.join(f.game,"Fixture.zip")});f.setInstallFailure();f.calls.length=0;const result=await f.callbacks.get(format+"-install")(f.event,{packageId:"package-id"});assert.equal(result.ok,false);assert.equal(f.calls.some(item=>item[0]==="commit"),false);assert.equal(result.protection.activeCount,1);}});

test("automatic repair uses the same protected installation adapter as direct installation",async()=>{
  for(const format of ["dds","vtf"]){const f=fixture(format);await f.callbacks.get(format+"-inspect")(f.event,{path:path.join(f.game,"Fixture.zip")});f.calls.length=0;const result=await f.resourceAdapter.install(f.game,"package-id",{packageId:"package-id"});assert.equal(result.result.backupId,"backup-id");assert.deepEqual(f.calls.filter(item=>["prepare","install","commit"].includes(item[0])).map(item=>item[0]),["prepare","install","commit"]);}
});
test("automatic installation rejects a game path changed during compatibility capture",async()=>{
  for(const format of ["dds","vtf"]){const f=fixture(format);await f.callbacks.get(format+"-inspect")(f.event,{path:path.join(f.game,"Fixture.zip")});f.protection.prepareCapture=async()=>{f.saved.gamepath=path.join(f.game,"changed");return {};};f.calls.length=0;await assert.rejects(f.resourceAdapter.install(f.game,"package-id",{packageId:"package-id"}),/选择|校验/);assert(!f.calls.some(item=>["install","commit"].includes(item[0])));}
});
test("VTF restore and deletion responses include unified protection and bind operation game path",async()=>{const f=fixture("vtf");for(const action of ["restore","delete-backup"]){const result=await f.callbacks.get("vtf-"+action)(f.event,{backupId:"backup-id"});assert.equal(result.ok,true);assert.equal(result.protection.vtfCount,1);}});
test("DDS and VTF previews bind to the current inspected selection and clear stale preview state",async()=>{
  for(const format of ["dds","vtf"]){const f=fixture(format),imported=await f.callbacks.get(format+"-inspect")(f.event,{path:path.join(f.game,"Fixture.zip")});assert.equal(imported.ok,true);assert.equal(imported.conflictPreview.packageId,"package-id");const preview=await f.callbacks.get(format+"-preview")(f.event,{packageId:"package-id",selectionRevision:imported.selectionRevision});assert.equal(preview.ok,true);assert.equal(preview.conflictPreview.format,format);const stale=await f.callbacks.get(format+"-preview")(f.event,{packageId:"different"});assert.equal(stale.ok,false);assert.equal(stale.conflictPreview,null);await f.callbacks.get(format+"-clear")(f.event);const cleared=await f.callbacks.get(format+"-status")();assert.equal(cleared.package,null);assert.equal(cleared.conflictPreview,null);}
});

test.after(() => {
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
  assert(path.basename(directory).startsWith("tfx-skin-protection-adapter-"));
  const stat = fs.lstatSync(directory); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(directory, {recursive: true, force: true});
});
