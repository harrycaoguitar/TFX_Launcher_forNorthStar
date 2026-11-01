const fs = require("fs");
const path = require("path");
const { contextBridge, ipcRenderer, shell, webUtils } = require("electron");

const json = require("./modules/json");
const translate = require("./lang");
let rendererLocale = translate.getLocale();

const sendChannels = new Set([
	"cancel-download", "delete-install-cache", "delete-request-cache",
	"exit", "get-ns-notes", "get-version", "get-vp-notes", "gui-getmods",
	"install-from-path", "install-from-url", "install-mod",
	"kill-game", "kill-origin", "launch-ns", "launch-vanilla",
	"minimize", "no-internet", "relaunch", "remove-mod",
	"save-settings", "setglobalpath", "setpath", "toggle-mod",
	"update-northstar"
]);

const receiveChannels = new Set([
	"window-state",
	"dds-progress", "vtf-progress", "skin-resource-progress", "skin-import-progress", "weapon-library-progress",
	"launch-guard-result", "launch-status", "launch-diagnostic", "launch-compatibility", "northstar-client-progress", "vanilla-client-progress", "global-game-root-progress", "china-game-root-progress",
	"alert", "changed-settings", "confirm", "download-cancelled", "globalpath-selected", "globalpath-status",
	"duped-mod", "failed-mod", "gamepath-lost", "gamepath-status", "gamepath-error", "installed-mod",
	"game-process-snapshot", "is-running", "legacy-duped-mod", "log", "mods", "newpath",
	"no-internet", "no-path-selected", "ns-notes", "ns-update-event",
	"pkg-progress", "removed-mod", "set-buttons", "unknown-error",
	"version", "vp-notes", "wrong-path"
]);

const invokeChannels = new Set([
	"skin-import-select", "skin-import-inspect", "skin-import-install", "skin-import-clear", "weapon-library-list", "weapon-library-restore", "weapon-library-prune",
	"launcher-update-check", "launcher-update-open",
	"ea-status", "ea-login", "ea-logout", "ea-refresh", "ea-diagnostics", "ea-diagnostics-repair", "ea-diagnostics-open-log", "ea-registry-write",
	"icepick-status", "icepick-select", "icepick-launch", "icepick-toggle", "icepick-remove", "icepick-import", "icepick-open",
	"launch-diagnostic-get", "launch-diagnostic-export",
	"settings-save", "settings-restore-defaults", "northstar-client-status", "northstar-client-install", "global-game-root-install", "china-game-root-install", "vanilla-client-status", "vanilla-client-install",
	"server-list-get",
	"set-mod-state",
	"window-move-begin", "window-move-update", "window-move-end", "window-toggle-maximize",
	"vtf-status", "vtf-preview", "vtf-select", "vtf-inspect", "vtf-clear", "vtf-install", "vtf-restore", "vtf-delete-backup", "vtf-open-backups",
	"dds-status", "dds-preview", "dds-select", "dds-inspect", "dds-clear", "dds-install", "dds-restore", "dds-delete-backup", "dds-open-backups",
	"dds-protection-status", "dds-protection-set", "dds-protection-capture",
	"dds-originals-select", "vtf-originals-select",
	"dds-resource-plan", "dds-resource-download", "dds-resource-cancel", "vtf-resource-plan", "vtf-resource-download", "vtf-resource-cancel",
	"flush-dns-cache", "request", "set-system-dns"
]);

function isResponseChannel(channel) {
	return /^(alert|confirm)-closed-\d+$/.test(channel);
}

function loadSettings() {
	const file = path.join(process.cwd(), "fold.json");
	if (! fs.existsSync(file)) {
		return { exists: false, data: { uiLanguage: translate.defaultLocale } };
	}

	const data = require("./preferences").normalize(json(file), translate.defaultLocale);
	rendererLocale = data.uiLanguage;
	if (data.gamepath && ! data.nsargs) {
		const argsFile = path.join(data.gamepath, "ns_startup_args.txt");
		if (fs.existsSync(argsFile)) {
			try { data.nsargs = fs.readFileSync(argsFile, "utf8"); } catch (_) {}
		}
	}

	return { exists: true, data };
}

contextBridge.exposeInMainWorld("ipcRenderer", {
	send(channel, ...args) {
		if (sendChannels.has(channel) || isResponseChannel(channel)) {
			ipcRenderer.send(channel, ...args);
		}
	},
	on(channel, callback) {
		if (! receiveChannels.has(channel) || typeof callback !== "function") {
			return;
		}

		ipcRenderer.on(channel, (_event, ...args) => callback({}, ...args));
	},
	invoke(channel, ...args) {
		if (! invokeChannels.has(channel)) {
			return Promise.reject(new Error("IPC channel is not allowed"));
		}

		return ipcRenderer.invoke(channel, ...args);
	}
});

contextBridge.exposeInMainWorld("fold", {
	getDroppedFilePath: file => webUtils.getPathForFile(file),
	loadSettings,
	openExternal(url) {
		try {
			const parsed = new URL(url);
			if (parsed.protocol === "https:" || (parsed.protocol === "mailto:" && parsed.pathname === "harrycaoguitar@gmail.com" && !parsed.search && !parsed.hash)) {
				return shell.openExternal(parsed.href);
			}
		} catch (err) {}
	},
	openPath: target => shell.openPath(target),
	translate: key => translate(key, rendererLocale),
	translateText: (value, locale = rendererLocale) => translate.text(value, locale),
	loadLocale: locale => translate.loadLocale(locale),
	normalizeUiLanguage: value => translate.normalize(value),
	setUiLanguage: value => (rendererLocale = translate.normalize(value))
});
