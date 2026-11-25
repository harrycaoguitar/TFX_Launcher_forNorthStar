"use strict";
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const {readRecord}=require('./backup-records');
const {sameRoot}=require('./game-roots');

const TARGETS = new Set(["pc_stream.starpak", "pc_stream(03).starpak", "pc_stream(05).starpak", "pc_stream(06).starpak", "pc_stream(07).starpak"]);
const MAP_TYPES = Object.freeze(["ao", "col", "gls", "ilm", "nml", "spc", "cav", "opa"]);
const HEIGHTS = Object.freeze([128, 256, 512, 1024, 2048, 4096]);
const JOURNAL_STATES = new Set(["preparing", "pending", "installed", "restored", "rolled-back", "cancelled"]);
const ABSENT_TABLE_ERRORS = new Set(["索引超出了数组界限。", "Index was outside the bounds of the array.",
  "没有匹配到受支持的纹理名称与尺寸", "不支持的纹理尺寸目录", "没有匹配到受支持的皮肤名称与尺寸", "不支持的皮肤尺寸目录", "BUG!\nError Pilot Name."]);
const MAX_UNION_BYTES = 512 * 1024 * 1024;
const validId = value => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
const hashPattern = /^[a-f0-9]{64}$/;
const gameKey = value => path.resolve(value || ".").toLowerCase();
const rangeKey = r => [r.target, r.offset, r.length].join("|");
const overlaps = (a, b) => a.target === b.target && a.offset < b.offset + b.length && b.offset < a.offset + a.length;

function textureFamily(name) {
  if (typeof name !== "string" || !/^[A-Za-z0-9_.-]+\.dds$/i.test(name)) return null;
  const match = /^(.*)_(ao|col|gls|ilm|nml|spc|cav|opa)\.dds$/i.exec(name);
  return match ? match[1].toLowerCase() : null;
}

function validRecord(r) {
  return r && TARGETS.has(r.target) && Number.isSafeInteger(r.offset) && r.offset > 0 &&
    Number.isSafeInteger(r.length) && r.length > 0 && r.length <= 128 * 1024 * 1024 &&
    Number.isSafeInteger(r.offset + r.length) && hashPattern.test(r.beforeHash) && hashPattern.test(r.afterHash);
}

// An official resource repair can restore a position outside the launcher.
// Keep all historical bytes, but retire its older chains once a subsequent
// successful installation records that verified original boundary.
function retired(entry, record, journals) {
  if(entry.ignoredRecords?.has(rangeKey(record)))return true;
  return journals.some(later => later.manifest.createdAt > entry.manifest.createdAt &&
    ["installed", "restored"].includes(later.manifest.state) &&
    later.manifest.records.some(r => r.originalReset === true && !later.ignoredRecords?.has(rangeKey(r)) && rangeKey(r) === rangeKey(record)));
}

async function readJournals(baseDir, gamePath) {
  if(!gamePath)return [];
  const root = path.join(baseDir, "backups"), result = [];
  for (const entry of await fsp.readdir(root, {withFileTypes: true})) {
    if (!entry.isDirectory() || !validId(entry.name)) continue;
    const dir = path.join(root, entry.name);
    let manifest;
    try {manifest = (await readRecord(root,entry.name,gamePath,'manifest.json',{allowOtherGames:true})).manifest;}
    catch (err) {
      if (err.code === "ENOENT") continue; // No manifest is committed before the first write.
      throw Error(`DDS 备份记录无法读取：${entry.name}。请保留备份并先修复记录`);
    }
    if (typeof manifest.gamePath !== "string" || !path.isAbsolute(manifest.gamePath)) throw Error(`DDS 备份游戏目录无效：${entry.name}`);
    if (!sameRoot(manifest.gamePath, gamePath)) continue;
    if (manifest.id !== entry.name || manifest.version !== 1 || typeof manifest.createdAt !== "string" ||
        !Number.isFinite(Date.parse(manifest.createdAt)) || !Array.isArray(manifest.records) ||
        !JOURNAL_STATES.has(manifest.state) || manifest.records.length > 3000 ||
        (["installed", "pending"].includes(manifest.state) && !manifest.records.length) ||
        !manifest.records.every(validRecord)) throw Error(`DDS 备份记录无效：${entry.name}`);
    for (let i = 0; i < manifest.records.length; i++) {
      const r = manifest.records[i];
      if (manifest.records.slice(0, i).some(other => overlaps(r, other))) throw Error(`DDS 备份记录区域重叠：${entry.name}`);
      if (r.family && (typeof r.family !== "string" || r.family !== textureFamily(r.name))) throw Error(`DDS 备份皮肤名称无效：${entry.name}`);
      if (r.originalReset !== undefined && typeof r.originalReset !== "boolean") throw Error(`DDS 备份原版边界无效：${entry.name}`);
    }
    result.push({manifest, dir});
  }
  return result.sort((a, b) => a.manifest.createdAt.localeCompare(b.manifest.createdAt) || a.manifest.id.localeCompare(b.manifest.id));
}

function summarizeBackups(journals) {
  return journals.map((entry, index) => {
    const value = entry.manifest, newer = journals.slice(index + 1).filter(e => ["installed", "pending"].includes(e.manifest.state));
    const coveredBy = new Set();
    let coveredCount = 0, activeCount = 0;
    for (const r of value.records) {
      if (retired(entry, r, journals)) {coveredCount++; coveredBy.add("verified-original-repair"); continue;}
      const covering = newer.filter(e => e.manifest.records.some(other => overlaps(r, other)));
      if (covering.length) {coveredCount++; covering.forEach(e => coveredBy.add(e.manifest.id));}
      else if (value.state === "installed" && r.role !== "reset") activeCount++;
    }
    return {id: value.id, name: value.name, createdAt: value.createdAt, state: value.state,
      count: value.records.length, bytes: value.records.reduce((sum, r) => sum + r.length, 0), coverage: value.coverage || null,
      activeCount, coveredCount, coveredBy: [...coveredBy], historyOnly: value.state === "installed" && activeCount === 0,
      canRestore: ["installed", "pending"].includes(value.state) && coveredBy.size === 0,
      replacedFamilies: value.replacedFamilies || [], resetCount: value.records.filter(r => r.role === "reset").length};
  }).reverse();
}

// Version-1 journals have only positions. Query the original installer's table
// for every documented map type and size in the incoming material family.
// The adapter reads paths; these candidates are never generated DDS files.
async function legacyCatalogue(files, plan, dir) {
  const families = new Map(), result = new Map();
  for (const item of files) {
    const family = textureFamily(item.name);
    if (!family) throw Error(`无法识别 ${item.name} 的材质组，已取消覆盖安装`);
    const originalBase = item.name.replace(/_(ao|col|gls|ilm|nml|spc|cav|opa)\.dds$/i, "");
    const ratio = item.width / item.height;
    families.set(`${family}|${ratio}`, {family, originalBase, ratio});
    result.set(rangeKey(item), {...item, family});
  }
  const candidates = [];
  for (const {family, originalBase, ratio} of families.values()) for (const suffix of MAP_TYPES) for (const height of HEIGHTS) {
    const width = height * ratio;
    if (![1, 2].includes(ratio) || width < 256 || width > 4096) continue;
    const name = `${originalBase}_${suffix}.dds`, candidate = {name, family, width, height};
    candidate.path = path.join(dir, "replacement-table", String(candidates.length), `${width}x${height}`, name);
    candidates.push(candidate);
  }
  if (candidates.length > 2500) throw Error("覆盖安装的材质组过多，请分包安装");
  const plans = await plan(candidates.map(item => item.path), dir);
  if (!Array.isArray(plans) || plans.length !== candidates.length) throw Error("覆盖安装的旧皮肤元数据响应不完整");
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i], item = plans[i];
    if (!item || gameKey(item.path) !== gameKey(candidate.path) || typeof item.ok !== "boolean") throw Error("覆盖安装的旧皮肤元数据路径无效");
    if (!item.ok) {
      if (ABSENT_TABLE_ERRORS.has(String(item.error).trim())) continue;
      throw Error(`无法确认旧皮肤的皮肤区域：${candidate.name} ${candidate.width}×${candidate.height}。请先恢复旧备份；元数据错误：${String(item.error || "未知错误").slice(0,240)}`);
    }
    if (!TARGETS.has(item.target) || !Number.isSafeInteger(item.offset) || item.offset <= 0 ||
        !Number.isSafeInteger(item.length) || item.length <= 0 || item.length > 128 * 1024 * 1024 ||
        !Number.isSafeInteger(item.offset + item.length)) throw Error("覆盖安装的旧皮肤元数据无效");
    const key = rangeKey(item), previous = result.get(key), value = {...candidate, ...item};
    if (previous && previous.family !== value.family) throw Error("覆盖安装材质表存在歧义，已取消操作");
    result.set(key, value);
  }
  return result;
}

async function savedBytes(entry, index, type, hash) {
  const r = entry.manifest.records[index];
  const data = await fsp.readFile(path.join(entry.dir, `${index}.${type}.bin`));
  if (data.length !== r.length || hash(data) !== r[`${type}Hash`]) throw Error(`DDS 备份已损坏：${entry.manifest.id}`);
  return data;
}

async function prepareReplacement({pkg, journals, plan, dir, readRange, hash, gamePath, originals = new Map(), prepareResources}) {
  if (journals.some(e => e.manifest.state === "pending")) throw Error("上次 DDS 操作尚未完成，请先恢复对应备份，再安装新皮肤");
  const installed = journals.filter(e => e.manifest.state === "installed"), incoming = new Map(), families = new Set();
  for (const item of pkg.files) {
    const family = textureFamily(item.name);
    if (!family) throw Error(`无法识别 ${item.name} 的材质组，已取消覆盖安装`);
    const source = await fsp.readFile(item.path);
    if (hash(source) !== item.sha256) throw Error("校验后的皮肤文件已发生变化，请重新选择");
    incoming.set(rangeKey(item), {...item, family, after: source.subarray(item.skip, item.skip + item.length), role: "skin"});
    families.add(family);
  }
  const legacy = installed.some(e => e.manifest.records.some(r => !r.family));
  const catalogue = legacy ? await legacyCatalogue(pkg.files, plan, dir) : new Map();
  const chains = new Map();
  for (const entry of installed) for (let index = 0; index < entry.manifest.records.length; index++) {
    const r = entry.manifest.records[index], inferred = r.family ? r : catalogue.get(rangeKey(r));
    if (retired(entry, r, journals)) continue;
    if (!inferred || !families.has(inferred.family)) continue;
    const key = rangeKey(r);
    if (!chains.has(key)) chains.set(key, []);
    chains.get(key).push({entry, index, record: r, info: inferred});
  }
  const union = new Map(incoming);
  for (const [key, original] of originals) {
    if (!families.has(original.family || textureFamily(original.name))) continue;
    if (!union.has(key)) union.set(key, {...original, family:textureFamily(original.name), role:"reset", after:original.bytes});
  }
  for (const [key, chain] of chains) {
    if (!union.has(key)) union.set(key, {...chain[chain.length - 1].info, ...chain[chain.length - 1].record, role: "reset"});
  }
  const rows = [...union.values()];
  if (rows.length > 1000 || rows.reduce((sum, r) => sum + r.length, 0) > MAX_UNION_BYTES) throw Error("覆盖安装涉及的皮肤区域超过 512 MB，请先恢复旧皮肤");
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (rows.slice(0, i).some(other => overlaps(r, other))) throw Error("旧皮肤与新皮肤的皮肤区域不完全对应，请先恢复旧备份");
    for (const entry of installed) for (const other of entry.manifest.records) {
      if (overlaps(r, other) && rangeKey(r) !== rangeKey(other)) throw Error("旧 DDS 备份包含不兼容的皮肤区域，请先恢复旧备份");
    }
  }
  const supersedes = new Set();
  // Recovery must happen before reading baselines for omitted/old skin rows,
  // which can live in a different container from the incoming DDS files.
  if(prepareResources)await prepareResources(rows);
  for (const r of rows) {
    const key = rangeKey(r), chain = chains.get(key) || [];
    // Every managed occurrence at this exact position must be recognized.
    const all = installed.flatMap(entry => entry.manifest.records.map((record, index) => ({entry, record, index}))).filter(v => rangeKey(v.record) === key && !retired(v.entry, v.record, journals));
    if (all.length !== chain.length) throw Error("旧 DDS 备份的材质归属无法确认，请先恢复旧备份");
    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      if (i && (chain[i - 1].record.afterHash !== current.record.beforeHash ||
          chain[i - 1].entry.manifest.createdAt === current.entry.manifest.createdAt)) throw Error("旧 DDS 备份的覆盖顺序不明确，请先按顺序恢复旧备份");
      // Verify both sides of each relevant journal before any game data write.
      await savedBytes(current.entry, current.index, "before", hash);
      await savedBytes(current.entry, current.index, "after", hash);
      supersedes.add(current.entry.manifest.id);
    }
    r.before = await readRange(path.join(gamePath, "r2", "paks", "Win64", r.target), r.offset, r.length);
    if (chain.length && originals.has(key) && hash(r.before) === hash(originals.get(key).bytes) && chain[0].record.beforeHash !== hash(originals.get(key).bytes)) r.originalReset = true;
    if (chain.length && hash(r.before) !== chain[chain.length - 1].record.afterHash) {
      const original = originals.get(key);
      if (!original || hash(r.before) !== hash(original.bytes)) throw Error("旧皮肤区域已被其他程序修改，覆盖安装已取消；请先处理冲突或恢复游戏文件");
      r.originalReset = true;
    }
    if (r.role === "reset") r.after = originals.has(key) ? originals.get(key).bytes : await savedBytes(chain[0].entry, chain[0].index, "before", hash);
    r.beforeHash = hash(r.before); r.afterHash = hash(r.after);
  }
  return {rows, supersedes: [...supersedes], replacedFamilies: [...families], resetCount: rows.filter(r => r.role === "reset").length};
}

module.exports = {readJournals, summarizeBackups, prepareReplacement, textureFamily, rangeKey, overlaps, validRecord, legacyCatalogue, retired};
