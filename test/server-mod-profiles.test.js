"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), os = require("os"), path = require("path"), vm = require("vm"), {createRequire} = require("module");
const profiles = require("../src/modules/server-mod-profiles"), state = require("../src/modules/mod-enabled-state");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "tfx-server-mods-"));
function fixture() {
  const dir = fs.mkdtempSync(path.join(root, "case-")), gamepath = path.join(dir, "game"), profile = path.join(gamepath, "R2Northstar"), file = path.join(profile, "enabledmods.json");
  fs.mkdirSync(profile, {recursive: true}); fs.mkdirSync(path.join(gamepath, "r2")); fs.writeFileSync(path.join(gamepath, "Titanfall2.exe"), "fixture");
  const conf = {gamepath, globalGamepath:gamepath, nsargs: "", northstarRegion: "cn", independentServerMods: false};
  function put(name, version = "1", folder = name) {const target = path.join(profile, "mods", folder); fs.mkdirSync(target, {recursive: true}); fs.writeFileSync(path.join(target, "mod.json"), JSON.stringify({Name: name, Version: version}));}
  for (const name of state.CORE_NAMES) put(name); put("Example.On"); put("Example.Off");
  fs.writeFileSync(file, JSON.stringify({"Example.On": true, "Example.Off": false}));
  const snapshot = () => fs.readFileSync(file), document = () => state.parse(snapshot());
  const on = name => state.enabled(document(), name, "1");
  function select(patch, commit) {const next = {...conf, ...patch}; profiles.transition(conf, next, () => {commit?.(); Object.assign(conf, next);});}
  function set(name, enabled, version = "1") {const before = snapshot(), doc = document(); state.set(doc, name, version, enabled); state.write(file, before, state.serialize(doc)); if(conf.independentServerMods)profiles.transition(conf,conf);}
  return {dir, gamepath, profile, file, conf, put, snapshot, document, on, select, set, meta: () => profiles.read(profile).value};
}
test("official selection resolves VanillaPlus in R2Titanfall regardless of community launch arguments",()=>{
  const f=fixture();fs.writeFileSync(path.join(f.gamepath,"Titanfall2.exe"),"fixture");fs.mkdirSync(path.join(f.gamepath,"R2Titanfall"),{recursive:true});
  const selected=profiles.context({...f.conf,nsargs:"-profile=PersonalCommunity",modProfileServer:"official"});
  assert.equal(selected.profile,path.join(f.gamepath,"R2Titanfall"));assert.equal(selected.region,"official");
});
test("independence is opt-in and shared mode never creates metadata or edits live state", () => {
  const f = fixture(), before = f.snapshot(); f.select({northstarRegion: "global"});
  assert.deepEqual(f.snapshot(), before); assert.equal(profiles.read(f.profile).value, null);
  assert.equal(require("../src/preferences").normalize({}).independentServerMods, false);
  assert.equal(require("../src/preferences").normalize({independentServerMods: "true"}).independentServerMods, false);
});
test("first enable seeds both servers; CN/global round trips retain different choices and core Mods", () => {
  const f = fixture(); f.select({independentServerMods: true});
  assert.equal(f.meta().cn["Example.Off"], false); assert.equal(f.meta().global["Example.On"], true);
  f.set("Example.On", false); f.set("Example.Off", true); f.select({northstarRegion: "global"});
  assert.equal(f.document().format, "versioned"); assert.equal(f.on("Example.On"), true); assert.equal(f.on("Example.Off"), false);
  f.set("Example.Off", true); f.select({northstarRegion: "cn"});
  assert.equal(f.document().format, "flat"); assert.equal(f.on("Example.On"), false); assert.equal(f.on("Example.Off"), true);
  for (const name of state.CORE_NAMES) assert.equal(f.on(name), true);
  f.select({northstarRegion: "global"}); assert.equal(f.on("Example.On"), true); assert.equal(f.on("Example.Off"), true);
});
test("restart preparation uses independent metadata and ignores shared format history", async () => {
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false); f.select({northstarRegion: "global"});
  f.set("Example.Off", true); f.select({northstarRegion: "cn"});
  const legacy = path.join(f.profile, "enabledmods.old.json"); fs.writeFileSync(legacy, '{"Example.On":true}');
  const result = await profiles.prepare(f.profile, "cn"); assert.equal(result.independent, true); assert.equal(f.on("Example.On"), false);
  f.select({northstarRegion: "global"}); await profiles.prepare(f.profile, "global"); assert.equal(f.on("Example.Off"), true);
  assert.equal(fs.readFileSync(legacy, "utf8"), '{"Example.On":true}');
});
test("disable keeps current choices shared; re-enable preserves the other server snapshot", () => {
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false); f.select({northstarRegion: "global"});
  f.set("Example.Off", true); f.select({independentServerMods: false});
  assert.equal(f.on("Example.On"), true); assert.equal(f.on("Example.Off"), true);
  f.set("Example.On", false); f.select({independentServerMods: true});
  assert.equal(f.meta().global["Example.On"], false); assert.equal(f.meta().cn["Example.On"], false);
  f.set("Example.Off", false); f.select({northstarRegion: "cn"}); assert.equal(f.on("Example.Off"), false);
});
test("newly imported Mod defaults on only for the active server; version upgrades retain each side", () => {
  const f = fixture(); f.select({independentServerMods: true}); f.put("New.Import");
  assert.equal(f.on("New.Import"), true); f.select({northstarRegion: "global"}); assert.equal(f.on("New.Import"), false);
  f.select({northstarRegion: "cn"}); assert.equal(f.on("New.Import"), true);
  f.set("Example.On", false); f.select({northstarRegion: "global"});
  fs.rmSync(path.join(f.profile, "mods/Example.On"), {recursive: true}); f.put("Example.On", "2");
  f.select({northstarRegion: "cn"}); assert.equal(state.enabled(f.document(), "Example.On", "2"), false);
  f.select({northstarRegion: "global"}); assert.equal(state.enabled(f.document(), "Example.On", "2"), true);
});
test("settings commit failure rolls metadata and live state back byte-for-byte, then retry succeeds", () => {
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false);
  const live = f.snapshot(), metadata = fs.readFileSync(profiles.filename(f.profile));
  assert.throws(() => f.select({northstarRegion: "global"}, () => {throw Error("disk full");}), /disk full/);
  assert.equal(f.conf.northstarRegion, "cn"); assert.deepEqual(f.snapshot(), live); assert.deepEqual(fs.readFileSync(profiles.filename(f.profile)), metadata);
  f.select({northstarRegion: "global"}); assert.equal(f.on("Example.On"), true);
});
test("malformed metadata and conflicting duplicate versions fail before any projection", () => {
  const f = fixture(); f.select({independentServerMods: true}); const before = f.snapshot();
  fs.writeFileSync(profiles.filename(f.profile), "{broken"); assert.throws(() => f.select({northstarRegion: "global"}), /invalid/); assert.deepEqual(f.snapshot(), before);
  const g = fixture(); g.put("Example.On", "2", "Duplicate"); fs.writeFileSync(g.file, JSON.stringify({Version: 1, "Example.On": {"1": true, "2": false}}));
  const conflicting = g.snapshot(); assert.throws(() => g.select({independentServerMods: true}), error => error.code === "AMBIGUOUS_MOD_PROFILE"); assert.deepEqual(g.snapshot(), conflicting); assert.equal(fs.existsSync(profiles.filename(g.profile)), false);
});
test("DDS/VTF resource and installed Mod files remain byte-identical through switching", () => {
  const f = fixture(), files = [path.join(f.gamepath, "skins.dds"), path.join(f.gamepath, "skins.vtf"), path.join(f.gamepath, "client.vpk"), path.join(f.profile, "mods/Example.On/mod.json")];
  for (const file of files.slice(0, 3)) fs.writeFileSync(file, Buffer.from([0, 255, 16, 32, 3]));
  const before = files.map(file => fs.readFileSync(file)); f.select({independentServerMods: true}); f.set("Example.On", false); f.select({northstarRegion: "global"}); f.select({northstarRegion: "cn"});
  files.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), before[index]));
});
test("profile changes save outgoing choices without overwriting the incoming server snapshot", () => {
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false); f.select({northstarRegion: "global"}); f.set("Example.Off", true);
  const other = fixture(); other.select({independentServerMods: true}); other.set("Example.On", false); other.select({northstarRegion: "global"}); other.set("Example.Off", true);
  f.select({gamepath: other.gamepath, northstarRegion: "cn"}); assert.equal(other.on("Example.On"), false); assert.equal(other.on("Example.Off"), false);
  assert.equal(f.meta().global["Example.Off"], true);
});
test("pending marker from interrupted preference commit never relabels other-server live flags", async () => {
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false);
  profiles.transition(f.conf, {...f.conf, northstarRegion: "global"}); // Simulate process loss before settings acknowledgement.
  assert.equal(f.meta().activeRegion, "global"); assert.equal(f.on("Example.On"), true);
  await profiles.prepare(f.profile, "cn"); assert.equal(f.on("Example.On"), false); assert.equal(f.meta().global["Example.On"], true);
});
test("an upgraded version with mixed historical choices uses the saved server choice, never implicit enable", () => {
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false); f.select({northstarRegion: "global"}); f.set("Example.On", false);
  const current = f.document(); state.set(current, "Example.On", "old", true); fs.writeFileSync(f.file, state.serialize(current));
  fs.rmSync(path.join(f.profile, "mods/Example.On"), {recursive: true}); f.put("Example.On", "2");
  f.select({northstarRegion: "cn"}); f.select({northstarRegion: "global"}); assert.equal(state.enabled(f.document(), "Example.On", "2"), false);
  const g = fixture(); fs.rmSync(path.join(g.profile, "mods/Example.On"), {recursive: true}); g.put("Example.On", "2"); fs.writeFileSync(g.file, JSON.stringify({Version: 1, "Example.On": {"1": false, old: true}})); const before = g.snapshot();
  assert.throws(() => g.select({independentServerMods: true}), error => error.code === "AMBIGUOUS_MOD_PROFILE"); assert.deepEqual(g.snapshot(), before);
});
test("turning independence off after an interrupted switch keeps the selected server as the shared state", () => {
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false);
  profiles.transition(f.conf, {...f.conf, northstarRegion: "global"}); assert.equal(f.on("Example.On"), true);
  f.select({independentServerMods: false}); assert.equal(f.on("Example.On"), false); assert.equal(f.document().format, "flat");
  assert.equal(f.meta().global["Example.On"], true);
});
test("duplicate core Mods reject before writes and final verification failure rolls back", async () => {
  const f = fixture(); f.select({independentServerMods: true}); const before = f.snapshot(), metadata = fs.readFileSync(profiles.filename(f.profile)); f.put("Northstar.Client", "1", "CoreClone");
  await assert.rejects(profiles.prepare(f.profile, "global"), /Duplicate/); assert.deepEqual(f.snapshot(), before); assert.deepEqual(fs.readFileSync(profiles.filename(f.profile)), metadata);
});
test("a switchable Mod with a missing or unknown version rejects independence before writes", () => {
  for (const version of ["", "unknown"]) {
    const f = fixture(); f.put("Broken.Version", version); const before = f.snapshot();
    assert.throws(() => f.select({independentServerMods: true}), error => error.code === "MOD_PROFILE_STATE");
    assert.deepEqual(f.snapshot(), before); assert.equal(fs.existsSync(profiles.filename(f.profile)), false);
  }
});
test("Thunderstore commit initializes a newly created profile before installing new names", async () => {
  const f = fixture(); f.conf.independentServerMods = true; fs.writeFileSync(path.join(f.gamepath, "NorthstarLauncher.exe"), "fixture");
  const source = path.join(__dirname, "../src/modules/packages.js"), local = createRequire(source); let captured;
  const modules = {electron: {app: {getPath: () => f.dir, on() {}}, ipcMain: {on() {}}, net: {}}, "./settings": () => f.conf, "./is_running": {snapshot: async () => ({ok: true, processes: []})}, "./dds-operation-gate": {run: async (_name, action) => action()}, "../win": () => ({send() {}}), "../lang": key => key, "./thunderstore": {}, "./thunderstore-transport": {createRequest: () => () => {}}, "./thunderstore-install": {createInstaller: options => {captured = options; return {activeCount: 2, cancelAll() {}};}}};
  const context = {module: {exports: {}}, require: id => own(modules, id) ? modules[id] : local(id)};
  vm.runInNewContext(fs.readFileSync(source, "utf8"), context, {filename: source});
  assert.equal(context.module.exports.activeCount, 2);
  await captured.commit(async () => {assert.equal(f.meta().global["Example.On"], true); f.put("Downloaded.Mod");});
  f.select({northstarRegion: "global"}); assert.equal(f.on("Downloaded.Mod"), false);
  const selected = captured.profile(); f.conf.northstarRegion = "cn";
  await assert.rejects(captured.guard(selected), error => error.code === "PROFILE_CHANGED");
});

function settingsFixture() {
  const f = fixture(), data = path.join(f.dir, "data"); fs.mkdirSync(data); const file = path.join(data, "fold.json"); fs.writeFileSync(file, JSON.stringify(f.conf));
  const handles = new Map(), events = [], ipcMain = {handle: (name, action) => handles.set(name, action), on() {}, emit: (...args) => events.push(args)};
  const source = path.join(__dirname, "../src/modules/settings.js"), local = createRequire(source), lang = Object.assign(key => key, {defaultLocale: "en-US", normalize: value => require("../src/locale").normalize(value), setLocale() {}});
  let busy = false, processState = {ok: true, processes: []}, fail = false;
  const gate = {get busy() {return busy;}, async run(_name, action) {if (busy) throw Error("busy"); busy = true; try {return await action();} finally {busy = false;}}};
  const wrapped = {...fs, existsSync: value => fs.existsSync(path.isAbsolute(value) ? value : path.join(data, value)), renameSync: (...args) => {if (fail) throw Error("disk full"); return fs.renameSync(...args);}};
  const modules = {fs: wrapped, electron: {app: {getPath: () => data}, ipcMain}, "./json": () => JSON.parse(fs.readFileSync(file)), "../lang": lang, "../win": () => ({send: (...args) => events.push(args)}), "./dds-operation-gate": gate, "./mods": {isImportBusy: () => false, sharedImportBusy: false}, "./packages": {activeCount: 0}, "./is_running": {snapshot: async () => processState}};
  const context = {module: {exports: {}}, require: id => own(modules, id) ? modules[id] : local(id)};
  vm.runInNewContext(fs.readFileSync(source, "utf8"), context, {filename: source});
  return {...f, settings: context.module.exports, file, handles, events, busy: value => {busy = value;}, processes: value => {processState = value;}, fail: value => {fail = value;}};
}
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
test("acknowledged settings IPC blocks running/busy switches and atomically rolls back disk failure", async () => {
  const f = settingsFixture(), save = patch => f.handles.get("settings-save")({}, patch);
  assert.equal((await save({independentServerMods: true})).ok, true);
  const originalLive = f.snapshot(), originalMetadata = fs.readFileSync(profiles.filename(f.profile)), originalSettings = fs.readFileSync(f.file);
  f.busy(true); assert.equal((await save({northstarRegion: "global"})).code, "busy"); f.busy(false);
  f.processes({ok: true, processes: [{image: "titanfall2.exe", pid: 123}]}); assert.equal((await save({northstarRegion: "global"})).code, "GAME_RUNNING"); f.processes({ok: false, processes: []}); assert.equal((await save({northstarRegion: "global"})).code, "PROCESS_QUERY");
  f.processes({ok: true, processes: []}); f.fail(true); assert.equal((await save({northstarRegion: "global"})).ok, false); assert.deepEqual(f.snapshot(), originalLive); assert.deepEqual(fs.readFileSync(profiles.filename(f.profile)), originalMetadata); assert.deepEqual(fs.readFileSync(f.file), originalSettings);
  f.fail(false); assert.equal((await save({northstarRegion: "global"})).ok, true); assert.equal(f.settings().northstarRegion, "global");
  assert.equal((await f.handles.get("settings-restore-defaults")({})).settings.independentServerMods, false); assert.equal(f.settings().northstarRegion, "cn"); assert.equal(f.events.some(event => event[0] === "gui-getmods"), true);
});
test("three server snapshots independently retain personal choices while the correct runtime core stays fixed", async () => {
  const f = fixture(); f.conf.profileDirectory=f.profile; f.put("VanillaPlus", "2.5.1", "NP.VanillaPlus");
  f.select({independentServerMods: true, modProfileServer: "cn"});
  assert.equal(f.meta().schemaVersion, 2); assert.equal(f.meta().official["Example.On"], true);
  assert.equal(state.enabled(f.document(), "VanillaPlus", "2.5.1"), false);
  f.set("Example.On", false); f.select({northstarRegion: "global", modProfileServer: "global"}); f.set("Example.Off", true);
  f.select({modProfileServer: "official"}); f.set("Example.Off", true); f.set("Example.On", false);
  await profiles.prepareOfficial(f.profile, {independent: true});
  assert.equal(f.document().format, "versioned"); assert.equal(f.on("Example.On"), false); assert.equal(f.on("Example.Off"), true);
  assert.equal(state.enabled(f.document(), "VanillaPlus", "2.5.1"), true);
  for (const name of state.CORE_NAMES) assert.equal(f.on(name), false);
  assert.equal(profiles.assertOfficialReady(f.profile).server, "official");
  f.select({northstarRegion: "cn", modProfileServer: "cn"});
  assert.equal(f.on("Example.On"), false); assert.equal(f.on("Example.Off"), false);
  assert.equal(state.enabled(f.document(), "VanillaPlus", "2.5.1"), false); for (const name of state.CORE_NAMES) assert.equal(f.on(name), true);
  f.select({northstarRegion: "global", modProfileServer: "global"});
  assert.equal(f.on("Example.On"), true); assert.equal(f.on("Example.Off"), true);
  f.select({modProfileServer: "official"}); assert.equal(f.on("Example.On"), false); assert.equal(f.on("Example.Off"), true);
});
test("legacy two server metadata upgrades without changing either existing personal snapshot", () => {
  // This exercises migration of a single existing profile's metadata.
  const f = fixture(); f.select({independentServerMods: true}); f.set("Example.On", false); f.select({northstarRegion: "global"}); f.set("Example.Off", true);
  const previous = f.meta(); delete previous.official; previous.schemaVersion = 1;
  fs.writeFileSync(profiles.filename(f.profile), JSON.stringify(previous));
  f.select({modProfileServer: "official",profileDirectory:f.profile});
  assert.equal(f.meta().schemaVersion, 2); assert.deepEqual(f.meta().cn, previous.cn); assert.deepEqual(f.meta().global, previous.global);
  assert.equal(f.meta().official["Example.Off"], true); assert.equal(f.meta().activeRegion, "official");
});
test("shared official/community launch keeps personal switches shared and never creates isolation metadata or edits skins", async () => {
  const f = fixture(); f.put("VanillaPlus", "2.5.1", "NP.VanillaPlus");
  const files = [path.join(f.gamepath, "skin.dds"), path.join(f.gamepath, "skin.vtf"), path.join(f.gamepath, "skin.vpk"), path.join(f.profile, "mods/NP.VanillaPlus/mod.json")];
  for (const file of files.slice(0, 3)) fs.writeFileSync(file, "fixture skin bytes"); const original = files.map(file => fs.readFileSync(file));
  const backupRoot = path.join(f.dir, "states");
  await profiles.prepareOfficial(f.profile, {backupRoot}); assert.equal(f.on("Example.On"), true); assert.equal(f.on("Example.Off"), false);
  assert.equal(state.enabled(f.document(), "VanillaPlus", "2.5.1"), true); for (const name of state.CORE_NAMES) assert.equal(f.on(name), false);
  f.set("Example.On", false);
  await profiles.prepareShared(f.profile, "cn", {backupRoot}); assert.equal(f.on("Example.On"), false); assert.equal(f.on("Example.Off"), false);
  assert.equal(state.enabled(f.document(), "VanillaPlus", "2.5.1"), false); for (const name of state.CORE_NAMES) assert.equal(f.on(name), true);
  await profiles.prepareShared(f.profile, "global", {backupRoot}); assert.equal(f.on("Example.On"), false); assert.equal(f.document().format, "versioned");
  await profiles.prepareOfficial(f.profile, {backupRoot}); assert.equal(f.on("Example.On"), false); assert.equal(profiles.read(f.profile).value, null);
  files.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), original[index]));
});
test("a newly imported Mod remains confined to its active official server and all three snapshots roll back on failed commit", () => {
  const f = fixture(); f.conf.profileDirectory=f.profile; f.select({independentServerMods: true, modProfileServer: "official"}); f.put("Official.New");
  f.select({modProfileServer: "cn"}); assert.equal(f.on("Official.New"), false);
  f.select({modProfileServer: "global"}); assert.equal(f.on("Official.New"), false);
  const live = f.snapshot(), metadata = fs.readFileSync(profiles.filename(f.profile));
  assert.throws(() => f.select({modProfileServer: "official"}, () => {throw Error("disk full");}), /disk full/);
  assert.deepEqual(f.snapshot(), live); assert.deepEqual(fs.readFileSync(profiles.filename(f.profile)), metadata); assert.equal(f.conf.modProfileServer, "global");
  f.select({modProfileServer: "official"}); assert.equal(f.on("Official.New"), true);
});
test("official preparation rejects missing/duplicate VanillaPlus or interrupted guards before compatibility writes", async () => {
  const f = fixture(), before = f.snapshot(); await assert.rejects(profiles.prepareOfficial(f.profile, {backupRoot: path.join(f.dir, "states")}), /missing/); assert.deepEqual(f.snapshot(), before);
  f.put("VanillaPlus", "2.5.1", "NP.VanillaPlus"); f.put("VanillaPlus", "2.5.1", "Duplicate.VanillaPlus");
  await assert.rejects(profiles.prepareOfficial(f.profile, {independent: true}), /Duplicate/); assert.deepEqual(f.snapshot(), before);
  const g = fixture(); g.put("VanillaPlus", "2.5.1", "NP.VanillaPlus"); const old = g.snapshot();
  await assert.rejects(profiles.prepareOfficial(g.profile, {independent: true, guard: async () => {throw Error("selection changed");}}), /selection changed/);
  assert.deepEqual(g.snapshot(), old); assert.equal(profiles.read(g.profile).value, null);
});
test("official selection preference commits through the same guarded settings transaction and defaults stay backward compatible", async () => {
  const f = settingsFixture(), save = patch => f.handles.get("settings-save")({}, patch);
  const official = path.join(f.gamepath, "R2Titanfall");
  fs.mkdirSync(official);
  assert.equal(f.settings().modProfileServer, "cn"); assert.equal(f.settings().vanillaModsEnabled, false);
  assert.equal((await save({independentServerMods: true})).ok, true);
  assert.equal((await save({modProfileServer: "official", vanillaModsEnabled: true})).ok, true);
  assert.equal(profiles.read(official).value.activeRegion, "official");
  assert.equal(f.meta().activeRegion, "cn");
  f.processes({ok: true, processes: [{image: "titanfall2.exe", pid: 123}]});
  assert.equal((await save({modProfileServer: "global"})).code, "GAME_RUNNING"); assert.equal((await save({vanillaModsEnabled: false})).code, "GAME_RUNNING");
  f.processes({ok: true, processes: []}); assert.equal((await save({northstarRegion: "global"})).ok, true); assert.equal(f.settings().modProfileServer, "global");
  const preferences = require("../src/preferences"); assert.equal(preferences.normalize({northstarRegion: "global"}).modProfileServer, "global"); assert.equal(preferences.normalize({modProfileServer: "invalid", vanillaModsEnabled: "true"}).vanillaModsEnabled, false);
});
test("changing the Global game directory projects its own independent profile and observes the running-game guard", async () => {
  const f = settingsFixture(), other = fixture(), save = patch => f.handles.get("settings-save")({}, patch);
  assert.equal((await save({northstarRegion: "global", independentServerMods: true})).ok, true);
  f.processes({ok:true, processes:[{image:"Titanfall2.exe", executablePath:path.join(f.gamepath,"Titanfall2.exe")}]});
  assert.equal((await save({globalGamepath:other.gamepath})).code,"GAME_RUNNING");
  assert.equal(f.settings().globalGamepath,f.gamepath);
  const old = f.snapshot();
  f.processes({ok:true, processes:[]});
  assert.equal((await save({globalGamepath:other.gamepath})).ok,true);
  assert.equal(f.settings().globalGamepath,other.gamepath);
  assert.equal(other.meta().activeRegion,"global");
  assert.equal(other.document().format,"versioned");
  assert.deepEqual(f.snapshot(),old);
});
test.after(() => {assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith("tfx-server-mods-")); fs.rmSync(root, {recursive: true, force: true});});
