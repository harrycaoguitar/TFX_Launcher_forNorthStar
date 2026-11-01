const fs = require("fs");
const path = require("path");
const { app, ipcMain } = require("electron");

const win = require("../win");
const lang = require("../lang");

const console = require("./console");
const json = require("./json");
const normalize = value => require("../preferences").normalize(value, lang.defaultLocale);
const preferenceDefaults = Object.freeze({
	theme: "aurora", uiLanguage: lang.defaultLocale || "zh-CN", modSort: "added", exitAfterLaunch: false,
	northstarRegion: "cn", modProfileServer: "cn", vanillaModsEnabled: false, independentServerMods: false, nsupdate: true, originkill: false, nsargs: "-multiple",
	excludes: ["ns_startup_args.txt", "ns_startup_args_dedi.txt"]
});

ipcMain.handle("settings-restore-defaults", async () => {
	try {return {ok: true, settings: await saveAsync({...preferenceDefaults, excludes: [...preferenceDefaults.excludes]}, false)};}
	catch (error) {return settingsFailure(error);}
});

ipcMain.on("save-settings", async (event, obj) => {
	try { await saveAsync(obj, false); }
	catch (error) {
		win().send("changed-settings", {...settings});
		win().send("unknown-error", {message: error.message, stack: error.stack});
	}
})
ipcMain.handle("settings-save", async (_event, obj) => {
	try {return {ok: true, settings: await saveAsync(obj, false)};}
	catch (error) {return settingsFailure(error);}
});

// base settings
var settings = {
	gamepath: "",
	globalGamepath: "",
	chinaSourceGamepath: "",
	chinaInstallTarget: "",
	theme: "aurora",
	uiLanguage: lang.defaultLocale || "zh-CN",
	modSort: "added",
	exitAfterLaunch: false,
	northstarRegion: "cn",
	modProfileServer: "cn",
	vanillaModsEnabled: false,
	independentServerMods: false,
	nsupdate: true,
	originkill: false,
	nsargs: "-multiple",
	zip: "/northstar.zip",

	// these files won't be overwritten when installing/updating
	// Northstar, useful for config files
	excludes: [
		"ns_startup_args.txt",
		"ns_startup_args_dedi.txt"
	]
}

// creates the settings file with the base settings if it doesn't exist.
if (fs.existsSync("fold.json")) {
	let conf = json("fold.json");

	// validates fold.json
	if (! conf) {
		console.error("Unable to parse fold.json; using default settings.");
		conf = {};
	}

	settings = {
		...settings, ...conf
	}

	// Keep legacy fields readable; the dedicated UI field is the saved preference.
	settings.uiLanguage = lang.normalize(conf.uiLanguage || conf.lang || conf.forcedlang);
	delete settings.autolang;
	delete settings.forcedlang;
	delete settings.autoupdate;
	if (typeof settings.gamepath !== "string") settings.gamepath = "";
	settings.theme = normalize_theme(settings.theme);
	settings.modSort = normalize_mod_sort(settings.modSort);
	settings.exitAfterLaunch = settings.exitAfterLaunch === true;
	settings.northstarRegion = settings.northstarRegion === "global" ? "global" : "cn";
	settings.modProfileServer = ["official", "cn", "global"].includes(conf.modProfileServer) ? conf.modProfileServer : settings.northstarRegion;

	settings.zip = path.join(app.getPath("userData"), "Temp/northstar.zip");

	let args = path.join(settings.gamepath, "ns_startup_args.txt");
	if (! settings.nsargs && fs.existsSync(args)) {
		try { settings.nsargs = fs.readFileSync(args, "utf8"); } catch (_) {}
	}
} else {
	console.error(lang("general.missing_path"));
}
settings = normalize(settings);
lang.setLocale(settings.uiLanguage);

// as to not have to do the same one liner a million times, this
// function exists, as the name suggests, it simply writes the current
// settings to the disk.
//
// you can also pass a settings object to the function and it'll try and
// merge it together with the already existing settings
let saveDirect = (obj = {}, notify_renderer = true) => {
	let settings_content = normalize({
		...settings, ...obj
	});
	settings_content.theme = normalize_theme(settings_content.theme);
	settings_content.uiLanguage = lang.normalize(settings_content.uiLanguage);
	settings_content.modSort = normalize_mod_sort(settings_content.modSort);
	settings_content.exitAfterLaunch = settings_content.exitAfterLaunch === true;
	settings_content.northstarRegion = settings_content.northstarRegion === "global" ? "global" : "cn";

	let stringified_settings = JSON.stringify(settings_content);

	let settings_file = app.getPath("appData") + "/fold.json";

	// Rename an entirely written temporary file so readers never see a
	// partially written configuration.
	let temporary_file = settings_file + ".save-" + require("crypto").randomUUID() + ".tmp";
	try {
		fs.writeFileSync(temporary_file, stringified_settings, {flag: "wx"});
		if (fs.readFileSync(temporary_file, "utf8") !== stringified_settings) throw Error("Settings verification failed");
		fs.renameSync(temporary_file, settings_file);
	} finally {
		try { if (fs.existsSync(temporary_file)) fs.unlinkSync(temporary_file); } catch (_) {}
	}

	// set the settings obj for the main process
	settings = settings_content;
	lang.setLocale(settings.uiLanguage);
	
	if (notify_renderer) {
		win().send("changed-settings", obj);
	}
	return {...settings};
}

function settingsFailure(error) {return {ok: false, error: error.message || String(error), ...(error.code ? {code: error.code} : {}), settings: {...settings}};}
function requiresTransition(previous, next) {
	return previous.northstarRegion !== next.northstarRegion || previous.modProfileServer !== next.modProfileServer || previous.vanillaModsEnabled !== next.vanillaModsEnabled || previous.independentServerMods !== next.independentServerMods ||
		(previous.independentServerMods || next.independentServerMods) && (previous.gamepath !== next.gamepath || previous.nsargs !== next.nsargs);
}
let savingContext = false;
async function saveAsync(obj = {}, notify_renderer = true) {
	// Legacy callers select a Northstar region without the newer library field.
	// Keep their selection coherent while honoring an explicit official choice.
	if (Object.prototype.hasOwnProperty.call(obj, "northstarRegion") && !Object.prototype.hasOwnProperty.call(obj, "modProfileServer")) obj = {...obj, modProfileServer: obj.northstarRegion === "global" ? "global" : "cn"};
	const previous = {...settings}, next = normalize({...settings, ...obj});
	if (!requiresTransition(previous, next)) return saveDirect(obj, notify_renderer);
	if (savingContext) throw Object.assign(Error("Another server selection is being saved. Please retry."), {code: "busy"});
	savingContext = true;
	try {
		const gate = require("./dds-operation-gate"), mods = require("./mods"), packages = require("./packages");
		if (gate.busy || mods.sharedImportBusy || mods.isImportBusy() || packages.activeCount > 0) throw Object.assign(Error("An installation or launch is in progress. Finish it before changing server Mod settings."), {code: "busy"});
		return await gate.run("server-mod-settings", async () => {
			const stopped = await require("./is_running").snapshot();
			if (!stopped?.ok) throw Object.assign(Error("Unable to check whether the game is running. Please retry."), {code: "PROCESS_QUERY"});
			const rootTools = require("./game-roots");
			for (const gameRoot of rootTools.serverTransitionRoots(previous, next)) {
				if (rootTools.hasGame(stopped, gameRoot)) throw Object.assign(Error("Close Titanfall 2 in the selected game folder before changing server Mod settings."), {code: "GAME_RUNNING"});
			}
			if (settings.gamepath !== previous.gamepath || settings.globalGamepath !== previous.globalGamepath || settings.nsargs !== previous.nsargs || settings.northstarRegion !== previous.northstarRegion || settings.modProfileServer !== previous.modProfileServer || settings.vanillaModsEnabled !== previous.vanillaModsEnabled || settings.independentServerMods !== previous.independentServerMods) throw Object.assign(Error("The game profile changed. Please retry."), {code: "PROFILE_CHANGED"});
			if (mods.sharedImportBusy || mods.isImportBusy() || packages.activeCount > 0) throw Object.assign(Error("A Mod is being installed. Please retry when it completes."), {code: "busy"});
			const result = require("./server-mod-profiles").transition(previous, next, () => saveDirect(obj, false));
			// Acknowledgements follow the durable commit. Refresh failures cannot
			// turn a successful disk commit into a misleading failed save.
			try {win().send("changed-settings", obj); ipcMain.emit("gui-getmods");} catch (_) {}
			return result;
		});
	} finally {savingContext = false;}
}
let save = (obj = {}, notify_renderer = true) => requiresTransition(settings, normalize({...settings, ...obj})) ? saveAsync(obj, notify_renderer) : saveDirect(obj, notify_renderer);

// Never allow a stale or edited config value to select an undefined palette.
function normalize_theme(value) {
	const themes = ["aurora", "abyss", "nebula", "sakura", "ember", "grove", "sandstone", "graphite", "glacier", "mist"];
	return themes.includes(value) ? value : "aurora";
}
function normalize_mod_sort(value) {
	return ["added", "name", "enabled"].includes(value) ? value : "added";
}

// sets `key` in `settings` to `value`
let set = (key, value) => {
	if (["northstarRegion", "modProfileServer", "vanillaModsEnabled", "independentServerMods"].includes(key) || settings.independentServerMods && ["gamepath", "nsargs"].includes(key)) throw Error("Use settings.saveAsync to change the selected server or independent Mod profile.");
	settings[key] = value;
}

// returns up-to-date `settings`, along with `set()` and `save()`
let export_func = () => {
	return {
		...settings,

		set,
		save,
		saveAsync
	}
}

// add properties from `settings` to `export_func`, this is just for
// backwards compatibility, and they really shouldn't be relied on,
// this'll likely be removed at some point
for (let i in settings) {
	export_func[i] = settings[i];
}

module.exports = export_func;
