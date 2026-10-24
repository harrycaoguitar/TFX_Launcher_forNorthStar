"use strict";
const os = require("node:os");
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),vm=require("vm");
const source=path.resolve(__dirname,".."),network=require("../src/modules/northstar-region"),session=require("../src/modules/launch-session");
const base=fs.mkdtempSync(path.join(os.tmpdir(), "tfx-version-profile-"));
function fixture(){
  const root=fs.mkdtempSync(path.join(base,"game-")),profile=path.join(root,"Profiles","Custom 中文"),conf={gamepath:root,nsargs:'-profile "Profiles/Custom 中文"'},messages=[];
  fs.writeFileSync(path.join(root,"Titanfall2.exe"),"fixture");fs.writeFileSync(path.join(root,"NorthstarLauncher.exe"),"fixture");fs.writeFileSync(path.join(root,"gameversion.txt"),"v2.0.11\n");
  for(const name of ["Northstar.Client","Northstar.Custom","Northstar.CustomServers"]){const folder=path.join(profile,"mods",name);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,"mod.json"),JSON.stringify({Name:name,Version:"1.31.13"}));}
  const filename=path.join(source,"src/modules/version.js"),module={exports:{}},stubs={fs,path,electron:{ipcMain:{on(){}}},"../win":()=>({send:(...value)=>messages.push(value)}),"./settings":()=>conf,"./launch-session":session,"./northstar-region":network,"./findgame":{validateGamePath:value=>value===root?root:false},"./json":file=>JSON.parse(fs.readFileSync(file,"utf8")),"./launcher-version":()=>"1.0.7","../../package.json":{version:"1.0.0"},"./northstar-clients":{status:async(region,captured)=>{conf.nsargs="-profile Other";return {version:"1.31.13",captured};}}};
  vm.runInNewContext("(function(require,module,exports){"+fs.readFileSync(filename,"utf8")+"\n})",{Buffer,process,console},{filename})(id=>stubs[id],module,module.exports);
  return {api:module.exports,root,profile,conf,messages};
}
test("installed version follows the selected custom profile rather than R2Northstar",()=>{const f=fixture();assert.equal(f.api.northstar(),"v1.31.13");assert.equal(f.api.titanfall(),"v2.0.11");});
test("mismatched core names or versions cannot identify an installed client",()=>{for(const body of [{Name:"Other",Version:"1.31.13"},{Name:"Northstar.Client",Version:"1.31.12"},{Name:"Northstar.Client",Version:"wrong"}]){const f=fixture();fs.writeFileSync(path.join(f.profile,"mods/Northstar.Client/mod.json"),JSON.stringify(body));assert.equal(f.api.northstar(),"unknown");}});
test("invalid profile, missing game, directory launcher and oversized version files report unknown",()=>{const f=fixture();f.conf.nsargs='-profile "../../outside"';assert.equal(f.api.northstar(),"unknown");f.conf.nsargs='-profile "Profiles/Custom 中文"';fs.rmSync(path.join(f.root,"NorthstarLauncher.exe"));fs.mkdirSync(path.join(f.root,"NorthstarLauncher.exe"));assert.equal(f.api.northstar(),"unknown");fs.writeFileSync(path.join(f.root,"gameversion.txt"),"x".repeat(4097));assert.equal(f.api.titanfall(),"unknown");f.conf.gamepath="missing";assert.equal(f.api.northstar(),"unknown");assert.equal(f.api.titanfall(),"unknown");});
test("version send captures one selection across asynchronous status check and tolerates closed renderer",async()=>{const f=fixture();await f.api.send_info();assert.equal(f.messages[0][1].ns,"v1.31.13");assert.equal(f.messages[0][1].client.captured.nsargs,'-profile "Profiles/Custom 中文"');assert.deepEqual(JSON.parse(JSON.stringify(f.messages[0][1].clientContext)),{gamePath:f.root,nsargs:'-profile "Profiles/Custom 中文"',region:'cn'});assert.equal(f.api.launcher(),"1.0.7");assert.equal(f.api.viper(),"1.0.7");});

test.after(() => {
  assert.equal(path.dirname(base), path.resolve(os.tmpdir()));
  assert(path.basename(base).startsWith("tfx-version-profile-"));
  const stat = fs.lstatSync(base); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(base, {recursive: true, force: true});
});
