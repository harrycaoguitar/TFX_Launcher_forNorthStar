"use strict";

// Small EA/JUNO API client used by the optional account sign-in and by the
// local Ebisu/LSX responder. Network failures are reported with stable codes so
// launch diagnostics can explain them without leaking tokens.
const {gameTokenFromLicense} = require("./ea-crypto");

const TOKEN_ENDPOINT = "https://accounts.ea.com/connect/token";
const AUTH_ENDPOINT = "https://accounts.ea.com/connect/auth";
const IDENTITY_ENDPOINT = "https://gateway.ea.com/proxy/identity/pids/me/personas";
const LICENSE_ENDPOINT = "https://proxy.novafusion.ea.com/licenses";
const GRAPHQL_ENDPOINT = "https://service-aggregation-layer.juno.ea.com/graphql";
const CLIENT_ID = "JUNO_PC_CLIENT";
const CLIENT_SECRET = "4mRLtYMb6vq9qglomWEaT4ChxsXWcyqbQpuBNfMPOYOiDmYYQmjuaBsF2Zp0RyVeWkfqhE9TuGgAw7te";
const REDIRECT_URI = "qrc:///html/login_successful.html";

function apiError(code, message, extra = {}) {
	return Object.assign(new Error(message), {code}, extra);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, {...options, signal:controller.signal});
	} catch (error) {
		if (error?.name === "AbortError") throw apiError("EA_NETWORK_TIMEOUT", "连接 EA 超时，请检查网络后重试。");
		throw apiError("EA_NETWORK_FAILED", "无法连接 EA 服务，请检查网络后重试。", {cause:error?.message});
	} finally {
		clearTimeout(timer);
	}
}

async function readJson(response) {
	const text = await response.text();
	try {
		return text ? JSON.parse(text) : {};
	} catch (_) {
		return {_text:text};
	}
}

function readSetCookies(response) {
	const result = {};
	let values = [];
	try { values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : []; } catch (_) {}
	for (const value of values) {
		const pair = String(value).split(";", 1)[0];
		const index = pair.indexOf("=");
		if (index <= 0) continue;
		const name = pair.slice(0, index).trim().toLowerCase();
		const cookie = pair.slice(index + 1).trim();
		if ((name === "remid" || name === "sid") && cookie) result[name] = cookie;
	}
	return result;
}

function cookieHeader(remid, sid) {
	const parts = [];
	if (typeof remid === "string" && remid.trim()) parts.push("remid=" + remid.trim());
	if (typeof sid === "string" && sid.trim()) parts.push("sid=" + sid.trim());
	return parts.join("; ");
}

function tokenErrorCode(payload) {
	const value = payload?.error || payload?.error_code || payload?.error_number;
	if (!value) return "EA_TOKEN_REJECTED";
	const text = String(value).toLowerCase();
	if (text.includes("invalid_grant")) return "EA_TOKEN_EXPIRED";
	if (text.includes("invalid_client")) return "EA_CLIENT_REJECTED";
	return "EA_TOKEN_REJECTED";
}

async function exchangeCode({code, codeVerifier}) {
	if (!code || !codeVerifier) throw apiError("EA_LOGIN_CALLBACK_INVALID", "EA 登录回调缺少授权码，请重新登录。");
	const body = new URLSearchParams({
		grant_type:"authorization_code",
		code,
		code_verifier:codeVerifier,
		client_id:CLIENT_ID,
		client_secret:CLIENT_SECRET,
		redirect_uri:REDIRECT_URI,
		token_format:"JWS"
	});
	const response = await fetchWithTimeout(TOKEN_ENDPOINT, {
		method:"POST",
		headers:{"Content-Type":"application/x-www-form-urlencoded"},
		body:body.toString()
	});
	const json = await readJson(response);
	if (!response.ok || json.error || !json.access_token) {
		throw apiError(tokenErrorCode(json), "EA 登录未完成，请重新登录。", {status:response.status});
	}
	return {
		accessToken:String(json.access_token),
		refreshToken:typeof json.refresh_token === "string" ? json.refresh_token : "",
		tokenType:typeof json.token_type === "string" ? json.token_type : "Bearer",
		expiresIn:Number(json.expires_in) > 0 ? Number(json.expires_in) : 0,
		cookies:readSetCookies(response)
	};
}

async function refreshToken(refresh) {
	if (!refresh) throw apiError("EA_REFRESH_MISSING", "EA 登录已过期，请重新登录。");
	const body = new URLSearchParams({
		grant_type:"refresh_token",
		refresh_token:refresh,
		client_id:CLIENT_ID,
		client_secret:CLIENT_SECRET
	});
	const response = await fetchWithTimeout(TOKEN_ENDPOINT, {
		method:"POST",
		headers:{"Content-Type":"application/x-www-form-urlencoded"},
		body:body.toString()
	});
	const json = await readJson(response);
	if (!response.ok || json.error || !json.access_token) {
		throw apiError("EA_REFRESH_FAILED", "EA 登录已过期，请重新登录。", {status:response.status});
	}
	return {
		accessToken:String(json.access_token),
		refreshToken:typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : refresh,
		tokenType:typeof json.token_type === "string" ? json.token_type : "Bearer",
		expiresIn:Number(json.expires_in) > 0 ? Number(json.expires_in) : 0,
		cookies:readSetCookies(response)
	};
}

async function identity(accessToken) {
	if (!accessToken) throw apiError("EA_LOGIN_REQUIRED", "尚未登录 EA 账号。");
	const response = await fetchWithTimeout(IDENTITY_ENDPOINT, {
		headers:{"X-Expand-Results":"true", "Authorization":"Bearer " + accessToken}
	});
	const json = await readJson(response);
	if (response.status === 401) throw apiError("EA_TOKEN_EXPIRED", "EA 登录已过期，请重新登录。", {status:401});
	if (!response.ok) throw apiError("EA_IDENTITY_FAILED", "读取 EA 账号信息失败，请稍后重试。", {status:response.status});
	const personas = json?.personas?.persona;
	const list = Array.isArray(personas) ? personas : personas ? [personas] : [];
	const persona = list.find(item => item?.namespaceName === "cem_ea_id") || list[0];
	if (!persona) throw apiError("EA_PERSONA_MISSING", "EA 账号没有可用的玩家档案。");
	return {
		playerName:typeof persona.displayName === "string" ? persona.displayName : "",
		personaId:persona.personaId === undefined || persona.personaId === null ? "" : String(persona.personaId),
		userId:persona.pidId === undefined || persona.pidId === null ? "" : String(persona.pidId)
	};
}

async function authorizationCode({accessToken, remid, sid, settingId}) {
	if (!accessToken) throw apiError("EA_LOGIN_REQUIRED", "EA 模拟器需要先登录 EA 账号。");
	if (!settingId) throw apiError("EA_AUTH_CODE_INVALID", "EA 登录授权参数无效。");
	const url = new URL(AUTH_ENDPOINT);
	url.searchParams.set("access_token", accessToken);
	url.searchParams.set("client_id", settingId);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("release_type", "prod");
	const headers = {
		"User-Agent":"Mozilla/5.0 EA Download Manager Origin/10.5.94.46774",
		"X-Origin-Platform":"PCWIN",
		"localeInfo":"zh_TW"
	};
	const cookie = cookieHeader(remid, sid);
	if (cookie) headers.Cookie = cookie + ";";
	const response = await fetchWithTimeout(url, {headers, redirect:"manual"});
	const location = response.headers.get("location");
	if (location) {
		try {
			const callback = new URL(location);
			const code = callback.searchParams.get("code");
			if (code) return code;
		} catch (_) {}
		const match = /[?&#]code=([^&#]+)/u.exec(location);
		if (match) return decodeURIComponent(match[1]);
	}
	if (response.status === 401 || response.status === 403) throw apiError("EA_TOKEN_EXPIRED", "EA 登录已过期，请重新登录。", {status:response.status});
	throw apiError("EA_AUTH_CODE_FAILED", "EA 未能签发启动授权码，请重新登录后重试。", {status:response.status});
}

async function license({accessToken, remid, sid, requestToken, contentId}) {
	if (!accessToken) throw apiError("EA_LOGIN_REQUIRED", "EA 模拟器需要先登录 EA 账号。");
	const url = new URL(LICENSE_ENDPOINT);
	url.searchParams.set("ea_eadmtoken", accessToken);
	url.searchParams.set("requestToken", String(requestToken || ""));
	url.searchParams.set("contentId", String(contentId || ""));
	url.searchParams.set("machineHash", "1");
	url.searchParams.set("requestType", "0");
	const headers = {
		"User-Agent":"EACTransaction",
		"X-Requester-Id":"Origin Online Activation"
	};
	const cookie = cookieHeader(remid, sid);
	if (cookie) headers.Cookie = cookie + ";";
	const response = await fetchWithTimeout(url, {headers});
	if (!response.ok) throw apiError("EA_LICENSE_FAILED", "EA 未能签发游戏许可证，请重新登录后重试。", {status:response.status});
	const bytes = Buffer.from(await response.arrayBuffer());
	const token = gameTokenFromLicense(bytes);
	if (!token) throw apiError("EA_LICENSE_EMPTY", "EA 返回的许可证无效，请重新登录后重试。");
	return token;
}

async function avatar(accessToken, userId) {
	if (!accessToken || !userId) return null;
	const query = `query { u0: playerByPd(pd: ${Number(userId) || 0}) { avatar { avatarId, large { path } } } }`;
	const response = await fetchWithTimeout(GRAPHQL_ENDPOINT, {
		method:"POST",
		headers:{"Content-Type":"application/json", "Authorization":"Bearer " + accessToken},
		body:JSON.stringify({query})
	});
	if (!response.ok) return null;
	const json = await readJson(response);
	const entry = json?.data?.u0;
	const path = entry?.avatar?.large?.path;
	return typeof path === "string" && /^https:\/\//i.test(path)
		? {path, avatarId:entry?.avatar?.avatarId === undefined ? "" : String(entry.avatar.avatarId)}
		: null;
}

async function downloadAvatar(url) {
	const response = await fetchWithTimeout(url);
	if (!response.ok) return null;
	const type = String(response.headers.get("content-type") || "");
	if (type && !/^image\//i.test(type)) return null;
	const bytes = Buffer.from(await response.arrayBuffer());
	if (!bytes.length || bytes.length > 8 * 1024 * 1024) return null;
	return bytes;
}

module.exports = {
	CLIENT_ID,
	REDIRECT_URI,
	exchangeCode,
	refreshToken,
	identity,
	authorizationCode,
	license,
	avatar,
	downloadAvatar,
	cookieHeader
};
