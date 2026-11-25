'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{EventEmitter}=require('events');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('local document begins loading before feature imports and startup IPC waits for all guards',async()=>{
 const order=[],app=new EventEmitter(),contents=new EventEmitter();let window;
 Object.assign(app,{name:'tfx',setPath(){},getPath(){return 'D:/fixture';},requestSingleInstanceLock(){return true;},commandLine:{appendSwitch(){}},whenReady(){return Promise.resolve();},quit(){}});
 Object.assign(contents,{session:{setUserAgent(){}},getUserAgent(){return 'fixture';},isDestroyed(){return false;},setWindowOpenHandler(){},send(){},openDevTools(){}});
 const features=['./modules/mods','./modules/update','./modules/version','./modules/launch','./modules/dds','./modules/vtf','./modules/skin-import','./modules/weapon-library','./modules/skin-switch','./modules/server-list','./modules/launcher-update'];
 class Window extends EventEmitter{constructor(){super();window=this;this.webContents=contents;order.push('window');}isDestroyed(){return false;}removeMenu(){}loadFile(){order.push('load-file');queueMicrotask(()=>{for(const feature of features)assert(order.includes(feature),'IPC reached unregistered feature '+feature);order.push('renderer-ipc');});}}
 const settings=()=>({uiLanguage:'en-US',gamepath:'D:/fixture/game'}),file=path.join(__dirname,'../src/index.js');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{__dirname:path.dirname(file),process:{argv:[],chdir(){},on(){}},setTimeout,require:id=>{
  if(id==='path')return path;if(id==='electron')return{app,BrowserWindow:Window,screen:{getPrimaryDisplay(){return{workAreaSize:{width:2000,height:1200}};}},ipcMain:{}};
  if(id==='fs')return{existsSync(){return false;}};if(id==='./modules/settings')return settings;if(id==='./locale')return{normalize:v=>v};if(id==='./lang')return{defaultLocale:'en-US'};if(id==='./modules/console')return{error(){}};if(id==='./modules/window-move')return()=>{};if(id==='./win')return{set(){}};if(id==='../package.json')return{version:'1.0.1'};
  order.push(id);if(id==='./modules/launcher-version')return()=> '1.1.1';if(id==='./modules/logger')return{install:()=>({write(){}})};if(id==='./modules/background-tray')return{configure(){}};if(id==='./modules/skin-switch')return{installEngines(){order.push('guards-installed');}};return{register(){}};
 }});await tick();assert(window);assert(order.indexOf('load-file')<order.indexOf('./modules/dds'));assert(order.indexOf('guards-installed')<order.indexOf('renderer-ipc'));assert.equal(contents.listenerCount('dom-ready'),1);
});

function regionFixture(){
 const listeners=new Map(),pending=[],calls=[],nodes=new Map(),settings={gamepath:'D:/fixture/a',nsargs:'-multiple',northstarRegion:'cn'};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,hidden:false,dataset:{},classList:{toggle(){}},setAttribute(){}});return nodes.get(id);};
 const scope={document:{getElementById:node,querySelectorAll(){return[];}},settings,gameDirectoryReady:true,is_running:false,launchPending:false,I18n:{current:'zh-CN',text:v=>v},setpath(){},Toast:class{},dismissToast(){},window:{I18n:{current:'zh-CN',text:v=>v},addEventListener(){}},ipcRenderer:{on(channel,callback){listeners.set(channel,callback);},invoke(channel,input){calls.push({channel,input,path:settings.gamepath});return new Promise(resolve=>pending.push(resolve));}}};
 scope.window.VyraLaunchAvailability=require('../src/app/js/launch-availability');scope.window.VyraGameProcesses={snapshot:{ok:true,processes:[]}};
 scope.globalGameDirectoryReady=false;scope.globalGameDirectorySelected=false;scope.chinaGameDirectorySelected=true;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/app/js/region-client.js'),'utf8'),scope);return{scope,settings,calls,pending,api:scope.window.VyraClient,emit:(channel,input)=>listeners.get(channel)?.({},input),node,resolve(version='1.0.1',properties={}){const resolve=pending.shift();assert(resolve);resolve({ok:true,region:'cn',installed:true,active:true,state:'ready',version,...properties});}};
}
test('startup path and bundled version events share one regional client check',async()=>{
 const f=regionFixture();await tick();f.emit('newpath',f.settings.gamepath);f.emit('gamepath-status',{valid:true});f.api.receiveVersion({client:{ok:true,region:'cn',installed:true,active:true,state:'ready',version:'1.0.1'},clientContext:{gamePath:f.settings.gamepath,nsargs:f.settings.nsargs,region:'cn'}});await tick();assert.equal(f.calls.length,1);f.resolve();await tick();assert.equal(f.api.state.status.version,'1.0.1');assert.equal(f.node('playNsBtn').dataset.clientAction,'launch');
});
test('repeated forced status requests create only one follow-up and retain fresh result',async()=>{
 const f=regionFixture();await tick();const results=[f.api.refresh('cn',true),f.api.refresh('cn',true),f.api.refresh('cn',true)];f.resolve('1.0.0');await tick();assert.equal(f.calls.length,2);f.resolve('1.0.1');await Promise.all(results);assert.equal(f.api.state.status.version,'1.0.1');assert.equal(f.calls.length,2);
});
test('a just-completed startup check is reused by the paired directory acceptance events',async()=>{
 const f=regionFixture();await tick();f.resolve('1.0.1');await tick();f.emit('newpath',f.settings.gamepath);f.emit('gamepath-status',{valid:true});await tick();assert.equal(f.calls.length,1);assert.equal(f.node('playNsBtn').dataset.clientAction,'launch');
});
test('changed game directory discards old in-flight status and checks the latest path once',async()=>{
 const f=regionFixture();await tick();f.settings.gamepath='D:/fixture/b';f.emit('newpath',f.settings.gamepath);f.emit('gamepath-status',{valid:true});f.resolve('old-client');await tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].path,'D:/fixture/b');assert.notEqual(f.api.state.status.version,'old-client');f.resolve('1.0.1');await tick();assert.equal(f.api.state.status.version,'1.0.1');assert.equal(f.node('playNsBtn').disabled,false);
});
test('late version metadata cannot invalidate the fresh missing-client result for a new directory',async()=>{
 for(const clientContext of [undefined,{gamePath:'D:/fixture/a',nsargs:'-multiple',region:'cn'},{gamePath:'D:/fixture/b',nsargs:'-profile Old',region:'cn'},{gamePath:'D:/fixture/b',nsargs:'-multiple',region:'global'}]){
  const f=regionFixture();await tick();f.settings.gamepath='D:/fixture/b';f.emit('newpath',f.settings.gamepath);f.resolve('OLD-A');await tick();assert.equal(f.calls.length,2);f.api.receiveVersion({client:{ok:true,region:'cn',installed:true,active:true,state:'ready',version:'STALE-A'},...(clientContext?{clientContext}:{})});f.resolve('missing',{installed:false,active:false,state:'missing'});await tick();assert.equal(f.api.state.status.installed,false);assert.equal(f.node('playNsBtn').dataset.clientAction,'install');assert.equal(f.calls.length,2);
 }
});
test('even matching-context version metadata leaves a direct current status request authoritative',async()=>{
 const f=regionFixture();await tick();f.api.receiveVersion({client:{ok:true,region:'cn',installed:true,active:true,state:'ready',version:'STALE'},clientContext:{gamePath:f.settings.gamepath,nsargs:f.settings.nsargs,region:'cn'}});f.resolve('missing',{installed:false,active:false,state:'missing'});await tick();assert.equal(f.api.state.status.installed,false);assert.equal(f.node('playNsBtn').dataset.clientAction,'install');assert.equal(f.calls.length,1);
});
