"use strict";

const fs = require("fs"), path = require("path"), crypto = require("crypto");
const state = require("./mod-enabled-state");
const {OFFICIAL_PROFILE} = require("./northstar-region");
const {StringDecoder} = require("string_decoder");
const CORE = Object.freeze(["Northstar.Client", "Northstar.Custom", "Northstar.CustomServers"]);
const fail = message => Object.assign(Error(message), {code:"OFFICIAL_MOD_NOT_READY"});

// One captured launch mode owns its loader switches. Profile/network switches
// from a community launch must never turn the clean EA choice into Northstar.
function argumentsFor(input, {mods = false, profile = OFFICIAL_PROFILE} = {}) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    const argument = input[i];
    if (/^-(?:northstar|vanilla|norestrictservercommands|noallocconsole)(?:=|$)/i.test(argument)) continue;
    if (/^-(?:profile|northstardll)(?:=|$)/i.test(argument) || /^\+ns_[^=]+(?:=|$)/i.test(argument)) {
      if (!argument.includes("=") && input[i + 1] && !/^[+-]/.test(input[i + 1])) i++;
      continue;
    }
    result.push(argument);
  }
  if (mods) {
    if (typeof profile !== "string" || !profile || path.isAbsolute(profile) || profile.split(/[\\/]/).some(part => !part || part === "." || part === "..") || /[\x00-\x1f"]/u.test(profile)) throw fail("官服 Mod 配置目录无效。");
    result.push("-northstar", "-vanilla", "-profile=" + profile);
  }
  return result;
}

// Official mode intentionally has no Northstar core menus. Its readiness must
// prove VanillaPlus actually loaded, instead of accepting a bare game process.
class OfficialReadiness {
  constructor() {this.decoder = new StringDecoder("utf8"); this.pending = ""; this.loaded = false; this.menu = false; this.core = new Map(); this.error = null;}
  consume(bytes) {
    const lines = (this.pending + (Buffer.isBuffer(bytes) ? this.decoder.write(bytes) : String(bytes))).split(/\r?\n/);
    this.pending = lines.pop().slice(-16384);
    for (const line of lines) {
      const mod = /'(VanillaPlus|Northstar\.(?:Client|Custom|CustomServers))' loaded successfully, version [^\r\n]+/.exec(line);
      if (mod) {
        const enabled = !/\(DISABLED\)/i.test(mod[0]);
        if (mod[1] === "VanillaPlus") {this.loaded = enabled; if (!enabled) this.error = fail("VanillaPlus 未启用，官服 Mod 模式没有加载。请退出游戏后重新安装官服 Mod 组件。");}
        else {this.core.set(mod[1], enabled); if (enabled) this.error = fail("官服 Mod 模式检测到北极星核心 Mod 仍在运行，请退出游戏后重试。");}
      }
      if (/menu_MainMenu|MainMenuPanel|Running custom UI script callback "VP_SetVersionLabel"/i.test(line)) this.menu = true;
      if (/VanillaPlus Error \d|Mod '(?:VanillaPlus|Northstar\.(?:Client|Custom|CustomServers))' has several versions enabled|SCRIPT COMPILE ERROR|SCRIPT ERROR|Error compiling/i.test(line)) this.error = fail("官服 Mod 模式发生组件或脚本错误，请退出游戏后检查启用的 Mod 与 VanillaPlus 是否兼容。");
    }
    return this.state;
  }
  get state() {return {ready:!this.error && this.loaded && this.menu && CORE.every(name => this.core.get(name) !== true), loaded:this.loaded, core:Object.fromEntries(this.core), menu:this.menu, error:this.error};}
}

// The proxy loader also reads run_northstar.txt. Temporarily neutralize this
// opt-in for a clean launch, preserving exact prior bytes in a durable journal.
// This only affects loader selection; it does not remove installed skin data.
function createCleanMarker({journalRoot} = {}) {
  async function context(root) {
    const realRoot = await fs.promises.realpath(root), marker = path.join(realRoot, "run_northstar.txt");
    state.checked(marker);
    const store = path.join(journalRoot || path.join(realRoot, ".tfx", "clean-launch"), crypto.createHash("sha256").update(realRoot.toLowerCase()).digest("hex").slice(0, 24));
    state.checked(path.join(store, "journal.json"));
    return {realRoot, marker, store, journal:path.join(store, "journal.json")};
  }
  async function restore(ctx) {
    const bytes = state.checked(ctx.journal); if (!bytes) return {restored:false};
    let value; try {value = JSON.parse(bytes);} catch (_) {throw fail("纯净启动恢复记录无法读取，已保留文件。");}
    if (value.schemaVersion !== 1 || value.root !== ctx.realRoot || value.marker !== ctx.marker || typeof value.before !== "string" && value.before !== null || value.after !== "MAo=") throw fail("纯净启动恢复记录与游戏目录不匹配。");
    if (value.before !== null && (value.before.length > 87384 || Buffer.from(value.before,"base64").toString("base64") !== value.before)) throw fail("纯净启动恢复记录的原始数据无效，已保留文件。");
    const before = value.before === null ? null : Buffer.from(value.before, "base64"), after = Buffer.from(value.after,"base64"), current = state.checked(ctx.marker);
    if (before && before.length > 65536) throw fail("纯净启动恢复记录体积无效。");
    const equal = (a,b) => a === null ? b === null : b !== null && a.equals(b);
    if (equal(current, before)) {fs.unlinkSync(ctx.journal); return {restored:true};}
    if (!equal(current, after)) throw fail("run_northstar.txt 已由其他程序修改，未覆盖修改。请检查纯净启动恢复记录。");
    if (before === null) fs.unlinkSync(ctx.marker); else state.write(ctx.marker, current, before);
    fs.unlinkSync(ctx.journal); return {restored:true};
  }
  async function recover(root, {guard} = {}) {const ctx = await context(root); await guard?.(); return restore(ctx);}
  async function prepare(root, {guard} = {}) {
    const ctx = await context(root); await guard?.(); await restore(ctx);
    const before = state.checked(ctx.marker), after = Buffer.from("0\n");
    if (before?.length > 65536) throw fail("run_northstar.txt 体积异常，已停止纯净启动。");
    if (before?.equals(after)) return {restore:async()=>({restored:false}), changed:false};
    await guard?.(); fs.mkdirSync(ctx.store, {recursive:true});
    const record = Buffer.from(JSON.stringify({schemaVersion:1,root:ctx.realRoot,marker:ctx.marker,before:before===null?null:before.toString("base64"),after:after.toString("base64")})+"\n");
    state.write(ctx.journal, null, record);
    try {await state.writeGuarded(ctx.marker, before, after, {guard});}
    catch (error) {await restore(ctx); throw error;}
    return {changed:true, restore:()=>restore(ctx)};
  }
  return {prepare,recover};
}

module.exports = {argumentsFor, OfficialReadiness, createCleanMarker};
