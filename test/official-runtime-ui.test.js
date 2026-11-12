'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/app/js/official-client.js'),'utf8');
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(status, answer={ok:false,canceled:true,status}) {
  const nodes=new Map(),calls=[],toasts=[],listeners=new Map();
  function node(id='') {if(nodes.has(id))return nodes.get(id);const value={dataset:{},style:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(){},querySelector(){return node('track');},disabled:false,hidden:false,textContent:''};nodes.set(id,value);return value;}
  const choices=[{...node('choice0'),dataset:{vanillaMods:'false'}},{...node('choice1'),dataset:{vanillaMods:'true'}}];
  const window={addEventListener(){},VyraClient:{busy:false,renderAction(){}},VyraLaunchAvailability:{rootOccupied:()=>false,canLaunch:()=>true,controlAvailability:({blocked})=>({canStart:!blocked,canSelect:!blocked})}};
  const scope={window,document:{getElementById:node,querySelectorAll:selector=>selector==='[data-vanilla-mods]'?choices:[]},settings:{gamepath:'D:/game',vanillaModsEnabled:true,northstarRegion:'cn'},gameDirectoryReady:true,launchPending:false,ipcRenderer:{on:(key,fn)=>listeners.set(key,fn),invoke:async(channel,input)=>{calls.push({channel,input});return channel==='vanilla-client-status'?status:answer;}},I18n:{t:key=>key,text:text=>text},lang:()=> 'Play',dismissToast(){},Toast:class{constructor(value){toasts.push(value);}}};
  vm.runInNewContext(source,scope);
  return {api:window.OfficialClient,nodes,calls,toasts,listeners};
}
for (const [runtimeState,action] of [['missing','installRuntime'],['cn','replaceRuntime'],['damaged','repairRuntime'],['outdated','repairRuntime']]) test('runtime '+runtimeState+' offers '+action+' instead of Vanilla+ repair',async()=>{
  const f=fixture({installed:false,runtimeState,state:runtimeState==='damaged'||runtimeState==='outdated'?'damaged':'missing',error:'runtime '+runtimeState});await settle();assert.equal(f.nodes.get('playTfBtn').textContent,'official.'+action);assert.equal(f.nodes.get('officialClientState').textContent,'runtime '+runtimeState);
});
test('canceling replacement keeps the runtime action, shows no error and never starts the game',async()=>{
  const f=fixture({installed:false,runtimeState:'cn',state:'missing',code:'VANILLA_RUNTIME_CN',error:'CN needs replacement'});await settle();let started=0;f.api.activate(()=>started++);await settle();assert.equal(started,0);assert.equal(f.calls.filter(c=>c.channel==='vanilla-client-install').length,1);assert.equal(f.toasts.length,0);assert.equal(f.api.busy,false);assert.equal(f.nodes.get('playTfBtn').textContent,'official.replaceRuntime');
});
test('an existing global framework keeps the Vanilla+ component repair action',async()=>{
  const f=fixture({installed:false,runtimeState:'global',state:'damaged',componentState:'damaged'});await settle();assert.equal(f.nodes.get('playTfBtn').textContent,'official.repair');
});
test('new confirmation and runtime action text exists in all five languages',()=>{
  const root=path.join(__dirname,'../src');const zh=JSON.parse(fs.readFileSync(path.join(root,'lang/zh.json'))),en=JSON.parse(fs.readFileSync(path.join(root,'lang/en.json')));
  for(const key of ['replaceTitle','replaceMessage','replaceDetail','replaceConfirm','cancel']) {
    assert.ok(zh.official_runtime[key]);assert.ok(en.official_runtime[key]);
    for(const locale of ['zh-TW','de-DE','fr-FR'])assert.ok(JSON.parse(fs.readFileSync(path.join(root,'lang/ui-'+locale+'.json'))).strings[en.official_runtime[key]]);
  }
});
