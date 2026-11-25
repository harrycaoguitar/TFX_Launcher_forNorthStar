"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),os=require("os"),path=require("path"),crypto=require("crypto"),vm=require("vm");
const clients=require("../src/modules/northstar-client"),{ClientBundleCache}=require("../src/modules/northstar-client-cache"),{createManager,PROXY}=require("../src/modules/clean-loader-proxy");
const sha=value=>crypto.createHash("sha256").update(value).digest("hex"),moduleRoot=path.resolve(__dirname,"../src/modules");
const suiteRoot=fs.mkdtempSync(path.join(os.tmpdir(),"tfx-clean-loader-trust-"));
function load(name,stubs){const filename=path.join(moduleRoot,name+".js"),module={exports:{}};vm.runInNewContext(fs.readFileSync(filename,"utf8"),{module,exports:module.exports,require:key=>key in stubs?stubs[key]:require(require.resolve(key,{paths:[moduleRoot]})),__dirname:moduleRoot,URL,Buffer,console},{filename});return module.exports;}
const releases=load("releases",{"../win":()=>({send(){}}),electron:{ipcMain:{on(){}}},"./requests":{get(){throw Error("unexpected network");}}});
function binary(seed=1){const bytes=Buffer.alloc(512);bytes.writeUInt16LE(0x5a4d);bytes.writeUInt32LE(128,60);bytes.writeUInt32LE(0x00004550,128);bytes.writeUInt16LE(0x8664,132);bytes.writeUInt16LE(0x20b,152);bytes.writeUInt32LE(seed,400);return bytes;}
function fixture(t){
  const directory=fs.mkdtempSync(path.join(suiteRoot,"fixture-")),root=path.join(directory,"game"),cacheRoot=path.join(directory,"cache"),stateRoot=path.join(directory,"transactions");
  fs.mkdirSync(root);fs.writeFileSync(path.join(root,"Titanfall2.exe"),binary());
  const conf={gamepath:root,nsargs:""},switcher=clients.createClientSwitcher({stateRoot});
  const api=load("northstar-clients",{
    electron:{app:{getPath:()=>directory},ipcMain:{handle(){},emit(){}}},"../win":()=>({send(){}}),"./settings":()=>({...conf}),
    "./findgame":{validateGamePath:value=>fs.existsSync(path.join(value,"Titanfall2.exe"))?value:null},
    "./northstar-region":{normalize:value=>value === "global" ? "global" : "cn",resolveProfile:game=>path.join(game,"R2Northstar")},"./launch-session":{splitArguments:()=>[],hasGame:()=>false},
    "./northstar-client":{...clients,createClientSwitcher:()=>switcher},
    "./northstar-client-cache":{ClientBundleCache:class extends ClientBundleCache{constructor(options){super({...options,cacheRoot});}descriptor(){throw Error("unexpected extraction or cache mutation");}base(){throw Error("unexpected extraction");}}},"./releases":releases
  });
  let providerCalls=0;
  const manager=()=>createManager({trustedProxyProvider:async(...args)=>{providerCalls++;return api.trustedProxyFingerprints(...args);}});
  const proxy=path.join(root,...PROXY.split("/"));fs.mkdirSync(path.dirname(proxy),{recursive:true});
  t.after(()=>{assert(path.resolve(directory).startsWith(path.resolve(suiteRoot)+path.sep));fs.rmSync(directory,{recursive:true,force:true});});
  return {directory,root,proxy,cacheRoot,stateRoot,switcher,api,manager,calls:()=>providerCalls};
}
async function bundle(f,{kind="snapshot",channel="cn",seed=20,provenance={}}={}){
  const ctx=await f.switcher.context(f.root,"R2Northstar"),bytes=binary(seed),version="1.31.13";
  const names=["NorthstarLauncher.exe",PROXY,channel==="cn"?"Northstar.dll":"R2Northstar/Northstar.dll",...(channel==="cn"?["launcher.dll"]:[]),...clients.CORE_DIRS.map(core=>core+"/mod.json")];
  const contents=new Map(names.map(name=>[name,name.endsWith(".json")?Buffer.from(JSON.stringify({Name:path.basename(path.dirname(name)),Version:version})):bytes]));
  const repository=channel==="global"?"R2Northstar/Northstar":"R2NorthstarCN/R2NorthstarCN_Launcher";
  const manifest={schemaVersion:1,channel,profile:"R2Northstar",version,ownedDirectories:clients.CORE_DIRS,...(kind==="snapshot"?{provenance:{kind:"private-installed-snapshot",gameRoot:ctx.root,profile:ctx.profile,...provenance}}:{source:{repository,url:`https://github.com/${repository}/releases/download/v${version}/Northstar.release.zip`,archiveSha256:"b".repeat(64),...provenance}}),files:[...contents].map(([name,value])=>({path:name,size:value.length,sha256:sha(value)}))};
  const digest=sha(JSON.stringify(manifest)),directory=kind==="snapshot"?path.join(ctx.state,"channel-cache",channel):path.join(f.cacheRoot,"updates",digest);
  fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,"manifest.json"),JSON.stringify(manifest));
  for(const [name,value]of contents){const target=path.join(directory,"payload",...name.split("/"));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);}
  if(kind!=="snapshot")fs.writeFileSync(path.join(f.cacheRoot,"updates",channel+".json"),JSON.stringify({channel,directory:digest}));
  fs.writeFileSync(f.proxy,bytes);return {directory,manifest,digest,bytes,fingerprint:{size:bytes.length,sha256:sha(bytes)}};
}
function inventory(root){const result=[];const visit=directory=>{if(!fs.existsSync(directory))return;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const filename=path.join(directory,entry.name);if(entry.isDirectory())visit(filename);else result.push([path.relative(root,filename),sha(fs.readFileSync(filename))]);}};visit(root);return result.sort((a,b)=>a[0].localeCompare(b[0]));}

test("recognized private CN snapshots authorize clean preparation and fresh-process crash recovery",async t=>{
  const f=fixture(t),b=await bundle(f),before=inventory(f.directory),trust=await f.api.trustedProxyFingerprints(f.root,b.fingerprint);
  assert.equal(trust.length,1);assert.equal(trust[0].sha256,b.fingerprint.sha256);assert.deepEqual(inventory(f.directory),before);
  const lease=await f.manager().prepare(f.root);assert.equal(lease.changed,true);assert.equal(fs.existsSync(f.proxy),false);
  assert.equal((await f.manager().recover(f.root)).restored,true);assert.deepEqual(fs.readFileSync(f.proxy),b.bytes);assert.equal(f.calls(),2);
});

test("official newer client cache authorizes both channels without extraction or a download",async t=>{
  for(const channel of ["cn","global"]){const f=fixture(t),b=await bundle(f,{kind:"update",channel});const before=inventory(f.directory);assert.equal((await f.api.trustedProxyFingerprints(f.root,b.fingerprint))[0].sha256,b.fingerprint.sha256);assert.deepEqual(inventory(f.directory),before);await(await f.manager().prepare(f.root)).restore();assert.deepEqual(fs.readFileSync(f.proxy),b.bytes);}
});

test("a snapshot belonging to another game or profile never authorizes proxy movement",async t=>{
  for(const provenance of [{gameRoot:path.join(suiteRoot,"other-game")},{profile:"OtherProfile"}]){const f=fixture(t),b=await bundle(f,{provenance});await assert.rejects(f.manager().prepare(f.root),/快照来源无效/);assert.deepEqual(fs.readFileSync(f.proxy),b.bytes);assert.equal(fs.existsSync(path.join(f.root,".tfx")),false);}
});

test("changed private and downloaded payloads cannot authorize a journal or DLL",async t=>{
  for(const kind of ["snapshot","update"]){const f=fixture(t),b=await bundle(f,{kind});fs.writeFileSync(path.join(b.directory,"payload/NorthstarLauncher.exe"),binary(99));await assert.rejects(f.manager().prepare(f.root),/文件校验失败/);assert.deepEqual(fs.readFileSync(f.proxy),b.bytes);assert.equal(fs.existsSync(path.join(f.root,".tfx")),false);}
});

test("crash recovery revalidates the source instead of trusting only journal hashes",async t=>{
  const f=fixture(t),b=await bundle(f);await f.manager().prepare(f.root);fs.writeFileSync(path.join(b.directory,"payload/NorthstarLauncher.exe"),binary(88));const before=inventory(f.directory);
  await assert.rejects(f.manager().recover(f.root),/文件校验失败/);assert.deepEqual(inventory(f.directory),before);assert.equal(fs.existsSync(f.proxy),false);
  fs.writeFileSync(path.join(b.directory,"payload/NorthstarLauncher.exe"),b.bytes);assert.equal((await f.manager().recover(f.root)).restored,true);assert.deepEqual(fs.readFileSync(f.proxy),b.bytes);
});

test("download trust rejects a foreign repository, URL or modified manifest digest",async t=>{
  for(const provenance of [{repository:"Someone/Northstar"},{url:"https://github.com/Someone/Northstar/releases/download/v1.31.13/client.zip"}]){const f=fixture(t),b=await bundle(f,{kind:"update",provenance});await assert.rejects(f.manager().prepare(f.root),/缓存来源无效/);assert.deepEqual(fs.readFileSync(f.proxy),b.bytes);}
  const f=fixture(t),b=await bundle(f,{kind:"update"});fs.writeFileSync(path.join(b.directory,"manifest.json"),JSON.stringify({...b.manifest,version:"1.31.14"}));await assert.rejects(f.manager().prepare(f.root),/清单与索引不一致/);
});

test("unknown DLLs are not authorized by an unrelated valid snapshot",async t=>{
  const f=fixture(t);await bundle(f);const foreign=binary(789);fs.writeFileSync(f.proxy,foreign);await assert.rejects(f.manager().prepare(f.root),/未识别/);assert.deepEqual(fs.readFileSync(f.proxy),foreign);assert.equal(fs.existsSync(path.join(f.root,".tfx")),false);
});

test("missing proxies and bundled fingerprints skip the dynamic provider",async t=>{
  const f=fixture(t),bytes=binary(8),fingerprint={size:bytes.length,sha256:sha(bytes)};let calls=0;
  const manager=createManager({trustedProxies:[fingerprint],trustedProxyProvider:async()=>{calls++;throw Error("provider must stay lazy");}});
  assert.equal((await manager.recover(f.root)).restored,false);assert.equal((await manager.prepare(f.root)).changed,false);fs.writeFileSync(f.proxy,bytes);await(await manager.prepare(f.root)).restore();assert.equal(calls,0);
});

test("linked snapshot directories cannot authorize a proxy",async t=>{
  const f=fixture(t),b=await bundle(f),moved=b.directory+"-real";fs.renameSync(b.directory,moved);fs.symlinkSync(moved,b.directory,"junction");await assert.rejects(f.manager().prepare(f.root),/链接|联接/);assert.deepEqual(fs.readFileSync(f.proxy),b.bytes);
});

test.after(()=>{assert.equal(path.dirname(suiteRoot),path.resolve(os.tmpdir()));assert(path.basename(suiteRoot).startsWith("tfx-clean-loader-trust-"));fs.rmSync(suiteRoot,{recursive:true,force:true});});
