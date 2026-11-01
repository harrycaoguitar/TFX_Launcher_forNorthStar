"use strict";
// Listing is a read-only view of journals and the selected Mod profile.
// The separate restore IPC applies a journaled, selected-weapon stock plan.
const fs=require("fs"),fsp=fs.promises,path=require("path");
const {retired,validRecord,textureFamily}=require("./dds-replacement");
const {readRecord,assertUnlinkedAncestors}=require("./backup-records");
const {weaponsFor}=require("./skin-switch-weapons");
const {parseIndex,readIndexFile}=require("./vtf-vpk");
const {weapons}=require("./weapon-library-catalogue");
const gameRoots=require("./game-roots");
const {consumedScopes,annotateBackupAvailability,annotateStateAvailability,stateHistory}=require("./weapon-backup-scopes");
const IDS=new Set(weapons.map(weapon=>weapon.id)),UUID=/^[a-f0-9-]{36}$/,LIMITS=Object.freeze({journals:3000,mods:2000,files:20000,depth:30,items:6000});
const clean=value=>typeof value==="string"?value.replace(/[\x00-\x1f]/g,"").slice(0,200):"";
const canonical=value=>{try{return fs.realpathSync.native(path.resolve(value)).toLowerCase();}catch{return path.resolve(value).toLowerCase();}};
const equal=(a,b)=>canonical(a)===canonical(b);
const inside=(root,file)=>{const relative=path.relative(path.resolve(root),path.resolve(file));return relative!==".."&&!relative.startsWith(".."+path.sep)&&!path.isAbsolute(relative);};
function owners(value,format){const found=weaponsFor(value,format).filter(id=>IDS.has(id));return found.length===1?found:[];}
function warning(warnings,code){if(!warnings.includes(code))warnings.push(code);}
async function records(root,gamePath,filename="manifest.json",warnings=[]){
  const result=[];let entries;
  try{await assertUnlinkedAncestors(root);entries=await fsp.readdir(root,{withFileTypes:true});}
  catch(error){if(error.code!=="ENOENT")warning(warnings,"records-unavailable");return result;}
  for(const entry of entries){
    if(!UUID.test(entry.name))continue;
    if(result.length>=LIMITS.journals){warning(warnings,"scan-limited");break;}
    if(!entry.isDirectory()||entry.isSymbolicLink()){warning(warnings,"records-unavailable");continue;}
    try{const {manifest}=await readRecord(root,entry.name,gamePath,filename,{allowOtherGames:true});
      if(!equal(manifest.gamePath,gamePath))continue;
      if(!Number.isFinite(Date.parse(manifest.createdAt)))throw Error("Invalid record time");
      result.push(manifest);
    }catch{warning(warnings,"records-unavailable");}
  }
  return result.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
async function ddsJournals(baseDir,gamePath,warnings=[]){
 const manifests=await records(path.join(baseDir,"backups"),gamePath,"manifest.json",warnings),result=[];
 for(const manifest of manifests){if(!Array.isArray(manifest.records)||manifest.records.length>3000||!manifest.records.every(row=>validRecord(row)&&(!row.family||row.family===textureFamily(row.name)))){warning(warnings,"records-unavailable");continue;}result.push({manifest,dir:path.join(baseDir,"backups",manifest.id)});}
 return result;
}
function latestSwitches(transactions){
  const latest=new Map(),consumed=consumedScopes(transactions);
  for(const tx of transactions)if(tx.state==="installed"&&["dds","vtf"].includes(tx.format)&&Array.isArray(tx.weapons))for(const id of tx.weapons)if(IDS.has(id)){
    if(consumed.get(tx.format+":"+tx.incomingBackupId)?.has(id))continue;
    const before=latest.get(id);if(!before||tx.createdAt>before.createdAt)latest.set(id,tx);
  }
  return latest;
}
function originalRestores(transactions){
 const latest=new Map();
 for(const tx of transactions)if(tx.purpose==="weapon-original"&&tx.state==="restored"&&Array.isArray(tx.weapons))for(const id of tx.weapons)if(IDS.has(id)&&(!latest.has(id)||latest.get(id)<tx.createdAt))latest.set(id,tx.createdAt);
 return latest;
}
function recoveryRows(journals,manifests,transactions){
 const rows=[],linked=new Set(transactions.filter(tx=>!["cancelled","rolled-back","restored"].includes(tx.state)).map(tx=>tx.incomingBackupId).filter(Boolean));
 for(const tx of transactions)if(!["installed","restored","rolled-back","cancelled"].includes(tx.state))rows.push({id:"switch:"+tx.id,name:clean(tx.name),format:tx.format,weaponIds:(tx.weapons||[]).filter(id=>IDS.has(id)),state:tx.state,kind:"switch",canRecover:true});
 for(const [format,values]of [["dds",journals.map(entry=>entry.manifest)],["vtf",manifests]])for(const m of values)if(["pending","preparing"].includes(m.state)&&!linked.has(m.id))rows.push({id:format+":"+m.id,name:clean(m.name),format,weaponIds:[...new Set((format==="dds"?m.records||[]:m.files||[]).flatMap(row=>owners(format==="dds"?row.name:row.path,format)))],state:m.state,kind:format,canRecover:m.state!=="preparing"||format==="vtf"});
 return rows;
}
function recoveryAvailability(items,transactions,warnings=[]){
 const restored=originalRestores(transactions),consumed=consumedScopes(transactions),latest=latestSwitches(transactions),blocked=warnings.includes("records-unavailable")||warnings.includes("scan-limited");
 const committed=new Map(transactions.filter(tx=>tx.state==="installed"&&tx.incomingBackupId).map(tx=>[tx.format+":"+tx.incomingBackupId,tx.createdAt]));
 for(const item of items){
  if(item.format==="mod"){item.canRestore=false;item.restoreWeaponIds=[];continue;}
  const effectiveTime=committed.get(item.id)||item.installedAt;
  item.restoredWeaponIds=item.weaponIds.filter(id=>(restored.get(id)||"")>=effectiveTime||consumed.get(item.id)?.has(id));
  const previous=item.activeWeaponIds||item.weaponIds;
  item.activeWeaponIds=previous.filter(id=>!item.restoredWeaponIds.includes(id)&&!(latest.get(id)?.format!==item.format&&latest.get(id)?.createdAt>=effectiveTime));
  if(item.weaponIds.length&&item.restoredWeaponIds.length===item.weaponIds.length)item.state="restored";
  item.restoreWeaponIds=!blocked&&item.state==="installed"?item.activeWeaponIds:[];
  item.canRestore=item.restoreWeaponIds.length>0;item.restoreMode="original";
 }
 return [...new Set(items.flatMap(item=>item.restoreWeaponIds))];
}
function supersededBySwitch(item,latest){return item.weaponIds.length>0&&item.weaponIds.every(id=>{const tx=latest.get(id);return tx&&tx.format!==item.format&&tx.createdAt>=item.installedAt;});}
function ddsItems(journals,latest,consumed=new Map()){
  const result=[];
  for(let index=0;index<journals.length;index++){
    const entry=journals[index],m=entry.manifest;if(!["installed","restored"].includes(m.state))continue;
    const rows=m.records.filter(row=>row.role!=="reset"),active=rows.filter(row=>{
      const ids=owners(row.name,"dds");if(ids.some(id=>consumed.get("dds:"+m.id)?.has(id)))return false;
      const relevant=journals.filter(other=>!ids.some(id=>consumed.get("dds:"+other.manifest.id)?.has(id)));
      return !retired(entry,row,relevant)&&!journals.slice(index+1).some(later=>["installed","pending"].includes(later.manifest.state)&&!ids.some(id=>consumed.get("dds:"+later.manifest.id)?.has(id))&&later.manifest.records.some(next=>next.target===row.target&&next.offset<row.offset+row.length&&row.offset<next.offset+next.length));
    });
    const ids=[...new Set(rows.flatMap(row=>owners(row.name,"dds")))],activeWeaponIds=[...new Set(active.flatMap(row=>owners(row.name,"dds")))];
    const item={id:"dds:"+m.id,sourceId:m.id,format:"dds",name:clean(m.name)||"DDS",installedAt:m.createdAt,weaponIds:ids,activeWeaponIds:m.state==="restored"?[]:activeWeaponIds,count:rows.length,state:m.state==="restored"?"restored":active.length?"installed":"replaced",evidence:ids.length?"resource-path":"unassigned"};
    if(supersededBySwitch(item,latest))item.state="replaced";
    if(rows.length)result.push(item);
  }
  return result;
}
function vtfItems(manifests,latest,index){
  const result=[];
  for(const m of manifests){
    if(!["installed","restored"].includes(m.state)||!Array.isArray(m.files)||m.files.length>2000||!Number.isInteger(m.archiveIndex))continue;
    const files=m.files.filter(row=>typeof row.path==="string"&&/^(?:materials|models)\//i.test(row.path)),ids=[...new Set(files.flatMap(row=>owners(row.path,"vtf")))];
    let state="recorded";
    if(index)state=files.some(row=>index.get(row.path.toLowerCase())===m.archiveIndex)?"installed":"replaced";
    const activeWeaponIds=index?[...new Set(files.filter(row=>index.get(row.path.toLowerCase())===m.archiveIndex).flatMap(row=>owners(row.path,"vtf")))]:[];
    const item={id:"vtf:"+m.id,sourceId:m.id,format:"vtf",name:clean(m.name)||"VTF",installedAt:m.createdAt,weaponIds:ids,activeWeaponIds:m.state==="restored"?[]:activeWeaponIds,count:files.length,state:m.state==="restored"?"restored":state,evidence:ids.length?"resource-path":"unassigned"};
    if(supersededBySwitch(item,latest))item.state="replaced";
    if(files.length)result.push(item);
  }
  return result;
}
async function scanModAssets(gamePath,mod,budget){
  const requested=path.resolve(mod.folder_path||".");await assertUnlinkedAncestors(requested);const root=await fsp.realpath(requested),canonicalGame=await fsp.realpath(gamePath);if(!inside(canonicalGame,root))throw Error("Mod is outside the selected game");
  const base=path.join(root,"mod"),found=new Set();let resources=0,opaque=false;
  const stack=[{directory:root,depth:0}];
  while(stack.length){
    const {directory,depth}=stack.pop();if(depth>LIMITS.depth)throw Error("Mod scan depth limit");
    await assertUnlinkedAncestors(directory);const stat=await fsp.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error("Linked Mod folder");
    for(const item of await fsp.readdir(directory,{withFileTypes:true})){
      if(++budget.files>LIMITS.files)throw Error("Mod scan file limit");
      if(item.isSymbolicLink())throw Error("Linked Mod asset");
      const file=path.join(directory,item.name);
      if(item.isDirectory()){
        // Only the loose resource tree participates. Scripts/cache/log trees
        // are irrelevant; packed resource directories remain unassigned.
        if(directory===root){if(item.name.toLowerCase()==="mod")stack.push({directory:file,depth:depth+1});else if(["vpk","paks"].includes(item.name.toLowerCase()))opaque=true;}
        else stack.push({directory:file,depth:depth+1});
      }else if(item.isFile()){
        const relative=path.relative(base,file).split(path.sep).join("/");
        if(/\.(?:rpak|vpk)$/i.test(item.name))opaque=true;
        if(/^(?:materials|models)\//i.test(relative)&&/\.(?:vtf|vmt|mdl|vvd|vtx|dds)$/i.test(relative)){
          resources++;for(const id of owners(relative,"vtf"))found.add(id);
        }
      }else throw Error("Unsupported Mod asset");
    }
  }
  return {weaponIds:[...found],resources,opaque};
}
async function modItems(gamePath,mods,warnings,scan=scanModAssets){
  const result=[],budget={files:0},seen=new Set();
  if(mods.length>LIMITS.mods)warning(warnings,"scan-limited");
  for(const mod of mods.slice(0,LIMITS.mods)){
    if(mod.required||!mod.folder_path)continue;
    const key=path.resolve(mod.folder_path).toLowerCase();if(seen.has(key))continue;seen.add(key);
    try{
      const assets=await scan(gamePath,mod,budget),skinLabel=/(?:\bskins?\b|reskin|皮肤|皮膚|涂装|塗裝|外观|外觀)/i.test([mod.name,mod.manifest_name,mod.description].filter(Boolean).join(" "));
      if(!assets.resources&&!skinLabel&&!assets.opaque)continue;
      // Metadata names may explicitly identify a gun, but a description alone
      // cannot attach a generic gameplay Mod to every weapon it mentions.
      const named=owners(String(mod.name||"").replace(/[^a-z0-9_.-]/gi,"_"),"vtf"),ids=assets.weaponIds.length?assets.weaponIds:skinLabel?named:[];
      result.push({id:"mod:"+key,sourceId:clean(mod.name),format:"mod",name:clean(mod.name)||"Mod",installedAt:typeof mod.addedAt==="number"?new Date(mod.addedAt).toISOString():typeof mod.addedAt==="string"&&Number.isFinite(Date.parse(mod.addedAt))?mod.addedAt:"",weaponIds:ids,count:assets.resources,state:mod.disabled?"disabled":"enabled",evidence:assets.weaponIds.length?"resource-path":ids.length?"metadata-name":"unassigned"});
    }catch{warning(warnings,budget.files>LIMITS.files?"scan-limited":"mod-scan-incomplete");}
    if(budget.files>LIMITS.files)break;
  }
  return result;
}
async function buildLibrary({gamePath,dds,vtf,mods=[],switchDir,readDds=ddsJournals,readRecords=records,readVtfIndex=async root=>new Map(parseIndex(await readIndexFile(path.join(root,"vpk","englishclient_mp_common.bsp.pak000_dir.vpk"))).entries.map(row=>[row.path.toLowerCase(),row.index])),scan=scanModAssets}={}){
  const result={ok:true,version:1,weapons,items:[],recoveries:[],restoreWeaponIds:[],stateRestoreWeaponIds:[],stateCurrentRecordByWeapon:{},stateOriginalCurrentWeaponIds:[],warnings:[],scope:"launcher-records-and-selected-profile"};
  if(typeof gamePath!=="string"||!gamePath.trim()){result.warnings.push("game-unavailable");return result;}
  let root;try{await assertUnlinkedAncestors(path.resolve(gamePath));root=await fsp.realpath(path.resolve(gamePath));}catch{result.warnings.push("game-unavailable");return result;}
  const warnings=result.warnings;
  let journals=[],manifests=[],transactions=[],index=null;
  if(dds?.baseDir)try{journals=await readDds(dds.baseDir,root,warnings);if(journals.length>LIMITS.journals){journals=journals.slice(-LIMITS.journals);warning(warnings,"scan-limited");}}catch(error){if(error.code!=="ENOENT")warning(warnings,"records-unavailable");}
  if(vtf?.baseDir)manifests=await readRecords(path.join(vtf.baseDir,"backups"),root,"manifest.json",warnings);
  if(switchDir)transactions=await readRecords(switchDir,root,"transaction.json",warnings);
  if(manifests.some(m=>m.state==="installed"))try{index=await readVtfIndex(root);}catch{warning(warnings,"vtf-index-unavailable");}
  const latest=latestSwitches(transactions);
  result.items=[...ddsItems(journals,latest,consumedScopes(transactions)),...vtfItems(manifests,latest,index),...await modItems(root,mods,warnings,scan)].sort((a,b)=>b.installedAt.localeCompare(a.installedAt)||a.name.localeCompare(b.name));
  if(result.items.length>LIMITS.items){result.items=result.items.slice(0,LIMITS.items);warning(warnings,"scan-limited");}
  result.recoveries=recoveryRows(journals,manifests,transactions);
  result.restoreWeaponIds=recoveryAvailability(result.items,transactions,warnings);
  if(result.recoveries.length){result.restoreWeaponIds=[];for(const item of result.items){item.canRestore=false;item.restoreWeaponIds=[];}}
  // Metadata preflight is read-only. Expensive content hashes are authenticated
  // inside the locked restore planner immediately before the journal is built.
  for(const item of result.items)if(item.format!=="mod"){
   const m=item.format==="dds"?journals.find(entry=>entry.manifest.id===item.sourceId)?.manifest:manifests.find(value=>value.id===item.sourceId),links=transactions.filter(tx=>tx.format===item.format&&tx.incomingBackupId===item.sourceId);
   item.sourceState=m.state;
   if(links.length>1||m?.skinSwitchId&&links[0]?.id!==m.skinSwitchId)item.stateRecordUnavailable="chain-incomplete";
   if(item.format==="vtf")try{const file=path.join(root,"vpk",require("./vtf-engine").archiveName(m.archiveIndex));await assertUnlinkedAncestors(file);if(!(await fsp.lstat(file)).isFile())throw Error("missing");}catch{item.stateRecordUnavailable="archive-unavailable";}
  }
  annotateBackupAvailability(result.items,transactions,{pending:result.recoveries.length>0,blockedReason:warnings.includes("records-unavailable")||warnings.includes("scan-limited")?"records-unavailable":""});
  result.stateRestoreWeaponIds=annotateStateAvailability(result.items,transactions,{pending:result.recoveries.length>0,blockedReason:warnings.includes("records-unavailable")||warnings.includes("scan-limited")?"records-unavailable":""});
  for(const id of new Set(result.items.filter(item=>item.format!=="mod").flatMap(item=>item.weaponIds))){const history=stateHistory(result.items,transactions,id);if(history.complete){result.stateCurrentRecordByWeapon[id]=history.current;if(history.current===null)result.stateOriginalCurrentWeaponIds.push(id);}}
  return result;
}
function register({dds,vtf,mods,settings,switchDir,ipcMain=require("electron").ipcMain,getCoordinator=()=>require("./skin-switch").getActive(),operationGate=require("./dds-operation-gate")}={}){
  let running=null;
  const selectedGamePath=()=>gameRoots.gameRootForProfile(settings());
  const isCurrentRoot=gamePath=>{try{return gameRoots.sameRoot(selectedGamePath(),gamePath);}catch{return false;}};
  async function list(){
    const saved=settings(),gamePath=gameRoots.gameRootForProfile(saved);let library=[],modWarning=false;
    try{library=mods.list({readOnly:true}).all;}catch{modWarning=true;}
    const result=await buildLibrary({gamePath,dds,vtf,mods:library,switchDir:switchDir||path.join(path.dirname(dds.baseDir),"skin-switch")});
    if(!isCurrentRoot(gamePath))return {ok:false,error:"STALE_WEAPON_LIBRARY"};
    if(modWarning)warning(result.warnings,"mod-scan-incomplete");return result;
  }
  ipcMain.handle("weapon-library-list",async()=>{
    if(running)return running;
    running=list().catch(()=>({ok:false,error:"WEAPON_LIBRARY_UNAVAILABLE"}));
    try{return await running;}finally{running=null;}
  });
  ipcMain.handle("weapon-library-prune",async(_event,input={})=>{
    const gamePath=selectedGamePath();
    try{
      if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length)throw Error("WEAPON_RECOVERY_INVALID_REQUEST");
      if(operationGate.busy||dds.busy||vtf.busy||dds.sharedImportBusy||vtf.sharedImportBusy||dds.isImportBusy?.()||vtf.isImportBusy?.())throw Error("WEAPON_RECOVERY_BUSY");
      return await operationGate.run("weapon-library-prune",async()=>{
        const coordinator=getCoordinator();if(!coordinator)throw Error("WEAPON_RECOVERY_UNAVAILABLE");
        return coordinator.locked(gamePath,async root=>({ok:true,...await require("./weapon-backup-prune").pruneUnlinkedBackups({coordinator,gamePath:root,stillCurrent:()=>isCurrentRoot(gamePath)})}));
      });
    }catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle("weapon-library-restore",async(event,input={})=>{
    const progress=data=>{if(event?.sender&&!event.sender.isDestroyed())event.sender.send("weapon-library-progress",data);};
    const gamePath=selectedGamePath();
    try{
      if(!input||typeof input!=="object"||Array.isArray(input))throw Error("WEAPON_RECOVERY_INVALID_REQUEST");
      if(operationGate.busy||dds.busy||vtf.busy||dds.sharedImportBusy||vtf.sharedImportBusy||dds.isImportBusy?.()||vtf.isImportBusy?.())throw Error("WEAPON_RECOVERY_BUSY");
      return await operationGate.run("weapon-library-restore",async()=>{
        const coordinator=getCoordinator();if(!coordinator)throw Error("WEAPON_RECOVERY_UNAVAILABLE");
        const library=await list();if(!library.ok)throw Error(library.error);
        if(!isCurrentRoot(gamePath))throw Error("STALE_WEAPON_LIBRARY");
        if(input.recoveryId!==undefined){
          if(typeof input.recoveryId!=="string"||input.weaponId!==undefined||input.recordId!==undefined||input.targetMode!==undefined)throw Error("WEAPON_RECOVERY_INVALID_REQUEST");
          const recovery=library.recoveries.find(row=>row.id===input.recoveryId&&row.canRecover);if(!recovery)throw Error("WEAPON_RECOVERY_INVALID_RECORD");
          const id=recovery.id.split(":")[1];progress({phase:"restoring",percent:15,recoveryId:recovery.id});
          const result=recovery.kind==="switch"?await coordinator.recover(gamePath,id):await (recovery.kind==="dds"?dds:vtf).restore(gamePath,id);
          progress({phase:"complete",percent:100,recoveryId:recovery.id});return {ok:true,recovered:true,recoveryId:recovery.id,...result};
        }
        if(typeof input.weaponId!=="string"||!IDS.has(input.weaponId))throw Error("WEAPON_RECOVERY_INVALID_WEAPON");
        if(input.targetMode!==undefined){
          if(!["installed","original"].includes(input.targetMode)||input.itemId!==undefined||input.targetMode==="original"&&input.recordId!==undefined||input.targetMode==="installed"&&typeof input.recordId!=="string")throw Error("WEAPON_RECOVERY_INVALID_REQUEST");
          if(input.targetMode==="installed"){const source=library.items.find(item=>item.id===input.recordId);if(!source?.stateRestoreWeaponIds.includes(input.weaponId))throw Error("WEAPON_STATE_NOT_AVAILABLE:"+(source?.stateUnavailableReasons[input.weaponId]||"unassigned"));}
          else if(!library.stateRestoreWeaponIds.includes(input.weaponId))throw Error("WEAPON_STATE_NOT_AVAILABLE");
          const result=await require("./weapon-library-state").restoreState({coordinator,gamePath,weaponId:input.weaponId,targetMode:input.targetMode,recordId:input.recordId,progress,stillCurrent:()=>isCurrentRoot(gamePath),timestampFloor:Math.max(0,...library.items.map(item=>Date.parse(item.installedAt)||0))});
          const remainingMods=library.items.filter(item=>item.format==="mod"&&item.state==="enabled"&&item.weaponIds.includes(input.weaponId)).map(item=>({id:item.id,name:item.name}));
          return {ok:true,...result,remainingMods};
        }
        if(input.recordId!==undefined){
          if(typeof input.recordId!=="string")throw Error("WEAPON_RECOVERY_INVALID_RECORD");
          const source=library.items.find(item=>item.id===input.recordId);
          if(!source?.backupRestoreWeaponIds.includes(input.weaponId))throw Error("WEAPON_BACKUP_NOT_AVAILABLE:"+(source?.backupUnavailableReasons[input.weaponId]||"unassigned"));
          const result=await require("./weapon-library-backup").restoreBackup({coordinator,gamePath,weaponId:input.weaponId,recordId:input.recordId,progress:data=>progress({...data,recordId:input.recordId}),stillCurrent:()=>isCurrentRoot(gamePath),timestampFloor:Math.max(0,...library.items.map(item=>Date.parse(item.installedAt)||0))});
          const remainingMods=library.items.filter(item=>item.format==="mod"&&item.state==="enabled"&&item.weaponIds.includes(input.weaponId)).map(item=>({id:item.id,name:item.name}));
          return {ok:true,...result,remainingMods};
        }
        if(!library.restoreWeaponIds.includes(input.weaponId))throw Error("WEAPON_RECOVERY_NOT_AVAILABLE");
        if(input.itemId!==undefined&&!library.items.some(item=>item.id===input.itemId&&item.restoreWeaponIds.includes(input.weaponId)))throw Error("WEAPON_RECOVERY_INVALID_RECORD");
        const result=await require("./weapon-library-recovery").restoreOriginal({coordinator,gamePath,weaponId:input.weaponId,progress,stillCurrent:()=>isCurrentRoot(gamePath),timestampFloor:Math.max(0,...library.items.map(item=>Date.parse(item.installedAt)||0))});
        const remainingMods=library.items.filter(item=>item.format==="mod"&&item.state==="enabled"&&item.weaponIds.includes(input.weaponId)).map(item=>({id:item.id,name:item.name}));
        return {ok:true,...result,remainingMods};
      });
    }catch(error){progress({phase:"error",percent:0,weaponId:input?.weaponId,...(input?.recordId?{recordId:input.recordId}:{}),...(input?.targetMode?{targetMode:input.targetMode}:{}),error:error.message});return {ok:false,error:error.message};}
  });
}
module.exports={buildLibrary,register,ddsItems,vtfItems,modItems,scanModAssets,latestSwitches,originalRestores,recoveryRows,recoveryAvailability,LIMITS};
