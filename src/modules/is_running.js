"use strict";
const win = require("../win");
const {execFile} = require("child_process");
const {EventEmitter} = require("events");

const events = new EventEmitter();
const GAME_NAMES = ["northstarlauncher.exe", "titanfall.exe", "titanfall2.exe", "titanfall2-unpacked.exe"];
let inFlight = null, timer = null, fastUntil = 0, lastGameState;
let lastCleanSnapshot = null, lastCleanAt = 0;
let pollGeneration = 0;

function parseCsvLine(line) {
  const fields = [];
  let value = "", quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {value += '"'; index++;}
      else quoted = !quoted;
    } else if (char === "," && !quoted) {fields.push(value); value = "";}
    else value += char;
  }
  fields.push(value);
  return fields;
}
function parseProcesses(stdout) {
  const input = String(stdout).trim();
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return values.filter(process => process && typeof process === "object").map(process => ({
      image: String(process.image || process.Name || "").toLowerCase(),
      pid: Number(process.pid ?? process.ProcessId),
      executablePath: typeof (process.executablePath ?? process.ExecutablePath) === "string" ? (process.executablePath ?? process.ExecutablePath) : null
    })).filter(process => process.image && Number.isFinite(process.pid));
  } catch (_) {}
  const processes = [];
  for (const line of input.split(/\r?\n/)) {
    const fields = parseCsvLine(line.trim());
    if (fields.length >= 2 && /^\d+$/.test(fields[1])) {
      processes.push({image: fields[0].toLowerCase(), pid: Number(fields[1]), ...(fields.length >= 3 ? {executablePath: fields[2] || null} : {})});
    }
  }
  return processes;
}
function contains(snapshot, names) {return snapshot.ok && snapshot.processes.some(process => names.includes(process.image));}
function snapshot(options) {
  const maxAgeMs = Number(options?.maxAgeMs) || 0;
  if (maxAgeMs > 0 && lastCleanSnapshot && (Date.now() - lastCleanAt) <= maxAgeMs) {
    return Promise.resolve(lastCleanSnapshot);
  }
  // Guards, UI polling, and launch confirmation share one in-flight OS query.
  if (inFlight) return inFlight;
  const request = new Promise(resolve => {
    try {
      const script = "$ErrorActionPreference = 'Stop'; try { $procs = @(Get-Process -Name titanfall,titanfall2,titanfall2-unpacked,northstarlauncher,origin,eadesktop -ErrorAction SilentlyContinue); if (-not $procs.Count) { '[]' } else { $needCim = @($procs | Where-Object { -not $_.Path -and $_.Name -in @('titanfall','titanfall2','titanfall2-unpacked','northstarlauncher') }); $cimMap = @{}; if ($needCim.Count) { $filter = ($needCim.Id | ForEach-Object { \"ProcessId=$_\" }) -join ' OR '; foreach ($c in @(Get-CimInstance Win32_Process -Filter $filter)) { $cimMap[[int]$c.ProcessId] = $c.ExecutablePath } }; @($procs | ForEach-Object { $p = $_.Path; if (-not $p -and $cimMap.ContainsKey([int]$_.Id)) { $p = $cimMap[[int]$_.Id] }; [pscustomobject]@{ image = ($_.Name + '.exe'); pid = $_.Id; executablePath = $p } }) | ConvertTo-Json -Compress } } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }";
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {windowsHide: true, timeout: 8000, maxBuffer: 2 * 1024 * 1024}, (error, stdout = "") => {
        resolve({ok: !error, processes: error ? [] : parseProcesses(stdout)});
      });
    } catch (_) {resolve({ok: false, processes: []});}
  });
  inFlight = request.then(value => {
    inFlight = null;
    try {
      const window = win();
      if (window.webContents && !window.isDestroyed?.() && !window.webContents.isLoading?.()) window.send("game-process-snapshot", value);
    } catch (_) {}
    const gameState = value.ok && value.processes.some(process => GAME_NAMES.includes(process.image));
    if (value.ok && !gameState) {
      lastCleanSnapshot = value;
      lastCleanAt = Date.now();
    } else {
      lastCleanSnapshot = null;
      lastCleanAt = 0;
    }
    // Preserve the last UI state if tasklist temporarily fails.
    if (value.ok && gameState !== lastGameState) {
      // A query may finish before the renderer has loaded its IPC listeners.
      // Keep it pending until the window is ready rather than losing that state.
      try {
        const window = win();
        if (window.webContents && !window.isDestroyed?.() && !window.webContents.isLoading?.()) {
          window.send("is-running", gameState);
          lastGameState = gameState;
        }
      } catch (_) {}
    }
    events.emit("snapshot", value);
    return value;
  });
  return inFlight;
}
function interval() {
  if (Date.now() < fastUntil) return 1000;
  try {const window = win(); if (window.isMinimized?.() || window.isVisible?.() === false) return 60000;} catch (_) {}
  return 20000;
}
function schedule(delay = interval()) {
  const generation = ++pollGeneration;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await snapshot();
    if (generation === pollGeneration) schedule();
  }, delay);
  timer.unref?.();
}
schedule(3000);

module.exports = {
  snapshot,
  onSnapshot(listener) {events.on("snapshot", listener); return () => events.off("snapshot", listener);},
  speedUp(until) {lastCleanSnapshot = null; lastCleanAt = 0; fastUntil = until; schedule(until ? 100 : interval());},
  game: async (maxAgeMs = 0) => contains(await snapshot(maxAgeMs ? {maxAgeMs} : undefined), GAME_NAMES),
  origin: async () => contains(await snapshot(), ["origin.exe", "eadesktop.exe"]),
  titanfall: async () => contains(await snapshot(), ["titanfall2.exe", "titanfall2-unpacked.exe"]),
  northstar: async () => contains(await snapshot(), ["northstarlauncher.exe"]),
  parseProcesses,
  stop() {++pollGeneration; clearTimeout(timer); timer = null;}
};
