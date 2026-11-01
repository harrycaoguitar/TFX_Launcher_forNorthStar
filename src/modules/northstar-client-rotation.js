"use strict";

// The two clients keep their official core directories on the game volume.
// Each rename is journalled before it is attempted. Recovery reverses only
// recorded bytes, and refuses any unknown files instead of deleting them.
module.exports = function rotationTools(engine, api) {
  const {fsp, path, crypto, key, hash, samePath, inside, lstat, safeAncestors, fileInfo, equalInfo, readJson, writeJson, safeCopy, validateManifest, validateBundle, CORE_DIRS, ROOT_FILES, CHANNELS, ID, HASH, MAX_FILES, MAX_FILE_BYTES} = api;
  const slotRoot = context => path.join(context.root, ".tfx", "client-slots", hash(Buffer.from(key(context.profile))).slice(0, 24));
  const slotPath = (context, channel) => path.join(slotRoot(context), channel);
  const corePath = value => CORE_DIRS.some(directory => key(value).startsWith(key(directory) + "/"));
  const relative = (context, absolute) => path.relative(context.root, absolute).split(path.sep).join("/");
  async function guard(context, absolute) {
    if (!inside(context.root, absolute) || samePath(context.root, absolute)) throw Error("北极星轮换路径超出游戏目录");
    return safeAncestors(context.root, relative(context, absolute));
  }
  async function scanDirectory(context, absolute, content = true) {
    await guard(context, absolute); const stat = await lstat(absolute); if (!stat) return null;
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error("北极星轮换目录不是普通文件夹");
    const result = [];
    async function visit(current, prefix) {
      await guard(context, current);
      for (const entry of await fsp.readdir(current, {withFileTypes: true})) {
        const child = path.join(current, entry.name), name = prefix ? prefix + "/" + entry.name : entry.name;
        if (entry.isSymbolicLink()) throw Error("北极星轮换目录包含链接，已停止切换");
        if (entry.isDirectory()) await visit(child, name);
        else if (entry.isFile()) {const stat = await lstat(child); result.push({path: name, ...(content ? await fileInfo(child) : {}), stamp: {size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, ino: stat.ino, dev: stat.dev}});}
        else throw Error("北极星轮换目录包含特殊文件");
        if (result.length > MAX_FILES) throw Error("北极星轮换目录文件过多");
      }
    }
    await visit(absolute, ""); return result;
  }
  function sameDirectory(actual, expected) {
    if (actual === null) return expected === null;
    if (expected === null || actual.length !== expected.length) return false;
    const files = new Map(expected.map(file => [key(file.path), file]));
    return actual.every(file => equalInfo(file, files.get(key(file.path)) || null));
  }
  function sameStamps(actual, expected) {
    if (!actual || actual.length !== expected.length) return false;
    const files = new Map(expected.map(file => [key(file.path), file]));
    return actual.every(file => {const prior = files.get(key(file.path)); return prior?.stamp && Object.keys(prior.stamp).every(name => file.stamp[name] === prior.stamp[name]);});
  }
  async function readSlot(context, channel, complete = true) {
    const directory = slotPath(context, channel); await guard(context, directory);
    await guard(context, path.join(directory, "manifest.json"));
    if (!await lstat(path.join(directory, "manifest.json"))) return null;
    const manifest = validateManifest(await readJson(path.join(directory, "manifest.json")), channel);
    if (manifest.provenance?.kind !== "private-client-slot" || !samePath(manifest.provenance.gameRoot, context.root) || key(manifest.provenance.profile) !== key(context.profile)) throw Error("北极星轮换客户端来源无效");
    const bundle = {directory, manifest, digest: hash(Buffer.from(JSON.stringify(manifest))), source: "rotation-stash", files: new Map(manifest.files.map(file => [key(file.path), {...file, source: path.join(directory, "payload", ...file.path.split("/"))}]))};
    if (complete) {
      const cores = await Promise.all(CORE_DIRS.map(core => lstat(path.join(directory, "payload", ...core.split("/")))));
      if (cores.every(stat => stat === null)) return null; // Consumed active slot; a verified snapshot can initialize it again.
      const stamps = new Map();
      for (const file of bundle.files.values()) {const stat = await lstat(await guard(context, file.source)); if (!stat?.isFile() || stat.isSymbolicLink()) throw Error("北极星轮换客户端文件缺失或损坏，请重新安装"); stamps.set(key(file.path), {size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, ino: stat.ino, dev: stat.dev});}
      await validateBundle(directory, channel);
      for (const core of CORE_DIRS) {
        const expected = manifest.files.filter(file => key(file.path).startsWith(key(core) + "/")).map(file => ({...file, path: file.path.slice(core.length + 1)}));
        const actual = await scanDirectory(context, path.join(directory, "payload", ...core.split("/")), false), names = new Set(expected.map(file => key(file.path)));
        if (!actual || actual.length !== expected.length || actual.some(file => !names.has(key(file.path)))) throw Error("北极星轮换客户端被外部修改，已停止切换");
        for (const file of actual) {
          const filename = key(core + "/" + file.path), prior = stamps.get(filename);
          if (!prior || Object.keys(prior).some(name => file.stamp[name] !== prior[name])) throw Error("北极星轮换客户端在校验时被外部修改");
        }
      }
      for (const file of bundle.files.values()) file.stamp = stamps.get(key(file.path));
    }
    return bundle;
  }
  async function initialize(context, bundle) {
    const prior = await readSlot(context, bundle.manifest.channel, false);
    if (prior && prior.manifest.version === bundle.manifest.version && prior.manifest.files.length === bundle.manifest.files.length && prior.manifest.files.every(file => equalInfo(file, bundle.files.get(key(file.path))))) {
      const complete = await readSlot(context, bundle.manifest.channel); if (complete) return complete;
    }
    const destination = slotPath(context, bundle.manifest.channel);
    let retire = null;
    if (await lstat(destination)) {
      if (!prior) throw Error("北极星轮换目录存在未知文件，已保留并停止切换");
      // Updating an inactive client keeps the complete old generation. Its
      // bytes are verified before retirement, and the canonical slot is only
      // published once the replacement has been completely prepared.
      await readSlot(context, bundle.manifest.channel);
      retire = destination + ".retired-" + crypto.randomUUID();
    }
    const staging = destination + ".preparing-" + crypto.randomUUID(); await guard(context, staging); await fsp.mkdir(staging, {recursive: true});
    try {
      const space = await fsp.statfs(staging), needed = bundle.manifest.files.reduce((sum, file) => sum + file.size, 0);
      if (Number(space.bavail) * Number(space.bsize) < needed + 32 * 1024 * 1024) throw Error("游戏磁盘空间不足，无法准备第二套北极星客户端");
      for (const file of bundle.files.values()) await safeCopy(file.source, path.join(staging, "payload", ...file.path.split("/")), file);
      const manifest = {...bundle.manifest, provenance: {kind: "private-client-slot", gameRoot: context.root, profile: context.profile, initializedAt: new Date().toISOString(), sourceDigest: bundle.digest, originalProvenance: bundle.manifest.provenance || null}};
      await writeJson(path.join(staging, "manifest.json"), manifest); await validateBundle(staging, manifest.channel);
      if (retire) await fsp.rename(destination, retire);
      try {await fsp.rename(staging, destination);} catch (error) {if (retire && !await lstat(destination)) await fsp.rename(retire, destination); throw error;}
      return readSlot(context, manifest.channel);
    } catch (error) {await fsp.rm(staging, {recursive: true, force: true}); throw error;}
  }
  async function retireForRepair(context, channel) {
    const directory = slotPath(context, channel); await guard(context, directory);
    if (!await lstat(directory)) return false;
    // Keep any damaged generation byte-for-byte. Inspection rejects junctions
    // before a directory rename, so a repair cannot follow external links.
    await scanDirectory(context, directory, false);
    await fsp.rename(directory, directory + ".retired-" + crypto.randomUUID()); return true;
  }
  async function saveActive(context, receipt, current) {
    const channel = receipt.channel, destination = slotPath(context, channel); await guard(context, destination);
    let prior = await readSlot(context, channel, false);
    for (const core of CORE_DIRS) if (await lstat(path.join(destination, "payload", ...core.split("/")))) throw Error("活动北极星客户端的轮换槽位已被占用，已停止切换");
    const files = [...current.values()].map(file => ({path: engine.sourcePath(context, file.path), sha256: file.sha256, size: file.size}));
    const manifest = validateManifest({schemaVersion: 1, channel, profile: "R2Northstar", version: receipt.version, ownedDirectories: CORE_DIRS, files, provenance: {kind: "private-client-slot", gameRoot: context.root, profile: context.profile, capturedAt: new Date().toISOString()}}, channel);
    if (prior && (prior.manifest.version !== manifest.version || prior.manifest.files.length !== files.length || prior.manifest.files.some(file => !equalInfo(file, files.find(row => key(row.path) === key(file.path)))))) {
      // An explicit update/repair may have changed the active family. Its old
      // consumed slot has no core directories; retain that generation in full
      // before creating the current slot. Never retire an occupied core slot.
      await fsp.rename(destination, destination + ".retired-" + crypto.randomUUID()); prior = null;
    }
    await fsp.mkdir(destination, {recursive: true});
    for (const file of files.filter(file => !corePath(file.path))) {
      const target = path.join(destination, "payload", ...file.path.split("/")); await guard(context, target);
      const existing = await fileInfo(target);
      if (existing && !equalInfo(existing, file)) throw Error("北极星轮换启动文件被外部修改，已停止切换");
      if (!existing) await safeCopy(path.join(context.root, ...engine.mapPath(context, file.path).split("/")), target, file);
    }
    if (!prior) await writeJson(path.join(destination, "manifest.json"), manifest);
    return {directory: destination, manifest};
  }
  function validate(context, transaction) {
    if (!transaction || transaction.kind !== "directory-rotation" || transaction.schemaVersion !== 1 || !ID.test(transaction.id) || !samePath(transaction.gameRoot, context.root) || key(transaction.profile) !== key(context.profile) || !CHANNELS.includes(transaction.channel) || !CHANNELS.includes(transaction.previousChannel) || transaction.previousChannel === transaction.channel || !Array.isArray(transaction.moves) || transaction.moves.length !== 6 || !Number.isInteger(transaction.moveIndex) || transaction.moveIndex < 0 || transaction.moveIndex > 6) throw Error("北极星目录轮换恢复记录无效");
    const permitted = new Map();
    for (const core of CORE_DIRS) {
      const active = engine.mapPath(context, core), outgoing = relative(context, path.join(slotPath(context, transaction.previousChannel), "payload", ...core.split("/"))), incoming = relative(context, path.join(slotPath(context, transaction.channel), "payload", ...core.split("/")));
      permitted.set(active + "\0" + outgoing, true); permitted.set(incoming + "\0" + active, true);
    }
    for (const move of transaction.moves) {
      if (!move || !permitted.delete(move.from + "\0" + move.to) || !Array.isArray(move.files) || move.files.length > MAX_FILES) throw Error("北极星目录轮换恢复路径无效");
      const seen = new Set();
      for (const file of move.files) if (!file || typeof file.path !== "string" || file.path.includes("\\") || file.path.startsWith("/") || file.path.split("/").some(part => !part || part === "." || part === "..") || seen.has(key(file.path)) || !HASH.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES) throw Error("北极星目录轮换恢复校验值无效"); else seen.add(key(file.path));
    }
    return transaction;
  }
  async function restore(context, entry) {
    const transaction = validate(context, entry.value), dir = entry.dir;
    // Resolve an interrupted rename from its exact source/destination bytes.
    let completed = transaction.moveIndex;
    if (transaction.recoveryIntent !== null && transaction.recoveryIntent !== undefined) {
      const index = transaction.recoveryIntent;
      if (index !== completed - 1) throw Error("北极星轮换恢复步骤记录不一致");
      const move = transaction.moves[index], from = await scanDirectory(context, path.join(context.root, ...move.from.split("/"))), to = await scanDirectory(context, path.join(context.root, ...move.to.split("/")));
      if (sameDirectory(from, move.files) && to === null) completed--;
      else if (from !== null || !sameDirectory(to, move.files)) throw Error("北极星轮换恢复遇到外部修改，已保留两个位置");
      transaction.moveIndex = completed; transaction.recoveryIntent = null; transaction.moveIntent = null;
      await writeJson(path.join(dir, "transaction.json"), transaction);
    }
    if (transaction.moveIntent !== null && transaction.moveIntent !== undefined) {
      if (transaction.moveIntent !== completed || completed >= transaction.moves.length) throw Error("北极星轮换步骤记录不一致");
      const move = transaction.moves[completed], from = await scanDirectory(context, path.join(context.root, ...move.from.split("/"))), to = await scanDirectory(context, path.join(context.root, ...move.to.split("/")));
      if (from === null && sameDirectory(to, move.files)) completed++;
      else if (!sameDirectory(from, move.files) || to !== null) throw Error("北极星目录轮换恢复遇到外部修改，已保留两个位置");
    }
    // Validate all current locations before reversing any mutation. A later
    // incoming directory occupies the earlier outgoing source until undone.
    const expected = new Map();
    for (const move of transaction.moves) {expected.set(move.from, move.files); if (!expected.has(move.to)) expected.set(move.to, null);}
    for (let index = 0; index < completed; index++) {const move = transaction.moves[index]; expected.set(move.from, null); expected.set(move.to, move.files);}
    for (const [location, files] of expected) if (!sameDirectory(await scanDirectory(context, path.join(context.root, ...location.split("/"))), files)) throw Error("北极星轮换恢复遇到外部核心文件，已停止写入：" + location);
    const small = await engine.scan(context, transaction.controlled, transaction.rows.map(row => row.temp)), allowed = new Set(transaction.rows.map(row => key(row.path)));
    const unchanged = new Map(transaction.unchanged.map(file => [key(file.path), file]));
    for (const [name, info] of small) if (!allowed.has(name) && !equalInfo(info, unchanged.get(name) || null)) throw Error("北极星轮换恢复遇到外部启动文件，已停止写入");
    for (const [name, info] of unchanged) if (!equalInfo(small.get(name) || null, info)) throw Error("北极星轮换恢复遇到外部启动文件修改，已停止写入");
    for (const row of transaction.rows) {
      const now = small.get(key(row.path)) || null;
      if (!equalInfo(now, row.before) && !equalInfo(now, row.after)) throw Error("北极星轮换恢复启动文件发生冲突，已停止写入");
      for (const [location, info] of [["before", row.before], ["after", row.after]]) if (info && !equalInfo(await fileInfo(await safeAncestors(dir, location + "/" + row.index + ".bin")), info)) throw Error("北极星轮换恢复备份校验失败，已停止写入");
      const temporary = await fileInfo(await safeAncestors(context.root, row.temp));
      if (temporary && !equalInfo(temporary, row.before) && !equalInfo(temporary, row.after)) throw Error("北极星轮换临时文件包含未知内容，已保留文件");
    }
    engine.validateReceipt(context, await readJson(await safeAncestors(dir, "receipt.before.json")));
    engine.validateSharedReceipt(context, await readJson(await safeAncestors(dir, "root-receipt.before.json")));
    await engine.assertStopped();
    transaction.moveIndex = completed; transaction.moveIntent = null;
    await writeJson(path.join(dir, "transaction.json"), transaction);
    for (let index = completed - 1; index >= 0; index--) {
      const move = transaction.moves[index];
      await engine.assertStopped();
      transaction.recoveryIntent = index; await writeJson(path.join(dir, "transaction.json"), transaction);
      await fsp.mkdir(path.dirname(path.join(context.root, ...move.from.split("/"))), {recursive: true});
      await fsp.rename(path.join(context.root, ...move.to.split("/")), path.join(context.root, ...move.from.split("/")));
      transaction.moveIndex = index; transaction.moveIntent = null; transaction.recoveryIntent = null;
      await writeJson(path.join(dir, "transaction.json"), transaction);
    }
    // After moving core directories back, use the established small-file
    // transaction recovery for binaries, receipts and their exact backups.
    const originalKind = transaction.kind; delete transaction.kind;
    try {await engine.restoreTransaction(context, {dir, value: transaction});}
    finally {transaction.kind = originalKind;}
    transaction.state = "rolled-back"; transaction.moveIndex = 0; transaction.moveIntent = null;
    await writeJson(path.join(dir, "transaction.json"), transaction);
    return {recovered: true, transactionId: transaction.id, strategy: "directory-rotation"};
  }
  async function switchClient(context, options, incoming, receipt, sharedReceipt, current, controlled) {
    if (!receipt || receipt.channel === incoming.manifest.channel || sharedReceipt && sharedReceipt.channel !== receipt.channel || options.repair === true) return null;
    const explicitInstall = options.allowInstall === true && (options.refresh === true || options.refreshClient === true);
    if (explicitInstall) {
      try {await engine.verifyReceipt(context, receipt, current);}
      catch (error) {if (error.code === "CLIENT_RECEIPT_MISMATCH") return null; throw error;}
    }
    const privateSnapshot = await readJson(path.join(context.state, "channel-cache", receipt.channel, "manifest.json"));
    const normalization = privateSnapshot?.provenance?.configNormalization;
    if (normalization && current.get(key(engine.mapPath(context, normalization.path)))?.sha256 !== normalization.afterHash) return null;
    const target = incoming.source === "rotation-stash" ? incoming : await initialize(context, incoming);
    const outgoing = await saveActive(context, receipt, current);
    const desired = new Map([...target.files.values()].map(file => {const mapped = engine.mapPath(context, file.path); return [key(mapped), {...file, path: mapped}];}));
    const changed = [...new Set([...current.keys(), ...desired.keys()])].filter(filename => !corePath(engine.sourcePath(context, filename)) && !equalInfo(current.get(filename) || null, desired.get(filename) || null));
    const id = crypto.randomUUID(), transactionRoot = path.join(context.state, "transactions"), staging = path.join(transactionRoot, ".preparing-" + id), dir = path.join(transactionRoot, id); await fsp.mkdir(staging, {recursive: true});
    const transaction = {schemaVersion: 1, kind: "directory-rotation", id, state: "prepared", gameRoot: context.root, profile: context.profile, channel: target.manifest.channel, previousChannel: receipt.channel, version: target.manifest.version, bundleDigest: target.digest, createdAt: new Date().toISOString(), controlled: [...controlled].filter(location => !CORE_DIRS.includes(engine.sourcePath(context, location))), unchanged: [...current.values()].filter(file => !corePath(engine.sourcePath(context, file.path)) && !changed.includes(key(file.path))), rows: [], moves: [], moveIndex: 0, moveIntent: null};
    for (const core of CORE_DIRS) {
      const active = engine.mapPath(context, core), away = relative(context, path.join(outgoing.directory, "payload", ...core.split("/"))), source = relative(context, path.join(target.directory, "payload", ...core.split("/")));
      const beforeFiles = [...current.values()].filter(file => key(engine.sourcePath(context, file.path)).startsWith(key(core) + "/")).map(file => ({...file, path: engine.sourcePath(context, file.path).slice(core.length + 1)}));
      const afterFiles = [...target.files.values()].filter(file => key(file.path).startsWith(key(core) + "/")).map(file => ({path: file.path.slice(core.length + 1), sha256: file.sha256, size: file.size, stamp: file.stamp}));
      transaction.moves.push({from: active, to: away, files: beforeFiles});
      transaction.moves.push({from: source, to: active, files: afterFiles});
    }
    try {
      for (const [index, filename] of changed.entries()) {
        const before = current.get(filename) || null, after = desired.get(filename) || null, pathname = after?.path || before.path;
        const row = {index, path: pathname, temp: engine.temporaryPath(pathname, id), before: before ? {sha256: before.sha256, size: before.size} : null, after: after ? {sha256: after.sha256, size: after.size} : null};
        if (await lstat(await safeAncestors(context.root, row.temp))) throw Error("北极星临时文件名称已被占用，已停止切换");
        if (before) await safeCopy(path.join(context.root, ...before.path.split("/")), path.join(staging, "before", index + ".bin"), before);
        if (after) await safeCopy(after.source, path.join(staging, "after", index + ".bin"), after);
        transaction.rows.push(row);
      }
      await writeJson(path.join(staging, "receipt.before.json"), receipt); await writeJson(path.join(staging, "root-receipt.before.json"), sharedReceipt); await writeJson(path.join(staging, "transaction.json"), transaction); await fsp.rename(staging, dir);
    } catch (error) {await fsp.rm(staging, {recursive: true, force: true}); throw error;}
    try {
      await engine.hook("prepared", transaction); await engine.assertStopped();
      // The current complete receipt was scanned once by ensure(). Each core
      // directory is checked against it immediately before the rename.
      transaction.state = "applying"; await writeJson(path.join(dir, "transaction.json"), transaction);
      for (const [index, move] of transaction.moves.entries()) {
        const source = path.join(context.root, ...move.from.split("/")), destination = path.join(context.root, ...move.to.split("/"));
        await guard(context, source);
        if (await lstat(await guard(context, destination))) throw Error("北极星轮换目录在切换前被外部修改");
        await engine.assertStopped(); await fsp.mkdir(path.dirname(destination), {recursive: true});
        transaction.moveIntent = index; await writeJson(path.join(dir, "transaction.json"), transaction); await engine.hook("move-intent", {...transaction, move});
        if (!sameStamps(await scanDirectory(context, source, false), move.files) || await lstat(await guard(context, destination))) throw Error("北极星轮换目录在写入前被外部修改");
        await fsp.rename(source, destination); await engine.hook("directory-renamed", {...transaction, move});
        transaction.moveIndex = index + 1; transaction.moveIntent = null; await writeJson(path.join(dir, "transaction.json"), transaction);
        engine.emit("switching", 15 + Math.floor(60 * (index + 1) / transaction.moves.length), "正在切换北极星客户端文件", {channel: options.channel});
      }
      for (const row of transaction.rows) {
        await engine.assertStopped();
        if (!equalInfo(await fileInfo(await safeAncestors(context.root, row.path)), row.before)) throw Error("北极星客户端文件在写入前被其他程序修改：" + row.path);
        await engine.writeRow(context, row, row.after ? path.join(dir, "after", row.index + ".bin") : null, row.after, id); await engine.hook("row-written", {...transaction, row});
      }
      const final = await engine.scan(context, [...controlled]);
      for (const filename of new Set([...desired.keys(), ...final.keys()])) if (!equalInfo(desired.get(filename) || null, final.get(filename) || null)) throw Error("北极星切换后的完整目录校验失败：" + filename);
      await engine.assertStopped(); await engine.hook("verified", transaction);
      const next = engine.makeReceipt(context, target, desired, id); await engine.writeReceipts(context, next); await engine.hook("receipt-written", transaction);
      transaction.state = "committed"; transaction.completedAt = new Date().toISOString(); await writeJson(path.join(dir, "transaction.json"), transaction);
      engine.emit("done", 100, "北极星客户端文件已就绪", {channel: options.channel, version: target.manifest.version});
      return {channel: options.channel, version: target.manifest.version, changed: true, strategy: "directory-rotation", transactionId: id, backup: dir, movedDirectories: 6, copiedCoreFiles: 0};
    } catch (error) {
      transaction.error = error.message; if (error.simulatedCrash) throw error;
      try {await restore(context, {dir, value: transaction});}
      catch (recoveryError) {transaction.state = "recovery-required"; transaction.recoveryError = recoveryError.message; await writeJson(path.join(dir, "transaction.json"), transaction); throw Error("北极星目录轮换未完成，恢复遇到冲突。请保留备份：" + dir + "。" + recoveryError.message);}
      throw error;
    }
  }
  return {slotRoot, slotPath, readSlot, initialize, retireForRepair, validate, restore, switchClient, scanDirectory, sameDirectory};
};
