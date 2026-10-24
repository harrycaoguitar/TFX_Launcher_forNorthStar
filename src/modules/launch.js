"use strict";
const path = require("path");
const fs = require("fs");
const {spawn, execFile} = require("child_process");
const {app, ipcMain, dialog} = require("electron");
const lang = require("../lang");
const settings = require("./settings");
const console = require("./console");
const protection = require("./dds-guard");
const win = require("../win");
const gate = require("./dds-operation-gate");
const running = require("./is_running");
const findgame = require("./findgame");
const {LaunchConfirmation, splitArguments, hasGame} = require("./launch-session");
const network = require("./northstar-region");
const clients = require("./northstar-clients");
const modCompatibility = require("./mod-compatibility");
const {NorthstarReadiness} = require("./northstar-readiness");
const ea = require("./ea-handoff");
const {LaunchDiagnostics} = require("./launch-diagnostics");
const diagnosticExport = require("./diagnostic-export");

let launching = false, latestDiagnostic = null, activeReadiness = null;
function send(channel, result) {try {const window = win(); if (!window.isDestroyed?.()) window.send(channel, result);} catch (error) {console.error(error.message || String(error));}}
let pendingDiagnostic = null, diagnosticWrite = null;
const diagnosticFilename = () => path.join(app.getPath("userData"), "launch-diagnostics.json");
function persistDiagnostic(report) {
  pendingDiagnostic = JSON.stringify(report, null, 2) + "\n";
  if (diagnosticWrite) return;
  diagnosticWrite = (async () => {
    try {
      const filename = diagnosticFilename(); await fs.promises.mkdir(path.dirname(filename), {recursive:true});
      while (pendingDiagnostic !== null) {
        const json = pendingDiagnostic; pendingDiagnostic = null;
        await fs.promises.writeFile(filename + ".tmp", json, {encoding:"utf8", mode:0o600});
        await fs.promises.rename(filename + ".tmp", filename);
      }
    } catch (_) {pendingDiagnostic = null;}
    finally {diagnosticWrite = null;}
  })();
}
const diagnostics = new LaunchDiagnostics({appVersion:require("./launcher-version")(), onChange:report => send("launch-diagnostic", report), persist:persistDiagnostic});
try {
  const filename = diagnosticFilename();
  if (fs.existsSync(filename)) {
    const input = fs.statSync(filename).size <= 32768 ? JSON.parse(fs.readFileSync(filename, "utf8")) : null;
    const restored = diagnostics.load(input);
    // Replace the previous private, free-form diagnostic schema with the
    // bounded structured schema. A prior pending launch is not still active.
    if (restored?.state === "starting") {
      restored.state = "failed"; restored.outcome = {code:"unknown", causeKnown:false, evidenceCode:null, actions:["retry", "issue"]};
      for (const stage of restored.stages) if (["active", "pending"].includes(stage.status)) stage.status = "unconfirmed";
      diagnostics.load(restored);
    }
    persistDiagnostic(diagnostics.report());
  }
} catch (_) { /* An unreadable old diagnostic must never block startup. */ }
diagnosticExport.register({ipcMain, dialog, getWindow:win, getReport:() => diagnostics.report()});
function diagnose(record, change) {
  Object.assign(record, change, {updatedAt: new Date().toISOString()});
  // Full values stay in this short-lived internal launch record. Export and
  // persistence exclusively use LaunchDiagnostics' explicit structured schema.
}
const confirmation = new LaunchConfirmation({speedUp: until => running.speedUp(until), refresh: () => running.snapshot()});
running.onSnapshot(value => {probeReadiness(); const session = confirmation.current; confirmation.observe(value); diagnostics.observe(value, session);});

function readTail(filename) {
  const fd = fs.openSync(filename, "r");
  try {
    const size = fs.fstatSync(fd).size, length = Math.min(size, 65536), bytes = Buffer.alloc(length);
    fs.readSync(fd, bytes, 0, length, Math.max(0, size - length));
    return bytes.toString("utf8");
  } finally {fs.closeSync(fd);}
}
function latestGameLog(profileDirectory) {
  const directory = path.join(profileDirectory, "logs");
  try {
    let latest = null;
    for (const name of fs.readdirSync(directory)) {
      if (!/^nslog[^/\\]*\.txt$/i.test(name)) continue;
      const filename = path.join(directory, name), stat = fs.statSync(filename);
      if (stat.isFile() && (!latest || stat.mtimeMs > latest.modified)) latest = {filename, modified: stat.mtimeMs, size: stat.size};
    }
    return latest;
  } catch (_) {return null;}
}
function probeReadiness() {
  const probe = activeReadiness;
  if (!probe || confirmation.current !== probe.session || probe.session.ready) return;
  try {
    if (/Launching the game/i.test(readTail(probe.startupLog))) {
      confirmation.entered(probe.session);
      diagnostics.stage("northstar", "active");
    }
    const next = latestGameLog(probe.profileDirectory), prior = probe.previousLog;
    if (!next || next.modified < probe.startedAt || (prior && next.filename === prior.filename && next.modified === prior.modified && next.size === prior.size)) return;
    if (probe.logFilename !== next.filename || next.size < probe.logOffset) {
      probe.logFilename = next.filename;
      probe.logOffset = prior && next.filename === prior.filename && next.size >= prior.size ? prior.size : 0;
      probe.runtime = probe.officialMods ? new (require("./official-launch").OfficialReadiness)() : new NorthstarReadiness();
    }
    const fd = fs.openSync(next.filename, "r");
    let state;
    try {
      const size = fs.fstatSync(fd).size, length = Math.min(Math.max(0, size - probe.logOffset), 1024 * 1024), bytes = Buffer.alloc(length);
      const consumed = fs.readSync(fd, bytes, 0, length, probe.logOffset);
      probe.logOffset += consumed; state = probe.runtime.consume(bytes.subarray(0, consumed));
    } finally {fs.closeSync(fd);}
    if (state?.error) {
      diagnose(probe.record, {gameStage: probe.officialMods ? "official-mod-error" : "northstar-core-disabled", runtimeCore: state.core});
      confirmation.fail(probe.session, state.error);
    } else if (state?.ready) {
      confirmation.ready(probe.session);
      diagnostics.stage("northstar", "observed");
      diagnostics.stage("confirmation", "active");
      diagnose(probe.record, {gameStage: probe.officialMods ? "official-mod-menu" : "northstar-menu", runtimeCore: state.core, readyAt: new Date().toISOString()});
    }
  } catch (_) { /* A process can hold its log briefly; retry next snapshot. */ }
}
function createStartupLog() {
  const directory = app.getPath("userData");
  fs.mkdirSync(directory, {recursive: true});
  // Keep a small set of our own startup logs; do not alter game-generated logs.
  try {
    const entries = fs.readdirSync(directory).filter(name => /^vyra-startup-\d+-[a-f0-9]+\.log$/.test(name)).sort().reverse();
    for (const name of entries.slice(4)) fs.unlinkSync(path.join(directory, name));
  } catch (_) {}
  const filename = path.join(directory, "vyra-startup-" + Date.now() + "-" + Math.random().toString(16).slice(2) + ".log");
  return {filename, fd: fs.openSync(filename, "wx")};
}

function supportsQuietConsole(root, profileDirectory) {
  // Older community builds lack the official flag. Inspect capability rather
  // than assuming a release number or silently passing an unsupported switch.
  try {
    const preferred = path.join(profileDirectory, "Northstar.dll");
    const bytes = fs.readFileSync(fs.existsSync(preferred) ? preferred : path.join(root, "Northstar.dll"));
    return bytes.includes(Buffer.from("-noallocconsole")) || bytes.includes(Buffer.from("-noallocconsole", "utf16le"));
  } catch (_) {return false;}
}
function prepareLegacyConsole(record) {
  // Hide only the console HWND attached to this owned child PID. SW_HIDE on the
  // process startup itself can propagate to Titanfall's window in the same PID.
  // Compile before spawning the game so a late Add-Type compilation cannot
  // leave Northstar's console visible. The PID arrives over our private pipe.
  const script = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class VyraConsole { [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AttachConsole(uint pid); [DllImport("kernel32.dll")] public static extern bool FreeConsole(); [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow(); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int command); }'; [Console]::Out.WriteLine('vyra-console-ready'); [Console]::Out.Flush(); $line=[Console]::In.ReadLine(); $gamePid=[uint32]0; if(![uint32]::TryParse($line,[ref]$gamePid) -or $gamePid -eq 0){exit}; [VyraConsole]::FreeConsole() | Out-Null; for($attempt=0;$attempt -lt 400;$attempt++){ if([VyraConsole]::AttachConsole($gamePid)){ try { $handle=[VyraConsole]::GetConsoleWindow(); if($handle -ne [IntPtr]::Zero){ [VyraConsole]::ShowWindow($handle,0) | Out-Null; Write-Output 'console-hidden'; break } } finally { [VyraConsole]::FreeConsole() | Out-Null } }; Start-Sleep -Milliseconds 10 }`;
  return new Promise(resolve => {
    let helper = null, timer = null, completed = false, bound = false, output = "";
    const cancel = () => {if (bound) return; bound = true; try {helper?.stdin?.end();} catch (_) {}};
    const finish = result => {if (completed) return; completed = true; clearTimeout(timer); resolve(result);};
    try {
      helper = execFile("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {windowsHide: true, timeout: 10000, maxBuffer: 65536}, (error, stdout = "") => {
        diagnose(record, {consoleSuppression: error ? "helper-unavailable" : stdout.includes("console-hidden") ? "console-hidden" : "no-console", consoleError: error ? String(error.message || error).slice(0, 500) : null});
        finish(null);
      });
      helper.stdin?.on("error", () => {});
      helper.stdout?.on("data", data => {
        if (completed) return;
        output = (output + String(data)).slice(-1024);
        if (!output.includes("vyra-console-ready")) return;
        diagnose(record, {consoleSuppression: "helper-ready"});
        finish({cancel, bind(pid) {
          if (bound) return;
          if (!Number.isSafeInteger(pid) || pid <= 0) {cancel(); return;}
          bound = true;
          try {helper.stdin.end(String(pid) + "\n");} catch (_) {cancel();}
        }});
      });
      timer = setTimeout(() => {cancel(); diagnose(record, {consoleSuppression: "helper-prepare-timeout"}); finish(null);}, 6000);
      timer.unref?.();
    } catch (error) {diagnose(record, {consoleSuppression: "helper-unavailable", consoleError: error.message}); finish(null);}
  });
}

ipcMain.on("launch-ns", () => {void launch("northstar");});
ipcMain.on("launch-vanilla", () => {void launch("vanilla");});
function launchError(code, message) {return Object.assign(Error(message), {code});}

function preflight(conf, gameVersion, prepared = false) {
  const root = findgame.validateGamePath(conf.gamepath);
  if (!root) throw launchError("GAME_DIRECTORY_INVALID", "游戏目录已失效或缺少 Titanfall2.exe，请重新选择游戏安装目录。");
  const directory = path.join(root, "r2");
  try {if (!fs.statSync(directory).isDirectory()) throw Error();}
  catch (_) {throw launchError("GAME_ASSETS_MISSING", "游戏目录缺少 r2 资源目录，请验证游戏文件后再启动。");}
  const officialMods = gameVersion === "vanilla" && conf.vanillaModsEnabled === true;
  const usesLoader = gameVersion === "northstar" || officialMods;
  const profileDirectory = usesLoader ? network.resolveProfile(root, splitArguments(conf.nsargs || "")) : null;
  // Official multiplayer must keep the purchased game's Steam/EA identity.
  const executable = gameVersion === "northstar" ? "NorthstarLauncher.exe" : "Titanfall2.exe";
  const args = gameVersion === "northstar" ? network.argumentsFor(splitArguments(conf.nsargs || "").filter(value => !/^-(?:vanilla|norestrictservercommands)(?:=|$)/i.test(value)), conf.northstarRegion) : require("./official-launch").argumentsFor(splitArguments(conf.nsargs || ""), {mods:officialMods,profile:officialMods?path.relative(root,profileDirectory):undefined});
  const dll = usesLoader && (officialMods || network.normalize(conf.northstarRegion) === "global") ? path.relative(root,path.join(profileDirectory,"Northstar.dll")) : "Northstar.dll";
  const required = !usesLoader ? [executable] : ["Titanfall2.exe", "bin/x64_retail/launcher.dll", "bin/x64_retail/tier0.dll", ...(prepared ? [executable,dll,...(officialMods ? ["bin/x64_retail/wsock32.dll"] : [])] : [])];
  for (const name of required) {
    try {if (!fs.statSync(path.join(root, ...name.split("/"))).isFile()) throw Error(); fs.accessSync(path.join(root, ...name.split("/")), fs.constants.R_OK);}
    catch (_) {throw launchError("GAME_FILE_UNREADABLE", "缺少或无法读取 " + name + (gameVersion === "vanilla" ? "，请验证游戏文件。" : "，请在开始游戏页面检查或重新安装北极星客户端。"));}
  }
  const quietConsole = usesLoader && supportsQuietConsole(root, profileDirectory);
  if (quietConsole && !args.includes("-noallocconsole")) args.push("-noallocconsole");
  return {root, executable, args, quietConsole, profileDirectory, officialMods, usesLoader};
}
async function baselineSnapshot() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const value = await running.snapshot();
    if (value?.ok) return value;
  }
  throw launchError("PROCESS_QUERY_FAILED", "无法读取 Windows 游戏进程，已重试三次。请稍后重试启动。");
}

async function launch(gameVersion) {
  gameVersion = gameVersion === "vanilla" ? "vanilla" : "northstar";
  if (launching) return {ok: false, pending: true, error: "游戏正在启动，请等待当前请求完成"};
  launching = true;
  const record = {version: 1, gameVersion, startedAt: new Date().toISOString(), state: "starting", childExit: null, confirmation: null, error: null};
  latestDiagnostic = record;
  diagnostics.begin(gameVersion,{officialMods:gameVersion === "vanilla" && settings().vanillaModsEnabled === true});
  diagnose(record, {});
  send("launch-status", {state: "starting", gameVersion});
  let session = null, consoleController = null, clientPreparation = false, cleanMarker = null, cleanProxy = null;
  try {
    const result = await gate.run("launch", async () => {
      if (require("./dds").busy) throw launchError("SKIN_OPERATION_BUSY", "DDS 安装或恢复正在进行，请完成后再启动游戏");
      const conf = {...settings()};
      diagnostics.update({region:network.normalize(conf.northstarRegion)});
      let plan = preflight(conf, gameVersion);
      let baseline = await baselineSnapshot();
      if (hasGame(baseline)) throw launchError("GAME_ALREADY_RUNNING", "游戏或北极星启动进程已经运行，请等待启动完成或先退出游戏。");
      diagnostics.stage("preflight", "observed");
      // A cross-format skin switch can touch both the model index and DDS data.
      // Never start a game against an interrupted transaction between them.
      diagnostics.stage("skins", "active");
      await require("./skin-switch").getActive()?.assertReady(plan.root);
      diagnostics.stage("skins", "observed");
      diagnostics.stage("preflight", "active");
      clientPreparation = true;
      const selectionGuard=()=>{
        const current=settings();
        if(current.gamepath!==conf.gamepath||current.nsargs!==conf.nsargs||current.independentServerMods!==conf.independentServerMods||current.vanillaModsEnabled!==conf.vanillaModsEnabled||current.modProfileServer!==conf.modProfileServer||network.normalize(current.northstarRegion)!==network.normalize(conf.northstarRegion))throw launchError("SELECTION_CHANGED", "客户端选择或游戏目录已改变，请重新启动。");
      };
      const compatibilityGuard = async () => {
        const stopped = await baselineSnapshot();
        if (hasGame(stopped)) throw launchError("GAME_ALREADY_RUNNING", "游戏已由其他程序启动，请先退出游戏后重试。");
        selectionGuard();
      };
      let compatibility;
      const markerManager = require("./official-launch").createCleanMarker();
      await markerManager.recover(plan.root,{guard:compatibilityGuard});
      await require("./clean-loader-proxy").recover(plan.root,{guard:compatibilityGuard});
      diagnostics.stage("preflight", "observed");
      if (gameVersion === "northstar") {
        diagnostics.stage("client", "active");
        diagnose(record, {clientPreparation: "checking", region: network.normalize(conf.northstarRegion)});
        const installed = await clients.ensure({conf, allowInstall: false, guard: selectionGuard});
        diagnose(record, {clientPreparation: "ready", client: installed});
        diagnostics.update({clientVersion:installed.version});
        plan = preflight(conf, gameVersion, true);
        const profiles = require("./server-mod-profiles");
        const modConfiguration = await (conf.independentServerMods ? profiles.prepare : profiles.prepareShared)(plan.profileDirectory, network.normalize(conf.northstarRegion), {guard: compatibilityGuard});
        diagnose(record, {modConfiguration});
        compatibility = await modCompatibility.prepare(plan.profileDirectory, network.normalize(conf.northstarRegion), {clientVersion: installed.version, guard: compatibilityGuard});
        ipcMain.emit("gui-getmods");
        diagnostics.stage("client", "observed");
      } else if (plan.officialMods) {
        diagnostics.stage("client", "active");
        const installed = await require("./vanilla-client").ensure({conf,allowInstall:false,guard:compatibilityGuard});
        diagnostics.update({clientVersion:installed.version});
        plan = preflight(conf,gameVersion,true);
        const modConfiguration = await require("./server-mod-profiles").prepareOfficial(plan.profileDirectory,{guard:compatibilityGuard,independent:conf.independentServerMods===true});
        diagnose(record,{clientPreparation:"ready",officialMods:true,client:installed,modConfiguration});
        compatibility = await modCompatibility.prepare(plan.profileDirectory,"vanilla",{guard:compatibilityGuard});
        ipcMain.emit("gui-getmods");
        diagnostics.stage("client", "observed");
      } else {
        await clients.recover(conf);
        const profileDirectory = network.resolveProfile(plan.root, splitArguments(conf.nsargs || ""));
        if (fs.existsSync(profileDirectory)) compatibility = await modCompatibility.prepare(profileDirectory, "vanilla", {guard: compatibilityGuard});
        cleanMarker = await markerManager.prepare(plan.root,{guard:compatibilityGuard});
        cleanProxy = await require("./clean-loader-proxy").prepare(plan.root,{guard:compatibilityGuard});
      }
      if (compatibility) {
        diagnose(record, {modCompatibility: compatibility});
        if (compatibility.applied.length || compatibility.restored.length) send("launch-compatibility", compatibility);
      }
      clientPreparation = false;
      diagnose(record, {root: plan.root, executable: plan.executable, args: plan.args, officialMods:plan.officialMods,consoleMode: plan.usesLoader ? plan.quietConsole ? "official-noallocconsole" : "owned-console-only" : "game-default"});
      diagnostics.stage("skins", "active");
      const guard = await protection.beforeLaunch(plan.root);
      diagnostics.stage("skins", "observed");
      send("launch-guard-result", guard);
      // Protection may await disk IO. Recheck before creating a process so an
      // external launch cannot slip through the renderer's older state.
      baseline = await baselineSnapshot();
      if (hasGame(baseline)) throw launchError("GAME_ALREADY_RUNNING", "游戏已由其他程序启动，请等待启动完成或先退出游戏。");
      selectionGuard();
      // Console capability has already been checked against the selected DLL.
      // Its owned helper may initialize alongside EA, without touching game
      // files or spawning the game. Wait for both before the final fresh guard;
      // collect failures so a prepared helper always reaches the cleanup path.
      diagnostics.stage("ea", "active");
      const preparations = await Promise.allSettled([ea.prepare({snapshot: () => running.snapshot(), initial: baseline, guard: selectionGuard, onStage(stage, detail) {
        diagnose(record, {eaPreparation: {stage, ...detail}});
        if (stage === "ready") diagnostics.stage("ea", "observed");
        if (stage !== "ready") send("launch-status", {state: "starting", gameVersion, phase: stage === "starting" ? "prepare-ea" : "wait-ea"});
      }}), plan.usesLoader && !plan.quietConsole ? prepareLegacyConsole(record) : Promise.resolve(null)]);
      consoleController = preparations[1].status === "fulfilled" ? preparations[1].value : null;
      if (preparations[0].status === "rejected") throw preparations[0].reason;
      if (preparations[1].status === "rejected") throw preparations[1].reason;
      const platform = preparations[0].value;
      diagnostics.stage("ea", "observed");
      // The platform wait may open EA's login/update UI. Repeat all guards
      // before spawning the selected game; no vanilla fallback is permitted.
      baseline = await baselineSnapshot();
      if (hasGame(baseline)) throw launchError("GAME_ALREADY_RUNNING", "游戏已由其他程序启动，请等待启动完成或先退出游戏。");
      selectionGuard();
      if (gameVersion === "northstar") require("./server-mod-profiles").assertNorthstarReady(plan.profileDirectory, network.normalize(conf.northstarRegion));
      if (plan.officialMods) require("./server-mod-profiles").assertOfficialReady(plan.profileDirectory);
      const steamRoute = plan.officialMods ? await require("./steam-game-launch").resolve(plan.root) : null;
      const selectedExecutable = steamRoute?.executable || path.join(plan.root,plan.executable);
      const selectedArguments = [...(steamRoute?.argsPrefix || []),...plan.args];
      baseline = await baselineSnapshot();
      if (hasGame(baseline)) throw launchError("GAME_ALREADY_RUNNING", "游戏已由其他程序启动，请等待启动完成或先退出游戏。");
      selectionGuard();
      diagnose(record,{platformDispatch:steamRoute ? "steam" : "direct"});
      let attempt = 0;
      const spawnSelected = () => {
        const previousLog = plan.usesLoader ? latestGameLog(plan.profileDirectory) : null;
        const startup = createStartupLog();
        const ownedSession = session;
        attempt++;
        diagnostics.update({attempts:attempt});
        diagnostics.stage("spawn", "active");
        diagnose(record, {startupLog: startup.filename, windowsHide: false, launchAttempt: attempt});
        send("launch-status", {state: "starting", gameVersion, phase: "wait-game"});
        activeReadiness = plan.usesLoader ? {session: ownedSession, record, root: plan.root, profileDirectory: plan.profileDirectory, startupLog: startup.filename, previousLog, startedAt: Date.now(), logFilename: null, logOffset: 0, officialMods:plan.officialMods,runtime: plan.officialMods ? new (require("./official-launch").OfficialReadiness)() : new NorthstarReadiness()} : null;
        console.info(lang("general.launching"), gameVersion === "vanilla" ? "Vanilla..." : "Northstar...");
        try {
        // This is the requested game window. SW_HIDE can propagate to the
        // engine Northstar loads in this same process and hide a healthy game.
        const child = spawn(selectedExecutable, selectedArguments, {cwd: plan.root, windowsHide: false, detached: true, stdio: ["ignore", startup.fd, startup.fd]});
        child.once("spawn", () => {
          confirmation.spawned(ownedSession, child.pid);
          if (latestDiagnostic === record) {diagnostics.stage("spawn", "observed"); diagnostics.stage("game", "active");}
          diagnose(record, {spawnedAt: new Date().toISOString(), launcherPid: child.pid || null});
          consoleController?.bind(child.pid);
          child.unref();
        });
        child.once("error", error => {consoleController?.cancel(); diagnose(record, {spawnErrorCode: error.code || null}); confirmation.fail(ownedSession, error);});
        child.once("exit", (code, signal) => {
          diagnose(record, {childExit: {code, signal: signal || null, at: new Date().toISOString()}});
          confirmation.launcherExited(ownedSession, code, signal, child.pid);
        });
        } catch (error) {consoleController?.cancel(); confirmation.fail(ownedSession, error);}
        finally {fs.closeSync(startup.fd);}
      };
      session = confirmation.begin(baseline, {gameVersion,requireReady:plan.usesLoader,officialMods:plan.officialMods,allowBootstrapHandoff:plan.officialMods,platformDispatch:Boolean(steamRoute), retryHandoff: platform.cold && !steamRoute ? async retrySession => {
        if (confirmation.current !== retrySession) return;
        diagnose(record, {eaHandoffRetry: "checking"});
        send("launch-status", {state: "starting", gameVersion, phase: "retry-ea"});
        const acceptArrivingHandoff = async () => {
          const appeared = await baselineSnapshot();
          if (!hasGame(appeared)) return false;
          confirmation.observe(appeared);
          diagnose(record, {eaHandoffRetry: "original-handoff-arrived"});
          send("launch-status", {state: "starting", gameVersion, phase: "wait-game"});
          return true;
        };
        try {await ea.prepare({snapshot: () => running.snapshot(), guard: selectionGuard, forceWait: true, timeoutMs: 15000, settleMs: 1000});}
        catch (error) {
          if (error.code === "GAME_ALREADY_RUNNING" && await acceptArrivingHandoff()) return;
          throw error;
        }
        if (confirmation.current !== retrySession) return;
        // Replay precisely the captured region/profile and executable, never
        // a Steam URI that could silently turn Northstar into the EA original.
        selectionGuard();
        consoleController = plan.usesLoader && !plan.quietConsole ? await prepareLegacyConsole(record) : null;
        const stopped = await baselineSnapshot();
        if (hasGame(stopped) && await acceptArrivingHandoff()) {consoleController?.cancel(); return;}
        selectionGuard();
        if (gameVersion === "northstar") require("./server-mod-profiles").assertNorthstarReady(plan.profileDirectory, network.normalize(conf.northstarRegion));
        if (plan.officialMods) require("./server-mod-profiles").assertOfficialReady(plan.profileDirectory);
        if (confirmation.current !== retrySession) return;
        diagnose(record, {eaHandoffRetry: "replaying"});
        spawnSelected();
      } : undefined});
      spawnSelected();
      const confirmed = await session.promise;
      if (!confirmed.ok) throw Object.assign(Error(confirmed.error), confirmed.code ? {code:confirmed.code} : {});
      diagnostics.finish();
      diagnose(record, {state: "confirmed", confirmedAt: new Date().toISOString(), confirmation: {pid: confirmed.pid, image: confirmed.image}});
      send("launch-status", {state: "confirmed", gameVersion, pid: confirmed.pid});
      return confirmed;
    });
    // Release the DDS gate before optional app shutdown; manual Exit can also
    // close EA App, so use the independent application quit path here.
    await diagnosticWrite;
    if (cleanProxy) {await cleanProxy.restore(); cleanProxy = null;}
    if (cleanMarker) {await cleanMarker.restore(); cleanMarker = null;}
    if (settings().exitAfterLaunch === true) app.quit();
    return result;
  } catch (error) {
    if (session) confirmation.fail(session, error);
    diagnostics.finish(error);
    const result = {ok: false, error: error.message || String(error), ...(error.code ? {code: error.code} : {})};
    diagnose(record, {state: "failed", failedAt: new Date().toISOString(), error: result.error});
    console.error(result.error);
    send("launch-status", {state: "failed", gameVersion, error: result.error, ...(result.code ? {code: result.code} : {})});
    if (clientPreparation) send("launch-guard-result", {...result,scope:"client"});
    await diagnosticWrite;
    return result;
  } finally {
    consoleController?.cancel(); activeReadiness = null;
    if (cleanProxy) try {await cleanProxy.restore();} catch (error) {console.error(error.message);send("launch-guard-result",{ok:false,scope:"client",error:error.message,code:error.code||"CLEAN_LAUNCH_RECOVERY"});}
    if (cleanMarker) try {await cleanMarker.restore();} catch (error) {console.error(error.message);send("launch-guard-result",{ok:false,scope:"client",error:error.message,code:error.code||"CLEAN_LAUNCH_RECOVERY"});}
    launching = false;
  }
}

module.exports = launch;
