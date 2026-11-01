"use strict";

// Keeps the in-process LSX server alive when the launcher window is closed while
// the game is still running. The user gets an explicit tray icon and can force
// quit at any time; when the game exits, the app closes automatically.
const path = require("path");
const {app, Tray, Menu} = require("electron");

let tray = null;
let getWindow = () => null;
let isActive = () => false;
let quitRequested = false;
let forced = false;

function iconPath() {
	return path.join(__dirname, "..", "assets", "icons", "icon.ico");
}

function showWindow() {
	const win = getWindow();
	if (!win || win.isDestroyed()) return;
	quitRequested = false;
	try { win.show(); win.focus(); } catch (_) {}
	if (tray) {
		try { tray.destroy(); } catch (_) {}
		tray = null;
	}
}

function ensureTray() {
	if (tray) return tray;
	try {
		tray = new Tray(iconPath());
		tray.setToolTip("TFX Launcher · EA 模拟器服务运行中");
		tray.setContextMenu(Menu.buildFromTemplate([
			{label:"显示 TFX", click:showWindow},
			{type:"separator"},
			{label:"退出 TFX（会停止 EA 服务）", click:forceQuit}
		]));
		tray.on("double-click", showWindow);
	} catch (_) {
		tray = null;
	}
	return tray;
}

function enter(reason = "background") {
	const win = getWindow();
	if (!win || win.isDestroyed()) return false;
	const created = ensureTray();
	if (!created) return false;
	quitRequested = true;
	try { win.hide(); } catch (_) {}
	if (created?.displayBalloon) {
		try {
			created.displayBalloon({
				title:"TFX 正在后台运行",
				content:reason === "exit-after-launch" ? "游戏已启动，EA 模拟器服务会保持运行；游戏退出后 TFX 自动关闭。" : "EA 模拟器服务会保持运行；游戏退出后 TFX 自动关闭。"
			});
		} catch (_) {}
	}
	return true;
}

function requestExit(reason) {
	if (!isActive()) return false;
	return enter(reason);
}

function allowClose() {
	return forced || !isActive();
}

function sessionEnded() {
	if (quitRequested && !forced) {
		forced = true;
		app.quit();
	}
}

function forceQuit() {
	forced = true;
	quitRequested = false;
	if (tray) {
		try { tray.destroy(); } catch (_) {}
		tray = null;
	}
	app.quit();
}

function allowCloseNow() { forced = true; }

function configure(options = {}) {
	if (typeof options.getWindow === "function") getWindow = options.getWindow;
	if (typeof options.isActive === "function") isActive = options.isActive;
}

function isQuitRequested() { return quitRequested; }
function isForced() { return forced; }

app.on?.("will-quit", () => {
	if (tray) {
		try { tray.destroy(); } catch (_) {}
		tray = null;
	}
});

module.exports = {configure, enter, requestExit, allowClose, allowCloseNow, sessionEnded, forceQuit, showWindow, isQuitRequested, isForced, isServiceActive: () => Boolean(isActive())};
