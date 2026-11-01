"use strict";

// Only enabledmods.json is projected for the selected server. Installed Mod
// folders, plugin binaries and DDS/VTF resources are deliberately shared.
const fs = require("fs"), path = require("path");
const state = require("./mod-enabled-state"), region = require("./northstar-region");
const {splitArguments} = require("./launch-session");
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const same = (a, b) => a === null ? b === null : b !== null && a.equals(b);
const error = message => Object.assign(Error(message), {code: "MOD_PROFILE_STATE"});
const SERVERS = Object.freeze(["cn", "global", "official"]), VANILLA_PLUS = "VanillaPlus", VANILLA_PLUS_FOLDER = "NP.VanillaPlus";
function selectedServer(conf) {return SERVERS.includes(conf.modProfileServer) ? conf.modProfileServer : region.normalize(conf.northstarRegion);}
function compatibleChoice(server, mod, on) {
  if (mod.name === VANILLA_PLUS) return server === "official";
  if (state.CORE_NAMES.includes(mod.name)) return server !== "official";
  return on;
}
function assertUniqueCore(mods) {
  if ([...state.CORE_NAMES, VANILLA_PLUS].some(name => mods.filter(mod => mod.name === name).length > 1)) throw error("Duplicate client core Mods were found. Remove duplicate core Mods first.");
}
function context(conf) {
	let gameRoot, profile;
	if (conf.profileDirectory) {
		profile = path.resolve(conf.profileDirectory);
		if (!fs.existsSync(profile)) return null;
	} else {
		try {gameRoot = require("./game-roots").gameRootForServer(conf, selectedServer(conf));}catch (_) {return null;}
		if (!fs.existsSync(gameRoot)) return null;
		profile = region.resolveProfile(gameRoot, splitArguments(conf.nsargs || ""));
	}
  if (!fs.existsSync(profile)) return null;
  state.checked(path.join(profile, ".tfx-path-check"));
  return {profile: fs.realpathSync(profile), region: selectedServer(conf)};
}
function filename(profile) {return path.join(profile, ".tfx-server-mods.json");}
function read(profile) {
  const bytes = state.checked(filename(profile));
  if (!bytes) return {bytes: null, value: null};
  let value; try {value = JSON.parse(bytes.toString("utf8"));} catch (_) {throw error("Independent Mod settings are invalid; the original files were preserved.");}
  if (!Buffer.from(bytes.toString("utf8")).equals(bytes) || ![1, 2].includes(value?.schemaVersion) || typeof value.profile !== "string" || path.resolve(value.profile).toLowerCase() !== path.resolve(profile).toLowerCase() || !(value.schemaVersion === 1 ? ["cn", "global"] : SERVERS).includes(value.activeRegion)) throw error("Independent Mod settings do not match the selected profile.");
  for (const server of value.schemaVersion === 1 ? ["cn", "global"] : SERVERS) {
    const choices = value[server];
    if (!choices || typeof choices !== "object" || Array.isArray(choices) || Object.keys(choices).length > 12000 || Object.entries(choices).some(([name, on]) => !name || /[\x00-\x1f]/.test(name) || typeof on !== "boolean")) throw error("Independent Mod choices are invalid; the original files were preserved.");
  }
  // Older versions never had an official-server snapshot. Seed it from the
  // last committed active snapshot, preserving both existing server choices.
  if (value.schemaVersion === 1) {value.official = {...value[value.activeRegion]}; value.schemaVersion = 2;}
  return {bytes, value};
}
function choices(document, mods, fallback) {
  const selected = Object.create(null);
  for (const mod of mods) {
    // A Mod version upgrade keeps this server's choice by Mod identity. An
    // exact current version wins; a unique older choice is a safe fallback.
    let on = state.enabled(document, mod.name, mod.version);
    if (document.format === "versioned" && own(document.states, mod.name) && !own(document.states[mod.name], mod.version)) {
      const values = Object.values(document.states[mod.name]);
      if (values.length && values.every(value => value === values[0])) on = values[0];
      else if (fallback && own(fallback, mod.name)) on = fallback[mod.name];
      else if (values.length) throw Object.assign(Error("This Mod has conflicting historical version choices. Set its current version explicitly before enabling independent server Mods: " + mod.name), {code: "AMBIGUOUS_MOD_PROFILE"});
    }
    on = mod.required || on;
    if (own(selected, mod.name) && selected[mod.name] !== on) throw Object.assign(Error("Multiple installed versions of this Mod have different enabled states. Remove the duplicate before enabling independent server Mods: " + mod.name), {code: "AMBIGUOUS_MOD_PROFILE"});
    selected[mod.name] = on;
  }
  return selected;
}
function project(value, selectedRegion, mods) {
  if (!SERVERS.includes(selectedRegion)) throw error("Select a supported Mod server profile.");
  assertUniqueCore(mods);
  const document = state.parse(selectedRegion === "cn" ? {} : {Version: 1});
  for (const mod of mods) state.set(document, mod.name, mod.version, compatibleChoice(selectedRegion, mod, value[selectedRegion][mod.name] === true));
  return document;
}
function reconcile(value, document, mods, activeRegion) {
  const observed = choices(document, mods, value[activeRegion]);
  for (const [name, on] of Object.entries(observed)) {
    Object.defineProperty(value[activeRegion], name, {value: on, enumerable: true, writable: true, configurable: true});
    for (const other of SERVERS.filter(server => server !== activeRegion)) if (!own(value[other], name)) Object.defineProperty(value[other], name, {value: false, enumerable: true, writable: true, configurable: true});
  }
  for (const mod of mods) for (const server of SERVERS) value[server][mod.name] = compatibleChoice(server, mod, value[server][mod.name]);
}
function initial(profile, activeRegion, selected, mods) {
  const value = {schemaVersion: 2, profile, activeRegion, cn: {...selected}, global: {...selected}, official: {...selected}};
  for (const mod of mods) for (const server of SERVERS) value[server][mod.name] = compatibleChoice(server, mod, value[server][mod.name]);
  return value;
}
function plansFor(before, next) {
  if (!before.independentServerMods && !next.independentServerMods) return [];
  const oldContext = context(before), nextContext = context(next), plans = new Map();
  function load(ctx) {
    if (!ctx) return null;
    if (plans.has(ctx.profile)) return plans.get(ctx.profile);
    const source = read(ctx.profile), file = path.join(ctx.profile, "enabledmods.json"), original = state.checked(file), document = state.parse(original), mods = state.installed(ctx.profile, {requireVersion: true});
    const plan = {ctx, source, file, original, document, mods, value: source.value && JSON.parse(JSON.stringify(source.value)), intended: original};
    plans.set(ctx.profile, plan); return plan;
  }
  if (before.independentServerMods && oldContext) {
    const old = load(oldContext);
    if (!old.value) old.value = initial(oldContext.profile, oldContext.region, choices(old.document, old.mods), old.mods);
    // If a process stopped between the Mod-state and preference commits, its
    // marker identifies the live file. Do not attribute that file to the old
    // persisted region and leak choices across the two servers.
    if (old.value.activeRegion === oldContext.region) reconcile(old.value, old.document, old.mods, oldContext.region);
    else {
      old.intended = state.serialize(project(old.value, oldContext.region, old.mods));
      old.value.activeRegion = oldContext.region;
    }
  }
  if (next.independentServerMods && nextContext) {
    const incoming = load(nextContext);
    if (!incoming.value) {
      const selected = choices(incoming.document, incoming.mods);
      incoming.value = initial(nextContext.profile, nextContext.region, selected, incoming.mods);
    } else if (!before.independentServerMods) {
      // Re-enabling adopts the currently shared choices only on the selected
      // side. A previously saved other side remains independent.
      reconcile(incoming.value, incoming.document, incoming.mods, nextContext.region);
    } else if (!oldContext || oldContext.profile !== nextContext.profile) {
      reconcile(incoming.value, incoming.document, incoming.mods, incoming.value.activeRegion);
    }
    incoming.intended = state.serialize(project(incoming.value, nextContext.region, incoming.mods));
    incoming.value.activeRegion = nextContext.region;
  }
  const writes = [];
  for (const plan of plans.values()) if (plan.value) {
    const metadata = Buffer.from(JSON.stringify(plan.value, null, 2) + "\n");
    if (metadata.length > 4 * 1024 * 1024) throw error("Independent Mod settings exceed the supported size limit.");
    if (!same(plan.source.bytes, metadata)) writes.push({file: filename(plan.ctx.profile), before: plan.source.bytes, after: metadata});
    if (!same(plan.original, plan.intended)) writes.push({file: plan.file, before: plan.original, after: plan.intended});
  }
  return writes;
}
function apply(writes, commit = () => {}) {
  const applied = [];
  try {
    for (const write of writes) {state.write(write.file, write.before, write.after); applied.push(write);}
    return commit();
  } catch (failure) {
    for (const write of applied.reverse()) {
      try {
        if (!same(state.checked(write.file), write.after)) throw error("Mod configuration changed during rollback; the recovery data was preserved.");
        if (write.before === null) fs.unlinkSync(write.file); else state.write(write.file, write.after, write.before);
      } catch (rollback) {failure.message += "; " + rollback.message; failure.code = "MOD_PROFILE_ROLLBACK";}
    }
    throw failure;
  }
}
function transition(before, next, commit) {return apply(plansFor(before, next), commit);}
function view(profile, selectedRegion, document) {
  const metadata = read(profile).value;
  return metadata && metadata.activeRegion !== selectedRegion ? project(metadata, selectedRegion, state.installed(profile, {requireVersion: true})) : document;
}
async function prepare(profile, selectedRegion, {guard, coreEnabled = true} = {}) {
  if (!SERVERS.includes(selectedRegion)) throw error("Select a supported Mod server profile.");
  await guard?.();
  const mods = state.installed(profile, {requireVersion: true});
  if (selectedRegion === "official") assertVanillaPlus(mods);
  else if (coreEnabled && mods.filter(mod => mod.required).length !== state.CORE_NAMES.length) throw error("Northstar core Mods are incomplete. Repair the selected client first.");
  const conf = {profileDirectory: profile, gamepath: profile, nsargs: "-profile .", northstarRegion: selectedRegion, modProfileServer: selectedRegion, independentServerMods: true};
  // resolveProfile(profile, -profile .) preserves the exact validated profile.
  const writes = plansFor(conf, conf);
  await guard?.();
  return apply(writes, () => ({...(selectedRegion === "official" ? assertOfficialReady(profile) : assertNorthstarReady(profile, selectedRegion, {coreEnabled})), independent: true, changed: writes.length > 0}));
}
function assertVanillaPlus(mods) {
  assertUniqueCore(mods);
  if (mods.filter(mod => mod.name === VANILLA_PLUS).length !== 1) throw error("VanillaPlus is missing. Install the official-server Mod support first.");
}
function assertOfficialReady(profile) {
  const result = state.assertReady(profile, "global", {coreEnabled: false}), mods = state.installed(profile, {requireVersion: true}), document = state.parse(state.checked(path.join(profile, "enabledmods.json")));
  assertVanillaPlus(mods);
  for (const mod of mods.filter(mod => mod.name === VANILLA_PLUS || state.CORE_NAMES.includes(mod.name))) {
    if (!own(document.states, mod.name) || !own(document.states[mod.name], mod.version) || state.enabled(document, mod.name, mod.version) !== (mod.name === VANILLA_PLUS)) throw error("Official-server Mod compatibility is not ready. Retry launch to repair it.");
  }
  return {...result, server: "official", coreNames: [VANILLA_PLUS], personalMods: mods.filter(mod => mod.name !== VANILLA_PLUS && !state.CORE_NAMES.includes(mod.name)).length};
}
function assertNorthstarReady(profile, selectedRegion, options) {
  const result = state.assertReady(profile, selectedRegion, options), document = state.parse(state.checked(path.join(profile, "enabledmods.json")));
  for (const mod of state.installed(profile).filter(mod => mod.name === VANILLA_PLUS)) if (state.enabled(document, mod.name, mod.version)) throw error("VanillaPlus must be disabled for Northstar community servers.");
  return result;
}
async function prepareShared(profile, selectedRegion, {guard, backupRoot, coreEnabled = true} = {}) {
  if (!SERVERS.includes(selectedRegion)) throw error("Select a supported Mod server profile.");
  await guard?.();
  const mods = state.installed(profile, {requireVersion: selectedRegion === "official"});
  assertUniqueCore(mods); if (selectedRegion === "official") assertVanillaPlus(mods);
  const result = await state.prepare(profile, selectedRegion === "cn" ? "cn" : "global", {coreEnabled: selectedRegion !== "official" && coreEnabled, backupRoot, guard});
  const file = path.join(profile, "enabledmods.json"), original = state.checked(file), document = state.parse(original);
  for (const mod of mods.filter(mod => mod.name === VANILLA_PLUS || selectedRegion === "official" && state.CORE_NAMES.includes(mod.name))) state.set(document, mod.name, mod.version, compatibleChoice(selectedRegion, mod, false));
  const intended = state.serialize(document), changed = !same(original, intended);
  if (changed) await state.writeGuarded(file, original, intended, {guard}); else await guard?.();
  return {...result, ...(selectedRegion === "official" ? assertOfficialReady(profile) : assertNorthstarReady(profile, selectedRegion, {coreEnabled})), changed: result.changed || changed, independent: false};
}
async function prepareOfficial(profile, {independent = false, ...options} = {}) {return independent ? prepare(profile, "official", options) : prepareShared(profile, "official", options);}
module.exports = {context, filename, read, choices, project, plansFor, apply, transition, view, prepare, prepareShared, prepareOfficial, assertOfficialReady, assertNorthstarReady, selectedServer, compatibleChoice, SERVERS, VANILLA_PLUS, VANILLA_PLUS_FOLDER};
