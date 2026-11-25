'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {SkinImporter}=require('../src/modules/skin-import');
const delta=require('../src/modules/r1delta-addons');

test('TF2 import reports the chosen filename before reading and is silent on cancel',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'tfx-feedback-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const source=path.join(root,'fixture.dds');await fs.writeFile(source,'DDS fixture');const events=[];
  const engine={baseDir:root,isImportBusy:()=>false,invalidateSelection(){},packages:new Map(),importSelection:async()=>({ok:true,package:{id:'fixture',name:'fixture.dds'}})};
  const importer=new SkinImporter({dds:engine,vtf:engine,mods:{isImportBusy:()=>false}});
  const sender={isDestroyed:()=>false,send:(...args)=>events.push(args)};
  const result=await importer.run({sender},()=>source);
  assert.equal(result.ok,true);assert.deepEqual(events[0],['skin-import-progress',{format:'mod',stage:'reading',phase:'reading',sourceName:'fixture.dds'}]);
  events.length=0;assert.equal((await importer.run({sender},()=>null)).cancelled,true);assert.equal(events.length,0);
});

test('TF1 import reports the selected filename and cancel emits no reading event',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'tfx-r1-feedback-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const addon=path.join(root,'SampleAddon');await fs.mkdir(addon);await fs.writeFile(path.join(addon,'addoninfo.txt'),'"AddonInfo" { "addontitle" "Sample" }');
  const events=[],app={getPath:()=>root},core={status:async()=>({ok:true,gameInstalled:false})};
  const service=delta.createService({app,core,dialog:{showOpenDialog:async()=>({canceled:true})},shell:{},processes:{},tempBase:root});
  const result=await service.inspect({path:addon},value=>events.push(value));
  assert.equal(result.ok,true);assert.deepEqual(events,[{stage:'reading',phase:'reading',sourceName:'SampleAddon'}]);
  events.length=0;assert.equal((await service.inspect({},value=>events.push(value))).canceled,true);assert.equal(events.length,0);
});
