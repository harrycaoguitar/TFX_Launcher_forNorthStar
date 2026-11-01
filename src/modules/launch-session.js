"use strict";

const GAME_IMAGES = new Set(["titanfall2.exe", "titanfall2-unpacked.exe"]);
const LAUNCH_IMAGES = new Set([...GAME_IMAGES, "northstarlauncher.exe"]);
const gameRoots = require("./game-roots");

// Parse Windows arguments directly. Never execute the setting as shell commands.
function splitArguments(input = "") {
  if (typeof input !== "string" || input.includes("\0")) throw Error("启动参数无效");
  const result = [];
  let value = "", quoted = false, started = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (!quoted && /\s/.test(char)) {
      if (started) {result.push(value); value = ""; started = false;}
      continue;
    }
    started = true;
    if (char === "\\") {
      let end = index;
      while (input[end] === "\\") end++;
      const count = end - index;
      if (input[end] === '"') {
        value += "\\".repeat(Math.floor(count / 2));
        if (count % 2) value += '"';
        else quoted = !quoted;
        index = end;
      } else {value += "\\".repeat(count); index = end - 1;}
    } else if (char === '"') quoted = !quoted;
    else value += char;
  }
  if (quoted) throw Error("启动参数中的引号没有闭合");
  if (started) result.push(value);
  return result;
}

function image(process) {return String(process.image || "").toLowerCase();}
function hasGame(snapshot, root) {
  if (root !== undefined && root !== null) return gameRoots.hasGame(snapshot, root);
  return Boolean(snapshot?.ok && snapshot.processes.some(process => LAUNCH_IMAGES.has(image(process))));
}
function ownedProcesses(snapshot, root) {
  if (root === undefined || root === null) return snapshot?.processes || [];
  return gameRoots.processesForRoot(snapshot, root);
}

// Confirmation is required for every launch, independently of the optional
// launcher auto-exit preference. A launcher process may hand off to the game.
class LaunchConfirmation {
  constructor({speedUp, refresh, now = Date.now, schedule = setTimeout, clear = clearTimeout, timeoutMs = 120000, stableMs = 5000, readyStableMs = 1000, exitGraceMs = 2500, handoffGraceMs = 15000, bootstrapHandoffGraceMs = 60000}) {
    Object.assign(this, {speedUp, refresh, now, schedule, clear, timeoutMs, stableMs, readyStableMs, exitGraceMs, handoffGraceMs, bootstrapHandoffGraceMs});
    this.current = null;
  }
  begin(baseline, options = {}) {
    if (this.current) throw Error("已有游戏启动请求正在等待确认");
    if (!baseline?.ok) throw Error("无法读取游戏进程，请稍后重试启动");
    if (hasGame(baseline, options.root)) throw Error("游戏或北极星启动进程已经运行，请等待启动完成或先退出游戏");
    const requireReady = options.gameVersion === "northstar" || options.requireReady === true;
    const targetImages = requireReady ? LAUNCH_IMAGES : GAME_IMAGES;
    const session = {spawned: false, ready: false, entered: false, root: options.root, requireReady, officialMods:options.officialMods===true, childPid: null, baselinePids: new Set(baseline.processes.map(process => String(process.pid))), seenPid: null, seenAt: 0, childExit: null, everSeen: false, everCandidate: false, everHandoffCandidate: false, bootstrapHandoff: false, missingAt: null, observationRevision: 0, lastSnapshotOk: true, lastSnapshot: baseline, retryHandoff: options.retryHandoff, retryPending: false, retryAttempted: false, targetImages};
    session.allowBootstrapHandoff = options.allowBootstrapHandoff === true || !requireReady;
    session.platformDispatch = options.platformDispatch === true;
    session.promise = new Promise(resolve => {session.resolve = resolve;});
    this.current = session;
    session.timer = this.schedule(() => this.fail(session, session.requireReady && session.everSeen && !session.ready ? Object.assign(new Error(session.officialMods ? "游戏进程已运行，但未能确认 VanillaPlus 已加载。请退出游戏，检查官服 Mod 组件与启用的 Mod 后重试。" : "游戏进程已运行，但未能确认北极星私人服务器菜单已加载。请退出游戏并检查启动诊断后重试。"), {code:session.officialMods?"OFFICIAL_MOD_NOT_READY":"NORTHSTAR_NOT_READY"}) : Object.assign(new Error("等待游戏启动超时。请检查 EA App / Steam 是否已登录、是否有弹窗，确认游戏未启动后再重试；详情见启动诊断。"), {code:"LAUNCH_TIMEOUT"})), this.timeoutMs);
    session.timer?.unref?.();
    this.speedUp?.(this.now() + this.timeoutMs);
    return session;
  }
  spawned(session, pid) {if (session && this.current === session) {
    if (session.retryAttempted && session.childPid) session.baselinePids.add(session.childPid);
    session.spawned = true; session.childPid = String(pid || ""); session.bootstrapHandoff = false;
  }}
  entered(session) {if (session && this.current === session) {session.entered = true; session.retryPending = false;}}
  ready(session) {
    if (session && this.current === session) {
      session.ready = true;
      session.retryPending = false;
      if (session.childExit) this.watchExit(session, Math.max(100, this.exitGraceMs - (this.now() - session.childExit.at)));
    }
  }
  launcherExited(session, code, signal, pid) {
    if (!session || this.current !== session) return;
    if (pid !== undefined && String(pid) !== session.childPid) return;
    session.childExit = {code, signal: signal || null, at: this.now()};
    // Titanfall's vanilla bootstrap uses 100010 for the Steam/EA handoff.
    // Its own PID can appear as Titanfall2.exe before exiting; that is not
    // evidence that the separate game has appeared and then quickly closed.
    session.bootstrapHandoff = !signal && (session.allowBootstrapHandoff && code === 100010 || session.platformDispatch && code === 0);
    if (session.bootstrapHandoff) {
      if (session.seenPid === session.childPid) session.seenPid = null;
      session.everCandidate = session.everHandoffCandidate;
      if (!session.everCandidate) session.missingAt = null;
    }
    // Only a cold platform initialization may replay a dropped handoff. Never
    // replay a request after a real game/core menu was observed or after an
    // unrecognized crash. The original overall deadline is retained.
    session.retryPending = Boolean(!session.platformDispatch && session.retryHandoff && !session.retryAttempted && !signal &&
      !session.ready && !session.entered && !session.everCandidate && !session.everHandoffCandidate &&
      (session.bootstrapHandoff || (session.requireReady && (code === 0 || code === 100010))));
    // Zero may hand off to Steam/EA. If a game was already observed, a short
    // disappearance grace covers quick close without waiting the full timeout.
    this.watchExit(session, session.retryPending ? this.handoffGraceMs : session.bootstrapHandoff && !session.everCandidate ? this.bootstrapHandoffGraceMs : session.everCandidate || session.ready || session.entered || code || signal ? this.exitGraceMs : this.handoffGraceMs);
  }
  watchExit(session, delay) {
    this.clear(session.exitTimer);
    session.exitTimer = this.schedule(async () => {
      if (this.current !== session) return;
      if (this.refresh) {
        const revision = session.observationRevision;
        try {
          const snapshot = await this.refresh();
          if (this.current !== session) return;
          if (revision === session.observationRevision) this.observe(snapshot);
        } catch (_) {session.lastSnapshotOk = false;}
      }
      if (this.current !== session) return;
      // A failed process query is never evidence that the game exited. Retry
      // within the original bounded timeout, retaining explicit retry on failure.
      if (!session.lastSnapshotOk) {this.watchExit(session, this.exitGraceMs); return;}
      if (session.seenPid) return;
      if (session.retryPending && !session.retryAttempted) {
        // A still-running bootstrap or a new external game is not permission
        // to duplicate it, even if it has not reached confirmation yet.
        if (hasGame(session.lastSnapshot, session.root)) {this.watchExit(session, this.exitGraceMs); return;}
        session.retryAttempted = true; session.retryPending = false;
        // Keep observing during the asynchronous replay readiness guard. The
        // original Steam/EA request may still deliver the real game in this
        // gap; that arrival must win over replay and remain confirmable.
        session.childExit = null; session.seenPid = null;
        session.everSeen = false; session.everCandidate = false; session.missingAt = null;
        try {await session.retryHandoff(session);} catch (error) {this.fail(session, error);}
        return;
      }
      if (!session.bootstrapHandoff && (session.childExit?.code || session.childExit?.signal)) {this.fail(session, this.exitError(session)); return;}
      const since = session.everCandidate ? session.missingAt : session.childExit?.at;
      const grace = session.everCandidate || session.ready || session.entered ? this.exitGraceMs : session.bootstrapHandoff ? this.bootstrapHandoffGraceMs : this.handoffGraceMs;
      if (since !== null && since !== undefined && this.now() - since >= grace) this.fail(session, this.exitError(session));
      else if (since !== null && since !== undefined) this.watchExit(session, Math.max(100, grace - (this.now() - since)));
    }, delay);
    session.exitTimer?.unref?.();
  }
  exitError(session) {
    const value = session.childExit;
    if (session.requireReady && !session.ready) {
      const detail = value?.signal ? "（" + value.signal + "）" : value?.code ? "（退出码 " + value.code + "）" : "";
      return Object.assign(Error("游戏在主菜单加载完成前退出" + detail + "。若不是手动关闭，请先排查最近启用的 Mod 或皮肤，再检查 EA App / Steam 登录提示与启动诊断。"), {code:session.everCandidate || session.entered ? "LAUNCH_EARLY_EXIT" : "LAUNCHER_EARLY_EXIT"});
    }
    if ((session.everCandidate || session.ready || session.entered) && (!value?.code || session.bootstrapHandoff) && !value?.signal) return Object.assign(Error("游戏在启动确认完成前已退出。现在可以重新启动；若不是手动关闭，请检查 EA App / Steam 提示与启动诊断。"), {code:"LAUNCH_EARLY_EXIT"});
    return Object.assign(Error("游戏启动进程提前退出" + (value?.signal ? "（" + value.signal + "）" : "（退出码 " + value?.code + "）") + "。请检查 EA App / Steam 的登录或授权提示、北极星文件是否完整，再重试。"), {code:session.everCandidate || session.ready || session.entered ? "LAUNCH_EARLY_EXIT" : "LAUNCHER_EARLY_EXIT"});
  }
  settle(session, result) {
    if (!session || this.current !== session) return;
    this.clear(session.timer);
    this.clear(session.exitTimer);
    this.current = null;
    this.speedUp?.(0);
    session.resolve(result);
  }
  fail(session, error) {this.settle(session, {ok: false, error: error?.message || String(error || "游戏启动未完成"), ...(error?.code ? {code:error.code} : {})});}
  observe(snapshot) {
    const session = this.current;
    if (!session?.spawned) return;
    session.observationRevision++;
    session.lastSnapshotOk = Boolean(snapshot?.ok);
    session.lastSnapshot = snapshot;
    const scopedProcesses = ownedProcesses(snapshot, session.root);
    if (!snapshot?.ok || scopedProcesses === null) {session.lastSnapshotOk = false; session.missingAt = null; return;}
    session.lastSnapshotOk = true;
    // Northstar can stay in NorthstarLauncher.exe while loading Titanfall 2;
    // accept both that owned launcher PID and the handoff game PID.
    const candidates = scopedProcesses.filter(process => session.targetImages.has(image(process)) && !session.baselinePids.has(String(process.pid)) &&
      (!session.bootstrapHandoff || String(process.pid) !== session.childPid));
    const games = candidates.filter(process =>
      (image(process) !== "northstarlauncher.exe" || (session.ready && String(process.pid) === session.childPid)));
    const ownedCandidates = candidates.filter(process =>
      (image(process) !== "northstarlauncher.exe" || String(process.pid) === session.childPid));
    if (ownedCandidates.length) {session.everSeen = true; session.missingAt = null;}
    if (games.length) {session.everCandidate = true; session.retryPending = false;}
    if (games.some(process => String(process.pid) !== session.childPid)) session.everHandoffCandidate = true;
    const confirmed = games.find(process => String(process.pid) === session.seenPid);
    // A verified Northstar core/menu plus two stable process observations is
    // stronger evidence than a vanilla bootstrap PID. Keep the longer vanilla
    // handoff window, while releasing a ready Northstar launch promptly.
    const stableMs = session.requireReady && session.ready ? this.readyStableMs : this.stableMs;
    if (confirmed && (!session.requireReady || session.ready) && this.now() - session.seenAt >= stableMs) {
      this.settle(session, {ok: true, pid: Number(confirmed.pid), image: image(confirmed)});
      return;
    }
    if (!confirmed) {
      const hadCandidate = session.seenPid !== null;
      session.seenPid = games.length ? String(games[0].pid) : null;
      session.seenAt = this.now();
      if (!ownedCandidates.length && (hadCandidate || session.everCandidate)) {
        if (session.missingAt === null) {session.missingAt = this.now(); this.watchExit(session, this.exitGraceMs);}
        if (this.now() - session.missingAt >= this.exitGraceMs) this.fail(session, this.exitError(session));
      }
    }
  }
}

// Require a new game PID to survive two snapshots; an OS spawn alone can still
// be rejected by EA/Steam, and an already running game does not belong to us.
class LaunchExitSession {
  constructor({quit, enabled, speedUp, now = Date.now, schedule = setTimeout, clear = clearTimeout, timeoutMs = 120000, stableMs = 1000}) {
    Object.assign(this, {quit, enabled, speedUp, now, schedule, clear, timeoutMs, stableMs});
    this.current = null;
  }
  begin(baseline, options = {}) {
    this.cancel();
    const root = options.root;
    if (!this.enabled() || !baseline?.ok || hasGame(baseline, root)) return null;
    const session = {spawned: false, root, baselinePids: new Set(baseline.processes.map(process => String(process.pid))), seenPid: null, seenAt: 0, targetImages: GAME_IMAGES};
    this.current = session;
    session.timer = this.schedule(() => this.fail(session), this.timeoutMs);
    session.timer?.unref?.();
    this.speedUp?.(this.now() + this.timeoutMs);
    return session;
  }
  spawned(session) {if (session && this.current === session) session.spawned = true;}
  fail(session) {if (session && this.current === session) this.cancel();}
  cancel() {
    if (this.current) this.clear(this.current.timer);
    this.current = null;
    this.speedUp?.(0);
  }
  observe(snapshot) {
    const session = this.current;
    if (!session?.spawned) return;
    if (!this.enabled()) {this.cancel(); return;}
    const scopedProcesses = ownedProcesses(snapshot, session.root);
    if (!snapshot?.ok || scopedProcesses === null) {session.seenPid = null; return;}
    const games = scopedProcesses.filter(process => GAME_IMAGES.has(image(process)) && !session.baselinePids.has(String(process.pid)));
    const confirmed = games.find(process => String(process.pid) === session.seenPid);
    if (confirmed && this.now() - session.seenAt >= this.stableMs) {
      this.cancel();
      // Bypass the manual Exit IPC's EA/Origin kill so the game keeps running.
      this.quit();
      return;
    }
    if (!confirmed) {
      session.seenPid = games.length ? String(games[0].pid) : null;
      session.seenAt = this.now();
    }
  }
}

module.exports = {LaunchConfirmation, LaunchExitSession, splitArguments, hasGame, GAME_IMAGES, LAUNCH_IMAGES};
