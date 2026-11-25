'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=path.join(__dirname,'../src/app');

function mainFixture() {
  const listeners=new Map(),calls=[];
  const scope={window:{addEventListener(){}},document:{querySelectorAll(){return[];},addEventListener(){},body:{addEventListener(){}}},navigator:{onLine:true},fold:{loadSettings(){return {data:{}};}},ipcRenderer:{on(name,callback){listeners.set(name,callback);},send(channel,...args){calls.push({channel,args});}},setlang(){},console};
  vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(app,'main.js'),'utf8'),scope);
  calls.length=0;return {scope,calls};
}
for(const name of ['exit','relaunch']) {
  test('user '+name+' honors the settings save/discard/stay callback before sending its request',()=>{
    const f=mainFixture();let continueAction,allowed=false;
    f.scope.window.Settings={canLeave(action){if(allowed)return true;continueAction=action;return false;}};
    f.scope[name]();assert.equal(f.calls.length,0);assert.equal(typeof continueAction,'function');
    // Staying leaves the request unsent; save/discard later invokes the same
    // action while the existing settings dialog enables its one-shot bypass.
    allowed=true;continueAction();assert.deepEqual(f.calls.map(item=>item.channel),[name]);
  });
  test('user '+name+' remains available before settings initialize and waits while they save',()=>{
    const f=mainFixture();f.scope[name]();assert.deepEqual(f.calls.map(item=>item.channel),[name]);f.calls.length=0;
    f.scope.window.Settings={canLeave(){return false;}};f.scope[name]();assert.equal(f.calls.length,0);
    f.scope.window.Settings.canLeave=()=>true;f.scope[name]();assert.deepEqual(f.calls.map(item=>item.channel),[name]);
  });
}

class Element {
  constructor(id='') {this.id=id;this.dataset={};this.attributes={};this.listeners=new Map();this.hidden=false;this.disabled=false;this.isConnected=true;this.style={setProperty(){}};const classes=new Set();this.classList={contains:key=>classes.has(key),add:(...keys)=>keys.forEach(key=>classes.add(key)),remove:(...keys)=>keys.forEach(key=>classes.delete(key)),toggle:(key,on)=>{if(on===undefined)on=!classes.has(key);on?classes.add(key):classes.delete(key);return on;}};}
  setAttribute(key,value){this.attributes[key]=String(value);}addEventListener(name,callback){this.listeners.set(name,callback);}append(){}after(){}querySelector(){return this.child||(this.child=new Element(this.id+'-child'));}querySelectorAll(){return [];}closest(){return null;}getClientRects(){return [1];}focus(){}scrollTo(){}
}
function homeFixture(server='official') {
  const nodes=new Map(),windowListeners=new Map(),eventListeners=new Map(),ipcListeners=new Map(),pages=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);};
  const buttons=['northstar','vanilla'].map(mode=>{const element=new Element();element.dataset.mode=mode;return element;});
  const doc={body:node('body'),activeElement:node('active'),hidden:false,getElementById:node,createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(){},querySelector(selector){return selector==='.popup.shown'?null:node(selector);},querySelectorAll(selector){return selector==='[data-mode]'?buttons:[];}};
  const window={Settings:null,addEventListener(name,callback){windowListeners.set(name,callback);},dispatchEvent(event){windowListeners.get(event.type)?.(event);},VyraMotion:{changePage(_old,_new,change){change();}}};
  window.VyraLaunchAvailability=require('../src/app/js/launch-availability');
  const Settings={saving:false,toggle(){},canLeave(){return !Settings.saving&&!node('options').classList.contains('shown');},savePatch:async patch=>{Object.assign(scope.settings,patch);return {ok:true,settings:{...scope.settings}};}};window.Settings=Settings;
  const scope={window,document:doc,Settings,settings:{gamepath:'D:/game',modProfileServer:server,northstarRegion:server==='global'?'global':'cn'},page:index=>pages.push(index),launchPending:false,is_running:false,ipcRenderer:{on(name,callback){if(!ipcListeners.has(name))ipcListeners.set(name,[]);ipcListeners.get(name).push(callback);}},popups:{set_all(){}},events:{on(name,callback){if(!eventListeners.has(name))eventListeners.set(name,[]);eventListeners.get(name).push(callback);}},setInterval(){return 1;},clearInterval(){},requestAnimationFrame(){},queueMicrotask,CustomEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},Intl,Date,console};
  vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(app,'js/neo.js'),'utf8'),scope);
  return {scope,window,Settings,node,buttons,pages,emitWindow:name=>windowListeners.get(name)?.(),emitIPC:(name,value)=>{for(const listener of ipcListeners.get(name)||[])listener({},value);},closeSettings(){node('options').classList.remove('shown');for(const listener of eventListeners.get('popup-changed')||[])listener({popup:node('options'),new_state:false});}};
}
test('restoring defaults keeps Preferences open and reconciles official home with Northstar when closed',async()=>{
  const f=homeFixture();await Promise.resolve();assert.equal(f.pages.at(-1),2);f.node('options').classList.add('shown');f.Settings.saving=true;
  f.scope.settings.modProfileServer='cn';f.emitIPC('changed-settings',{modProfileServer:'cn'});f.emitWindow('vyra-settings-restored');
  assert.equal(f.window.Fold.mode,'northstar');assert.equal(f.pages.at(-1),2);assert.equal(f.node('options').classList.contains('shown'),true);
  f.Settings.saving=false;f.closeSettings();await Promise.resolve();assert.equal(f.pages.at(-1),1);assert.equal(f.buttons[0].attributes['aria-pressed'],'true');
});
test('an official context committed while saving reaches the official home after closing Preferences',async()=>{
  const f=homeFixture('global');await Promise.resolve();assert.equal(f.pages.at(-1),1);f.node('options').classList.add('shown');f.Settings.saving=true;
  f.scope.settings.modProfileServer='official';f.emitIPC('changed-settings',{modProfileServer:'official'});f.emitWindow('tfx-settings-persisted');
  assert.equal(f.window.Fold.mode,'vanilla');assert.equal(f.pages.at(-1),1);f.Settings.saving=false;f.closeSettings();await Promise.resolve();
  assert.equal(f.pages.at(-1),2);assert.equal(f.buttons[1].attributes['aria-pressed'],'true');
});
test('closing Preferences to visit another page does not force an intermediate home transition',async()=>{
  const f=homeFixture();f.node('options').classList.add('shown');f.Settings.saving=true;f.scope.settings.modProfileServer='cn';f.emitIPC('changed-settings',{modProfileServer:'cn'});
  f.Settings.saving=false;f.closeSettings();f.window.Fold.navigate('servers');const transitions=f.pages.length;await Promise.resolve();
  assert.equal(f.window.Fold.view,'servers');assert.equal(f.pages.length,transitions);
});
