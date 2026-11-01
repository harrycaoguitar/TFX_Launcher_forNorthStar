"use strict";

// Compatibility boundary for the existing renderer. The catalog, download,
// validation and transactional installation are owned by TFX modules.
const path = require("path");
const fs = require("fs");
const {app, ipcMain, net} = require("electron");
const settings = require("./settings");
const region = require("./northstar-region");
const {splitArguments} = require("./launch-session");
const running = require("./is_running");
const gate = require("./dds-operation-gate");
const win = require("../win");
const lang = require("../lang");
const catalog = require("./thunderstore");
const {createInstaller, inspectPackage, listPackages, formatName, splitName, removePackageSync, trustedDownloadURL, downloadPackage} = require("./thunderstore-install");
const {createRequest} = require("./thunderstore-transport");
const downloadRequest = createRequest(net);

function selection() {
	const conf = settings();
	let gamePath;
	try {gamePath = require("./game-roots").gameRootForServer(conf, require("./server-mod-profiles").selectedServer(conf));}
	catch (error) {throw Object.assign(new Error(error.message), {code: error.code || "GAME_PATH"});}
	const launcher = path.join(gamePath, "NorthstarLauncher.exe");
	let launcherStat; try {launcherStat = fs.lstatSync(launcher);} catch (_) {}
	if (!launcherStat?.isFile() || launcherStat.isSymbolicLink()) throw Object.assign(new Error("Install the selected Northstar client from the Play page before installing mods."), {code: "CLIENT_MISSING"});
	return {gamePath: path.resolve(gamePath), profileDirectory: region.resolveProfile(gamePath, splitArguments(conf.nsargs || "")), region: require("./server-mod-profiles").selectedServer(conf), independentServerMods: conf.independentServerMods === true};
}
function profilePath() {
	return selection().profileDirectory;
}
function send(channel, value) {try {win().send(channel, value);} catch (_) {}}
async function guard(captured) {
	const current = selection();
	if (current.gamePath.toLowerCase() !== captured.gamePath.toLowerCase() || current.profileDirectory.toLowerCase() !== captured.profileDirectory.toLowerCase() || current.region !== captured.region || current.independentServerMods !== captured.independentServerMods) throw Object.assign(new Error("The selected game profile changed. Retry installation."), {code: "PROFILE_CHANGED"});
	const snapshot = await running.snapshot();
	const after = selection();
	if (after.gamePath.toLowerCase() !== captured.gamePath.toLowerCase() || after.profileDirectory.toLowerCase() !== captured.profileDirectory.toLowerCase() || after.region !== captured.region || after.independentServerMods !== captured.independentServerMods) throw Object.assign(new Error("The selected game profile changed. Retry installation."), {code: "PROFILE_CHANGED"});
	if (!snapshot?.ok) throw Object.assign(new Error("Unable to check the game process. Retry after the game is closed."), {code: "PROCESS_QUERY"});
	if (require("./game-roots").hasGame(snapshot, captured.gamePath)) throw Object.assign(new Error("Close Titanfall 2 in the selected game folder before changing installed mods."), {code: "GAME_RUNNING"});
}
const installer = createInstaller({
	profile: selection,
	cacheRoot: () => fs.existsSync("D:/") ? "D:/TFX-Launcher-Data/thunderstore" : path.join(app.getPath("userData"), "thunderstore"),
	planInstall: (request, options) => catalog.planInstall(request, options),
	download: (url, destination, options) => downloadPackage(url, destination, {...options, request:downloadRequest}),
	guard,
	commit: action => gate.run("thunderstore-mods", () => {
		const conf = settings();
		if (conf.independentServerMods) require("./server-mod-profiles").transition(conf, conf);
		return action();
	}),
	progress: value => send("pkg-progress", value),
	confirmPlugins: packages => win().confirm(`${lang("gui.mods.confirm_plugins.title")}\n${packages.map(item => item.id).join("\n")}\n\n${lang("gui.mods.confirm_plugins.description")}`)
});

const packages = {
	get activeCount() {return installer.activeCount;},
	get path() {return path.join(profilePath(), "packages");},
	format_name: formatName,
	split_name: splitName,
	verify: directory => inspectPackage(directory).verification,
	list: (directory, noFunctions) => listPackages(directory || packages.path, noFunctions ? null : item => packages.remove(item.author, item.package_name, item.version)),
	remove: (author, package_name, version) => removePackageSync(packages.path, {author, package_name, version}),
	removeAsync: (author, package_name, version) => installer.remove({author, package_name, version}),
	install: async (url, author, package_name, version) => {
		if (!trustedDownloadURL(url)) throw Object.assign(new Error("Unsupported Thunderstore download address."), {code: "DOWNLOAD_URL"});
		return installer.install({author, package_name, version});
	},
	cancel: name => installer.cancel(name)
};
ipcMain.on("install-from-url", async (_event, url, author, package_name, version) => {
	try {
		const result = await packages.install(url, author, package_name, version);
		send("installed-mod", result);
		ipcMain.emit("gui-getmods");
	} catch (error) {
		if (error.cancelled) send("download-cancelled", package_name);
		else send("failed-mod", {source: "thunderstore", name: package_name, code: error.code || "INSTALL_FAILED", error: error.message});
	}
});
ipcMain.on("cancel-download", (_event, name) => packages.cancel(name));
app.on("before-quit", () => installer.cancelAll());
module.exports = packages;
