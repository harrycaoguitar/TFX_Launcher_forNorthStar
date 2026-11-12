'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm'), crypto = require('node:crypto');
const {createClientSwitcher, CORE_DIRS, compareVersion} = require('../src/modules/northstar-client');
function archiveSource(name) {
  if (!process.env.TFX_TEST_ARCHIVE) return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  const raw=fs.readFileSync(process.env.TFX_TEST_ARCHIVE),header=JSON.parse(raw.subarray(16,16+raw.readUInt32LE(12)));let entry=header;
  for(const part of name.split('/'))entry=entry.files[part];const start=8+raw.readUInt32LE(4)+Number(entry.offset);
  return raw.subarray(start,start+entry.size).toString('utf8');
}
const source = archiveSource('src/modules/vanilla-client.js');
const put = (root, name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, value); };
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
async function fixture(t, initial = null, {realComponent = false} = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tfx-official-root-'));
  t.after(() => fs.rmSync(work, {recursive:true, force:true}));
  const root = path.join(work, '原版目录'), other = path.join(work, '独立国际服'), bundles = path.join(work, 'bundles');
  for (const directory of [root, other]) put(directory, 'Titanfall2.exe', 'game fixture');
  for (const channel of ['cn', 'global']) {
    const files = {'NorthstarLauncher.exe':channel, 'bin/x64_retail/wsock32.dll':channel};
    if (channel === 'cn') {files['Northstar.dll']='NSCN_MATCHMAKING_HOST';files['launcher.dll']='cn loader';}
    else {files['R2Northstar/Northstar.dll']='global'; files['R2Northstar/plugins/ranim.dll']='global plugin';}
    for (const directory of CORE_DIRS) files[directory+'/mod.json']=JSON.stringify({Name:path.basename(directory),Version:channel==='cn'?'1.17.7':'1.31.13'});
    if (channel==='cn') {
      files['R2Northstar/mods/Northstar.Custom/mod.json']=JSON.stringify({Name:'Northstar.Custom',Version:'1.17.7',Scripts:['nscnRuiPrecache']});
      files['R2Northstar/mods/Northstar.Custom/mod/scripts/vscripts/nscn_logo_rui.nut']='cn logo';
    }
    const manifest={schemaVersion:1,channel,version:channel==='cn'?'1.17.7':'1.31.13',profile:'R2Northstar',ownedDirectories:CORE_DIRS,files:[]};
    for (const [name, value] of Object.entries(files)) {
      let data=Buffer.from(value);
      if (/\.(exe|dll)$/i.test(name)) {const pe=Buffer.alloc(512);pe.writeUInt16LE(0x5a4d);pe.writeUInt32LE(64,60);pe.writeUInt32LE(0x4550,64);pe.writeUInt16LE(0x8664,68);pe.writeUInt16LE(0x20b,88);data=Buffer.concat([pe,data]);}
      put(path.join(bundles,channel),'payload/'+name,data);manifest.files.push({path:name,size:data.length,sha256:sha(data)});
    }
    put(path.join(bundles,channel),'manifest.json',JSON.stringify(manifest));
  }
  if (initial) fs.cpSync(path.join(bundles,initial,'payload'),root,{recursive:true});
  fs.cpSync(path.join(bundles,'global/payload'),other,{recursive:true});
  put(root,'R2Northstar/mods/User.Personal/mod.json','user mod bytes');
  put(root,'R2Northstar/mods/User.Personal/script.nut','user script bytes');
  const state={component:{installed:true,verified:true,state:'installed',version:'2.5.1'},writes:[],calls:[],dialogs:[],answer:0,running:false,beforeDialog:null,hook:async()=>{},conf:{gamepath:root,globalGamepath:other,nsargs:'',vanillaModsEnabled:true,northstarRegion:'cn',uiLanguage:'zh-CN'}};
  const sw=createClientSwitcher({bundleRoot:bundles,processCheck:async()=>false,acquireLock:async()=>async()=>{},hook:(...args)=>state.hook(...args)});
  const clients={
    async status(region,conf,explicitRoot) {
      state.calls.push(['status',region,explicitRoot]);
      const info=await sw.inspect({gameRoot:explicitRoot || (region==='global'?conf.globalGamepath:conf.gamepath)}), item=info.available[region];
      return {ok:true,installed:item.installed,active:item.active,ready:item.active&&!item.damaged,installState:item.damaged?'damaged':item.installed?'installed':'not-installed',installedRegion:info.installed?.channel,selectedVersion:item.version,version:'1.31.13',error:item.error};
    },
    async ensure(options) {state.calls.push(['ensure',options]);await options.guard?.(); const result=await sw.ensure({gameRoot:options.gameRoot || (options.conf.northstarRegion==='global'?options.conf.globalGamepath:options.conf.gamepath),channel:options.conf.northstarRegion,allowInstall:options.allowInstall,repair:options.repair,refresh:options.refresh});state.writes.push('runtime');return result;}
  };
  const component=realComponent ? require('../src/modules/vanilla-plus').createManager() : {inspect:async()=>({...state.component}),install:async(_profile,options)=>{await options.guard?.();if(state.componentInstallError)throw Error(state.componentInstallError);state.writes.push('component');return state.component={installed:true,verified:true,state:'installed',version:'2.5.1'};}};
  const stubs={path,fs,electron:{ipcMain:{handle(){},emit(){}},dialog:{showMessageBox:async(_win,options)=>{state.dialogs.push(options);await state.beforeDialog?.();return {response:state.answer};}}},'./settings':()=>({...state.conf}),'./northstar-clients':clients,'./northstar-region':{resolveProfile:(root)=>path.join(root,'R2Northstar')},'./launch-session':{splitArguments:()=>[]},'./dds-operation-gate':{run:async(_name,fn)=>fn()},'./vanilla-plus':{VERSION:'2.5.1',createManager:()=>component},'./game-roots':{resolveGameRoot:conf=>conf.gamepath,hasGame:()=>false},'./releases':{compareVersions:compareVersion},'./is_running':{snapshot:async()=>({ok:true,processes:[]})},'../win':()=>({send(){}}),'../lang':key=>key};
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:id=>{if (!(id in stubs))throw Error('Unexpected require '+id);return stubs[id];},__dirname:path.join(__dirname,'../src/modules'),Buffer,process});
  const wrapperStubs={...stubs,fs:{...fs,existsSync:name=>name==='D:/'?false:fs.existsSync(name)},crypto, electron:{app:{getPath:()=>work},ipcMain:{handle(){},emit(){}}},'./northstar-region':require('../src/modules/northstar-region'),'./northstar-client':{...require('../src/modules/northstar-client'),createClientSwitcher:options=>createClientSwitcher({...options,bundleRoot:bundles,stateRoot:path.join(work,'transactions'),acquireLock:async()=>async()=>{}})},'./northstar-client-cache':{ClientBundleCache:class{constructor(){this.sourceRoot=bundles;this.cacheRoot=path.join(work,'cache');}async safeCachePath(value){return value;}async descriptor(channel){return {directory:path.join(bundles,channel),preferSnapshot:false};}}}};
  const wrapperModule={exports:{}};
  vm.runInNewContext(archiveSource('src/modules/northstar-clients.js'),{module:wrapperModule,exports:wrapperModule.exports,require:id=>{if (!(id in wrapperStubs))throw Error('Unexpected wrapper require '+id);return wrapperStubs[id];},__dirname:path.join(__dirname,'../src/modules'),Buffer,process});
  stubs['./game-roots'].hasGame=()=>state.running;
  return {root,other,state,api:module.exports,sw,bundles,wrapper:wrapperModule.exports};
}
test('a global framework in a separate client directory does not satisfy the vanilla game root',async t=>{
  const f=await fixture(t);const result=await f.api.status();
  assert.equal(result.installed,false);assert.equal(result.runtimeState,'missing');assert.equal(result.code,'VANILLA_RUNTIME_MISSING');assert.deepEqual(f.state.writes,[]);
  await assert.rejects(f.api.ensure(),{code:'VANILLA_RUNTIME_MISSING'});assert.deepEqual(f.state.writes,[]);
});
test('CN runtime is reported as replacement required even when VanillaPlus is verified',async t=>{
  const f=await fixture(t,'cn');const result=await f.api.status();assert.equal(result.runtimeState,'cn');assert.equal(result.code,'VANILLA_RUNTIME_CN');assert.equal(result.installed,false);
  await assert.rejects(f.api.ensure(),{code:'VANILLA_RUNTIME_CN'});assert.deepEqual(f.state.writes,[]);
});
test('canceling the replacement writes nothing and does not install VanillaPlus',async t=>{
  const f=await fixture(t,'cn');f.state.component={installed:false,verified:false,state:'missing',version:'2.5.1'};f.state.answer=1;
  const before=fs.readFileSync(path.join(f.root,'Northstar.dll'));const result=await f.api.install();
  assert.equal(result.canceled,true);assert.equal(f.state.dialogs.length,1);assert.equal(f.state.dialogs[0].cancelId,1);assert.deepEqual(f.state.writes,[]);assert.deepEqual(fs.readFileSync(path.join(f.root,'Northstar.dll')),before);
});
test('confirmed replacement removes all CN core files, installs global in the same root and preserves user mods',async t=>{
  const f=await fixture(t,'cn');put(f.root,'R2Northstar/mods/Northstar.Client/mod/cn-only.nut','stale CN script');
  const otherBefore=fs.readFileSync(path.join(f.other,'NorthstarLauncher.exe'));const result=await f.api.install();assert.equal(result.ok,true,result.error);
  assert.equal(f.state.dialogs.length,1);assert.equal(fs.existsSync(path.join(f.root,'Northstar.dll')),false);assert.equal(fs.existsSync(path.join(f.root,'launcher.dll')),false);
  assert.equal(fs.existsSync(path.join(f.root,'R2Northstar/mods/Northstar.Client/mod/cn-only.nut')),false);
  assert.equal(fs.existsSync(path.join(f.root,'R2Northstar/mods/Northstar.Custom/mod/scripts/vscripts/nscn_logo_rui.nut')),false);
  for (const file of JSON.parse(fs.readFileSync(path.join(f.bundles,'global/manifest.json'))).files) assert.equal(sha(fs.readFileSync(path.join(f.root,file.path))),file.sha256,file.path);
  assert.equal(fs.readFileSync(path.join(f.root,'R2Northstar/mods/User.Personal/script.nut'),'utf8'),'user script bytes');assert.deepEqual(fs.readFileSync(path.join(f.other,'NorthstarLauncher.exe')),otherBefore);
  assert.equal(result.status.installed,true);assert.equal(result.status.runtimeState,'global');
});
test('a selection change while the confirmation dialog is open prevents writes',async t=>{
  const f=await fixture(t,'cn');f.state.beforeDialog=()=>{f.state.conf.gamepath=f.other;};const result=await f.api.install();assert.equal(result.code,'SELECTION_CHANGED');assert.deepEqual(f.state.writes,[]);
});
test('a failed replacement restores CN files and leaves user mods unchanged',async t=>{
  const f=await fixture(t,'cn');const before=fs.readFileSync(path.join(f.root,'Northstar.dll'));f.state.hook=async event=>{if(event==='row-written')throw Error('injected write failure');};
  const result=await f.api.install();assert.equal(result.ok,false);assert.equal(f.state.dialogs.length,1);assert.deepEqual(fs.readFileSync(path.join(f.root,'Northstar.dll')),before);assert.equal(fs.readFileSync(path.join(f.root,'R2Northstar/mods/User.Personal/script.nut'),'utf8'),'user script bytes');
});

test('a VanillaPlus install conflict leaves the CN framework intact before replacement',async t=>{
  const f=await fixture(t,'cn');f.state.component={installed:false,verified:false,state:'conflict',version:'2.5.1'};f.state.componentInstallError='existing foreign VanillaPlus package';
  const before=fs.readFileSync(path.join(f.root,'Northstar.dll'));const result=await f.api.install();assert.equal(result.ok,false);assert.match(result.error,/foreign VanillaPlus/);
  assert.equal(f.state.dialogs.length,1);assert.ok(fs.existsSync(path.join(f.root,'Northstar.dll')),'CN loader must remain when component installation fails');assert.deepEqual(fs.readFileSync(path.join(f.root,'Northstar.dll')),before);assert.deepEqual(f.state.writes,[]);
});
test('an existing global runtime launches without a replacement prompt or runtime installation',async t=>{
  const f=await fixture(t,'global');const status=await f.api.status();assert.equal(status.installed,true);assert.equal(status.runtimeState,'global');
  await f.api.ensure();assert.equal(f.state.dialogs.length,0);assert.equal(f.state.calls.find(c=>c[0]==='ensure')[1].conf.northstarRegion,'global');
});
test('explicit missing-runtime installation targets the original root without altering the separate global install',async t=>{
  const f=await fixture(t);const result=await f.api.install();assert.equal(result.ok,true,result.error);assert.equal(f.state.dialogs.length,0);assert.equal(result.status.installed,true);assert.ok(fs.existsSync(path.join(f.root,'R2Northstar/Northstar.dll')));
});

test('a fresh original root installs both real VanillaPlus and Global framework without an existing profile',async t=>{
  const f=await fixture(t,null,{realComponent:true});fs.rmSync(path.join(f.root,'R2Northstar'),{recursive:true});
  const result=await f.api.install();assert.equal(result.ok,true,result.error);assert.equal(result.status.installed,true);assert.equal(result.status.runtimeState,'global');assert.ok(fs.existsSync(path.join(f.root,'R2Northstar/Northstar.dll')));
  assert.equal((await require('../src/modules/vanilla-plus').createManager().inspect(path.join(f.root,'R2Northstar'))).verified,true);
});
test('a missing Global proxy is a framework repair, not a VanillaPlus repair',async t=>{
  const f=await fixture(t,'global');fs.unlinkSync(path.join(f.root,'bin/x64_retail/wsock32.dll'));const result=await f.api.status();assert.equal(result.installed,false);assert.equal(result.runtimeState,'damaged');assert.equal(result.code,'VANILLA_RUNTIME_DAMAGED');
});
test('a partial CN loader still requires confirmation before replacing anything',async t=>{
  const f=await fixture(t);put(f.root,'Northstar.dll','partial CN loader');f.state.answer=1;const status=await f.api.status();assert.equal(status.runtimeState,'cn');const result=await f.api.install();assert.equal(result.canceled,true);assert.deepEqual(f.state.writes,[]);
});
test('the real client facade honors the explicit vanilla root for status and installation',async t=>{
  const f=await fixture(t);
  assert.equal((await f.wrapper.status('global',f.state.conf,f.root)).installed,false);
  const result=await f.wrapper.ensure({conf:{...f.state.conf,northstarRegion:'global'},gameRoot:f.root,directory:path.join(f.bundles,'global'),allowInstall:true,refresh:true});assert.equal(result.channel,'global');
  assert.ok(fs.existsSync(path.join(f.root,'R2Northstar/Northstar.dll')));assert.equal((await f.wrapper.status('global',f.state.conf,f.root)).active,true);
});
test('a game starting while confirmation is open blocks all writes',async t=>{
  const f=await fixture(t,'cn');f.state.beforeDialog=()=>{f.state.running=true;};const result=await f.api.install();assert.equal(result.code,'GAME_ALREADY_RUNNING');assert.deepEqual(f.state.writes,[]);
});
