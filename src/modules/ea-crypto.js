"use strict";

// EA App / Origin launch emulation crypto.
// Ported from the EAappEmulater core (EaCrypto.cs) so the launcher can talk to
// the game's Ebisu/EALS endpoints without a running EA Desktop client.
const crypto = require("crypto");

const CHALLENGE_KEY = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
const LICENSE_KEY = Buffer.from([65, 50, 114, 45, 208, 130, 239, 176, 220, 100, 87, 197, 118, 104, 202, 9]);
const LICENSE_IV = Buffer.alloc(16);
const START_KEY = "cacf897a20b6d612ad0c05e011df52bb";
const PRIME_10000TH = 104729;
const PRIME_20000TH = 224737;
const PRIME_30000TH = 350377;
const PC_SIGN_V1 = "ISa3dpGOc8wW7Adn4auACSQmaccrOyR2";
const PC_SIGN_V2 = "nt5FfJbdPzNcl2pkC3zgjO43Knvscxft";

function uint32(value) { return value >>> 0; }

// The C# implementation uses CryptoStream once; keep this small helper separate
// so a caller cannot accidentally reuse a finalised cipher.
function encryptEcbHex(key, data) {
	const cipher = crypto.createCipheriv(`aes-${key.length * 8}-ecb`, key, null);
	return Buffer.concat([cipher.update(data), cipher.final()]).toString("hex");
}

function decryptEcbHex(key, hex) {
	const bytes = hexToBytes(hex);
	if (!bytes.length) return "";
	try {
		const decipher = crypto.createDecipheriv(`aes-${key.length * 8}-ecb`, key, null);
		return Buffer.concat([decipher.update(bytes), decipher.final()]).toString("utf8");
	} catch (_) {
		return "";
	}
}

function hexToBytes(value) {
	const text = String(value || "").toLowerCase().replace(/[^0-9a-f]/g, "");
	if (!text || text.length % 2) return Buffer.alloc(0);
	return Buffer.from(text, "hex");
}

function checkChallengeResponse(response, expected = START_KEY) {
	try {
		const bytes = hexToBytes(response);
		if (!bytes.length) return false;
		const decipher = crypto.createDecipheriv("aes-128-ecb", CHALLENGE_KEY, null);
		const actual = Buffer.concat([decipher.update(bytes), decipher.final()]);
		const target = Buffer.from(String(expected), "ascii");
		return actual.length === target.length && crypto.timingSafeEqual(actual, target);
	} catch (_) {
		return false;
	}
}

function makeChallengeResponse(key) {
	return encryptEcbHex(CHALLENGE_KEY, Buffer.from(String(key), "ascii"));
}

function makeChallengeResponseBytes(key) {
	return Buffer.from(makeChallengeResponse(key), "hex");
}

// C# CRandom (MSVC rand) seeded twice, matching EaCrypto.GetLSXKey.
function createRandom(seed) {
	let state = seed >>> 0;
	return {
		seed(value) { state = value >>> 0; },
		rand() {
			state = (Math.imul(state, 214013) + 2531011) >>> 0;
			return (state >>> 16) & 0xffff;
		}
	};
}

function lsxKey(seed) {
	const random = createRandom(7);
	random.seed((random.rand() + (seed >>> 0)) >>> 0);
	const key = Buffer.alloc(16);
	for (let i = 0; i < 16; i++) key[i] = random.rand() & 0xff;
	return key;
}

// Seed is taken from the first two *hex characters* of the challenge response,
// exactly as LSXTcpServer.cs does. This is intentionally not a hex parse.
function seedFromChallenge(responseHex) {
	return ((responseHex.charCodeAt(0) & 0xff) << 8) | (responseHex.charCodeAt(1) & 0xff);
}

function decryptLsx(hex, seed) {
	return decryptEcbHex(lsxKey(seed), hex);
}

function encryptLsx(text, seed) {
	return encryptEcbHex(lsxKey(seed), Buffer.from(String(text), "utf8"));
}

function decryptLsxWithFixedKey(hex) {
	return decryptEcbHex(CHALLENGE_KEY, hex);
}

function encryptLsxWithFixedKey(text) {
	return encryptEcbHex(CHALLENGE_KEY, Buffer.from(String(text), "ascii"));
}

// RTP handshake code used as EARtPLaunchCode. uint32 overflow semantics are
// part of the value, so every operation is explicitly reduced to 32 bits.
function rtpHandshakeCode(date = new Date()) {
	const year = BigInt(date.getUTCFullYear());
	const month = BigInt(date.getUTCMonth() + 1);
	const day = BigInt(date.getUTCDate());
	let value = Number((BigInt(PRIME_10000TH) * year) ^ (month * BigInt(PRIME_20000TH)) ^ (day * BigInt(PRIME_30000TH))) >>> 0;
	value = (value ^ (value << 16) ^ (value >>> 16)) >>> 0;
	return String(value);
}

// https://proxy.novafusion.ea.com/licenses returns AES-CBC data without PKCS#7
// padding. Return the decoded XML so the caller can extract <GameToken>.
function decryptLicense(input) {
	const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input || "");
	if (!bytes.length) return "";
	const usable = bytes.length - (bytes.length % 16);
	if (!usable) return "";
	try {
		const decipher = crypto.createDecipheriv("aes-128-cbc", LICENSE_KEY, LICENSE_IV);
		decipher.setAutoPadding(false);
		return Buffer.concat([decipher.update(bytes.subarray(0, usable)), decipher.final()]).toString("utf8");
	} catch (_) {
		return "";
	}
}

function gameTokenFromLicense(input) {
	const text = decryptLicense(input).replace(/\u0005/g, "");
	const match = /<GameToken>([\s\S]*?)<\/GameToken>/i.exec(text);
	return match ? match[1] : "";
}

function base64url(input) {
	return Buffer.from(input).toString("base64").replace(/=+$/u, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fnv1a64(data) {
	let hash = 0xcbf29ce484222325n;
	for (const byte of data) {
		hash ^= BigInt(byte);
		hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
	}
	return hash;
}

function timestamp(date = new Date()) {
	const pad = (value, size = 2) => String(value).padStart(size, "0");
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}:${pad(date.getUTCMilliseconds(), 3)}`;
}

// Hardware fields are best-effort. EA accepts the same fallback values the
// original emulator uses when WMI is unavailable, so a missing serial never
// blocks an otherwise valid sign-in.
function createPcSign({hardware = {}, date = new Date(), version} = {}) {
	const secretVersion = version === "v1" || version === "v2" ? version : (crypto.randomBytes(1)[0] & 1) === 0 ? "v1" : "v2";
	const boardManufacturer = hardware.boardManufacturer || "Microsoft Corporation";
	const boardSerial = hardware.boardSerial || "None";
	const biosManufacturer = hardware.biosManufacturer || "Microsoft Corporation";
	const biosSerial = hardware.biosSerial || "None";
	const osInstallDate = hardware.osInstallDate || "1970-01-0100:00:00.000000000+0000";
	const osSerial = hardware.osSerial || "None";
	const diskSerial = hardware.diskSerial || "None";
	const gpuId = Number.isFinite(Number(hardware.gpuId)) ? Number(hardware.gpuId) : 0;
	const mac = typeof hardware.mac === "string" && hardware.mac ? hardware.mac : null;
	const midSource = boardManufacturer + boardSerial + biosManufacturer + biosSerial + osInstallDate + osSerial + (mac || "");
	const payload = {av:"v1", bsn:biosSerial, gid:gpuId, hsn:diskSerial};
	if (mac) payload.mac = mac;
	payload.mid = String(fnv1a64(Buffer.from(midSource, "utf8")));
	payload.msn = boardSerial;
	payload.sv = secretVersion;
	payload.ts = timestamp(date);
	const encoded = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
	const signature = crypto.createHmac("sha256", Buffer.from(secretVersion === "v1" ? PC_SIGN_V1 : PC_SIGN_V2, "ascii"))
		.update(Buffer.from(encoded, "ascii")).digest();
	return encoded + "." + base64url(signature);
}

module.exports = {
	START_KEY,
	checkChallengeResponse,
	makeChallengeResponse,
	makeChallengeResponseBytes,
	seedFromChallenge,
	decryptLsx,
	encryptLsx,
	decryptLsxWithFixedKey,
	encryptLsxWithFixedKey,
	rtpHandshakeCode,
	decryptLicense,
	gameTokenFromLicense,
	createPcSign,
	lsxKey,
	hexToBytes
};
