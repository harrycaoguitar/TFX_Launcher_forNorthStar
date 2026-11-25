"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const HOSTS = Object.freeze({cn: "https://nscn.wolf109909.top", global: "https://northstar.tf"});
const OFFICIAL_PROFILE = "R2Titanfall";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function normalize(value) { return value === "global" ? "global" : "cn"; }
function argumentsFor(args, region) {
  if (!Object.hasOwn(HOSTS, region)) return [...args];
  const result = [];
  for (let i = 0; i < args.length; i++) {
    if (/^\+ns_masterserver_hostname=/i.test(args[i])) continue;
    if (/^\+ns_masterserver_hostname$/i.test(args[i])) {
      if (i + 1 < args.length && !/^[+-]/.test(args[i + 1])) i++;
      continue;
    }
    result.push(args[i]);
  }
  return [...result, "+ns_masterserver_hostname", HOSTS[region]];
}
function inside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
function resolveProfile(root, args, forcedProfile) {
  let profile = forcedProfile || "R2Northstar";
  if (!forcedProfile) for (let i = 0; i < args.length; i++) {
    if (/^-profile=/i.test(args[i])) profile = args[i].slice(9);
    else if (/^-profile$/i.test(args[i]) && args[i + 1]) profile = args[++i];
  }
  const realRoot = fs.realpathSync(root), directory = path.resolve(realRoot, profile);
  if (!inside(realRoot, directory)) throw Error("北极星配置目录不在游戏目录中，无法切换服务器网络。");
  if (fs.existsSync(directory) && !inside(realRoot, fs.realpathSync(directory))) throw Error("北极星配置目录不在游戏目录中，无法切换服务器网络。");
  return directory;
}
function apply(root, args, region, backupDirectory) {
  if (!Object.hasOwn(HOSTS, region)) return {region: null, changed: false};
  const realRoot = fs.realpathSync(root);
  const filename = path.join(resolveProfile(root, args), "mods/Northstar.Client/mod/cfg/autoexec_ns_client.cfg");
  let original;
  try {
    if (!inside(realRoot, fs.realpathSync(filename)) || !fs.statSync(filename).isFile()) throw Error();
    original = fs.readFileSync(filename);
  } catch (_) { throw Error("未找到可用的北极星客户端网络配置，请检查 Northstar.Client 核心模组后重试。"); }
  if (original.length > 1024 * 1024) throw Error("北极星网络配置过大，无法安全切换。");
  const body = original.toString("utf8");
  if (!Buffer.from(body, "utf8").equals(original)) throw Error("北极星网络配置不是 UTF-8 文本，请检查配置后重试。");
  const pattern = /^([ \t]*ns_masterserver_hostname[ \t]+)(?:"[^"\r\n]*"|[^\s;"\r\n]+)([ \t]*(?:\/\/[^\r\n]*)?)$/gmi;
  const lines = body.match(/^[ \t]*ns_masterserver_hostname\b[^\r\n]*$/gmi) || [];
  if (lines.length !== [...body.matchAll(pattern)].length) throw Error("北极星网络配置包含复合指令，请把 ns_masterserver_hostname 单独写在一行后重试。");
  const eol = body.includes("\r\n") ? "\r\n" : "\n";
  const updated = lines.length ? body.replace(pattern, (_, prefix, suffix) => prefix + '"' + HOSTS[region] + '"' + suffix) : body + (body.endsWith("\n") ? "" : eol) + 'ns_masterserver_hostname "' + HOSTS[region] + '"' + eol;
  const next = Buffer.from(updated, "utf8");
  if (next.equals(original)) return {region, hostname: HOSTS[region], changed: false};
  // Preserve the exact prior config once per content hash before replacing it.
  fs.mkdirSync(backupDirectory, {recursive: true});
  const backup = path.join(backupDirectory, sha(Buffer.from(filename)) + "-" + sha(original) + ".cfg");
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, {flag: "wx"});
  if (!fs.readFileSync(backup).equals(original)) throw Error("北极星网络配置备份校验失败，已停止切换。");
  if (!fs.readFileSync(filename).equals(original)) throw Error("北极星网络配置被其他程序修改，请重新启动。");
  const temporary = filename + ".vyra-" + crypto.randomUUID() + ".tmp";
  try {
    fs.writeFileSync(temporary, next, {flag: "wx"});
    if (!fs.readFileSync(temporary).equals(next)) throw Error("北极星网络配置写入校验失败。");
    fs.renameSync(temporary, filename);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  if (!fs.readFileSync(filename).equals(next)) throw Error("北极星网络配置切换后校验失败。");
  return {region, hostname: HOSTS[region], changed: true, backup};
}
module.exports = {HOSTS, OFFICIAL_PROFILE, normalize, argumentsFor, resolveProfile, apply};
