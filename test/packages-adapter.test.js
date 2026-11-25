"use strict";
const os = require("node:os");
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm"), {EventEmitter} = require("events");
const sourceFile = path.join(__dirname, "../src/modules/packages.js"), root = fs.mkdtempSync(path.join(os.tmpdir(), "tfx-packages-adapter-"));

function fixture(t, custom, installed) {
	const base = fs.mkdtempSync(path.join(root, "case-")), gamepath = path.join(base, "game"), profile = path.join(gamepath, custom ? "PersonalProfile" : "R2Northstar"), config = {gamepath, nsargs: custom ? '-profile "PersonalProfile" -multiple' : "-multiple"}, events = [], ipcMain = new EventEmitter(), app = new EventEmitter();
	fs.mkdirSync(profile, {recursive: true}); fs.mkdirSync(path.join(gamepath, "r2")); fs.writeFileSync(path.join(gamepath, "Titanfall2.exe"), "fixture"); if (installed) fs.writeFileSync(path.join(gamepath, "NorthstarLauncher.exe"), "fixture, never executed"); app.getPath = () => base;
	let options, guardCalls = 0;
	const engine = {install: async request => {const captured = options.profile(); await options.guard(captured); guardCalls++; return {name: `${request.author}-${request.package_name}-${request.version}`, fancy_name: request.package_name, profileDirectory: captured.profileDirectory};}, remove: async () => true, cancel: () => true, cancelAll: () => {}};
	const modules = {electron: {app, ipcMain}, "./settings": () => config, "./server-mod-profiles": require("../src/modules/server-mod-profiles"), "./northstar-region": require("../src/modules/northstar-region"), "./launch-session": require("../src/modules/launch-session"), "./is_running": {snapshot: async () => ({ok: true, processes: []})}, "./dds-operation-gate": {run: (_label, action) => action()}, "../win": () => ({send: (channel, value) => events.push([channel, value]), confirm: async () => true}), "../lang": () => "plugins", "./thunderstore-transport": {createRequest: () => () => {throw Error("Mock installer never downloads");}}, "./thunderstore": {planInstall: async () => ({})}, "./thunderstore-install": {...require("../src/modules/thunderstore-install"), createInstaller: value => {options = value; return engine;}}};
	modules["./game-roots"] = require("../src/modules/game-roots");
	const context = {require: name => modules[name] || require(name), module: {exports: {}}, console, URL}; vm.runInNewContext(fs.readFileSync(sourceFile, "utf8"), context, {filename: sourceFile});
	t.after(() => {assert.ok(path.resolve(base).startsWith(path.resolve(root) + path.sep)); fs.rmSync(base, {recursive: true, force: true});});
	return {packages: context.module.exports, config, events, ipcMain, profile, gamepath, get guardCalls() {return guardCalls;}, get options() {return options;}};
}
test("installed default and custom clients use the captured matching profile in the actual packages adapter", async t => {
	for (const custom of [false, true]) {
		const f = fixture(t, custom, true); const result = await f.packages.install("https://thunderstore.io/package/download/Pilot/Example/1.0.0/", "Pilot", "Example", "1.0.0"); assert.equal(result.profileDirectory, fs.realpathSync(f.profile)); assert.equal(f.packages.path, path.join(fs.realpathSync(f.profile), "packages")); assert.equal(f.guardCalls, 1);
	}
});
test("the IPC adapter rejects a missing client and emits one clear failure without reporting installation", async t => {
	const f = fixture(t, false, false); await f.ipcMain.listeners("install-from-url")[0](null, "https://thunderstore.io/package/download/Pilot/Example/1.0.0/", "Pilot", "Example", "1.0.0");
	assert.equal(f.events.length, 1); assert.equal(f.events[0][0], "failed-mod"); assert.equal(f.events[0][1].source, "thunderstore"); assert.equal(f.events[0][1].code, "CLIENT_MISSING"); assert.equal(f.events[0][1].name, "Example"); assert.equal(f.guardCalls, 0); assert.equal(fs.existsSync(path.join(f.profile, "packages")), false);
});
test("the packages adapter refuses a directory in place of NorthstarLauncher.exe", async t => {
	const f = fixture(t, false, false); fs.mkdirSync(path.join(f.gamepath, "NorthstarLauncher.exe")); await assert.rejects(f.packages.install("https://thunderstore.io/package/download/Pilot/Example/1.0.0/", "Pilot", "Example", "1.0.0"), error => error.code === "CLIENT_MISSING");
});
test("the packages adapter binds official Mod imports to the same shared profile and rejects a server change", async t => {
	const f = fixture(t, true, true); f.config.modProfileServer = "official"; fs.mkdirSync(path.join(f.gamepath,"R2Titanfall"),{recursive:true});
	f.config.globalGamepath = path.join(path.dirname(f.gamepath), "global-game"); fs.mkdirSync(path.join(f.config.globalGamepath,"r2"),{recursive:true}); fs.writeFileSync(path.join(f.config.globalGamepath,"Titanfall2.exe"),"fixture"); fs.writeFileSync(path.join(f.config.globalGamepath,"NorthstarLauncher.exe"),"fixture");
	const captured = f.options.profile(); assert.equal(captured.region, "official"); assert.equal(captured.profileDirectory, fs.realpathSync(path.join(f.gamepath,"R2Titanfall")));
	await f.options.guard(captured); f.config.modProfileServer = "global";
	await assert.rejects(f.options.guard(captured), error => error.code === "PROFILE_CHANGED");
});

test.after(() => {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith("tfx-packages-adapter-"));
  const stat = fs.lstatSync(root); assert(stat.isDirectory() && !stat.isSymbolicLink());
  fs.rmSync(root, {recursive: true, force: true});
});
