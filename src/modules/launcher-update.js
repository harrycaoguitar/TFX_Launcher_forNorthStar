"use strict";
const launcherVersion=require("./launcher-version");
// Public GitHub metadata only. Checking never downloads or installs an asset;
// links are revalidated in main before the explicit open IPC is accepted.
const https=require("https");
const REPOSITORY="harrycaoguitar/TFX_Launcher_forNorthStar";
const API_URL=`https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const CACHE_MS=5*60*1000,MAX_RESPONSE_BYTES=1024*1024,TIMEOUT_MS=10000;
function failure(code,message){return Object.assign(Error(message),{code});}
function parseVersion(value){
 if(typeof value!=="string")return null;
 const match=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
 if(!match)return null;
 const parts=match.slice(1,4).map(Number),pre=match[4]?match[4].split("."):[];
 if(!parts.every(Number.isSafeInteger)||pre.some(part=>/^\d+$/.test(part)&&part.length>1&&part[0]==="0"))return null;
 return {parts,pre};
}
function compareVersions(left,right){
 const a=parseVersion(left),b=parseVersion(right);if(!a||!b)return null;
 for(let i=0;i<3;i++)if(a.parts[i]!==b.parts[i])return a.parts[i]<b.parts[i]?-1:1;
 if(!a.pre.length||!b.pre.length)return a.pre.length===b.pre.length?0:!a.pre.length?1:-1;
 for(let i=0;i<Math.max(a.pre.length,b.pre.length);i++){
  if(a.pre[i]===b.pre[i])continue;if(a.pre[i]===undefined)return -1;if(b.pre[i]===undefined)return 1;
  const an=/^\d+$/.test(a.pre[i]),bn=/^\d+$/.test(b.pre[i]);
  if(an&&bn){const av=BigInt(a.pre[i]),bv=BigInt(b.pre[i]);return av<bv?-1:1;}
  if(an!==bn)return an?-1:1;
  return a.pre[i]<b.pre[i]?-1:1;
 }
 return 0;
}
function safeURL(value){
 try{const url=new URL(value);if(url.protocol!=="https:"||url.hostname!=="github.com"||url.port||url.username||url.password||url.search||url.hash||url.pathname.includes("\\"))return null;const parts=url.pathname.split("/").slice(1).map(decodeURIComponent);if(parts.some(part=>!part||/[\\/\x00-\x1f]/.test(part)||part==="."||part===".."))return null;return {url,parts};}catch{return null;}
}
function isReleaseURL(value,tag){const parsed=safeURL(value);return !!parsed&&parsed.parts.length===5&&parsed.parts.slice(0,4).join("/")===REPOSITORY+"/releases/tag"&&parsed.parts[4]===tag;}
function isAssetURL(value,tag,name){const parsed=safeURL(value);return !!parsed&&parsed.parts.length===6&&parsed.parts.slice(0,4).join("/")===REPOSITORY+"/releases/download"&&parsed.parts[4]===tag&&parsed.parts[5]===name&&/\.exe$/i.test(name)&&!/source|symbol|debug|server|linux|arm64|ia32/i.test(name);}
function selectRelease(data){
 const version=parseVersion(data?.tag_name);
 if(!data||data.draft||data.prerelease||!version||version.pre.length)throw failure("UNSUPPORTED_RELEASE","GitHub 没有返回可用的正式版本");
 if(!isReleaseURL(data.html_url,data.tag_name)||!Array.isArray(data.assets))throw failure("UNTRUSTED_RELEASE","更新信息中的仓库或下载地址不匹配");
 const candidates=data.assets.filter(asset=>typeof asset?.name==="string"&&Number.isSafeInteger(asset.size)&&asset.size>0&&asset.state==="uploaded"&&isAssetURL(asset.browser_download_url,data.tag_name,asset.name));
 const asset=candidates.find(item=>/tfx.*(?:launcher|setup)|(?:launcher|setup).*tfx/i.test(item.name))||candidates.find(item=>/tfx/i.test(item.name));
 return {latestVersion:data.tag_name,releaseUrl:data.html_url,assetUrl:asset?.browser_download_url||null,tag:data.tag_name,assetName:asset?.name||null};
}
function requestMetadata({transport=https,timeoutMs=TIMEOUT_MS,maxBytes=MAX_RESPONSE_BYTES}={}){
 return new Promise((resolve,reject)=>{
  let request,response,timer,settled=false,total=0;
  function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);if(error){response?.destroy();request?.destroy();reject(error);}else resolve(value);}
  timer=setTimeout(()=>finish(failure("TIMEOUT","GitHub 更新检查超时，请稍后重试")),timeoutMs);
  try{
   request=transport.get(API_URL,{headers:{Accept:"application/vnd.github+json","User-Agent":"TFX-Launcher-update-check","X-GitHub-Api-Version":"2022-11-28"}},res=>{
    response=res;const chunks=[];
    const length=Number(res.headers?.["content-length"]);
    if(Number.isFinite(length)&&length>maxBytes){finish(failure("RESPONSE_TOO_LARGE","GitHub 更新信息超过允许大小"));return;}
    res.on("error",()=>finish(failure("NETWORK","无法连接 GitHub，请检查网络后重试")));
    res.on("aborted",()=>finish(failure("NETWORK","GitHub 更新连接中断，请重试")));
    res.on("data",chunk=>{if(settled)return;const bytes=Buffer.from(chunk);total+=bytes.length;if(total>maxBytes){finish(failure("RESPONSE_TOO_LARGE","GitHub 更新信息超过允许大小"));return;}chunks.push(bytes);});
    res.on("end",()=>{
     if(Number.isFinite(length)&&length>0&&total!==length){finish(failure("NETWORK","GitHub 更新连接中断，请重试"));return;}
     finish(null,{statusCode:res.statusCode,headers:res.headers||{},body:Buffer.concat(chunks).toString("utf8")});
    });
   });
   request.on("error",()=>finish(failure("NETWORK","无法连接 GitHub，请检查网络后重试")));
   request.setTimeout?.(timeoutMs,()=>finish(failure("TIMEOUT","GitHub 更新检查超时，请稍后重试")));
  }catch{finish(failure("NETWORK","无法连接 GitHub，请检查网络后重试"));}
 });
}
function httpError(response){
 if(response.statusCode===403||response.statusCode===429){const rate=response.statusCode===429||String(response.headers["x-ratelimit-remaining"])==="0"||response.headers["retry-after"]||/rate limit|secondary rate/i.test(response.body);return failure(rate?"RATE_LIMIT":"FORBIDDEN",rate?"GitHub 请求次数达到限制，请稍后重试":"GitHub 拒绝了更新检查请求");}
 return failure(response.statusCode>=500?"SERVER_ERROR":"HTTP_ERROR","GitHub 更新检查失败，请稍后重试");
}
function createUpdater({currentVersion,transport=https,now=Date.now,timeoutMs=TIMEOUT_MS,maxBytes=MAX_RESPONSE_BYTES,retries=1,cacheMs=CACHE_MS,openExternal}={}){
 let pending=null,last=null,lastAt=0,lastSelection=null;
 const base=()=>({currentVersion,latestVersion:null,releaseUrl:null,assetUrl:null,checkedAt:new Date(now()).toISOString(),errorCode:null});
 async function run(){
  if(!parseVersion(currentVersion))return {...base(),ok:false,status:"error",errorCode:"CURRENT_VERSION",error:"当前启动器版本无法比较"};
  try{
   let response;
   for(let attempt=0;;attempt++){
    try{response=await requestMetadata({transport,timeoutMs,maxBytes});if(response.statusCode>=500&&attempt<retries)continue;break;}
    catch(error){if(attempt<retries&&["NETWORK","TIMEOUT"].includes(error.code))continue;throw error;}
   }
   if(response.statusCode===404){lastSelection=null;return {...base(),ok:true,status:"no-release",errorCode:"NO_RELEASE"};}
   if(response.statusCode!==200)throw httpError(response);
   let data;try{data=JSON.parse(response.body);}catch{throw failure("INVALID_JSON","GitHub 返回的更新信息无法读取");}
   const selection=selectRelease(data),comparison=compareVersions(currentVersion,selection.latestVersion);
   if(comparison===null)throw failure("VERSION","更新版本无法比较");
   lastSelection=selection;
   return {...base(),ok:true,status:comparison<0?"available":"up-to-date",latestVersion:selection.latestVersion,releaseUrl:selection.releaseUrl,assetUrl:selection.assetUrl};
  }catch(error){lastSelection=null;return {...base(),ok:false,status:"error",errorCode:error.code||"NETWORK",error:error.message};}
 }
 function check(input={}){
  if(pending)return pending;
  const force=input?.force===true;
  if(!force&&last&&last.status!=="error"&&now()-lastAt<cacheMs)return Promise.resolve({...last});
  pending=run().then(result=>{last=result;lastAt=now();return {...result};}).finally(()=>{pending=null;});return pending;
 }
 async function open(input={}){
  if(input.kind!=="release"&&input.kind!=="download")return {ok:false,errorCode:"LINK_KIND",error:"请选择版本页面或下载链接"};
  if(pending||!last?.ok||!lastSelection||now()-lastAt>=cacheMs)return {ok:false,errorCode:"CHECK_REQUIRED",error:"请先重新检查更新，再打开官方链接"};
  const target=input.kind==="download"?lastSelection.assetUrl:lastSelection.releaseUrl;
  if(!target||(input.kind==="download"?!isAssetURL(target,lastSelection.tag,lastSelection.assetName):!isReleaseURL(target,lastSelection.tag)))return {ok:false,errorCode:"NO_LINK",error:"这个版本没有可用的官方下载链接"};
  if(typeof openExternal!=="function")return {ok:false,errorCode:"OPEN_UNAVAILABLE",error:"无法打开官方更新页面"};
  try{await openExternal(target);return {ok:true,opened:true};}catch{return {ok:false,errorCode:"OPEN_FAILED",error:"无法打开官方更新页面"};}
 }
 return {check,open};
}
function register({ipcMain,shell,currentVersion=launcherVersion()}={}){
 const updater=createUpdater({currentVersion,openExternal:url=>shell.openExternal(url)});
 ipcMain.handle("launcher-update-check",(_event,input={})=>updater.check(input));
 ipcMain.handle("launcher-update-open",(_event,input={})=>updater.open(input));
 return updater;
}
module.exports={REPOSITORY,API_URL,parseVersion,compareVersions,isReleaseURL,isAssetURL,selectRelease,requestMetadata,createUpdater,register};
