"use strict";

// Read-only diagnostics for the optional EA emulator. Everything returned here
// is safe to show in the UI: no access tokens, refresh tokens, authorization
// codes, license blobs, or player IDs beyond the display name.
const net = require("net");
const https = require("https");
const fs = require("fs");
const path = require("path");
const {app, ipcMain, shell, clipboard} = require("electron");
const account = require("./ea-account");
const emulator = require("./ea-emulator");
const findgame = require("./findgame");
const {recoverPortConflict} = require("./ea-port-recovery");
const {describe, formatReport} = require("./ea-diagnostic-report");
let latest = null;

const EA_LOG = () => path.join(app.getPath("appData"), "fold-ea.log");
const LSX_LOG = () => path.join(app.getPath("appData"), "fold-ea-lsx.log");
const ACCOUNT_FILE = () => account.storePath();

function probePort(port = 3216, timeout = 400) {
	if (emulator.isActive()) return Promise.resolve({listening:true, owner:"tfx", port:emulator.diagnostics().port});
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
		socket.once("timeout", () => finish({listening:false, owner:"none", code:"ETIMEDOUT"}));
		socket.once("error", error => finish({listening:false, owner:"none", code:error.code || null}));
	});
}

function probeNetwork(timeout = 5000) {
	return new Promise(resolve => {
		const started = Date.now();
		let settled = false;
		let request;
		const timer = setTimeout(() => { finish({reachable:false, code:"ETIMEDOUT"}); request?.destroy(); }, timeout);
		const finish = value => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({...value, elapsedMs:Date.now() - started});
		};
		try {
			// Any HTTP response proves transport reachability, not authentication.
			request = https.request("https://accounts.ea.com/", {method:"HEAD"}, response => {
				response.resume();
				finish({reachable:true, status:response.statusCode});
			});
			request.once("error", error => finish({reachable:false, code:error.code || "EA_NETWORK_FAILED"}));
			request.end();
		} catch (error) { finish({reachable:false, code:error.code || "EA_NETWORK_FAILED"}); }
	});
}

async function collect({network = false} = {}) {
	const settings = require("./settings")();
	const conf = {...settings};
	const root = conf.gamepath ? findgame.validateGamePath(conf.gamepath) : false;
	const [port, registry, connection] = await Promise.all([probePort(), emulator.readRegistry(), network ? probeNetwork() : Promise.resolve(latest?.network || null)]);
	const data = {
		at:new Date().toISOString(),
		emulatorEnabled:conf.eaEmulator === true,
		region:conf.northstarRegion,
		mode:conf.modProfileServer,
		// Diagnostics must not refresh credentials or fetch an avatar as a side effect.
		account:account.status(),
		port,
		registry,
		network:connection,
		emulator:emulator.diagnostics(),
		game:{path:conf.gamepath || "", valid:Boolean(root)},
		paths:{eaLog:EA_LOG(), lsxLog:LSX_LOG(), account:ACCOUNT_FILE()}
	};
	data.view = describe(data);
	latest = data;
	return data;
}

function failure(error) {
	return {ok:false, code:error?.code || "EA_DIAGNOSTICS_FAILED", error:error?.message || String(error)};
}

function register() {
	ipcMain.handle("ea-diagnostics", async (_event, options) => {
		try { return {ok:true, diagnostics:await collect({network:options?.network !== false})}; }
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
			if (emulator.isActive()) return {ok:false, code:"EA_SERVICE_ACTIVE", error:"请先退出游戏，再修复连接。诊断和日志仍可使用。"};
			const settings = require("./settings")();
			await settings.saveAsync({eaEmulator:true});
			const registry = await emulator.ensureRegistry();
			const portRecovery = await recoverPortConflict({probe:probePort, stopOwn:() => emulator.stop(), delay:ms => new Promise(resolve => setTimeout(resolve, ms))});
			return {ok:true, repaired:registry.ok && portRecovery.resolved, registry, portRecovery, diagnostics:await collect({network:true})};
		} catch (error) { return failure(error); }
	});
	ipcMain.handle("ea-diagnostics-open-log", async (_event, kind) => {
		try {
			const filename = kind === "lsx" ? LSX_LOG() : EA_LOG();
			fs.mkdirSync(path.dirname(filename), {recursive:true});
			try { fs.writeFileSync(filename, JSON.stringify({at:new Date().toISOString(), stage:"log-opened", message:"日志已建立；后续登录或启动事件会记录在此。"}) + "\n", {encoding:"utf8", flag:"wx", mode:0o600}); }
			catch (error) { if (error.code !== "EEXIST") throw error; }
			const error = await shell.openPath(filename);
			return error ? {ok:false, error:`无法打开日志：${error}`} : {ok:true};
		} catch (error) { return failure(error); }
	});
	ipcMain.handle("ea-diagnostics-copy", async () => {
		try {
			const data = latest || await collect();
			clipboard.writeText(formatReport(data));
			return {ok:true};
		} catch (error) { return failure(error); }
	});
}

module.exports = {register, collect, probePort, probeNetwork};
