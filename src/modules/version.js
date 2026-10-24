"use strict";
const fs=require("fs"),path=require("path"),{ipcMain}=require("electron"),win=require("../win"),settings=require("./settings");
const {splitArguments}=require("./launch-session"),network=require("./northstar-region"),findgame=require("./findgame");
const launcherVersion=require("./launcher-version")();
function regularFile(filename,maxBytes) {
  try {const stat=fs.lstatSync(filename);return stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=maxBytes;}catch(_){return false;}
}
function northstar(conf=settings()) {
  const root=findgame.validateGamePath(conf.gamepath);if(!root||!regularFile(path.join(root,"NorthstarLauncher.exe"),128*1024*1024))return "unknown";
  let profile;try{profile=network.resolveProfile(root,splitArguments(conf.nsargs||""));}catch(_){return "unknown";}
  const versions=[];
  for(const name of ["Northstar.Client","Northstar.Custom","Northstar.CustomServers"]){
    const filename=path.join(profile,"mods",name,"mod.json");
    try{
      if(!regularFile(filename,1024*1024))return "unknown";
      const mod=require("./json")(filename),stored=String(mod?.Version??"").trim().replace(/^v/i,"");
      if(mod?.Name!==name||!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(stored))return "unknown";
      versions.push(stored);
    }catch(_){return "unknown";}
  }
  return versions.every(value=>value===versions[0])?"v"+versions[0]:"unknown";
}
function titanfall(conf=settings()) {
  const root=findgame.validateGamePath(conf.gamepath);if(!root)return "unknown";
  const filename=path.join(root,"gameversion.txt");
  try{return regularFile(filename,4096)?fs.readFileSync(filename,"utf8").trim()||"unknown":"unknown";}catch(_){return "unknown";}
}
const version={northstar,titanfall,launcher:()=>launcherVersion,viper:()=>launcherVersion};
version.send_info=async()=>{
  const conf={...settings()},clientContext={gamePath:conf.gamepath||"",nsargs:conf.nsargs||"",region:network.normalize(conf.northstarRegion)};
  const client=await require("./northstar-clients").status(conf.northstarRegion,conf);
  try {win().send("version",{ns:northstar(conf),tf2:titanfall(conf),vp:"v"+launcherVersion,client,clientContext});}catch(_){/* A closed renderer does not invalidate the client check. */}
};
ipcMain.on("get-version",()=>{void version.send_info();});
module.exports=version;
