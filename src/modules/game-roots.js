"use strict";

const fs = require("fs"), path = require("path");
const findgame = require("./findgame");
const GAME_IMAGES = new Set(["titanfall2.exe", "titanfall2-unpacked.exe", "northstarlauncher.exe"]);

function sameRoot(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  return canonicalPath(left) === canonicalPath(right);
}

function canonicalPath(value) {
  try { return path.resolve(fs.realpathSync.native(value)).replace(/[\\/]+$/, "").toLowerCase(); }
  catch (_) { return path.win32.resolve(value).replace(/[\\/]+$/, "").toLowerCase(); }
}

function resolveGameRoot(conf, {gameVersion = "northstar", region = conf?.northstarRegion} = {}) {
  const selectedRegion = region === "global" ? "global" : "cn";
  const value = gameVersion === "vanilla" || selectedRegion === "cn" ? conf?.gamepath : conf?.globalGamepath;
  if (typeof value !== "string" || !value.trim()) {
    const error = Error(selectedRegion === "global" && gameVersion !== "vanilla" ? "请先设置国际服独立游戏目录。" : "请先选择泰坦陨落 2 游戏目录。");
    error.code = selectedRegion === "global" && gameVersion !== "vanilla" ? "GLOBAL_GAME_ROOT_MISSING" : "GAME_ROOT_MISSING";
    throw error;
  }
  const root = findgame.validateGamePath(value);
  if (!root) {
    const error = Error(selectedRegion === "global" && gameVersion !== "vanilla" ? "国际服游戏目录已失效或缺少 Titanfall2.exe，请重新选择。" : "游戏目录已失效或缺少 Titanfall2.exe，请重新选择。");
    error.code = selectedRegion === "global" && gameVersion !== "vanilla" ? "GLOBAL_GAME_ROOT_INVALID" : "GAME_DIRECTORY_INVALID";
    throw error;
  }
  if (selectedRegion === "global" && gameVersion !== "vanilla") {
    const chinaRoot = findgame.validateGamePath(conf?.gamepath);
    if (chinaRoot && sameRoot(root, chinaRoot)) {
      const error = Error("国际服必须使用与国服不同的游戏目录。");
      error.code = "GLOBAL_GAME_ROOT_SAME_AS_CHINA";
      throw error;
    }
  }
  return root;
}

function captureLaunchContext(conf, gameVersion = "northstar") {
  const region = gameVersion === "vanilla" ? "cn" : conf?.northstarRegion === "global" ? "global" : "cn";
  return Object.freeze({region, root: resolveGameRoot(conf, {gameVersion, region})});
}

function withLaunchRoot(conf, selection) {
  return selection?.region === "global"
    ? {...conf, globalGamepath: selection.root}
    : {...conf, gamepath: selection?.root};
}

function gameRootForServer(conf, server) {
  return server === "official"
    ? resolveGameRoot(conf, {gameVersion: "vanilla", region: "cn"})
    : resolveGameRoot(conf, {gameVersion: "northstar", region: server === "global" ? "global" : "cn"});
}

function gameRootForProfile(conf) {
  return gameRootForServer(conf, conf?.modProfileServer);
}

function serverTransitionRoots(previous, next) {
  const contexts = previous.independentServerMods && next.independentServerMods
    ? [[previous, previous.modProfileServer], [next, next.modProfileServer]]
    : next.independentServerMods
      ? [[next, next.modProfileServer]]
      : previous.independentServerMods
        ? [[previous, previous.modProfileServer]]
        : [];
  const result = [];
  for (const [conf, server] of contexts) {
    try {
      const root = gameRootForServer(conf, server);
      if (!result.some(value => sameRoot(value, root))) result.push(root);
    } catch (_) {}
  }
  return result;
}

function roots(conf) {
  const result = {};
  for (const region of ["cn", "global"]) {
    try {result[region] = resolveGameRoot(conf, {gameVersion: "northstar", region});}
    catch (_) {result[region] = null;}
  }
  return result;
}

function processBelongsToRoot(executablePath, root) {
  if (typeof executablePath !== "string" || !executablePath.trim() || typeof root !== "string" || !root.trim()) return false;
  const executable = canonicalPath(executablePath);
  const directory = canonicalPath(root);
  return executable === directory || executable.startsWith(directory + "\\");
}

function processesForRoot(snapshot, root) {
  if (!snapshot?.ok || !Array.isArray(snapshot.processes)) return null;
  const matching = [];
  for (const process of snapshot.processes) {
    const image = String(process.image || "").toLowerCase();
    if (!GAME_IMAGES.has(image)) continue;
    // A known game process without a readable path is ambiguous and blocks the
    // operation rather than being treated as belonging to another install.
    if (!process.executablePath) return null;
    if (processBelongsToRoot(process.executablePath, root)) matching.push(process);
  }
  return matching;
}

function hasGame(snapshot, root) {
  if (root === undefined) return !snapshot?.ok || !Array.isArray(snapshot.processes) || snapshot.processes.some(process => GAME_IMAGES.has(String(process.image || "").toLowerCase()));
  const matching = processesForRoot(snapshot, root);
  return matching === null || matching.length > 0;
}

module.exports = {resolveGameRoot, gameRootForServer, gameRootForProfile, serverTransitionRoots, captureLaunchContext, withLaunchRoot, roots, sameRoot, processBelongsToRoot, processesForRoot, hasGame, GAME_IMAGES};
