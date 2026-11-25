"use strict";
const roots = require("./game-roots");
const IMAGES = new Set(["titanfall2.exe", "titanfall2-unpacked.exe", "northstarlauncher.exe"]);
function assertLaunchAvailable(snapshot, root, gameVersion) {
  if (!snapshot?.ok || !Array.isArray(snapshot.processes)) throw Object.assign(Error("无法读取游戏进程，请稍后重试。"), {code:"PROCESS_QUERY_FAILED"});
  if (gameVersion === "northstar") {
    const others = snapshot.processes.filter(p => IMAGES.has(String(p.image).toLowerCase()));
    if (others.some(p => !p.executablePath)) throw Object.assign(Error("检测到正在运行的泰坦陨落2进程，但无法确认其目录。请先退出游戏后重试。"), {code:"PROCESS_QUERY_FAILED"});
    if (others.some(p => !roots.processBelongsToRoot(p.executablePath, root))) throw Object.assign(Error("另一目录中的泰坦陨落2或北极星正在运行。请先退出另一份游戏，再启动。同一账号同时登录北极星可能使联机会话失效。"), {code:"NORTHSTAR_OTHER_INSTANCE"});
  }
  if (roots.hasGame(snapshot, root)) throw Object.assign(Error("所选游戏目录已有游戏或北极星启动进程，请先退出该目录中的游戏。"), {code:"GAME_ALREADY_RUNNING"});
}
const CONNECTION_CODES = new Set(["authenticated", "session-expired", "master-unreachable", "auth-rejected", "server-timeout"]);
function connectionEvent(line) {
  if (/Northstar origin authentication completed successfully/i.test(line)) return "authenticated";
  if (/INVALID_MASTERSERVER_TOKEN/.test(line)) return "session-expired";
  // Only auth/list transport failures count: news/promos and mod downloads do not.
  if (/Failed (?:performing northstar origin auth|authenticating with (?:own )?server|(?:getting|requesting|fetching) (?:the )?server list)/i.test(line) && /SSL|TLS|certificate|resolve|connect|timed? out|timeout/i.test(line)) return "master-unreachable";
  if (/INVALID_ORIGIN_TOKEN|ORIGIN_AUTH_FAILED/.test(line)) return "auth-rejected";
  if (/Connection to server timed out|Disconnect:.*(?:connection.*timed out|Timed out)|Connection failed after \d+ retries/i.test(line)) return "server-timeout";
  return null;
}
module.exports = {assertLaunchAvailable, connectionEvent, CONNECTION_CODES};
