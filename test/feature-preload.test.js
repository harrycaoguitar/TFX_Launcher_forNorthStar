'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function bridge(){
 const exposed={},calls=[],listeners=new Map(),file=path.join(__dirname,'../src/preload.js');
 const translate=Object.assign(k=>k,{getLocale:()=> 'en-US',defaultLocale:'en-US'});
 const electron={contextBridge:{exposeInMainWorld:(key,value)=>{exposed[key]=value;}},ipcRenderer:{invoke:async(channel,...args)=>{calls.push({channel,args});return{ok:true};},on:(channel,handler)=>listeners.set(channel,handler),send(){}},shell:{},webUtils:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:id=>id==='electron'?electron:id==='fs'?fs:id==='path'?path:id==='./lang'?translate:id==='./modules/json'?()=>({}):(()=>{throw Error(id);})(),process},{filename:file});
 return{api:exposed.ipcRenderer,calls,listeners};
}
test('isolated renderer can request package previews and review/export a diagnostic snapshot',async()=>{
 const f=bridge();
 for(const channel of ['dds-preview','vtf-preview','launch-diagnostic-get','launch-diagnostic-export'])assert.equal((await f.api.invoke(channel,{previewId:'reviewed-id'})).ok,true);
 assert.deepEqual(f.calls.map(x=>x.channel),['dds-preview','vtf-preview','launch-diagnostic-get','launch-diagnostic-export']);
 assert.equal(f.calls.at(-1).args[0].previewId,'reviewed-id');
 let received;f.api.on('launch-diagnostic',(_event,value)=>{received=value;});f.listeners.get('launch-diagnostic')({sender:'private main object'},{state:'failed'});assert.equal(received.state,'failed');
});
test('diagnostic bridge does not open unrestricted IPC or forward the Electron event object',async()=>{
 const f=bridge();await assert.rejects(f.api.invoke('diagnostic-read-file',{path:'C:/private.txt'}),/not allowed/);assert.equal(f.calls.length,0);
 let event;f.api.on('launch-diagnostic',(value)=>{event=value;});f.listeners.get('launch-diagnostic')({sender:'secret'},{state:'starting'});assert.equal(event.sender,undefined);
 f.api.on('arbitrary-channel',()=>{});assert.equal(f.listeners.has('arbitrary-channel'),false);
});

test('EA page can invoke diagnosis, clipboard report and log actions through the isolated bridge',async()=>{
 const f=bridge();
 for(const channel of ['ea-status','ea-refresh','ea-diagnostics','ea-diagnostics-repair','ea-diagnostics-copy','ea-diagnostics-open-log'])assert.equal((await f.api.invoke(channel)).ok,true);
 assert.equal((await f.api.invoke('ea-switch-account','saved-account')).ok,true);
 assert.equal(f.calls.at(-1).args[0],'saved-account');
 assert.equal(f.calls.length,7);
 await assert.rejects(f.api.invoke('clipboard-read'),/not allowed/);
});
test('Arsenal state restoration and safe maintenance reach main through the production bridge',async()=>{
 const f=bridge(),target={weaponId:'car',targetMode:'installed',recordId:'dds:12345678-1234-1234-1234-123456789abc'};
 for(const [channel,input]of [['weapon-library-list',{}],['weapon-library-restore',target],['weapon-library-prune',{}]])assert.equal((await f.api.invoke(channel,input)).ok,true);
 assert.deepEqual(f.calls.map(x=>x.channel),['weapon-library-list','weapon-library-restore','weapon-library-prune']);assert.equal(f.calls[1].args[0],target);
 await assert.rejects(f.api.invoke('weapon-library-remove-path',{path:'C:/private.txt'}),/not allowed/);assert.equal(f.calls.length,3);
 let event,payload;f.api.on('weapon-library-progress',(e,value)=>{event=e;payload=value;});const progress={weaponId:'car',targetMode:'installed',recordId:target.recordId,percent:35};f.listeners.get('weapon-library-progress')({sender:'private-main-object'},progress);assert.equal(event.sender,undefined);assert.equal(payload,progress);
});
