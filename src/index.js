const path = require("path");
const { app, BrowserWindow, screen } = require("electron");
const launcherVersion = require("./modules/launcher-version");

// A separate profile is useful for testing the portable build without changing
// the player's existing configuration. Normal launches use the original paths.
const neoProfile = process.argv.find(value => value.startsWith("--fold-profile=") || value.startsWith("--neo-profile="));
if (neoProfile) {
	const fs = require("fs");
	const profile = path.resolve(neoProfile.slice(neoProfile.indexOf("=") + 1));
	fs.mkdirSync(profile, {recursive: true});
	app.setPath("appData", profile);
	app.setPath("cache", profile);
}

// makes it so Electron cache doesn't get stored in your system's config
// folder, and instead changing it over to using the system's cache
// folder instead
app.setPath("userData", path.join(app.getPath("cache"), app.name));

// One writer owns the selected profile, including settings and recovery journals.
// A second click activates that window before loading any mutation-capable modules.
if (app.requestSingleInstanceLock()) boot();
else app.quit();

function boot() {
let mainWindow;
app.on("second-instance", () => {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	if (mainWindow.isMinimized()) mainWindow.restore();
	mainWindow.show();
	mainWindow.focus();
});

// ensures PWD/CWD is the config folder where viper.json is located
process.chdir(app.getPath("appData"));

// Import previous configuration once; the previous launcher file stays untouched.
{
 const fs = require("fs");
 if (!fs.existsSync("fold.json") && fs.existsSync("viper.json")) {
  fs.copyFileSync("viper.json", "fold.json");
 }
}

const settings = require("./modules/settings");
// The native language pack follows the saved app language, including previews
// chosen on a previous run. Initial selection comes from the system language.
const nativeUiLanguage = require("./locale").normalize(settings().uiLanguage);
app.commandLine.appendSwitch("lang", nativeUiLanguage);

// Finish the durable DDS journal before quitting after the last window closes.
let waitingForDdsQuit = false;
app.on("before-quit", event => {
	const gate = require("./modules/dds-operation-gate");
	if (gate.owner && gate.owner !== "launch") {
		event.preventDefault();
		if (!waitingForDdsQuit) {
			waitingForDdsQuit = true;
			gate.whenIdle().then(() => {waitingForDdsQuit=false;app.quit();});
		}
	}
});

const appConsole = require("./modules/console");

// Starts the main application window.
function start() {
	let win = new BrowserWindow({
		width: 1360,
		height: 860,
		minWidth: 1100,
		minHeight: 720,
		title: "TFX Launcher",
		backgroundColor: "#00000000",
		transparent: true,

		// Hides the window initially, it'll be shown when the DOM is
		// loaded, as to not cause visual issues.
		show: false,

		resizable: true,

		frame: false,
		thickFrame: false,
		titleBarStyle: "hidden",
		icon: path.join(__dirname, "assets/icons/512x512.png"),

		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true,
			additionalArguments: ["--tfx-default-language=" + require("./lang").defaultLocale],
			sandbox: false
		}
	})
	mainWindow = win;
	win.once("closed", () => { mainWindow = null; });
	const acceptLanguages = {"zh-CN":"zh-CN,zh,en-US,en","zh-TW":"zh-TW,zh,en-US,en","en-US":"en-US,en","de-DE":"de-DE,de,en-US,en","fr-FR":"fr-FR,fr,en-US,en"};
	win.webContents.session.setUserAgent(win.webContents.getUserAgent(), acceptLanguages[nativeUiLanguage]);

	// Fit smaller displays and Windows scaling without hiding window controls.
	const available = screen.getPrimaryDisplay().workAreaSize;
	let requestedSize = {width: 1360, height: 860};
	if (available.width < 1392 || available.height < 892) {
		const fitWidth = Math.min(1360, Math.max(800, available.width - 32));
		const fitHeight = Math.min(860, Math.max(560, available.height - 32));
		win.setMinimumSize(Math.min(1100, fitWidth), Math.min(720, fitHeight));
		win.setSize(fitWidth, fitHeight);
		win.center();
		requestedSize = {width: fitWidth, height: fitHeight};
	}

	// The renderer clips transparent corners without changing the native region
	// or window bounds. Movement keeps the same physical-pixel-aligned path.
	require("./modules/window-move")(win, requestedSize);

	// makes sending things to the renderer a little more readable
	win.send = (channel, data) => {
		if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, data);
	};

	// give `./win` the main window, `./win()` will then be equal
	// to `win`, but its accessible anywhere
	require("./win").set(win);

	// when --devtools is added it'll open the dev tools
	if (process.argv.includes("--devtools")) {
		// for some unknown, mysterious reason, the devtools just wont
		// open if you call this immediately, that's how its worked for
		// a very long time, and suddenly it stopped working, and this
		// seemingly was the only fix
		setTimeout(() => {
			win.webContents.openDevTools();
		}, 1)
	}

	// we dont need this!
	win.removeMenu();
	win.once("ready-to-show", () => win.show());
	win.webContents.setWindowOpenHandler(() => ({action: "deny"}));
	win.webContents.on("will-navigate", (event) => {
		event.preventDefault();
	});

	// Start Chromium and its local document while Node loads the services below.
	// Registrations remain synchronous in this turn: renderer IPC cannot be
	// delivered until every launch guard and recovery service is installed.
	win.loadFile(path.join(__dirname, "app/index.html"), {
		userAgent: "TFX/" + launcherVersion(),
	})
	require("./modules/mods");
	require("./modules/packages");
	require("./modules/update");
	require("./modules/version");
	require("./modules/ipc");
	require("./modules/gamepath");
	require("./modules/system_dns");
	require("./modules/launch");
	require("./modules/vanilla-client");
	const dds = require("./modules/dds"), vtf = require("./modules/vtf");
	require("./modules/skin-import").register({...require("electron"),dds,vtf,mods:require("./modules/mods")});
	require("./modules/weapon-library").register({...require("electron"),dds,vtf,mods:require("./modules/mods"),settings:require("./modules/settings")});
	require("./modules/skin-switch").installEngines({dds,vtf,baseDir:path.join(app.getPath("appData"),"fold-launcher","skin-switch")});
	require("./modules/server-list").register(require("electron").ipcMain);
	require("./modules/launcher-update").register(require("electron"));

	// print exceptions to terminal, and forward the exception to the
	// renderer, it'll then show a more user friendly error message
	process.on("uncaughtException", (err) => {
		win.send("unknown-error", {
			message: err.message,
			stack: err.stack
		});
		appConsole.error(err);
	})

	// The accepted game directory requests its mod library through gui-getmods.
	// Scanning here as well used to duplicate the same startup disk traversal.
	win.webContents.on("dom-ready", () => {
		if (!settings().gamepath) win.send("mods", {all: [], enabled: [], disabled: []});
	});

	// Only game-component updates are supported. The launcher no longer
	// derives an update feed from the original upstream GitHub repository.
	// The validated directory flow starts Northstar auto-update after acceptance.
}

app.whenReady().then(start);

app.on("window-all-closed", () => {
	app.quit();
});
}
