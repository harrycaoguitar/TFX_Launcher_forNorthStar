'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),script=fs.readFileSync(path.join(root,'src/app/js/official-client.js'),'utf8');
class Element {
  constructor(id='',dataset={}) { this.id=id;this.dataset=dataset;this.attributes={};this.disabled=false;this.hidden=false;this.textContent='';this.style={};this.events=new Map();const classes=new Set();this.classList={toggle:(key,on)=>on?classes.add(key):classes.delete(key),contains:key=>classes.has(key)}; }
  setAttribute(key,value) { this.attributes[key]=String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(key,value) { this.events.set(key,value); }
  querySelector() { return this.track; }
}
function fixture(options={}) {
  const ids=Object.fromEntries(['playTfBtn','officialClientState','officialClientProgress','officialClientProgressLabel','officialClientProgressValue','officialClientProgressBar'].map(id=>[id,new Element(id)]));
  ids.officialClientProgress.track=new Element();
  const choices=[new Element('',{vanillaMods:'false'}),new Element('',{vanillaMods:'true'})],mode=new Element('',{mode:'northstar'}),northstarPlay=new Element('playNsBtn');
  const listeners=new Map(),windowEvents=new Map(),calls=[],toasts=[],win={addEventListener:(name,fn)=>windowEvents.set(name,fn),dispatchEvent(){},VyraClient:{busy:false,renderAction(){}},VyraLocales:{messages:{}}};
  win.VyraLaunchAvailability=require('../src/app/js/launch-availability');
  win.VyraGameProcesses={snapshot:{ok:true,processes:[]}};
  const document={getElementById:id=>ids[id],querySelectorAll:selector=>selector==='[data-vanilla-mods]'?choices:selector==='[data-mode]'?[mode]:selector.startsWith('[data-toast-key')?[]:[...choices,mode,northstarPlay,ids.playTfBtn]};
  const context={window:win,document,settings:{gamepath:'D:/game',vanillaModsEnabled:false,modProfileServer:'official',...options.settings},gameDirectoryReady:true,is_running:false,launchPending:false,ipcRenderer:{on:(name,fn)=>listeners.set(name,fn),invoke:async(channel,input)=>{calls.push({channel,input});return options.respond?options.respond(channel,input):{installed:false,state:'missing'};}},I18n:{t:(key,args={})=>key+(args.version?' '+args.version:''),text:value=>value},lang:key=>key==='gui.launch'?'Play':'Running',dismissToast(){},Toast:class{constructor(value){toasts.push(value);}},CustomEvent:class{},setpath(){calls.push({channel:'setpath'});}};
  const settingsApi={saving:false,modStateError:(_code,fallback)=>fallback,savePatch:async patch=>{calls.push({channel:'settings-save',input:patch});context.settings={...context.settings,...patch};return {ok:true,settings:context.settings};}};
  context.Settings=settingsApi;win.Settings=settingsApi;
  vm.createContext(context);vm.runInContext(script,context,{filename:'official-client.js'});
  return {context,ids,choices,mode,northstarPlay,listeners,windowEvents,calls,toasts,api:win.OfficialClient};
}
const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
test('official clean mode launches without checking or installing Vanilla+ and discloses shared skin resources',()=>{
  const f=fixture();let launched=0;f.api.activate(()=>launched++);
  assert.equal(launched,1);assert.equal(f.calls.length,0);assert.equal(f.choices[0].attributes['aria-pressed'],'true');assert.equal(f.ids.officialClientState.textContent,'official.cleanHint');
});
test('with-Mod choice persists the official context and launches after verified installation',async()=>{
  let installed=false;
  const f=fixture({respond:async channel=>channel==='vanilla-client-install'?(installed=true,{ok:true,status:{installed:true,version:'2.5.1'}}):{installed,version:installed?'2.5.1':undefined,state:installed?'installed':'missing'}});
  await f.api.choose(true);await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])),{channel:'settings-save',input:{vanillaModsEnabled:true,modProfileServer:'official'}});
  assert.equal(f.ids.playTfBtn.textContent,'official.install');let launched=0;f.api.activate(()=>launched++);await flush();
  assert.equal(launched,1);assert.ok(f.calls.some(call=>call.channel==='vanilla-client-install'));assert.equal(f.ids.playTfBtn.textContent,'Play');assert.equal(f.toasts.at(-1).title,'official.complete');
});
test('failed mode preference keeps original selection and does not install anything',async()=>{
  const f=fixture();f.context.Settings.savePatch=async()=>({ok:false,code:'GAME_RUNNING'});
  await f.api.choose(true);await flush();
  assert.equal(f.context.settings.vanillaModsEnabled,false);assert.equal(f.choices[0].attributes['aria-pressed'],'true');assert.equal(f.toasts.at(-1).title,'official.saveFailed');assert.equal(f.calls.length,0);
});
test('installation locks all launch options and has determinate or indeterminate accessible progress',async()=>{
  let finishInstall;
  const f=fixture({settings:{vanillaModsEnabled:true},respond:channel=>channel==='vanilla-client-install'?new Promise(resolve=>{finishInstall=resolve;}):Promise.resolve({installed:false,state:'missing'})});
  await flush();f.api.activate(()=>assert.fail('must not launch'));await flush();
  assert.equal(f.api.busy,true);assert.equal(f.mode.disabled,true);assert.equal(f.northstarPlay.disabled,true);assert.equal(f.ids.officialClientProgress.hidden,false);assert.equal(f.ids.officialClientState.hidden,true);assert.equal(f.ids.officialClientProgress.classList.contains('indeterminate'),true);
  f.listeners.get('vanilla-client-progress')({}, {phase:'installing',percent:63});
  assert.equal(f.ids.officialClientProgressValue.textContent,'63%');assert.equal(f.ids.officialClientProgress.track.attributes['aria-valuenow'],'63');assert.equal(f.ids.officialClientProgressBar.style.width,'63%');
  finishInstall({ok:false,error:'Download failed'});await flush();
  assert.equal(f.api.busy,false);assert.equal(f.mode.disabled,false);assert.equal(f.northstarPlay.disabled,false);assert.equal(f.ids.officialClientProgress.hidden,true);assert.equal(f.ids.officialClientState.hidden,false);assert.equal(f.toasts.at(-1).scheme,'error');assert.equal(f.ids.playTfBtn.textContent,'official.install');
});
test('a status reply from another game folder cannot make the current folder launchable',async()=>{
  const resolutions=[];const f=fixture({settings:{vanillaModsEnabled:true},respond:()=>new Promise(resolve=>resolutions.push(resolve))});
  await flush();f.context.settings.gamepath='D:/other-game';f.listeners.get('gamepath-status')({}, {valid:true});
  resolutions[0]({installed:true,version:'old'});await flush();
  assert.equal(f.api.state.status,null);assert.equal(f.api.state.loading,true);
  resolutions[1]({installed:false,state:'missing'});await flush();
  assert.equal(f.ids.playTfBtn.textContent,'official.install');assert.doesNotMatch(f.ids.officialClientState.textContent,/old/);
});
test('changing the selected Mod profile discards old in-flight status and checks the new profile',async()=>{
  const resolutions=[];const f=fixture({settings:{vanillaModsEnabled:true,nsargs:'-profile Original'},respond:()=>new Promise(resolve=>resolutions.push(resolve))});
  await flush();f.context.settings.nsargs='-profile New';f.listeners.get('changed-settings')({}, {nsargs:f.context.settings.nsargs});
  resolutions[0]({installed:true,version:'old-profile'});await flush();
  assert.equal(f.api.state.status,null);assert.equal(f.api.state.loading,true);assert.equal(f.ids.playTfBtn.disabled,true);
  resolutions[1]({installed:false,state:'missing'});await flush();
  assert.equal(f.ids.playTfBtn.textContent,'official.install');let launched=0;f.api.activate(()=>launched++);assert.equal(launched,0);
});
test('a normal settings-save acknowledgement invalidates profile status even without changed-settings IPC',async()=>{
  let installed=true;
  const f=fixture({settings:{vanillaModsEnabled:true,nsargs:'-profile Original'},respond:async()=>({installed,state:installed?'installed':'missing'})});
  await flush();assert.equal(f.ids.playTfBtn.textContent,'Play');
  f.context.Settings.saving=true;f.windowEvents.get('tfx-settings-saving-changed')();
  installed=false;f.context.settings.nsargs='-profile New';f.context.Settings.saving=false;f.windowEvents.get('tfx-settings-saving-changed')();
  assert.equal(f.api.state.status,null);assert.equal(f.ids.playTfBtn.disabled,true);await flush();
  assert.equal(f.ids.playTfBtn.textContent,'official.install');assert.equal(f.calls.filter(call=>call.channel==='vanilla-client-status').length,2);
  f.windowEvents.get('tfx-settings-saving-changed')();await flush();assert.equal(f.calls.filter(call=>call.channel==='vanilla-client-status').length,2);
});
test('damaged Vanilla+ is repaired; a game or a pending launch blocks changing modes',async()=>{
  let repaired=false;const f=fixture({settings:{vanillaModsEnabled:true},respond:async(channel,input)=>channel==='vanilla-client-install'?(repaired=input.repair,{ok:false,error:'repair failure'}):{installed:true,state:'damaged'}});
  await flush();assert.equal(f.ids.playTfBtn.textContent,'official.repair');f.api.activate(()=>assert.fail('must not launch damaged'));await flush();assert.equal(repaired,true);
  f.context.window.VyraGameProcesses.snapshot.processes=[{image:'Titanfall2.exe',executablePath:'D:/game/Titanfall2.exe'}];await f.api.choose(false);assert.equal(f.api.state.enabled,true);
  f.context.window.VyraGameProcesses.snapshot.processes=[];f.context.launchPending=true;await f.api.choose(false);assert.equal(f.api.state.enabled,true);
});
test('official selectors use the app control family and all new copy has five-language coverage',()=>{
  const html=fs.readFileSync(path.join(root,'src/app/index.html'),'utf8');
  assert.match(html,/class="servers-region"[^>]*role="group"[^>]*official\.aria/);assert.match(html,/data-vanilla-mods="false"/);assert.match(html,/data-vanilla-mods="true"/);assert.doesNotMatch(html,/<select[^>]*(?:vanilla|official)/i);
  const context={window:{VyraLocales:{messages:{}}}};vm.runInNewContext(fs.readFileSync(path.join(root,'src/app/js/feature-copy.js'),'utf8'),context);
  for(const[key,pair]of Object.entries(context.window.VyraLocales.messages).filter(([key])=>key.startsWith('official.'))){
    assert.ok(pair[0]&&pair[1],key);for(const locale of ['zh-TW','de-DE','fr-FR'])assert.ok(JSON.parse(fs.readFileSync(path.join(root,'src/lang/ui-'+locale+'.json'),'utf8')).strings[pair[1]],key+' '+locale);
  }
});
