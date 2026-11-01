"use strict";

(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VyraLaunchAvailability = api;
})(typeof window === "undefined" ? null : window, function() {
  const GAME_IMAGES = new Set(["titanfall2.exe", "titanfall2-unpacked.exe", "northstarlauncher.exe"]);
  function targetRoot(settings, gameVersion, region = settings?.northstarRegion) {
    if (gameVersion === "vanilla" || region !== "global") return settings?.chinaInstallTarget || settings?.gamepath || null;
    const target = settings?.globalGamepath;
    return target && !sameDirectory(target, settings?.gamepath) ? target : null;
  }
  function sameDirectory(pathA, pathB) {
    if (typeof pathA !== "string" || typeof pathB !== "string" || !pathA.trim() || !pathB.trim()) return false;
    const normalize = value => value.replaceAll("/", "\\").replace(/[\\]+$/, "").toLowerCase();
    return normalize(pathA) === normalize(pathB);
  }
  function directoryReady(settings, gameVersion, region = settings?.northstarRegion, readiness = {}) {
    const selected = gameVersion !== "vanilla" && region === "global" ? "global" : "cn";
    return Boolean(targetRoot(settings, gameVersion, region) && readiness?.[selected] === true);
  }
  function sameRoot(pathA, pathB) {
    if (typeof pathA !== "string" || typeof pathB !== "string" || !pathA.trim() || !pathB.trim()) return false;
    const normalize = value => value.replaceAll("/", "\\").replace(/[\\]+$/, "").toLowerCase();
    const left = normalize(pathA), right = normalize(pathB);
    return left === right || left.startsWith(right + "\\");
  }
  function canLaunch(snapshot, settings, gameVersion, region) {
    const target = targetRoot(settings, gameVersion, region);
    if (!target || !snapshot?.ok || !Array.isArray(snapshot.processes)) return false;
    const matching = processesForRoot(snapshot, target);
    return matching !== null && matching.length === 0;
  }
  function canInstall(snapshot, settings, gameVersion, region) {
    const target = targetRoot(settings, gameVersion, region);
    if (!target) return false;
    const matching = processesForRoot(snapshot, target);
    return matching === null || matching.length === 0;
  }
  function controlAvailability({blocked = false, canLaunch = false} = {}) {
    const locked = Boolean(blocked);
    return Object.freeze({canSelect: !locked, canStart: !locked && canLaunch === true});
  }
  function processesForRoot(snapshot, target) {
    if (!target || !snapshot?.ok || !Array.isArray(snapshot.processes)) return null;
    const matching = [];
    for (const process of snapshot.processes) {
      if (!GAME_IMAGES.has(String(process.image || "").toLowerCase())) continue;
      if (!process.executablePath) return null;
      if (sameRoot(process.executablePath, target)) matching.push(process);
    }
    return matching;
  }
  function rootOccupied(snapshot, settings, gameVersion, region) {
    const target = targetRoot(settings, gameVersion, region);
    if (!target) return false;
    const matching = processesForRoot(snapshot, target);
    return matching !== null && matching.length > 0;
  }
  return Object.freeze({targetRoot, canLaunch, canInstall, rootOccupied, controlAvailability, directoryReady});
});
