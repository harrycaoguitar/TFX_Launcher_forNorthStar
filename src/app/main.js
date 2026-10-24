var modsobj = {
	all: [],
	enabled: [],
	disabled: []
}

let shouldInstallNorthstar = false;
let gameDirectoryReady = false;
let launchPending = false;

// Base settings
var settings = {
	nsargs: "",
	gamepath: "",
	theme: "aurora",
	uiLanguage: "zh-CN",
	modSort: "added",
	northstarRegion: "cn",
	modProfileServer: "cn",
	vanillaModsEnabled: false,
	independentServerMods: false,
	nsupdate: true,
	originkill: false,
	zip: "/northstar.zip",
	excludes: [
		"ns_startup_args.txt",
		"ns_startup_args_dedi.txt"
	]
}

// invokes `requests.get()` from `src/modules/requests.js` through the
// main process, and returns the output
async function request(...args) {
	return await ipcRenderer.invoke("request", ...args);
}

// Loads settings through the isolated preload layer.
const loadedSettings = fold.loadSettings();
if (loadedSettings.data && Object.keys(loadedSettings.data).length !== 0) {
	settings = {
		...settings,
		...loadedSettings.data
	};

}
// Install all renderer listeners before requesting startup path validation.
window.addEventListener("DOMContentLoaded", () => setpath(Boolean(settings.gamepath), false));

ipcRenderer.on("changed-settings", (e, new_settings) => {
	// attempt to set `settings` to `new_settings`
	try {
		const previousTheme=settings.theme;
		settings = {
			...settings,
			...new_settings
		}
		if (window.Themes && Object.prototype.hasOwnProperty.call(new_settings, "theme") && previousTheme!==settings.theme) Themes.load();
	}catch(e) {}
})

// Show a toast message if no Internet connection has been detected.
if (! navigator.onLine) {
	ipcRenderer.send("no-internet");
}

function exit() {
	if (window.Settings?.canLeave && !window.Settings.canLeave(exit)) return;
	ipcRenderer.send("exit");
}

let checked_for_ns_update = new Date().getTime();

function updateNorthstar() {
	checked_for_ns_update = new Date().getTime();
	ipcRenderer.send("update-northstar")
}

function force_update_ns() {
	if (window.VyraClient?.reinstallIfNeeded()) return;
	ipcRenderer.send("update-northstar", true);
}

function open_gamepath() {
	if (settings.gamepath) {
		fold.openPath(settings.gamepath);
	} else {
		alert(lang("gui.settings.miscbuttons.open_gamepath_alert"));
	}
}

function relaunch() {
	if (window.Settings?.canLeave && !window.Settings.canLeave(relaunch)) return;
	ipcRenderer.send("relaunch");
}

// Reports to the main process about game path status.
// @param {boolean} value is game path loaded
function setpath(value = false, forceDialog = true) {
	ipcRenderer.send("setpath", value, forceDialog);
}

// Tells the main process to launch or install Northstar
function launch() {
	if (window.VyraClient) return window.VyraClient.activate(() => {
		window.VyraLaunch?.begin("northstar");
		ipcRenderer.send("launch-ns");
	});
	if (launchPending || is_running) return;
	if (!gameDirectoryReady) {setpath(); return;}
	window.VyraLaunch?.begin("northstar");
	ipcRenderer.send("launch-ns");
}

// Tells the main process to launch the vanilla game
function launchVanilla() {
	if (window.OfficialClient) return window.OfficialClient.activate(() => {
		window.VyraLaunch?.begin("vanilla");
		ipcRenderer.send("launch-vanilla");
	});
	if (launchPending || is_running || window.VyraClient?.busy) return;
	if (!gameDirectoryReady) {setpath(); return;}
	window.VyraLaunch?.begin("vanilla"); ipcRenderer.send("launch-vanilla");
}

let log = console.log;

// Disables or enables certain buttons when for example
// updating/installing Northstar.
function setButtons(state, enable_gamepath_btns) {
	playNsBtn.disabled = !state;

	let disablearray = (array) => {
		for (let i = 0; i < array.length; i++) {
			array[i].disabled = ! state;

			if (state) {
				array[i].classList.remove("disabled")
			} else {
				array[i].classList.add("disabled")
			}
		}
	}

	disablearray(document.querySelectorAll("#modsdiv .el button"));
	disablearray(document.querySelectorAll(".disable-when-installing"));
	disablearray(document.querySelectorAll(".playBtnContainer .playBtn"));
	disablearray(document.querySelectorAll("#nsMods .buttons.modbtns button"));
	disablearray(document.querySelectorAll("#browser #browserEntries .text button"));

	if (enable_gamepath_btns) {
		let gamepath_btns =
			document.querySelectorAll('*[onclick="setpath()"]');

		for (let i = 0; i < gamepath_btns.length; i++) {
			gamepath_btns[i].disabled = false;
			gamepath_btns[i].classList.remove("disabled");
		}
	}
	if (!gameDirectoryReady || launchPending) {
		for (const button of document.querySelectorAll(".playBtn")) button.disabled = true;
	}
	if (launchPending) {
		for (const button of document.querySelectorAll('[data-launch-region],[data-server-region],[data-vanilla-mods],[data-mode]')) button.disabled = true;
	}
	window.VyraClient?.renderAction();
	window.OfficialClient?.renderAction();
	window.mods?.setAvailability(state);
}

// `percent` should be a number between 0 to 100, if it's `false` it'll
// reset it back to nothing instantly, with no animatino
function set_ns_progress(percent) {
	// reset button progress
	if (percent === false) {
		document.querySelector(".contentContainer #nsMain .playBtn")
			.style.setProperty("--progress", "unset");

		return;
	}

	percent = parseInt(percent);

	// make sure we're dealing with a number
	if (isNaN(percent) || typeof percent !== "number") {
		return false;
	}

	// limit percent, while this barely has a difference, if you were to
	// set a very high number, the CSS would then use a very high
	// number, not great.
	if (percent > 100) {
		percent = 100;
	} else if (percent < 0) {
		percent = 0;
	}

	// invert number to it works in the CSS
	percent = 100 - percent;

	// set the CSS progress variable
	document.querySelector(".contentContainer #nsMain .playBtn")
		.style.setProperty("--progress", percent + "%");
}

ipcRenderer.on("set-buttons", (event, state) => {
	setButtons(state);
})

ipcRenderer.on("gamepath-lost", (event, state) => {
	page(0);
	setButtons(false, true);
	alert(lang("gui.gamepath.lost"));
})

// Frontend part of updating Northstar
const shownUpdateWarnings = new Set();
ipcRenderer.on("ns-update-event", (event, options) => {
	if (options && typeof options === "object" && typeof options.warning === "string" && options.warning && !shownUpdateWarnings.has(options.warning)) {
		shownUpdateWarnings.add(options.warning);
		new Toast({scheme:"warning",title:I18n.current === 'zh-CN' ? '已切换备用更新源' : I18n.text('Backup update source'),description:I18n.text(options.warning),timeout:9000});
	}
	let key = options.key;
	if (typeof options == "string") {
		key = options;
	}

	// updates text in update button to `lang(key)`
	let update_btn = () => {
		document.getElementById("update")
			.innerText = `(${lang(key)})`;
	}

	switch(key) {
		case "cli.update.uptodate_short":
		case "cli.update.no_internet":
		case "cli.update.check_failed":
			// initial value
			let delay = 0;

			// get current time
			let now = new Date().getTime();

			// check if `checked_for_ns_update` was less than 500ms
			// since now, this variable is set when `updateNorthstar()`
			// is called
			if (now - checked_for_ns_update < 500) {
				// if less than 500ms has passed, set `delay` to the
				// amount of milliseconds missing until we've hit that
				// 500ms threshold
				delay = 500 - (now - checked_for_ns_update);
			}

			// wait `delay`ms
			setTimeout(() => {
				// set buttons accordingly
				update_btn();
				setButtons(true);
				set_ns_progress(false);
				if (!launchPending) playNsBtn.innerText = lang("gui.launch");
				window.VyraClient?.renderAction();
			}, delay)

			break;
		default:
			update_btn();

			if (options.progress !== undefined) {
				set_ns_progress(options.progress);
			}

			if (options.btn_text && !launchPending) {
				playNsBtn.innerText = options.btn_text;
			}

			setButtons(false);
			break;
	}
});

ipcRenderer.on("unknown-error", (event, err) => {
	new Toast({
		timeout: 10000,
		scheme: "error",
		title: lang("gui.toast.title.unknown_error"),
		description: lang("gui.toast.desc.unknown_error"),
		callback: () => {
			new Toast({
				timeout: 15000,
				scheme: "error",
				title: "",
					description: err.stack || err.message || String(err)
			})
		}
	})

	console.error(err.stack || err.message || err)
})

// Local selection is passed to the verified import service. Online package
// planning and cancellation are owned by the Thunderstore services.
function installmod() { if(window.SkinImport){Fold.navigate("skins");SkinImport.select();}else{setButtons(false);ipcRenderer.send("install-mod");} }
function installFromPath(source) { if(window.SkinImport){Fold.navigate("skins");SkinImport.inspect(source);}else{setButtons(false);ipcRenderer.send("install-from-path", source);} }

// Frontend part of settings a new game path
ipcRenderer.on("newpath", (event, newpath) => {
	if (typeof newpath !== "string" || !newpath) return;
	gameDirectoryReady = true;
	setButtons(true);
	settings.gamepath = newpath;
	ipcRenderer.send("gui-getmods");
})
ipcRenderer.on("gamepath-status", (_event, state) => {
	gameDirectoryReady = Boolean(state && state.valid && !state.checking);
	for (const button of document.querySelectorAll(".playBtn")) button.disabled = !gameDirectoryReady || is_running;
});

// Continuation of log()
ipcRenderer.on("log", (event, msg) => {log(msg)})
ipcRenderer.on("alert", (event, data) => {
	alert(data.message);
	ipcRenderer.send("alert-closed-" + data.id);
})

ipcRenderer.on("confirm", (event, data) => {
	let confirmed = confirm(data.message);
	ipcRenderer.send("confirm-closed-" + data.id, confirmed);
})

let is_running = false;
ipcRenderer.on("is-running", (event, running) => {
	let set_playbtns = (text) => {
		let playbtns = document.querySelectorAll(".playBtn");
		for (let i = 0; i < playbtns.length; i++) {
			playbtns[i].innerHTML = text;
		}
	}

	if (running) {
		setButtons(false);
		set_playbtns(lang("general.running"));

		if (is_running == running) {return}
		is_running = running;

		// show force quit button in Titanfall tab
		tfquit.style.display = "inline-block";

		update.setAttribute("onclick", "kill_game()");
		update.innerHTML = "(" + lang("ns.menu.force_quit") + ")";
		return;
	}

	if (is_running != running) {
		setButtons(true);
		set_playbtns(lang("gui.launch"));

		is_running = running;

		// hide force quit button in Titanfall tab
		tfquit.style.display = "none";

		update.setAttribute("onclick", "updateNorthstar()");
		update.innerHTML = "(" + lang("gui.update.check") + ")";
	}
})

function kill_game() {
	ipcRenderer.send("kill-game");
}

function kill_origin() {
	ipcRenderer.send("kill-origin");
}

function delete_request_cache() {
	ipcRenderer.send("delete-request-cache");
}

function delete_install_cache() {
	ipcRenderer.send("delete-install-cache");
}

// Updates the installed mods
ipcRenderer.on("mods", (event, mods_obj) => {
	if (! mods_obj) {return}
	modsobj = mods_obj;

	if (typeof Browser !== "undefined") {
		Browser.add_pkg_properties();
	}

	mods.load(mods_obj);
})

// Updates version numbers
ipcRenderer.on("version", (event, versions) => {
	vpversion.innerText = versions.vp;
	launcherEditionVersion.innerText = String(versions.vp).replace(/^v/, "");
	if (window.VyraClient) VyraClient.receiveVersion(versions);
	else nsversion.innerText = versions.ns;
	tf2Version.innerText = versions.tf2;

	if (versions.ns == "unknown") {
		let buttons = document.querySelectorAll(".modbtns button");

		for (let i = 0; i < buttons.length; i++) {
			buttons[i].disabled = true;
		}

		// The selected regional client's explicit install state owns its action.
		shouldInstallNorthstar = false;
		if (!is_running && !launchPending) playNsBtn.innerText = lang("gui.launch");
	} else {
		shouldInstallNorthstar = false;
		if (!is_running && !launchPending) playNsBtn.innerText = lang("gui.launch");
	}
	window.VyraClient?.renderAction();
}); ipcRenderer.send("get-version");

// Error out when no game path is set
ipcRenderer.on("no-path-selected", () => {
	gameDirectoryReady = false;
	setButtons(false, true);
});

// Error out when game path is wrong
ipcRenderer.on("wrong-path", () => {
	alert(lang("gui.gamepath.wrong"));
	setpath(false);
});

setlang();

let dragtimer;
document.addEventListener("dragover", (e) => {
	e.preventDefault();
	e.stopPropagation();
	dragUI.classList.add("shown");

	clearTimeout(dragtimer);
	dragtimer = setTimeout(() => {
		dragUI.classList.remove("shown");
	}, 5000)
});

document.addEventListener("mouseover", (e) => {
	clearTimeout(dragtimer);
	dragUI.classList.remove("shown");
});

document.addEventListener("drop", (e) => {
	e.preventDefault();
	e.stopPropagation();

	dragUI.classList.remove("shown");
	if (e.dataTransfer.files.length > 1) {
		setButtons(true);
		new Toast({scheme: "error", title: window.I18n ? I18n.t("mods.importFailed") : "模组未导入", description: window.I18n ? I18n.t("mods.importOne") : "一次导入一个模组压缩包；多个模组请放在同一个完整文件夹中。"});
		return;
	}
	if (e.dataTransfer.files.length > 0) {
		installFromPath(fold.getDroppedFilePath(e.dataTransfer.files[0]));
	}
});

document.body.addEventListener("click", event => {
	if (event.target.tagName.toLowerCase() === "a" && event.target.protocol != "file:") {
		event.preventDefault();
		fold.openExternal(event.target.href);
	}
});
