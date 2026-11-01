"use strict";

const fs = require("fs");
const path = require("path");
const {spawn, execFile} = require("child_process");
const {hasGame} = require("./launch-session");

const CLIENT_IMAGES = new Set(["eadesktop.exe", "origin.exe"]);
function clientProcesses(snapshot) {
  return snapshot?.ok ? snapshot.processes.filter(item => CLIENT_IMAGES.has(String(item.image).toLowerCase())) : [];
}
function platformError(code, message) {return Object.assign(new Error(message), {code});}
function existingExecutable(candidates) {
  for (const filename of candidates) {
    if (!filename || !path.isAbsolute(filename) || !/^(EADesktop|Origin)\.exe$/i.test(path.basename(filename))) continue;
    try {if (fs.statSync(filename).isFile()) return filename;} catch (_) {}
  }
  return null;
}
function query(script) {
  return new Promise(resolve => {
    execFile("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {windowsHide: true, timeout: 5000, maxBuffer: 65536}, (error, stdout) => {
      if (error) {resolve(null); return;}
      try {resolve(JSON.parse(String(stdout).replace(/^\uFEFF/, "").trim()));} catch (_) {resolve(null);}
    });
  });
}
async function findClient() {
  const standard = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Electronic Arts", "EA Desktop", "EA Desktop", "EADesktop.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Origin", "Origin.exe")
  ];
  const found = existingExecutable(standard);
  if (found) return found;
  // Read only the known installation keys, including both registry views.
  // Registry values are data; no discovered value is interpolated into a shell.
  const roots = await query(String.raw`
$ErrorActionPreference='Stop'
$result=New-Object System.Collections.Generic.List[string]
foreach($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)){
  $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine,$view)
  try { foreach($keyName in @('SOFTWARE\Electronic Arts\EA Desktop','SOFTWARE\Origin')){
    $key=$base.OpenSubKey($keyName); if($null -eq $key){continue}
    try {foreach($name in @('InstallLocation','InstallPath','InstallDir')){
      $value=$key.GetValue($name); if($value -is [string] -and $value.Trim()){$result.Add($value)}
    }} finally {$key.Dispose()}
  }} finally {$base.Dispose()}
}
ConvertTo-Json -InputObject @($result) -Compress`);
  return existingExecutable((Array.isArray(roots) ? roots : []).flatMap(root => typeof root === "string" ? [path.join(root, "EA Desktop", "EADesktop.exe"), path.join(root, "EADesktop.exe"), path.join(root, "Origin.exe")] : []));
}
function startClient(executable) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], {cwd: path.dirname(executable), detached: true, windowsHide: false, stdio: "ignore"});
    child.once("error", reject);
    child.once("spawn", () => {child.unref(); resolve(child.pid);});
  });
}
async function responsiveClients(processes) {
  const pids = processes.map(item => Number(item.pid)).filter(pid => Number.isSafeInteger(pid) && pid > 0);
  if (!pids.length) return [];
  // Input-idle/window readiness checks the desktop UI, rather than mistaking
  // EABackgroundService for an EA client that can accept a launch request.
  const value = await query("$ErrorActionPreference='Stop'; $result=@(); foreach($client in @(Get-Process -Id @( " + pids.join(",") + " ) -ErrorAction SilentlyContinue)){try{$idle=$client.WaitForInputIdle(100); if($client.Responding -and ($idle -or $client.MainWindowHandle -ne [IntPtr]::Zero)){$result+=@{pid=$client.Id}}}catch{}}; ConvertTo-Json -InputObject @($result) -Compress");
  return (Array.isArray(value) ? value : []).map(item => Number(item.pid));
}

// Cold-start EA before the game, so its initialization cannot consume and drop
// the only game request. The caller keeps the exact game/client selection and
// checks it throughout this bounded wait. Authentication remains EA's own UI.
async function prepare({snapshot, initial, root, guard = () => {}, onStage = () => {}, find = findClient, start = startClient, responsive = responsiveClients, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 60000, settleMs = 1500, pollMs = 750, forceWait = false}) {
  let state = initial || await snapshot();
  if (!state?.ok) throw platformError("EA_PROCESS_QUERY_FAILED", "无法读取 EA App 进程，请稍后重试启动。");
  if (hasGame(state, root)) throw platformError("GAME_ALREADY_RUNNING", "所选游戏目录已有游戏，请先退出后重试。");
  const cold = !clientProcesses(state).length;
  if (!cold && !forceWait && (await responsive(clientProcesses(state))).length) {onStage("ready", {cold: false}); return {cold: false, ready: true};}
  const deadline = now() + timeoutMs;
  if (cold) {
    await guard();
    const executable = await find();
    if (!executable) throw platformError("EA_NOT_INSTALLED", "未找到 EA App 或 Origin，请先安装并登录 EA App，再启动游戏。");
    // Installation discovery can await IO; repeat the process/selection guard
    // immediately before creating even the platform process.
    await guard();
    state = await snapshot();
    if (!state?.ok) throw platformError("EA_PROCESS_QUERY_FAILED", "无法读取 EA App 进程，请稍后重试启动。");
    if (hasGame(state, root)) throw platformError("GAME_ALREADY_RUNNING", "所选游戏目录已有游戏，请先退出后重试。");
    if (!clientProcesses(state).length) {
      onStage("starting", {cold: true});
      try {await start(executable);} catch (error) {throw platformError("EA_START_FAILED", "EA App 未能启动，请打开并登录 EA App 后重试。" + (error?.code ? "（" + error.code + "）" : ""));}
    }
  }
  let stablePids = "", stableSince = null;
  onStage("waiting", {cold});
  while (now() < deadline) {
    await guard();
    state = await snapshot();
    if (state?.ok && hasGame(state, root)) throw platformError("GAME_ALREADY_RUNNING", "所选游戏目录已有游戏，请先退出后重试。");
    const clients = clientProcesses(state);
    const ready = state?.ok ? await responsive(clients) : [];
    const key = ready.map(String).sort().join(",");
    if (!key || key !== stablePids) {stablePids = key; stableSince = key ? now() : null;}
    if (key && now() - stableSince >= settleMs) {
      await guard();
      onStage("ready", {cold, pids: ready});
      return {cold, ready: true, pids: ready};
    }
    await sleep(Math.min(pollMs, Math.max(1, deadline - now())));
  }
  throw platformError("EA_START_TIMEOUT", "EA App 尚未准备好，请检查它的登录或更新提示，处理后再启动游戏。");
}

module.exports = {prepare, clientProcesses, findClient, responsiveClients};
