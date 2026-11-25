'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {createService,validateGame,validateCore,parseReleases,buildLaunchSpec,asciiPath,prepareAudio,detectGame,hashFile,register}=require('../src/modules/r1delta-core');
const {LaunchConfirmation}=require('../src/modules/launch-session');
async function write(root,name,value='fixture'){const target=path.join(root,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,value);return target;}
async function game(root){for(const name of ['Titanfall.exe','bin/x64_retail/engine.dll','vpk/client_mp_common.bsp.pak000_dir.vpk'])await write(root,name);}
async function core(root){
 const names=['Titanfall.exe','r1delta/bin/launcher.dll','r1delta/bin_delta/tier0.dll','r1delta/bin_nexon/launcher.dll','r1delta/GameInfo.txt'];
 for(const name of names)await write(root,name);
 await write(root,'r1delta/content_manifest.txt','r1delta-content-manifest 1\nN '+await hashFile(path.join(root,'r1delta/bin_delta/tier0.dll'))+' bin_delta/tier0.dll\n');
}
async function setup(t,extra={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tfx-delta-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const gamepath=path.join(root,'game'),configFile=path.join(root,'config.json'),coreBase=path.join(root,'cores');await game(gamepath);
 const counts={download:0,release:0,select:0},archive=Buffer.from('fake archive for transaction tests'),release={version:'3.0.5',sha1:crypto.createHash('sha1').update(archive).digest('hex'),size:archive.length,url:'https://github.com/r1delta/r1delta/releases/download/v3.0.5/R1Delta-3.0.5-full.nupkg'};
 const confirmation={begin:()=>({promise:Promise.resolve({ok:true,pid:123,image:'titanfall.exe'})}),spawned(){},launcherExited(){},fail(){}};
 const processes={snapshot:async()=>({ok:true,processes:[]}),speedUp(){},onSnapshot(){return()=>{};}};
 const options={app:{getPath:()=>root,isPackaged:false},dialog:{showOpenDialog:async()=>{counts.select++;return {filePaths:[gamepath]};}},shell:{openExternal:async()=>{}},configFile,coreBase,confirmation,processes,detectGame:async()=>'',latestRelease:async()=>{counts.release++;return release;},download:async(url,name,onProgress)=>{counts.download++;assert.equal(url,release.url);await fs.writeFile(name,archive);onProgress(50);},extract:async(_,dir)=>core(path.join(dir,'lib/net462')),...extra};
 return {root,gamepath,configFile,coreBase,counts,release,options,service:createService(options)};
}
test('RELEASES selects the full package matching the pinned tag, ignoring other and delta packages',()=>{
 const sha='a'.repeat(40),result=parseReleases('\uFEFF'+sha+' R1Delta-9.0.0-full.nupkg 90\n'+sha+' R1Delta-3.0.5-delta.nupkg 1\n'+sha+' R1Delta-3.0.5-full.nupkg 285123246','v3.0.5');
 assert.equal(result.version,'3.0.5');assert.equal(result.size,285123246);assert.match(result.url,/download\/v3\.0\.5\/R1Delta-3\.0\.5-full\.nupkg$/);
 assert.throws(()=>parseReleases('', 'v3.0.5'));assert.throws(()=>parseReleases('', '../../x'));assert.throws(()=>parseReleases(sha+' R1Delta-3.0.5-full.nupkg 0','v3.0.5'));
});
test('game selection rejects TF2, empty placeholder VPKs and missing retail engine',async t=>{
 const f=await setup(t);assert.equal(await validateGame(f.gamepath),true);await fs.unlink(path.join(f.gamepath,'bin/x64_retail/engine.dll'));assert.equal(await validateGame(f.gamepath),false);await write(f.gamepath,'bin/x64_retail/engine.dll');await write(f.gamepath,'vpk/client_mp_common.bsp.pak000_dir.vpk','');assert.equal(await validateGame(f.gamepath),false);assert.equal(await validateGame('../game'),false);
});
test('canceling folder selection never fetches a release or writes settings',async t=>{
 const f=await setup(t,{dialog:{showOpenDialog:async()=>({canceled:true})}});assert.equal((await f.service.install()).canceled,true);assert.equal(f.counts.release,0);assert.equal((await f.service.status()).installed,false);await assert.rejects(fs.stat(f.configFile));
});
test('invalid chosen folder is rejected before downloading',async t=>{
 const f=await setup(t);await fs.unlink(path.join(f.gamepath,'Titanfall.exe'));await assert.rejects(f.service.install(),/Titanfall.exe/);assert.equal(f.counts.release,0);
});
test('core installation verifies hashes, commits separate root and never overwrites game files',async t=>{
 const f=await setup(t),progress=[],before=await hashFile(path.join(f.gamepath,'Titanfall.exe'));const result=await f.service.install(value=>progress.push(value));
 assert.equal(result.installed,true);assert.equal(result.gameInstalled,true);assert.equal(result.version,'3.0.5');assert.ok(result.corepath.startsWith(f.coreBase+path.sep));assert.equal(await hashFile(path.join(f.gamepath,'Titanfall.exe')),before);assert.deepEqual((await fs.readdir(f.gamepath)).sort(),['Titanfall.exe','bin','vpk']);assert.equal(progress.at(-1).percent,100);assert.equal(await validateCore(result.corepath,true),true);assert.equal((await fs.readdir(f.coreBase)).length,1);
 const second=await f.service.install();assert.equal(f.counts.download,1);assert.equal(second.corepath,result.corepath);assert.equal(f.counts.select,1);
 const reloaded=createService(f.options);assert.equal((await reloaded.status()).corepath,result.corepath);
});
test('a corrupt package preserves the previous active core and removes its staging directory',async t=>{
 const f=await setup(t);await f.service.install();const before=await fs.readFile(f.configFile,'utf8');f.release.version='3.0.6';f.release.sha1='f'.repeat(40);
 await assert.rejects(f.service.install(),/校验失败/);assert.equal(await fs.readFile(f.configFile,'utf8'),before);assert.equal((await f.service.status()).installed,true);assert.equal((await fs.readdir(f.coreBase)).length,1);
});
test('extraction failure leaves the old release active',async t=>{
 const f=await setup(t);await f.service.install();const before=await fs.readFile(f.configFile,'utf8');f.release.version='3.0.6';const broken=createService({...f.options,extract:async()=>{throw Error('Disk full');}});await assert.rejects(broken.install(),/Disk full/);assert.equal(await fs.readFile(f.configFile,'utf8'),before);
});
test('modified payload manifests fail before activation',async t=>{
 const f=await setup(t,{extract:async(_,dir)=>{const root=path.join(dir,'lib/net462');await core(root);await write(root,'r1delta/bin_delta/tier0.dll','tampered');}});await assert.rejects(f.service.install(),/校验失败/);assert.equal((await f.service.status()).installed,false);
});
test('parallel install and folder mutations are rejected while one transaction is active',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);const f=await setup(t,{latestRelease:async()=>{await gate;throw Error('intentional stop');}});const pending=f.service.install();await new Promise(resolve=>setTimeout(resolve,40));await assert.rejects(f.service.select(),/正在处理/);await assert.rejects(f.service.install(),/正在处理/);release();await assert.rejects(pending,/intentional stop/);
});
test('native launch uses core EXE, game cwd and official environment without the WPF installer',()=>{
 const spec=buildLaunchSpec('C:/game','C:/core',{Path:'old',PATH:'duplicate',OTHER:'preserved'});assert.equal(spec.executable,path.join('C:/core','Titanfall.exe'));assert.equal(spec.options.cwd,'C:/game');assert.deepEqual(spec.args,[]);assert.equal(spec.options.env.FROM_DELTA_LAUNCHER,'1');assert.equal(spec.options.env.ContentId,'1025161');assert.equal(spec.options.env.__COMPAT_LAYER,'NoDTToDITMouseBatch=1');assert.equal(spec.options.env.PATH,undefined);assert.equal(spec.options.env.OTHER,'preserved');assert.ok(spec.options.env.Path.startsWith(path.join('C:/core','r1delta/bin_delta')+path.delimiter));assert.ok(!JSON.stringify(spec).includes('r1delta.exe'));
});
test('Titanfall 1 launch confirmation requires the selected game PID, not any other installation',async t=>{
 const f=await setup(t),clock={now:0,timers:new Map(),next:0};
 const confirmation=new LaunchConfirmation({now:()=>clock.now,schedule:(fn,delay)=>{const id=++clock.next,handle={id,unref(){}};clock.timers.set(id,{fn,at:clock.now+delay});return handle;},clear:handle=>clock.timers.delete(handle?.id),stableMs:100});
 const baseline={ok:true,processes:[]},session=confirmation.begin(baseline,{images:['Titanfall.exe'],messages:{alreadyRunning:'TF1 already running'}});
 confirmation.spawned(session,55);
 confirmation.observe({ok:true,processes:[{image:'Titanfall2.exe',pid:72,executablePath:'C:\\\\other\\\\Titanfall.exe'}]});
 assert.equal(session.everCandidate,false);
 const selected=path.join(f.root,'Delta core','Titanfall.exe');
 confirmation.observe({ok:true,processes:[{image:'Titanfall.exe',pid:73,executablePath:selected}]});
 clock.now=150;confirmation.observe({ok:true,processes:[{image:'Titanfall.exe',pid:73,executablePath:selected}]});
 assert.deepEqual(await session.promise,{ok:true,pid:73,image:'titanfall.exe'});
 assert.throws(()=>confirmation.begin({ok:true,processes:[{image:'Titanfall.exe',pid:73,executablePath:selected}]},{images:['Titanfall.exe'],messages:{alreadyRunning:'TF1 already running'}}),/TF1 already running/);
});
test('spawn errors propagate and do not report launch success',async t=>{
 let attempts=0;const f=await setup(t,{prepareAudio:async()=>{},asciiPath:async p=>p,spawn:()=>{const child=new EventEmitter();child.pid=123;child.unref=()=>{};const fail=++attempts===1;process.nextTick(()=>fail?child.emit('error',Error('ENOENT fixture')):child.emit('spawn'));return child;}});await f.service.install();const progress=[];await assert.rejects(f.service.launch(value=>progress.push(value)),/ENOENT/);assert.ok(!progress.some(p=>p.percent===100));assert.equal((await f.service.status()).running,false);assert.equal((await f.service.launch()).state,'confirmed');assert.equal(attempts,2);
});
test('path conversion and synchronous spawn failures release the real launch confirmation',async t=>{
 for(const cause of ['path','spawn']){
  let conversionAttempts=0,spawnAttempts=0,listener;
  const processes={snapshot:async()=>({ok:true,processes:[]}),speedUp(){},onSnapshot(callback){listener=callback;}};
  const confirmation=new LaunchConfirmation({stableMs:0,timeoutMs:1000,speedUp(){}});
  const f=await setup(t,{processes,confirmation,prepareAudio:async()=>{},asciiPath:async value=>{if(cause==='path'&&conversionAttempts++===0)throw Error('path fixture');return value;},spawn:()=>{
   if(cause==='spawn'&&spawnAttempts++===0)throw Error('spawn fixture');
   const child=new EventEmitter();child.pid=901;child.unref=()=>{};
   process.nextTick(()=>{child.emit('spawn');process.nextTick(()=>{const snapshot={ok:true,processes:[{image:'Titanfall.exe',pid:901}]};listener(snapshot);listener(snapshot);});});return child;
  }});
  await f.service.install();
  await assert.rejects(f.service.launch(),new RegExp(cause+' fixture'));
  assert.equal(confirmation.current,null);
  assert.equal((await f.service.status()).running,false);
  assert.equal((await f.service.launch()).state,'confirmed');
 }
});
test('confirmed launch returns PID and reports subsequent process exit',async t=>{
 let child;const f=await setup(t,{prepareAudio:async()=>{},asciiPath:async p=>p,spawn:()=>{child=new EventEmitter();child.pid=123;child.unref=()=>{};process.nextTick(()=>child.emit('spawn'));return child;}});await f.service.install();const progress=[],exits=[];const result=await f.service.launch(value=>progress.push(value),value=>exits.push(value));assert.equal(result.state,'confirmed');assert.equal(result.pid,123);assert.equal(progress.at(-1).percent,100);child.emit('exit',3221225781,null);assert.equal(exits[0].exitCode,3221225781);
});
test('service wires Titanfall 1 process snapshots through LaunchConfirmation',async t=>{
 const f=await setup(t);await f.service.install();let listener,child,reads=0;
 const processes={snapshot:async()=>{reads++;return {ok:true,processes:[]};},speedUp(){},onSnapshot(callback){listener=callback;return()=>{};}};
 const confirmation=new LaunchConfirmation({stableMs:0,timeoutMs:1000,refresh:async()=>({ok:true,processes:[]}),speedUp(){}});
 const service=createService({...f.options,processes,confirmation,prepareAudio:async()=>{},asciiPath:async p=>p,spawn:(_file,_args,opts)=>{
  assert.equal(opts.cwd,f.gamepath);child=new EventEmitter();child.pid=4312;child.unref=()=>{};
  process.nextTick(()=>{child.emit('spawn');process.nextTick(()=>listener({ok:true,processes:[{image:'Titanfall.exe',pid:4313,executablePath:path.join(f.coreBase,'3.0.5-'+f.release.sha1.slice(0,12),'Titanfall.exe')}]}));process.nextTick(()=>listener({ok:true,processes:[{image:'Titanfall.exe',pid:4313,executablePath:path.join(f.coreBase,'3.0.5-'+f.release.sha1.slice(0,12),'Titanfall.exe')}]}));});
  return child;
 }});
 const progress=[],result=await service.launch(value=>progress.push(value));
 assert.equal(reads,1);assert.equal(result.state,'confirmed');assert.equal(result.pid,4313);assert.equal(progress.at(-1).phase,'泰坦陨落 1 进程已确认');
 child.emit('exit',3221225781,null);
});
test('Steam dispatch uses only the Titanfall 1 run URI, never an install URI',async t=>{
 let uri='';const f=await setup(t,{shell:{openExternal:async value=>{uri=value;}}});assert.equal((await f.service.steam()).state,'requested');assert.equal(uri,'steam://rungameid/1454890');assert.equal(f.counts.release,0);
 const failed=createService({...f.options,shell:{openExternal:async()=>{throw Error('Steam missing');}}});await assert.rejects(failed.steam(),/Steam missing/);
});
test('official audio preparation skips absent CAMLIST and rejects a malformed one',async t=>{
 const f=await setup(t);let executions=0;const exec=async()=>{executions++;};await prepareAudio(f.gamepath,exec);assert.equal(executions,0);await write(f.gamepath,'vpk/cam_list.txt','bad header');await assert.rejects(prepareAudio(f.gamepath,exec),/音频清单/);
});
test('official compressed audio uses existing game installer and confirms decoded VPK',async t=>{
 const f=await setup(t);await write(f.gamepath,'vpk/cam_list.txt','CAMLIST\r\nfixture');const name=await write(f.gamepath,'vpk/client_mp_common.bsp.pak000_040.vpk','prefixOggSsuffix');await write(f.gamepath,'bin/x64/audio_installer.exe');let ran=false;await prepareAudio(f.gamepath,async(exe,args,options)=>{ran=true;assert.equal(exe,path.join(f.gamepath,'bin/x64/audio_installer.exe'));assert.equal(args[0],path.join(f.gamepath,'vpk/cam_list.txt'));assert.equal(options.cwd,f.gamepath);await fs.writeFile(name,'decoded fixture');});assert.equal(ran,true);assert.ok(await fs.readFile(path.join(f.gamepath,'vpk/audio_done.txt'),'utf8'));
});
test('Chinese game path uses stable verified ASCII junction and reuses it',async t=>{
 const f=await setup(t),unicode=path.join(f.root,'游戏 目录'),base=path.join(f.root,'links');await fs.mkdir(unicode);const ascii=await asciiPath(unicode,base);assert.match(ascii,/^[\x00-\x7f]+$/);assert.equal(await fs.realpath(ascii),await fs.realpath(unicode));assert.equal(await asciiPath(unicode,base),ascii);assert.equal(await asciiPath(f.gamepath,base),f.gamepath);
});
test('Steam secondary library discovery respects Titanfall 1 manifest ID',async t=>{
 const f=await setup(t),steam=path.join(f.root,'Steam'),library=path.join(f.root,'other-library'),target=path.join(library,'steamapps/common/Titanfall');await game(target);const quote=p=>JSON.stringify(p);await write(steam,'steamapps/libraryfolders.vdf','"libraryfolders" { "1" { "path" '+quote(library)+' } }');await write(library,'steamapps/appmanifest_1454890.acf','"AppState" { "appid" "1454890" "installdir" "Titanfall" }');const exec=async()=>({stdout:JSON.stringify({games:[],steam})});assert.equal(await detectGame(exec),target);await write(library,'steamapps/appmanifest_1454890.acf','"AppState" { "appid" "1237970" "installdir" "Titanfall" }');assert.equal(await detectGame(exec),'');
});
test('IPC exposes only five focused Titanfall 1 operations',()=>{
 const handlers=new Map(),processes={snapshot:async()=>({ok:true,processes:[]}),onSnapshot(){return()=>{};},speedUp(){}};register({app:{getPath:()=>os.tmpdir()},dialog:{},shell:{},ipcMain:{handle:(key,handler)=>handlers.set(key,handler)}},{processes,confirmation:{}});assert.deepEqual([...handlers.keys()].sort(),['r1delta-install','r1delta-launch','r1delta-launch-steam','r1delta-select','r1delta-status']);
});
