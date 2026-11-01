"use strict";

// Optional EA sign-in. The account is stored locally and is only required by
// the built-in EA emulator; Northstar launches never read this file.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {pathToFileURL} = require("url");
const {execFile} = require("child_process");
const {app, BrowserWindow, ipcMain, session} = require("electron");
const api = require("./ea-api");
const {createPcSign} = require("./ea-crypto");

const STORE_VERSION = 1;
const SESSION_PARTITION = "persist:ea-login";
const LOGIN_TIMEOUT = 10 * 60 * 1000;
let registering = false;
let activeLogin = null;
let hardwareCache = null;
let avatarAttempted = false;

// A small, token-free login log makes protocol/callback failures visible
// without asking users to share the account store or EA credentials.
function loginLog(event) {
	try {
		const file = path.join(app.getPath("appData"), "fold-ea.log");
		try {
			if (fs.existsSync(file) && fs.statSync(file).size > 262144) fs.writeFileSync(file, "", {encoding:"utf8", mode:0o600});
		} catch (_) {}
		fs.appendFileSync(file, JSON.stringify({at:new Date().toISOString(), ...event}) + "\n", {encoding:"utf8", mode:0o600});
	} catch (_) {}
}

function storePath() { return path.join(app.getPath("appData"), "fold-ea.json"); }
function avatarDirectory() { return path.join(app.getPath("appData"), "ea-avatar"); }

function asString(value) { return typeof value === "string" ? value : ""; }
function normalizeAccount(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const account = {
		playerName:asString(value.playerName),
		personaId:asString(value.personaId),
		userId:asString(value.userId),
		avatarId:asString(value.avatarId),
		avatarPath:asString(value.avatarPath),
		remid:asString(value.remid),
		sid:asString(value.sid),
		accessToken:asString(value.accessToken),
		refreshToken:asString(value.refreshToken),
		tokenType:asString(value.tokenType) || "Bearer",
		expiresAt:Number.isFinite(Number(value.expiresAt)) ? Number(value.expiresAt) : 0,
		loginAt:asString(value.loginAt)
	};
	if (account.avatarPath) {
		try { if (!fs.statSync(account.avatarPath).isFile()) account.avatarPath = ""; } catch (_) { account.avatarPath = ""; }
	}
	return account;
}

function readStore() {
	try {
		const data = JSON.parse(fs.readFileSync(storePath(), "utf8").replace(/^\uFEFF/u, ""));
		if (data?.version !== STORE_VERSION) return null;
		return normalizeAccount(data.account);
	} catch (_) {
		return null;
	}
}

function writeStore(account) {
	const filename = storePath();
	fs.mkdirSync(path.dirname(filename), {recursive:true});
	const payload = JSON.stringify({version:STORE_VERSION, account:normalizeAccount(account)}) + "\n";
	const temporary = filename + ".save-" + crypto.randomUUID() + ".tmp";
	try {
		fs.writeFileSync(temporary, payload, {encoding:"utf8", mode:0o600, flag:"wx"});
		fs.renameSync(temporary, filename);
	} finally {
		try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
	}
}

function clearStore() {
	try { fs.unlinkSync(storePath()); } catch (_) {}
}

function publicStatus(account = readStore()) {
	const now = Date.now();
	const expired = Boolean(account?.expiresAt && account.expiresAt <= now);
	return {
		loggedIn:Boolean(account?.accessToken || account?.refreshToken),
		expired,
		playerName:account?.playerName || "",
		personaId:account?.personaId || "",
		userId:account?.userId || "",
		avatarPath:account?.avatarPath || "",
		avatarUrl:account?.avatarPath ? pathToFileURL(account.avatarPath).href : "",
		expiresAt:account?.expiresAt || 0,
		loginAt:account?.loginAt || ""
	};
}

function expired(account) {
	return Boolean(account?.expiresAt && account.expiresAt <= Date.now() + 60 * 1000);
}

async function ensureAccess() {
	let account = readStore();
	if (!account || (!account.accessToken && !account.refreshToken)) {
		throw Object.assign(Error("尚未登录 EA 账号。请在设置中登录 EA，或关闭 EA 模拟器改用 EA App。"), {code:"EA_LOGIN_REQUIRED"});
	}
	if (account.accessToken && !expired(account)) return account;
	if (!account.refreshToken) {
		writeStore({...account, accessToken:"", refreshToken:"", expiresAt:0});
		throw Object.assign(Error("EA 登录已过期，请重新登录。"), {code:"EA_TOKEN_EXPIRED"});
	}
	try {
		const refreshed = await api.refreshToken(account.refreshToken);
		account = {
			...account,
			accessToken:refreshed.accessToken,
			refreshToken:refreshed.refreshToken,
			tokenType:refreshed.tokenType,
			expiresAt:refreshed.expiresIn ? Date.now() + refreshed.expiresIn * 1000 : 0,
			remid:refreshed.cookies?.remid || account.remid,
			sid:refreshed.cookies?.sid || account.sid
		};
		writeStore(account);
		return account;
	} catch (error) {
		writeStore({...account, accessToken:"", refreshToken:"", expiresAt:0});
		throw Object.assign(Error("EA 登录已过期，请重新登录。"), {code:"EA_TOKEN_EXPIRED", cause:error?.message});
	}
}

async function ensureIdentity(account) {
	if (account.playerName && account.personaId && account.userId) return account;
	let identity;
	try {
		identity = await api.identity(account.accessToken);
	} catch (error) {
		// A token without an expiry field can still be rejected. Refresh once
		// before making the player sign in again.
		if (error?.code !== "EA_TOKEN_EXPIRED" || !account.refreshToken) throw error;
		const refreshed = await api.refreshToken(account.refreshToken);
		account = {
			...account,
			accessToken:refreshed.accessToken,
			refreshToken:refreshed.refreshToken,
			tokenType:refreshed.tokenType,
			expiresAt:refreshed.expiresIn ? Date.now() + refreshed.expiresIn * 1000 : 0,
			remid:refreshed.cookies?.remid || account.remid,
			sid:refreshed.cookies?.sid || account.sid
		};
		identity = await api.identity(account.accessToken);
	}
	const next = {...account, ...identity};
	writeStore(next);
	return next;
}

async function loadAvatar(account) {
	try {
		const found = await api.avatar(account.accessToken, account.userId);
		if (!found) return account;
		const bytes = await api.downloadAvatar(found.path);
		if (!bytes) return {...account, avatarId:found.avatarId};
		const extension = bytes[0] === 0xff && bytes[1] === 0xd8 ? ".jpg" : ".png";
		const directory = avatarDirectory();
		fs.mkdirSync(directory, {recursive:true});
		const filename = path.join(directory, "avatar-" + crypto.createHash("sha256").update(account.userId || "ea").digest("hex").slice(0, 12) + extension);
		fs.writeFileSync(filename, bytes, {mode:0o600});
		return {...account, avatarId:found.avatarId, avatarPath:filename};
	} catch (_) {
		return account;
	}
}

async function readCookies(webSession) {
	let remid = "", sid = "";
	for (let attempt = 0; attempt < 10 && (!remid || !sid); attempt++) {
		let cookies = [];
		try { cookies = await webSession.cookies.get({}); } catch (_) {}
		for (const cookie of cookies) {
			const domain = String(cookie.domain || "").replace(/^\./u, "").toLowerCase();
			if (domain !== "ea.com" && !domain.endsWith(".ea.com")) continue;
			if (String(cookie.name).toLowerCase() === "remid" && cookie.value) remid ||= cookie.value;
			if (String(cookie.name).toLowerCase() === "sid" && cookie.value) sid ||= cookie.value;
		}
		if ((!remid || !sid) && attempt < 9) await new Promise(resolve => setTimeout(resolve, 200));
	}
	return {remid, sid};
}

function createAuthUrl(hardware = {}) {
	const codeVerifier = base64url(crypto.randomBytes(32));
	const challenge = base64url(crypto.createHash("sha256").update(codeVerifier, "ascii").digest());
	const query = new URLSearchParams({
		client_id:api.CLIENT_ID,
		sbiod_enabled:"false",
		response_type:"code",
		locale:"en_US",
		pc_sign:createPcSign({hardware}),
		nonce:String(crypto.randomBytes(4).readInt32LE(0)),
		code_challenge_method:"S256",
		code_challenge:challenge
	});
	return {url:"https://accounts.ea.com/connect/auth?" + query.toString(), codeVerifier};
}

// The original emulator fingerprints WMI data when creating pc_sign, with a
// short timeout and fixed fallback values. Mirror that behavior without making
// sign-in depend on WMI being available.
const HARDWARE_SCRIPT = String.raw`
$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$board=Get-CimInstance Win32_BaseBoard | Select-Object -First 1
$bios=Get-CimInstance Win32_BIOS | Select-Object -First 1
$os=Get-CimInstance Win32_OperatingSystem | Select-Object -First 1
$disk=Get-CimInstance Win32_DiskDrive | Where-Object { $_.Index -eq 0 } | Select-Object -First 1
$gpu=Get-CimInstance Win32_VideoController | Select-Object -First 1
$adapter=Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
$gpuId=0
if($gpu.PNPDeviceID -match 'DEV_([0-9A-Fa-f]{4})'){ $gpuId=[Convert]::ToInt32($Matches[1],16) }
$mac=''
if($adapter -and $adapter.MacAddress){ $mac='$'+($adapter.MacAddress -replace '[-:]','').ToLowerInvariant() }
$installDate=''
if($os.InstallDate){ $installDate=[Management.ManagementDateTimeConverter]::ToDateTime($os.InstallDate).ToString('yyyy-MM-dd HH:mm:ss') }
[pscustomobject]@{
  boardManufacturer=[string]$board.Manufacturer
  boardSerial=[string]$board.SerialNumber
  biosManufacturer=[string]$bios.Manufacturer
  biosSerial=[string]$bios.SerialNumber
  osInstallDate=$installDate
  osSerial=[string]$os.SerialNumber
  diskSerial=[string]$disk.SerialNumber
  gpuId=$gpuId
  mac=$mac
} | ConvertTo-Json -Compress
`;

function readHardware(timeout = 2800) {
	return new Promise(resolve => {
		try {
			execFile("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(HARDWARE_SCRIPT, "utf16le").toString("base64")], {windowsHide:true, timeout, maxBuffer:65536, encoding:"utf8"}, (error, stdout) => {
				if (error) { resolve({}); return; }
				try { resolve(JSON.parse(String(stdout).replace(/^\uFEFF/u, "").trim())); }
				catch (_) { resolve({}); }
			});
		} catch (_) { resolve({}); }
	});
}

function base64url(input) {
	return Buffer.from(input).toString("base64").replace(/=+$/u, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function isJunoCallbackUrl(value) {
	if (typeof value !== "string" || !/^qrc:/i.test(value)) return false;
	try {
		const parsed = new URL(value);
		const path = parsed.pathname.toLowerCase().replace(/^\/+/u, "");
		const host = parsed.host.toLowerCase();
		return path === "html/login_successful.html" || (host === "html" && path === "login_successful.html") || path === "login_successful.html";
	} catch (_) {
		const path = value.replace(/^qrc:/i, "").replace(/^\/+/u, "").split(/[?#]/u)[0].toLowerCase();
		return path === "html/login_successful.html" || path === "login_successful.html";
	}
}

function shortLoadError(error) {
	const message = String(error?.message || error || "");
	const match = /^(ERR_[A-Z_]+(?:\s+\(-?\d+\))?)/u.exec(message);
	return match ? match[1] : "ERR_FAILED";
}

async function login({reset = false, parent} = {}) {
	if (activeLogin) {
		if (activeLogin.isDestroyed?.()) {
			activeLogin = null;
			loginLog({stage:"stale-login-cleared"});
		} else {
			throw Object.assign(Error("EA 登录窗口已经打开。"), {code:"EA_LOGIN_BUSY"});
		}
	}
	loginLog({stage:"login-start", reset:reset === true});
	if (!hardwareCache) hardwareCache = await readHardware();
	const {url, codeVerifier} = createAuthUrl(hardwareCache);
	const webSession = session.fromPartition(SESSION_PARTITION);
	if (reset) {
		try { await webSession.clearStorageData({storages:["cookies", "localstorage", "indexdb", "cachestorage", "serviceworkers"]}); } catch (_) {}
	}
	const completionPage = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><title>EA 登录</title><style>html,body{height:100%;margin:0;background:#160b2b;color:#f4ecff;font:15px "Microsoft YaHei UI",Segoe UI,sans-serif;display:grid;place-items:center}div{text-align:center;opacity:.92}i{display:block;width:34px;height:34px;margin:0 auto 18px;border:3px solid #b99cff44;border-top-color:#c7a6ff;border-radius:50%;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style></head><body><div><i></i><p>正在完成 EA 登录…</p><small>请稍候，不要关闭此窗口。</small></div></body></html>`);
	return new Promise((resolve, reject) => {
		let settled = false, timer = null, completionTimer = null, loginWindow = null, webRequestBound = false, protocolBound = false, exchanging = false, callbackSeen = false;
		const cleanup = () => {
			if (timer) clearTimeout(timer);
			if (completionTimer) clearTimeout(completionTimer);
			timer = null;
			completionTimer = null;
			if (webRequestBound) { try { webSession.webRequest.onBeforeRequest(null); } catch (_) {} webRequestBound = false; }
			if (protocolBound) { try { webSession.protocol.unhandle("qrc"); } catch (_) {} protocolBound = false; }
			if (loginWindow && !loginWindow.isDestroyed()) {
				loginWindow.removeAllListeners("closed");
				loginWindow.close();
			}
			loginWindow = null;
			activeLogin = null;
		};
		const finish = (error, value) => {
			if (settled) return;
			settled = true;
			if (error) loginLog({stage:"login-failed", code:error?.code || null, message:error?.message || String(error)});
			cleanup();
			if (error) reject(error); else resolve(value);
		};
		const showCompleting = () => {
			if (!loginWindow || loginWindow.isDestroyed()) return;
			try { void loginWindow.loadURL(completionPage).catch(() => {}); } catch (_) {}
		};
		const capture = value => {
			if (typeof value !== "string" || !/^qrc:/i.test(value)) return false;
			callbackSeen = true;
			loginLog({stage:"qrc-seen", path:String(value).replace(/[?#].*$/u, ""), hasQuery:String(value).includes("?")});
			if (exchanging) return true;
			if (!isJunoCallbackUrl(value)) return true;
			exchanging = true;
			showCompleting();
			completionTimer = setTimeout(() => finish(Object.assign(Error("EA 登录已完成，但换取令牌超时。请检查网络后重新登录。"), {code:"EA_LOGIN_TOKEN_TIMEOUT"})), 45000);
			completionTimer.unref?.();
			loginLog({stage:"callback"});
			void completeCallback(value, codeVerifier, webSession, loginWindow)
				.then(account => {
					loginLog({stage:"login-success"});
					finish(null, publicStatus(account));
				})
				.catch(error => finish(error));
			return true;
		};
		try {
			loginWindow = new BrowserWindow({
				width:560, height:780, minWidth:420, minHeight:560,
				parent:parent || undefined, modal:false, show:false,
				title:"EA 登录", backgroundColor:"#160b2b", autoHideMenuBar:true,
				webPreferences:{partition:SESSION_PARTITION, contextIsolation:true, nodeIntegration:false, sandbox:true}
			});
			activeLogin = loginWindow;
			loginLog({stage:"window-created"});
			loginWindow.once("ready-to-show", () => { loginLog({stage:"window-ready"}); if (!loginWindow.isDestroyed()) loginWindow.show(); });
			loginWindow.on("closed", () => {
				loginLog({stage:"window-closed"});
				if (!settled) finish(Object.assign(Error("EA 登录已取消。"), {code:"EA_LOGIN_CANCELLED"}));
			});
			loginWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
			loginWindow.webContents.setWindowOpenHandler(({url:target}) => {
				if (!capture(target) && /^https?:/i.test(target) && !loginWindow.isDestroyed()) loginWindow.loadURL(target);
				return {action:"deny"};
			});
			loginWindow.webContents.on("will-navigate", (event, target) => { if (capture(target)) event.preventDefault(); });
			loginWindow.webContents.on("will-redirect", (event, target) => { if (capture(target)) event.preventDefault(); });
			loginWindow.webContents.on("did-start-navigation", (_event, target) => { capture(target); });
			loginWindow.webContents.on("did-fail-load", (_event, _code, _description, target) => { capture(target); });
			// Handling qrc at the session level is more reliable than relying on
			// Chromium to emit a navigation event for an unknown protocol.
			try {
				try { webSession.protocol.unhandle("qrc"); } catch (_) {}
				webSession.protocol.handle("qrc", request => {
					capture(request.url);
					return new Response("<!doctype html><html><head><meta charset=utf-8><title>EA 登录</title></head><body style=\"background:#160b2b;color:#f4ecff;font:15px 'Microsoft YaHei UI',Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0\">登录成功，正在返回 TFX…</body></html>", {status:200, headers:{"content-type":"text/html; charset=utf-8"}});
				});
				protocolBound = true;
				loginLog({stage:"protocol-ready"});
			} catch (error) {
				loginLog({stage:"protocol-failed", code:error?.code || null, message:error?.message || String(error)});
			}
			try {
				// Clear a listener left by an interrupted previous attempt before
				// registering the current one. A webRequest failure alone must not
				// prevent the protocol/navigation handlers from working.
				try { webSession.webRequest.onBeforeRequest(null); } catch (_) {}
				webSession.webRequest.onBeforeRequest({urls:["<all_urls>"]}, (details, callback) => {
					if (details.url.startsWith("qrc:")) { capture(details.url); callback({cancel:true}); return; }
					callback({});
				});
				webRequestBound = true;
				loginLog({stage:"web-request-ready"});
			} catch (error) {
				loginLog({stage:"web-request-failed", code:error?.code || null, message:error?.message || String(error)});
			}
			timer = setTimeout(() => finish(Object.assign(Error("EA 登录超时，请重新尝试。"), {code:"EA_LOGIN_TIMEOUT"})), LOGIN_TIMEOUT);
			timer.unref?.();
			void loginWindow.loadURL(url).catch(error => {
				// A qrc callback intentionally aborts the original navigation; this
				// ERR_FAILED is part of the successful hand-off, not a page error.
				// Wait briefly so the callback event can win the race.
				setTimeout(() => {
					if (settled) return;
					if (callbackSeen || exchanging) {
						loginLog({stage:"initial-load-aborted", reason:shortLoadError(error)});
						return;
					}
					const reason = shortLoadError(error);
					loginLog({stage:"page-failed", reason});
					finish(Object.assign(Error("无法打开 EA 登录页，请检查网络后重试。（" + reason + "）"), {code:"EA_LOGIN_PAGE_FAILED", cause:reason}));
				}, 1000).unref?.();
			});
		} catch (error) {
			loginLog({stage:"window-failed", code:error?.code || null, message:error?.message || String(error)});
			finish(Object.assign(Error("无法打开 EA 登录窗口。" + (error?.message ? "（" + error.message + "）" : "")), {code:"EA_LOGIN_WINDOW_FAILED", cause:error?.message}));
		}
	});
}

async function completeCallback(callbackUrl, codeVerifier, webSession, loginWindow) {
	let callback;
	try { callback = new URL(callbackUrl); }
	catch (_) { throw Object.assign(Error("EA 登录回调无效，请重新尝试。"), {code:"EA_LOGIN_CALLBACK_INVALID"}); }
	const code = callback.searchParams.get("code") || (callback.hash ? new URLSearchParams(callback.hash.replace(/^#/u, "")).get("code") : null);
	const failure = callback.searchParams.get("error") || callback.searchParams.get("error_code") ||
		(callback.hash ? new URLSearchParams(callback.hash.replace(/^#/u, "")).get("error") : null);
	if (failure) throw Object.assign(Error("EA 登录未完成，请重新尝试。"), {code:"EA_LOGIN_REJECTED"});
	if (!code) throw Object.assign(Error("EA 登录回调无效，请重新尝试。"), {code:"EA_LOGIN_CALLBACK_INVALID"});
	if (loginWindow && !loginWindow.isDestroyed()) { try { loginWindow.setTitle("正在完成 EA 登录…"); } catch (_) {} }
	const cookies = await readCookies(webSession);
	loginLog({stage:"cookies", remid:Boolean(cookies.remid), sid:Boolean(cookies.sid)});
	const tokens = await api.exchangeCode({code, codeVerifier});
	loginLog({stage:"token-exchange-ok"});
	const identity = await api.identity(tokens.accessToken);
	loginLog({stage:"identity-ok"});
	let account = normalizeAccount({
		...identity,
		remid:tokens.cookies?.remid || cookies.remid,
		sid:tokens.cookies?.sid || cookies.sid,
		accessToken:tokens.accessToken,
		refreshToken:tokens.refreshToken,
		tokenType:tokens.tokenType,
		expiresAt:tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : 0,
		loginAt:new Date().toISOString()
	});
	account = await loadAvatar(account);
	writeStore(account);
	return account;
}

async function launchProfile() {
	let account = await ensureAccess();
	account = await ensureIdentity(account);
	return {
		accessToken:account.accessToken,
		refreshToken:account.refreshToken,
		remid:account.remid,
		sid:account.sid,
		playerName:account.playerName,
		personaId:account.personaId,
		userId:account.userId,
		avatarPath:account.avatarPath
	};
}

async function logout() {
	const webSession = session.fromPartition(SESSION_PARTITION);
	try { await webSession.clearStorageData({storages:["cookies", "localstorage", "indexdb", "cachestorage", "serviceworkers"]}); } catch (_) {}
	clearStore();
	return publicStatus(null);
}

function failure(error) {
	return {ok:false, code:error?.code || "EA_ACCOUNT_FAILED", error:error?.message || String(error)};
}

async function statusWithAvatar() {
	let account = readStore();
	if (account?.accessToken && !account.avatarPath && !avatarAttempted) {
		avatarAttempted = true;
		try {
			account = await ensureIdentity(await ensureAccess());
			account = await loadAvatar(account);
		} catch (_) {}
	}
	return publicStatus(account);
}

function register() {
	if (registering) return;
	registering = true;
	ipcMain.handle("ea-status", () => statusWithAvatar());
	ipcMain.handle("ea-login", async (_event, options = {}) => {
		try {
			const main = require("../win")();
			return {ok:true, status:await login({parent:main && !main.isDestroyed() ? main : undefined, reset:options?.reset === true})};
		} catch (error) {
			return failure(error);
		}
	});
	ipcMain.handle("ea-logout", async () => {
		try { return {ok:true, status:await logout()}; }
		catch (error) { return failure(error); }
	});
	ipcMain.handle("ea-refresh", async () => {
		try {
			avatarAttempted = false;
			return {ok:true, status:await statusWithAvatar()};
		}
		catch (error) { return failure(error); }
	});
}

module.exports = {register, status:publicStatus, statusWithAvatar, login, logout, launchProfile, ensureAccess, readStore, writeStore, storePath, SESSION_PARTITION, _test:{createAuthUrl, base64url, normalizeAccount, publicStatus, isJunoCallbackUrl, shortLoadError}};
