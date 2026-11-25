"use strict";

// This record deliberately contains facts, not log text or a guessed diagnosis.
// Keep a fixed schema so paths, arguments, mod names and account data cannot
// accidentally enter the persisted record or a shared diagnostic export.
const {CONNECTION_CODES} = require("./northstar-health");
const {randomUUID} = require("crypto");
const STAGES = Object.freeze(["preflight", "client", "skins", "ea", "spawn", "game", "northstar", "confirmation"]);
const STATUSES = new Set(["pending", "active", "observed", "failed", "unconfirmed"]);
const OUTCOMES = new Set(["launching", "confirmed", "preflight-failed", "client-failed", "skins-failed", "ea-failed", "spawn-failed", "game-closed", "northstar-not-ready", "official-mod-not-ready", "timeout", "unknown"]);
const ACTIONS = new Set(["retry", "settings", "client", "platform", "mods", "issue"]);
const EVIDENCE = new Set(["EA_NOT_INSTALLED", "EA_START_FAILED", "EA_START_TIMEOUT", "EA_PROCESS_QUERY_FAILED", "GAME_ALREADY_RUNNING", "NORTHSTAR_OTHER_INSTANCE", "GAME_DIRECTORY_INVALID", "GAME_ASSETS_MISSING", "GAME_FILE_UNREADABLE", "PROCESS_QUERY_FAILED", "SELECTION_CHANGED", "SKIN_OPERATION_BUSY", "NORTHSTAR_NOT_READY", "NORTHSTAR_CORE_DISABLED", "NORTHSTAR_CORE_DUPLICATE", "CLEAN_PROXY_RECOVERY", "OFFICIAL_MOD_NOT_READY", "VANILLA_CLIENT_NOT_INSTALLED", "VANILLA_RUNTIME_OUTDATED", "LAUNCH_EARLY_EXIT", "LAUNCHER_EARLY_EXIT", "LAUNCH_TIMEOUT", "ENOENT", "EACCES", "UNKNOWN"]);
const MAX_MS = 24 * 60 * 60 * 1000;
function duration(value) {return Number.isFinite(value) ? Math.max(0, Math.min(MAX_MS, Math.round(value))) : null;}
function version(value) {return typeof value === "string" && /^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-(?:alpha|beta|rc)\.\d{1,5})?$/.test(value) ? value : null;}
function timestamp(value) {return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;}
function sanitizeReport(input) {
  if (!input || input.schema !== 1 || !/^[a-f0-9-]{36}$/.test(input.id || "") || !["northstar", "vanilla"].includes(input.gameVersion)) return null;
  const stages = new Map();
  for (const item of Array.isArray(input.stages) ? input.stages.slice(0, 32) : []) {
    if (STAGES.includes(item?.code) && STATUSES.has(item.status)) stages.set(item.code, {code:item.code, status:item.status, elapsedMs:duration(item.elapsedMs)});
  }
  return {
    ...(CONNECTION_CODES.has(input.connection?.code) ? {connection:{code:input.connection.code, authenticated:input.connection.authenticated === true}} : {}),
    schema:1, id:input.id, appVersion:version(input.appVersion), gameVersion:input.gameVersion,
    officialMods:input.gameVersion === "vanilla" && input.officialMods === true,
    region:input.gameVersion === "northstar" && ["cn", "global"].includes(input.region) ? input.region : null,
    state:["starting", "confirmed", "failed"].includes(input.state) ? input.state : "failed",
    startedAt:timestamp(input.startedAt), updatedAt:timestamp(input.updatedAt), elapsedMs:duration(input.elapsedMs),
    clientVersion:version(input.clientVersion), attempts:Number.isSafeInteger(input.attempts) ? Math.max(0, Math.min(2, input.attempts)) : 0,
    stages:STAGES.filter(code => stages.has(code)).map(code => stages.get(code)),
    outcome:{code:OUTCOMES.has(input.outcome?.code) ? input.outcome.code : "unknown", causeKnown:input.outcome?.causeKnown === true,
      evidenceCode:EVIDENCE.has(input.outcome?.evidenceCode) ? input.outcome.evidenceCode : null,
      actions:[...new Set((Array.isArray(input.outcome?.actions) ? input.outcome.actions : []).filter(value => ACTIONS.has(value)))].slice(0, 6)}
  };
}

function failureOutcome(error, phase) {
  const code = EVIDENCE.has(error?.code) ? error.code : "UNKNOWN";
  const base = {causeKnown:false, evidenceCode:code, actions:["retry", "issue"]};
  if (["GAME_DIRECTORY_INVALID", "GAME_ASSETS_MISSING", "GAME_FILE_UNREADABLE"].includes(code)) return {...base, code:"preflight-failed", causeKnown:true, actions:["settings", "client", "issue"]};
  if (["GAME_ALREADY_RUNNING", "NORTHSTAR_OTHER_INSTANCE", "SELECTION_CHANGED", "SKIN_OPERATION_BUSY"].includes(code)) return {...base, code:"preflight-failed", causeKnown:true, actions:["retry", "settings"]};
  if (code === "CLEAN_PROXY_RECOVERY") return {...base, code:"preflight-failed", causeKnown:true, actions:["settings", "retry"]};
  if (code.startsWith("EA_")) return {...base, code:"ea-failed", causeKnown:code === "EA_NOT_INSTALLED", actions:["platform", "retry", "issue"]};
  if (["NORTHSTAR_NOT_READY", "NORTHSTAR_CORE_DISABLED", "NORTHSTAR_CORE_DUPLICATE"].includes(code)) return {...base, code:"northstar-not-ready", causeKnown:code !== "NORTHSTAR_NOT_READY", actions:["client", "mods", "issue"]};
  if (code === "OFFICIAL_MOD_NOT_READY") return {...base, code:"official-mod-not-ready", actions:["client", "mods", "issue"]};
  if (["VANILLA_CLIENT_NOT_INSTALLED", "VANILLA_RUNTIME_OUTDATED"].includes(code)) return {...base, code:"client-failed", causeKnown:true, actions:["client", "issue"]};
  if (code === "LAUNCH_TIMEOUT") return {...base, code:"timeout", actions:["platform", "client", "issue"]};
  if (code === "LAUNCH_EARLY_EXIT") return {...base, code:"game-closed", actions:["retry", "platform", "issue"]};
  if (code === "LAUNCHER_EARLY_EXIT") return {...base, code:"spawn-failed", actions:["platform", "client", "issue"]};
  if (["ENOENT", "EACCES"].includes(code) && phase === "spawn") return {...base, code:"spawn-failed", causeKnown:true, actions:["client", "settings", "issue"]};
  const byPhase = {preflight:["preflight-failed", "settings"], client:["client-failed", "client"], skins:["skins-failed", "settings"], ea:["ea-failed", "platform"], spawn:["spawn-failed", "client"]};
  return byPhase[phase] ? {...base, code:byPhase[phase][0], actions:[byPhase[phase][1], "retry", "issue"]} : {...base, code:"unknown"};
}

class LaunchDiagnostics {
  constructor({now = Date.now, id = randomUUID, appVersion, onChange = () => {}, persist = () => {}} = {}) {
    Object.assign(this, {now, id, appVersion, onChange, persist}); this.current = null; this.started = 0; this.phase = "preflight";
  }
  begin(gameVersion, options = {}) {
    this.started = this.now(); this.phase = "preflight";
    const officialMods = gameVersion === "vanilla" && options?.officialMods === true;
    this.current = {schema:1, id:this.id(), appVersion:version(this.appVersion), gameVersion:gameVersion === "vanilla" ? "vanilla" : "northstar", officialMods, region:null,
      state:"starting", startedAt:new Date(this.started).toISOString(), updatedAt:new Date(this.started).toISOString(), elapsedMs:0, clientVersion:null, attempts:0,
      stages:STAGES.filter(code => gameVersion !== "vanilla" || officialMods || !["client", "northstar"].includes(code)).map(code => ({code, status:"pending", elapsedMs:null})),
      outcome:{code:"launching", causeKnown:false, evidenceCode:null, actions:[]}};
    this.stage("preflight", "active"); return this.current.id;
  }
  load(input) {this.current = sanitizeReport(input); return this.report();}
  report() {return sanitizeReport(this.current);}
  commit() {
    if (!this.current) return;
    this.current.updatedAt = new Date(this.now()).toISOString(); this.current.elapsedMs = duration(this.now() - this.started);
    const report = this.report();
    // Diagnostics must never make a healthy game launch fail.
    try {this.persist(report);} catch (_) {}
    try {this.onChange(report);} catch (_) {}
  }
  update(input = {}) {
    if (!this.current || this.current.state !== "starting") return;
    if (["cn", "global"].includes(input.region)) this.current.region = input.region;
    if (version(input.clientVersion)) this.current.clientVersion = input.clientVersion;
    if (Number.isSafeInteger(input.attempts)) this.current.attempts = Math.max(0, Math.min(2, input.attempts));
    this.commit();
  }
  stage(code, status) {
    if (!this.current || this.current.state !== "starting" || !STATUSES.has(status)) return;
    const item = this.current.stages.find(value => value.code === code); if (!item) return;
    if (status === "active") this.phase = code;
    if (item.status === status || item.status === "observed" && status !== "failed") return;
    item.status = status; item.elapsedMs = duration(this.now() - this.started);
    this.commit();
  }
  observe(snapshot, session) {
    if (!this.current || this.current.state !== "starting" || !snapshot?.ok || !session?.spawned) return;
    const processes = Array.isArray(snapshot.processes) ? snapshot.processes : [];
    const game = processes.some(item => !session.baselinePids.has(String(item.pid)) &&
      (["titanfall2.exe", "titanfall2-unpacked.exe"].includes(String(item.image).toLowerCase()) && (!session.bootstrapHandoff || String(item.pid) !== session.childPid) ||
       String(item.image).toLowerCase() === "northstarlauncher.exe" && String(item.pid) === session.childPid && (session.entered || session.ready)));
    if (game) this.stage("game", "observed");
  }
  connection(value) {
    if (!this.current || this.current.gameVersion !== "northstar" || !CONNECTION_CODES.has(value?.code)) return;
    if (this.current.connection?.code === value.code && this.current.connection.authenticated === value.authenticated) return;
    this.current.connection = {code:value.code, authenticated:value.authenticated === true};
    this.commit();
  }
  finish(error) {
    if (!this.current || this.current.state !== "starting") return;
    const failed = Boolean(error); this.current.state = failed ? "failed" : "confirmed";
    this.current.outcome = failed ? failureOutcome(error, this.phase) : {code:"confirmed", causeKnown:false, evidenceCode:null, actions:[]};
    if (["LAUNCH_EARLY_EXIT", "LAUNCHER_EARLY_EXIT"].includes(error?.code) && (this.current.gameVersion === "northstar" || this.current.officialMods)) this.current.outcome.actions.splice(1, 0, "mods");
    if (this.current.gameVersion === "vanilla" && !this.current.officialMods) this.current.outcome.actions = [...new Set(this.current.outcome.actions.map(action => ["client", "mods"].includes(action) ? "settings" : action))];
    for (const item of this.current.stages) {
      if (item.status === "active") item.status = failed && item.code === this.phase ? "failed" : "unconfirmed";
      else if (item.status === "pending") item.status = "unconfirmed";
    }
    // Confirmation already requires stable process snapshots (and Northstar
    // core/menu log evidence). Never infer those facts merely from spawn().
    if (!failed) for (const code of ["game", "confirmation", ...(this.current.gameVersion === "northstar" || this.current.officialMods ? ["northstar"] : [])]) {
      const item = this.current.stages.find(value => value.code === code); if (item) {item.status = "observed"; item.elapsedMs ??= duration(this.now() - this.started);}
    }
    this.commit();
  }
}
module.exports = {STAGES, STATUSES, OUTCOMES, ACTIONS, EVIDENCE, MAX_MS, sanitizeReport, failureOutcome, LaunchDiagnostics};
