'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),util=require('util');
function redact(value){
 return String(value).replace(/\x1b\[[0-9;]*m/g,'')
 .replace(/([A-Z]:[\\/]Users[\\/])[^\\/\s"']+/gi,'$1<user>')
 .replace(/\b[\w.+-]{1,64}@[\w.-]{1,253}\.[a-z]{2,24}\b/gi,'<email>')
 .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,'$1 <redacted>')
 .replace(/(["']?(?:password|passwd|token|access_token|refresh_token|authorization|cookie|secret|api[_-]?key|ticket)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&}]+)/gi,'$1<redacted>')
 .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1<redacted>@')
 .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi,'$1?<redacted>');
}
function createLogger({directory,maxBytes=2*1024*1024,maxFiles=20,maxAgeDays=14,onError=()=>{}}){
 let queue=[],queuedBytes=0,bytes=0,part=0,failed=false,dropped=0;
 const session=new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
 let file;
 const name=/^tfx-\d{4}-\d{2}-\d{2}T[\dTZ-]+-\d+-\d+\.log$/;
 function prune(){
  const entries=fs.readdirSync(directory).filter(n=>name.test(n)).map(n=>({name:n,...fs.statSync(path.join(directory,n))})).sort((a,b)=>b.mtimeMs-a.mtimeMs||b.name.localeCompare(a.name));
  for(let i=0;i<entries.length;i++)if(path.join(directory,entries[i].name)!==file&&(i>=maxFiles||Date.now()-entries[i].mtimeMs>maxAgeDays*86400000))fs.unlinkSync(path.join(directory,entries[i].name));
 }
 function open(){file=path.join(directory,`tfx-${session}-${String(part++).padStart(3,'0')}.log`);fs.writeFileSync(file,'',{flag:'wx'});bytes=0;prune();}
 function fail(error){if(!failed){failed=true;onError(error);}queue=[];queuedBytes=0;}
 function write(level,event,detail){
  if(failed)return;
  if(queuedBytes>=480*1024){dropped++;return;}
  const text=redact(typeof detail==='string'?detail:util.inspect(detail,{depth:5,maxArrayLength:40,maxStringLength:12000,breakLength:Infinity})).slice(0,24000);
  const line=JSON.stringify({time:new Date().toISOString(),level,event:redact(event).slice(0,120),session,detail:text})+'\n';
  if(queuedBytes+Buffer.byteLength(line)>512*1024){dropped++;return;}
  queue.push(line);queuedBytes+=Buffer.byteLength(line);
 }
 function flush(){
  if(failed)return;
  try{
   if(dropped){const count=dropped;dropped=0;queue.push(JSON.stringify({time:new Date().toISOString(),level:'WARN',event:'log.backpressure',session,detail:`Dropped ${count} entries`})+'\n');}
   const lines=queue;queue=[];queuedBytes=0;
   for(const line of lines){const size=Buffer.byteLength(line);if(bytes&&bytes+size>maxBytes)open();fs.appendFileSync(file,line,'utf8');bytes+=size;}
  }catch(error){fail(error);}
 }
 try{fs.mkdirSync(directory,{recursive:true});open();fs.writeFileSync(path.join(directory,'如何反馈日志.txt'),'遇到问题后，请将整个 log 文件夹压缩发给开发者，并说明出错时间、点击了什么、预期结果。\r\n日志按每次运行生成，时间为 UTC（中国时间加 8 小时）；保留最近 14 天，最多 20 份，每份约 2 MB。\r\n包含启动器操作、启动诊断和异常；不包含完整游戏引擎日志、账号密码或请求正文。分享前仍可检查内容。\r\n','utf8');}catch(error){fail(error);}
 const timer=setInterval(flush,400);timer.unref();
 return {write,flush,get file(){return file;},get failed(){return failed;},close(){clearInterval(timer);flush();}};
}
function install({app,ipcMain,dialog,shell,version}){
 const directory=path.join(app.isPackaged?path.dirname(process.execPath):path.resolve(__dirname,'../..'),'log');
 const original={};for(const key of ['log','info','warn','error','debug'])original[key]=console[key].bind(console);
 const logger=createLogger({directory,onError:error=>{original.error('TFX log write failed:',error);app.whenReady().then(()=>dialog.showErrorBox('日志无法保存',`无法写入 ${directory}\n${error.message}\n请将启动器移到可写入的文件夹后重试。`)).catch(()=>{});}});
 for(const key of Object.keys(original))console[key]=(...args)=>{logger.write(key==='log'?'INFO':key.toUpperCase(),'main.console',util.format(...args));original[key](...args);};
 logger.write('INFO','session.start',{version,platform:process.platform,release:os.release(),arch:process.arch,electron:process.versions.electron,node:process.versions.node,chrome:process.versions.chrome,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});logger.flush();
 process.on('uncaughtExceptionMonitor',error=>{logger.write('ERROR','main.uncaughtException',error);logger.flush();});
 process.on('unhandledRejection',error=>{logger.write('ERROR','main.unhandledRejection',error);logger.flush();});
 const handle=ipcMain.handle.bind(ipcMain);let sequence=0;
 ipcMain.handle=(channel,handler)=>handle(channel,async(event,...args)=>{
  const id=++sequence,start=Date.now(),quiet=/^(window-move-|.*-status$|server-list-get$)/.test(channel);
  if(!quiet)logger.write('INFO','ipc.begin',{id,channel});
  try{const result=await handler(event,...args);const failed=result?.ok===false||result?.success===false;
   if(!quiet||failed)logger.write(failed?'ERROR':'INFO','ipc.end',{id,channel,elapsedMs:Date.now()-start,ok:!failed,cancelled:!!(result?.cancelled||result?.canceled),error:failed?result.error||result.message:undefined});return result;
  }catch(error){logger.write('ERROR','ipc.throw',{id,channel,elapsedMs:Date.now()-start,error});throw error;}
 });
 ipcMain.handle('launcher-log-open',async()=>{
  try{
   await fs.promises.mkdir(directory,{recursive:true});
   logger.flush();
   const error=await shell.openPath(directory);
   return error?{ok:false,error}:{ok:true};
  }catch(error){return {ok:false,error:error.message};}
 });
 ipcMain.on('tfx-renderer-error',(event,data)=>{if(event.senderFrame!==event.sender.mainFrame)return;logger.write('ERROR','renderer.exception',typeof data==='string'?data.slice(0,16000):'Invalid error report');});
 for(const channel of ['launch-ns','launch-vanilla','toggle-mod','remove-mod','install-mod','install-from-path','install-from-url','update-northstar','setpath','setglobalpath','exit'])ipcMain.on(channel,()=>logger.write('INFO','ipc.send',{channel}));
 app.on('web-contents-created',(_event,web)=>{
  web.on('console-message',(_event,level,message,line,source)=>{if(typeof level==='number'&&level>=2)logger.write(level===3?'ERROR':'WARN','renderer.console',{message,line,source});});
  web.on('render-process-gone',(_event,details)=>{logger.write('ERROR','renderer.gone',details);logger.flush();});
  web.on('unresponsive',()=>logger.write('WARN','renderer.unresponsive'));
  web.on('did-fail-load',(_event,code,description,url,isMainFrame)=>logger.write('ERROR','renderer.loadFailed',{code,description,url,isMainFrame}));
  web.on('preload-error',(_event,preload,error)=>logger.write('ERROR','renderer.preloadError',{preload,error}));
 });
 app.on('child-process-gone',(_event,details)=>{logger.write('ERROR','child.gone',details);logger.flush();});
 app.on('will-quit',()=>{logger.write('INFO','session.end','Normal shutdown');logger.close();});
 process.on('exit',()=>logger.close());
 return logger;
}
module.exports={createLogger,redact,install};
