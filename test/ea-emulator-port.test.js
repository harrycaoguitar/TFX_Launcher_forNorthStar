"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");

function fixture(startError) {
	const servers = [], messages = [];
	class Server {
		constructor(options) { this.options = options; this.address = {port: options.port ?? 3216}; this.stopped = false; servers.push(this); }
		async start() { if (startError && this.options.port !== 0) throw Object.assign(new Error("bind failed"), {code:startError}); }
		async stop() { this.stopped = true; }
	}
	const modules = {
		fs: {readFileSync() { throw new Error("No installer metadata"); }, existsSync: () => false, appendFileSync() {}},
		path, crypto: {randomUUID: () => "session"},
		child_process: {execFile(_file, args, _options, done) {
			const script = Buffer.from(args.at(-1), "base64").toString("utf16le");
			done(null, script.includes("$written") ? "written" : "en_US");
		}},
		electron: {app: {on() {}, getPath: () => "fixture"}},
		"./ea-lsx": {EaLsxServer: Server, CONTENT_ID: "1039093"},
		"./ea-crypto": {rtpHandshakeCode: () => "handshake"},
		"./console": {warn: message => messages.push(message)}
	};
	const module = {exports:{}};
	vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/modules/ea-emulator.js"), "utf8"), {
		module, exports: module.exports, require(id) { if (!(id in modules)) throw new Error(id); return modules[id]; },
		Buffer, setTimeout, Date
	});
	return {api:module.exports, servers, messages, start: () => module.exports.start({root:"fixture", profile:{accessToken:"test-only"}})};
}

test("an occupied LSX port stops launch instead of switching to an endpoint the game ignores", async () => {
	const f = fixture("EA_PORT_IN_USE");
	await assert.rejects(f.start(), error => error.code === "EA_PORT_IN_USE" && /3216/.test(error.message) && /EA App/.test(error.message));
	assert.equal(f.servers.length, 1);
	assert.equal(f.servers[0].stopped, true);
	assert.equal(f.api.isActive(), false);
});

test("the emulator binds the game SDK's default port and releases it on stop", async () => {
	const f = fixture(), session = await f.start();
	assert.equal(f.servers.length, 1);
	assert.equal(session.env.EALsxPort, "3216");
	assert.equal(f.api.isActive(), true);
	await session.stop();
	assert.equal(f.servers[0].stopped, true);
	assert.equal(f.api.isActive(), false);
});

test("other listener failures clean up without publishing an active emulator", async () => {
	const f = fixture("EACCES");
	await assert.rejects(f.start(), error => error.code === "EA_LSX_START_FAILED");
	assert.equal(f.servers.length, 1);
	assert.equal(f.servers[0].stopped, true);
	assert.equal(f.api.isActive(), false);
});
