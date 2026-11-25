"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), vm = require("node:vm"), {EventEmitter} = require("node:events");
const {describe, formatReport} = require("../src/modules/ea-diagnostic-report");

function fixture(t, {active = false, registryOK = true, portOwner = "none", networkCode = null, openError = ""} = {}) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tfx-ea-diagnostics-"));
	t.after(() => fs.rmSync(directory, {recursive:true, force:true}));
	const handlers = new Map(), calls = [], settings = {eaEmulator:false, gamepath:directory};
	settings.saveAsync = async patch => { Object.assign(settings, patch); calls.push("save"); };
	const electron = {app:{getPath:() => directory}, ipcMain:{handle:(name, handler) => handlers.set(name, handler)}, shell:{openPath:async filename => {calls.push({open:filename}); return openError;}}, clipboard:{writeText:value => calls.push({copied:value})}};
	const emulator = {isActive:() => active, diagnostics:() => ({active, port:active ? 45678 : 3216, recent:[]}), ensureRegistry:async () => {calls.push("registry"); return {ok:registryOK};}, readRegistry:async () => ({values:registryOK ? [{value:"C:\\Windows\\System32\\sdiagnhost.exe"}] : []}), stop:async () => {calls.push("stop");}};
	const account = {status:() => ({loggedIn:true, expired:false, playerName:"TEST", accessToken:"DO-NOT-COPY", userId:"DO-NOT-COPY-ID"}), storePath:() => path.join(directory,"account.json")};
	const net = {connect:() => {const socket = new EventEmitter(); socket.setTimeout=()=>{}; socket.destroy=()=>{}; process.nextTick(() => portOwner === "other" ? socket.emit("connect") : socket.emit("error", {code:"ECONNREFUSED"})); return socket;}};
	const https = {request:(_url, options, onResponse) => {calls.push({network:options.method}); const req = new EventEmitter(); req.destroy=()=>{}; req.end=()=>process.nextTick(() => networkCode ? req.emit("error", {code:networkCode}) : onResponse({statusCode:403,resume(){}})); return req;}};
	const module = {exports:{}};
	const modules = {electron, net, https, fs, path, "./ea-account":account, "./ea-emulator":emulator, "./findgame":{validateGamePath:value => value}, "./settings":() => settings, "./ea-port-recovery":{recoverPortConflict:async ({probe}) => {const port = await probe(); return {resolved:port.owner !== "other",port};}}, "./ea-diagnostic-report":{describe,formatReport}};
	vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/modules/ea-diagnostics.js"),"utf8"), {module, exports:module.exports, require:id => {if (!(id in modules)) throw Error(id); return modules[id];}, setTimeout,clearTimeout,Date,Promise,console});
	module.exports.register();
	return {api:module.exports, invoke:(name,...args) => handlers.get(name)({},...args), calls, settings, directory};
}

test("local diagnosis performs no account refresh/network request and reports standby truthfully", async t => {
	const f = fixture(t), result = await f.invoke("ea-diagnostics",{network:false});
	assert.equal(result.ok,true); assert.equal(result.diagnostics.account.loggedIn,true);
	assert.equal(result.diagnostics.view.checks.find(item => item.id === "service").value,"已关闭");
	assert.equal(f.calls.length,0);
	f.settings.eaEmulator=true;
	assert.equal((await f.api.collect()).view.checks.find(item => item.id === "service").value,"待命");
});

test("manual diagnosis checks EA transport and treats HTTP rejection as reachable, not authenticated", async t => {
	const f=fixture(t), {diagnostics}=await f.invoke("ea-diagnostics");
	assert.equal(diagnostics.network.reachable,true); assert.equal(diagnostics.network.status,403);
	assert.match(diagnostics.view.checks.find(item => item.id === "network").detail,/不代表账户已获授权/);
	assert.equal(f.calls.filter(item => item.network).length,1);
});

test("network errors appear as failed checks while local diagnostic results remain available", async t => {
	const f=fixture(t,{networkCode:"ENOTFOUND"}), result=await f.invoke("ea-diagnostics");
	assert.equal(result.ok,true); assert.equal(result.diagnostics.view.checks.find(item => item.id === "network").state,"warn");
	assert.match(formatReport(result.diagnostics),/ENOTFOUND/);
});

test("copy report writes actual clipboard data without secrets, account IDs or filesystem paths", async t => {
	const f=fixture(t); await f.invoke("ea-diagnostics",{network:false});
	assert.equal((await f.invoke("ea-diagnostics-copy")).ok,true);
	const copied=f.calls.find(item => item.copied)?.copied;
	assert.match(copied,/TFX Launcher/); assert.match(copied,/LSX 通道/);
	assert(!copied.includes("DO-NOT-COPY")); assert(!copied.includes(f.directory));
});

test("first log open creates a readable file and later opens preserve existing content", async t => {
	const f=fixture(t);
	assert.equal((await f.invoke("ea-diagnostics-open-log","lsx")).ok,true);
	const filename=path.join(f.directory,"fold-ea-lsx.log"); assert.match(fs.readFileSync(filename,"utf8"),/log-opened/);
	fs.writeFileSync(filename,"existing log\n"); await f.invoke("ea-diagnostics-open-log","lsx");
	assert.equal(fs.readFileSync(filename,"utf8"),"existing log\n");
	assert.equal((await f.invoke("ea-diagnostics-open-log","ea")).ok,true);
	assert(fs.existsSync(path.join(f.directory,"fold-ea.log")));
});

test("OS log open failures are returned to the renderer", async t => {
	const f=fixture(t,{openError:"No associated application"});
	const result=await f.invoke("ea-diagnostics-open-log","ea"); assert.equal(result.ok,false); assert.match(result.error,/No associated application/);
});

test("repair does not report success when registry write fails or another app owns the default port", async t => {
	for(const options of [{registryOK:false},{portOwner:"other"}]){
		const f=fixture(t,options), result=await f.invoke("ea-diagnostics-repair");
		assert.equal(result.ok,true);assert.equal(result.repaired,false);assert.equal(f.settings.eaEmulator,true);
		assert(!f.calls.includes("stop"));assert(result.diagnostics.view.issues>0);
	}
});

test("repair is blocked during active service, while diagnosis reports its dynamically allocated port", async t => {
	const f=fixture(t,{active:true});
	assert.equal((await f.invoke("ea-diagnostics-repair")).code,"EA_SERVICE_ACTIVE");assert.equal(f.calls.length,0);
	assert.equal((await f.api.collect()).port.port,45678);
});

test("report distinguishes expired credentials, invalid game directory and missing bridge", () => {
	const view=describe({emulatorEnabled:true,account:{loggedIn:true,expired:true},port:{owner:"none",port:3216},registry:{values:[{value:"C:\\EA\\EADesktop.exe"}]},game:{valid:false}});
	assert.equal(view.checks.find(item => item.id === "account").value,"已过期");
	assert.equal(view.checks.find(item => item.id === "registry").value,"待配置");
	assert.equal(view.issues,3);
});

test("refresh renews expired credentials even with an existing cached avatar", async t => {
	const directory=fs.mkdtempSync(path.join(os.tmpdir(),"tfx-ea-refresh-")); t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
	const avatar=path.join(directory,"avatar.png");fs.writeFileSync(avatar,"fixture");
	let refreshes=0;const handlers=new Map();
	const api={refreshToken:async token=>{assert.equal(token,"refresh-before");refreshes++;return {accessToken:"access-after",refreshToken:"refresh-after",expiresIn:3600};},avatar:async()=>null};
	const electron={app:{getPath:()=>directory},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},
		safeStorage:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value),decryptString:value=>value.toString()}};
	const module={exports:{}};
	vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/modules/ea-account.js"),"utf8"),{module,exports:module.exports,require:id=>id==="electron"?electron:id==="./ea-api"?api:id==="./ea-crypto"?{createPcSign(){}}:require(id),Buffer,URL,URLSearchParams,Response,setTimeout,clearTimeout,console,process});
	module.exports.writeStore({accessToken:"expired",refreshToken:"refresh-before",expiresAt:Date.now()-1000,avatarPath:avatar,playerName:"Player",personaId:"123",userId:"456"});
	module.exports.register();const result=await handlers.get("ea-refresh")();
	assert.equal(result.ok,true);assert.equal(result.status.expired,false);assert.equal(refreshes,1);
	assert.equal(module.exports.readStore().accessToken,"access-after");assert.equal(result.status.accessToken,undefined);
});
