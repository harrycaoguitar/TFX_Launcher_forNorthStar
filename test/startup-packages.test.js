'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
test('normal application startup registers community download and cancellation before renderer IPC',async()=>{
 const app=new EventEmitter(),ipcMain=new EventEmitter(),loaded=[];
 Object.assign(app,{name:'TFX',getPath:()=>path.dirname(__filename),setPath(){},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),commandLine:{appendSwitch(){}},quit(){}});
 class Window extends EventEmitter{constructor(){super();this.webContents=new EventEmitter();Object.assign(this.webContents,{session:{setUserAgent(){}},getUserAgent:()=>'',setWindowOpenHandler(){},send(){}});}loadFile(){}removeMenu(){}show(){}}
 const conf={uiLanguage:'en-US',gamepath:'fixture'},lang=Object.assign(()=>'',{defaultLocale:'en-US'}),electron={app,ipcMain,BrowserWindow:Window,screen:{getPrimaryDisplay:()=>({workAreaSize:{width:1920,height:1080}})}};
 const modules={electron,path,fs,'./modules/settings':()=>conf,'./locale':{normalize:()=> 'en-US'},'./lang':lang,'./win':{set(){}},'./modules/window-move':()=>{},'./modules/console':{},'../package.json':{version:'1.0.2'},'./modules/skin-import':{register(){ipcMain.emit('fixture-skin-import-registered');}},'./modules/weapon-library':{register(){ipcMain.emit('fixture-weapon-library-registered');}},'./modules/skin-switch':{installEngines(){}},'./modules/server-list':{register(){}},'./modules/launcher-update':{register(){}}};
 const requireFixture=name=>{loaded.push(name);if(name==='./modules/packages'){ipcMain.on('install-from-url',()=>{});ipcMain.on('cancel-download',()=>{});return{};}if(name==='./modules/launcher-version')return()=> '1.1.1';if(name==='./modules/logger')return{install:()=>({write(){}})};if(name==='./modules/background-tray')return{configure(){}};return modules[name]||{register(){}};};
 const file=path.join(__dirname,'../src/index.js'),code=fs.readFileSync(file,'utf8');
 vm.runInNewContext(code,{require:requireFixture,__dirname:path.dirname(file),process:{argv:[],chdir(){},on(){}},console,setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(loaded.filter(name=>name==='./modules/packages').length,1);
 assert.equal(loaded.filter(name=>name==='./modules/skin-import').length,1);
 assert.equal(loaded.filter(name=>name==='./modules/weapon-library').length,1);
 assert.equal(ipcMain.listenerCount('install-from-url'),1);assert.equal(ipcMain.listenerCount('cancel-download'),1);
});
