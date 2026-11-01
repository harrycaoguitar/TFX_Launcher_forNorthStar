"use strict";

// Read-only diagnostics for the optional EA emulator. Everything returned here
// is safe to show in the UI: no access tokens, refresh tokens, authorization
// codes, license blobs, or player IDs beyond the display name.
const net = require("net");
const path = require("path");
const {app, ipcMain, shell} = require("electron");
const account = require("./ea-account");
const emulator = require("./ea-emulator");
const findgame = require("./findgame");
const {recoverPortConflict} = require("./ea-port-recovery");

const EA_LOG = () => path.join(app.getPath("appData"), "fold-ea.log");
const LSX_LOG = () => path.join(app.getPath("appData"), "fold-ea-lsx.log");
const ACCOUNT_FILE = () => account.storePath();

function probePort(port = 3216, timeout = 400) {
	if (emulator.isActive()) return Promise.resolve({listening:true, owner:"tfx", port});
	return new Promise(resolve => {
		let settled = false;
		const socket = net.connect({port, host:"127.0.0.1"});
		const finish = value => {
			if (settled) return;
			settled = true;
			try { socket.destroy(); } catch (_) {}
			resolve({port, ...value});
		};
		socket.setTimeout(timeout);
		socket.once("connect", () => finish({listening:true, owner:"other"}));
		socket.once("timeout", () => finish({listening:false, owner:"none"}));
		socket.once("error", error => finish({listening:false, owner:"none", code:error.code || null}));
	});
}

async function collect() {
	const settings = require("./settings")();
	const conf = {...settings};
	const root = conf.gamepath ? findgame.validateGamePath(conf.gamepath) : false;
	const [port] = await Promise.all([probePort()]);
	return {
		at:new Date().toISOString(),
		emulatorEnabled:conf.eaEmulator === true,
		region:conf.northstarRegion,
		mode:conf.modProfileServer,
		account:await account.statusWithAvatar(),
		port,
		emulator:emulator.diagnostics(),
		game:{path:conf.gamepath || "", valid:Boolean(root)},
		paths:{eaLog:EA_LOG(), lsxLog:LSX_LOG(), account:ACCOUNT_FILE()}
	};
}

function failure(error) {
	return {ok:false, code:error?.code || "EA_DIAGNOSTICS_FAILED", error:error?.message || String(error)};
}

function register() {
	ipcMain.handle("ea-diagnostics", async () => {
		try { return {ok:true, diagnostics:await collect()}; }
		catch (error) { return failure(error); }
	});
	ipcMain.handle("ea-registry-write", async () => {
		try {
			const registry = await emulator.ensureRegistry();
			return {ok:registry.ok, registry};
		} catch (error) { return failure(error); }
	});
	ipcMain.handle("ea-diagnostics-repair", async () => {
		try {
			const settings = require("./settings")();
			await settings.saveAsync({eaEmulator:true});
			const registry = await emulator.ensureRegistry();
			const portRecovery = await recoverPortConflict({probe:probePort, stopOwn:() => emulator.stop(), delay:ms => new Promise(resolve => setTimeout(resolve, ms))});
			return {ok:true, registry, portRecovery, diagnostics:await collect()};
		} catch (error) { return failure(error); }
	});
	ipcMain.handle("ea-diagnostics-open-log", async (_event, kind) => {
		const filename = kind === "lsx" ? LSX_LOG() : EA_LOG();
		const error = await shell.openPath(filename);
		return error ? {ok:false, error} : {ok:true};
	});
}

module.exports = {register, collect, probePort};
