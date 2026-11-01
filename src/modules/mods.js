"use strict";

// TFX mod library. The profile is the source of truth; scans never repair it.
// Existing renderer field names remain an interface compatibility boundary.
const path = require("path"), fs = require("fs-extra"), crypto = require("crypto");
const repairJSON = require("jsonrepair");
const {app, ipcMain, dialog} = require("electron");
const settings = require("./settings");
const profileResolver = require("./northstar-region");
const {splitArguments} = require("./launch-session");
const stateFile = require("./mod-enabled-state");
const serverProfiles = require("./server-mod-profiles");
const AddedTimes = require("./mod-added-times");
const {importLocalMod, messages: importMessages} = require("./local-mod-import");
const log = require("./console"), getWindow = require("../win"), translate = require("../lang");
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024, MAX_LIBRARY_ITEMS = 12000;
const emptyLibrary = () => ({all: [], enabled: [], disabled: []});
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value : fallback;
const identityOf = item => item.package ? `package:${item.package.author}/${item.package.package_name}` : `mod:${item.name}`;
const failure = error => ({ok: false, error: error.message || String(error), ...(error.code ? {code: error.code} : {})});
const coreError = () => Object.assign(Error("北极星核心组件必须保持启用。"), {code: "CORE_REQUIRED"});

function within(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
// Junctions and symlinks cannot become discovered entries or deletion targets.
function regularPath(root, candidate, kind) {
  if (!within(root, candidate)) throw Error("Mod path is outside the selected game folder.");
  let current = path.resolve(root), stat = fs.lstatSync(current);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error("The game folder must be a regular directory.");
  const parts = path.relative(current, path.resolve(candidate)).split(path.sep).filter(Boolean);
  for (const [index, component] of parts.entries()) {
    current = path.join(current, component);
    try {stat = fs.lstatSync(current);} catch (error) {if (error.code === "ENOENT") return null; throw error;}
    if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())) throw Error("Mod paths cannot contain links or non-directory parents.");
  }
  if (kind === "directory" && !stat.isDirectory()) return null;
  if (kind === "file" && !stat.isFile()) return null;
  return stat;
}
function readDefinition(context, filename) {
  const stat = regularPath(context.root, filename, "file");
  if (!stat || stat.size > MAX_DOCUMENT_BYTES) return null;
  const bytes = fs.readFileSync(filename), body = bytes.toString("utf8");
  if (!Buffer.from(body).equals(bytes)) return null;
  try {const data = JSON.parse(repairJSON(body.replace(/^\uFEFF/, ""))); return isObject(data) ? data : null;}
  catch (_) {return null;}
}
function directories(context, parent) {
  if (!regularPath(context.root, parent, "directory")) return [];
  return fs.readdirSync(parent, {withFileTypes: true}).filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).map(entry => path.join(parent, entry.name));
}
function profileContext(options = {}) {
  const saved = settings(), server = serverProfiles.selectedServer(saved);
  let gamePath;
  try {gamePath = options.gamepath === undefined ? require("./game-roots").gameRootForServer(saved, server) : options.gamepath;}
  catch (_) {return null;}
  if (typeof gamePath !== "string" || !gamePath.trim() || !fs.existsSync(gamePath)) return null;
  const root = fs.realpathSync(gamePath);
  const profile = options.profileDirectory ? path.resolve(options.profileDirectory) : profileResolver.resolveProfile(root, splitArguments(saved.nsargs || ""));
  if (!within(root, profile)) throw Error("The selected Northstar profile is outside the game folder.");
  regularPath(root, profile, "directory");
  if (!regularPath(root, path.join(root, "NorthstarLauncher.exe"), "file")) return null;
  return {gamePath, root, profile, mods: path.join(profile, "mods"), packages: path.join(profile, "packages"), state: path.join(profile, "enabledmods.json")};
}
function packageMetadata(context, folder) {
  const match = /^([^-]+)-([^-]+)-(.+)$/.exec(path.basename(folder));
  const manifest = readDefinition(context, path.join(folder, "manifest.json"));
  if (!match || !manifest || !text(manifest.name) || !text(manifest.version_number)) return null;
  const icon = path.join(folder, "icon.png");
  return {author: match[1], package_name: match[2], version: match[3], package_path: folder, manifest,
    has_mods: Boolean(regularPath(context.root, path.join(folder, "mods"), "directory")),
    has_plugins: Boolean(regularPath(context.root, path.join(folder, "plugins"), "directory")),
    icon: regularPath(context.root, icon, "file") ? icon : false};
}
function describeChild(context, folder, owner, states, times) {
  const definition = readDefinition(context, path.join(folder, "mod.json"));
  if (!definition) return null;
  const name = text(definition.Name, "unknown"), manifest = readDefinition(context, path.join(folder, "manifest.json")), stateVersion = text(definition.Version, "unknown");
  const item = {name, author: owner ? owner.author : text(definition.Author, false),
    version: owner ? owner.version : stateVersion === "unknown" ? text(manifest?.version_number, "unknown") : stateVersion,
    stateVersion, description: text(definition.Description), folder_name: path.basename(folder), folder_path: folder, package: owner || false};
  if (manifest && text(manifest.name)) item.manifest_name = manifest.name;
  const authorFile = path.join(folder, "thunderstore_author.txt"), authorStat = regularPath(context.root, authorFile, "file");
  if (authorStat && authorStat.size <= 4096) item.author = fs.readFileSync(authorFile, "utf8");
  const vanillaCore = name === serverProfiles.VANILLA_PLUS && path.resolve(folder).toLowerCase() === path.resolve(context.packages, "NachosChipeados-VanillaPlus-2.5.1", "mods", serverProfiles.VANILLA_PLUS_FOLDER).toLowerCase();
  item.required = vanillaCore || stateFile.isRequired(item, context.profile) || stateFile.CORE_NAMES.some(core => path.resolve(folder).toLowerCase() === path.resolve(context.mods, core).toLowerCase());
  item.disabled = !stateFile.enabled(states, name, stateVersion);
  item.addedAt = times.get(context.gamePath, identityOf(item), owner ? owner.package_path : folder);
  return item;
}
function scanLibrary(context, states, times) {
  if (!context) return emptyLibrary();
  const all = [];
  const append = (directory, owner) => {
    const children = [];
    for (const folder of directories(context, directory)) {
      try {const item = describeChild(context, folder, owner, states, times); if (item) {all.push(item); children.push(item);}}
      catch (error) {log.error("Skipped invalid mod entry:", folder, error.message);}
      if (all.length > MAX_LIBRARY_ITEMS) throw Error("The installed mod library exceeds the supported item limit.");
    }
    if (owner) {const names = children.map(item => item.name); for (const child of children) child.packaged_mods = names;}
  };
  append(context.mods, null);
  for (const folder of directories(context, context.packages)) {
    try {
      const owner = packageMetadata(context, folder);
      if (!owner) continue;
      const before = all.length;
      if (owner.has_mods) append(path.join(folder, "mods"), owner);
      if (all.length === before && owner.has_plugins) {
        const item = {name: text(owner.manifest.name, owner.package_name), author: owner.author, version: owner.version, stateVersion: "unknown",
          description: text(owner.manifest.description), folder_name: path.basename(folder), folder_path: folder, package: owner,
          manifest_name: owner.manifest.name, packaged_mods: [], required: false, disabled: false, pluginOnly: true, stateControl: false};
        item.addedAt = times.get(context.gamePath, identityOf(item), folder); all.push(item);
      }
    }
    catch (error) {log.error("Skipped invalid mod package:", folder, error.message);}
  }
  const enabled = all.filter(item => !item.disabled), disabled = all.filter(item => item.disabled);
  return {all: [...enabled, ...disabled], enabled, disabled};
}
function createObserver(refresh) {
  const handles = new Map();
  let profile = null, window = null, dirty = false, timer = null;
  const visible = () => {const current = getWindow(); return !current.isDestroyed?.() && !current.isMinimized?.() && current.isVisible?.() !== false;};
  const cancelTimer = () => {clearTimeout(timer); timer = null;};
  const flushSoon = () => {
    cancelTimer(); if (!dirty || !visible()) return;
    timer = setTimeout(() => {timer = null; if (!dirty || !visible()) return; dirty = false; refresh();}, 300); timer.unref?.();
  };
  const detach = scope => {handles.get(scope)?.close(); handles.delete(scope);};
  const close = () => {cancelTimer(); for (const scope of [...handles.keys()]) detach(scope); dirty = false;};
  const relevant = (scope, filename) => {
    if (!filename) return true;
    const parts = String(filename).replace(/\\/g, "/").toLowerCase().split("/").filter(Boolean);
    if (scope === "profile") return parts.length === 1 && ["mods", "packages", "enabledmods.json"].includes(parts[0]);
    if (parts.some(part => ["logs", "log", "pdata", "cache", "temp", "backups", "backup"].includes(part))) return false;
    return !/\.(?:log|tmp|bak|dmp)$/.test(parts.at(-1) || "");
  };
  function observe(context) {
    const selected = context?.profile || null;
    if (selected !== profile) {close(); profile = selected;}
    if (!context) return;
    const currentWindow = getWindow();
    if (currentWindow !== window && typeof currentWindow.on === "function") {
      for (const event of ["show", "restore", "focus"]) window?.removeListener?.(event, flushSoon);
      window = currentWindow; for (const event of ["show", "restore", "focus"]) window.on(event, flushSoon);
    }
    for (const [scope, directory] of [["profile", context.profile], ["mods", context.mods], ["packages", context.packages]]) {
      if (!regularPath(context.root, directory, "directory")) {detach(scope); continue;}
      if (handles.has(scope)) continue;
      try {
        const handle = fs.watch(directory, {recursive: scope !== "profile"}, (event, filename) => {
          if (!relevant(scope, filename)) return;
          if (scope === "profile" && event === "rename" && ["mods", "packages"].includes(String(filename || "").toLowerCase())) detach(String(filename).toLowerCase());
          dirty = true; flushSoon();
        });
        handles.set(scope, handle);
        handle.on("error", error => {if (handles.get(scope) === handle) detach(scope); log.error("Mod directory observer stopped:", error.message);});
      } catch (error) {log.error("Unable to observe mod directory:", error.message);}
    }
  }
  return {observe, acknowledge: () => {dirty = false; cancelTimer();}, close};
}

const addedTimes = new AddedTimes(path.join(app.getPath("userData"), "mod-added-times.json"));
const observer = createObserver(() => {try {getWindow().send("mods", manager.list());} catch (error) {log.error("Mod refresh failed:", error.message);}});
let importing = false, mutationDepth = 0;
const manager = {};
function remember() {try {addedTimes.flush();} catch (error) {log.error("Unable to save mod added times:", error.message);}}
function assertWritable(options={}) {
  if(manager.sharedImportBusy&&!options.sharedImport || require("./dds-operation-gate").busy&&!mutationDepth) throw Object.assign(Error("另一个安装或启动操作正在进行，请完成后再修改 Mod。"),{code:"busy"});
}
async function guardedMutation(action, options={}) {
  assertWritable(options);
  const context = profileContext();
  const selected = {gamePath: context?.root, cnGamePath: settings().gamepath, globalGamePath: settings().globalGamepath, arguments: settings().nsargs || "", region: serverProfiles.selectedServer(settings()), independent: settings().independentServerMods};
  const guard = async () => {
    const current = settings();
    if ((profileContext()?.root || null) !== selected.gamePath || current.gamepath !== selected.cnGamePath || current.globalGamepath !== selected.globalGamePath || (current.nsargs || "") !== selected.arguments || serverProfiles.selectedServer(current) !== selected.region || current.independentServerMods !== selected.independent || !context || profileContext()?.profile !== context.profile) throw Error("The selected game profile changed; retry your action.");
    const snapshot = await require("./is_running").snapshot();
    if (!snapshot.ok) throw Error("Unable to verify whether the game is running. Please retry.");
    if (require("./game-roots").hasGame(snapshot, context?.root)) throw Error("Please close the game in the selected folder before changing installed mods.");
    if ((profileContext()?.root || null) !== selected.gamePath || settings().gamepath !== selected.cnGamePath || settings().globalGamepath !== selected.globalGamePath || (settings().nsargs || "") !== selected.arguments || serverProfiles.selectedServer(settings()) !== selected.region || settings().independentServerMods !== selected.independent) throw Error("The selected game profile changed; retry your action.");
  };
  return require("./dds-operation-gate").run("mod-library", async () => {await guard();mutationDepth++;try{const conf=settings();if(conf.independentServerMods)require("./server-mod-profiles").transition(conf,conf);return action(guard);}finally{mutationDepth--;}});
}
async function guardedResponse(action) {
  try {return await guardedMutation(action);} catch (error) {const result = failure(error); getWindow().log(result.error); return result;}
}
manager.list = function list(options = {}) {
  const context = profileContext(options);
  let document = options.states?.format ? options.states : stateFile.parse(options.states || (context ? stateFile.checked(context.state) : null));
  if (context && options.states === undefined && settings().independentServerMods) document = serverProfiles.view(context.profile, serverProfiles.selectedServer(settings()), document);
  const library = scanLibrary(context, document, addedTimes);
  if (!options.readOnly) {
    manager.path = context?.mods || ""; manager.modfile.file = context?.state || null;
    observer.observe(context); observer.acknowledge(); remember();
  }
  return library;
};
manager.get = name => manager.list({readOnly: true}).all.find(item => item.name === name) || false;
function stateSelections(request, invert) {
  if (!isObject(request)) throw Error("Specify installed mod names and an explicit enabled state.");
  const batch = Object.prototype.hasOwnProperty.call(request, "selections");
  if (batch && (invert || Object.prototype.hasOwnProperty.call(request, "names") || !Array.isArray(request.selections) || !request.selections.length || request.selections.length > MAX_LIBRARY_ITEMS)) throw Error("Specify one valid batch of mod selections.");
  const selections = batch ? request.selections : [request]; let namesCount = 0;
  for (const selection of selections) {
    if (!isObject(selection) || typeof selection.enabled !== "boolean" || !Array.isArray(selection.names) || !selection.names.length || selection.names.some(name => typeof name !== "string" || !name.trim() || /[\u0000-\u001f]/.test(name)) || (namesCount += selection.names.length) > MAX_LIBRARY_ITEMS) throw Error("Specify installed mod names and an explicit enabled state.");
    if (selection.package && (!isObject(selection.package) || ["author", "package_name", "version"].some(field => typeof selection.package[field] !== "string" || !selection.package[field].trim() || /[\u0000-\u001f]/.test(selection.package[field])))) throw Error("Specify a valid installed package identity.");
  }
  return selections;
}
function projectLibrary(library, document) {
  for (const item of library.all) if (item.stateControl !== false) item.disabled = !stateFile.enabled(document, item.name, item.stateVersion);
  const enabled = library.all.filter(item => !item.disabled), disabled = library.all.filter(item => item.disabled);
  return {all: [...enabled, ...disabled], enabled, disabled};
}
function persistSelections(context, original, intended) {
  stateFile.write(context.state, original, intended);
  if (!settings().independentServerMods) return;
  try {require("./server-mod-profiles").transition(settings(), settings());}
  catch (error) {
    // Enabled choices and their per-server snapshot commit together. A failed
    // metadata write cannot leave a successful-looking switch behind.
    if (stateFile.checked(context.state)?.equals(intended)) {
      if (original === null) fs.unlinkSync(context.state); else stateFile.write(context.state, intended, original);
    }
    throw error;
  }
}
function setSelection(request, invert = false) {
  let context;
  try {
    assertWritable();
    if(settings().independentServerMods)require("./server-mod-profiles").transition(settings(),settings());
    const selections = stateSelections(request, invert);
    context = profileContext(); if (!context) throw Error("Select an installed Northstar game folder first.");
    const original = stateFile.checked(context.state), document = stateFile.parse(original), library = scanLibrary(context, document, addedTimes), operations = new Map(), byName = new Map();
    for (const item of library.all) {if (!byName.has(item.name)) byName.set(item.name, []); byName.get(item.name).push(item);}
    // Validate the entire selection against one snapshot. No choice is changed
    // in memory or on disk until every package, core and state-key check passes.
    for (const selection of selections) {
      const selected = new Set(selection.names);
      for (const name of selected) if (!byName.has(name)) throw Error("Mod is no longer installed: " + name);
      const entries = [...selected].flatMap(name => byName.get(name)).filter(item => !selection.package || item.package && item.package.author === selection.package.author && item.package.package_name === selection.package.package_name && item.package.version === selection.package.version);
      if (!entries.length || [...selected].some(name => !entries.some(item => item.name === name))) throw Error("The selected mod package is no longer installed.");
      if (entries.some(item => item.stateControl === false)) throw Object.assign(Error("Plugin packages do not support a mod enable switch; remove the package to uninstall them."), {code: "PLUGINS_NO_SWITCH"});
      if (selection.package && entries.some(item => byName.get(item.name).some(other => (document.format === "flat" || other.stateVersion === item.stateVersion) && other.folder_path !== item.folder_path))) throw Object.assign(Error("The game stores this mod state once for multiple packages; remove the duplicate before changing its state."), {code: "AMBIGUOUS_MOD"});
      if ((!selection.enabled || invert) && entries.some(item => item.required)) throw coreError();
      const server = serverProfiles.selectedServer(settings());
      if (selection.enabled && entries.some(item => server === "official" ? stateFile.CORE_NAMES.includes(item.name) : item.name === serverProfiles.VANILLA_PLUS)) throw Object.assign(Error("This core component is incompatible with the selected server. TFX manages its enabled state automatically."), {code: "CORE_REQUIRED"});
      for (const item of entries) {
        const key = JSON.stringify(document.format === "flat" ? [item.name] : [item.name, item.stateVersion]);
        const before = stateFile.enabled(document, item.name, item.stateVersion), after = invert ? !before : selection.enabled;
        if (operations.has(key) && operations.get(key).after !== after) throw Object.assign(Error("The batch requests conflicting states for the same game mod setting."), {code: "STATE_CONFLICT"});
        operations.set(key, {name: item.name, version: item.stateVersion, before, after});
      }
    }
    let changed = false;
    for (const operation of operations.values()) if (operation.before !== operation.after) {stateFile.set(document, operation.name, operation.version, operation.after); changed = true;}
    if (changed) persistSelections(context, original, stateFile.serialize(document));
    return {ok: true, mods: projectLibrary(library, document)};
  } catch (error) {
    const result = failure(error); try {if (context) result.mods = scanLibrary(context, stateFile.parse(stateFile.checked(context.state)), addedTimes);} catch (_) {} return result;
  }
}
manager.setState = request => setSelection(request);
manager.setStateAsync = request => guardedResponse(() => setSelection(request));
manager.modfile = {
  gen() {
    try{assertWritable();}catch(error){return failure(error);}
    if(settings().independentServerMods)require("./server-mod-profiles").transition(settings(),settings());
    const context = profileContext(); if (!context) return failure(Error("Select an installed Northstar game folder first."));
    const original = stateFile.checked(context.state), document = stateFile.parse(original), library = scanLibrary(context, document, addedTimes);
    for (const item of library.all) if (item.stateControl !== false) stateFile.set(document, item.name, item.stateVersion, serverProfiles.compatibleChoice(serverProfiles.selectedServer(settings()), item, item.required || !item.disabled));
    const intended = stateFile.serialize(document); if (!original || !original.equals(intended)) persistSelections(context, original, intended);
    return {ok: true, mods: scanLibrary(context, document, addedTimes)};
  },
  set(name, enabled) {return setSelection({names: [name], enabled});}, enable(name) {return this.set(name, true);}, disable(name) {return this.set(name, false);},
  toggle(name) {return setSelection({names: [name], enabled: true}, true);}, get(name) {const item = manager.get(name); return item ? !item.disabled : true;}
};
manager.toggle = function toggle(name, quiet = false) {
  let names = [name];
  if (name === "allmods") {
    const library = manager.list({readOnly: true}), protectedNames = new Set(library.all.filter(item => item.required).map(item => item.name));
    names = [...new Set(library.all.filter(item => item.stateControl !== false && !protectedNames.has(item.name)).map(item => item.name))]; if (!names.length) return {ok: true, mods: library};
  }
  const result = setSelection({names, enabled: true}, true);
  if (result.ok) {getWindow().send("mods", result.mods); if (!quiet) log.ok(translate(name === "allmods" ? "cli.mods.toggled_all" : "cli.mods.toggled"));} else getWindow().log(result.error);
  return result;
};
function inspectRemovalTree(context, folder, budget = {count: 0}) {
  if (!regularPath(context.root, folder, "directory")) throw Error("The mod folder has moved or no longer exists.");
  for (const entry of fs.readdirSync(folder, {withFileTypes: true})) {
    if (++budget.count > 250000) throw Error("The mod removal tree exceeds the supported item limit.");
    if (entry.isSymbolicLink()) throw Error("Mod removal refused: the selected folder contains a link.");
    if (entry.isDirectory()) inspectRemovalTree(context, path.join(folder, entry.name), budget); else if (!entry.isFile()) throw Error("Mod removal refused: the selected folder contains a special file.");
  }
}
manager.remove = function remove(name) {
  const moved = []; let context, trash, committed = false;
  try {
    assertWritable();
    context = profileContext(); if (!context) throw Error("Select an installed Northstar game folder first.");
    const library = manager.list({readOnly: true});
    let selected;
    if (name === "allmods") selected = library.all.filter(item => !item.required);
    else {
      const request = typeof name === "string" ? {name} : name;
      if (!isObject(request) || typeof request.name !== "string") throw Error("Specify an installed mod to remove.");
      selected = library.all.filter(item => item.name === request.name && (!request.folder_name || item.folder_name === request.folder_name) && (!request.package || item.package && item.package.author === request.package.author && item.package.package_name === request.package.package_name && item.package.version === request.package.version));
      const destinations = new Set(selected.map(item => item.package?.package_path || item.folder_path));
      if (destinations.size > 1) throw Object.assign(Error("Multiple installed mods have this name; select the specific package before removing it."), {code: "AMBIGUOUS_MOD"});
    }
    if (selected.some(item => item.required)) throw coreError(); if (!selected.length) return name === "allmods" ? true : false;
    const targets = [...new Set(selected.map(item => item.package ? item.package.package_path : item.folder_path))];
    if (library.all.some(item => item.required && targets.some(target => within(target, item.folder_path)))) throw coreError();
    for (const folder of targets) inspectRemovalTree(context, folder);
    trash = path.join(context.profile, ".tfx-remove-" + crypto.randomBytes(10).toString("hex")); fs.mkdirSync(trash);
    for (const [index, original] of targets.entries()) {
      inspectRemovalTree(context, original); const staged = path.join(trash, String(index)); fs.renameSync(original, staged); moved.push({original, staged});
    }
    committed = true;
    // Detach the full selection before cleanup; failed detachment restores it.
    try {for (const item of moved) fs.rmSync(item.staged, {recursive: true}); fs.rmdirSync(trash); trash = null;}
    catch (error) {getWindow().log("Mod removed; cleanup files remain at " + trash + ": " + error.message);}
    const affected = library.all.filter(item => targets.some(target => within(target, item.folder_path)));
    const retainedIdentities = new Set(library.all.filter(item => !targets.some(target => within(target, item.folder_path))).map(identityOf));
    for (const item of affected) if (!retainedIdentities.has(identityOf(item))) addedTimes.forget(context.gamePath, identityOf(item)); remember();
    getWindow().send("mods", manager.list());
    for (const item of affected) getWindow().send("removed-mod", {name: item.name, manifest_name: item.manifest_name || item.package?.manifest.name || null});
    log.ok(translate("cli.mods.removed")); return true;
  } catch (error) {
    if (!committed) {
      for (const item of moved.reverse()) {try {if (fs.existsSync(item.staged) && !fs.existsSync(item.original)) fs.renameSync(item.staged, item.original);} catch (restoreError) {error.message += "; recovery retained at " + trash + ": " + restoreError.message;}}
      if (trash) {try {fs.rmdirSync(trash);} catch (_) {}}
    }
    getWindow().log(error.message); return committed ? true : failure(error);
  }
};
manager.removeAsync = name => guardedResponse(() => manager.remove(name));
manager.isImportBusy = () => importing;
manager.sharedImportBusy = false;
manager.install = async function install(source, options = {}) {
  const name = typeof source === "string" ? path.basename(source) : ""; let ownsImport = false;
  try {
    if (importing || manager.sharedImportBusy && !options.sharedImport) throw Object.assign(Error("另一个模组正在导入，请等待完成后再试。"), {code: "busy"}); importing = true; ownsImport = true;
    const context = profileContext(); if (!context) throw Object.assign(Error(importMessages.game), {code: "game"});
    const isolated = process.argv.some(value => value.startsWith("--fold-profile=") || value.startsWith("--neo-profile="));
    const cacheRoot = isolated ? path.join(app.getPath("userData"), "LocalModImports") : path.join(path.parse(context.root).root, "TFX-cache", "LocalModImports");
    getWindow().log(translate("gui.mods.installing"));
    const result = await guardedMutation(guard => importLocalMod(source, {gamePath: context.root, profileDirectory: context.profile, cacheRoot, guard, author: options.author, destname: options.destname, onProgress: options.onProgress, preparedSnapshot:Boolean(options.sharedImport&&options.preparedSnapshot)}),{sharedImport:options.sharedImport}); result.source = "local";if(options.sharedImport)result.importOrigin="unified";
    getWindow().send("installed-mod", result); getWindow().log(translate("gui.mods.installed_mod")); getWindow().send("mods", manager.list()); return result;
  } catch (error) {
    const result = {...failure(error), source: "local", name, code: error.code || "io", ...(options.sharedImport?{importOrigin:"unified"}:{})}; log.error("Local mod import failed:", result.error); getWindow().log(result.error); getWindow().send("failed-mod", result); return result;
  } finally {if (ownsImport) importing = false; getWindow().send("set-buttons", !importing && !manager.sharedImportBusy);}
};
ipcMain.on("gui-getmods", () => {try {getWindow().send("mods", manager.list());} catch (error) {log.error("Mod listing failed:", error.message); getWindow().log(error.message);}});
ipcMain.handle("set-mod-state", (_event, request) => manager.setStateAsync(request));
ipcMain.on("toggle-mod", (_event, name) => guardedResponse(() => manager.toggle(name)));
ipcMain.on("remove-mod", (_event, name) => manager.removeAsync(name));
ipcMain.on("install-from-path", (_event, source) => manager.install(source));
ipcMain.on("no-internet", () => getWindow().send("no-internet"));
ipcMain.on("install-mod", async () => {
  try {
    const english = translate.getLocale() === "en-US";
    const chosen = await dialog.showOpenDialog({title: english ? "Import Northstar mod ZIP" : "导入北极星模组 ZIP", properties: ["openFile"], filters: [{name: "ZIP", extensions: ["zip"]}, {name: english ? "All files" : "所有文件", extensions: ["*"]}]});
    if (chosen.filePaths?.length) await manager.install(chosen.filePaths[0]); else getWindow().send("set-buttons", true);
  } catch (error) {getWindow().send("failed-mod", {...failure(error), source: "local", name: "", code: "dialog"}); getWindow().send("set-buttons", true);}
});
app.on("before-quit", () => {observer.close(); remember();});
module.exports = manager;
