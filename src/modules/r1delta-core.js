"use strict";

// The official WPF installer can download the base game. Use the native entry,
// keeping the full matching release core separate from purchased game resources.
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const {pipeline}=require('node:stream/promises'),{promisify}=require('node:util'),cp=require('node:child_process');
const userAgent='TFX-Launcher/'+require('../../package.json').version;
const keyvalues=require('./keyvalues');
const ORIGIN='https://github.com/r1delta/r1delta/releases';
const REQUIRED=['Titanfall.exe','r1delta/bin/launcher.dll','r1delta/bin_delta/tier0.dll','r1delta/bin_nexon/launcher.dll','r1delta/GameInfo.txt','r1delta/content_manifest.txt'];
const file=async value=>{try{const stat=await fsp.stat(value);return stat.isFile()&&stat.size>0;}catch{return false;}};
const hashFile=async(name,algorithm='sha256')=>{const hash=crypto.createHash(algorithm);for await(const chunk of fs.createReadStream(name))hash.update(chunk);return hash.digest('hex');};
const readJSON=async name=>{try{return JSON.parse(await fsp.readFile(name,'utf8'));}catch{return {};}};
async function writeJSON(name,value){await fsp.mkdir(path.dirname(name),{recursive:true});const temp=name+'.tmp';await fsp.writeFile(temp,JSON.stringify(value,null,2));await fsp.rename(temp,name);}
function inside(root,relative){
  if(typeof relative!=='string'||!relative||relative.includes('\\')||relative.includes(':')||path.isAbsolute(relative))throw Error('Invalid core path');
  const target=path.resolve(root,relative);if(!target.startsWith(path.resolve(root)+path.sep))throw Error('Invalid core path');return target;
}
async function validateGame(root){
  if(typeof root!=='string'||!root||!path.isAbsolute(root))return false;
  if(!await file(path.join(root,'Titanfall.exe'))||!await file(path.join(root,'bin/x64_retail/engine.dll')))return false;
  try{for(const name of await fsp.readdir(path.join(root,'vpk')))if(/\.vpk$/i.test(name)&&await file(path.join(root,'vpk',name)))return true;}catch{}
  return false;
}
async function validateCore(root,deep=false){
  for(const name of REQUIRED)if(!await file(path.join(root,name)))throw Error('Delta 核心文件不完整：'+name);
  if(deep){
    const base=path.join(root,'r1delta'),lines=(await fsp.readFile(path.join(base,'content_manifest.txt'),'utf8')).split(/\r?\n/);
    if(lines.shift()?.trim()!=='r1delta-content-manifest 1')throw Error('Delta 核心清单格式错误');
    let count=0;
    for(const line of lines){if(!line.trim())continue;const row=/^[A-Z] ([a-f\d]{64}) (.+)$/i.exec(line);if(!row)throw Error('Delta 核心清单格式错误');if(await hashFile(inside(base,row[2]))!==row[1].toLowerCase())throw Error('Delta 核心校验失败：'+row[2]);count++;}
    if(!count)throw Error('Delta 核心清单为空');
  }return true;
}
function parseReleases(text,tag){
  if(!/^v?\d+\.\d+\.\d+(?:[-.][\w.-]+)?$/.test(tag))throw Error('Invalid Delta release tag');
  const rows=String(text).replace(/^\uFEFF/u,'').split(/\r?\n/).map(line=>/^([a-f\d]{40})\s+(R1Delta-([\d.]+(?:-[\w.]+)?)-full\.nupkg)\s+(\d+)\s*$/i.exec(line)).filter(Boolean);
  const row=rows.find(row=>row[3]===tag.replace(/^v/,''));if(!row)throw Error('GitHub 发行版缺少对应的 Delta 核心包');
  const size=Number(row[4]);if(!Number.isSafeInteger(size)||size<=0)throw Error('Invalid Delta package size');
  return {version:row[3],tag,name:row[2],sha1:row[1].toLowerCase(),size,url:ORIGIN+'/download/'+encodeURIComponent(tag)+'/'+row[2]};
}
function request(url,redirects=0){return new Promise((resolve,reject)=>{
  if(redirects>8)return reject(Error('Too many GitHub redirects'));
  if(new URL(url).protocol!=='https:')return reject(Error('HTTPS required'));
  const req=https.get(url,{headers:{'User-Agent':userAgent,'Accept':'*/*'}},res=>{
    if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();request(new URL(res.headers.location,url).href,redirects+1).then(resolve,reject);}
    else if(res.statusCode!==200){res.resume();reject(Error('GitHub HTTP '+res.statusCode));}else resolve({response:res,url});
  });req.setTimeout(45000,()=>req.destroy(Error('GitHub request timed out')));req.on('error',reject);
});}
function electronRequest(net){return url=>new Promise((resolve,reject)=>{
  if(new URL(url).protocol!=='https:')return reject(Error('HTTPS required'));
  const req=net.request({url,redirect:'manual'});let finalURL=url,redirects=0;
  const timer=setTimeout(()=>{reject(Error('GitHub request timed out'));req.abort();},45000);
  req.setHeader('User-Agent',userAgent);
  req.on('redirect',(_status,_method,next)=>{
    if(++redirects>8||new URL(next).protocol!=='https:'){reject(Error('Invalid GitHub redirect'));req.abort();return;}
    finalURL=next;req.followRedirect();
  });
  req.on('response',response=>{
    clearTimeout(timer);
    if(response.statusCode!==200){response.resume();reject(Error('GitHub HTTP '+response.statusCode));return;}
    const idle=setTimeout(()=>response.destroy(Error('GitHub transfer timed out')),60000);idle.unref();
    response.on('data',()=>idle.refresh());response.pause();
    response.once('aborted',()=>response.destroy(Error('GitHub transfer interrupted')));
    response.once('close',()=>{clearTimeout(idle);req.abort();});resolve({response,url:finalURL});
  });
  req.on('error',error=>{clearTimeout(timer);reject(error);});req.on('close',()=>clearTimeout(timer));req.end();
});}
async function textAt(url,transport=request){const {response}=await transport(url);let text='';for await(const chunk of response){text+=chunk.toString('utf8');if(text.length>2*1024*1024){response.destroy();throw Error('GitHub metadata too large');}}return text;}
async function latestRelease(transport=request){
  const {response,url}=await transport(ORIGIN+'/latest');response.destroy();
  const tag=new URL(url).pathname.match(/^\/r1delta\/r1delta\/releases\/tag\/([^/]+)$/)?.[1];if(!tag)throw Error('无法确定 GitHub 最新 Delta 版本');
  return parseReleases(await textAt(ORIGIN+'/download/'+encodeURIComponent(tag)+'/RELEASES',transport),tag);
}
async function download(url,destination,onProgress,expected,transport=request){
  const {response}=await transport(url);let received=0,last=0;
  response.on('data',chunk=>{received+=chunk.length;if(received>expected)response.destroy(Error('Delta package exceeds release size'));if(Date.now()-last>100){last=Date.now();onProgress(received/expected*100);}});
  await pipeline(response,fs.createWriteStream(destination,{flags:'wx'}));onProgress(100);
}
function buildLaunchSpec(game,core,env=process.env){
  const pathKey=Object.keys(env).find(key=>key.toLowerCase()==='path')||'PATH';
  const inherited=Object.fromEntries(Object.entries(env).filter(([key])=>key.toLowerCase()!=='path'));
  const oldPath=env[pathKey]||'';
  return {executable:path.join(core,'Titanfall.exe'),args:[],options:{cwd:game,windowsHide:false,detached:true,stdio:'ignore',env:{...inherited,ContentId:'1025161',FROM_DELTA_LAUNCHER:'1',__COMPAT_LAYER:'NoDTToDITMouseBatch=1',[pathKey]:[path.join(core,'r1delta/bin_delta'),path.join(core,'r1delta/bin'),path.join(game,'bin/x64_retail'),path.join(game,'r1/bin/x64_retail'),oldPath].join(path.delimiter)}}};
}
async function asciiPath(root,base=path.join(process.env.ProgramData||'C:/ProgramData','TFX','R1Delta','launch')){
  if(/^[\x00-\x7f]+$/.test(root))return root;if(!/^[\x00-\x7f]+$/.test(base))throw Error('Delta 需要可用的 ASCII 启动路径');
  await fsp.mkdir(base,{recursive:true});const junction=path.join(base,crypto.createHash('sha256').update(path.resolve(root).toUpperCase()).digest('hex').slice(0,20));
  try{const stat=await fsp.lstat(junction);if(!stat.isSymbolicLink()||(await fsp.realpath(junction)).toLowerCase()!==(await fsp.realpath(root)).toLowerCase())throw Error('Delta 启动路径已被占用');}
  catch(error){if(error.code!=='ENOENT')throw error;await fsp.symlink(root,junction,'junction');}return junction;
}
async function hasOgg(name){
  try{let tail=Buffer.alloc(0);for await(const chunk of fs.createReadStream(name)){const data=Buffer.concat([tail,chunk]);if(data.includes(Buffer.from('OggS')))return true;tail=data.subarray(-3);}return false;}catch(error){if(error.code==='ENOENT')return false;throw error;}
}
async function prepareAudio(game,exec=promisify(cp.execFile)){
  const marker=path.join(game,'vpk/audio_done.txt'),cam=path.join(game,'vpk/cam_list.txt'),vpk=path.join(game,'vpk/client_mp_common.bsp.pak000_040.vpk');if(await file(marker)||!await file(cam))return;
  let header='';for await(const chunk of fs.createReadStream(cam,{encoding:'utf8',end:15}))header+=chunk;if(header.split(/\r?\n/)[0]!=='CAMLIST')throw Error('游戏音频清单无效，请通过 Steam 修复游戏');
  if(await hasOgg(vpk)){
    const installer=path.join(game,'bin/x64/audio_installer.exe');if(!await file(installer))throw Error('缺少游戏音频安装程序，请通过 Steam 修复游戏');
    await exec(installer,[cam],{cwd:game,windowsHide:true,timeout:120000,maxBuffer:1024*1024});if(await hasOgg(vpk))throw Error('游戏音频初始化未完成，请通过 Steam 修复游戏');
  }
  try{await fsp.writeFile(marker,new Date().toISOString());}catch(error){console.warn('[R1Delta] Could not write audio marker',error.message);}
}
async function detectGame(exec=promisify(cp.execFile)){
  const script="$ErrorActionPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$games=@();foreach($key in @('HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1454890','HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1454890','HKLM:\\SOFTWARE\\WOW6432Node\\Respawn\\Titanfall','HKLM:\\SOFTWARE\\Respawn\\Titanfall')){$p=Get-ItemProperty -LiteralPath $key;if($p.InstallLocation){$games+=$p.InstallLocation};if($p.'Install Dir'){$games+=$p.'Install Dir'}};$s=Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Valve\\Steam';@{games=$games;steam=$s.SteamPath}|ConvertTo-Json -Compress";
  let data;try{const {stdout}=await exec('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:8000});data=JSON.parse(stdout.replace(/^\uFEFF/,''));}catch{return '';}
  const candidates=Array.isArray(data.games)?data.games:typeof data.games==='string'?[data.games]:[],libraries=new Set(data.steam?[data.steam]:[]);
  for(const name of ['steamapps/libraryfolders.vdf','config/libraryfolders.vdf']){try{const parsed=keyvalues.parse(await fsp.readFile(path.join(data.steam,name),'utf8')).libraryfolders;for(const [id,value]of Object.entries(parsed||{}))if(/^\d+$/.test(id))libraries.add(typeof value==='string'?value:value.path);}catch{}}
  for(const library of libraries){try{const manifest=keyvalues.parse(await fsp.readFile(path.join(library,'steamapps/appmanifest_1454890.acf'),'utf8')).AppState;if(manifest?.appid==='1454890'&&typeof manifest.installdir==='string'&&!/[\\/:]/.test(manifest.installdir)&&manifest.installdir!=='.'&&manifest.installdir!=='..')candidates.push(path.join(library,'steamapps/common',manifest.installdir));}catch{}}
  for(const candidate of candidates)if(await validateGame(candidate))return candidate;return '';
}
function createService(options){
  const {app,dialog,shell}=options,config=options.configFile||path.join(app.getPath('appData'),'fold-r1delta-core.json'),base=options.coreBase||path.join(app.getPath('appData'),'TFX','R1Delta','cores');
  const exec=options.exec||promisify(cp.execFile),spawn=options.spawn||cp.spawn,processes=options.processes||require('./is_running');
  const {LaunchConfirmation}=require('./launch-session');
  const confirmation=options.confirmation||new LaunchConfirmation({speedUp:until=>processes.speedUp(until),refresh:()=>processes.snapshot()});
  processes.onSnapshot?.(snapshot=>confirmation.observe(snapshot));
  let active=false,running=null,detection=null;
  async function status(detect=false){
    const conf=await readJSON(config);let gamepath=conf.gamepath||'';
    if(detect&&!await validateGame(gamepath)){
      if(!detection)detection=Promise.resolve().then(()=> (options.detectGame||detectGame)()).finally(()=>{detection=null;});
      const detected=await detection;if(detected){gamepath=detected;await writeJSON(config,{...conf,gamepath});}
    }
    const corepath=conf.corepath||'';let installed=false;try{if(corepath){await validateCore(corepath);installed=true;}}catch{}
    return {ok:true,gamepath,gameInstalled:await validateGame(gamepath),corepath,installed,version:installed?conf.version||'':'',busy:active,running:!!running};
  }
  async function choose(){
    const selected=await dialog.showOpenDialog({title:'选择泰坦陨落 1 游戏目录',properties:['openDirectory']});if(selected.canceled||!selected.filePaths?.[0])return {ok:true,canceled:true};
    const gamepath=path.resolve(selected.filePaths[0]);if(!await validateGame(gamepath))throw Error('请选择包含 Titanfall.exe、bin/x64_retail 和 vpk 的泰坦陨落 1 游戏目录');
    await writeJSON(config,{...await readJSON(config),gamepath});return status();
  }
  async function locked(task){if(active)throw Error('Delta 正在处理，请稍候');active=true;try{return await task();}finally{active=false;}}
  async function select(){return locked(choose);}
  async function install(progress=()=>{}){return locked(async()=>{
    if(running)throw Error('请先退出 Delta 再安装或更新核心');
    let current=await status(true);if(!current.gameInstalled){const selected=await choose();if(selected.canceled)return selected;current=selected;}
    const emit=(phase,percent)=>progress({phase,percent});emit('正在检查 Delta 版本',2);const release=await(options.latestRelease||(()=>latestRelease(options.request)))();await fsp.mkdir(base,{recursive:true});
    const target=inside(base,release.version+'-'+release.sha1.slice(0,12));
    let reusable=false;try{await validateCore(target,true);reusable=true;}catch{}
    if(reusable){await writeJSON(config,{...await readJSON(config),gamepath:current.gamepath,corepath:target,version:release.version});emit('Delta 核心已就绪',100);return {...await status(),busy:false};}
    const staging=await fsp.mkdtemp(path.join(base,'.install-')),archive=path.join(staging,'core.nupkg'),extract=path.join(staging,'unpacked');
    try{
      emit('正在下载 Delta 核心',5);await(options.download||download)(release.url,archive,p=>emit('正在下载 Delta 核心',Math.round(5+p*.7)),release.size,options.request);
      emit('正在校验 Delta 核心',77);if((await fsp.stat(archive)).size!==release.size||await hashFile(archive,'sha1')!==release.sha1)throw Error('Delta 下载校验失败，请重试');emit('正在解压 Delta 核心',82);
      if(options.extract)await options.extract(archive,extract);else{const tool=path.join(app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked','src'):path.resolve(__dirname,'..'),'tools/vtf/7z.exe');await exec(tool,['x',archive,'-o'+extract,'-y','-bd'],{windowsHide:true,timeout:180000,maxBuffer:2*1024*1024});}
      const payload=path.join(extract,'lib/net462');await validateCore(payload,true);emit('正在部署 Delta 核心',95);
      // A failed update must leave the previously selected release intact.
      let destination=target;if(fs.existsSync(destination))destination=inside(base,release.version+'-'+crypto.randomUUID());await fsp.rename(payload,destination);await writeJSON(config,{...await readJSON(config),gamepath:current.gamepath,corepath:destination,version:release.version});
      console.info('[R1Delta] Core installed',release.version,'in',destination);emit('Delta 核心已就绪',100);return {...await status(),busy:false};
    }finally{await fsp.rm(staging,{recursive:true,force:true}).catch(error=>console.warn('[R1Delta] Temporary files',error.message));}
  });}
  async function launch(progress=()=>{},exited=()=>{},input={}){return locked(async()=>{
    if(running)throw Error('Delta 已在运行');
    const current=await status(true);if(!current.gameInstalled)throw Error('请先选择泰坦陨落 1 游戏目录');if(!current.installed)throw Error('请先安装 Delta 核心');
    progress({phase:'正在检查游戏音频',percent:30});await(options.prepareAudio||prepareAudio)(current.gamepath,exec);progress({phase:'正在配置 Delta 环境',percent:65});const ascii=options.asciiPath||asciiPath;
    const baseline=await processes.snapshot();if(!baseline?.ok)throw Error('无法检查泰坦陨落 1 进程，请稍后重试');
    // Delta's native entry runs from the core folder while using the selected
    // game as its working directory, so its image path is not inside gamepath.
    const game=await ascii(current.gamepath),core=await ascii(current.corepath),spec=buildLaunchSpec(game,core);spec.args=input.args||[];progress({phase:'正在启动 Delta',percent:85});
    const session=confirmation.begin(baseline,{images:['titanfall.exe'],messages:{alreadyRunning:'泰坦陨落 1 已经运行，请先退出游戏。',timeout:'Delta 已启动，但未能确认泰坦陨落 1 进程。请检查 Windows 安全提示和启动日志。',exit:'泰坦陨落 1 在启动过程中退出。请检查游戏文件和启动日志。'}});
    let child;
    try {child=spawn(spec.executable,spec.args,spec.options);}catch(error){confirmation.fail(session,error);throw error;}
    running=child;
    child.once('error',error=>{if(running===child)running=null;console.error('[R1Delta] Process error',error);confirmation.fail(session,error);exited({phase:'Delta 启动失败',error:error.message,percent:0});});
    child.once('spawn',()=>{confirmation.spawned(session,child.pid);console.info('[R1Delta] Native process started',{pid:child.pid,version:current.version});});
    child.once('exit',(code,signal)=>{if(running===child)running=null;console.info('[R1Delta] Process exited',{code,signal});confirmation.launcherExited(session,code,signal,child.pid);exited({phase:'Delta 进程已退出',percent:0,exitCode:code,signal});});
    await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});
    child.unref();const outcome=await session.promise;if(!outcome.ok)throw Error(outcome.error);progress({phase:'泰坦陨落 1 进程已确认',percent:100});return {ok:true,pid:outcome.pid||child.pid,state:'confirmed'};
  });}
  async function steam(){return locked(async()=>{await shell.openExternal('steam://rungameid/1454890');return {ok:true,state:'requested'};});}
  return {status,select,install,launch,steam};
}
function register(electron=require('electron'),serviceOptions={}){
  const service=createService({...electron,...(electron.net?{request:electronRequest(electron.net)}:{}),...serviceOptions}),send=(event,value)=>{if(!event.sender.isDestroyed())event.sender.send('r1delta-progress',value);};
  for(const[channel,handler]of Object.entries({'r1delta-status':()=>service.status(true),'r1delta-select':()=>service.select(),'r1delta-install':event=>service.install(value=>send(event,value)),'r1delta-launch':event=>service.launch(value=>send(event,value),value=>send(event,value)),'r1delta-launch-steam':()=>service.steam()}))electron.ipcMain.handle(channel,async event=>{try{return await handler(event);}catch(error){console.error('[R1Delta]',channel,error);return {ok:false,error:error.message};}});return service;
}
module.exports={register,createService,validateGame,validateCore,parseReleases,buildLaunchSpec,asciiPath,prepareAudio,detectGame,hashFile,latestRelease,electronRequest};
