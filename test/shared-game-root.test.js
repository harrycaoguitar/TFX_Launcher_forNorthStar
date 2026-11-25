"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = fs.promises;
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

function loadGamepath(t, root) {
  const file = path.resolve(__dirname, "../src/modules/gamepath.js"), originalLoad = Module._load, originalInterval = global.setInterval;
  const saved = {gamepath: root, globalGamepath: "", chinaInstallTarget: "", async save(value) {Object.assign(this, value);}};
  const sent = [], alerts = [], checks = [];
  const window = {send: (channel, value) => sent.push({channel, value}), isVisible: () => true, alert: async value => alerts.push(value)};
  const same = (left, right) => path.win32.resolve(left).toLowerCase() === path.win32.resolve(right).toLowerCase();
  const findgame = Object.assign(async () => root, {
    normalizeGamePath: value => value,
    validateGamePath: value => same(value, root) ? root : false,
    sameGamePath: same,
    findGames: async () => [root],
    selectGlobalGamePath: () => false
  });
  const dualInstall = {
    ensureDisjoint(left, right) {if (same(left, right)) throw Object.assign(Error("same root"), {code: "GLOBAL_TARGET_SAME_AS_SOURCE"});},
    async inspectInstallTarget(options) {checks.push(options); return {root, ready: true, installable: false, shared: true};}
  };
  Module._load = function(request, parent, isMain) {
    if (parent?.filename === file) {
      if (request === "../win") return () => window;
      if (request === "electron") return {dialog: {showOpenDialog: async () => ({canceled: false, filePaths: [root]})}, ipcMain: {on() {}}};
      if (request === "./version") return {send_info() {}};
      if (request === "./settings") return () => saved;
      if (request === "./findgame") return findgame;
      if (request === "./dual-install") return dualInstall;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  global.setInterval = () => 0;
  delete require.cache[file];
  let api;
  try {api = require(file);} finally {Module._load = originalLoad; global.setInterval = originalInterval; delete require.cache[file];}
  t.after(() => {api.setting = false; api.globalSetting = false;});
  return {api, saved, sent, alerts, checks};
}

test("Global Northstar may resolve to the same game root as China", async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "tfx-shared-root-"));
  await fsp.writeFile(path.join(root, "Titanfall2.exe"), "MZ");
  t.after(() => fsp.rm(root, {recursive: true, force: true}));

  const gameRoots = require("../src/modules/game-roots");
  assert.equal(gameRoots.resolveGameRoot({gamepath: root, globalGamepath: root, northstarRegion: "global"}, {gameVersion: "northstar", region: "global"}), root);
});

test("Global root installation reuses a shared game root without copying", async t => {
  const temporary = await fsp.mkdtemp(path.join(os.tmpdir(), "tfx-shared-install-"));
  const root = await fsp.realpath(temporary);
  await fsp.writeFile(path.join(root, "Titanfall2.exe"), "MZ");
  await Promise.all(["Core", "bin", "platform", "r2", "vpk"].map(name => fsp.mkdir(path.join(root, name))));
  t.after(() => fsp.rm(root, {recursive: true, force: true}));

  const dualInstall = require("../src/modules/dual-install");
  const result = await dualInstall.installGlobalRoot({sourceRoot: root, targetRoot: root, getFileSystem: () => "NTFS"});
  assert.equal(result.root, root);
  assert.equal(result.reused, true);
  assert.equal(result.shared, true);
  assert.deepEqual((await fsp.readdir(root)).sort(), ["Core", "Titanfall2.exe", "bin", "platform", "r2", "vpk"].sort());
});

test("China root installation still rejects copying onto its source", async t => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "tfx-china-root-"));
  await fsp.writeFile(path.join(root, "Titanfall2.exe"), "MZ");
  await Promise.all(["Core", "bin", "platform", "r2", "vpk"].map(name => fsp.mkdir(path.join(root, name))));
  t.after(() => fsp.rm(root, {recursive: true, force: true}));

  const dualInstall = require("../src/modules/dual-install");
  await assert.rejects(() => dualInstall.installChinaRoot({sourceRoot: root, targetRoot: root, getFileSystem: () => "NTFS"}), {code: "GLOBAL_TARGET_SAME_AS_SOURCE"});
});

test("Global game discovery falls back to the shared China root when no second copy exists", () => {
  const findgame = require("../src/modules/findgame");
  assert.equal(findgame.selectGlobalGamePath(["D:/Titanfall2"], "D:/Titanfall2"), "D:\\Titanfall2");
});

test("manual Global directory selection accepts the existing China root", async t => {
  const temporary = await fsp.mkdtemp(path.join(os.tmpdir(), "tfx-gamepath-shared-"));
  const root = await fsp.realpath(temporary);
  await fsp.writeFile(path.join(root, "Titanfall2.exe"), "MZ");
  t.after(() => fsp.rm(temporary, {recursive: true, force: true}));
  const f = loadGamepath(t, root);

  assert.equal(await f.api.setGlobal({send: (...args) => f.sent.push(args), isVisible: () => true, alert: async value => f.alerts.push(value)}, true), root);
  assert.equal(f.saved.globalGamepath, root);
  assert.equal(f.alerts.length, 0);
  assert.equal(f.checks[0].allowSame, true);
  assert.ok(f.sent.some(value => value[0] === "globalpath-status" && value[1].valid === true));
});
