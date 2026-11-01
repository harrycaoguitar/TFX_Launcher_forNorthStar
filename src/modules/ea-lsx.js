"use strict";

// Local Ebisu/LSX endpoint on 127.0.0.1:3216. Titanfall 2 connects here while
// the EA Desktop client would normally provide license, profile and entitlement
// responses. The protocol and response documents follow EAappEmulater's
// LSXTcpServer, limited to the resources Titanfall 2 requests.
const fs = require("fs");
const net = require("net");
const path = require("path");
const crypto = require("./ea-crypto");
const defaultApi = require("./ea-api");

const PORT = 3216;
const CONTENT_ID = "1039093";
const RESOURCE_ROOT = path.join(__dirname, "..", "resources", "ea-lsx");

function pad(number) { return String(number).padStart(2, "0"); }

function loadTemplates() {
	const cache = new Map();
	return function template(group, index) {
		const key = group + "/" + pad(index);
		if (cache.has(key)) return cache.get(key);
		let value = "";
		try { value = fs.readFileSync(path.join(RESOURCE_ROOT, group, pad(index) + ".xml"), "utf8"); } catch (_) {}
		cache.set(key, value);
		return value;
	};
}
const template = loadTemplates();
const bfv = index => template("bfv", index);
const ttf2 = index => template("ttf2", index);

function fill(text, values) {
	return String(text || "").replace(/##([A-Za-z0-9_]+)##/g, (match, name) => Object.prototype.hasOwnProperty.call(values, name) && values[name] !== undefined && values[name] !== null ? String(values[name]) : match);
}

function parseAttributes(text) {
	const result = {};
	const expression = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
	let match;
	while ((match = expression.exec(String(text || "")))) result[match[1]] = match[2];
	return result;
}

function parseRequest(xml) {
	const request = /<Request\b([^>]*)>([\s\S]*)<\/Request>/i.exec(String(xml || ""));
	if (!request) return null;
	const requestAttributes = parseAttributes(request[1]);
	const body = request[2];
	const child = /<([A-Za-z][\w.-]*)\b([^>]*?)(\/?)>/i.exec(body);
	if (!child) return null;
	const attributes = parseAttributes(child[2]);
	const element = name => {
		const match = new RegExp("<" + name + "\\b[^>]*>([\\s\\S]*?)</" + name + ">", "i").exec(body);
		return match ? match[1].trim() : undefined;
	};
	return {id:requestAttributes.id || "", type:child[1], attributes, element, xml:String(xml || "")};
}

function parseChallenge(xml) {
	const text = String(xml || "");
	const request = /<Request\b([^>]*)>/i.exec(text);
	const challenge = /<ChallengeResponse\b([^>]*?)(\/?)>/i.exec(text);
	if (!request || !challenge) return null;
	const attributes = parseAttributes(challenge[1]);
	const contentId = attributes.ContentId || attributes.contentId || /<ContentId>([\s\S]*?)<\/ContentId>/i.exec(text)?.[1]?.trim() || CONTENT_ID;
	return {
		id:parseAttributes(request[1]).id || "",
		response:attributes.response || "",
		key:attributes.key || "",
		version:attributes.version || "",
		contentId
	};
}

function localTimestamp() {
	const date = new Date();
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function emptyFriends(id) {
	return `<LSX><Response id="${String(id).replace(/"/g, "&quot;")}" sender="XMPP"><QueryFriendsResponse /></Response></LSX>`;
}

function queryImage(id, imageId, width, avatarPath) {
	const safe = value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	if (!avatarPath) return `<LSX><Response id="${safe(id)}" sender="EbisuSDK"><QueryImageResponse Result="1" /></Response></LSX>`;
	return `<LSX><Response id="${safe(id)}" sender="EbisuSDK"><QueryImageResponse Result="0"><Image ImageId="${safe(imageId)}" Width="${safe(width || "96")}" Height="${safe(width || "96")}" ResourcePath="${safe(avatarPath)}" /></QueryImageResponse></Response></LSX>`;
}

function xmlEscape(value) {
	return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function createResponder({account = {}, contentId = CONTENT_ID, locale = "en_US", gameVersion = "1.0.0.0", avatarPath = "", api = defaultApi, log = () => {}} = {}) {
	const profile = () => ({
		PID: account.personaId || "",
		DSNM: xmlEscape(account.playerName || ""),
		UID: account.userId || "",
		AvatarId: xmlEscape(avatarPath || "")
	});
	const system = () => ({SystemTime:localTimestamp(), Locale:locale, Version:gameVersion});
	const authCode = async settingId => {
		try {
			return await api.authorizationCode({
				accessToken:account.accessToken,
				remid:account.remid,
				sid:account.sid,
				settingId
			});
		} catch (error) {
			log({stage:"auth-code", code:error?.code || null});
			throw error;
		}
	};
	const requestLicense = async token => {
		try {
			return await api.license({
				accessToken:account.accessToken,
				remid:account.remid,
				sid:account.sid,
				requestToken:token,
				contentId
			});
		} catch (error) {
			log({stage:"license", code:error?.code || null});
			throw error;
		}
	};
	return async function respond(xml) {
		const request = parseRequest(xml);
		if (!request) return "";
		const {id, type, attributes} = request;
		const base = {ID:id, ...profile(), ...system()};
		const pick = index => fill(bfv(index), base);
		switch (type) {
			case "GetConfig":
				return pick(2);
			case "GetAuthCode": {
				const settingId = attributes.ClientId || attributes.UserId || attributes.SettingId || "";
				return fill(bfv(3), {...base, AuthCode:await authCode(settingId)});
			}
			case "GetAuthToken":
				return `<LSX><Response id="${xmlEscape(id)}" sender="Utility"><AuthToken value="${xmlEscape(account.accessToken || "")}" /></Response></LSX>`;
			case "GetBlockList":
				return pick(4);
			case "GetGameInfo": {
				const gameInfoId = attributes.GameInfoId || ""; // FREETRIAL / UPTODATE / INSTALLED_LANGUAGE
				if (gameInfoId === "FREETRIAL") return pick(19);
				if (gameInfoId === "UPTODATE") return fill(bfv(20), {...base, Locale:"true"});
				if (gameInfoId === "INSTALLED_LANGUAGE") return fill(bfv(20), {...base, Locale:locale});
				return pick(5);
			}
			case "GetInternetConnectedState":
				return pick(6);
			case "GetPresence":
				return pick(7).replace(/RichPresence="[^"]*"/u, 'RichPresence="Titanfall 2"');
			case "GetProfile":
				return pick(8);
			case "RequestLicense":
				return fill(bfv(15), {...base, License:await requestLicense(attributes.RequestToken || attributes.Token || attributes.UserId || "")});
			case "GetSetting": {
				const settingId = attributes.SettingId || "";
				if (settingId === "ENVIRONMENT") return pick(9);
				if (settingId === "IS_IGO_AVAILABLE" || settingId === "IS_IGO_ENABLED") return pick(10);
				return "";
			}
			case "QueryFriends":
				return emptyFriends(id);
			case "QueryImage":
				return queryImage(id, attributes.ImageId || attributes.UserId || "", attributes.Width || attributes.Height || "96", avatarPath);
			case "QueryPresence":
				return fill(bfv(13), base);
			case "SetPresence":
			case "SetDownloaderUtilization":
				return type === "SetPresence" ? pick(14) : pick(23);
			case "GetAllGameInfo":
				return fill(ttf2(0), base);
			case "IsProgressiveInstallationAvailable": {
				let value = pick(17);
				if (attributes.ItemId) value = value.replace(/ItemId="[^"]*"/u, `ItemId="${String(attributes.ItemId).replace(/"/g, "&quot;")}"`);
				return value;
			}
			case "QueryContent":
				if (contentId === "16426154") return pick(30);
				if (contentId === "16426154_beta") return pick(32);
				return pick(18);
			case "QueryEntitlements":
				if (contentId === "198387") return pick(27);
				if (contentId === "16426154") return pick(29);
				if (contentId === "16426154_beta") return pick(31);
				return pick(21);
			case "QueryOffers":
				return pick(22);
			case "QueryChunkStatus":
				return pick(24);
			case "GetPresenceVisibility":
				return pick(25);
			case "GetWalletBalance":
				return pick(26);
			case "GetSettings":
				return pick(28);
			default:
				log({stage:"request", type});
				return "";
		}
	};
}

function createReader(socket) {
	let buffer = Buffer.alloc(0);
	const queue = [];
	let waiting = null;
	let closed = false;
	const fail = () => {
		closed = true;
		if (waiting) { const pending = waiting; waiting = null; pending.reject(Object.assign(Error("LSX connection closed"), {code:"EA_LSX_CLOSED"})); }
	};
	const drain = () => {
		while (true) {
			const end = buffer.indexOf(0);
			if (end < 0) break;
			const message = buffer.subarray(0, end).toString("utf8");
			buffer = buffer.subarray(end + 1);
			if (waiting) { const pending = waiting; waiting = null; pending.resolve(message); }
			else queue.push(message);
		}
	};
	socket.on("data", chunk => { if (closed) return; buffer = Buffer.concat([buffer, chunk]); if (buffer.length > 1024 * 1024) { fail(); socket.destroy(); return; } drain(); });
	socket.on("close", fail);
	socket.on("error", fail);
	return () => {
		if (queue.length) return Promise.resolve(queue.shift());
		if (closed) return Promise.reject(Object.assign(Error("LSX connection closed"), {code:"EA_LSX_CLOSED"}));
		return new Promise((resolve, reject) => { waiting = {resolve, reject}; });
	};
}

function write(socket, text) {
	return new Promise((resolve, reject) => {
		const payload = Buffer.concat([Buffer.from(String(text), "utf8"), Buffer.from([0])]);
		socket.write(payload, error => error ? reject(error) : resolve());
	});
}

class EaLsxServer {
	constructor(options = {}) {
		this.options = options;
		this.port = Number.isInteger(options.port) && options.port >= 0 ? options.port : PORT;
		this.server = null;
		this.sockets = new Set();
		this.seed = 0;
		this.fixedKey = false;
		this.recent = [];
		const externalLog = typeof options.log === "function" ? options.log : null;
		this.options = {...options, log: detail => {
			this.recent.push({at:new Date().toISOString(), ...detail});
			if (this.recent.length > 80) this.recent.shift();
			try { externalLog?.(detail); } catch (_) {}
		}};
		this.respond = createResponder(this.options);
	}
	get address() { return this.server?.address(); }

	async start() {
		if (this.server) return this;
		const server = net.createServer(socket => { void this.handle(socket); });
		this.server = server;
		await new Promise((resolve, reject) => {
			const onError = error => { this.server = null; reject(Object.assign(error, {code:error.code === "EADDRINUSE" ? "EA_PORT_IN_USE" : error.code || "EA_LSX_START_FAILED"})); };
			server.once("error", onError);
			server.listen(this.port, "127.0.0.1", () => { server.off("error", onError); resolve(); });
		});
		server.on("error", error => this.options.log?.({stage:"server", code:error.code || null}));
		return this;
	}

	async stop() {
		for (const socket of this.sockets) { try { socket.destroy(); } catch (_) {} }
		this.sockets.clear();
		const server = this.server;
		this.server = null;
		if (!server) return;
		await new Promise(resolve => { try { server.close(() => resolve()); } catch (_) { resolve(); } setTimeout(resolve, 1000).unref?.(); });
	}

	async handle(socket) {
		this.sockets.add(socket);
		socket.setNoDelay?.(true);
		const read = createReader(socket);
		try {
			await write(socket, fill(bfv(0), {KEY:crypto.START_KEY}));
			const challenge = parseChallenge(await read());
			if (!challenge) throw Object.assign(Error("Invalid LSX challenge"), {code:"EA_LSX_CHALLENGE"});
			if (!crypto.checkChallengeResponse(challenge.response)) throw Object.assign(Error("LSX challenge rejected"), {code:"EA_LSX_CHALLENGE"});
			const accepted = crypto.makeChallengeResponse(challenge.key);
			this.seed = crypto.seedFromChallenge(accepted);
			this.fixedKey = challenge.version === "2";
			await write(socket, fill(bfv(1), {ID:challenge.id, RESPONSE:accepted}));
			this.options.log?.({stage:"connected", version:challenge.version || "default", contentId:challenge.contentId});
			while (!socket.destroyed) {
				let payload;
				try { payload = await read(); } catch (_) { break; }
				let request = "";
				try { request = this.fixedKey ? crypto.decryptLsxWithFixedKey(payload) : crypto.decryptLsx(payload, this.seed); }
				catch (_) { continue; }
				if (!request) continue;
				const parsed = parseRequest(request);
				let response = "";
				try { response = await this.respond(request); }
				catch (error) {
					this.options.log?.({stage:"error", type:parsed?.type || null, code:error?.code || null});
					// Keep the connection alive: a transient EA auth/license request
					// must not take down the local endpoint while the game retries.
					response = "";
				}
				const detail = {stage:"request", type:parsed?.type || "unknown", bytes:response.length};
				if (parsed?.type === "RequestLicense" && /License=""/u.test(response)) detail.empty = true;
				if (parsed?.type === "GetAuthCode" && /AuthCode value=""/u.test(response)) detail.empty = true;
				if (parsed?.type === "GetAuthToken" && /AuthToken value=""/u.test(response)) detail.empty = true;
				this.options.log?.(detail);
				const encrypted = response ? this.fixedKey ? crypto.encryptLsxWithFixedKey(response) : crypto.encryptLsx(response, this.seed) : "";
				await write(socket, encrypted);
			}
		} catch (error) {
			if (error?.code !== "EA_LSX_CLOSED") this.options.log?.({stage:"closed", code:error?.code || null});
		} finally {
			this.sockets.delete(socket);
			try { socket.destroy(); } catch (_) {}
		}
	}
}

module.exports = {EaLsxServer, createResponder, parseRequest, parseChallenge, PORT, CONTENT_ID};
