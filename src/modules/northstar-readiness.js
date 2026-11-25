"use strict";
const {connectionEvent} = require("./northstar-health");
const {StringDecoder} = require("string_decoder");
const CORE_NAMES = Object.freeze(["Northstar.Client", "Northstar.Custom", "Northstar.CustomServers"]);
// A base-game MainMenuPanel is present even when every Northstar UI mod is
// disabled. Confirm the three official core mods before treating it as ready.
class NorthstarReadiness {
  constructor() { this.decoder = new StringDecoder("utf8"); this.pending = ""; this.core = new Map(); this.menu = false; this.error = null; this.connection = null; this.authenticated = false; this.connectionRevision = 0; }
  consume(bytes) {
    const text = this.pending + (Buffer.isBuffer(bytes) ? this.decoder.write(bytes) : String(bytes));
    const lines = text.split(/\r?\n/); this.pending = lines.pop().slice(-16384);
    for (const line of lines) {
      const connection = connectionEvent(line);
      if (connection) {
        if (["session-expired", "auth-rejected"].includes(connection)) this.authenticated = false;
        if (connection === "authenticated") this.authenticated = true;
        this.connection = connection; this.connectionRevision++;
      }
      const mod = /'(Northstar\.(?:Client|Custom|CustomServers))' loaded successfully, version [^\r\n]+/.exec(line);
      if (mod) {
        const enabled = !/\(DISABLED\)/i.test(mod[0]); this.core.set(mod[1], enabled);
        if (!enabled) this.error = Object.assign(new Error("北极星核心组件未启用，私人服务器菜单没有加载。请退出游戏后重试启动。"), {code: "NORTHSTAR_CORE_DISABLED"});
      }
      if (/menu_MainMenu|MainMenuPanel/i.test(line)) this.menu = true;
      if (/Mod 'Northstar\.(?:Client|Custom|CustomServers)' has several versions enabled, disabling them all\./.test(line)) this.error = Object.assign(new Error("检测到重复的北极星核心组件，私人服务器菜单无法正常加载。请检查模组目录。"), {code: "NORTHSTAR_CORE_DUPLICATE"});
    }
    return this.state;
  }
  get state() { return {connection:this.connection, authenticated:this.authenticated, connectionRevision:this.connectionRevision, ready: !this.error && this.menu && CORE_NAMES.every(name => this.core.get(name) === true), core: Object.fromEntries(this.core), menu: this.menu, error: this.error}; }
}
module.exports = {NorthstarReadiness, CORE_NAMES};
