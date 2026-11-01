"use strict";

// The compatibility package has a special installation layout. Keep this
// installer separate from normal Mod imports and never change enabledmods here.
const fs = require("fs"), fsp = fs.promises, path = require("path"), crypto = require("crypto");
const repair = require("jsonrepair");
const PACKAGE_ID = "NachosChipeados-VanillaPlus-2.5.1", MOD_NAME = "VanillaPlus", VERSION = "2.5.1";
const MARKER = "TFX-INTEGRATION.json", MAX_FILES = 1000, MAX_BYTES = 16 * 1024 * 1024;
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = (code, message) => { throw Object.assign(new Error(message), {code}); };
function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
function safeParts(value) {
  if (typeof value !== "string" || !value || /[\\\u0000-\u001f:]/.test(value) || path.posix.isAbsolute(value)) return false;
  return value.split("/").every(part => part && part !== "." && part !== ".." && !/[<>"|?*]|[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
async function checked(filename, kind, missing = false) {
  const absolute = path.resolve(filename), root = path.parse(absolute).root;
  let cursor = root, stat;
  for (const component of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    try { stat = await fsp.lstat(cursor); } catch (error) { if (missing && error.code === "ENOENT") return null; throw error; }
    if (stat.isSymbolicLink() || (cursor !== absolute && !stat.isDirectory())) fail("VANILLA_PLUS_UNSAFE", "VanillaPlus 路径不能包含链接或无效的父目录。");
  }
  if (!stat || (kind === "file" ? !stat.isFile() : !stat.isDirectory())) fail("VANILLA_PLUS_UNSAFE", "VanillaPlus 路径类型不正确。");
  return stat;
}
async function readJson(filename) {
  if ((await checked(filename, "file")).size > 1024 * 1024) fail("VANILLA_PLUS_UNSAFE", "VanillaPlus 定义文件过大。");
  const bytes = await fsp.readFile(filename), text = bytes.toString("utf8");
  if (!Buffer.from(text).equals(bytes)) fail("VANILLA_PLUS_UNSAFE", "VanillaPlus 定义不是有效的 UTF-8。");
  try { return JSON.parse(repair(text.replace(/^\uFEFF/, ""))); }
  catch (_) { fail("VANILLA_PLUS_DEFINITION", "VanillaPlus 定义文件无法解析。"); }
}
async function inventory(root) {
  await checked(root, "directory");
  const files = [], seen = new Set(); let bytes = 0;
  async function visit(directory, prefix = "") {
    for (const entry of await fsp.readdir(directory, {withFileTypes:true})) {
      const relative = prefix + entry.name, filename = path.join(directory, entry.name);
      if (!safeParts(relative) || seen.has(relative.toLowerCase())) fail("VANILLA_PLUS_UNSAFE", "VanillaPlus 包含重复或无效路径。");
      seen.add(relative.toLowerCase());
      const stat = await fsp.lstat(filename);
      if (stat.isSymbolicLink()) fail("VANILLA_PLUS_UNSAFE", "VanillaPlus 文件夹不能包含链接。");
      if (stat.isDirectory()) await visit(filename, relative + "/");
      else {
        if (!stat.isFile() || files.length >= MAX_FILES || (bytes += stat.size) > MAX_BYTES) fail("VANILLA_PLUS_LIMIT", "VanillaPlus 文件内容超出限制。");
        files.push({path:relative,bytes:stat.size,sha256:sha(await fsp.readFile(filename))});
      }
    }
  }
  await visit(root); return files.sort((a,b) => a.path.localeCompare(b.path, "en"));
}
function equalFiles(actual, expected) {
  const entries = new Map(actual.map(entry => [entry.path, entry]));
  return actual.length === expected.length && expected.every(entry => entries.has(entry.path) && entries.get(entry.path).bytes === entry.bytes && entries.get(entry.path).sha256 === entry.sha256);
}
async function directories(parent) {
  try {if (!await checked(parent, "directory", true)) return [];}
  catch (error) {if (error.code === "VANILLA_PLUS_UNSAFE") return []; throw error;}
  const entries = await fsp.readdir(parent, {withFileTypes:true}), output = [];
  if (entries.length > 12000) fail("VANILLA_PLUS_LIMIT", "模组目录项目过多。");
  for (const entry of entries) {
    // Mod managers commonly deploy unrelated Mods through junctions. Do not
    // follow them during duplicate detection; only inspect real package roots.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) output.push(path.join(parent, entry.name));
  }
  return output;
}
async function duplicates(profile, wanted) {
  const paths = [];
  async function scan(parent) {
    for (const folder of await directories(parent)) {
      const file = path.join(folder, "mod.json");
      if (!await checked(file, "file", true)) continue;
      let definition;
      try { definition = await readJson(file); }
      catch (error) { if (error.code === "VANILLA_PLUS_DEFINITION") continue; throw error; }
      if (typeof definition?.Name === "string" && /^(?:NP\.)?VanillaPlus$/i.test(definition.Name) && path.resolve(folder).toLowerCase() !== wanted.toLowerCase()) paths.push(folder);
    }
  }
  await scan(path.join(profile, "mods"));
  for (const folder of await directories(path.join(profile, "packages"))) {
    if (/^(?:NanohmProtogen|NachosChipeados)-VanillaPlus-/i.test(path.basename(folder)) && path.basename(folder) !== PACKAGE_ID) paths.push(folder);
    await scan(path.join(folder, "mods"));
  }
  return [...new Set(paths)];
}
function createManager({bundleRoot = path.join(__dirname, "../tools/vanilla-plus")} = {}) {
  const root = path.resolve(bundleRoot), payload = path.join(root, "payload");
  async function manifest() {
    const value = await readJson(path.join(root, "manifest.json"));
    if (value.schema !== 1 || value.packageId !== PACKAGE_ID || value.modName !== MOD_NAME || value.version !== VERSION || !Array.isArray(value.files) || value.files.length > MAX_FILES || !value.files.length) fail("VANILLA_PLUS_BUNDLE", "内置 VanillaPlus 清单无效。");
    const names = new Set(); let total = 0;
    for (const item of value.files) {
      if (!safeParts(item.path) || names.has(item.path.toLowerCase()) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || (total += item.bytes) > MAX_BYTES || !/^[0-9a-f]{64}$/.test(item.sha256)) fail("VANILLA_PLUS_BUNDLE", "内置 VanillaPlus 清单路径或校验值无效。");
      names.add(item.path.toLowerCase());
    }
    return value;
  }
  function locations(profileDirectory) {
    if (typeof profileDirectory !== "string" || !profileDirectory.trim()) fail("VANILLA_PLUS_PROFILE", "请先选择有效的游戏配置目录。");
    const profile = path.resolve(profileDirectory), packagePath = path.join(profile,"packages",PACKAGE_ID), modPath = path.join(packagePath,"mods/NP.VanillaPlus");
    return {profile, packagePath, modPath};
  }
  async function inspect(profileDirectory) {
    const result = {installed:false,verified:false,state:"missing",version:VERSION};
    try {
      const files = await manifest(), location = locations(profileDirectory); Object.assign(result, location);
      if (!await checked(location.profile, "directory", true)) return result;
      const conflicts = await duplicates(location.profile, location.modPath);
      if (conflicts.length) return {...result,state:"conflict",code:"VANILLA_PLUS_DUPLICATE",error:"检测到其他 VanillaPlus 版本，请先在模组管理中移除重复版本。",conflicts};
      if (!await checked(location.packagePath,"directory",true)) return result;
      result.installed = true;
      result.verified = equalFiles(await inventory(location.packagePath), files.files);
      result.state = result.verified ? "installed" : "damaged";
      return result;
    } catch (error) { return {...result,state:"conflict",code:error.code || "VANILLA_PLUS_INSPECT",error:error.message}; }
  }
  async function install(profileDirectory, {guard = async () => {}, onProgress = () => {}} = {}) {
    const location = locations(profileDirectory), data = await manifest();
    if (!equalFiles(await inventory(payload),data.files)) fail("VANILLA_PLUS_BUNDLE", "内置 VanillaPlus 文件校验失败，请重新安装 TFX。");
    await checked(location.profile,"directory");
    const before = await inspect(profileDirectory);
    if (before.state === "conflict") fail(before.code,before.error);
    if (before.verified) return {...before,changed:false};
    // A destination not carrying this Mod identity or our exact package marker
    // could be unrelated user data. Preserve it and refuse to replace it.
    if (before.installed) {
      let owned = false;
      try { const value = await readJson(path.join(location.packagePath,MARKER)); owned = value.packageId === PACKAGE_ID && value.modName === MOD_NAME; } catch (_) {}
      if (!owned) try {const value = await readJson(path.join(location.modPath,"mod.json")); owned = value.Name === MOD_NAME && typeof value.Version === "string";} catch (_) {}
      if (!owned) fail("VANILLA_PLUS_FOREIGN", "VanillaPlus 安装位置已有其他内容，已保留原文件，请移开同名文件夹后重试。");
    }
    const beforeFiles = before.installed ? await inventory(location.packagePath) : null;
    const transaction = path.join(location.profile,".tfx-vanilla-plus-" + crypto.randomUUID()), stage = path.join(transaction,"staged"), backup = path.join(transaction,"previous");
    let displaced = false, committed = false;
    const progress = (percent,stage) => { try {onProgress({percent,stage});} catch (_) {} };
    try {
      await guard(); await checked(location.profile,"directory"); await fsp.mkdir(transaction); await fsp.mkdir(stage); progress(5,"copy");
      let count = 0;
      for (const file of data.files) {
        const from = path.join(payload,...file.path.split("/")), to = path.join(stage,...file.path.split("/"));
        if (!inside(stage,to)) fail("VANILLA_PLUS_UNSAFE","VanillaPlus 安装路径无效。");
        await guard(); await checked(from,"file"); await checked(transaction,"directory");
        await fsp.mkdir(path.dirname(to),{recursive:true}); await fsp.copyFile(from,to,fs.constants.COPYFILE_EXCL);
        progress(5 + Math.floor(++count / data.files.length * 75),"copy");
      }
      if (!equalFiles(await inventory(stage),data.files)) fail("VANILLA_PLUS_VERIFY", "VanillaPlus 暂存文件校验失败。");
      await guard(); await checked(location.profile,"directory");
      await fsp.mkdir(path.join(location.profile,"packages"),{recursive:true}); await checked(path.join(location.profile,"packages"),"directory");
      const next = await inspect(profileDirectory);
      if (next.state === "conflict" || next.installed !== before.installed || (before.installed && !equalFiles(await inventory(location.packagePath),beforeFiles))) fail("VANILLA_PLUS_CHANGED","VanillaPlus 安装位置已变化，请重新安装。");
      progress(90,"commit"); await guard();
      if (before.installed) { await checked(location.packagePath,"directory"); await fsp.rename(location.packagePath,backup); displaced = true; }
      try { await guard(); await fsp.rename(stage,location.packagePath); committed = true; }
      catch (error) {if (displaced) {await fsp.rename(backup,location.packagePath); displaced = false;} throw error;}
      const after = await inspect(profileDirectory);
      if (!after.verified) fail("VANILLA_PLUS_VERIFY","VanillaPlus 安装后校验失败。");
      progress(100,"complete");
      return {...after,changed:true,...(displaced ? {backupPath:backup} : {})};
    } catch (error) {
      if (committed) {
        await checked(location.packagePath,"directory");
        await fsp.rename(location.packagePath,path.join(transaction,"failed"));
        if (displaced) {await fsp.rename(backup,location.packagePath); displaced = false;}
      }
      throw error;
    } finally {
      if (!displaced) try { if (await checked(transaction,"directory",true)) await fsp.rm(transaction,{recursive:true,force:true}); } catch (_) {}
    }
  }
  return {inspect,install};
}
module.exports = {createManager,PACKAGE_ID,MOD_NAME,VERSION};
