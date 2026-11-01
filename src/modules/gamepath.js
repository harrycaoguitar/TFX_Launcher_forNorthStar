const path = require("path");
const fs = require("fs-extra");
const win = require("../win");
const {dialog, ipcMain} = require("electron");
const version = require("./version");
const settings = require("./settings");
const findgame = require("./findgame");
const dualInstall = require("./dual-install");

const gamepath = {setting:false, settingSettled:null, globalSetting:false, globalSettled:null};
function validPath(value) {
 const candidate = findgame.normalizeGamePath(value);
 return candidate && findgame.validateGamePath(candidate) ? candidate : false;
}
function validGlobalPath(value) {
 const candidate = validPath(value);
 if (!candidate) return false;
 const china = validPath(settings().gamepath);
 return china && findgame.sameGamePath(candidate, china) ? false : candidate;
}
gamepath.exists = folder => Boolean(validPath(folder === undefined ? settings().gamepath : folder));
gamepath.has_perms = folder => {
 const candidate = validPath(folder === undefined ? settings().gamepath : folder);
 if (!candidate) return false;
 try {fs.accessSync(candidate, fs.constants.R_OK | fs.constants.W_OK); return true;}
 catch (_) {return false;}
};
function publish(window, selected, source, checking=false, state={}) {
 const candidate = validPath(selected);
 window.send("gamepath-status", {
  path:typeof selected === "string" ? selected : "", valid:Boolean(candidate), checking, source,
  selected:state.selected === true, installable:state.installable === true,
  writable:candidate ? gamepath.has_perms(candidate) : false,
  northstarInstalled:!!candidate && (()=>{try{const stat=fs.lstatSync(path.join(candidate,"NorthstarLauncher.exe"));return stat.isFile()&&!stat.isSymbolicLink();}catch(_){return false;}})()
 });
}
function publishGlobal(window, selected, source, checking=false) {
 const candidate = validGlobalPath(selected);
 window.send("globalpath-status", {
  path:typeof selected === "string" ? selected : "", valid:Boolean(candidate), selected:typeof selected === "string" && Boolean(selected.trim()), installable:false, checking, source
 });
}
async function accept(window, folder, source, baseSource) {
 const currentRoot = validPath(settings().gamepath), savedSource = validPath(settings().chinaSourceGamepath);
 const sourceRoot = validPath(baseSource) || (savedSource && currentRoot && findgame.sameGamePath(folder, currentRoot) ? savedSource : folder);
 await settings().save({gamepath:folder, chinaSourceGamepath:sourceRoot, chinaInstallTarget:"", zip:path.join(folder,"northstar.zip")});
 publish(window, folder, source);
 window.send("newpath", folder);
 version.send_info();
 if (!window.isVisible()) window.show();
 // Update only after the selected directory has actually been validated.
 require("./update").northstar_autoupdate();
 await gamepath.setGlobal(window, false);
}
async function acceptGlobal(window, folder, source, ready=true) {
 await settings().save({globalGamepath:folder});
 window.send("globalpath-status", {path:folder, valid:ready, selected:true, installable:!ready, checking:false, source});
 window.send("globalpath-selected", folder);
 if (!window.isVisible()) window.show();
}
// Visibility does not decide whether startup validation is automatic or manual.
ipcMain.on("setpath", (_event, _loaded, forceDialog=false) => {
 void gamepath.set(win(), forceDialog === true);
});
ipcMain.on("setglobalpath", (_event, forceDialog=true) => {
 return gamepath.setGlobal(win(), forceDialog !== false);
});
gamepath.set = async (window, forceDialog=false) => {
 if (!window) return false;
 if (gamepath.setting) {
  if (!forceDialog || !gamepath.settingSettled) return false;
  await gamepath.settingSettled;
  return gamepath.set(window, true);
 }
 gamepath.setting = true;
 let settleSetting;
 gamepath.settingSettled = new Promise(resolve => {settleSetting = resolve;});
 const saved = settings().gamepath;
 try {
  if (!forceDialog) {
   const pendingTarget = findgame.normalizeGamePath(settings().chinaInstallTarget);
   if (pendingTarget) {
    const source = validPath(saved) || validPath(settings().chinaSourceGamepath) || validPath(await findgame());
    if (!source) {
     publish(window, pendingTarget, "unavailable", false, {selected:true, installable:false});
     return false;
    }
    try {
     const target = await dualInstall.inspectInstallTarget({sourceRoot:source, targetRoot:pendingTarget});
     if (target.ready) {await accept(window, target.root, "recovered", source); return true;}
     await settings().save({chinaSourceGamepath:source, chinaInstallTarget:target.root});
     publish(window, target.root, "saved-target", false, {selected:true, installable:target.installable});
     if (!window.isVisible()) window.show();
     return false;
    } catch (_) {
     publish(window, pendingTarget, "unavailable", false, {selected:true, installable:false});
     return false;
    }
   }
   publish(window, saved, "checking", true);
   const existing = validPath(saved);
   if (existing) {await accept(window, existing, "saved"); return true;}
   const detected = validPath(await findgame());
   if (detected) {await accept(window, detected, "automatic"); return true;}
  }
  publish(window, saved, "manual");
  // Cancel keeps the app open and preserves a previously valid selection.
  const defaultPath = validPath(saved) || undefined;
  while (true) {
   const result = await dialog.showOpenDialog(window, {
    title:forceDialog ? "选择泰坦陨落 2 游戏目录" : "未自动识别到游戏，请选择泰坦陨落 2 游戏目录",
    buttonLabel:"使用此目录", properties:["openDirectory"], ...(defaultPath ? {defaultPath} : {})
   });
   if (result.canceled || !result.filePaths.length) {publish(window, saved, "cancelled"); return false;}
   const selected = findgame.resolveSelectedGamePath(result.filePaths[0]);
   if (!selected) {
    const picked = findgame.normalizeGamePath(result.filePaths[0]);
    if (picked && await dualInstall.isEmptyDirectory(picked)) {
     const source = validPath(saved) || validPath(settings().chinaSourceGamepath) || validPath(await findgame());
     if (!source) {
      await window.alert("当前找不到可复制的泰坦陨落 2 源目录。请先安装游戏，或先选择 Steam 中现有的游戏目录。");
      continue;
     }
     try {
      dualInstall.ensureDisjoint(source, picked);
      if (settings().globalGamepath) dualInstall.ensureDisjoint(picked, settings().globalGamepath);
      const target = await dualInstall.inspectInstallTarget({sourceRoot:source, targetRoot:picked});
      await settings().save({chinaSourceGamepath:source, chinaInstallTarget:target.root});
      publish(window, target.root, "target-selected", false, {selected:true, installable:target.installable});
      if (!window.isVisible()) window.show();
      return true;
     } catch (error) {
      const message = error.code === "GLOBAL_TARGET_OVERLAPS_SOURCE" || error.code === "GLOBAL_TARGET_SAME_AS_SOURCE"
       ? "国服独立目录必须与游戏源目录和全球服目录完全分开。"
       : error.code === "GLOBAL_VOLUME_NOT_NTFS"
        ? "国服和全球服独立目录必须位于 NTFS 磁盘上。"
        : error.code === "GLOBAL_TARGET_NOT_EMPTY" || error.code === "GLOBAL_TARGET_INCOMPLETE"
         ? "请选择空文件夹，或选择包含完整游戏文件的目录。"
         : "无法使用所选文件夹，请选择一个可访问的空 NTFS 文件夹。";
      await window.alert(message);
      continue;
     }
    }
    await window.alert("所选目录中未找到 Titanfall2.exe。请选择游戏安装根目录（也可选择 Steam 游戏库，TFX 会查找其中的泰坦陨落 2），或选择空文件夹安装国服独立副本。");
    continue;
   }
   await accept(window, selected, "manual"); return true;
  }
 } catch (error) {
  console.error("Game directory selection failed:", error);
  publish(window, saved, "error");
  window.send("gamepath-error", "无法读取游戏目录，请点击“更改目录”重新选择。");
  return false;
 } finally {
  gamepath.setting = false;
  settleSetting();
  gamepath.settingSettled = null;
 }
};
gamepath.setGlobal = async (window, forceDialog=true) => {
 if (!window) return false;
 if (gamepath.globalSetting) {
  if (!forceDialog || !gamepath.globalSettled) return false;
  await gamepath.globalSettled;
  return gamepath.setGlobal(window, true);
 }
 gamepath.globalSetting = true;
 let settleGlobal;
 gamepath.globalSettled = new Promise(resolve => {settleGlobal = resolve;});
 const savedPath = settings().globalGamepath;
 const saved = validGlobalPath(savedPath);
 try {
  if (!forceDialog) {
   publishGlobal(window, savedPath, "checking", true);
   const source = validPath(settings().gamepath);
   if (!source) {
    publishGlobal(window, settings().globalGamepath, "unavailable");
    return false;
   }
   if (saved) {
    if (settings().chinaInstallTarget) dualInstall.ensureDisjoint(settings().chinaInstallTarget, saved);
    const savedTarget = await dualInstall.inspectInstallTarget({sourceRoot:source, targetRoot:saved});
    await acceptGlobal(window, savedTarget.root, "saved", savedTarget.ready);
    return savedTarget.root;
   }
   if (savedPath) {
    try {
     const pending = await dualInstall.inspectInstallTarget({sourceRoot:source, targetRoot:savedPath});
     if (pending.installable) {
      await acceptGlobal(window, pending.root, "saved-target", false);
      return pending.root;
     }
    } catch (_) {
     // A user-selected Global root is durable intent. If it is no longer
     // usable, keep it visible and ask for correction instead of silently
     // replacing it with whichever Steam library happens to be discovered.
     publishGlobal(window, savedPath, "unavailable");
     return false;
    }
   }
   const detected = findgame.selectGlobalGamePath(await findgame.findGames(), settings().gamepath);
   if (detected) {
    if (settings().chinaInstallTarget) dualInstall.ensureDisjoint(settings().chinaInstallTarget, detected);
    const target = await dualInstall.inspectInstallTarget({sourceRoot:source, targetRoot:detected});
    await acceptGlobal(window, target.root, "automatic", target.ready);
    return target.root;
   }
   publishGlobal(window, settings().globalGamepath, "unavailable");
   return false;
  }
  if (!validPath(settings().gamepath)) {
   await window.alert("请先选择并检查国服游戏目录，然后再选择全球服安装位置。");
   return false;
  }
  let selected = savedPath;
  while (true) {
   const result = await dialog.showOpenDialog(window, {
    title:"选择国际服 Titanfall 2 游戏目录",
    buttonLabel:"使用此目录", properties:["openDirectory"], ...(selected ? {defaultPath:selected} : {})
   });
   if (result.canceled || !result.filePaths.length) return false;
   const picked = findgame.normalizeGamePath(result.filePaths[0]);
   if (!picked) {
    await window.alert("请选择有效的全球服安装文件夹。");
    continue;
   }
   const existing = findgame.resolveSelectedGamePath(picked);
   const source = validPath(settings().gamepath);
   try {
    if (settings().chinaInstallTarget) dualInstall.ensureDisjoint(settings().chinaInstallTarget, existing || picked);
    const target = await dualInstall.inspectInstallTarget({sourceRoot:source, targetRoot:existing || picked});
    if (existing && !validGlobalPath(existing)) throw Object.assign(Error("国际服必须使用与国服不同的游戏目录。"), {code:"GLOBAL_TARGET_OVERLAPS_SOURCE"});
    selected = target.root;
    await acceptGlobal(window, selected, "manual", target.ready);
    return selected;
   } catch (error) {
    const message = error.code === "GLOBAL_TARGET_NOT_EMPTY"
     ? "所选文件夹不是空目录，也不是有效的独立游戏目录。请选择一个空的 NTFS 文件夹或已安装的 Titanfall 2 目录。"
     : error.code === "GLOBAL_VOLUME_NOT_NTFS"
      ? "国服和全球服目录必须位于 NTFS 磁盘上。请选择其他磁盘或文件夹。"
      : error.code === "GLOBAL_TARGET_OVERLAPS_SOURCE"
       ? "全球服必须安装到与国服完全分开的目录。请选择另一位置。"
       : "无法使用此全球服目录，请选择一个可访问的空 NTFS 文件夹。";
    await window.alert(message);
    continue;
   }
  }
 } catch (error) {
  console.error("Global game directory selection failed:", error);
  window.send("gamepath-error", "无法读取国际服游戏目录，请重新选择。");
  return false;
 } finally {
  gamepath.globalSetting = false;
  settleGlobal();
  gamepath.globalSettled = null;
 }
};
let lost = false;
setInterval(async () => {
 if (gamepath.setting || !settings().gamepath) return;
 if (gamepath.exists()) {
  if (lost) {try {await accept(win(),validPath(settings().gamepath),"restored"); lost=false;} catch (_) {}}
  return;
 }
 if (!lost) {lost=true; publish(win(),settings().gamepath,"unavailable"); win().send("gamepath-lost");}
},15000);
module.exports = gamepath;
