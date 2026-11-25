"use strict";
// Records are recovery data, not disposable import cache. Only terminal,
// unreferenced records may be removed, and links never enter a deletion tree.
const fs = require("fs"), fsp = fs.promises, path = require("path"), crypto = require("crypto");
const validId = value => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const terminalStates = new Set(["restored", "rolled-back", "cancelled"]);
const {sameRoot} = require("./game-roots");
const sha256 = data => crypto.createHash("sha256").update(data).digest("hex");

function deletionPolicy(manifest, {requiredBoundary = false, referenced = false} = {}) {
  if (referenced) return {canDelete:false, deleteReason:"这份备份仍用于跨格式皮肤恢复，请先恢复对应皮肤"};
  if (!terminalStates.has(manifest.state)) return {canDelete:false, deleteReason:"这份备份仍用于皮肤替换或恢复，请先恢复皮肤再删除"};
  if (requiredBoundary) return {canDelete:false, deleteReason:"这份记录保留原版皮肤边界，较早的皮肤备份仍依赖它"};
  return {canDelete:true, deleteReason:""};
}

async function assertUnlinkedAncestors(file, message = "备份目录包含链接，已停止删除以保护其他文件") {
  const absolute = path.resolve(file), paths = [];
  let current = absolute;
  while (true) {paths.push(current);const parent = path.dirname(current);if(parent === current)break;current = parent;}
  for (const entry of paths.reverse()) {
    const stat = await fsp.lstat(entry);
    if (stat.isSymbolicLink()) throw Error(message);
  }
}

async function recordLocation(root, id) {
  if (!validId(id)) throw Error("皮肤备份编号无效");
  const base = path.resolve(root), dir = path.join(base,id);
  if (path.dirname(dir) !== base) throw Error("皮肤备份目录无效");
  await assertUnlinkedAncestors(dir);
  if (!(await fsp.lstat(dir)).isDirectory()) throw Error("皮肤备份目录无效");
  return dir;
}

async function readRecord(root, id, gamePath, filename = "manifest.json", {allowOtherGames = false} = {}) {
  if (!["manifest.json", "transaction.json"].includes(filename)) throw Error("皮肤备份记录文件无效");
  const dir = await recordLocation(root,id), file = path.join(dir,filename);
  const stat = await fsp.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw Error("皮肤备份记录无效");
  const handle=await fsp.open(file,"r");let bytes;
  try{
    const opened=await handle.stat();
    if(!opened.isFile()||opened.dev!==stat.dev||opened.ino!==stat.ino||opened.size!==stat.size)throw Error("备份记录已变化，请刷新后重试");
    bytes=await handle.readFile();
  }finally{await handle.close();}
  await assertUnlinkedAncestors(file);
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (manifest.version !== 1 || manifest.id !== id || typeof manifest.gamePath !== "string" || !path.isAbsolute(manifest.gamePath) || !gamePath || (!allowOtherGames && !sameRoot(manifest.gamePath, gamePath))) throw Error("备份与当前游戏目录不匹配");
  return {dir,file,manifest,sha256:sha256(bytes)};
}

async function readBackupManifest(baseDir,id,gamePath) {return readRecord(path.join(baseDir,"backups"),id,gamePath);}

// Preflight the whole tree before the first unlink, then verify each inode.
// Keep the journal until all its payloads are gone, so a locked file can be
// retried. Never change attributes (a file may be hard linked to live data).
async function inspectRemoval(root,id,record) {
  const dir = await recordLocation(root,id), files = [], directories = [];
  async function inspect(current) {
    const stat = await fsp.lstat(current);
    if (stat.isSymbolicLink()) throw Error("备份目录包含链接，已停止删除以保护其他文件");
    if (stat.isDirectory()) {for (const item of await fsp.readdir(current))await inspect(path.join(current,item));directories.push({file:current,stat});}
    else if (stat.isFile()) files.push({file:current,stat});
    else throw Error("备份目录包含不受支持的文件，已停止删除");
  }
  await inspect(dir);
  if (!record || record.dir !== dir || sha256(await fsp.readFile(record.file)) !== record.sha256) throw Error("备份记录已变化，请刷新后重试");
  return {dir,files,directories};
}

async function removeRecord(root,id,record) {
  const {files,directories}=await inspectRemoval(root,id,record);
  files.sort((a,b) => Number(a.file === record.file) - Number(b.file === record.file));
  let bytes = 0, count = 0;
  for (const entry of files) {
    await assertUnlinkedAncestors(path.dirname(entry.file));
    const now = await fsp.lstat(entry.file);
    if (!now.isFile() || now.isSymbolicLink() || now.dev !== entry.stat.dev || now.ino !== entry.stat.ino || now.size !== entry.stat.size) throw Error("备份文件已变化，已停止删除");
    await fsp.unlink(entry.file);bytes += entry.stat.size;count++;
  }
  for (const entry of directories) {
    await assertUnlinkedAncestors(entry.file);
    const now = await fsp.lstat(entry.file);
    if (!now.isDirectory() || now.dev !== entry.stat.dev || now.ino !== entry.stat.ino) throw Error("备份目录已变化，已停止删除");
    await fsp.rmdir(entry.file);
  }
  return {backupId:id,deleted:true,bytes,files:count};
}

async function removeBackupDirectory(baseDir,id,record) {return removeRecord(path.join(baseDir,"backups"),id,record);}

function ddsBoundaryRequired(entry,journals) {
  if (entry.manifest.state !== "restored") return false;
  return entry.manifest.records.some(record => record.originalReset === true && journals.some(older => older.manifest.createdAt < entry.manifest.createdAt && older.manifest.state === "installed" && older.manifest.records.some(other => other.target === record.target && other.offset === record.offset && other.length === record.length)));
}

module.exports = {validId,terminalStates,deletionPolicy,assertUnlinkedAncestors,readRecord,readBackupManifest,inspectRemoval,removeRecord,removeBackupDirectory,ddsBoundaryRequired};
