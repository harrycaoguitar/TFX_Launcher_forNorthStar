'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/modules/ea-account.js'),'utf8');
const makeAccount=(name,expiresAt=Date.now()+3600000)=>({
  playerName:name,userId:name,personaId:'persona-'+name,accessToken:'token-'+name,
  refreshToken:'refresh-'+name,remid:'cookie-'+name,expiresAt
});

function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tfx-ea-accounts-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const handlers=new Map(),windows=[],partitions=[];
  let locked=false,encrypt=true,refresh=async token=>({accessToken:token+'-new',refreshToken:token,expiresIn:3600});
  let exchange=async({code})=>({accessToken:code,refreshToken:'refresh-'+code,expiresIn:3600});
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.setUserAgent=()=>{};this.webContents.setWindowOpenHandler=()=>{};windows.push(this);}
    close(){this.closed=true;this.emit('closed');}
    isDestroyed(){return this.closed;}
    setTitle(){}
    async loadURL(url){this.url=url;}
  }
  const webSession={cookies:{get:async()=>[{domain:'.ea.com',name:'remid',value:'cookie'},{domain:'.ea.com',name:'sid',value:'session'}]},
    protocol:{handle(){},unhandle(){}},webRequest:{onBeforeRequest(){}},clearStorageData:async()=>{}};
  const electron={
    BrowserWindow:Window,app:{getPath:()=>dir},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},
    session:{fromPartition:name=>{partitions.push(name);return webSession;}},
    safeStorage:{isEncryptionAvailable:()=>encrypt,encryptString:value=>Buffer.from(value).reverse(),decryptString:bytes=>Buffer.from(bytes).reverse().toString()},
  };
  function load(){
    const module={exports:{}};
    const dependencies={
      electron,'child_process':{execFile:(_file,_args,_options,cb)=>cb(null,'{}')},
      './ea-api':{CLIENT_ID:'fixture',refreshToken:(...args)=>refresh(...args),exchangeCode:(...args)=>exchange(...args),
        identity:async token=>({userId:token,playerName:token,personaId:'persona-'+token}),avatar:async()=>null},
      './ea-crypto':{createPcSign:()=>'<fixture>'},
      './ea-emulator':{isActive:()=>locked},'./launch':{isLaunching:()=>false},'../win':()=>null,
    };
    vm.runInNewContext(source,{module,exports:module.exports,require:id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(id),
      Buffer,URL,URLSearchParams,Response,setTimeout,clearTimeout});
    module.exports.register();
    return module.exports;
  }
  const api=load(),call=(name,...args)=>handlers.get(name)(null,...args);
  return {api,call,load,windows,partitions,store:api.storePath(),locked:value=>{locked=value;},encrypt:value=>{encrypt=value;},
    refresh:fn=>{refresh=fn;},exchange:fn=>{exchange=fn;}};
}

async function openLogin(f,options={}){
  const previous=f.windows.length;
  const task=f.call('ea-login',options);
  for(let i=0;i<25&&f.windows.length===previous;i++)await new Promise(setImmediate);
  assert.equal(f.windows.length,previous+1);
  return {window:f.windows.at(-1),task};
}
function complete(window,id){
  window.webContents.emit('will-navigate',{preventDefault(){}},'qrc:/html/login_successful.html?code='+id);
}

test('original account migrates once, switching survives restart, and logout only removes the current account',async t=>{
  const f=fixture(t);
  fs.writeFileSync(f.store,JSON.stringify({version:1,account:makeAccount('One')}));
  const original=await f.call('ea-status');
  assert.equal(original.playerName,'One');
  assert.equal(original.accounts.length,1);
  const migrated=JSON.parse(fs.readFileSync(f.store,'utf8'));
  assert.equal(migrated.version,2);
  assert.deepEqual(Object.keys(migrated),['version','encrypted']);
  f.api.writeStore(makeAccount('Two'),{activate:true});
  const next=await f.call('ea-status');
  assert.equal(next.playerName,'Two');
  for(const secret of ['accessToken','refreshToken','remid','token-One','cookie-Two']) assert.ok(!JSON.stringify(next).includes(secret));
  assert.equal((await f.call('ea-switch-account',original.accountId)).ok,true);
  const restarted=f.load();
  assert.equal((await restarted.launchProfile()).userId,'One');
  assert.equal((await f.call('ea-logout')).status.playerName,'Two');
  assert.equal((await f.call('ea-status')).accounts.length,1);
  assert.equal((await f.call('ea-switch-account',original.accountId)).code,'EA_ACCOUNT_NOT_FOUND');
});

test('adding uses a separate EA sign-in session, deduplicates an identity and never commits a cancelled login',async t=>{
  const f=fixture(t);
  f.api.writeStore(makeAccount('One'));
  const original=await f.call('ea-status');
  const second=await openLogin(f);
  assert.notEqual(second.window.options.webPreferences.partition,f.api.SESSION_PARTITION);
  assert.ok(!second.window.options.webPreferences.partition.startsWith('persist:'));
  assert.equal((await f.call('ea-switch-account',original.accountId)).code,'EA_ACCOUNT_BUSY');
  complete(second.window,'Two');
  const secondResult=await second.task;
  assert.equal(secondResult.status.playerName,'Two');
  const duplicate=await openLogin(f);
  assert.notEqual(duplicate.window.options.webPreferences.partition,second.window.options.webPreferences.partition);
  complete(duplicate.window,'Two');
  assert.equal((await duplicate.task).status.accountId,secondResult.status.accountId);
  assert.equal((await f.call('ea-status')).accounts.length,2);
  let finishExchange;
  f.exchange(()=>new Promise(resolve=>{finishExchange=resolve;}));
  const pending=await openLogin(f);
  complete(pending.window,'Three');
  for(let i=0;i<25&&!finishExchange;i++)await new Promise(setImmediate);
  assert.ok(finishExchange);
  pending.window.close();
  assert.equal((await pending.task).code,'EA_LOGIN_CANCELLED');
  finishExchange({accessToken:'Three',expiresIn:3600});
  await new Promise(setImmediate);
  const unchanged=await f.call('ea-status');
  assert.equal(unchanged.accounts.length,2);
  assert.equal(unchanged.accountId,secondResult.status.accountId);
});

test('expired sessions stay addressable, reconnect cannot replace them with a different identity, and live game blocks changes',async t=>{
  const f=fixture(t);
  const one=f.api.writeStore(makeAccount('One',Date.now()-1));
  const two=f.api.writeStore(makeAccount('Two'),{activate:true});
  const switched=await f.call('ea-switch-account',one.id);
  assert.equal(switched.status.expired,true);
  const login=await openLogin(f,{accountId:one.id});
  complete(login.window,'Two');
  assert.equal((await login.task).code,'EA_ACCOUNT_MISMATCH');
  assert.equal((await f.call('ea-status')).accountId,one.id);
  const reconnect=await openLogin(f,{accountId:one.id});
  complete(reconnect.window,'One');
  assert.equal((await reconnect.task).status.accountId,one.id);
  assert.equal((await f.call('ea-status')).expired,false);
  f.locked(true);
  assert.equal((await f.call('ea-switch-account',two.id)).code,'EA_SERVICE_ACTIVE');
  assert.equal((await f.call('ea-logout')).code,'EA_SERVICE_ACTIVE');
  assert.equal((await f.call('ea-login')).code,'EA_SERVICE_ACTIVE');
  assert.equal((await f.call('ea-status')).accountId,one.id);
});

test('failed encryption preserves the original file; transient refresh failure leaves the selected account intact',async t=>{
  const f=fixture(t);
  const original=JSON.stringify({version:1,account:makeAccount('One',Date.now()-1)});
  fs.writeFileSync(f.store,original);
  f.encrypt(false);
  assert.equal((await f.call('ea-status')).code,'EA_STORAGE_UNAVAILABLE');
  assert.equal(fs.readFileSync(f.store,'utf8'),original);
  f.encrypt(true);
  assert.equal((await f.call('ea-status')).accounts.length,1);
  f.refresh(async()=>{throw Object.assign(Error('temporary failure'),{code:'TIMEOUT'});});
  assert.equal((await f.call('ea-refresh')).code,'TIMEOUT');
  assert.equal(f.api.readStore().refreshToken,'refresh-One');
});
