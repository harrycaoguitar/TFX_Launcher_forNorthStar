"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),os=require("os"),vm=require("vm"),{createRequire}=require("module"),{EventEmitter}=require("events"),zlib=require("zlib");
const Module=require("node:module"),originalLoad=Module._load;Module._load=function(request,parent,isMain){if(request==="electron")return{app:{getVersion:()=>"1.0.7"}};return originalLoad.call(this,request,parent,isMain);};
const preferences=require("../src/preferences"),server=require("../src/modules/server-list"),updater=require("../src/modules/launcher-update");
Module._load=originalLoad;

test("malformed saved preferences normalize without breaking Settings controls",()=>{
  for(const raw of [null,[],"bad",{gamepath:42,theme:{},uiLanguage:[],modSort:"bad",excludes:null,nsargs:{},originkill:"false",nsupdate:"false"}]){
    const value=preferences.normalize(raw,"zh-TW");assert.equal(value.gamepath,"");assert.equal(value.uiLanguage,"zh-TW");assert.equal(value.nsargs,"-multiple");assert.deepEqual(value.excludes,["ns_startup_args.txt","ns_startup_args_dedi.txt"]);assert.equal(value.originkill,false);
  }
  const custom=preferences.normalize({excludes:[],nsargs:"",uiLanguage:"de-AT",nsupdate:false,customPath:"D:/Mine"});assert.equal(custom.uiLanguage,"de-DE");assert.equal(custom.nsupdate,false);assert.deepEqual(custom.excludes,[]);assert.equal(custom.nsargs,"");assert.equal(custom.customPath,"D:/Mine");
});

function settingsFixture(initial={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"tfx-settings-release-")),file=path.join(dir,"fold.json");fs.writeFileSync(file,JSON.stringify(initial));
  const handles=new Map(),listeners=new Map(),messages=[],real=path.join(__dirname,"../src/modules/settings.js"),local=createRequire(real);let fail=false;
  const wrapped={...fs,existsSync:f=>fs.existsSync(path.isAbsolute(f)?f:path.join(dir,f)),renameSync:(...args)=>{if(fail)throw Error("Simulated disk failure");return fs.renameSync(...args);}};
  const lang=key=>key;Object.assign(lang,{defaultLocale:"en-US",normalize:value=>require("../src/locale").normalize(value),setLocale:()=>{}});
  const context={module:{exports:{}},require:id=>id==="electron"?{app:{getPath:()=>dir},ipcMain:{handle:(n,fn)=>handles.set(n,fn),on:(n,fn)=>listeners.set(n,fn)}}:id==="fs"?wrapped:id==="./json"?()=>initial:id==="../lang"?lang:id==="../win"?()=>({send:(...args)=>messages.push(args)}):local(id)};
  vm.runInNewContext(fs.readFileSync(real,"utf8"),context,{filename:real});return {dir,file,handles,listeners,messages,settings:context.module.exports,setFail:value=>fail=value,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test("settings-save reports disk failure and preserves memory, disk and retry capability",async()=>{
  const fixture=settingsFixture({theme:"aurora",uiLanguage:"en-US",excludes:[]});try{
    const before=fs.readFileSync(fixture.file),save=fixture.handles.get("settings-save");fixture.setFail(true);assert.equal((await save({}, {theme:"mist"})).ok,false);assert.equal(fixture.settings().theme,"aurora");assert.deepEqual(fs.readFileSync(fixture.file),before);assert.deepEqual(fs.readdirSync(fixture.dir),["fold.json"]);
    fixture.setFail(false);const result=await save({}, {theme:"mist",uiLanguage:"fr-FR"});assert.equal(result.ok,true);assert.equal(fixture.settings().theme,"mist");assert.equal(JSON.parse(fs.readFileSync(fixture.file)).uiLanguage,"fr-FR");assert.deepEqual(fs.readdirSync(fixture.dir),["fold.json"]);
  }finally{fixture.close();}
});
test("legacy immediate preference save reports errors and restores renderer state",async()=>{
  const fixture=settingsFixture({theme:"aurora",uiLanguage:"en-US"});try{fixture.setFail(true);await fixture.listeners.get("save-settings")({}, {theme:"mist"});assert.equal(fixture.settings().theme,"aurora");assert.equal(fixture.messages[0][0],"changed-settings");assert.equal(fixture.messages[0][1].theme,"aurora");assert.equal(fixture.messages[1][0],"unknown-error");}finally{fixture.close();}
});
test("a second instance quits before settings, game and installer modules initialize",()=>{
  const file=path.join(__dirname,"../src/index.js"),calls=[],app={name:"tfx-launcher",setPath:()=>{},getPath:()=>"D:/tfx-test",requestSingleInstanceLock:()=>false,quit:()=>calls.push("quit")};
  vm.runInNewContext(fs.readFileSync(file,"utf8"),{require:id=>{if(id==="path")return path;if(id==="electron")return{app};if(id==="./modules/launcher-version")return()=>"1.0.7";throw Error("Second instance loaded "+id);},process:{argv:[]},__dirname:path.dirname(file)});assert.deepEqual(calls,["quit"]);
});
function transport(body,headers={}){return{get(_url,_options,callback){const req=new EventEmitter();req.destroy=()=>{};req.setTimeout=()=>req;queueMicrotask(()=>{const res=new (require("stream").PassThrough)();res.statusCode=200;res.headers=headers;callback(res);res.end(body);});return req;}};}
test("community servers decode compressed data with bounded public transport",async()=>{
  const data=[{id:"private",name:"测试",playerCount:4,maxPlayers:16,map:"mp_glitch"}],body=zlib.gzipSync(Buffer.from(JSON.stringify(data)));
  const result=await server.fetchPayload(server.SOURCES.global,{transport:transport(body,{"content-encoding":"gzip","content-length":String(body.length)})});assert.deepEqual(result,data);
  const safe=server.normalizePayload(result,"global");assert.equal(safe.servers[0].players,4);assert.equal(safe.servers[0].id,undefined);
});
test("community servers keep cached rows on failure and coalesce concurrent requests",async()=>{
  let now=1,calls=0,fail=false;const service=server.createService({now:()=>now,fetchPayload:async()=>{calls++;if(fail)throw Error("offline");return[{name:"Public",playerCount:2}];}});
  const rows=await Promise.all([service.get({region:"cn"}),service.get({region:"cn"})]);assert.equal(calls,1);assert.equal(rows[0].status,"online");now+=61000;fail=true;const stale=await service.get({region:"cn"});assert.equal(stale.status,"stale");assert.equal(stale.servers[0].players,2);await service.get({region:"cn"});assert.equal(calls,2);
});
test("GitHub update metadata rejects a partial response even when it is valid JSON",async()=>{
  const body=Buffer.from('{}');await assert.rejects(updater.requestMetadata({transport:transport(body,{"content-length":"15"})}),error=>error.code==="NETWORK");
});

function windowFixture(){
  const handlers=new Map(),win=new EventEmitter(),contents=new EventEmitter();let rect={x:80,y:80,width:1360,height:860},maximized=false,destroyed=false;
  Object.assign(contents,{isDestroyed:()=>destroyed,send:()=>{}});Object.assign(win,{webContents:contents,getBounds:()=>({...rect}),setBounds:v=>{assert(!destroyed);rect={...v};win.emit("resize");},getMinimumSize:()=>[1100,720],isMaximized:()=>maximized,isMinimized:()=>false,isDestroyed:()=>destroyed,maximize:()=>{maximized=true;},unmaximize:()=>{maximized=false;},restore:()=>{maximized=false;}});
  const file=path.join(__dirname,"../src/modules/window-move.js"),context={module:{exports:{}},setTimeout,require:id=>{assert.equal(id,"electron");return{ipcMain:{handle:(n,fn)=>handlers.set(n,fn)},screen:{getDisplayMatching:()=>({scaleFactor:1.25})}}}};
  vm.runInNewContext(fs.readFileSync(file,"utf8"),context,{filename:file});context.module.exports(win,{width:1360,height:860});return{win,handlers,event:{sender:contents},destroy:()=>{destroyed=true;win.emit("closed");},rect:()=>rect};
}
test("repeated window dragging at 125 percent scaling preserves its dimensions",async()=>{
  const f=windowFixture(),initial=f.rect();for(let i=0;i<150;i++){f.handlers.get("window-move-begin")(f.event,{x:100+i,y:100+i});await f.handlers.get("window-move-update")(f.event,{x:108+i,y:106+i});f.handlers.get("window-move-end")(f.event);assert.equal(f.rect().width,initial.width);assert.equal(f.rect().height,initial.height);}
});
test("late window move replies after close return a safe state",async()=>{
  const f=windowFixture();f.destroy();const result=await f.handlers.get("window-move-update")(f.event,{x:100,y:100});assert.equal(result.maximized,false);
});
