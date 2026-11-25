"use strict";
const os = require("node:os");
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto"), {EventEmitter} = require("events");
const state = require("../src/modules/mod-enabled-state");
const {createRequire} = require("node:module");
const sourcePath = path.join(__dirname, "../src/modules/mods.js"), source = fs.readFileSync(sourcePath, "utf8");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tfx-mods-library-")); 
function fixture({custom = false, missingMods = false, importAction} = {}) {
  const base = fs.mkdtempSync(path.join(fixtureRoot, "case-")), gamePath = path.join(base, "game"), userData = path.join(base, "data"), profile = path.join(gamePath, custom ? "Custom Profile" : "R2Northstar");
  fs.mkdirSync(profile, {recursive: true}); fs.mkdirSync(userData); fs.writeFileSync(path.join(gamePath, "NorthstarLauncher.exe"), "fixture");
  fs.writeFileSync(path.join(gamePath, "Titanfall2.exe"), "fixture");
  if (!missingMods) fs.mkdirSync(path.join(profile, "mods"));
  const saved = {gamepath: gamePath, globalGamepath: gamePath, nsargs: custom ? '-profile "Custom Profile"' : ""};
  const window = new EventEmitter(), app = new EventEmitter(), events = [], handles = [], timers = new Map(), ipc = new Map(), imports = [];
  let timerId = 0, gateBusy = false, scans = 0, processSnapshot = {ok: true, processes: []};
  window.hidden = false; window.minimized = false; window.isVisible = () => !window.hidden; window.isMinimized = () => window.minimized; window.isDestroyed = () => false;
  window.log = message => events.push(["log", message]); window.send = (...args) => events.push(args); app.getPath = () => userData;
  const fakefs = {...fs,
    readdirSync(...args) {scans++; return fs.readdirSync(...args);},
    watch(directory, options, callback) {const handle = new EventEmitter(); Object.assign(handle, {directory, options, callback, closed: false, close() {this.closed = true;}}); handles.push(handle); return handle;}
  };
  const modules = {
    "fs-extra": fakefs, electron: {app, ipcMain: {on: (name, callback) => ipc.set(name, callback), handle: (name, callback) => ipc.set(name, callback)}, dialog: {}},
    "./settings": () => saved, "./northstar-region": require("../src/modules/northstar-region"), "./launch-session": require("../src/modules/launch-session"),
    "./mod-enabled-state": state, "./server-mod-profiles": require("../src/modules/server-mod-profiles"), "./mod-added-times": require("../src/modules/mod-added-times"), "./console": {error() {}, ok() {}}, "../win": () => window,
    "../lang": Object.assign(key => key, {getLocale: () => "en-US"}),
    "./local-mod-import": {messages: {game: "Select the game"}, async importLocalMod(filename, options) {imports.push({filename, options}); return importAction ? importAction(filename, options) : {ok: true, name: "Imported", names: ["Imported"]};}},
    "./is_running": {snapshot: async () => typeof processSnapshot === "function" ? processSnapshot() : processSnapshot},
    "./dds-operation-gate": {get busy() {return gateBusy;}, async run(_label, action) {if (gateBusy) throw Error("Operation already active"); gateBusy = true; try {return await action();} finally {gateBusy = false;}}}
  };
  const localRequire = createRequire(sourcePath);
  const context = {require: id => Object.hasOwn(modules, id) ? modules[id] : localRequire(id), module: {exports: {}}, Buffer, process: {argv: ["--neo-profile=fixture"], pid: process.pid},
    setTimeout(callback, milliseconds) {const token = {id: ++timerId, unref() {}}; timers.set(token.id, {callback, milliseconds}); return token;}, clearTimeout(token) {timers.delete(token?.id || token);}};
  vm.runInNewContext(source, context, {filename: sourcePath});
  const put = (name, version = "1", folder = name, owner = null, extra = {}) => {
    const targetProfile = saved.modProfileServer === "official" ? path.join(gamePath,"R2Titanfall") : profile;
    const directory = path.join(targetProfile, owner ? "packages" : "mods", ...(owner ? [owner, "mods"] : []), folder); fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, "mod.json"), JSON.stringify({Name: name, Version: version, ...extra}));
    if (owner) {const parts = owner.split("-"); fs.writeFileSync(path.join(targetProfile, "packages", owner, "manifest.json"), JSON.stringify({name: parts[1], version_number: parts[2]}));}
    return directory;
  };
  const flush = () => {const current = [...timers.values()]; timers.clear(); current.forEach(timer => timer.callback());};
  const emit = (relative, event = "change") => {
    for (const handle of handles.filter(item => !item.closed)) {
      const filename = path.relative(handle.directory, path.join(profile, ...relative.split("/")));
      if (filename.startsWith("..") || !handle.options.recursive && filename.includes(path.sep)) continue;
      handle.callback(event, filename);
    }
  };
  return {base, gamePath, userData, profile, saved, fakefs, app, window, events, handles, timers, ipc, imports, mods: context.module.exports, put, flush, emit,
    scans: () => scans, setSnapshot: value => {processSnapshot = value;}, setGateBusy: value => {gateBusy = value;}};
}
function hashTree(root) {
  const items = [];
  function visit(directory) {for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {const filename = path.join(directory, entry.name), relative = path.relative(root, filename); if (entry.isDirectory()) {items.push([relative, "directory"]); visit(filename);} else items.push([relative, crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex")]);}}
  visit(root); return JSON.stringify(items);
}

test("normal and read-only scans leave all game files unchanged and do not manufacture mods/state", () => {
  const f = fixture({missingMods: true}); f.put("Pack.Child", "1", "Child", "Alice-Example-2.0.0"); fs.rmSync(path.join(f.profile, "mods"), {recursive: true, force: true});
  const original = hashTree(f.gamePath);
  assert.equal(f.mods.list().all[0].name, "Pack.Child"); assert.equal(f.mods.list({readOnly: true}).all.length, 1);
  assert.equal(hashTree(f.gamePath), original); assert.equal(fs.existsSync(path.join(f.profile, "mods")), false); assert.equal(fs.existsSync(path.join(f.profile, "enabledmods.json")), false);
});
test("profile index groups only exact author/package/version children", () => {
  const f = fixture(); f.put("A.One", "1.1", "One", "Alice-SameName-2.0.0"); f.put("A.Two", "1.2", "Two", "Alice-SameName-2.0.0"); f.put("B.One", "3.1", "One", "Bob-SameName-4.0.0");
  const library = f.mods.list({readOnly: true}).all;
  assert.deepEqual(Array.from(library.find(item => item.name === "A.One").packaged_mods), ["A.One", "A.Two"]);
  assert.deepEqual(Array.from(library.find(item => item.name === "B.One").packaged_mods), ["B.One"]);
  assert.equal(library.find(item => item.name === "A.One").stateVersion, "1.1"); assert.equal(library.find(item => item.name === "A.One").version, "2.0.0");
});
test("custom profile manager never scans or creates the default profile", () => {
  const f = fixture({custom: true}); f.put("Custom.Mod"); const initial = hashTree(f.gamePath); assert.equal(f.mods.list().all[0].name, "Custom.Mod"); assert.equal(hashTree(f.gamePath), initial); assert.equal(fs.existsSync(path.join(f.gamePath, "R2Northstar")), false);
});
test("existing added times survive rescan and package version upgrades", () => {
  const f = fixture(); f.put("Child", "1", "Child", "Alice-Example-1.0.0");
  const metadata = path.join(f.userData, "mod-added-times.json"), key = path.resolve(f.gamePath).replace(/\\/g, "/").toLowerCase() + "\npackage:alice/example";
  // A second manager loads existing saved metadata rather than creating a new time.
  f.mods.list(); const saved = JSON.parse(fs.readFileSync(metadata)); const first = saved.records[key]; assert.ok(first > 0);
  fs.rmSync(path.join(f.profile, "packages/Alice-Example-1.0.0"), {recursive: true}); f.put("Child", "2", "Child", "Alice-Example-2.0.0");
  assert.equal(f.mods.list().all[0].addedAt, first);
});
test("malformed and oversized definitions are skipped without changing files", () => {
  const f = fixture(); const bad = f.put("Bad"), large = f.put("Large"); fs.writeFileSync(path.join(bad, "mod.json"), "[not json"); fs.writeFileSync(path.join(large, "mod.json"), "x".repeat(4 * 1024 * 1024 + 1)); f.put("Good");
  const original = hashTree(f.gamePath); assert.deepEqual(Array.from(f.mods.list().all, item => item.name), ["Good"]); assert.equal(hashTree(f.gamePath), original);
});
test("junction entries are not indexed and a linked removal tree never deletes external files", () => {
  const f = fixture(), outside = path.join(f.base, "outside"); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, "sentinel.txt"), "keep"); fs.writeFileSync(path.join(outside, "mod.json"), JSON.stringify({Name: "External", Version: "1"}));
  fs.symlinkSync(outside, path.join(f.profile, "mods/External"), "junction"); assert.equal(f.mods.list({readOnly: true}).all.length, 0);
  const personal = f.put("Personal"); fs.symlinkSync(outside, path.join(personal, "linked"), "junction"); const result = f.mods.remove("Personal"); assert.equal(result.ok, false); assert.equal(fs.readFileSync(path.join(outside, "sentinel.txt"), "utf8"), "keep"); assert.ok(fs.existsSync(personal));
});
test("one package child deletion removes every child and plugin but preserves other authors", () => {
  const f = fixture(); f.put("One", "1", "One", "Alice-Example-1.0.0"); f.put("Two", "1", "Two", "Alice-Example-1.0.0"); f.put("Other", "1", "Other", "Bob-Example-1.0.0");
  const plugin = path.join(f.profile, "packages/Alice-Example-1.0.0/plugins/test.dll"); fs.mkdirSync(path.dirname(plugin)); fs.writeFileSync(plugin, "fixture");
  assert.equal(f.mods.remove("One"), true); assert.equal(fs.existsSync(path.join(f.profile, "packages/Alice-Example-1.0.0")), false); assert.ok(fs.existsSync(path.join(f.profile, "packages/Bob-Example-1.0.0")));
  assert.deepEqual(f.events.filter(item => item[0] === "removed-mod").map(item => item[1].name).sort(), ["One", "Two"]);
});
test("ambiguous names are rejected and explicit package identities remove only the selected author", () => {
  const f = fixture(); f.put("Same.Child", "1", "Child", "Alice-Example-1.0.0"); f.put("Same.Child", "1", "Child", "Bob-Example-1.0.0"); const initial = hashTree(f.gamePath);
  const rejected = f.mods.remove("Same.Child"); assert.equal(rejected.ok, false); assert.equal(rejected.code, "AMBIGUOUS_MOD"); assert.equal(hashTree(f.gamePath), initial);
  assert.equal(f.mods.remove({name: "Same.Child", package: {author: "Alice", package_name: "Example", version: "1.0.0"}}), true); assert.ok(fs.existsSync(path.join(f.profile, "packages/Bob-Example-1.0.0")));
});
test("plugin-only packages remain visible and removable without a fabricated enabledmods switch", () => {
  const f = fixture(), owner = path.join(f.profile, "packages/Alice-PluginOnly-1.0.0"); fs.mkdirSync(path.join(owner, "plugins"), {recursive: true}); fs.writeFileSync(path.join(owner, "plugins/module.dll"), "fixture");
  fs.writeFileSync(path.join(owner, "manifest.json"), JSON.stringify({name: "PluginOnly", version_number: "1.0.0", description: "native plugin"}));
  const row = f.mods.list().all[0]; assert.equal(row.name, "PluginOnly"); assert.equal(row.pluginOnly, true); assert.equal(row.stateControl, false); assert.equal(row.package.has_plugins, true); assert.equal(row.package.has_mods, false);
  const before = hashTree(f.gamePath); const blocked = f.mods.setState({names: [row.name], enabled: false}); assert.equal(blocked.ok, false); assert.equal(blocked.code, "PLUGINS_NO_SWITCH"); assert.equal(hashTree(f.gamePath), before);
  assert.equal(f.mods.toggle("allmods").ok, true); assert.equal(hashTree(f.gamePath), before);
  assert.equal(f.mods.remove({name: row.name, package: {author: "Alice", package_name: "PluginOnly", version: "1.0.0"}}), true); assert.equal(fs.existsSync(owner), false);
});
test("package state selection refuses shared name/version rather than changing another author's package", () => {
  const f = fixture(); f.put("Shared.Child", "1", "Child", "Alice-Example-1.0.0"); f.put("Shared.Child", "1", "Child", "Bob-Example-1.0.0"); const original = hashTree(f.gamePath);
  const result = f.mods.setState({names: ["Shared.Child"], enabled: false, package: {author: "Alice", package_name: "Example", version: "1.0.0"}}); assert.equal(result.ok, false); assert.equal(result.code, "AMBIGUOUS_MOD"); assert.equal(hashTree(f.gamePath), original);
});
test("package state selection controls exact child versions without changing a different version", () => {
  const f = fixture(); f.put("Shared.Child", "1", "Child", "Alice-Example-1.0.0"); f.put("Shared.Child", "2", "Child", "Bob-Example-2.0.0");
  fs.writeFileSync(path.join(f.profile, "enabledmods.json"), JSON.stringify({Version: 1, "Shared.Child": {"1": true, "2": true}}));
  const result = f.mods.setState({names: ["Shared.Child"], enabled: false, package: {author: "Alice", package_name: "Example", version: "1.0.0"}}); assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.profile, "enabledmods.json")))["Shared.Child"], {"1": false, "2": true});
});
test("CN flat state rejects a package-only toggle when the same name has another installed version", () => {
  const f = fixture(); f.put("Shared.Child", "1", "Child", "Alice-Example-1.0.0"); f.put("Shared.Child", "2", "Child", "Bob-Example-2.0.0"); const original = hashTree(f.gamePath);
  const result = f.mods.setState({names: ["Shared.Child"], enabled: false, package: {author: "Alice", package_name: "Example", version: "1.0.0"}}); assert.equal(result.code, "AMBIGUOUS_MOD"); assert.equal(hashTree(f.gamePath), original);
});
test("bulk rename failure restores the entire selection and leaves state bytes intact", () => {
  const f = fixture(); f.put("One"); f.put("Two"); const original = hashTree(f.gamePath); let renames = 0;
  f.fakefs.renameSync = (from, to) => {if (++renames === 2) throw Error("Injected second rename failure"); return fs.renameSync(from, to);};
  const result = f.mods.remove("allmods"); assert.equal(result.ok, false); assert.equal(hashTree(f.gamePath), original);
});
test("core directory protection survives damaged or renamed mod metadata", () => {
  const f = fixture(); for (const core of state.CORE_NAMES) f.put(core, "1", core, null, {Name: "Metadata." + core}); f.put("Personal");
  assert.equal(f.mods.list({readOnly: true}).all.filter(item => item.required).length, 3);
  const blocked = f.mods.remove("Metadata.Northstar.Client"); assert.equal(blocked.ok, false); assert.equal(blocked.code, "CORE_REQUIRED");
  assert.equal(f.mods.setState({names: ["Metadata.Northstar.Client"], enabled: false}).code, "CORE_REQUIRED"); assert.equal(f.mods.remove("allmods"), true);
  for (const core of state.CORE_NAMES) assert.ok(fs.existsSync(path.join(f.profile, "mods", core, "mod.json")));
});
test("deleting one installed package version preserves its sibling version's first added time", () => {
  const f = fixture(); f.put("Old.Child", "1", "Child", "Alice-Example-1.0.0"); f.put("New.Child", "2", "Child", "Alice-Example-2.0.0");
  const first = f.mods.list().all.find(item => item.name === "New.Child").addedAt;
  assert.equal(f.mods.remove({name: "Old.Child", package: {author: "Alice", package_name: "Example", version: "1.0.0"}}), true);
  assert.equal(f.mods.list().all.find(item => item.name === "New.Child").addedAt, first);
});
test("noise bursts generate no refresh while relevant changes debounce into one update", () => {
  const f = fixture(); f.put("One"); fs.mkdirSync(path.join(f.profile, "packages")); f.mods.list(); const initial = f.scans();
  for (let index = 0; index < 100; index++) for (const file of ["logs/client.log", "pdata/player.bin", "cache/item.bin", "mods/One/logs/runtime.log", "packages/cache/item.tmp"]) f.emit(file);
  f.flush(); assert.equal(f.scans(), initial); assert.equal(f.events.filter(item => item[0] === "mods").length, 0);
  for (const file of ["enabledmods.json", "enabledmods.json", "mods/One/mod.json"]) f.emit(file); f.flush(); assert.equal(f.events.filter(item => item[0] === "mods").length, 1);
});
test("hidden changes defer scanning and restore/show/focus coalesce into one refresh", () => {
  const f = fixture(); f.put("One"); f.mods.list(); const initial = f.scans(); f.window.hidden = true; f.window.minimized = true; f.emit("mods/One/mod.json"); f.emit("enabledmods.json"); f.flush(); assert.equal(f.scans(), initial);
  f.window.hidden = false; f.window.minimized = false; for (const name of ["restore", "show", "focus"]) f.window.emit(name); f.flush(); assert.equal(f.events.filter(item => item[0] === "mods").length, 1);
});
test("deleted collection watcher reattaches after directory recreation and before-quit closes all handles", () => {
  const f = fixture(); f.put("One"); fs.mkdirSync(path.join(f.profile, "packages")); f.mods.list(); fs.rmdirSync(path.join(f.profile, "packages")); f.emit("packages", "rename"); f.flush(); assert.equal(f.handles.filter(item => !item.closed && item.directory.endsWith("packages")).length, 0);
  fs.mkdirSync(path.join(f.profile, "packages")); f.emit("packages", "rename"); f.flush(); assert.equal(f.handles.filter(item => !item.closed && item.directory.endsWith("packages")).length, 1);
  f.emit("enabledmods.json"); f.app.emit("before-quit"); assert.ok(f.handles.every(item => item.closed)); assert.equal(f.timers.size, 0);
});
test("state IPC refuses a running game, process query failure and an active operation without writing", async () => {
  const f = fixture(); f.put("One"); const before = hashTree(f.gamePath);
  for (const snapshot of [{ok: true, processes: [{image: "titanfall2.exe"}]}, {ok: false, processes: []}]) {f.setSnapshot(snapshot); const result = await f.ipc.get("set-mod-state")({}, {names: ["One"], enabled: false}); assert.equal(result.ok, false); assert.equal(hashTree(f.gamePath), before);}
  f.setSnapshot({ok: true, processes: []}); f.setGateBusy(true); assert.equal((await f.mods.setStateAsync({names: ["One"], enabled: false})).ok, false); assert.equal(hashTree(f.gamePath), before);
});
test("guarded removal refuses a running game and allows a verified closed game", async () => {
  const f = fixture(); f.put("One"); const before = hashTree(f.gamePath); f.setSnapshot({ok: true, processes: [{image: "northstarlauncher.exe"}]}); assert.equal((await f.mods.removeAsync("One")).ok, false); assert.equal(hashTree(f.gamePath), before);
  f.setSnapshot({ok: true, processes: []}); assert.equal(await f.mods.removeAsync("One"), true);
});
test("changing the profile while the process check is pending cancels the mutation", async () => {
  const f = fixture(); f.put("One"); const original = hashTree(f.gamePath);
  f.setSnapshot(async () => {f.saved.nsargs = '-profile "Other Profile"'; return {ok: true, processes: []};});
  const result = await f.mods.removeAsync("One"); assert.equal(result.ok, false); assert.match(result.error, /profile changed/); assert.equal(hashTree(f.gamePath), original);
});
test("local import passes the exact custom profile and isolated cache to the independent importer", async () => {
  const f = fixture({custom: true}); const result = await f.mods.install(path.join(f.base, "Example.zip")); assert.equal(result.ok, true); assert.equal(f.imports[0].options.profileDirectory, f.profile); assert.equal(f.imports[0].options.gamePath, f.gamePath); assert.ok(f.imports[0].options.cacheRoot.startsWith(f.userData)); assert.equal(typeof f.imports[0].options.guard, "function"); assert.equal(fs.existsSync(path.join(f.gamePath, "R2Northstar")), false);
});
test("a rejected second import cannot release the first import lock or start a third import", async () => {
  let finish; const pending = new Promise(resolve => {finish = resolve;});
  const f = fixture({importAction: () => pending}), first = f.mods.install(path.join(f.base, "One.zip")); await new Promise(resolve => setImmediate(resolve));
  const second = await f.mods.install(path.join(f.base, "Two.zip")), third = await f.mods.install(path.join(f.base, "Three.zip")); assert.equal(second.code, "busy"); assert.equal(third.code, "busy"); assert.equal(f.imports.length, 1); finish({ok: true, name: "One"}); assert.equal((await first).ok, true);
});
test("shared skin intake blocks legacy Mod installs without releasing UI lock and permits its own guarded install", async () => {
  const f=fixture(),source=path.join(f.base,"Example.zip");f.mods.sharedImportBusy=true;
  const rejected=await f.mods.install(source);assert.equal(rejected.code,"busy");assert.equal(f.imports.length,0);assert.deepEqual(f.events.filter(item=>item[0]==="set-buttons").map(item=>item[1]),[false]);
  const progress=()=>{};const installed=await f.mods.install(source,{sharedImport:true,onProgress:progress});assert.equal(installed.ok,true);assert.equal(installed.importOrigin,"unified");assert.equal(f.events.find(item=>item[0]==="installed-mod")[1].importOrigin,"unified");assert.equal(f.imports.length,1);assert.equal(f.imports[0].options.onProgress,progress);assert.equal(f.mods.isImportBusy(),false);assert.equal(f.mods.sharedImportBusy,true);
});
test("every direct Mod write API refuses a shared import or active game operation without changing files", async () => {
  for(const lock of ["shared","game"]){
    const f=fixture();f.put("Personal.One");const statePath=path.join(f.profile,"enabledmods.json");fs.writeFileSync(statePath,JSON.stringify({"Personal.One":true}));const original=hashTree(f.gamePath);
    if(lock==="shared")f.mods.sharedImportBusy=true;else f.setGateBusy(true);
    const results=[f.mods.setState({names:["Personal.One"],enabled:false}),f.mods.modfile.gen(),f.mods.modfile.toggle("Personal.One"),f.mods.toggle("Personal.One"),f.mods.remove("Personal.One"),await f.mods.setStateAsync({names:["Personal.One"],enabled:false}),await f.mods.removeAsync("Personal.One")];
    for(const result of results){assert.equal(result.ok,false);assert.equal(result.code,"busy");}assert.equal(hashTree(f.gamePath),original);
  }
});
test("one batch indexes once and writes once for both state schemas", () => {
  for (const versioned of [false, true]) {
    const f = fixture(); f.put("A.Child", "1", "Child", "Alice-Example-1.0.0"); f.put("B.Child", "2", "Child", "Bob-Other-2.0.0");
    const filename = path.join(f.profile, "enabledmods.json"); fs.writeFileSync(filename, JSON.stringify(versioned ? {Version: 1, "A.Child": {"1": true}, "B.Child": {"2": false}} : {"A.Child": true, "B.Child": false}));
    const beforeScans = f.scans(), write = state.write; let writes = 0;
    state.write = (...args) => {writes++; return write(...args);};
    try {
      const result = f.mods.setState({selections: [
        {names: ["A.Child"], enabled: false, package: {author: "Alice", package_name: "Example", version: "1.0.0"}},
        {names: ["B.Child"], enabled: true, package: {author: "Bob", package_name: "Other", version: "2.0.0"}}
      ]});
      assert.equal(result.ok, true); assert.equal(writes, 1); assert.equal(f.scans() - beforeScans, 4);
      assert.equal(result.mods.all.find(item => item.name === "A.Child").disabled, true); assert.equal(result.mods.all.find(item => item.name === "B.Child").disabled, false);
      const saved = JSON.parse(fs.readFileSync(filename)); assert.equal(versioned ? saved["A.Child"]["1"] : saved["A.Child"], false); assert.equal(versioned ? saved["B.Child"]["2"] : saved["B.Child"], true);
    } finally {state.write = write;}
  }
});
test("batch rejects a missing or protected selector without applying earlier choices", () => {
  const f = fixture(); f.put("Personal"); f.put("Northstar.Client"); const before = hashTree(f.gamePath);
  for (const rejected of [{names: ["Absent"], enabled: false}, {names: ["Northstar.Client"], enabled: false}]) {
    const result = f.mods.setState({selections: [{names: ["Personal"], enabled: false}, rejected]}); assert.equal(result.ok, false); assert.equal(hashTree(f.gamePath), before);
  }
});
test("duplicate batch game-state keys deduplicate equal choices and reject conflicting choices", () => {
  for (const versioned of [false, true]) {
    const f = fixture(); f.put("Personal", "1"); const filename = path.join(f.profile, "enabledmods.json"); fs.writeFileSync(filename, JSON.stringify(versioned ? {Version: 1, Personal: {"1": true}} : {Personal: true}));
    const before = hashTree(f.gamePath), conflicting = f.mods.setState({selections: [{names: ["Personal"], enabled: false}, {names: ["Personal"], enabled: true}]});
    assert.equal(conflicting.ok, false); assert.equal(conflicting.code, "STATE_CONFLICT"); assert.equal(hashTree(f.gamePath), before);
    const write = state.write; let writes = 0; state.write = (...args) => {writes++; return write(...args);};
    try {assert.equal(f.mods.setState({selections: [{names: ["Personal"], enabled: false}, {names: ["Personal"], enabled: false}]}).ok, true); assert.equal(writes, 1);} finally {state.write = write;}
  }
});
test("batch package ambiguity and plugin selectors reject every planned choice", () => {
  const f = fixture(); f.put("Personal"); f.put("Shared", "1", "Child", "Alice-Example-1.0.0"); f.put("Shared", "1", "Child", "Bob-Example-1.0.0");
  const owner = path.join(f.profile, "packages/Carol-PluginOnly-1.0.0"); fs.mkdirSync(path.join(owner, "plugins"), {recursive: true}); fs.writeFileSync(path.join(owner, "plugins/plugin.dll"), "fixture"); fs.writeFileSync(path.join(owner, "manifest.json"), JSON.stringify({name: "PluginOnly", version_number: "1.0.0"}));
  const before = hashTree(f.gamePath);
  for (const selection of [{names: ["Shared"], enabled: false, package: {author: "Alice", package_name: "Example", version: "1.0.0"}}, {names: ["PluginOnly"], enabled: false, package: {author: "Carol", package_name: "PluginOnly", version: "1.0.0"}}]) {
    assert.equal(f.mods.setState({selections: [{names: ["Personal"], enabled: false}, selection]}).ok, false); assert.equal(hashTree(f.gamePath), before);
  }
});
test("malformed batch forms are rejected and unchanged batches avoid a write", () => {
  const f = fixture(); f.put("Personal"); const before = hashTree(f.gamePath);
  for (const request of [{selections: []}, {selections: null}, {selections: [{names: ["Personal"], enabled: false}], names: ["Personal"]}, {selections: [{names: ["Personal"], enabled: "false"}]}, {selections: [{names: ["Personal"], enabled: false, package: {author: "Alice"}}]}]) {assert.equal(f.mods.setState(request).ok, false); assert.equal(hashTree(f.gamePath), before);}
  assert.equal(f.mods.setState({selections: [{names: ["Personal"], enabled: true}]}).ok, true); assert.equal(hashTree(f.gamePath), before);
});
test("batch IPC uses the same guarded mutation as a single selection", async () => {
  const f = fixture(); f.put("One"); f.put("Two"); const before = hashTree(f.gamePath); f.setSnapshot({ok: true, processes: [{image: "titanfall2.exe"}]});
  assert.equal((await f.ipc.get("set-mod-state")({}, {selections: [{names: ["One"], enabled: false}, {names: ["Two"], enabled: false}]})).ok, false); assert.equal(hashTree(f.gamePath), before);
  f.setSnapshot({ok: true, processes: []}); assert.equal((await f.ipc.get("set-mod-state")({}, {selections: [{names: ["One"], enabled: false}, {names: ["Two"], enabled: false}]})).ok, true);
});
test("legacy bulk inversion flips a duplicated flat-schema name only once", () => {
  const f = fixture(); f.put("Same", "1", "First"); f.put("Same", "2", "Second"); fs.writeFileSync(path.join(f.profile, "enabledmods.json"), JSON.stringify({Same: true}));
  const result = f.mods.toggle("allmods"); assert.equal(result.ok, true); assert.equal(JSON.parse(fs.readFileSync(path.join(f.profile, "enabledmods.json"))).Same, false); assert.ok(result.mods.all.every(item => item.disabled));
});
test("a valid definition larger than 1 MiB imports into the custom profile and remains indexed", async () => {
  const importer = require("../src/modules/local-mod-import"), f = fixture({custom: true, importAction: importer.importLocalMod}), directory = path.join(f.base, "LargeDefinition"); fs.mkdirSync(directory);
  const bytes = Buffer.from(JSON.stringify({Name: "Personal.LargeDefinition", Version: "1.0.0", CustomPayload: "x".repeat(1024 * 1024 + 32)})); assert.ok(bytes.length > 1024 * 1024 && bytes.length < 4 * 1024 * 1024); fs.writeFileSync(path.join(directory, "mod.json"), bytes);
  const result = await f.mods.install(directory); assert.equal(result.ok, true); const row = f.mods.list({readOnly: true}).all.find(item => item.name === "Personal.LargeDefinition"); assert.ok(row); assert.equal(row.stateVersion, "1.0.0"); assert.deepEqual(fs.readFileSync(path.join(row.folder_path, "mod.json")), bytes); assert.equal(fs.existsSync(path.join(f.gamePath, "R2Northstar")), false);
});
test("invalid UTF-8 definitions reject import rather than replacing bytes and disappearing from the index", async () => {
  const importer = require("../src/modules/local-mod-import"), f = fixture({importAction: importer.importLocalMod}), directory = path.join(f.base, "InvalidEncoding"); fs.mkdirSync(directory);
  const bytes = Buffer.concat([Buffer.from('{"Name":"Personal.'), Buffer.from([0xff]), Buffer.from('","Version":"1"}')]); fs.writeFileSync(path.join(directory, "mod.json"), bytes); const original = hashTree(f.gamePath);
  const result = await f.mods.install(directory); assert.equal(result.ok, false); assert.equal(result.code, "definition"); assert.match(result.error, /UTF-8/); assert.equal(hashTree(f.gamePath), original); assert.deepEqual(fs.readFileSync(path.join(directory, "mod.json")), bytes);
});

test("local import initializes independent choices before committing a first package", async () => {
  let f;
  f = fixture({importAction: async () => {const metadata = require("../src/modules/server-mod-profiles").read(f.profile).value; assert.equal(metadata.global.Existing, true); f.put("Fresh.Import"); return {ok: true, name: "Fresh.Import", names: ["Fresh.Import"]};}});
  f.saved.independentServerMods = true; f.saved.northstarRegion = "cn"; f.put("Existing");
  const result = await f.mods.install(path.join(f.base, "fixture.zip")); assert.equal(result.ok, true);
  const profiles = require("../src/modules/server-mod-profiles"); profiles.transition(f.saved, {...f.saved, northstarRegion: "global"});
  const document = state.parse(state.checked(path.join(f.profile, "enabledmods.json"))); assert.equal(state.enabled(document, "Fresh.Import", "1"), false);
});
test("a region change during an asynchronous process guard cancels a queued Mod toggle", async () => {
  const f = fixture(); f.put("Example"); f.saved.northstarRegion = "cn";
  let release; f.setSnapshot(() => new Promise(resolve => {release = resolve;})); const before = hashTree(f.gamePath);
  const pending = f.mods.setStateAsync({names: ["Example"], enabled: false});
  f.saved.northstarRegion = "global"; release({ok: true, processes: []});
  assert.equal((await pending).ok, false); assert.equal(hashTree(f.gamePath), before);
});
test("post-crash reads project selected server without writes and the next mutation recovers its live flags", async () => {
  const f = fixture(), profiles = require("../src/modules/server-mod-profiles"); f.put("Example"); f.saved.independentServerMods = true; f.saved.northstarRegion = "cn";
  profiles.transition(f.saved, f.saved); assert.equal(f.mods.setState({names: ["Example"], enabled: false}).ok, true);
  profiles.transition(f.saved, {...f.saved, northstarRegion: "global"}); // Persisted selection still CN after interrupted acknowledgement.
  const before = hashTree(f.gamePath); assert.equal(f.mods.list({readOnly: true}).all.find(row => row.name === "Example").disabled, true); assert.equal(hashTree(f.gamePath), before);
  assert.equal((await f.mods.setStateAsync({names: ["Example"], enabled: true})).ok, true);
  assert.equal(profiles.read(f.profile).value.activeRegion, "cn");
  const live = state.parse(state.checked(path.join(f.profile, "enabledmods.json"))); assert.equal(live.format, "flat"); assert.equal(state.enabled(live, "Example", "1"), true);
});
test("independent toggle snapshots the confirmed choice and a snapshot failure rolls the live choice back", () => {
  const f = fixture(), profiles = require("../src/modules/server-mod-profiles"); f.put("Example"); f.saved.independentServerMods = true; f.saved.northstarRegion = "global";
  profiles.transition(f.saved, f.saved);
  assert.equal(f.mods.setState({names: ["Example"], enabled: false}).ok, true); assert.equal(profiles.read(f.profile).value.global.Example, false);
  const before = hashTree(f.gamePath), originalWrite = state.write;
  state.write = (filename, ...args) => {if (filename.endsWith(".tfx-server-mods.json")) throw Error("snapshot disk full"); return originalWrite(filename, ...args);};
  try {const result = f.mods.setState({names: ["Example"], enabled: true}); assert.equal(result.ok, false); assert.match(result.error, /snapshot disk full/); assert.equal(hashTree(f.gamePath), before);}
  finally {state.write = originalWrite;}
});

test("official Mod selection protects VanillaPlus and disables incompatible Northstar core operations", async () => {
  const f = fixture(), profiles = require("../src/modules/server-mod-profiles");
  for (const name of state.CORE_NAMES) f.put(name);
  f.put("Community.Only");
  Object.assign(f.saved, {modProfileServer: "official", independentServerMods: true});
  for (const name of state.CORE_NAMES) f.put(name); f.put("VanillaPlus", "2.5.1", "NP.VanillaPlus", "NachosChipeados-VanillaPlus-2.5.1"); f.put("Personal");
  profiles.transition(f.saved, f.saved);
  const before = hashTree(f.gamePath), vanilla = f.mods.list({readOnly: true}).all.find(item => item.name === "VanillaPlus");
  assert.equal(vanilla.required, true); assert.equal(vanilla.disabled, false);
  assert.equal(f.mods.list({readOnly:true}).all.some(item => item.name === "Community.Only"),false);
  assert.equal(f.mods.setState({names: ["VanillaPlus"], enabled: false}).code, "CORE_REQUIRED");
  assert.equal(f.mods.setState({names: ["Northstar.Client"], enabled: true}).code, "CORE_REQUIRED");
  assert.equal(f.mods.remove("VanillaPlus").code, "CORE_REQUIRED"); assert.equal(hashTree(f.gamePath), before);
  assert.equal(f.mods.modfile.gen().ok, true); profiles.assertOfficialReady(path.join(f.gamePath,"R2Titanfall"));
  profiles.transition(f.saved, {...f.saved, modProfileServer: "cn"}); f.saved.modProfileServer = "cn";
  assert.equal(f.mods.list({readOnly:true}).all.some(item => item.name === "VanillaPlus"),false);
  for (const name of state.CORE_NAMES) assert.equal(f.mods.list({readOnly: true}).all.find(item => item.name === name).disabled, false);
});
test("official server selection during asynchronous Mod guard cancels the old server mutation", async () => {
  const f = fixture(); f.put("Example"); f.saved.modProfileServer = "cn";
  let release; f.setSnapshot(() => new Promise(resolve => {release = resolve;})); const before = hashTree(f.gamePath);
  const pending = f.mods.setStateAsync({names: ["Example"], enabled: false});
  f.saved.modProfileServer = "official"; release({ok: true, processes: []});
  assert.equal((await pending).ok, false); assert.equal(hashTree(f.gamePath), before);
});
test("older and duplicate VanillaPlus packages remain removable so the dedicated installer can recover", () => {
  const f = fixture(); f.saved.modProfileServer = "official";
  f.put("VanillaPlus", "2.4.1", "NP.VanillaPlus", "NachosChipeados-VanillaPlus-2.4.1");
  f.put("VanillaPlus", "2.5.1", "NP.VanillaPlus", "NachosChipeados-VanillaPlus-2.5.1");
  const rows = f.mods.list({readOnly: true}).all.filter(item => item.name === "VanillaPlus");
  assert.equal(rows.find(item => item.stateVersion === "2.4.1").required, false); assert.equal(rows.find(item => item.stateVersion === "2.5.1").required, true);
  const duplicate = rows.find(item => item.stateVersion === "2.4.1"); assert.equal(f.mods.remove({name: "VanillaPlus", folder_name: duplicate.folder_name, package: duplicate.package}), true);
  const official=path.join(f.gamePath,"R2Titanfall");
  assert.equal(fs.existsSync(path.join(official, "packages/NachosChipeados-VanillaPlus-2.4.1")), false);
  assert.equal(fs.existsSync(path.join(official, "packages/NachosChipeados-VanillaPlus-2.5.1/mods/NP.VanillaPlus/mod.json")), true);
});

test.after(() => {
  assert.equal(path.dirname(fixtureRoot), path.resolve(os.tmpdir()));
  assert(path.basename(fixtureRoot).startsWith("tfx-mods-library-"));
  const stat = fs.lstatSync(fixtureRoot); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
});
