'use strict';
const crypto=require('node:crypto'),net=require('node:net');
const {requestBuffer}=require('./http-resource');
const URL='https://ms.r1delta.net/servers';
const clean=(value,max=150)=>String(value??'').replace(/\^[0-9a-f]{8}/gi,'').replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,max);
const count=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(10000,Math.trunc(Number(value)))):0;
function normalize(payload){
  if(!Array.isArray(payload))throw Error('Delta 服务器列表格式无效');
  return payload.slice(0,500).flatMap(row=>{
    if(!row||typeof row!=='object'||!net.isIP(row.ip)||!Number.isInteger(row.port)||row.port<1||row.port>65535)return [];
    const address=(net.isIP(row.ip)===6?'['+row.ip+']':row.ip)+':'+row.port;
    return [{key:crypto.createHash('sha256').update('delta:'+address).digest('hex').slice(0,24),name:clean(row.host_name)||'Delta',map:clean(row.map_name,100),mode:clean(row.playlist_display_name||row.game_mode,100).replace(/^#PL_/i,'').replace(/_/g,' '),players:count(row.total_players),maxPlayers:count(row.max_players),description:clean(row.description,1000),version:clean(row.version,40),password:row.has_password===true,auth:row.has_auth===true,address}];
  });
}
async function fetchServers(){const result=await requestBuffer(URL,{allowURL:url=>url.hostname==='ms.r1delta.net',timeoutMs:12000,maxBytes:2*1024*1024});return JSON.parse(result.bytes.toString('utf8'));}
function createService({core,fetch=fetchServers,now=Date.now,clipboard}){
  let cache=null,inflight=null,attempted=0,lastError='';const favorites=new Set();
  async function get(input={}){
    if(inflight)return inflight;
    const age=cache?now()-cache.fetchedAt:Infinity;
    if(cache&&age<(input.force?5000:60000))return {...cache,status:lastError?'stale':'online',error:lastError};
    if(attempted&&now()-attempted<5000)return {ok:true,servers:cache?.servers||[],fetchedAt:cache?.fetchedAt||null,status:cache?'stale':'unavailable',error:lastError};
    attempted=now();inflight=(async()=>{try{cache={ok:true,servers:normalize(await fetch()),fetchedAt:now(),source:URL};lastError='';return {...cache,status:'online'};}
      catch(error){lastError=error.message;return {ok:true,servers:cache?.servers||[],fetchedAt:cache?.fetchedAt||null,status:cache?'stale':'unavailable',error:lastError,source:URL};}finally{inflight=null;}})();return inflight;
  }
  async function selected(key){await get();const server=cache?.servers.find(row=>row.key===key);if(!server)throw Error('服务器已离线，请刷新列表');return server;}
  async function join(input={},progress=()=>{},exited=()=>{}){
    const server=await selected(input.key);if(server.password&&(typeof input.password!=='string'||!input.password))throw Error('此服务器需要密码');
    const password=input.password||'';if(password.length>128||/[";\r\n\x00]/.test(password))throw Error('服务器密码包含不支持的字符');
    const args=[...(server.auth?['+delta_online_auth_enable','1']:[]),...(password?['+password',password]:[]),'+delta_connect',server.address];
    return core.launch(progress,exited,{args});
  }
  async function copy(key){const server=await selected(key);clipboard.writeText(server.address);return {ok:true};}
  return {get,join,copy};
}
function register(electron,core,options={}){
  const service=createService({core,clipboard:electron.clipboard,...options}),send=event=>value=>{if(!event.sender.isDestroyed())event.sender.send('r1delta-progress',value);};
  for(const[channel,handler]of Object.entries({'r1delta-servers':(_event,input)=>service.get(input),'r1delta-server-join':(event,input)=>service.join(input,send(event),send(event)),'r1delta-server-copy':(_event,key)=>service.copy(key)}))electron.ipcMain.handle(channel,async(...args)=>{try{return await handler(...args);}catch(error){return {ok:false,error:error.message};}});
  return service;
}
module.exports={normalize,createService,register,fetchServers};
