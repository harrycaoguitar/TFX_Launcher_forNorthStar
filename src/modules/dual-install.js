"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const {execFileSync} = require("child_process");
const {Transform} = require("stream");
const {pipeline} = require("stream/promises");

const INSTALL_MARKER = ".tfx-global-root.json";
const CHINA_INSTALL_MARKER = ".tfx-china-root.json";
const GAME_DIRECTORIES = Object.freeze(["Core", "bin", "platform", "r2", "Support", "vpk", "__Installer", "__overlay"]);
const GAME_FILES = Object.freeze([
  "Titanfall2.exe", "Titanfall2_trial.exe", "EAappInstaller_installScript.vdf", "EAStore.ini",
  "build.txt", "gameversion.txt", "installScript.vdf", "launcher.dll", "server.dll", "steam_appid.txt"
]);
const error = (code, message) => Object.assign(new Error(message), {code});
const lower = value => path.resolve(value).replace(/[\\/]+$/, "").toLowerCase();

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function ensureDisjoint(sourceRoot, targetRoot) {
  const source = lower(sourceRoot), target = lower(targetRoot);
  if (source === target) throw error("GLOBAL_TARGET_SAME_AS_SOURCE", "全球服目录不能与国服目录相同。");
  if (isWithin(source, target) || isWithin(target, source)) throw error("GLOBAL_TARGET_OVERLAPS_SOURCE", "全球服目录必须与国服目录完全分开，且不能互相包含。");
}

function resolveExistingRoot(value, code) {
  let root;
  try {root = fs.realpathSync.native(value);}
  catch (_) {throw error(code, "游戏目录不存在或无法读取。");}
  let stat;
  try {stat = fs.lstatSync(root);}
  catch (_) {throw error(code, "游戏目录不存在或无法读取。");}
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw error(code, "游戏目录必须是实际文件夹，不能是链接。");
  return root;
}

function volumeRoot(value) {
  const root = path.parse(path.resolve(value)).root.replace(/[\\/]+$/, "");
  if (!root) throw error("GLOBAL_VOLUME_UNKNOWN", "无法识别所选路径所在的卷。");
  return root;
}

function getVolumeFileSystem(value) {
  if (process.platform !== "win32") throw error("GLOBAL_VOLUME_UNKNOWN", "全球服安装只能写入 Windows NTFS 卷。");
  const systemRoot = process.env.SystemRoot || "C:\\Windows";
  let output;
  try {
    output = execFileSync(path.join(systemRoot, "System32", "fsutil.exe"), ["fsinfo", "volumeinfo", volumeRoot(value)], {
      encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"], timeout: 10000
    });
  } catch (_) {throw error("GLOBAL_VOLUME_UNKNOWN", "无法检查所选路径的文件系统，请选择可访问的 NTFS 磁盘。");}
  const match = String(output).match(/\bNTFS\b/i);
  return match ? match[0].toUpperCase() : "UNKNOWN";
}

function getAvailableBytes(value) {
  try {
    const stat = fs.statfsSync(value);
    const available = Number(stat.bavail) * Number(stat.bsize || stat.frsize);
    if (Number.isFinite(available) && available >= 0) return available;
  } catch (_) {}
  throw error("GLOBAL_SPACE_CHECK_FAILED", "无法检查目标磁盘的可用空间。");
}

async function lstatOrNull(filename) {
  try {return await fsp.lstat(filename);}
  catch (cause) {if (cause.code === "ENOENT") return null; throw cause;}
}

async function isEmptyDirectory(folder) {
  const stat = await lstatOrNull(folder);
  if (!stat) return true;
  if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
  try {return (await fsp.readdir(folder)).length === 0;}
  catch (_) {return false;}
}

async function scanDirectory(source, relative, entries, totals) {
  let stat;
  try {stat = await fsp.lstat(source);}
  catch (cause) {throw cause;}
  if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
    throw error("GLOBAL_SOURCE_LINK_UNSUPPORTED", `全球服不能复制链接或特殊文件：${relative}`);
  }
  if (stat.isDirectory()) {
    entries.push({relative, kind: "directory"});
    const children = (await fsp.readdir(source)).sort((left, right) => left.localeCompare(right));
    for (const child of children) await scanDirectory(path.join(source, child), path.join(relative, child), entries, totals);
    return;
  }
  entries.push({relative, kind: "file", size: stat.size, mtimeMs: stat.mtimeMs});
  totals.bytes += stat.size;
  totals.files++;
}

async function createCopyPlan(sourceRoot) {
  const entries = [], totals = {bytes: 0, files: 0};
  const executable = path.join(sourceRoot, "Titanfall2.exe");
  const executableStat = await lstatOrNull(executable);
  if (!executableStat?.isFile() || executableStat.isSymbolicLink()) {
    throw error("GLOBAL_SOURCE_INVALID", "国服目录缺少可读取的 Titanfall2.exe。");
  }
  for (const directory of GAME_DIRECTORIES) {
    const source = path.join(sourceRoot, directory), stat = await lstatOrNull(source);
    if (!stat) {
      if (["Core", "bin", "platform", "r2", "vpk"].includes(directory)) {
        throw error("GLOBAL_SOURCE_INVALID", `国服目录缺少游戏资源文件夹：${directory}`);
      }
      continue;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw error("GLOBAL_SOURCE_LINK_UNSUPPORTED", `国服游戏资源路径无效：${directory}`);
    await scanDirectory(source, directory, entries, totals);
  }
  for (const filename of GAME_FILES) {
    const source = path.join(sourceRoot, filename), stat = await lstatOrNull(source);
    if (!stat) continue;
    if (!stat.isFile() || stat.isSymbolicLink()) throw error("GLOBAL_SOURCE_LINK_UNSUPPORTED", `国服游戏文件路径无效：${filename}`);
    entries.push({relative: filename, kind: "file", size: stat.size, mtimeMs: stat.mtimeMs});
    totals.bytes += stat.size;
    totals.files++;
  }
  if (!entries.some(entry => entry.relative.toLowerCase() === "titanfall2.exe" && entry.kind === "file")) {
    const stat = await fsp.stat(executable);
    entries.push({relative: "Titanfall2.exe", kind: "file", size: stat.size, mtimeMs: stat.mtimeMs});
    totals.bytes += stat.size;
    totals.files++;
  }
  return {entries, totalBytes: totals.bytes, totalFiles: totals.files};
}

function progressPayload(totalBytes, copiedBytes, file) {
  const percent = totalBytes ? Math.min(100, copiedBytes / totalBytes * 100) : 100;
  return {phase: "copying", copiedBytes, totalBytes, percent, ...(file ? {file} : {})};
}

async function copyTree(sourceRoot, stageRoot, plan, onProgress = () => {}) {
  let copiedBytes = 0, lastReport = 0;
  const report = file => {
    const now = Date.now();
    if (now - lastReport >= 250 || copiedBytes >= plan.totalBytes) {
      lastReport = now;
      try {onProgress(progressPayload(plan.totalBytes, copiedBytes, file));} catch (_) {}
    }
  };
  for (const entry of plan.entries) {
    const source = path.join(sourceRoot, entry.relative), target = path.join(stageRoot, entry.relative);
    if (entry.kind === "directory") {
      await fsp.mkdir(target, {recursive: true});
      continue;
    }
    await fsp.mkdir(path.dirname(target), {recursive: true});
    const meter = new Transform({
      transform(chunk, _encoding, callback) {copiedBytes += chunk.length; report(entry.relative); callback(null, chunk);}
    });
    await pipeline(fs.createReadStream(source), meter, fs.createWriteStream(target, {flags: "wx"}));
    await fsp.utimes(target, new Date(), new Date(entry.mtimeMs));
    report(entry.relative);
  }
  report();
}

async function verifyCopy(stageRoot, plan) {
  for (const entry of plan.entries) {
    const filename = path.join(stageRoot, entry.relative), stat = await lstatOrNull(filename);
    if (entry.kind === "directory") {
      if (!stat?.isDirectory() || stat.isSymbolicLink()) throw error("GLOBAL_COPY_VERIFY_FAILED", `全球服文件校验失败：${entry.relative}`);
    } else if (!stat?.isFile() || stat.isSymbolicLink() || stat.size !== entry.size) {
      throw error("GLOBAL_COPY_VERIFY_FAILED", `全球服文件校验失败：${entry.relative}`);
    }
  }
}

async function readOwnedMarker(root) {
  try {
    const filename = path.join(root, INSTALL_MARKER), stat = await fsp.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) return null;
    const value = JSON.parse(await fsp.readFile(filename, "utf8"));
    if (value.schemaVersion !== 1 || value.kind !== "tfx-private-global-root" || typeof value.sourceRoot !== "string" || !Number.isSafeInteger(value.totalFiles) || !Number.isSafeInteger(value.totalBytes)) return null;
    return value;
  } catch (_) {return null;}
}

async function hasCompleteGameRoot(root) {
  const executable = await lstatOrNull(path.join(root, "Titanfall2.exe"));
  if (!executable?.isFile() || executable.isSymbolicLink()) return false;
  for (const directory of ["Core", "bin", "platform", "r2", "vpk"]) {
    const stat = await lstatOrNull(path.join(root, directory));
    if (!stat?.isDirectory() || stat.isSymbolicLink()) return false;
  }
  return true;
}

async function targetLocation(targetRoot) {
  const absolute = path.resolve(targetRoot), stat = await lstatOrNull(absolute);
  if (stat) {
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw error("GLOBAL_TARGET_INVALID", "全球服安装位置必须是实际文件夹。");
    return {root: fs.realpathSync.native(absolute), exists: true};
  }
  const parent = path.dirname(absolute), parentStat = await lstatOrNull(parent);
  if (!parentStat?.isDirectory() || parentStat.isSymbolicLink()) throw error("GLOBAL_TARGET_INVALID", "所选全球服安装位置的上级文件夹无效。");
  return {root: path.join(fs.realpathSync.native(parent), path.basename(absolute)), exists: false};
}

async function inspectInstallTarget({sourceRoot, targetRoot, getFileSystem = getVolumeFileSystem} = {}) {
  if (typeof sourceRoot !== "string" || typeof targetRoot !== "string" || !path.isAbsolute(sourceRoot) || !path.isAbsolute(targetRoot)) {
    throw error("GLOBAL_TARGET_INVALID", "请选择绝对路径形式的国服和全球服目录。");
  }
  const source = resolveExistingRoot(sourceRoot, "GLOBAL_SOURCE_INVALID");
  const target = await targetLocation(targetRoot);
  ensureDisjoint(source, target.root);
  if (await getFileSystem(source) !== "NTFS" || await getFileSystem(path.dirname(target.root)) !== "NTFS") {
    throw error("GLOBAL_VOLUME_NOT_NTFS", "国服和全球服安装目录都必须位于 NTFS 磁盘上。");
  }
  if (target.exists && !(await isEmptyDirectory(target.root))) {
    const marker = await readOwnedMarker(target.root);
    const complete = await hasCompleteGameRoot(target.root);
    if (marker && lower(marker.sourceRoot) === lower(source) && complete) return {root: target.root, ready: true, installable: false, owned: true};
    if (complete) return {root: target.root, ready: true, installable: false, owned: false};
    if (await lstatOrNull(path.join(target.root, "Titanfall2.exe"))) throw error("GLOBAL_TARGET_INCOMPLETE", "所选目录包含 Titanfall2.exe，但缺少完整游戏资源文件夹。请重新选择空目录或完整游戏目录。");
    throw error("GLOBAL_TARGET_NOT_EMPTY", "所选全球服目录不为空且不是已验证的全球服安装目录。");
  }
  return {root: target.root, ready: false, installable: true, owned: false};
}

async function isEmptyOrMissingDirectory(folder) {
  return isEmptyDirectory(folder);
}

async function installRoot({sourceRoot, targetRoot, markerName, markerKind, getFileSystem = getVolumeFileSystem, getAvailableBytes: readSpace = getAvailableBytes, copyTree: copy = copyTree, onProgress = () => {}} = {}) {
  const inspected = await inspectInstallTarget({sourceRoot, targetRoot, getFileSystem});
  if (inspected.ready) return {root: inspected.root, reused: true, owned: inspected.owned};
  const source = resolveExistingRoot(sourceRoot, "GLOBAL_SOURCE_INVALID"), target = inspected.root;
  const plan = await createCopyPlan(source);
  const available = await readSpace(path.dirname(target));
  if (!Number.isFinite(available) || available < plan.totalBytes) {
    throw error("GLOBAL_DISK_SPACE_LOW", `目标磁盘空间不足：需要 ${plan.totalBytes} 字节，可用 ${Number.isFinite(available) ? available : 0} 字节。`);
  }
  const parent = path.dirname(target), stage = path.join(parent, `.${path.basename(target)}.tfx-stage-${require("crypto").randomUUID()}`);
  let removedEmptyTarget = false;
  try {
    await fsp.mkdir(stage, {recursive: false});
    await copy(source, stage, plan, value => onProgress(value));
    await verifyCopy(stage, plan);
    const executable = await fsp.lstat(path.join(stage, "Titanfall2.exe"));
    if (!executable.isFile() || executable.isSymbolicLink()) throw error("GLOBAL_COPY_VERIFY_FAILED", "全球服目录缺少 Titanfall2.exe。");
    const marker = {schemaVersion: 1, kind: markerKind, sourceRoot: source, totalFiles: plan.totalFiles, totalBytes: plan.totalBytes};
    await fsp.writeFile(path.join(stage, markerName), JSON.stringify(marker), {flag: "wx"});
    const targetStat = await lstatOrNull(target);
    if (targetStat) {
      if (!targetStat.isDirectory() || targetStat.isSymbolicLink() || !(await isEmptyDirectory(target))) {
        throw error("GLOBAL_TARGET_CHANGED", "全球服目标目录在安装期间发生变化，已停止发布。");
      }
      await fsp.rmdir(target);
      removedEmptyTarget = true;
    }
    await fsp.rename(stage, target);
    removedEmptyTarget = false;
    try {onProgress({phase: "done", copiedBytes: plan.totalBytes, totalBytes: plan.totalBytes, percent: 100});} catch (_) {}
    return {root: target, reused: false, totalBytes: plan.totalBytes, totalFiles: plan.totalFiles};
  } catch (cause) {
    if (removedEmptyTarget && !(await lstatOrNull(target))) {
      try {await fsp.mkdir(target);} catch (_) {}
    }
    throw cause;
  } finally {
    await fsp.rm(stage, {recursive: true, force: true}).catch(() => {});
  }
}

function installGlobalRoot(options = {}) {
  return installRoot({...options, markerName: INSTALL_MARKER, markerKind: "tfx-private-global-root"});
}

function installChinaRoot(options = {}) {
  return installRoot({...options, markerName: CHINA_INSTALL_MARKER, markerKind: "tfx-private-china-root"});
}

function register({ipcMain}, {
  getSettings = () => require("./settings")(),
  send = (channel, value) => require("../win")().send(channel, value),
  installChina = installChinaRoot,
  runGate = (label, action) => require("./dds-operation-gate").run(label, action),
  processSnapshot = () => require("./is_running").snapshot(),
  hasGame = (snapshot, root) => require("./game-roots").hasGame(snapshot, root)
} = {}) {
  ipcMain.handle("global-game-root-install", async () => {
    let conf;
    try {
      conf = {...getSettings()};
      const sourceRoot = require("./findgame").validateGamePath(conf.gamepath);
      if (!sourceRoot || !conf.globalGamepath) throw error("GLOBAL_GAME_ROOT_MISSING", "请先选择国服目录和全球服安装位置。");
      const gate = require("./dds-operation-gate");
      const result = await gate.run("global-game-root-install", async () => {
        const current = getSettings();
        if (current.gamepath !== conf.gamepath || current.globalGamepath !== conf.globalGamepath) throw error("GLOBAL_SELECTION_CHANGED", "游戏目录已改变，请重新选择后再安装。");
        const snapshot = await require("./is_running").snapshot();
        if (!snapshot?.ok) throw error("GLOBAL_PROCESS_CHECK_FAILED", "无法确认游戏进程状态，请重试全球服安装。");
        if (require("./game-roots").hasGame(snapshot, sourceRoot)) throw error("GLOBAL_SOURCE_RUNNING", "安装全球服前请先退出国服游戏和北极星。");
        const value = await installGlobalRoot({sourceRoot, targetRoot: conf.globalGamepath, onProgress: progress => send("global-game-root-progress", progress)});
        const now = getSettings();
        if (now.gamepath !== conf.gamepath || now.globalGamepath !== conf.globalGamepath) throw error("GLOBAL_SELECTION_CHANGED", "游戏目录已改变，请重新选择后再安装。");
        send("globalpath-status", {path: value.root, valid: true, selected: true, installable: false, checking: false, source: "installed"});
        return {ok: true, ...value};
      });
      return result;
    } catch (cause) {
      return {ok: false, error: cause.message || String(cause), code: cause.code || "GLOBAL_INSTALL_FAILED"};
    }
  });
  ipcMain.handle("china-game-root-install", async () => {
    let conf;
    try {
      conf = {...getSettings()};
      const findgame = require("./findgame");
      const sourceRoot = findgame.validateGamePath(conf.chinaSourceGamepath) || findgame.validateGamePath(conf.gamepath);
      if (!sourceRoot || !conf.chinaInstallTarget) throw error("CHINA_GAME_ROOT_MISSING", "请先选择有效的国服游戏源目录和新的安装文件夹。");
      ensureDisjoint(sourceRoot, conf.chinaInstallTarget);
      if (conf.globalGamepath) ensureDisjoint(conf.chinaInstallTarget, conf.globalGamepath);
      const value = await runGate("china-game-root-install", async () => {
        const current = getSettings();
        if (current.gamepath !== conf.gamepath || current.chinaSourceGamepath !== conf.chinaSourceGamepath || current.chinaInstallTarget !== conf.chinaInstallTarget || current.globalGamepath !== conf.globalGamepath) throw error("CHINA_SELECTION_CHANGED", "游戏目录已改变，请重新选择后再安装。");
        const snapshot = await processSnapshot();
        if (!snapshot?.ok) throw error("CHINA_PROCESS_CHECK_FAILED", "无法确认游戏进程状态，请重试国服安装。");
        if (hasGame(snapshot, sourceRoot) || hasGame(snapshot, conf.chinaInstallTarget)) throw error("CHINA_SOURCE_RUNNING", "安装国服独立目录前，请先退出正在运行的泰坦陨落 2 和北极星。");
        return installChina({sourceRoot, targetRoot: conf.chinaInstallTarget, onProgress: progress => send("china-game-root-progress", progress)});
      });
      const now = getSettings();
      if (now.gamepath !== conf.gamepath || now.chinaSourceGamepath !== conf.chinaSourceGamepath || now.chinaInstallTarget !== conf.chinaInstallTarget || now.globalGamepath !== conf.globalGamepath) throw error("CHINA_SELECTION_CHANGED", "游戏目录已改变，请重新选择后再安装。");
      await getSettings().save({gamepath: value.root, chinaSourceGamepath: sourceRoot, chinaInstallTarget: "", zip: path.join(value.root, "northstar.zip")});
      send("gamepath-status", {path: value.root, valid: true, selected: true, installable: false, checking: false, source: "installed"});
      send("newpath", value.root);
      try {require("./version").send_info(); require("./update").northstar_autoupdate();} catch (_) {}
      return {ok: true, ...value};
    } catch (cause) {
      return {ok: false, error: cause.message || String(cause), code: cause.code || "CHINA_INSTALL_FAILED"};
    }
  });
}

module.exports = {
  INSTALL_MARKER, CHINA_INSTALL_MARKER, GAME_DIRECTORIES, GAME_FILES, ensureDisjoint, getVolumeFileSystem,
  isEmptyDirectory: isEmptyOrMissingDirectory, inspectInstallTarget, installGlobalRoot, installChinaRoot, register
};
