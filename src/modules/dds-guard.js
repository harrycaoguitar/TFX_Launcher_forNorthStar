"use strict";
// Shared skin protection reads persistent journals directly. It never imports
// DDS/VTF IPC modules or asks either installer to mutate/initialize storage.
const path = require("path"), fs = require("fs"), fsp = fs.promises;
const {app} = require("electron");
const {DdsProtection} = require("./dds-protection");
const {readJournals, summarizeBackups} = require("./dds-replacement");
const {parseIndex, safeAssetPath, MAX_INDEX_BYTES} = require("./vtf-vpk");
const {readRecord, assertUnlinkedAncestors} = require("./backup-records");
const isRunning = require("./is_running");
const validId = value => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const hashPattern = /^[a-f0-9]{64}$/;
const states = new Set(["preparing", "pending", "installed", "restored", "rolled-back", "cancelled", "failed"]);
const indexName = "englishclient_mp_common.bsp.pak000_dir.vpk";
const terminalSwitchStates = new Set(["installed", "restored", "rolled-back", "cancelled"]);

async function entriesIfPresent(directory) {
  try {await assertUnlinkedAncestors(directory); return await fsp.readdir(directory, {withFileTypes: true});}
  catch (error) {if (error.code === "ENOENT") return []; throw error;}
}
async function recordsFor(directory, gamePath, filename = "manifest.json") {
  const result = [];
  for (const entry of await entriesIfPresent(directory)) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !validId(entry.name)) continue;
    const file = path.join(directory, entry.name, filename);
    let bytes, value;
    try {
      await assertUnlinkedAncestors(file); const stat = await fsp.lstat(file);
      if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw Error("皮肤安装记录文件无效，请保留备份并检查安装页面");
      bytes = await fsp.readFile(file); const body = bytes.toString("utf8");
      if (!Buffer.from(body).equals(bytes)) throw Error(); value = JSON.parse(body);
    } catch (error) {if (error.code === "ENOENT") continue; throw Error("皮肤安装记录无法读取，请保留备份并检查安装页面");}
    if (!value || typeof value.gamePath !== "string" || !path.isAbsolute(value.gamePath)) throw Error("皮肤安装记录中的游戏目录无效，请检查备份");
    if (!samePath(value.gamePath, gamePath)) continue;
    result.push(await readRecord(directory, entry.name, gamePath, filename));
  }
  return result;
}
async function activeDds(baseDir, gamePath) {
  const directory = path.join(baseDir, "backups");
  if (!(await entriesIfPresent(directory)).length) return [];
  await recordsFor(directory, gamePath);
  // The established coverage/original-reset rules identify surviving DDS writes.
  const journals = await readJournals(baseDir, gamePath);
  const summarized = summarizeBackups(journals).filter(item => item.state === "pending" || item.activeCount > 0);
  const result = summarized.map(item => ({...item, format: "dds", gamePath, state: item.state === "pending" ? "pending" : "installed"}));
  for (const entry of journals) if (entry.manifest.state === "preparing") result.push({id: entry.manifest.id, name: entry.manifest.name, format: "dds", gamePath, state: "pending", transactionState: "preparing"});
  return result;
}
function validateVtf(value, id) {
  if (value.version !== 1 || value.id !== id || !states.has(value.state) || !Number.isFinite(Date.parse(value.createdAt)) || value.indexName !== indexName || !Number.isInteger(value.archiveIndex) || value.archiveIndex < 0 || value.archiveIndex > 999 || value.archiveName !== `client_mp_common.bsp.pak000_${String(value.archiveIndex).padStart(3, "0")}.vpk` || value.stageArchive !== `.vyra-vtf-${id}.archive.tmp` || value.stageIndex !== `.vyra-vtf-${id}.index.tmp` || !hashPattern.test(value.beforeHash) || value.afterHash && !hashPattern.test(value.afterHash) || value.archiveHash && !hashPattern.test(value.archiveHash) || !Array.isArray(value.files) || value.files.length > 2000) throw Error("VTF 皮肤安装记录格式无效，请保留备份并检查 VTF 安装页面");
  if (["installed", "pending"].includes(value.state) && (!value.files.length || !hashPattern.test(value.afterHash) || !hashPattern.test(value.archiveHash))) throw Error("VTF 皮肤安装记录不完整，请检查对应备份");
  for (const file of value.files) {
    safeAssetPath(file.path);
    if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > 4 * 1024 * 1024 * 1024 || !hashPattern.test(file.sha256)) throw Error("VTF 皮肤资源记录无效，请检查对应备份");
  }
}
async function activeVtf(baseDir, gamePath) {
  const records = await recordsFor(path.join(baseDir, "backups"), gamePath), installed = [], result = [];
  for (const record of records) {
    const value = record.manifest; validateVtf(value, path.basename(record.dir));
    if (["preparing", "pending"].includes(value.state)) result.push({...value, format: "vtf", state: "pending", transactionState: value.state});
    else if (value.state === "installed") installed.push(value);
  }
  if (!installed.length) return result;
  const currentPath = path.join(gamePath, "vpk", indexName); await assertUnlinkedAncestors(currentPath);
  const stat = await fsp.lstat(currentPath);
  if (!stat.isFile() || stat.size > MAX_INDEX_BYTES) throw Error("游戏 common 索引文件无效或超过支持的大小");
  const current = new Map(parseIndex(await fsp.readFile(currentPath)).entries.map(entry => [entry.path.toLowerCase(), entry.index]));
  for (const value of installed) {
    const activeCount = value.files.filter(file => current.get(file.path.toLowerCase()) === value.archiveIndex).length;
    // Cross-format replacement may keep recovery journals while retiring all
    // their VPK entries. The live index is the precise active-record boundary.
    if (activeCount) result.push({...value, activeCount, format: "vtf"});
  }
  return result;
}
async function pendingSwitch(baseDir, gamePath) {
  const result = [];
  for (const record of await recordsFor(baseDir, gamePath, "transaction.json")) {
    const value = record.manifest;
    if (!validId(value.id) || !["dds", "vtf"].includes(value.format) || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.state !== "string" || !Array.isArray(value.ranges) || !Array.isArray(value.weapons)) throw Error("跨格式皮肤安装记录无效，请保留恢复备份");
    if (!terminalSwitchStates.has(value.state)) result.push({id: value.id, name: value.name, format: value.format, gamePath, state: "pending", transactionState: value.state, crossFormat: true});
  }
  return result;
}
function createJournalReader({ddsDir, vtfDir, switchDir}) {
  return async gamePath => {
    if (!gamePath) return [];
    const [dds, vtf, switching] = await Promise.all([activeDds(ddsDir, gamePath), activeVtf(vtfDir, gamePath), pendingSwitch(switchDir, gamePath)]);
    const seenPending = new Set([...dds, ...vtf].filter(item => item.state === "pending").map(item => item.skinSwitchId).filter(Boolean));
    return [...dds, ...vtf, ...switching.filter(item => !seenPending.has(item.id))];
  };
}
const root = path.join(app.getPath("appData"), "fold-launcher"), baseDir = path.join(root, "dds");
const protection = new DdsProtection({baseDir, documentsPath: () => app.getPath("documents"), isGameRunning: () => isRunning.game(1500),
  getActiveBackups: createJournalReader({ddsDir: baseDir, vtfDir: path.join(root, "vtf"), switchDir: path.join(root, "skin-switch")})});
// Pure reader factory is exported for isolated filesystem verification.
protection.createJournalReader = createJournalReader;
module.exports = protection;
