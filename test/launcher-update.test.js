"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{EventEmitter}=require("node:events");
const Module=require("node:module"),originalLoad=Module._load;Module._load=function(request,parent,isMain){if(request==="electron")return{app:{getVersion:()=>"1.0.7"}};return originalLoad.call(this,request,parent,isMain);};
const {API_URL,REPOSITORY,parseVersion,compareVersions,isReleaseURL,isAssetURL,selectRelease,requestMetadata,createUpdater,register}=require("../src/modules/launcher-update");
Module._load=originalLoad;
function release(version="v1.0.0"){
 const name=`TFX-Launcher-${version}.exe`;
 return {tag_name:version,html_url:`https://github.com/${REPOSITORY}/releases/tag/${version}`,draft:false,prerelease:false,assets:[{name,size:123456,state:"uploaded",browser_download_url:`https://github.com/${REPOSITORY}/releases/download/${version}/${name}`} ]};
}
function mockTransport(steps){
 const calls=[];
 return {calls,get(url,options,callback){
  const req=new EventEmitter();req.destroy=()=>{req.destroyed=true;};req.setTimeout=()=>req;calls.push({url,options});const step=steps.shift();
  queueMicrotask(()=>{
   if(!step){req.emit("error",Error("missing fixture"));return;}
   if(step.error){req.emit("error",Error(step.error));return;}if(step.hang)return;
   const res=new EventEmitter();res.statusCode=step.statusCode??200;res.headers=step.headers||{};res.destroy=()=>{res.destroyed=true;};callback(res);
   if(res.destroyed)return;
   if(step.abort){res.emit("aborted");return;}
   const body=step.body??JSON.stringify(step.release??release());
   for(const chunk of step.chunks||[body]){res.emit("data",Buffer.from(chunk));if(res.destroyed)return;}
   res.emit("end");
  });return req;
 }};
}
const currentVersion="0.9.0-preview.25";

test("strict SemVer sorts preview numbering and stable releases",()=>{
 assert.equal(compareVersions(currentVersion,"1.0.0"),-1);assert.equal(compareVersions("1.0.0-preview.25","1.0.0"),-1);assert.equal(compareVersions("1.0.0-preview.10","1.0.0-preview.9"),1);assert.equal(compareVersions("v1.0.0+build.5","1.0.0+build.6"),0);assert.equal(compareVersions("1.0.0-alpha.999999999999999999999","1.0.0-alpha.9"),1);
 for(const value of ["1.0","01.0.0","1.0.0-preview.01","999999999999999999999.0.0","1.0.0.1","javascript:1.0.0"])assert.equal(parseVersion(value),null);
});

test("release and executable links must match exact owner/repository/tag",()=>{
 const data=release();assert.equal(isReleaseURL(data.html_url,data.tag_name),true);assert.equal(isAssetURL(data.assets[0].browser_download_url,data.tag_name,data.assets[0].name),true);
 for(const value of [data.html_url.replace("github.com","github.com.evil.test"),data.html_url.replace(REPOSITORY,"other/TFX_Launcher_forNorthStar"),data.html_url+"?redirect=evil",data.html_url+"#test",data.html_url.replace("https:","http:"),data.html_url.replace("https://","https://user@"),data.html_url.replace("v1.0.0","v2.0.0"),data.html_url.replace("v1.0.0","%2e%2e")])assert.equal(isReleaseURL(value,data.tag_name),false);
 assert.equal(isAssetURL(data.assets[0].browser_download_url.replace(".exe",".zip"),data.tag_name,data.assets[0].name),false);
 assert.equal(isAssetURL(data.assets[0].browser_download_url+"%2Fother",data.tag_name,data.assets[0].name),false);
});

test("stable release metadata validates repository and excludes draft/preview",()=>{
 assert.equal(selectRelease(release()).latestVersion,"v1.0.0");
 for(const data of [{...release(),draft:true},{...release(),prerelease:true},release("v1.0.0-preview.9"),{...release(),tag_name:"garbage"}])assert.throws(()=>selectRelease(data),error=>error.code==="UNSUPPORTED_RELEASE");
 assert.throws(()=>selectRelease({...release(),html_url:"https://github.com/other/repo/releases/tag/v1.0.0"}),error=>error.code==="UNTRUSTED_RELEASE");
});

test("no trusted EXE still allows official release notes without a download",()=>{
 const data=release();data.assets=[{...data.assets[0],browser_download_url:"https://evil.test/a.exe"}];assert.equal(selectRelease(data).assetUrl,null);
});

test("checking stable release from preview reports available and sends no login token",async()=>{
 const transport=mockTransport([{}]),updater=createUpdater({currentVersion,transport});const result=await updater.check();assert.equal(result.ok,true);assert.equal(result.status,"available");assert.equal(result.currentVersion,currentVersion);assert.equal(result.latestVersion,"v1.0.0");assert.equal(result.errorCode,null);assert.equal(transport.calls[0].url,API_URL);assert.equal(transport.calls[0].options.headers.Authorization,undefined);assert.ok(result.checkedAt);
});

test("same or newer installed stable version is up-to-date",async()=>{
 for(const current of ["1.0.0","1.1.0"]){const updater=createUpdater({currentVersion:current,transport:mockTransport([{}])});assert.equal((await updater.check()).status,"up-to-date");}
});

test("404 is no-release, never falsely up-to-date",async()=>{
 const updater=createUpdater({currentVersion,transport:mockTransport([{statusCode:404,body:'{"message":"Not Found"}'}])});const result=await updater.check();assert.equal(result.status,"no-release");assert.equal(result.ok,true);assert.equal(result.latestVersion,null);assert.equal(result.errorCode,"NO_RELEASE");assert.equal(result.releaseUrl,null);
});

test("concurrent checks share a request and force only bypasses finished cache",async()=>{
 let time=100000;const transport=mockTransport([{},{}]),updater=createUpdater({currentVersion,transport,now:()=>time});const a=updater.check(),b=updater.check({force:true});assert.equal(a,b);await a;assert.equal(transport.calls.length,1);await updater.check();assert.equal(transport.calls.length,1);await updater.check({force:true});assert.equal(transport.calls.length,2);
});

test("success cache expires after five minutes",async()=>{
 let time=100000;const transport=mockTransport([{},{}]),updater=createUpdater({currentVersion,transport,now:()=>time});await updater.check();time+=5*60*1000;await updater.check();assert.equal(transport.calls.length,2);
});

test("network failure retries once then remains error; immediate user retry can recover",async()=>{
 const transport=mockTransport([{error:"offline"},{error:"offline"},{}]),updater=createUpdater({currentVersion,transport});const failed=await updater.check();assert.equal(failed.status,"error");assert.equal(failed.errorCode,"NETWORK");assert.equal(failed.latestVersion,null);assert.equal(transport.calls.length,2);const recovered=await updater.check();assert.equal(recovered.status,"available");assert.equal(transport.calls.length,3);
});

test("5xx server error has a bounded retry",async()=>{
 const recovered=createUpdater({currentVersion,transport:mockTransport([{statusCode:503,body:"unavailable"},{}])});assert.equal((await recovered.check()).status,"available");
 const transport=mockTransport([{statusCode:500,body:"unavailable"},{statusCode:502,body:"unavailable"}]),failed=await createUpdater({currentVersion,transport}).check();assert.equal(failed.status,"error");assert.equal(failed.errorCode,"SERVER_ERROR");assert.equal(transport.calls.length,2);
});

test("rate limit is explicit, no retry flood and no fresh links",async()=>{
 for(const step of [{statusCode:403,headers:{"x-ratelimit-remaining":"0"},body:"API rate limit exceeded"},{statusCode:429,body:"too many requests"}]){const transport=mockTransport([step]),result=await createUpdater({currentVersion,transport}).check();assert.equal(result.status,"error");assert.equal(result.errorCode,"RATE_LIMIT");assert.equal(result.assetUrl,null);assert.equal(transport.calls.length,1);}
});

test("403 forbidden remains error distinct from rate limit",async()=>{
 const result=await createUpdater({currentVersion,transport:mockTransport([{statusCode:403,body:"forbidden"}])}).check();assert.equal(result.status,"error");assert.equal(result.errorCode,"FORBIDDEN");
});

test("redirects and invalid JSON cannot produce up-to-date",async()=>{
 const redirect=await createUpdater({currentVersion,transport:mockTransport([{statusCode:302,headers:{location:"https://evil.test"},body:""}])}).check();assert.equal(redirect.errorCode,"HTTP_ERROR");
 const malformed=await createUpdater({currentVersion,transport:mockTransport([{body:"<html>bad gateway</html>"}])}).check();assert.equal(malformed.status,"error");assert.equal(malformed.errorCode,"INVALID_JSON");
});

test("both content-length and streamed response byte limits abort the request",async()=>{
 for(const step of [{headers:{"content-length":"999"},body:"x"},{chunks:["aaaaa","bbbbbb"]}])await assert.rejects(requestMetadata({transport:mockTransport([step]),maxBytes:10}),error=>error.code==="RESPONSE_TOO_LARGE");
});

test("timeout and aborted connection resolve to bounded errors",async()=>{
 const transport=mockTransport([{hang:true},{hang:true}]),result=await createUpdater({currentVersion,transport,timeoutMs:10}).check();assert.equal(result.errorCode,"TIMEOUT");assert.equal(transport.calls.length,2);
 await assert.rejects(requestMetadata({transport:mockTransport([{abort:true}])}),error=>error.code==="NETWORK");
});

test("invalid local version does not make a network request",async()=>{
 const transport=mockTransport([{}]),result=await createUpdater({currentVersion:"unknown",transport}).check();assert.equal(result.errorCode,"CURRENT_VERSION");assert.equal(transport.calls.length,0);
});

test("open is gated on validated fresh backend result and ignores renderer URL",async()=>{
 let time=100000;const opened=[],updater=createUpdater({currentVersion,transport:mockTransport([{}]),now:()=>time,openExternal:async url=>opened.push(url)});
 assert.equal((await updater.open({kind:"download"})).errorCode,"CHECK_REQUIRED");await updater.check();assert.equal((await updater.open({kind:"download",url:"https://evil.test"})).ok,true);assert.equal(opened[0],release().assets[0].browser_download_url);assert.equal((await updater.open({kind:"release"})).ok,true);assert.equal(opened[1],release().html_url);assert.equal((await updater.open({kind:"other"})).errorCode,"LINK_KIND");time+=5*60*1000;assert.equal((await updater.open({kind:"release"})).errorCode,"CHECK_REQUIRED");assert.equal(opened.length,2);
});

test("failed refresh invalidates old known-good release links",async()=>{
 const updater=createUpdater({currentVersion,transport:mockTransport([{}, {error:"offline"},{error:"offline"}]),openExternal:async()=>{throw Error("must not open");}});await updater.check();await updater.check({force:true});assert.equal((await updater.open({kind:"release"})).errorCode,"CHECK_REQUIRED");
});

test("release without asset opens notes but rejects download",async()=>{
 const data={...release(),assets:[]},opened=[];const updater=createUpdater({currentVersion,transport:mockTransport([{release:data}]),openExternal:async url=>opened.push(url)});await updater.check();assert.equal((await updater.open({kind:"download"})).errorCode,"NO_LINK");assert.equal((await updater.open({kind:"release"})).ok,true);assert.equal(opened[0],data.html_url);
});

test("registration exposes only check/open handlers",()=>{
 const handlers=new Map();register({ipcMain:{handle:(name,callback)=>handlers.set(name,callback)},shell:{openExternal:async()=>{}},currentVersion});assert.deepEqual([...handlers.keys()],["launcher-update-check","launcher-update-open"]);
});
