"use strict";

const {requestBuffer} = require("./http-resource");
const crypto = require("crypto");

const SOURCES = Object.freeze({
  cn: Object.freeze({region: "cn", name: "Northstar CN", url: "https://nscn.wolf109909.top/client/servers"}),
  global: Object.freeze({region: "global", name: "Northstar Global", url: "https://northstar.tf/client/servers"})
});
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SERVERS = 500;
const TTL = 60000;

function cleanText(value, limit) {
  if (typeof value !== "string") return "";
  return value.replace(/\^[0-9a-f]{8}/gi, "").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").trim().slice(0, limit);
}
function count(value) {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(10000, Math.trunc(n))) : 0;
}
function normalizePayload(payload, region) {
  if (!Array.isArray(payload)) throw Object.assign(new Error("Invalid server list"), {code: "format"});
  const servers = [];
  for (const row of payload.slice(0, MAX_SERVERS)) {
    if (!row || typeof row !== "object" || Array.isArray(row) || !cleanText(row.name, 150)) continue;
    const name = cleanText(row.name, 150);
    const map = cleanText(row.map, 100);
    const mods = Array.isArray(row.modInfo?.Mods) ? row.modInfo.Mods : [];
    // Only public presentation fields cross IPC; raw IDs, addresses and auth
    // data are never returned or written to the launcher configuration.
    const key = crypto.createHash("sha256").update(region + ":" + String(row.id || "") + ":" + name + ":" + map).digest("hex").slice(0, 20);
    servers.push({
      key, name, description: cleanText(row.description, 1000),
      players: count(row.playerCount), maxPlayers: count(row.maxPlayers),
      map, mode: cleanText(row.playlist, 100), location: cleanText(row.region, 80),
      password: row.hasPassword === true,
      requiredMods: mods.filter(mod => mod && mod.RequiredOnClient === true)
        .slice(0, 30).map(mod => ({name: cleanText(mod.Name, 100), version: cleanText(mod.Version, 40)}))
        .filter(mod => mod.name)
    });
  }
  if (payload.length && !servers.length) throw Object.assign(new Error("Invalid server entries"), {code: "format"});
  return {servers, truncated: payload.length > MAX_SERVERS, reportedCount: payload.length};
}

async function fetchOnce(source, options) {
  try {
    const host = new URL(source.url).hostname;
    const result = await requestBuffer(source.url, {
      ...options, allowURL: url => url.hostname === host,
      maxBytes: MAX_BYTES,
      headers: {Accept: "application/json", "User-Agent": "TFX server-list"}
    });
    try { return JSON.parse(result.bytes.toString("utf8")); }
    catch (_) { throw Object.assign(new Error("Invalid server response"), {code: "format"}); }
  } catch (error) {
    const code = {TIMEOUT: "timeout", RESPONSE_TOO_LARGE: "too-large", HTTP_ERROR: "http", RATE_LIMIT: "http"}[error.code];
    if (code) error.code = code;
    throw error;
  }
}

async function fetchPayload(source, options = {}) {
  const timeoutMs = options.timeoutMs ?? (source.region === 'global' ? 8500 : 10000);
  const fetch = () => fetchOnce(source, {...options, timeoutMs});
  try {return await fetch();}
  catch (error) {
    if (source.region !== 'global' || !['timeout','NETWORK','TRUNCATED'].includes(error.code)) throw error;
    return fetch();
  }
}

function createService(options = {}) {
  const request = options.fetchPayload || fetchPayload;
  const now = options.now || Date.now;
  const state = new Map();
  function response(source, entry, status, error = "") {
    return {
      status, error, region: source.region, source: source.name, sourceUrl: source.url,
      fetchedAt: entry?.fetchedAt ?? null, checkedAt: now(),
      servers: entry?.data?.servers || [], truncated: entry?.data?.truncated || false,
      reportedCount: entry?.data?.reportedCount || 0
    };
  }
  async function get(input = {}) {
    if (!input || typeof input !== "object" || !Object.hasOwn(SOURCES, input.region)) {
      throw new Error("Unknown server-list region");
    }
    const source = SOURCES[input.region];
    let entry = state.get(source.region);
    if (!entry) { entry = {data: null, fetchedAt: null, attemptedAt: null, inflight: null}; state.set(source.region, entry); }
    if (entry.inflight) return entry.inflight;
    const age = entry.fetchedAt === null ? Infinity : now() - entry.fetchedAt;
    if (entry.data && (age < TTL && input.force !== true || age < 5000)) return response(source, entry, entry.lastError ? "stale" : "online", entry.lastError || "");
    // Avoid a failed endpoint being hammered when users repeatedly reopen home.
    if (!input.force && entry.attemptedAt !== null && now() - entry.attemptedAt < 5000) {
      return response(source, entry, entry.data ? "stale" : "unavailable", entry.lastError || "network");
    }
    entry.attemptedAt = now();
    entry.inflight = (async () => {
      try {
        const data = normalizePayload(await request(source), source.region);
        entry.data = data; entry.fetchedAt = now(); entry.lastError = "";
        return response(source, entry, "online");
      } catch (error) {
        const code = ["timeout", "http", "format", "too-large"].includes(error?.code) ? error.code : "network";
        entry.lastError = code;
        return response(source, entry, entry.data ? "stale" : "unavailable", code);
      } finally { entry.inflight = null; }
    })();
    return entry.inflight;
  }
  return Object.freeze({get});
}

function register(ipcMain) {
  const service = createService();
  ipcMain.handle("server-list-get", (_event, input) => service.get(input));
  return service;
}

module.exports = {SOURCES, normalizePayload, fetchPayload, createService, register};
