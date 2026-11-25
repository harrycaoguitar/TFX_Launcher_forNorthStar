'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const {Readable}=require('node:stream'),{EventEmitter}=require('node:events');
const {downloadSetup}=require('../src/modules/launcher-update-install');
function load(file,deps){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/modules',file),'utf8'),{module,URL,require:id=>Object.hasOwn(deps,id)?deps[id]:require(id)});
 return module.exports;
}
function fixture(t){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tfx-maintenance-test-'));
 t.after(()=>fs.rmSync(profile,{recursive:true,force:true}));
 const handles=new Map(),ipcMain={handle:(name,fn)=>handles.set(name,fn),on(){}};
 const electron={app:{getPath:()=>profile,on(){}},ipcMain};
 const calls=[],latest={tag_name:'v1.17.7',assets:[{name:'v1.17.7.zip',browser_download_url:'https://github.com/R2NorthstarCN/R2NorthstarCN_Launcher/releases/download/v1.17.7/v1.17.7.zip'}]};
 const releases=load('releases.js',{electron,'./requests':{get:async(host)=>{
  calls.push(host);if(f.offline)throw Error('offline');return JSON.stringify(latest);
 }},'../win':()=>({send(){}})});
 const f={profile,calls,version:'1.18',offline:false,installed:true,updates:0,call:(name,...args)=>handles.get(name)(null,...args)};
 load('update.js',{electron,'./settings':()=>({northstarRegion:'cn'}),'./releases':releases,
  './northstar-clients':{status:async()=>({ok:true,installed:f.installed,selectedVersion:f.version,version:'1.17.7'}),context:()=>({gameRoot:'test'}),
    ensure:async()=>({}),cache:{update:async()=>{f.updates++;return 'fixture';}}},
  './dds-operation-gate':{run:(_name,task)=>task()},'./is_running':{snapshot:async()=>({ok:true})},'./game-roots':{hasGame:()=>false},
  './northstar-region':{normalize:region=>region},'../win':()=>({send(){},log(){}}),'./console':{error(){}}});
 return f;
}
test('GitHub-only check reports 1.18 current, distinguishes update and never offers a downgrade',async t=>{
 const f=fixture(t);
 assert.equal((await f.call('northstar-update-check')).status,'up-to-date');
 assert.equal((await f.call('northstar-update-install',{region:'cn',version:'v1.17.7'})).status,'up-to-date');
 assert.equal(f.updates,0);
 f.version='1.17.6';
 assert.equal((await f.call('northstar-update-check')).status,'available');
 assert.equal((await f.call('northstar-update-install',{region:'cn',version:'v1.17.7'})).status,'updated');
 assert.equal(f.updates,1);
 f.version=null;
 assert.equal((await f.call('northstar-update-check')).status,'error');
 f.version='1.17.7';f.offline=true;
 assert.equal((await f.call('northstar-update-check')).status,'error');
 assert.ok(f.calls.every(host=>host==='api.github.com'));
 f.installed=false;
 assert.equal((await f.call('northstar-update-check')).status,'not-installed');
});
test('cache clear deletes only temporary downloads and returns real usage',async t=>{
 const f=fixture(t),cache=path.join(f.profile,'Temp');
 fs.mkdirSync(path.join(cache,'nested'),{recursive:true});
 fs.writeFileSync(path.join(cache,'nested','archive.zip'),'012345');
 fs.writeFileSync(path.join(f.profile,'backup.zip'),'keep');
 const result=await f.call('download-cache-clear');
 assert.equal(result.ok,true);assert.equal(result.files,1);assert.equal(result.bytes,6);
 assert.equal(fs.existsSync(path.join(cache,'nested','archive.zip')),false);
 assert.equal(fs.readFileSync(path.join(f.profile,'backup.zip'),'utf8'),'keep');
 assert.equal((await f.call('download-cache-clear')).files,0);
});
test('launcher setup download validates byte count, SHA-256 and executable header',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tfx-setup-test-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bytes=Buffer.from('MZ test fixture');
 const setup={url:'https://github.com/test-setup.exe',size:bytes.length,digest:crypto.createHash('sha256').update(bytes).digest('hex')};
 const transport={get(_url,_options,ready){
  const req=new EventEmitter();req.setTimeout=()=>{};req.destroy=()=>{};
  queueMicrotask(()=>{const res=Readable.from([bytes]);res.headers={'content-length':String(bytes.length)};res.statusCode=200;ready(res);});
  return req;
 }};
 const output=path.join(dir,'setup.exe');
 await downloadSetup(setup,output,{transport});
 assert.deepEqual(fs.readFileSync(output),bytes);
 await assert.rejects(downloadSetup({...setup,digest:'f'.repeat(64)},path.join(dir,'invalid.exe'),{transport}),/SHA-256/);
});
