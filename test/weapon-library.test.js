"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),fsp=fs.promises,path=require("path"),os=require("os"),crypto=require("crypto");
const {buildLibrary,ddsItems,vtfItems,modItems,scanModAssets,latestSwitches,register}=require("../src/modules/weapon-library");
const {weapons}=require("../src/modules/weapon-library-catalogue");
const id=()=>crypto.randomUUID(),stamp=n=>new Date(1700000000000+n*1000).toISOString(),row=(name,offset=10)=>({name,family:name.replace(/_(col|nml)\.dds$/,""),target:"pc_stream.starpak",offset,length:8,beforeHash:"a".repeat(64),afterHash:"b".repeat(64),role:"skin"});
const dds=(name,rows,n=0,state="installed")=>({manifest:{version:1,id:id(),gamePath:"/game",name,createdAt:stamp(n),state,records:rows}});
async function temporary(t){const dir=await fsp.mkdtemp(path.join(os.tmpdir(),"tfx-arsenal-"));t.after(()=>fsp.rm(dir,{recursive:true,force:true}));return dir;}
async function file(name,value="skin"){await fsp.mkdir(path.dirname(name),{recursive:true});await fsp.writeFile(name,value);}
async function snapshot(root){const result=[];async function visit(dir){for(const entry of await fsp.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await visit(full);else{const stat=await fsp.stat(full);result.push({path:path.relative(root,full),mtime:stat.mtimeMs,size:stat.size,sha:crypto.createHash("sha256").update(await fsp.readFile(full)).digest("hex")});}}}await visit(root);return result.sort((a,b)=>a.path.localeCompare(b.path));}
test("every catalogued weapon has a unique authored, bounded side-profile",()=>{
 assert.equal(weapons.length,40);assert.equal(new Set(weapons.map(w=>w.id)).size,40);assert.equal(new Set(weapons.map(w=>w.outline)).size,40);
 for(const weapon of weapons){assert.match(weapon.id,/^[a-z0-9_]+$/);assert.ok(weapon.category);assert.match(weapon.outline,/^M/);assert.match(weapon.detail,/^M/);const coordinates=(weapon.outline+' '+weapon.detail).match(/-?\d+(?:\.\d+)?/g).map(Number);assert.ok(coordinates.every(n=>n>=0&&n<=160),weapon.id);}
});
test("DDS ownership uses resource names, never an archive title",()=>{
 const journals=[dds("CAR and Mastiff skin",[row("r201_default_col.dds")])];const result=ddsItems(journals,new Map());assert.deepEqual(result[0].weaponIds,["r201"]);assert.equal(result[0].evidence,"resource-path");
});
test("DDS reset-only records stay absent; overwritten and restored skin records retain their history without active scopes",()=>{
 const first=dds("first",[row("car_default_col.dds")]),second=dds("second",[row("car_default_col.dds")],1),reset=dds("reset",[{...row("r201_default_col.dds",30),role:"reset"}],2),restored=dds("restored",[row("mastiff_default_col.dds",50)],3,"restored");
 const result=ddsItems([first,second,reset,restored],new Map());assert.equal(result.length,3);assert.equal(result[0].state,"replaced");assert.equal(result[1].state,"installed");assert.equal(result[2].state,"restored");assert.deepEqual(result[2].activeWeaponIds,[]);assert.equal(result[2].sourceId,restored.manifest.id);
});
test("DDS records spanning weapons retain exact active weapon assignments",()=>{
 const first=dds("both",[row("car_default_col.dds"),row("r201_default_col.dds",30)]),second=dds("CAR replacement",[row("car_default_col.dds")],1);const result=ddsItems([first,second],new Map());assert.deepEqual(result[0].weaponIds,["car","r201"]);assert.deepEqual(result[0].activeWeaponIds,["r201"]);assert.equal(result[0].state,"installed");
});
test("later committed opposite-format switches retire older weapon records",()=>{
 const latest=latestSwitches([{state:"installed",format:"vtf",createdAt:stamp(2),weapons:["car"]},{state:"restored",format:"dds",createdAt:stamp(3),weapons:["car"]}]);assert.equal(ddsItems([dds("CAR",[row("car_default_col.dds")])],latest)[0].state,"replaced");
});
test("VTF state follows its actual current index; absent index is explicitly recorded",()=>{
 const m={id:id(),state:"installed",name:"1234",createdAt:stamp(0),archiveIndex:45,files:[{path:"materials/models/weapons/car/car_col.vtf"}]};
 assert.equal(vtfItems([m],new Map(),new Map([[m.files[0].path,45]]))[0].state,"installed");assert.equal(vtfItems([m],new Map(),new Map([[m.files[0].path,1]]))[0].state,"replaced");assert.equal(vtfItems([m],new Map(),null)[0].state,"recorded");
});
test("ambiguous/shared asset names are unassigned instead of associated with two guns",()=>{
 const m={id:id(),state:"installed",name:"CAR skin",createdAt:stamp(0),archiveIndex:12,files:[{path:"materials/shared/car/r97/sight.vtf"}]};assert.deepEqual(vtfItems([m],new Map(),null)[0].weaponIds,[]);
});
test("Mod skins map from loose materials/models and preserve disabled state",async t=>{
 const root=await temporary(t),folder=path.join(root,"mods","Example");await file(path.join(folder,"mod","materials","models","weapons","car","body.vtf"));const result=await modItems(root,[{name:"1234",folder_path:folder,disabled:true,addedAt:1700000000000}],[]);assert.equal(result.length,1);assert.deepEqual(result[0].weaponIds,["car"]);assert.equal(result[0].state,"disabled");assert.equal(result[0].format,"mod");
});
test("Mod skin metadata can identify an exact weapon without guessing from descriptions",async t=>{
 const root=await temporary(t),a=path.join(root,"mods","a"),b=path.join(root,"mods","b"),c=path.join(root,"mods","c");for(const folder of [a,b,c])await file(path.join(folder,"mod.json"),"{}");
 const rows=await modItems(root,[{name:"CAR skin 1234",folder_path:a},{name:"Skin 5678",description:"Works alongside CAR and R97",folder_path:b},{name:"CAR balancing",description:"changes CAR damage",folder_path:c}],[]);
 assert.equal(rows.length,2);assert.deepEqual(rows[0].weaponIds,["car"]);assert.equal(rows[0].evidence,"metadata-name");assert.deepEqual(rows[1].weaponIds,[]);
});
test("Mod scanning refuses outside-profile paths and links instead of traversing them",async t=>{
 const root=await temporary(t),game=path.join(root,"game"),other=path.join(root,"other");await fsp.mkdir(game);await file(path.join(other,"mod","materials","car","body.vtf"));await assert.rejects(()=>scanModAssets(game,{folder_path:other},{files:0}),/outside/);
 const folder=path.join(game,"mods","Example");await fsp.mkdir(folder,{recursive:true});try{await fsp.symlink(other,path.join(folder,"mod"),process.platform==="win32"?"junction":"dir");}catch(error){if(error.code==="EPERM"){t.skip("Creating a link is not available on this filesystem");return;}throw error;}
 await assert.rejects(()=>scanModAssets(game,{folder_path:folder},{files:0}),/Linked/);
});
test("combined library reads real journals and Mod files without changing any bytes or timestamps",async t=>{
 const root=await temporary(t),game=path.join(root,"game"),ddsDir=path.join(root,"dds"),vtfDir=path.join(root,"vtf"),folder=path.join(game,"R2Northstar","mods","1234");await file(path.join(game,"Titanfall2.exe"),"fixture");await file(path.join(folder,"mod","materials","weapons","r97","skin.vtf"));
 const m=dds("DDS 1234",[row("car_default_col.dds")]).manifest;m.gamePath=game;await file(path.join(ddsDir,"backups",m.id,"manifest.json"),JSON.stringify(m));
 const v={version:1,id:id(),gamePath:game,state:"installed",name:"VTF 1234",createdAt:stamp(1),archiveIndex:12,files:[{path:"materials/weapons/volt/skin.vtf"}]};await file(path.join(vtfDir,"backups",v.id,"manifest.json"),JSON.stringify(v));
 const before=await snapshot(root),result=await buildLibrary({gamePath:game,dds:{baseDir:ddsDir,initialize(){throw Error("must not initialize");}},vtf:{baseDir:vtfDir},mods:[{name:"Mod 1234",folder_path:folder}],readVtfIndex:async()=>new Map([[v.files[0].path,12]])});
 assert.equal(result.ok,true);assert.equal(result.items.length,3,JSON.stringify(result));assert.deepEqual(new Set(result.items.map(item=>item.format)),new Set(["dds","vtf","mod"]));assert.deepEqual(await snapshot(root),before);assert.equal(fs.existsSync(path.join(ddsDir,"packages")),false);
});
test("missing game or bad journal/index reports partial scope instead of making game repairs",async t=>{
 const root=await temporary(t);const result=await buildLibrary({gamePath:root,dds:{baseDir:root},readDds:async()=>{throw Error("broken");},vtf:{baseDir:root},readRecords:async(_root,_game,filename)=>filename==="manifest.json"?[{id:id(),state:"installed",name:"1234",createdAt:stamp(0),archiveIndex:3,files:[{path:"materials/weapons/car/a.vtf"}]}]:[],readVtfIndex:async()=>{throw Error("missing");}});
 assert.deepEqual(result.warnings,["records-unavailable","vtf-index-unavailable"]);assert.equal(result.items[0].state,"recorded");const empty=await buildLibrary({gamePath:""});assert.deepEqual(empty.items,[]);assert.deepEqual(empty.warnings,["game-unavailable"]);
});
test("list IPC stays read-only, serializes duplicate requests and rejects changed game settings alongside separate restore IPC",async t=>{
 const root=await temporary(t),channels=new Map();await file(path.join(root,"Titanfall2.exe"),"fixture");let settingsPath=root,reads=0;register({dds:{baseDir:path.join(root,"dds")},vtf:{baseDir:path.join(root,"vtf")},mods:{list(options){assert.equal(options.readOnly,true);reads++;return {all:[]};}},settings:()=>({gamepath:settingsPath}),ipcMain:{handle:(channel,handler)=>channels.set(channel,handler)}});
 assert.deepEqual([...channels.keys()],["weapon-library-list","weapon-library-prune","weapon-library-restore"]);const call=channels.get("weapon-library-list"),one=call(),two=call();settingsPath=root+"-changed";const results=await Promise.all([one,two]);assert.equal(reads,1);assert.deepEqual(results,[{ok:false,error:"STALE_WEAPON_LIBRARY"},{ok:false,error:"STALE_WEAPON_LIBRARY"}]);
});
