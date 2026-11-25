'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createService,scanAddons,checkVpk}=require('../src/modules/r1delta-addons');

async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'tfx-r1-addons-')),gamepath=path.join(root,'Titanfall');
  const put=async(name,value='fixture')=>{const target=path.join(gamepath,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,value);return target;};
  await put('Titanfall.exe');await put('bin/x64_retail/engine.dll');await put('vpk/client.vpk');await fs.mkdir(path.join(gamepath,'r1/addons'),{recursive:true});
  const config={gamepath,gameInstalled:true,installed:true,version:'3.0.5',busy:false,running:false};
  const core={status:async()=>({ok:true,...config})};
  const service=createService({core,app:{getPath:()=>root},dialog:{showOpenDialog:async()=>({canceled:true,filePaths:[]})},shell:{openPath:async()=>''},processes:{snapshot:async()=>({ok:true,processes:[]})}});
  t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,gamepath,put,service};
}
async function addon(folder,name='Fixture Addon'){
  await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'addoninfo.txt'),`"AddonInfo" { "addontitle" "${name}" "addonauthor" "Fixture Author" "addonversion" "1.2" "addondescription" "Delta test addon" }`);await fs.writeFile(path.join(folder,'payload.txt'),'addon content');
}

test('scans Addon folders using R1Delta addonlist enabled values',async t=>{
  const f=await fixture(t),folder=path.join(f.gamepath,'r1/addons/Fixture.Mod');await addon(folder);
  await fs.writeFile(path.join(f.gamepath,'r1/addonlist.txt'),'"AddonList" { "Fixture.Mod" "1" }');
  const result=await scanAddons(f.gamepath);assert.equal(result.addons.length,1);assert.equal(result.addons[0].title,'Fixture Addon');assert.equal(result.addons[0].enabled,true);assert.equal(result.addons[0].author,'Fixture Author');
});

test('reads addonlist in source order with the final case-insensitive duplicate winning',async t=>{
  const f=await fixture(t),folder=path.join(f.gamepath,'r1/addons/Fixture.Mod');await addon(folder);
  await fs.writeFile(path.join(f.gamepath,'r1/addonlist.txt'),'"AddonList" { "fixture.mod" "1" "Fixture.Mod" "0" "Fixture.Mod" "2" }');
  assert.equal((await scanAddons(f.gamepath)).addons[0].enabled,true);
});

test('enabling and disabling an Addon updates addonlist and records rollback copies',async t=>{
  const f=await fixture(t),folder=path.join(f.gamepath,'r1/addons/Fixture.Mod');await addon(folder);
  const disabled=await f.service.list();assert.equal(disabled.addons[0].enabled,false);
  let result=await f.service.setEnabled({id:'Fixture.Mod',enabled:true});assert.equal(result.addons[0].enabled,true);
  assert.match(await fs.readFile(path.join(f.gamepath,'r1/addonlist.txt'),'utf8'),/"Fixture\.Mod"\s+"1"/);
  result=await f.service.setEnabled({id:'Fixture.Mod',enabled:false});assert.equal(result.addons[0].enabled,false);
  const backups=await fs.readdir(path.join(f.gamepath,'r1/.tfx-addon-backups'));assert.equal(backups.length,2);
});

test('imports only Delta Addons, installs into r1/addons, and backs up removals',async t=>{
  const f=await fixture(t),source=path.join(f.root,'Creator Package','Fixture.Mod');await addon(source,'Packaged Addon');
  const preview=await f.service.inspect({path:source});assert.equal(preview.entries[0].name,'Fixture.Mod');
  const installed=await f.service.install({token:preview.token});assert.equal(installed.addons[0].enabled,true);assert.equal(await fs.readFile(path.join(f.gamepath,'r1/addons/Fixture.Mod/payload.txt'),'utf8'),'addon content');
  const removed=await f.service.remove({id:'Fixture.Mod'});assert.equal(removed.addons.length,0);assert.equal(await fs.readFile(path.join(f.gamepath,'r1/addonlist.txt'),'utf8').then(value=>value.includes('Fixture.Mod')),false);
  const backups=await fs.readdir(path.join(f.gamepath,'r1/.tfx-addon-backups'));assert.ok(backups.length>=2);
  const restored=await Promise.any(backups.map(name=>fs.readFile(path.join(f.gamepath,'r1/.tfx-addon-backups',name,'Fixture.Mod/payload.txt'),'utf8')));assert.equal(restored,'addon content');
});

test('rejects Northstar mod.json packages as Titanfall 1 Addons',async t=>{
  const f=await fixture(t),source=path.join(f.root,'northstar');await fs.mkdir(source);await fs.writeFile(path.join(source,'mod.json'),'{"Name":"Not a Delta Addon"}');
  await assert.rejects(f.service.inspect({path:source}),/addoninfo\.txt/);
});

test('rejects empty and segmented VPK archives',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'tfx-r1-vpk-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const major of [1,2]){const file=path.join(root,`Fixture${major}.vpk`),header=Buffer.alloc(major===1?12:28);header.writeUInt32LE(0x55aa1234,0);header.writeUInt16LE(major,4);header.writeUInt16LE(0,6);header.writeUInt32LE(1,8);await fs.writeFile(file,Buffer.concat([header,Buffer.from([0]) ]));await assert.rejects(checkVpk(file),/VPK 索引不完整/);}
  const split=path.join(root,'Fixture_dir.vpk'),header=Buffer.alloc(12);header.writeUInt32LE(0x55aa1234);header.writeUInt16LE(1,4);header.writeUInt32LE(1,8);await fs.writeFile(split,Buffer.concat([header,Buffer.from([0])]));await assert.rejects(checkVpk(split),/单文件/);
});

test('validates Delta embedded VPK indexes and reads addoninfo metadata',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'tfx-r1-vpk-tree-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const info=Buffer.from('"AddonInfo" { "addontitle" "Packed Fixture" "addonauthor" "Delta Author" }');
  for(const major of [1,2]){
    const strings=Buffer.from('txt\0 \0addoninfo\0'),base=Buffer.alloc(8);base.writeUInt16LE(0x7fff,6);
    const chunk=major===1?Buffer.alloc(10):Buffer.alloc(32);
    if(major===1){chunk.writeUInt32LE(0,0);chunk.writeUInt32LE(info.length,4);chunk.writeUInt16LE(0xffff,8);}
    else{chunk.writeBigUInt64LE(0n,6);chunk.writeBigUInt64LE(BigInt(info.length),14);chunk.writeBigUInt64LE(BigInt(info.length),22);chunk.writeUInt16LE(0xffff,30);}
    const tree=Buffer.concat([strings,base,chunk,Buffer.from([0,0,0])]),header=Buffer.alloc(major===1?12:16);header.writeUInt32LE(0x55aa1234);header.writeUInt16LE(major,4);if(major===2)header.writeUInt16LE(3,6);header.writeUInt32LE(tree.length,8);if(major===2)header.writeUInt32LE(info.length,12);
    const file=path.join(root,`Packed${major}.vpk`);await fs.writeFile(file,Buffer.concat([header,tree,info]));
    assert.equal(await checkVpk(file),(await fs.stat(file)).size);
    const {inspectVpk}=require('../src/modules/r1delta-addons'),details=await inspectVpk(file);assert.equal(details.info.title,'Packed Fixture');assert.equal(details.info.author,'Delta Author');
  }
  const broken=path.join(root,'Broken.vpk');await fs.writeFile(broken,Buffer.from([0x34,0x12,0xaa,0x55,1,0,0,0,1,0,0,0,0]));await assert.rejects(checkVpk(broken),/VPK 索引不完整/);
});
