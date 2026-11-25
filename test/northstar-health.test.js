"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), vm = require("node:vm");
const {assertLaunchAvailable, connectionEvent} = require("../src/modules/northstar-health");
const {NorthstarReadiness, CORE_NAMES} = require("../src/modules/northstar-readiness");
const {LaunchDiagnostics, sanitizeReport, failureOutcome} = require("../src/modules/launch-diagnostics");
const roots = require("../src/modules/game-roots");
const snapshot = (...processes) => ({ok:true, processes});
const processAt = (executablePath, image="Titanfall2.exe") => ({pid:10, image, executablePath});
test("Northstar blocks another root, preserves same-root guard and ignores TF1", () => {
  assert.throws(() => assertLaunchAvailable(snapshot(processAt("D:/QA/Titanfall2.exe")), "D:/Game", "northstar"), {code:"NORTHSTAR_OTHER_INSTANCE"});
  assert.throws(() => assertLaunchAvailable(snapshot(processAt("D:/Game/NorthstarLauncher.exe", "NorthstarLauncher.exe")), "D:/Game", "northstar"), {code:"GAME_ALREADY_RUNNING"});
  assert.doesNotThrow(() => assertLaunchAvailable(snapshot(processAt("D:/TF1/Titanfall.exe", "Titanfall.exe")), "D:/Game", "northstar"));
  assert.doesNotThrow(() => assertLaunchAvailable(snapshot(processAt("D:/QA/Titanfall2.exe")), "D:/Game", "vanilla"));
  assert.doesNotThrow(() => assertLaunchAvailable(snapshot(), "D:/Game", "northstar"));
});
test("unknown process paths and failed query cannot silently allow a launch", () => {
  assert.throws(() => assertLaunchAvailable(snapshot(processAt(null)), "D:/Game", "northstar"), {code:"PROCESS_QUERY_FAILED"});
  assert.throws(() => assertLaunchAvailable({ok:false}, "D:/Game", "northstar"), {code:"PROCESS_QUERY_FAILED"});
  assert.equal(failureOutcome({code:"NORTHSTAR_OTHER_INSTANCE"}, "preflight").code, "preflight-failed");
});
test("transport, expired session, rejected auth, and game timeout are distinct", () => {
  assert.equal(connectionEvent("Failed performing northstar origin auth: error SSL connect error"), "master-unreachable");
  assert.equal(connectionEvent("Failed authenticating with own server: error Could not resolve host"), "master-unreachable");
  assert.equal(connectionEvent('{"error":{"enum":"INVALID_MASTERSERVER_TOKEN"}}'), "session-expired");
  assert.equal(connectionEvent("ORIGIN_AUTH_FAILED"), "auth-rejected");
  assert.equal(connectionEvent("Connection to server timed out"), "server-timeout");
  assert.equal(connectionEvent("Failed requesting main menu promos: error SSL connect error"), null);
  assert.equal(connectionEvent("Mod download timed out"), null);
});
test("auth is not menu readiness and menu is not auth; complete chunked lines only", () => {
  const p = new NorthstarReadiness();
  assert.equal(p.consume(CORE_NAMES.map(n=>`'${n}' loaded successfully, version 1.0\n`).join("")+"Northstar origin authentication completed successfully\n").ready, false);
  assert.equal(p.state.authenticated, true);
  assert.equal(p.consume("MainMenuPanel\n").ready, true);
  assert.equal(p.consume("INVALID_MASTERSERVER_").connection, "authenticated");
  assert.equal(p.consume("TOKEN\n").connection, "session-expired");
  assert.equal(p.state.authenticated, false);
  assert.equal(p.state.ready, true);
  assert.equal(new NorthstarReadiness().consume("MainMenuPanel\n").authenticated, false);
});
test("late connection diagnostics preserve launch success and exclude private fields", () => {
  const d = new LaunchDiagnostics();d.begin("northstar");d.finish();
  d.connection({code:"session-expired", authenticated:false, token:"SECRET", path:"D:/PRIVATE"});
  const report = sanitizeReport({...d.report(), connection:{...d.report().connection, account:"PRIVATE"}});
  assert.equal(report.state, "confirmed");assert.equal(report.outcome.code, "confirmed");
  assert.deepEqual(report.connection, {code:"session-expired", authenticated:false});
  assert(!JSON.stringify(report).match(/SECRET|PRIVATE/));
  d.begin("northstar");assert.equal(d.report().connection, undefined);
});
function probeHarness(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(), "tfx-health-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,"Titanfall2.exe"),"");fs.mkdirSync(path.join(root,"logs"));const logfile=path.join(root,"logs","nslog-test.txt");fs.writeFileSync(logfile,"");
  const events=[], failures=[], stages=[];
  const probe={session:{ready:true},confirmedPid:42,root,profileDirectory:root,startedAt:0,previousLog:null,logFilename:null,logOffset:0,record:{},runtime:new NorthstarReadiness()};
  const context=vm.createContext({fs,path,Buffer,NorthstarReadiness,activeReadiness:probe,gameRoots:roots,confirmation:{current:null,fail:(_,e)=>failures.push(e)},diagnostics:{connection:v=>events.push(v),stage:(...v)=>stages.push(v)},send(){},diagnose(){},console:{error(){}}});
  const source=fs.readFileSync(path.join(__dirname,"../src/modules/launch.js"),"utf8");
  vm.runInContext(source.slice(source.indexOf("function readTail("),source.indexOf("function createStartupLog(")).replace('catch (_) { /* A process can hold its log briefly; retry next snapshot. */ }', 'catch (error) {throw error;}'), context);
  const poll=()=>context.probeReadiness(snapshot({pid:42,image:"Titanfall2.exe",executablePath:path.join(root,"Titanfall2.exe")}));
  return {root,logfile,events,failures,stages,context,poll};
}
test("confirmed game remains monitored, ignores partial lines and stops on exit", t => {
  const h=probeHarness(t);
  fs.appendFileSync(h.logfile,"Northstar origin authentication completed successfully\n");h.poll();
  fs.appendFileSync(h.logfile,"INVALID_MASTERSERVER_");h.poll();assert.equal(h.events.length,1);
  fs.appendFileSync(h.logfile,"TOKEN\n");h.poll();assert.equal(h.events.at(-1).code,"session-expired");
  h.poll();assert.equal(h.events.length,2);assert.equal(h.failures.length,0);assert.equal(h.stages.length,0);
  h.context.probeReadiness(snapshot());assert.equal(h.context.activeReadiness,null);
});
test("truncated and rotated logs discard partial lines and old auth state", t => {
  const h=probeHarness(t);fs.writeFileSync(h.logfile,"Northstar origin authentication completed successfully\nINVALID_MASTERSERVER_");h.poll();
  fs.writeFileSync(h.logfile,"TOKEN\n");h.poll();assert.equal(h.events.length,1);
  const rotated=path.join(h.root,"logs","nslog-new.txt");fs.writeFileSync(rotated,"Connection to server timed out\n");fs.utimesSync(rotated,new Date(Date.now()+2000),new Date(Date.now()+2000));h.poll();
  assert.equal(h.events.at(-1).code,"server-timeout");assert.equal(h.events.at(-1).authenticated,false);
});
test("UI keeps runtime errors separate from launch completion and deduplicates notifications", () => {
  const listeners={},toasts=[],status={hidden:true,textContent:"",title:"",classList:{toggle(){}}};
  const context=vm.createContext({I18n:{current:"zh-CN",text:v=>v,t:v=>v},document:{querySelectorAll:s=>s==='.fold-launch-status'?[status]:[]},window:{addEventListener(){}},ipcRenderer:{on:(name,fn)=>listeners[name]=fn},Toast:function(v){toasts.push(v);},launchPending:false});
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/app/js/launch-status.js"),"utf8"),context);
  listeners['launch-status'](null,{state:'confirmed',gameVersion:'northstar'});
  listeners['northstar-connection'](null,{code:'session-expired',authenticated:false});
  assert.match(status.textContent,/登录会话已失效/);assert.equal(status.hidden,false);assert.equal(context.window.VyraLaunch.state.state,'confirmed');
  listeners['northstar-connection'](null,{code:'session-expired',authenticated:false});assert.equal(toasts.length,1);
  listeners['northstar-connection'](null,{code:'authenticated',authenticated:true});assert.equal(status.hidden,true);
});


