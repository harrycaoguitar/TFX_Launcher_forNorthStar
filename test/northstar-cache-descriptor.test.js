"use strict";
const os = require("node:os");
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const {ClientBundleCache}=require("../src/modules/northstar-client-cache"),{CORE_DIRS,validateBundle}=require("../src/modules/northstar-client");
const root=fs.mkdtempSync(path.join(os.tmpdir(), "tfx-northstar-cache-descriptor-"));
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
function binary(){const bytes=Buffer.alloc(512);bytes.writeUInt16LE(0x5a4d);bytes.writeUInt32LE(128,60);bytes.writeUInt32LE(0x00004550,128);bytes.writeUInt16LE(0x8664,132);bytes.writeUInt16LE(0x20b,152);return bytes;}
function fixture(channel="global",update=false){
  const directory=fs.mkdtempSync(path.join(root,"fixture-")),sourceRoot=path.join(directory,"sources"),cacheRoot=path.join(directory,"cache");
  const files=["NorthstarLauncher.exe","bin/x64_retail/wsock32.dll",channel==="cn"?"Northstar.dll":"R2Northstar/Northstar.dll",...(channel==="cn"?["launcher.dll"]:[]),...CORE_DIRS.map(dir=>dir+"/mod.json")];
  const bytes=new Map(files.map(file=>[file,file.endsWith(".json")?Buffer.from(JSON.stringify({Name:path.basename(path.dirname(file)),Version:"1.31.13"})):binary()]));
  const manifest={schemaVersion:1,channel,version:"1.31.13",profile:"R2Northstar",ownedDirectories:CORE_DIRS,archive:{path:"payload.zip",format:"zip",size:1,sha256:"a".repeat(64)},files:files.map(file=>({path:file,size:bytes.get(file).length,sha256:sha(bytes.get(file))}))};
  const digest=sha(JSON.stringify(manifest)),bundle=path.join(cacheRoot,update?"updates":"bundled",update?digest:channel+"-"+digest);
  fs.mkdirSync(path.join(sourceRoot,channel),{recursive:true});fs.writeFileSync(path.join(sourceRoot,channel,"manifest.json"),JSON.stringify(manifest));fs.mkdirSync(bundle,{recursive:true});fs.writeFileSync(path.join(bundle,"manifest.json"),JSON.stringify(manifest));
  for(const [file,value] of bytes){const filename=path.join(bundle,"payload",...file.split("/"));fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,value);}
  if(update)fs.writeFileSync(path.join(cacheRoot,"updates",channel+".json"),JSON.stringify({channel,directory:digest}));
  const cache=new ClientBundleCache({sourceRoot,cacheRoot,toolsDir:"unused",validateURL:()=>true});cache.base=async()=>{throw Error("unexpected extraction");};
  return {cache,bundle,manifest,digest,channel};
}
test("warm descriptors read metadata without extraction for bundled and updates",async()=>{for(const update of [false,true]){const f=fixture("global",update),descriptor=await f.cache.descriptor("global");assert.equal(descriptor.directory,f.bundle);assert.equal(descriptor.expectedDigest,f.digest);assert.equal((await validateBundle(descriptor.directory,"global")).digest,descriptor.expectedDigest);}});
test("descriptor metadata does not blindly authorize modified payload",async()=>{for(const update of [false,true]){const f=fixture("global",update);fs.writeFileSync(path.join(f.bundle,"payload/NorthstarLauncher.exe"),"broken");const descriptor=await f.cache.descriptor("global");assert.equal(descriptor.expectedDigest,f.digest);await assert.rejects(validateBundle(descriptor.directory,"global"),/文件校验失败/);await assert.rejects(f.cache.provided("global"),/文件校验失败/);}});
test("warm descriptors reject changed or cross-channel manifest",async()=>{for(const update of [false,true]){const f=fixture("global",update);fs.writeFileSync(path.join(f.bundle,"manifest.json"),JSON.stringify({...f.manifest,version:"1.31.14"}));await assert.rejects(f.cache.descriptor("global"),/不一致/);}});
test("descriptor cache rejects links before returning paths",async()=>{const f=fixture();const original=f.bundle+"-real";fs.renameSync(f.bundle,original);fs.symlinkSync(original,f.bundle,"junction");await assert.rejects(f.cache.descriptor("global"),/链接/);});
test("descriptor rejects unrecognized region without cache mutation",async()=>{const f=fixture();await assert.rejects(f.cache.descriptor("invalid"),/频道无效/);});

test("CN first deployment ignores another version in shared downloads without deleting it",async()=>{
  const f=fixture("cn"),current=JSON.parse(fs.readFileSync(path.join(f.cache.sourceRoot,"cn/manifest.json"),"utf8"));
  const updated={...current,version:"1.18.0"},digest=sha(JSON.stringify(updated)),directory=path.join(f.cache.cacheRoot,"updates",digest);
  fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,"manifest.json"),JSON.stringify(updated));
  const pointer=path.join(f.cache.cacheRoot,"updates/cn.json"),before=JSON.stringify({channel:"cn",directory:digest});fs.writeFileSync(pointer,before);
  const descriptor=await f.cache.descriptor("cn");
  assert.equal(descriptor.directory,f.bundle);assert.equal(descriptor.preferSnapshot,true);
  assert.equal(fs.readFileSync(pointer,"utf8"),before);assert(fs.existsSync(directory));
});

test("CN cold download rejects a release that differs from its default before downloading",async()=>{
  const f=fixture("cn");fs.rmSync(f.bundle,{recursive:true});let downloaded=false;
  f.cache.releaseProvider=async()=>({region:"cn",version:"1.18.0"});f.cache.update=async()=>{downloaded=true;};
  await assert.rejects(f.cache.descriptor("cn"),/默认下载版本/);assert.equal(downloaded,false);
});
for (const channel of ["cn","global"]) test("missing bundled payload downloads the selected official release for "+channel,async()=>{
  const directory=fs.mkdtempSync(path.join(root,"cloud-only-")),sourceRoot=path.join(directory,"sources"),cacheRoot=path.join(directory,"cache"),version=channel==="cn"?"1.17.7":"1.31.13";
  const source=path.join(sourceRoot,channel);fs.mkdirSync(source,{recursive:true});
  const files=["NorthstarLauncher.exe","bin/x64_retail/wsock32.dll",channel==="cn"?"Northstar.dll":"R2Northstar/Northstar.dll",...(channel==="cn"?["launcher.dll"]:[]),...CORE_DIRS.map(dir=>dir+"/mod.json")];
  const bytes=new Map(files.map(file=>[file,file.endsWith(".json")?Buffer.from(JSON.stringify({Name:path.basename(path.dirname(file)),Version:version})):binary()]));
  const manifest={schemaVersion:1,channel,version,profile:"R2Northstar",ownedDirectories:CORE_DIRS,archive:{path:"payload.zip",format:"zip",size:1,sha256:"a".repeat(64)},files:files.map(file=>({path:file,size:bytes.get(file).length,sha256:sha(bytes.get(file))}))};
  fs.writeFileSync(path.join(source,"manifest.json"),JSON.stringify(manifest));
  const calls=[],cache=new ClientBundleCache({sourceRoot,cacheRoot,toolsDir:"unused",validateURL:()=>true,releaseProvider:async selected=>{calls.push(selected);return {region:selected,version:"v"+version};}});
  cache.update=async release=>{
    assert.equal(release.region,channel);
    const bundle=path.join(cacheRoot,"updates","bundle"),digest=sha(JSON.stringify(manifest)),targetRoot=path.join(cacheRoot,"updates",digest);
    fs.mkdirSync(bundle,{recursive:true});fs.writeFileSync(path.join(bundle,"manifest.json"),JSON.stringify(manifest));
    for(const [file,value]of bytes){const target=path.join(bundle,"payload",...file.split("/"));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);}
    fs.writeFileSync(path.join(cacheRoot,"updates",channel+".json"),JSON.stringify({channel,directory:digest}));fs.renameSync(bundle,targetRoot);return targetRoot;
  };
  const descriptor=await cache.descriptor(channel);assert.deepEqual(calls,[channel]);assert.equal(descriptor.expectedDigest,sha(JSON.stringify(manifest)));assert.equal((await validateBundle(descriptor.directory,channel)).digest,descriptor.expectedDigest);
});

test.after(() => {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith("tfx-northstar-cache-descriptor-"));
  const stat = fs.lstatSync(root); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(root, {recursive: true, force: true});
});
