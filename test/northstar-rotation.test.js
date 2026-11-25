"use strict";
const os = require("node:os");
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), fsp = fs.promises, path = require("path"), crypto = require("crypto");
const {createClientSwitcher, CORE_DIRS} = require("../src/modules/northstar-client");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const base = fs.mkdtempSync(path.join(os.tmpdir(), "tfx-northstar-rotation-"));
async function put(root, file, bytes) {const target = path.join(root, ...file.split("/")); await fsp.mkdir(path.dirname(target), {recursive: true}); await fsp.writeFile(target, bytes);}
async function bundle(root, channel, version) {
  const files = {"NorthstarLauncher.exe": channel + version, "bin/x64_retail/wsock32.dll": channel + version};
  files[channel === "cn" ? "Northstar.dll" : "R2Northstar/Northstar.dll"] = channel === "cn" ? "nscn.wolf109909.top NSCN Matchmaker is disabled " + version : "global " + version;
  if (channel === "cn") files["launcher.dll"] = "cn loader";
  for (const core of CORE_DIRS) {
    const name = core.split("/").at(-1);
    files[core + "/mod.json"] = JSON.stringify({Name: name, Version: version, Scripts: channel === "cn" && name === "Northstar.Custom" ? [{Callback: "nscnRuiPrecache"}] : []});
    files[core + "/mod/scripts/" + channel + ".nut"] = channel + " official script " + version;
  }
  if (channel === "cn") files["R2Northstar/mods/Northstar.Custom/mod/scripts/vscripts/nscn_logo_rui.nut"] = "logo";
  const manifest = {schemaVersion: 1, channel, profile: "R2Northstar", version, ownedDirectories: CORE_DIRS, files: []};
  for (const [file, value] of Object.entries(files)) {
    let bytes = Buffer.from(value);
    if (/\.(exe|dll)$/i.test(file)) {const header = Buffer.alloc(512); header.writeUInt16LE(0x5a4d, 0); header.writeUInt32LE(64, 60); header.writeUInt32LE(0x4550, 64); header.writeUInt16LE(0x8664, 68); header.writeUInt16LE(0x20b, 88); bytes = Buffer.concat([header, bytes]);}
    await put(root, "payload/" + file, bytes); manifest.files.push({path: file, sha256: hash(bytes), size: bytes.length});
  }
  await put(root, "manifest.json", JSON.stringify(manifest)); return root;
}
async function fixture(initial = "cn") {
  await fsp.mkdir(base, {recursive: true}); const out = await fsp.mkdtemp(path.join(base, "case-"));
  const bundles = path.join(out, "bundles"); await bundle(path.join(bundles, "cn"), "cn", "1.18.0"); await bundle(path.join(bundles, "global"), "global", "1.31.13");
  const root = path.join(out, "game"); await put(root, "Titanfall2.exe", "test fixture never spawned");
  if (initial) await fsp.cp(path.join(bundles, initial, "payload"), root, {recursive: true});
  for (const file of ["R2Northstar/mods/User.Personal/mod.json", "R2Northstar/cfg/user.cfg", "R2Northstar/plugins/User.dll", "r2/paks/Win64/skin.starpak", "vpk/skin.vpk"]) await put(root, file, "personal original bytes");
  const engine = options => createClientSwitcher({bundleRoot: bundles, processCheck: async () => false, acquireLock: async () => async () => {}, ...options});
  return {root, bundles, out, engine};
}
async function content(root) {
  const result = {}; async function visit(directory, prefix) {for (const entry of await fsp.readdir(directory, {withFileTypes: true})) {if (!prefix && entry.name === ".tfx") continue; const name = prefix ? prefix + "/" + entry.name : entry.name; if (entry.isDirectory()) await visit(path.join(directory, entry.name), name); else result[name] = hash(await fsp.readFile(path.join(directory, entry.name)));}}
  await visit(root, ""); return result;
}
async function readyFixture() {const f = await fixture(), sw = f.engine(); await sw.ensure({gameRoot: f.root, channel: "global"}); await sw.ensure({gameRoot: f.root, channel: "cn"}); return {...f, sw};}
test("distribution cache alone does not mean installed and cannot implicitly install", async () => {
  const f = await fixture(null); let providers = 0; const sw = f.engine({bundleProvider: async channel => {providers++; return path.join(f.bundles, channel);}}), before = await content(f.root);
  const info = await sw.inspect({gameRoot: f.root, includeAvailable: false}); assert.equal(info.available.cn.installed, false); assert.equal(info.available.global.installed, false);
  await assert.rejects(sw.ensure({gameRoot: f.root, channel: "cn", allowInstall: false}), error => error.code === "CLIENT_NOT_INSTALLED"); assert.equal(providers, 0); assert.deepEqual(await content(f.root), before);
  const installed = await sw.install({gameRoot: f.root, channel: "cn"}); assert.equal(installed.channel, "cn"); assert((await sw.inspect({gameRoot: f.root})).available.cn.installed);
});
test("recognized CN is installed; global remains uninstalled until explicit install", async () => {
  const f = await fixture(), sw = f.engine(); const info = await sw.inspect({gameRoot: f.root, includeAvailable: false}); assert(info.available.cn.installed); assert(!info.available.global.installed);
  await assert.rejects(sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false}), error => error.code === "CLIENT_NOT_INSTALLED");
  await sw.install({gameRoot: f.root, channel: "global"}); const next = await sw.inspect({gameRoot: f.root}); assert(next.available.global.active); assert(next.available.cn.installed); assert(!next.available.cn.active);
});
test("same family launch does zero copies and never invokes distribution provider", async () => {
  const f = await readyFixture(), original = fsp.copyFile; let count = 0, providers = 0; fsp.copyFile = async (...args) => {count++; return original(...args);};
  try {const sw = f.engine({bundleProvider: async () => {providers++; throw Error("must not read bundle");}}); const result = await sw.ensure({gameRoot: f.root, channel: "cn", allowInstall: false}); assert.equal(result.strategy, "active-receipt"); assert.equal(count, 0); assert.equal(providers, 0);} finally {fsp.copyFile = original;}
});

test("GitHub 1.17.7 default keeps recognized CN 1.18 across launch and global round trip", async () => {
  const f=await fixture(),original=await content(f.root);
  const defaultCn=await bundle(path.join(f.out,"github-cn"),"cn","1.17.7");
  const sw=f.engine({bundleProvider:async channel=>({directory:channel==="cn"?defaultCn:path.join(f.bundles,channel),preferSnapshot:true})});
  const first=await sw.ensure({gameRoot:f.root,channel:"cn",allowInstall:false});
  assert.equal(first.version,"1.18.0");assert.deepEqual(await content(f.root),original);
  await sw.install({gameRoot:f.root,channel:"global"});
  const back=await sw.ensure({gameRoot:f.root,channel:"cn",allowInstall:false});
  assert.equal(back.version,"1.18.0");assert.deepEqual(await content(f.root),original);
  const fresh=await fixture(null),install=fresh.engine({bundleProvider:async channel=>({directory:channel==="cn"?defaultCn:path.join(fresh.bundles,channel),preferSnapshot:true})});
  assert.equal((await install.install({gameRoot:fresh.root,channel:"cn"})).version,"1.17.7");
});
test("hot directory rotation copies only small loader files and preserves personal data", async () => {
  const f = await readyFixture(), original = fsp.copyFile, before = await content(f.root); let coreCopies = 0;
  fsp.copyFile = async (source, target, ...args) => {if (/Northstar\.(Client|Custom|CustomServers)/i.test(source) || /Northstar\.(Client|Custom|CustomServers)/i.test(target)) coreCopies++; return original(source, target, ...args);};
  try {const result = await f.sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false}); assert.equal(result.strategy, "directory-rotation"); assert.equal(coreCopies, 0); await f.sw.ensure({gameRoot: f.root, channel: "cn", allowInstall: false}); assert.deepEqual(await content(f.root), before);} finally {fsp.copyFile = original;}
});
for (const phase of ["move-intent", "directory-renamed"]) for (let moveIndex = 0; moveIndex < 6; moveIndex++) test("crash recovery " + phase + " step " + moveIndex, async () => {
  const f = await readyFixture(), before = await content(f.root), crash = f.engine({hook: async (event, tx) => {if (event === phase && tx.moveIndex === moveIndex) {const error = Error("injected crash"); error.simulatedCrash = true; throw error;}}});
  await assert.rejects(crash.ensure({gameRoot: f.root, channel: "global"}), /injected crash/); await f.engine().recover({gameRoot: f.root, profile: "Profiles/Other"}); assert.deepEqual(await content(f.root), before); assert((await f.sw.inspect({gameRoot: f.root})).ready);
});
for (const phase of ["row-written", "receipt-written"]) test("failure rolls back directories, loader and receipts at " + phase, async () => {
  const f = await readyFixture(), before = await content(f.root), prior = (await f.sw.inspect({gameRoot: f.root})).installed;
  await assert.rejects(f.engine({hook: async event => {if (event === phase) throw Error("injected disk error");}}).ensure({gameRoot: f.root, channel: "global"}), /injected disk error/); assert.deepEqual(await content(f.root), before); assert.deepEqual((await f.sw.inspect({gameRoot: f.root})).installed, prior);
});
test("external core edit after crash causes zero recovery writes", async () => {
  const f = await readyFixture(), crash = f.engine({hook: async event => {if (event === "row-written") {const error = Error("crash"); error.simulatedCrash = true; throw error;}}}); await assert.rejects(crash.ensure({gameRoot: f.root, channel: "global"}), /crash/);
  await put(f.root, "R2Northstar/mods/Northstar.Client/mod/external.nut", "external keep"); const before = await content(f.root); await assert.rejects(f.engine().recover({gameRoot: f.root}), /外部/); assert.deepEqual(await content(f.root), before);
});
test("external loader edit after crash causes zero directory recovery writes", async () => {
  const f = await readyFixture(), crash = f.engine({hook: async event => {if (event === "row-written") {const error = Error("crash"); error.simulatedCrash = true; throw error;}}}); await assert.rejects(crash.ensure({gameRoot: f.root, channel: "global"}), /crash/);
  await put(f.root, "NorthstarLauncher.exe", "external keep"); const before = await content(f.root); await assert.rejects(f.engine().recover({gameRoot: f.root}), /冲突|外部/); assert.deepEqual(await content(f.root), before);
});
test("a second interruption during recovery resumes without losing either core", async () => {
  const f = await readyFixture(), before = await content(f.root), crash = f.engine({hook: async event => {if (event === "row-written") {const error = Error("crash"); error.simulatedCrash = true; throw error;}}}); await assert.rejects(crash.ensure({gameRoot: f.root, channel: "global"}), /crash/);
  const original = fsp.rename; let once = false; fsp.rename = async (source, target) => {const value = await original(source, target); if (!once && /client-slots/.test(source) && /mods[\\/]Northstar/.test(target)) {once = true; throw Error("recovery interrupted after rename");} return value;};
  try {await assert.rejects(f.engine().recover({gameRoot: f.root}), /recovery interrupted/);} finally {fsp.rename = original;}
  await f.engine().recover({gameRoot: f.root}); assert.deepEqual(await content(f.root), before);
});
test("new same-family version supersedes active slot and remains available after round trip", async () => {
  const f = await readyFixture(); await f.sw.ensure({gameRoot: f.root, channel: "global"}); const updated = await bundle(path.join(f.out, "new-global"), "global", "1.32.0");
  const updater = f.engine({bundleProvider: async channel => channel === "global" ? {directory: updated, preferSnapshot: false} : path.join(f.bundles, channel)}); const installed = await updater.ensure({gameRoot: f.root, channel: "global", refreshClient: true}); assert.equal(installed.version, "1.32.0");
  await f.sw.ensure({gameRoot: f.root, channel: "cn"}); const back = await f.sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false}); assert.equal(back.version, "1.32.0");
});
test("active client deletion produces missing or damaged status", async () => {
  const f = await fixture(null), sw = f.engine(); await sw.install({gameRoot: f.root, channel: "global"}); await fsp.rm(path.join(f.root, "NorthstarLauncher.exe")); let info = await sw.inspect({gameRoot: f.root, includeAvailable: false}); assert(info.available.global.damaged);
  for (const file of JSON.parse(await fsp.readFile(path.join(f.bundles, "global/manifest.json"))).files) await fsp.rm(path.join(f.root, ...file.path.split("/")), {force: true}); info = await sw.inspect({gameRoot: f.root, includeAvailable: false}); assert.equal(info.available.global.installed, false);
  const before = await content(f.root); await assert.rejects(sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false}), error => error.code === "CLIENT_NOT_INSTALLED"); assert.deepEqual(await content(f.root), before);
  await sw.install({gameRoot: f.root, channel: "global"}); assert((await sw.inspect({gameRoot: f.root})).available.global.active);
});
test("shared root newer same-family loader requires restoring the selected profile version", async () => {
  const f = await fixture(null), sw = f.engine(); await sw.install({gameRoot: f.root, channel: "cn"}); const initial = await content(f.root), updated = await bundle(path.join(f.out, "new-cn"), "cn", "1.19.0");
  await f.engine({bundleProvider: async channel => channel === "cn" ? {directory: updated, preferSnapshot: false} : path.join(f.bundles, channel)}).ensure({gameRoot: f.root, profile: "Profiles/Other", channel: "cn", refresh: true});
  assert.equal((await sw.inspect({gameRoot: f.root})).available.cn.active, false);
  const restored = await sw.ensure({gameRoot: f.root, channel: "cn", allowInstall: false}); assert.equal(restored.changed, true); assert.equal(restored.version, "1.18.0");
  for (const file of ["NorthstarLauncher.exe", "Northstar.dll", "launcher.dll", "bin/x64_retail/wsock32.dll"]) assert.equal((await content(f.root))[file], initial[file]);
});
test("legacy global hostname needs normalization only once, then CN uses hot rotation", async () => {
  const f = await fixture(), sw = f.engine(), cfg = "R2Northstar/mods/Northstar.Client/mod/cfg/autoexec_ns_client.cfg";
  await put(f.root, cfg, 'ns_masterserver_hostname "https://northstar.tf"\n');
  await sw.ensure({gameRoot: f.root, channel: "global"}); await sw.ensure({gameRoot: f.root, channel: "cn"});
  assert.match(await fsp.readFile(path.join(f.root, cfg), "utf8"), /nscn\.wolf109909\.top/);
  const hot = await sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false}); assert.equal(hot.strategy, "directory-rotation");
  await sw.ensure({gameRoot: f.root, channel: "cn"}); assert.match(await fsp.readFile(path.join(f.root, cfg), "utf8"), /nscn\.wolf109909\.top/);
});
test("externally edited inactive stash is preserved and blocks a normal switch", async () => {
  const f = await readyFixture(), info = await f.sw.inspect({gameRoot: f.root}), directory = info.available.global.directory;
  await put(directory, "payload/R2Northstar/mods/Northstar.Client/mod/external.nut", "keep inactive external edit"); const before = await content(f.root);
  await assert.rejects(f.sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false}), /外部/); assert.deepEqual(await content(f.root), before);
});
test("prepared hook mutation is caught before any core rename", async () => {
  const f = await readyFixture(), sw = f.engine({hook: async phase => {if (phase === "prepared") await put(f.root, "R2Northstar/mods/Northstar.Client/mod/scripts/cn.nut", "external new bytes");}});
  await assert.rejects(sw.ensure({gameRoot: f.root, channel: "global"}), /外部/); assert.equal(await fsp.readFile(path.join(f.root, "R2Northstar/mods/Northstar.Client/mod/scripts/cn.nut"), "utf8"), "external new bytes"); assert(fs.existsSync(path.join(f.root, "Northstar.dll")));
});
test("explicit repair archives a damaged inactive slot and keeps later rotations usable", async () => {
  const f = await readyFixture(), info = await f.sw.inspect({gameRoot: f.root}), directory = info.available.global.directory;
  await put(directory, "payload/R2Northstar/mods/Northstar.Client/mod/external.nut", "preserve damaged slot bytes");
  await f.sw.install({gameRoot: f.root, channel: "global", repair: true}); await f.sw.ensure({gameRoot: f.root, channel: "cn"}); await f.sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false});
  const entries = await fsp.readdir(path.dirname(directory)); const retired = entries.find(name => name.startsWith("global.retired-")); assert(retired);
  assert.equal(await fsp.readFile(path.join(path.dirname(directory), retired, "payload/R2Northstar/mods/Northstar.Client/mod/external.nut"), "utf8"), "preserve damaged slot bytes");
});
test("failed inactive-version preparation keeps the original standby installed", async () => {
  const f = await readyFixture(), updated = await bundle(path.join(f.out, "new-global"), "global", "1.32.0"), original = fsp.copyFile, before = await content(f.root);
  const sw = f.engine({bundleProvider: async channel => channel === "global" ? {directory: updated, preferSnapshot: false} : path.join(f.bundles, channel)});
  fsp.copyFile = async (source, target, ...args) => {if (/client-slots[\\/].*global\.preparing-/.test(target)) throw Error("injected slot preparation disk error"); return original(source, target, ...args);};
  try {await assert.rejects(sw.ensure({gameRoot: f.root, channel: "global", refreshClient: true}), /injected slot/);} finally {fsp.copyFile = original;}
  assert.deepEqual(await content(f.root), before); const info = await f.sw.inspect({gameRoot: f.root}); assert(info.available.global.installed); assert.equal(info.available.global.version, "1.31.13");
  assert.equal((await f.sw.ensure({gameRoot: f.root, channel: "global", allowInstall: false})).version, "1.31.13");
});

test.after(() => {
  assert.equal(path.dirname(base), path.resolve(os.tmpdir()));
  assert(path.basename(base).startsWith("tfx-northstar-rotation-"));
  const stat = fs.lstatSync(base); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(base, {recursive: true, force: true});
});
