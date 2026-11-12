"use strict";

// Northstar channels are different client distributions. Changing a hostname
// cannot replace their loaders, plugins or core scripts. This module owns only
// the explicit official paths below and keeps a write-ahead recovery journal.
const fs = require("fs"), fsp = fs.promises, path = require("path"), crypto = require("crypto");
const {acquireGameLock} = require("./vtf-engine");

const CHANNELS = ["cn", "global"], PROFILE = "R2Northstar";
const CORE_NAMES = ["Northstar.Client", "Northstar.Custom", "Northstar.CustomServers"];
const CORE_DIRS = CORE_NAMES.map(name => `${PROFILE}/mods/${name}`);
const ROOT_FILES = new Set(["northstarlauncher.exe", "northstar.dll", "launcher.dll", "bin/x64_retail/wsock32.dll"]);
const PROFILE_FILES = new Set(["northstar.dll", "legal.txt", "mods/license", "mods/readme.md", "mods/contributing.md", "plugins/ranim.dll", "plugins/discordrpc.dll", "plugins/serialized_io.dll"]);
const MAX_FILES = 12000, MAX_FILE_BYTES = 128 * 1024 * 1024, MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/, ID = /^[a-f0-9-]{36}$/;
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const key = value => value.toLowerCase();
const samePath = (a, b) => key(path.resolve(a)) === key(path.resolve(b));
const inside = (base, candidate) => {const relative = path.relative(base, candidate); return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);};
function compareVersion(a, b) {
  const left = String(a).replace(/^v/, "").split(/[.+-]/).slice(0, 3).map(Number), right = String(b).replace(/^v/, "").split(/[.+-]/).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

function relativePath(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || value.includes("\\") || value.startsWith("/") || value.includes("\0")) throw Error("北极星文件路径无效");
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw Error("北极星文件路径包含不安全的名称");
  return value;
}
function ownedPath(value) {
  const clean = relativePath(value), lower = key(clean);
  if (ROOT_FILES.has(lower)) return true;
  if (!lower.startsWith(key(PROFILE) + "/")) return false;
  const profilePath = lower.slice(PROFILE.length + 1);
  if (PROFILE_FILES.has(profilePath)) return true;
  return CORE_DIRS.some(directory => lower.startsWith(key(directory) + "/"));
}
function validateManifest(manifest, channel) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.channel !== channel || !CHANNELS.includes(channel) || manifest.profile !== PROFILE || typeof manifest.version !== "string" || !/^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(manifest.version)) throw Error("北极星客户端清单的频道或版本无效");
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > MAX_FILES || !Array.isArray(manifest.ownedDirectories) || manifest.ownedDirectories.length !== CORE_DIRS.length || !CORE_DIRS.every(directory => manifest.ownedDirectories.includes(directory))) throw Error("北极星客户端清单缺少完整核心模组");
  const seen = new Set(); let total = 0;
  for (const file of manifest.files) {
    if (!file || !ownedPath(file.path) || !HASH.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES || seen.has(key(file.path))) throw Error("北极星客户端清单包含重复、越界或非官方受控文件");
    seen.add(key(file.path)); total += file.size;
    if (total > MAX_TOTAL_BYTES) throw Error("北极星客户端体积超出安全上限");
  }
  for (const filename of seen) {
    let parent = filename;
    while (parent.includes("/")) {parent = parent.slice(0, parent.lastIndexOf("/")); if (seen.has(parent)) throw Error("北极星客户端存在文件与文件夹重名");}
  }
  if (!seen.has("northstarlauncher.exe") || !seen.has(channel === "cn" ? "northstar.dll" : "r2northstar/northstar.dll") || !seen.has("bin/x64_retail/wsock32.dll") || !CORE_DIRS.every(directory => seen.has(key(directory + "/mod.json")))) throw Error("北极星客户端缺少启动文件或核心模组清单");
  if (channel === "cn" && (seen.has("r2northstar/northstar.dll") || !seen.has("launcher.dll")) || channel === "global" && (seen.has("northstar.dll") || seen.has("launcher.dll"))) throw Error("北极星客户端清单混合了国服与全球服的加载文件");
  return manifest;
}
async function lstat(filename) {try {return await fsp.lstat(filename);} catch (error) {if (error.code === "ENOENT") return null; throw error;}}
async function safeAncestors(root, relative, includeLeaf = true) {
  relativePath(relative); let current = root;
  const parts = relative.split("/"), count = includeLeaf ? parts.length : parts.length - 1;
  for (let i = 0; i < count; i++) {
    current = path.join(current, parts[i]); const stat = await lstat(current);
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw Error("北极星受控路径包含符号链接或目录联接，已停止切换：" + relative);
    if (i < parts.length - 1 && !stat.isDirectory()) throw Error("北极星文件路径被同名文件阻挡：" + relative);
  }
  return path.join(root, ...parts);
}
async function fileInfo(filename) {
  const stat = await lstat(filename);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) throw Error("北极星受控文件不是普通文件：" + filename);
  if (stat.size > MAX_FILE_BYTES) throw Error("北极星受控文件过大，已停止切换：" + filename);
  const digest = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filename)) digest.update(chunk);
  return {sha256: digest.digest("hex"), size: stat.size};
}
async function validBinary(filename) {
  const handle = await fsp.open(filename, "r");
  try {
    const stat = await handle.stat(), dos = Buffer.alloc(64);
    if (stat.size < 88 || (await handle.read(dos, 0, dos.length, 0)).bytesRead !== dos.length || dos.readUInt16LE(0) !== 0x5a4d) return false;
    const offset = dos.readUInt32LE(60); if (offset < 64 || offset > Math.min(stat.size - 26, 4 * 1024 * 1024)) return false;
    const pe = Buffer.alloc(26); if ((await handle.read(pe, 0, pe.length, offset)).bytesRead !== pe.length) return false;
    return pe.readUInt32LE(0) === 0x00004550 && pe.readUInt16LE(4) === 0x8664 && pe.readUInt16LE(24) === 0x20b;
  } finally {await handle.close();}
}
const equalInfo = (a, b) => a === null && b === null || !!a && !!b && a.sha256 === b.sha256 && a.size === b.size;
async function readJson(filename) {try {return JSON.parse(await fsp.readFile(filename, "utf8"));} catch (error) {if (error.code === "ENOENT") return null; throw Error("北极星恢复记录无法读取，请保留备份：" + filename + "。" + error.message);}}
async function writeJson(filename, value) {
  const temporary = filename + "." + crypto.randomUUID() + ".tmp", handle = await fsp.open(temporary, "wx");
  try {await handle.writeFile(JSON.stringify(value, null, 2), "utf8"); await handle.sync();} finally {await handle.close();}
  try {await fsp.rename(temporary, filename);} finally {await fsp.rm(temporary, {force: true});}
}
async function safeCopy(source, target, expected) {
  await fsp.mkdir(path.dirname(target), {recursive: true});
  await fsp.copyFile(source, target, fs.constants.COPYFILE_EXCL);
  const handle = await fsp.open(target, "r+"); try {await handle.sync();} finally {await handle.close();}
  if (!equalInfo(await fileInfo(target), expected) || !equalInfo(await fileInfo(source), expected)) throw Error("北极星文件在备份或准备时发生变化，已停止切换");
}
async function validateBundle(directory, channel) {
  const root = await fsp.realpath(path.resolve(directory));
  await safeAncestors(root, "manifest.json");
  const stat = await fsp.stat(path.join(root, "manifest.json"));
  if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw Error("北极星客户端清单体积无效");
  const manifest = validateManifest(await readJson(path.join(root, "manifest.json")), channel);
  await safeAncestors(root, "payload");
  const files = new Map();
  for (const file of manifest.files) {
    const filename = await safeAncestors(root, "payload/" + file.path);
    if (!equalInfo(await fileInfo(filename), file)) throw Error("北极星客户端文件校验失败：" + file.path);
    if (/\.(?:exe|dll)$/i.test(file.path) && !await validBinary(filename)) throw Error("北极星客户端包含无效的 64 位启动文件：" + file.path);
    files.set(key(file.path), {...file, source: filename});
  }
  for (const name of CORE_NAMES) {
    const file = files.get(key(PROFILE + "/mods/" + name + "/mod.json"));
    if (file.size > 1024 * 1024) throw Error("北极星核心模组清单过大");
    let mod; try {mod = JSON.parse(await fsp.readFile(file.source, "utf8"));} catch (_) {throw Error("北极星核心模组清单不是有效 JSON：" + name);}
    if (mod.Name !== name || String(mod.Version).replace(/^v/, "") !== manifest.version.replace(/^v/, "")) throw Error("北极星核心模组的名称或版本与客户端清单不一致：" + name);
  }
  return {directory: root, manifest, files, digest: hash(Buffer.from(JSON.stringify(manifest)))};
}
async function defaultProcessCheck() {
  if (process.platform !== "win32") throw Error("北极星客户端切换需要 Windows 进程检查");
  const snapshot = await require("./is_running").snapshot();
  if (!snapshot?.ok) throw Error("无法读取游戏进程，已停止北极星文件切换");
  return snapshot;
}

class NorthstarClientSwitcher {
  constructor({bundleRoot = path.join(__dirname, "../tools/clients"), bundleProvider, stateRoot, processCheck = defaultProcessCheck, acquireLock = acquireGameLock, progress = () => {}, hook = async () => {}} = {}) {
    this.bundleRoot = bundleRoot; this.bundleProvider = bundleProvider; this.stateRoot = stateRoot;
    this.processCheck = processCheck; this.acquireLock = acquireLock; this.progress = progress; this.hook = hook; this.busy = false;
    this.rotation = require("./northstar-client-rotation")(this, {fsp, path, crypto, key, hash, samePath, inside, lstat, safeAncestors, fileInfo, equalInfo, readJson, writeJson, safeCopy, validateManifest, validateBundle, CORE_DIRS, ROOT_FILES, CHANNELS, ID, HASH, MAX_FILES, MAX_FILE_BYTES});
  }
  emit(phase, percent, message, detail = {}) {try {this.progress({phase, percent, message, ...detail});} catch (_) { /* A disconnected renderer cannot break a disk transaction. */ }}
  async assertStopped(root) {
    const result = await this.processCheck(root);
    let running;
    if (typeof result === "boolean") running = result;
    else if (result && result.ok === true && typeof result.running === "boolean") running = result.running;
    else if (result && result.ok === true && Array.isArray(result.processes)) running = require("./game-roots").hasGame(result, root);
    else throw Error("无法确认游戏进程，已停止北极星文件切换");
    if (running) throw Error("请先退出游戏及北极星进程，再切换客户端文件");
  }
  async context(gameRoot, profile) {
    const root = await fsp.realpath(path.resolve(gameRoot));
    if (!(await fsp.stat(path.join(root, "Titanfall2.exe"))).isFile()) throw Error("游戏目录中未找到 Titanfall2.exe");
    const profilePath = path.resolve(root, profile || PROFILE);
    if (!inside(root, profilePath) || samePath(root, profilePath)) throw Error("北极星配置目录必须位于游戏目录内");
    const relative = relativePath(path.relative(root, profilePath).split(path.sep).join("/"));
    if (["r2", "bin", "vpk", "platform", ".tfx"].includes(key(relative.split("/")[0]))) throw Error("北极星配置目录不能覆盖游戏资源目录");
    await safeAncestors(root, relative);
    const profileStat = await lstat(profilePath); if (profileStat && !profileStat.isDirectory()) throw Error("北极星配置目录被同名文件阻挡");
    const profileKey = hash(Buffer.from(key(relative))).slice(0, 24), rootKey = hash(Buffer.from(key(root))).slice(0, 24);
    const sharedState = this.stateRoot ? path.join(path.resolve(this.stateRoot), rootKey) : path.join(root, ".tfx/client-switch");
    const state = path.join(sharedState, profileKey);
    if (this.stateRoot && inside(profilePath, state)) throw Error("客户端备份目录不能位于北极星配置目录内");
    if (inside(root, state)) await safeAncestors(root, path.relative(root, state).split(path.sep).join("/"));
    else {
      let current = path.parse(state).root;
      for (const part of state.slice(current.length).split(path.sep).filter(Boolean)) {current = path.join(current, part); const stat = await lstat(current); if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw Error("客户端备份目录包含联接或同名文件");}
    }
    return {root, profile: relative, profilePath, state, sharedState};
  }
  mapPath(context, source) {return source.startsWith(PROFILE + "/") ? context.profile + source.slice(PROFILE.length) : source;}
  sourcePath(context, target) {return key(target).startsWith(key(context.profile) + "/") ? PROFILE + target.slice(context.profile.length) : target;}
  async scan(context, roots, extras = []) {
    const files = new Map(), exclude = new Set(extras.map(key)); let total = 0;
    const visit = async relative => {
      const filename = await safeAncestors(context.root, relative), stat = await lstat(filename); if (!stat) return;
      if (stat.isSymbolicLink()) throw Error("北极星受控目录包含符号链接，已停止切换：" + relative);
      if (stat.isDirectory()) {
        for (const entry of await fsp.readdir(filename, {withFileTypes: true})) await visit(relative + "/" + entry.name);
      } else if (stat.isFile()) {
        if (exclude.has(key(relative))) return;
        if (!ownedPath(this.sourcePath(context, relative))) throw Error("北极星受控目录包含非官方路径：" + relative);
        const info = await fileInfo(filename);
        if (files.has(key(relative))) throw Error("北极星受控目录存在大小写重复文件");
        const after = await lstat(filename);
        if (!after?.isFile() || after.isSymbolicLink() || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs) throw Error("北极星受控文件在校验时发生变化，已停止切换");
        files.set(key(relative), {path: relative, ...info, stamp: {size: after.size, mtimeMs: after.mtimeMs, ctimeMs: after.ctimeMs, ino: after.ino, dev: after.dev}}); total += info.size;
        if (files.size > MAX_FILES || total > MAX_TOTAL_BYTES) throw Error("北极星受控目录体积超出安全上限");
      } else throw Error("北极星受控目录包含特殊文件：" + relative);
    };
    for (const relative of new Map(roots.map(value => [key(value), value])).values()) await visit(relative);
    return files;
  }
  validateReceipt(context, receipt) {
    if (receipt === null) return null;
    if (receipt.schemaVersion !== 1 || !CHANNELS.includes(receipt.channel) || !samePath(receipt.gameRoot, context.root) || key(receipt.profile) !== key(context.profile) || !HASH.test(receipt.bundleDigest) || !Array.isArray(receipt.files) || receipt.files.length > MAX_FILES) throw Error("北极星已安装状态记录无效，已停止切换");
    const seen = new Set();
    for (const file of receipt.files) if (!file || !ownedPath(this.sourcePath(context, file.path)) || !HASH.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES || seen.has(key(file.path))) throw Error("北极星已安装状态包含无效文件"); else seen.add(key(file.path));
    return receipt;
  }
  async verifyReceipt(context, receipt, current) {
    const shared = this.validateSharedReceipt(context, await readJson(path.join(context.sharedState, "root-installed.json")));
    const expected = new Map(receipt.files.filter(file => !ROOT_FILES.has(key(file.path))).map(file => [key(file.path), file]));
    for (const file of shared?.files || receipt.files.filter(file => ROOT_FILES.has(key(file.path)))) expected.set(key(file.path), file);
    for (const filename of new Set([...expected.keys(), ...current.keys()])) if (!equalInfo(expected.get(filename) || null, current.get(filename) || null)) throw Object.assign(Error("北极星核心文件已被外部程序修改，已保留备份并停止切换：" + (current.get(filename)?.path || expected.get(filename)?.path || filename)), {code: "CLIENT_RECEIPT_MISMATCH"});
  }
  validateSharedReceipt(context, receipt) {
    if (!receipt) return null;
    if (receipt.schemaVersion !== 1 || !samePath(receipt.gameRoot, context.root) || !CHANNELS.includes(receipt.channel) || !Array.isArray(receipt.files) || receipt.files.length > ROOT_FILES.size) throw Error("北极星根目录客户端记录无效");
    const seen = new Set();
    for (const file of receipt.files) if (!file || !ROOT_FILES.has(key(file.path)) || !HASH.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES || seen.has(key(file.path))) throw Error("北极星根目录客户端文件记录无效"); else seen.add(key(file.path));
    return receipt;
  }
  async writeReceipts(context, receipt) {
    await writeJson(path.join(context.state, "installed.json"), receipt);
    const shared = {schemaVersion: 1, gameRoot: context.root, channel: receipt.channel, version: receipt.version, transactionId: receipt.transactionId, files: receipt.files.filter(file => ROOT_FILES.has(key(file.path)))};
    await writeJson(path.join(context.sharedState, "root-installed.json"), shared);
  }
  async resolveBundles(context, overrideRoot, selected) {
    const bundles = {};
    for (const channel of selected ? [selected] : CHANNELS) {
      const provided = overrideRoot ? path.join(overrideRoot, channel) : this.bundleProvider ? await this.bundleProvider(channel) : path.join(this.bundleRoot, channel);
      const directory = typeof provided === "string" ? provided : provided?.directory;
      if (!directory) throw Error("所选北极星客户端缓存不可用：" + channel);
      let bundle = await validateBundle(directory, channel); bundle.source = "official";
      if (provided?.expectedDigest && provided.expectedDigest !== bundle.digest) throw Error("北极星客户端缓存清单与分发记录不一致");
      const local = path.join(context.state, "channel-cache", channel);
      if (!overrideRoot && provided?.preferSnapshot !== false && await lstat(path.join(local, "manifest.json"))) {
        const snapshot = await validateBundle(local, channel);
        if (snapshot.manifest.provenance?.kind !== "private-installed-snapshot" || !samePath(snapshot.manifest.provenance.gameRoot, context.root) || key(snapshot.manifest.provenance.profile) !== key(context.profile)) throw Error("北极星本地客户端快照来源无效");
        if (compareVersion(snapshot.manifest.version, bundle.manifest.version) >= 0) {bundle = snapshot; bundle.source = "local-snapshot";}
      }
      bundles[channel] = bundle;
    }
    return bundles;
  }
  async recognizeInstalledCn(context) {
    const dll = await safeAncestors(context.root, "Northstar.dll"), dllStat = await lstat(dll);
    if (!dllStat?.isFile() || dllStat.size > MAX_FILE_BYTES) return false;
    const bytes = await fsp.readFile(dll);
    if (!bytes.includes(Buffer.from("nscn.wolf109909.top")) || !bytes.includes(Buffer.from("NSCN Matchmaker is disabled"))) return false;
    const modInfos = [];
    for (const name of CORE_NAMES) {
      const filename = await safeAncestors(context.root, context.profile + "/mods/" + name + "/mod.json");
      const stat = await lstat(filename); if (!stat?.isFile() || stat.size > 1024 * 1024) return false;
      let info; try {info = JSON.parse(await fsp.readFile(filename, "utf8"));} catch (_) {return false;}
      if (info.Name !== name || !/^v?\d+\.\d+\.\d+$/.test(info.Version)) return false;
      modInfos.push(info);
    }
    if (!modInfos.every(info => info.Version === modInfos[0].Version) || !JSON.stringify(modInfos[1]).includes("nscnRuiPrecache")) return false;
    const logo = await safeAncestors(context.root, context.profile + "/mods/Northstar.Custom/mod/scripts/vscripts/nscn_logo_rui.nut");
    if (!(await lstat(logo))?.isFile()) return false;
    return {channel: "cn", version: modInfos[0].Version, recognized: true};
  }
  async recognizeInstalled(context) {
    const cn = await this.recognizeInstalledCn(context); if (cn) return cn;
    // An unmanaged global install is recognized only against the bundled
    // official DLL and the three exact mod manifests, never a package name.
    if (await lstat(path.join(context.root, "Northstar.dll"))) return null;
    const filename = path.join(this.bundleRoot, "global/manifest.json"), stat = await lstat(filename);
    if (!stat?.isFile() || stat.size > 8 * 1024 * 1024) return null;
    const manifest = validateManifest(await readJson(filename), "global");
    const required = ["R2Northstar/Northstar.dll", ...CORE_DIRS.map(directory => directory + "/mod.json")];
    for (const source of required) {
      const expected = manifest.files.find(file => key(file.path) === key(source));
      if (!expected || !equalInfo(await fileInfo(await safeAncestors(context.root, this.mapPath(context, source))), expected)) return null;
    }
    return {channel: "global", version: manifest.version, recognized: true};
  }
  async captureInstalledCn(context, bundle) {
    const cache = path.join(context.state, "channel-cache/cn");
    if (await lstat(path.join(cache, "manifest.json"))) return false;
    const recognized = await this.recognizeInstalledCn(context); if (!recognized) return false;
    const roots = new Set(CORE_DIRS.map(directory => this.mapPath(context, directory)));
    for (const file of bundle.manifest.files) if (!CORE_DIRS.some(directory => file.path.startsWith(directory + "/"))) roots.add(this.mapPath(context, file.path));
    const files = await this.scan(context, [...roots]);
    if (["NorthstarLauncher.exe", "Northstar.dll", "bin/x64_retail/wsock32.dll"].some(filename => !files.has(key(filename)))) return false;
    const staging = cache + ".preparing-" + crypto.randomUUID(); await fsp.mkdir(staging, {recursive: true});
    try {
      const manifest = {schemaVersion: 1, channel: "cn", profile: PROFILE, version: recognized.version, ownedDirectories: CORE_DIRS, provenance: {kind: "private-installed-snapshot", gameRoot: context.root, profile: context.profile, capturedAt: new Date().toISOString(), classification: "CN matchmaker DLL marker and CN logo core module"}, files: []};
      for (const file of files.values()) {
        const sourcePath = this.sourcePath(context, file.path);
        await safeCopy(path.join(context.root, ...file.path.split("/")), path.join(staging, "payload", ...sourcePath.split("/")), file);
        manifest.files.push({path: sourcePath, sha256: file.sha256, size: file.size});
      }
      // Preview r18 changed only the master-server line even while the CN
      // binaries stayed installed. Correct that one known cross-family value
      // in the private CN copy, retaining the exact original config separately.
      // User hostnames and compound configuration commands are never guessed.
      const configPath = "R2Northstar/mods/Northstar.Client/mod/cfg/autoexec_ns_client.cfg";
      const config = manifest.files.find(file => key(file.path) === key(configPath));
      if (config) {
        const filename = path.join(staging, "payload", ...config.path.split("/")), original = await fsp.readFile(filename), body = original.toString("utf8");
        const hostLines = body.match(/^[ \t]*ns_masterserver_hostname\b[^\r\n]*$/gmi) || [];
        const known = /^[ \t]*ns_masterserver_hostname[ \t]+(?:"https:\/\/(?:northstar\.tf|nscn\.wolf109909\.top)"|https:\/\/(?:northstar\.tf|nscn\.wolf109909\.top))[ \t]*(?:\/\/[^\r\n]*)?$/i;
        if (Buffer.from(body, "utf8").equals(original) && hostLines.length && hostLines.every(line => known.test(line)) && hostLines.some(line => /https:\/\/northstar\.tf(?=[" \t]|$)/i.test(line))) {
          const network = require("./northstar-region"), beforeHash = config.sha256;
          await network.apply(path.join(staging, "payload"), [], "cn", path.join(staging, "original-configs"));
          const info = await fileInfo(filename); config.sha256 = info.sha256; config.size = info.size;
          manifest.provenance.configNormalization = {path: config.path, beforeHash, afterHash: info.sha256, reason: "legacy-global-hostname-in-cn-client"};
        }
      }
      await writeJson(path.join(staging, "manifest.json"), manifest); await validateBundle(staging, "cn");
      await fsp.mkdir(path.dirname(cache), {recursive: true}); await fsp.rename(staging, cache);
      return true;
    } catch (error) {await fsp.rm(staging, {recursive: true, force: true}); throw error;}
  }
  validateTransaction(context, transaction) {
    if (transaction?.kind === "directory-rotation") this.rotation.validate(context, transaction);
    if (!transaction || transaction.schemaVersion !== 1 || !ID.test(transaction.id) || !samePath(transaction.gameRoot, context.root) || key(transaction.profile) !== key(context.profile) || !["prepared", "applying", "committed", "rolled-back", "recovery-required"].includes(transaction.state) || !CHANNELS.includes(transaction.channel) || !Array.isArray(transaction.rows) || transaction.rows.length > MAX_FILES) throw Error("北极星恢复事务记录无效，已停止写入");
    const seen = new Set();
    for (const [index, row] of transaction.rows.entries()) {
      if (!row || row.index !== index || !ownedPath(this.sourcePath(context, row.path)) || seen.has(key(row.path)) || row.temp !== this.temporaryPath(row.path, transaction.id)) throw Error("北极星恢复事务路径无效");
      seen.add(key(row.path));
      for (const info of [row.before, row.after]) if (info !== null && (!info || !HASH.test(info.sha256) || !Number.isSafeInteger(info.size) || info.size < 0 || info.size > MAX_FILE_BYTES)) throw Error("北极星恢复事务校验值无效");
    }
    if (!Array.isArray(transaction.controlled) || transaction.controlled.some(relative => !ownedPath(this.sourcePath(context, relative)) && !CORE_DIRS.includes(this.sourcePath(context, relative)))) throw Error("北极星恢复事务范围无效");
    if (!Array.isArray(transaction.unchanged) || transaction.unchanged.length > MAX_FILES || transaction.unchanged.some(file => !file || !ownedPath(this.sourcePath(context, file.path)) || seen.has(key(file.path)) || !HASH.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES)) throw Error("北极星恢复事务基线无效");
    return transaction;
  }
  temporaryPath(relative, id) {const parts = relative.split("/"); parts[parts.length - 1] = "." + parts.at(-1) + ".tfx-client-" + id + ".tmp"; return parts.join("/");}
  async transactions(context) {
    const result = [], directory = path.join(context.state, "transactions");
    try {
      for (const entry of await fsp.readdir(directory, {withFileTypes: true})) {
        if (!entry.isDirectory() || !ID.test(entry.name)) continue;
        const dir = path.join(directory, entry.name); await safeAncestors(directory, entry.name + "/transaction.json");
        const value = this.validateTransaction(context, await readJson(path.join(dir, "transaction.json")));
        if (value.id !== entry.name) throw Error("北极星恢复事务编号不匹配"); result.push({dir, value});
      }
    } catch (error) {if (error.code !== "ENOENT") throw error;}
    return result;
  }
  async locked(options, action) {
    if (this.busy) throw Error("另一个北极星客户端切换正在执行");
    this.busy = true; let release;
    try {const context = await this.context(options.gameRoot, options.profile); await this.assertStopped(context.root); release = await this.acquireLock(context.root); await this.assertStopped(context.root); return await action(context);}
    finally {try {if (release) await release();} finally {this.busy = false;}}
  }
  async pending(context) {return (await this.transactions(context)).filter(item => !["committed", "rolled-back"].includes(item.value.state));}
  async pendingAcrossRoot(context) {
    const result = [];
    try {
      for (const entry of await fsp.readdir(context.sharedState, {withFileTypes: true})) {
        if (!/^[a-f0-9]{24}$/.test(entry.name)) continue;
        if (!entry.isDirectory() || entry.isSymbolicLink()) throw Error("北极星配置事务目录不是普通目录");
        const transactionDirectory = path.join(context.sharedState, entry.name, "transactions");
        await safeAncestors(context.sharedState, entry.name + "/transactions");
        let records; try {records = await fsp.readdir(transactionDirectory, {withFileTypes: true});} catch (error) {if (error.code === "ENOENT") continue; throw error;}
        for (const record of records) {
          if (!ID.test(record.name)) continue;
          if (!record.isDirectory() || record.isSymbolicLink()) throw Error("北极星事务恢复目录不安全");
          const dir = path.join(transactionDirectory, record.name); await safeAncestors(transactionDirectory, record.name + "/transaction.json");
          const value = await readJson(path.join(dir, "transaction.json"));
          if (!value || typeof value.profile !== "string") throw Error("北极星事务恢复配置目录无效");
          const owner = await this.context(context.root, value.profile);
          if (!samePath(owner.state, path.dirname(transactionDirectory))) throw Error("北极星事务恢复目录身份不匹配");
          this.validateTransaction(owner, value);
          if (value.id !== record.name) throw Error("北极星事务恢复编号不匹配");
          if (!["committed", "rolled-back"].includes(value.state)) result.push({dir, value, context: owner});
        }
      }
    } catch (error) {if (error.code !== "ENOENT") throw error;}
    return result;
  }
  async restoreTransaction(context, entry) {
    if (entry.value?.kind === "directory-rotation") return this.rotation.restore(context, entry);
    const transaction = this.validateTransaction(context, entry.value), dir = entry.dir;
    const extras = transaction.rows.map(row => row.temp), current = await this.scan(context, transaction.controlled, extras), allowed = new Set(transaction.rows.map(row => key(row.path)));
    // Unknown scripts that appear during an interrupted switch are never erased.
    const baseline = new Map((transaction.unchanged || []).map(file => [key(file.path), file]));
    for (const [filename, info] of current) if (!allowed.has(filename) && !equalInfo(info, baseline.get(filename) || null)) throw Error("北极星恢复遇到未记录的外部文件，已停止写入：" + info.path);
    for (const [filename, info] of baseline) if (!equalInfo(current.get(filename) || null, info)) throw Error("北极星恢复遇到外部核心文件修改，已停止写入：" + info.path);
    for (const row of transaction.rows) {
      const now = current.get(key(row.path)) || null;
      if (!equalInfo(now, row.before) && !equalInfo(now, row.after)) throw Error("北极星恢复文件发生冲突，请保留事务备份：" + row.path);
      if (row.before && !equalInfo(await fileInfo(path.join(dir, "before", row.index + ".bin")), row.before)) throw Error("北极星恢复备份校验失败：" + row.path);
      if (row.after && !equalInfo(await fileInfo(path.join(dir, "after", row.index + ".bin")), row.after)) throw Error("北极星待安装备份校验失败：" + row.path);
      await safeAncestors(context.root, row.temp);
      const temporaryPath = path.join(context.root, ...row.temp.split("/")), temporary = await lstat(temporaryPath);
      if (temporary && (!temporary.isFile() || temporary.isSymbolicLink())) throw Error("北极星恢复临时文件发生冲突");
      if (temporary && !equalInfo(await fileInfo(temporaryPath), row.before) && !equalInfo(await fileInfo(temporaryPath), row.after)) throw Error("北极星恢复临时文件包含未知内容，已保留文件：" + row.temp);
    }
    for (const filename of ["receipt.before.json", "root-receipt.before.json"]) {
      await safeAncestors(dir, filename);
      const stat = await lstat(path.join(dir, filename));
      if (!stat?.isFile() || stat.size > 8 * 1024 * 1024) throw Error("北极星原状态备份缺失或无效，已停止恢复");
    }
    const prior = await readJson(path.join(dir, "receipt.before.json")); this.validateReceipt(context, prior);
    const sharedPrior = this.validateSharedReceipt(context, await readJson(path.join(dir, "root-receipt.before.json")));
    await this.assertStopped(context.root);
    for (const row of [...transaction.rows].reverse()) {
      if(row.index%24===0)await this.assertStopped(context.root);
      await fsp.rm(path.join(context.root, ...row.temp.split("/")), {force: true});
      await this.writeRow(context, row, row.before ? path.join(dir, "before", row.index + ".bin") : null, row.before, transaction.id);
    }
    const restored = await this.scan(context, transaction.controlled);
    const expected = new Map([...baseline, ...transaction.rows.filter(row => row.before).map(row => [key(row.path), {path: row.path, ...row.before}])]);
    for (const filename of new Set([...restored.keys(), ...expected.keys()])) if (!equalInfo(restored.get(filename) || null, expected.get(filename) || null)) throw Error("北极星恢复后的文件校验失败：" + filename);
    await this.assertStopped(context.root);
    const receiptFile = path.join(context.state, "installed.json");
    if (prior) await writeJson(receiptFile, prior); else await fsp.rm(receiptFile, {force: true});
    const sharedFile = path.join(context.sharedState, "root-installed.json");
    if (sharedPrior) await writeJson(sharedFile, sharedPrior); else await fsp.rm(sharedFile, {force: true});
    transaction.state = "rolled-back"; transaction.recoveredAt = new Date().toISOString();
    await writeJson(path.join(dir, "transaction.json"), transaction);
    return {recovered: true, transactionId: transaction.id};
  }
  async writeRow(context, row, source, info, id) {
    const filename = await safeAncestors(context.root, row.path), temporary = await safeAncestors(context.root, this.temporaryPath(row.path, id));
    if (!info) {await fsp.rm(filename, {force: true}); return;}
    await fsp.mkdir(path.dirname(filename), {recursive: true});
    await safeCopy(source, temporary, info);
    try {await fsp.rename(temporary, filename);} finally {await fsp.rm(temporary, {force: true});}
    if (!equalInfo(await fileInfo(filename), info)) throw Error("北极星客户端写入后的校验失败：" + row.path);
  }
  async ensure(options) {
    if (!CHANNELS.includes(options?.channel)) throw Error("请选择国服或全球服北极星客户端");
    this.emit("checking", 0, "正在校验所选北极星客户端", {channel: options.channel});
    try {
      return await this.locked(options, async context => {
        const pending = await this.pendingAcrossRoot(context);
        if (pending.length > 1) throw Error("存在多个未完成的北极星客户端事务，请保留备份并检查恢复记录");
        if (pending.length) {this.emit("recovering", 5, "正在恢复上次未完成的客户端切换"); await this.restoreTransaction(pending[0].context, pending[0]);}
        const receipt = this.validateReceipt(context, await readJson(path.join(context.state, "installed.json")));
        const sharedReceipt = this.validateSharedReceipt(context, await readJson(path.join(context.sharedState, "root-installed.json")));
        const rootMatches = !sharedReceipt || receipt && sharedReceipt.channel === receipt.channel && [...ROOT_FILES].every(filename => equalInfo(sharedReceipt.files.find(file => key(file.path) === filename) || null, receipt.files.find(file => key(file.path) === filename) || null));
        if (!options.bundleRoot && options.refresh !== true && options.refreshClient !== true && options.repair !== true && receipt?.channel === options.channel && rootMatches) {
          const current = await this.scan(context, this.controlledPaths(context, receipt, sharedReceipt));
          if (!current.size && options.allowInstall === false) {const error = Error(options.channel === "cn" ? "国服北极星客户端未安装，请先安装" : "全球服北极星客户端未安装，请先安装"); error.code = "CLIENT_NOT_INSTALLED"; error.channel = options.channel; throw error;}
          await this.verifyReceipt(context, receipt, current); await this.assertStopped(context.root);
          this.emit("done", 100, "北极星客户端文件已就绪", {channel: options.channel, version: receipt.version});
          return {channel: options.channel, version: receipt.version, changed: false, strategy: "active-receipt", transactionId: receipt.transactionId};
        }
        if (options.allowInstall === false) {
          const installed = await this.installedChannels(context, receipt);
          if (!installed[options.channel].installed) {const error = Error(options.channel === "cn" ? "国服北极星客户端未安装，请先安装" : "全球服北极星客户端未安装，请先安装"); error.code = "CLIENT_NOT_INSTALLED"; error.channel = options.channel; throw error;}
        }
        if (options.repair === true && !options.bundleRoot) await this.rotation.retireForRepair(context, options.channel);
        let incoming = !options.bundleRoot && options.refresh !== true && options.refreshClient !== true && options.repair !== true && receipt?.channel !== options.channel ? await this.rotation.readSlot(context, options.channel) : null;
        if (incoming) {
          const local = path.join(context.state, "channel-cache", options.channel), manifest = await readJson(await safeAncestors(context.state, "channel-cache/" + options.channel + "/manifest.json"));
          if (manifest && compareVersion(validateManifest(manifest, options.channel).version, incoming.manifest.version) > 0) {
            if (manifest.provenance?.kind !== "private-installed-snapshot" || !samePath(manifest.provenance.gameRoot, context.root) || key(manifest.provenance.profile) !== key(context.profile)) throw Error("北极星本地客户端快照来源无效");
            incoming = await validateBundle(local, options.channel); incoming.source = "local-snapshot";
          }
        }
        let bundles = incoming ? {[options.channel]: incoming} : await this.resolveBundles(context, options.bundleRoot, options.bundleRoot ? null : options.channel);
        if (!receipt && !options.bundleRoot && await this.recognizeInstalledCn(context)) {
          const descriptor = validateManifest(await readJson(path.join(this.bundleRoot, "cn/manifest.json")), "cn");
          if (await this.captureInstalledCn(context, {manifest: descriptor}) && options.channel === "cn") bundles = await this.resolveBundles(context, undefined, "cn");
        }
        incoming = bundles[options.channel];
        const controlled = new Set(CORE_DIRS.map(directory => this.mapPath(context, directory)));
        for (const location of this.controlledPaths(context, receipt, sharedReceipt)) controlled.add(location);
        for (const bundle of Object.values(bundles)) for (const file of bundle.manifest.files) if (!CORE_DIRS.some(directory => file.path.startsWith(directory + "/"))) controlled.add(this.mapPath(context, file.path));
        // Both DLL locations are controlled even when a release omits one.
        controlled.add("Northstar.dll"); controlled.add(this.mapPath(context, "R2Northstar/Northstar.dll"));
        if (receipt) for (const file of receipt.files) if (!CORE_DIRS.some(directory => this.sourcePath(context, file.path).startsWith(directory + "/"))) controlled.add(file.path);
        if (sharedReceipt) for (const file of sharedReceipt.files) controlled.add(file.path);
        const current = await this.scan(context, [...controlled]);
        // Only the explicit reinstall action may replace modified official
        // files. It uses the same bounded ownership, full backup and recovery
        // transaction; a normal launch always rejects external changes.
        const explicitInstall = options.allowInstall === true && (options.refresh === true || options.refreshClient === true);
        if (options.repair !== true && !explicitInstall) {
          const explicitEmptyInstall = options.allowInstall === true && (options.refresh === true || options.refreshClient === true) && !current.size;
          if (receipt) {if (!explicitEmptyInstall) await this.verifyReceipt(context, receipt, current);}
          else if (sharedReceipt && !explicitEmptyInstall) for (const filename of ROOT_FILES) if (!equalInfo(current.get(filename) || null, sharedReceipt.files.find(file => key(file.path) === filename) || null)) throw Error("北极星根目录客户端已被外部程序修改：" + filename);
        }
        const desired = new Map([...incoming.files.values()].map(file => {const target = this.mapPath(context, file.path); return [key(target), {...file, path: target}];}));
        const changed = [...new Set([...current.keys(), ...desired.keys()])].filter(filename => !equalInfo(current.get(filename) || null, desired.get(filename) || null));
        if (!changed.length) {
          await fsp.mkdir(context.state, {recursive: true});
          const next = this.makeReceipt(context, incoming, desired, receipt?.transactionId || null); await this.writeReceipts(context, next);
          this.emit("done", 100, "北极星客户端文件已就绪", {channel: options.channel, version: incoming.manifest.version});
          return {channel: options.channel, version: incoming.manifest.version, changed: false, transactionId: next.transactionId};
        }
        if (!options.bundleRoot && options.repair !== true) {
          let prior = receipt;
          if (!prior) {
            const recognized = await this.recognizeInstalled(context);
            if (recognized) prior = {schemaVersion: 1, gameRoot: context.root, profile: context.profile, channel: recognized.channel, version: recognized.version, bundleDigest: hash(Buffer.from("recognized-installed-client")), transactionId: null, installedAt: new Date().toISOString(), files: [...current.values()]};
          }
          const rotated = await this.rotation.switchClient(context, options, incoming, prior, sharedReceipt, current, controlled);
          if (rotated) return rotated;
        }
        await this.assertStopped(context.root);
        const id = crypto.randomUUID(), transactionRoot = path.join(context.state, "transactions"), staging = path.join(transactionRoot, ".preparing-" + id), dir = path.join(transactionRoot, id);
        await fsp.mkdir(staging, {recursive: true});
        const needed = changed.reduce((sum, filename) => sum + (current.get(filename)?.size || 0) + (desired.get(filename)?.size || 0), 0), space = await fsp.statfs(staging);
        if (Number(space.bavail) * Number(space.bsize) < needed + 32 * 1024 * 1024) throw Error("客户端备份磁盘空间不足，请至少预留所选客户端两倍的空间");
        const transaction = {schemaVersion: 1, id, state: "prepared", gameRoot: context.root, profile: context.profile, channel: options.channel, version: incoming.manifest.version, bundleDigest: incoming.digest, repair: options.repair === true, createdAt: new Date().toISOString(), controlled: [...controlled], unchanged: [...current.values()].filter(file => !changed.includes(key(file.path))), rows: []};
        try {
          for (const [index, filename] of changed.entries()) {
            const before = current.get(filename) || null, after = desired.get(filename) || null, target = after?.path || before.path;
            const row = {index, path: target, temp: this.temporaryPath(target, id), before: before ? {sha256: before.sha256, size: before.size} : null, after: after ? {sha256: after.sha256, size: after.size} : null};
            if (await lstat(await safeAncestors(context.root, row.temp))) throw Error("北极星临时文件名称已被占用，已停止切换");
            if (before) await safeCopy(path.join(context.root, ...before.path.split("/")), path.join(staging, "before", index + ".bin"), before);
            if (after) await safeCopy(after.source, path.join(staging, "after", index + ".bin"), after);
            transaction.rows.push(row);
          }
          await writeJson(path.join(staging, "receipt.before.json"), receipt);
          await writeJson(path.join(staging, "root-receipt.before.json"), sharedReceipt);
          await writeJson(path.join(staging, "transaction.json"), transaction);
          await fsp.rename(staging, dir);
        } catch (error) {await fsp.rm(staging, {recursive: true, force: true}); throw error;}
        try {
          await this.hook("prepared", transaction);
          const check = await this.scan(context, [...controlled]);
          for (const filename of new Set([...current.keys(), ...check.keys()])) if (!equalInfo(current.get(filename) || null, check.get(filename) || null)) throw Error("北极星核心文件在备份后发生变化，已停止切换");
          await this.assertStopped(context.root); transaction.state = "applying"; await writeJson(path.join(dir, "transaction.json"), transaction);
          this.emit("switching", 15, "正在切换北极星客户端文件", {channel: options.channel});
          for (const row of transaction.rows) {
            if (row.index % 24 === 0) await this.assertStopped(context.root);
            if (!equalInfo(await fileInfo(await safeAncestors(context.root, row.path)), row.before)) throw Error("北极星客户端文件在写入前被其他程序修改：" + row.path);
            if (await lstat(await safeAncestors(context.root, row.temp))) throw Error("北极星临时文件在写入前被其他程序占用：" + row.path);
            await this.writeRow(context, row, row.after ? path.join(dir, "after", row.index + ".bin") : null, row.after, id);
            await this.hook("row-written", {...transaction, row});
            this.emit("switching", 15 + Math.floor(65 * (row.index + 1) / transaction.rows.length), "正在切换北极星客户端文件", {channel: options.channel});
          }
          this.emit("verifying", 85, "正在校验完整客户端与核心模组");
          const final = await this.scan(context, [...controlled]);
          for (const filename of new Set([...desired.keys(), ...final.keys()])) if (!equalInfo(desired.get(filename) || null, final.get(filename) || null)) throw Error("北极星切换后的完整目录校验失败：" + filename);
          await this.assertStopped(context.root); await this.hook("verified", transaction);
          const next = this.makeReceipt(context, incoming, desired, id); await this.writeReceipts(context, next);
          await this.hook("receipt-written", transaction);
          transaction.state = "committed"; transaction.completedAt = new Date().toISOString(); await writeJson(path.join(dir, "transaction.json"), transaction);
          this.emit("done", 100, "北极星客户端文件已就绪", {channel: options.channel, version: incoming.manifest.version});
          return {channel: options.channel, version: incoming.manifest.version, changed: true, transactionId: id, backup: dir};
        } catch (error) {
          transaction.error = error.message;
          if (error.simulatedCrash) throw error; // Only injected test hooks use this; production exits leave the same durable journal.
          try {await this.restoreTransaction(context, {dir, value: transaction});}
          catch (recoveryError) {
            transaction.state = "recovery-required"; transaction.recoveryError = recoveryError.message;
            await writeJson(path.join(dir, "transaction.json"), transaction);
            throw Error("北极星客户端切换未完成，恢复遇到冲突。请退出游戏并保留备份后重试：" + dir + "。" + recoveryError.message);
          }
          throw error;
        }
      });
    } catch (error) {this.emit("failed", 0, error.message, {channel: options.channel}); throw error;}
  }
  makeReceipt(context, incoming, desired, transactionId) {
    return {schemaVersion: 1, gameRoot: context.root, profile: context.profile, channel: incoming.manifest.channel, version: incoming.manifest.version, bundleDigest: incoming.digest, transactionId, installedAt: new Date().toISOString(), files: [...desired.values()].map(file => ({path: file.path, sha256: file.sha256, size: file.size}))};
  }
  controlledPaths(context, receipt, sharedReceipt) {
    const roots = new Set(CORE_DIRS.map(directory => this.mapPath(context, directory)));
    for (const filename of ROOT_FILES) roots.add(filename === "northstarlauncher.exe" ? "NorthstarLauncher.exe" : filename === "northstar.dll" ? "Northstar.dll" : filename);
    for (const filename of PROFILE_FILES) roots.add(this.mapPath(context, PROFILE + "/" + filename));
    for (const file of [...receipt?.files || [], ...sharedReceipt?.files || []]) if (!CORE_DIRS.some(directory => this.sourcePath(context, file.path).startsWith(directory + "/"))) roots.add(file.path);
    return [...roots];
  }
  async installedChannels(context, receipt) {
    const result = Object.fromEntries(CHANNELS.map(channel => [channel, {channel, installed: false, active: false, version: null, source: "not-installed"}]));
    const active = receipt || await this.recognizeInstalled(context), shared = this.validateSharedReceipt(context, await readJson(path.join(context.sharedState, "root-installed.json")));
    const presence = async (root, files) => {
      let present = 0, missing = 0;
      for (const file of files) {const stat = await lstat(await safeAncestors(root, file.path)); if (stat?.isFile() && !stat.isSymbolicLink() && (file.size === undefined || stat.size === file.size)) present++; else missing++;}
      return {present, missing};
    };
    if (active) {
      const isActive = !shared || shared.channel === active.channel && (!receipt || [...ROOT_FILES].every(filename => equalInfo(shared.files.find(file => key(file.path) === filename) || null, receipt.files.find(file => key(file.path) === filename) || null)));
      const required = receipt ? receipt.files.filter(file => isActive || !ROOT_FILES.has(key(file.path))) : [{path: "NorthstarLauncher.exe"}, {path: "bin/x64_retail/wsock32.dll"}, {path: active.channel === "cn" ? "Northstar.dll" : this.mapPath(context, "R2Northstar/Northstar.dll")}, ...CORE_DIRS.map(core => ({path: this.mapPath(context, core + "/mod.json")}))];
      const exists = await presence(context.root, required);
      if (exists.present) result[active.channel] = {channel: active.channel, installed: true, active: isActive, version: active.version, source: isActive ? "active" : "managed-profile", damaged: !!exists.missing, ...(exists.missing ? {error: "北极星客户端文件缺失或损坏，请重新安装"} : {})};
    }
    for (const channel of CHANNELS) {
      if (result[channel].installed) continue;
      const slot = await this.rotation.readSlot(context, channel, false);
      if (slot) {
        const coresPresent = (await Promise.all(CORE_DIRS.map(core => lstat(path.join(slot.directory, "payload", ...core.split("/")))))).some(stat => stat?.isDirectory() && !stat.isSymbolicLink());
        if (coresPresent) {
          const exists = await presence(slot.directory, slot.manifest.files.map(file => ({...file, path: "payload/" + file.path})));
          if (exists.present) result[channel] = {channel, installed: true, active: false, version: slot.manifest.version, source: "rotation-stash", directory: slot.directory, damaged: !!exists.missing, ...(exists.missing ? {error: "北极星轮换客户端文件缺失或损坏，请重新安装"} : {})};
        }
      }
      const local = path.join(context.state, "channel-cache", channel); await safeAncestors(context.state, "channel-cache/" + channel + "/manifest.json");
      const manifest = await readJson(path.join(local, "manifest.json"));
      if (manifest) {
        validateManifest(manifest, channel);
        if (manifest.provenance?.kind !== "private-installed-snapshot" || !samePath(manifest.provenance.gameRoot, context.root) || key(manifest.provenance.profile) !== key(context.profile)) throw Error("北极星本地客户端快照来源无效");
        const exists = await presence(local, manifest.files.map(file => ({...file, path: "payload/" + file.path})));
        if (exists.present && (!result[channel].installed || compareVersion(manifest.version, result[channel].version) > 0)) result[channel] = {channel, installed: true, active: false, version: manifest.version, source: "local-snapshot", directory: local, damaged: !!exists.missing, ...(exists.missing ? {error: "北极星本地客户端快照缺失或损坏，请重新安装"} : {})};
      }
    }
    return result;
  }
  async inspect(options) {
    const context = await this.context(options.gameRoot, options.profile), installed = this.validateReceipt(context, await readJson(path.join(context.state, "installed.json"))), pending = await this.pendingAcrossRoot(context);
    const result = {installed: installed ? {channel: installed.channel, version: installed.version, installedAt: installed.installedAt, transactionId: installed.transactionId} : null, pending: pending.map(({value}) => ({id: value.id, channel: value.channel, state: value.state})), ready: !pending.length, backupRoot: context.state};
    if (!installed) {try {result.installed = await this.recognizeInstalled(context) || null;} catch (error) {result.recognitionError = error.message;}}
    try {result.available = await this.installedChannels(context, installed); result.channels = result.available;} catch (error) {result.availableError = error.message;}
    return result;
  }
  async available(options) {
    const context = await this.context(options.gameRoot, options.profile), receipt = this.validateReceipt(context, await readJson(path.join(context.state, "installed.json")));
    return this.installedChannels(context, receipt);
  }
  async install(options) {return this.ensure({...options, allowInstall: true, refresh: true});}
  async assertReady(options) {const result = await this.inspect({...options, includeAvailable: false}); if (!result.ready) throw Error("上次北极星客户端文件切换未完成，请退出游戏并重试启动以恢复备份"); return result;}
  async recover(options) {
    return this.locked(options, async context => {const pending = await this.pendingAcrossRoot(context); if (pending.length > 1) throw Error("多个北极星恢复事务无法自动排序，请保留备份"); if (!pending.length) return {recovered: false}; return this.restoreTransaction(pending[0].context, pending[0]);});
  }
}

module.exports = {NorthstarClientSwitcher, createClientSwitcher: options => new NorthstarClientSwitcher(options), validateBundle, validateManifest, ownedPath, CORE_DIRS, CHANNELS, compareVersion};
