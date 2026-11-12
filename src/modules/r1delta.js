;
"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const {spawn, execFile} = require("child_process");
const {app, ipcMain, dialog, shell} = require("electron");

const CONFIG = path.join(app.getPath("appData"), "fold-r1delta.json");
const RELEASES_URL = "https://github.com/r1delta/r1delta/releases/latest/download/RELEASES";
const INSTALL_MANIFEST = ".tfx-r1delta-manifest.json";

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, "utf8")) || {}; } catch (_) { return {}; }
}
function writeConfig(value) {
  try { fs.writeFileSync(CONFIG, JSON.stringify(value, null, 2), "utf8"); } catch (_) {}
}
function hasR1Exe(root) {
  return ["R1Delta.exe", "r1delta.exe"].some(name => { try { return fs.statSync(path.join(root, name)).isFile(); } catch (_) { return false; } });
}
function hasTitanfallExe(root) {
  try {
    if (!fs.statSync(path.join(root, "Titanfall.exe")).isFile()) return false;
    const vpk = path.join(root, "vpk");
    return fs.statSync(vpk).isDirectory() && fs.readdirSync(vpk).some(name => /\.vpk$/i.test(name));
  } catch (_) { return false; }
}
function validRoot(root) {
  return !!root && hasTitanfallExe(root);
}
function queryRegistry() {
  return new Promise(resolve => {
    const script = "$ErrorActionPreference='SilentlyContinue';" +
      "$keys=@('HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1454890','HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1454890','HKLM:\\SOFTWARE\\WOW6432Node\\Respawn\\Titanfall','HKLM:\\SOFTWARE\\Respawn\\Titanfall');" +
      "foreach($k in $keys){$p=Get-ItemProperty -Path $k; if($p){$v=$p.InstallLocation; if(!$v){$v=$p.'Install Dir'}; if($v){Write-Output $v; break}}}";
    execFile("powershell.exe", ["-NoLogo","-NoProfile","-NonInteractive","-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {windowsHide:true, timeout:7000, maxBuffer:65536}, (error, stdout) => {
      resolve(error ? "" : String(stdout || "").replace(/^\uFEFF/u, "").trim());
    });
  });
}
async function resolveRoot() {
  const conf = readConfig();
  if (validRoot(conf.gamepath)) return conf.gamepath;
  const detected = await queryRegistry();
  if (validRoot(detected)) { writeConfig({...conf, gamepath: detected}); return detected; }
  return "";
}
function addonsRoot(root) { return path.join(root, "r1", "addons"); }
function readAddonStates(file) {
  const result = {};
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch (_) { return result; }
  const expression = /"([^"]+)"\s+"?([01])"?/g;
  let match;
  while ((match = expression.exec(text))) {
    if (match[1].toLowerCase() === "addonlist") continue;
    result[match[1]] = match[2] === "1";
  }
  return result;
}
function writeAddonStates(file, states) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const lines = ['"AddonList"', "{"];
  for (const [name, enabled] of Object.entries(states)) {
    lines.push('  "' + String(name).replace(/"/g, "\\\"") + '" "' + (enabled ? "1" : "0") + '"');
  }
  lines.push("}");
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
}
function addonName(entry) {
  return entry.isDirectory() ? entry.name : entry.name.replace(/\.vpk$/i, "");
}
function listAddons(root) {
  const dir = addonsRoot(root);
  const listFile = path.join(root, "r1", "addonlist.txt");
  const states = readAddonStates(listFile);
  let entries = [];
  try { entries = fs.readdirSync(dir, {withFileTypes:true}); } catch (_) {}
  return entries
    .filter(entry => entry.isDirectory() || /\.vpk$/i.test(entry.name))
    .map(entry => ({
      name: addonName(entry),
      file: entry.name,
      type: entry.isDirectory() ? "folder" : "vpk",
      enabled: states[addonName(entry)] === true
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}
function statusFor(root) {
  const installed = !!root && hasR1Exe(root);
  const gameInstalled = !!root && hasTitanfallExe(root);
  let clientVersion = "";
  if (root) {
    try { clientVersion = JSON.parse(fs.readFileSync(path.join(root, INSTALL_MANIFEST), "utf8")).clientVersion || ""; } catch (_) {}
  }
  return {ok:true, gamepath: root || "", gameInstalled, installed, clientVersion, addonsPath: root ? addonsRoot(root) : "", addons: root ? listAddons(root) : []};
}
function download(url, destination, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) { reject(new Error("Too many redirects")); return; }
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, {headers:{"User-Agent":"TFX-R1Delta"}, family:4}, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(download(new URL(response.headers.location, url).href, destination, onProgress, redirects + 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error("HTTP " + response.statusCode));
        return;
      }
      const total = Number(response.headers["content-length"]) || 0;
      let received = 0;
      response.on("data", chunk => { received += chunk.length; if (onProgress) onProgress(total ? Math.min(100, received / total * 100) : null); });
      const output = fs.createWriteStream(destination);
      response.pipe(output);
      output.on("finish", () => output.close(() => resolve(destination)));
      output.on("error", reject);
    });
    request.on("error", reject);
  });
}
function sha1File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const input = fs.createReadStream(file);
    input.on("data", chunk => hash.update(chunk));
    input.once("error", reject);
    input.once("end", () => resolve(hash.digest("hex")));
  });
}
function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) { reject(new Error("Too many redirects")); return; }
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, {headers:{"User-Agent":"TFX-R1Delta"}, family:4}, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(fetchText(new URL(response.headers.location, url).href, redirects + 1));
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error("HTTP " + response.statusCode)); return; }
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}
function fetchJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) { reject(new Error("Too many redirects")); return; }
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, {headers:{"User-Agent":"TFX-R1Delta"}, family:4}, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(fetchJson(new URL(response.headers.location, url).href, redirects + 1));
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error("HTTP " + response.statusCode)); return; }
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (error) { reject(error); } });
      response.on("error", reject);
    });
    request.setTimeout(8000, () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}
function sevenZip() {
  const bundled = path.join(process.resourcesPath || "", "app.asar.unpacked", "src", "tools", "vtf", "7z.exe");
  return fs.existsSync(bundled) ? bundled : "7z.exe";
}
function extractZip(zip, destination) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destination, {recursive:true});
    execFile(sevenZip(), ["x", "-y", "-o" + destination, zip], {windowsHide:true, maxBuffer:1024*1024*8}, error => error ? reject(error) : resolve());
  });
}
async function walkFiles(directory, relative = "") {
  const files = [];
  for (const entry of await fsp.readdir(directory, {withFileTypes:true})) {
    const rel = path.join(relative, entry.name);
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(full, rel));
    else if (entry.isFile()) files.push({source:full, relative:rel});
    else throw new Error("R1Delta 包含不支持的文件类型：" + rel);
  }
  return files;
}
function safeGameFile(root, relative) {
  const target = path.resolve(root, relative);
  if (target === root || !target.startsWith(root + path.sep)) throw new Error("R1Delta 包含无效文件路径：" + relative);
  return target;
}
async function installPayload(source, root, send, clientVersion) {
  const manifestPath = path.join(root, INSTALL_MANIFEST);
  let previous = {files:[]};
  if (fs.existsSync(manifestPath)) previous = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  const previousFiles = new Set(previous.files || []);
  const files = (await walkFiles(source)).sort((a, b) => a.relative.localeCompare(b.relative));
  if (!files.some(file => file.relative.toLowerCase() === "titanfall.exe") || !files.some(file => file.relative.toLowerCase() === "r1delta.exe")) {
    throw new Error("官方客户端包缺少 Titanfall.exe 或 r1delta.exe");
  }
  const nextFiles = new Set(files.map(file => file.relative));
  const transaction = await fsp.mkdtemp(path.join(root, ".tfx-r1delta-txn-"));
  const changed = [];
  try {
    for (const [index, file] of files.entries()) {
      const target = safeGameFile(root, file.relative);
      const backup = target + ".r1delta";
      await fsp.mkdir(path.dirname(target), {recursive:true});
      let transactionBackup = "";
      let preservedOriginal = false;
      if (fs.existsSync(target)) {
        if (previousFiles.has(file.relative)) {
          transactionBackup = path.join(transaction, String(index));
          await fsp.rename(target, transactionBackup);
        } else {
          if (fs.existsSync(backup)) throw new Error("原文件备份已存在，停止覆盖以保护数据：" + file.relative);
          await fsp.rename(target, backup);
          preservedOriginal = true;
        }
      } else if (!previousFiles.has(file.relative) && fs.existsSync(backup)) {
        throw new Error("检测到同名 R1Delta 备份，停止覆盖以保护数据：" + file.relative);
      }
      changed.push({target, transactionBackup, backup, preservedOriginal});
      await fsp.copyFile(file.source, target);
      if (index % 32 === 0 || index === files.length - 1) send({stage:"install", percent:(index + 1) / files.length * 100});
    }
    const manifestTemp = manifestPath + ".tmp";
    await fsp.writeFile(manifestTemp, JSON.stringify({version:1, clientVersion, files:[...nextFiles]}, null, 2), "utf8");
    await fsp.rename(manifestTemp, manifestPath);
    return files.length;
  } catch (error) {
    for (const entry of changed.reverse()) {
      try { await fsp.rm(entry.target, {force:true}); } catch (_) {}
      try {
        if (entry.transactionBackup) await fsp.rename(entry.transactionBackup, entry.target);
        else if (entry.preservedOriginal && fs.existsSync(entry.backup)) await fsp.rename(entry.backup, entry.target);
      } catch (_) {}
    }
    throw error;
  } finally { await fsp.rm(transaction, {recursive:true, force:true}); }
}
function findAddonRoot(directory, depth = 0) {
  if (depth > 3) return directory;
  try {
    if (fs.existsSync(path.join(directory, "addoninfo.txt"))) return directory;
    const entries = fs.readdirSync(directory, {withFileTypes:true});
    const vpk = entries.find(entry => entry.isFile() && /\.vpk$/i.test(entry.name));
    if (vpk) return directory;
    const dirs = entries.filter(entry => entry.isDirectory());
    if (dirs.length === 1) return findAddonRoot(path.join(directory, dirs[0].name), depth + 1);
  } catch (_) {}
  return directory;
}
async function importAddon(root) {
  const result = await dialog.showOpenDialog({title:"导入 R1Delta Mod", properties:["openFile", "openDirectory"], filters:[{name:"R1Delta Addon", extensions:["zip", "vpk"]}]});
  if (result.canceled || !result.filePaths.length) return {ok:false, canceled:true};
  const source = result.filePaths[0];
  const addons = addonsRoot(root);
  fs.mkdirSync(addons, {recursive:true});
  let name;
  if (fs.statSync(source).isDirectory()) {
    name = path.basename(source);
    const target = path.join(addons, name);
    if (fs.existsSync(target)) throw new Error("Addon 已存在：" + name);
    fs.cpSync(source, target, {recursive:true});
  } else if (/\.vpk$/i.test(source)) {
    name = path.basename(source).replace(/\.vpk$/i, "");
    const target = path.join(addons, path.basename(source));
    if (fs.existsSync(target)) throw new Error("Addon 已存在：" + name);
    fs.copyFileSync(source, target);
  } else {
    name = path.basename(source, path.extname(source));
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "r1delta-addon-"));
    try {
      await extractZip(source, temporary);
      const content = findAddonRoot(temporary);
      const targetName = path.basename(content) || name;
      const target = path.join(addons, targetName);
      if (fs.existsSync(target)) throw new Error("Addon 已存在：" + targetName);
      fs.cpSync(content, target, {recursive:true});
      name = targetName;
    } finally { try { fs.rmSync(temporary, {recursive:true, force:true}); } catch (_) {} }
  }
  const states = readAddonStates(path.join(root, "r1", "addonlist.txt"));
  states[name] = true;
  writeAddonStates(path.join(root, "r1", "addonlist.txt"), states);
  return statusFor(root);
}

function findEaDesktop() {
  const candidates = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Electronic Arts", "EA Desktop", "EA Desktop", "EADesktop.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Electronic Arts", "EA Desktop", "EA Desktop", "EADesktop.exe")
  ];
  return candidates.find(file => { try { return fs.statSync(file).isFile(); } catch (_) { return false; } }) || "";
}
function openEaDesktop() {
  try {
    const executable = findEaDesktop();
    if (executable) { spawn(executable, [], {detached:true, stdio:"ignore"}).unref(); return {ok:true}; }
  } catch (_) {}
  shell.openExternal("https://www.ea.com/games/titanfall/titanfall");
  return {ok:true};
}
function openSteamTitanfall() {
  try { shell.openExternal("steam://install/1454890"); } catch (_) {}
  return {ok:true};
}
async function latestRelease() {
  const release = (await fetchText(RELEASES_URL)).trim().split(/\r?\n/).map(line => {
    const match = /^([a-f\d]{40})\s+(\S+-full\.nupkg)\s+(\d+)$/i.exec(line.trim());
    return match && {sha1:match[1].toLowerCase(), name:match[2], size:Number(match[3])};
  }).find(Boolean);
  if (!release) throw new Error("GitHub RELEASES 清单中没有有效的客户端包");
  const version = /-(\d+(?:\.\d+){1,3})-full\.nupkg$/i.exec(release.name)?.[1];
  if (!version) throw new Error("无法从官方客户端包名称读取版本号");
  return {...release, version};
}
function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return difference;
  }
  return 0;
}
function spawnGame(root, args = []) {
  const executable = path.join(root, "Titanfall.exe");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {cwd:root, detached:true, stdio:"ignore"});
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}
async function chooseRoot() {
  const result = await dialog.showOpenDialog({title:"选择 R1Delta 安装目录（可选）", properties:["openDirectory"]});
  if (result.canceled || !result.filePaths.length) return {ok:false, canceled:true};
  const root = result.filePaths[0];
  if (!validRoot(root)) return {ok:false, error:"所选目录中没有 Titanfall.exe"};
  const config = readConfig();
  writeConfig({...config, gamepath: root});
  fs.mkdirSync(addonsRoot(root), {recursive:true});
  return statusFor(root);
}
function register() {
  ipcMain.handle("r1delta-status", async () => statusFor(await resolveRoot()));
  ipcMain.handle("r1delta-select", () => chooseRoot());
  ipcMain.handle("r1delta-open-ea", () => openEaDesktop());
  ipcMain.handle("r1delta-open-steam", () => openSteamTitanfall());
  ipcMain.handle("r1delta-check-updates", async () => {
    const root = await resolveRoot();
    if (!root || !hasTitanfallExe(root)) return {ok:false, error:"请先安装并选择 Titanfall 1 游戏目录"};
    try {
      const release = await latestRelease();
      const currentVersion = statusFor(root).clientVersion;
      return {ok:true, currentVersion, latestVersion:release.version, updateAvailable:!currentVersion || compareVersions(release.version, currentVersion) > 0};
    } catch (error) { return {ok:false, error:"检查 R1Delta 更新失败：" + error.message}; }
  });
  ipcMain.handle("r1delta-install", async event => {
    const send = data => { try { if (!event.sender.isDestroyed()) event.sender.send("r1delta-progress", data); } catch (_) {} };
    const root = await resolveRoot();
    if (!root || !hasTitanfallExe(root)) return {ok:false, error:"未找到完整的 Titanfall 1 游戏目录，请先通过 Steam 安装并选择游戏目录。"};
    try {
      const release = await latestRelease();
      const url = "https://github.com/r1delta/r1delta/releases/latest/download/" + encodeURIComponent(release.name);
      const stage = await fsp.mkdtemp(path.join(app.getPath("temp"), "tfx-r1delta-"));
      const archive = path.join(stage, release.name);
      const extracted = path.join(stage, "package");
      try {
        send({stage:"download", percent:0});
        await download(url, archive, percent => send({stage:"download", percent}));
        const stat = await fsp.stat(archive);
        if (stat.size !== release.size) throw new Error("客户端下载大小与官方清单不一致");
        send({stage:"verify", percent:0});
        const digest = await sha1File(archive);
        if (digest !== release.sha1) throw new Error("R1Delta 客户端包 SHA-1 校验失败");
        send({stage:"extract", percent:0});
        await extractZip(archive, extracted);
        const payload = path.join(extracted, "lib", "net462");
        const count = await installPayload(payload, root, send, release.version);
        writeConfig({...readConfig(), gamepath:root});
        send({stage:"complete", percent:100});
        return {ok:true, message:`R1Delta ${release.version} 已部署（${count} 个文件）`};
      } finally { await fsp.rm(stage, {recursive:true, force:true}); }
    } catch (error) {
      send({stage:"error", percent:null});
      return {ok:false, error:"R1Delta 自动安装失败：" + error.message};
    }
  });
  ipcMain.handle("r1delta-servers", async () => {
    try {
      const list = await fetchJson("http://ms.r1delta.net/servers");
      const servers = (Array.isArray(list) ? list : []).map(item => ({
        name:String(item.host_name || "Unnamed server").replace(/\^[0-9a-fA-F]{1,8}/g, ""),
        map:String(item.map_name || ""),
        mode:String(item.playlist_display_name || item.game_mode || "").replace(/^#PL_/i, "").replace(/_/g, " "),
        players:Number(item.total_players ?? (Array.isArray(item.players) ? item.players.length : 0)) || 0,
        maxPlayers:Number(item.max_players) || 0,
        ip:String(item.ip || ""),
        port:Number(item.port) || 0,
        password:item.has_password === true,
        version:String(item.version || "")
      })).filter(server => server.ip && server.port);
      return {ok:true, servers};
    } catch (error) { return {ok:false, error:"读取 R1Delta 服务器列表失败：" + error.message}; }
  });
  ipcMain.handle("r1delta-join", async (_event, ip, port) => {
    const root = await resolveRoot();
    if (!root) return {ok:false, error:"请先选择泰坦陨落 1 游戏目录"};
    if (!hasR1Exe(root)) return {ok:false, error:"未检测到 R1Delta 客户端，请先安装"};
    const address = String(ip) + ":" + String(port);
    await spawnGame(root, ["+connect", address]);
    return {ok:true, message:"正在连接 " + address};
  });
  ipcMain.handle("r1delta-launch", async () => {
    const root = await resolveRoot();
    if (!root) return {ok:false, error:"请先选择 Titanfall 1 游戏目录"};
    if (!hasR1Exe(root)) return {ok:false, error:"未检测到 R1Delta 客户端，请先安装"};
    await spawnGame(root);
    return {ok:true, message:"Titanfall 1 已启动"};
  });
  ipcMain.handle("r1delta-open-addons", async () => {
    const root = await resolveRoot();
    if (!root) return {ok:false, error:"请先选择 Titanfall 1 游戏目录"};
    const target = addonsRoot(root);
    fs.mkdirSync(target, {recursive:true});
    await shell.openPath(target);
    return {ok:true};
  });
  ipcMain.handle("r1delta-toggle-addon", async (_event, name, enabled) => {
    const root = await resolveRoot();
    if (!root) return {ok:false, error:"请先选择 Titanfall 1 游戏目录"};
    const file = path.join(root, "r1", "addonlist.txt");
    const states = readAddonStates(file);
    states[String(name)] = Boolean(enabled);
    writeAddonStates(file, states);
    return statusFor(root);
  });
  ipcMain.handle("r1delta-import-addon", async () => {
    const root = await resolveRoot();
    if (!root) return {ok:false, error:"请先选择 Titanfall 1 游戏目录"};
    try { return await importAddon(root); }
    catch (error) { return {ok:false, error:error.message}; }
  });
  ipcMain.handle("r1delta-remove-addon", async (_event, name) => {
    const root = await resolveRoot();
    if (!root) return {ok:false, error:"请先选择 Titanfall 1 游戏目录"};
    const addons = addonsRoot(root);
    const targetFolder = path.join(addons, String(name));
    const targetVpk = path.join(addons, String(name) + ".vpk");
    if (fs.existsSync(targetFolder)) fs.rmSync(targetFolder, {recursive:true, force:true});
    else if (fs.existsSync(targetVpk)) fs.rmSync(targetVpk, {force:true});
    else return {ok:false, error:"Addon 不存在"};
    const file = path.join(root, "r1", "addonlist.txt");
    const states = readAddonStates(file);
    delete states[String(name)];
    writeAddonStates(file, states);
    return statusFor(root);
  });
}

module.exports = {register, statusFor, listAddons, readAddonStates, writeAddonStates};
