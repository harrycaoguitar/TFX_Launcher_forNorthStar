"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), fsp = fs.promises;
const path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const {argumentsFor,OfficialReadiness,createCleanMarker} = require("../src/modules/official-launch");
const CORE = ["Northstar.Client","Northstar.Custom","Northstar.CustomServers"];
const loaded = (name, enabled = true) => `[NORTHSTAR] [info] '${name}' loaded successfully, version 2.5.1${enabled ? "" : " (DISABLED)"}\n`;
const readyLog = CORE.map(name => loaded(name,false)).join("") + loaded("VanillaPlus") + "[UI] MainMenuPanel\n";
async function fixture(t) {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(),"tfx-official-launch-")), game = path.join(home,"Titanfall2"), journalRoot = path.join(home,"journals");
  await fsp.mkdir(game); t.after(() => fsp.rm(home,{recursive:true,force:true}));
  const realGame = await fsp.realpath(game), marker = path.join(game,"run_northstar.txt"), store = path.join(journalRoot,crypto.createHash("sha256").update(realGame.toLowerCase()).digest("hex").slice(0,24));
  return {home,game,marker,journalRoot,store,journal:path.join(store,"journal.json"),manager:createCleanMarker({journalRoot})};
}
test("clean official args remove all loader, profile and Northstar network switches without dropping unrelated settings", () => {
  const input = ["-novid","-northstar","-VANILLA","-norestrictservercommands","-noallocconsole","-profile=R2Titanfall","-profile","R2Old","-northstardll=C:/northstar.dll","-northstardll","D:/another.dll","+ns_masterserver_hostname=https://northstar.tf","+ns_has_agreed_to_send_token","1","+ns_arbitrary","-windowed","-w","1920","+fps_max","144"];
  const before = [...input];
  assert.deepEqual(argumentsFor(input),["-novid","-windowed","-w","1920","+fps_max","144"]);
  assert.deepEqual(input,before);
});
test("official Mod args have exactly the captured profile and mandatory flags", () => {
  const output = argumentsFor(["-northstar","-vanilla","-profile=old","+ns_masterserver_hostname","https://cn.invalid","-novid"],{mods:true,profile:"Custom Profile/Official"});
  assert.deepEqual(output,["-novid","-northstar","-vanilla","-profile=Custom Profile/Official"]);
  assert.deepEqual(argumentsFor([],{mods:true}),["-northstar","-vanilla","-profile=R2Titanfall"]);
});
test("invalid or escaping official Mod profile paths fail rather than enabling an unexpected profile", () => {
  for (const profile of ["",".","..","../other","safe/../other","/absolute","double//segment","trailing/","bad\nprofile",'bad"quote']) {
    assert.throws(() => argumentsFor([],{mods:true,profile}),{code:"OFFICIAL_MOD_NOT_READY"},profile);
  }
  if (process.platform === "win32") for (const profile of ["C:\\outside","\\\\host\\share"]) assert.throws(() => argumentsFor([],{mods:true,profile}),{code:"OFFICIAL_MOD_NOT_READY"});
});
test("bare process or main menu never proves official Mod support", () => {
  const probe = new OfficialReadiness();
  assert.equal(probe.consume("Launching the game\nMainMenuPanel\n").ready,false);
  assert.equal(probe.consume(CORE.map(name => loaded(name,false)).join("")).ready,false);
  assert.equal(probe.consume(loaded("VanillaPlus")).ready,true);
});

test("the actual VanillaPlus post-UIInit version callback proves its menu without depending on Northstar menu logging", () => {
  const probe=new OfficialReadiness();
  assert.equal(probe.consume(CORE.map(name=>loaded(name,false)).join("")+loaded("VanillaPlus")+'Running custom UI script callback "VanillaPlusUI_Init"\n').ready,false);
  assert.equal(probe.consume('Running custom UI script callback "VP_SetVersionLabel"\n').ready,true);
});
test("official readiness handles arbitrary UTF8 and line chunks without prematurely accepting an incomplete record", () => {
  for (const width of [1,2,7,31]) {
    const probe = new OfficialReadiness(), bytes = Buffer.from("中文名称 繁體中文\r\n" + readyLog.replace(/\n/g,"\r\n"));
    for (let cursor = 0; cursor < bytes.length; cursor += width) probe.consume(bytes.subarray(cursor,cursor+width));
    assert.equal(probe.state.ready,true); assert.equal(probe.state.error,null);
    assert.deepEqual(probe.state.core,Object.fromEntries(CORE.map(name => [name,false])));
  }
  const partial = new OfficialReadiness(); assert.equal(partial.consume(loaded("VanillaPlus")+"MainMenuPanel").ready,false);
  assert.equal(partial.consume("\n").ready,true);
});
test("a disabled VanillaPlus or any enabled community core permanently fails official Mod readiness", () => {
  const disabled = new OfficialReadiness();
  assert.equal(disabled.consume(loaded("VanillaPlus",false)+"MainMenuPanel\n").ready,false);
  assert.equal(disabled.state.error.code,"OFFICIAL_MOD_NOT_READY");
  assert.equal(disabled.consume(readyLog).ready,false);
  for (const name of CORE) {
    const probe = new OfficialReadiness(), result = probe.consume(readyLog+loaded(name));
    assert.equal(result.ready,false); assert.equal(result.core[name],true); assert.equal(result.error.code,"OFFICIAL_MOD_NOT_READY");
  }
});
test("compatibility, duplicate Mod and script errors invalidate an otherwise ready official runtime", () => {
  for (const line of ["VanillaPlus Error 0: Not in vanilla compatibility mode","VanillaPlus Error 1: Using -norestrictservercommands",...CORE.concat("VanillaPlus").map(name => `Mod '${name}' has several versions enabled, disabling them all.`),"SCRIPT COMPILE ERROR Undefined variable VANILLA","SCRIPT ERROR unknown function","Error compiling foo.nut"]) {
    const probe = new OfficialReadiness(); assert.equal(probe.consume(readyLog).ready,true);
    const result = probe.consume(line+"\n"); assert.equal(result.ready,false,line); assert.equal(result.error.code,"OFFICIAL_MOD_NOT_READY");
  }
});
test("clean launch marker is neutralized and restores exact original binary bytes", async t => {
  const f = await fixture(t), original = Buffer.from([0x31,0x0d,0x0a,0xff,0x00,0x80]); await fsp.writeFile(f.marker,original);
  const session = await f.manager.prepare(f.game); assert.equal(session.changed,true);
  assert.deepEqual(await fsp.readFile(f.marker),Buffer.from("0\n"));
  const journal = JSON.parse(await fsp.readFile(f.journal,"utf8")); assert.deepEqual(Buffer.from(journal.before,"base64"),original);
  assert.deepEqual(await session.restore(),{restored:true}); assert.deepEqual(await fsp.readFile(f.marker),original);
  assert.equal(fs.existsSync(f.journal),false); assert.deepEqual(await session.restore(),{restored:false});
});
test("an absent original autoload marker is removed again after clean launch", async t => {
  const f = await fixture(t), session = await f.manager.prepare(f.game);
  assert.equal(session.changed,true); assert.equal((await fsp.readFile(f.marker,"utf8")),"0\n");
  assert.equal(JSON.parse(await fsp.readFile(f.journal,"utf8")).before,null);
  assert.equal((await session.restore()).restored,true); assert.equal(fs.existsSync(f.marker),false); assert.equal(fs.existsSync(f.journal),false);
});
test("an exact neutral marker avoids redundant writes and journals", async t => {
  const f = await fixture(t); await fsp.writeFile(f.marker,"0\n"); const before = await fsp.stat(f.marker);
  const session = await f.manager.prepare(f.game); assert.equal(session.changed,false); assert.equal(fs.existsSync(f.journal),false);
  assert.equal((await fsp.stat(f.marker)).mtimeMs,before.mtimeMs); assert.deepEqual(await session.restore(),{restored:false});
});
test("a fresh process recovers interrupted marker ownership before another launch", async t => {
  const f = await fixture(t), original = Buffer.from("1\r\n# user preference\r\n"); await fsp.writeFile(f.marker,original);
  await f.manager.prepare(f.game); const fresh = createCleanMarker({journalRoot:f.journalRoot});
  assert.equal((await fresh.recover(f.game)).restored,true); assert.deepEqual(await fsp.readFile(f.marker),original);
  await f.manager.prepare(f.game); const again = await fresh.prepare(f.game);
  assert.equal(again.changed,true); assert.equal(JSON.parse(await fsp.readFile(f.journal,"utf8")).before,original.toString("base64"));
  await again.restore(); assert.deepEqual(await fsp.readFile(f.marker),original);
});
test("restoration is idempotent if the original marker was already restored outside the launcher", async t => {
  const f = await fixture(t), original = Buffer.from("1\n"); await fsp.writeFile(f.marker,original);
  const session = await f.manager.prepare(f.game); await fsp.writeFile(f.marker,original);
  assert.deepEqual(await session.restore(),{restored:true}); assert.equal(fs.existsSync(f.journal),false); assert.deepEqual(await fsp.readFile(f.marker),original);
});
test("recovery conflicts preserve third-party marker edits and the journal for inspection", async t => {
  const f = await fixture(t); await fsp.writeFile(f.marker,"1\n"); const session = await f.manager.prepare(f.game);
  const journal = await fsp.readFile(f.journal), thirdParty = Buffer.from("1\n# updated by user"); await fsp.writeFile(f.marker,thirdParty);
  await assert.rejects(session.restore(),{code:"OFFICIAL_MOD_NOT_READY"});
  await assert.rejects(f.manager.prepare(f.game),{code:"OFFICIAL_MOD_NOT_READY"});
  assert.deepEqual(await fsp.readFile(f.marker),thirdParty); assert.deepEqual(await fsp.readFile(f.journal),journal);
});
test("async game-running guards stop clean marker writes and recovery", async t => {
  const f = await fixture(t), original = Buffer.from("1\n"); await fsp.writeFile(f.marker,original);
  const blocked = async () => {await Promise.resolve(); throw Object.assign(Error("game running"),{code:"GAME_RUNNING"});};
  await assert.rejects(f.manager.prepare(f.game,{guard:blocked}),{code:"GAME_RUNNING"}); assert.deepEqual(await fsp.readFile(f.marker),original); assert.equal(fs.existsSync(f.journal),false);
  await f.manager.prepare(f.game); const journal = await fsp.readFile(f.journal);
  await assert.rejects(f.manager.recover(f.game,{guard:blocked}),{code:"GAME_RUNNING"});
  assert.equal(await fsp.readFile(f.marker,"utf8"),"0\n"); assert.deepEqual(await fsp.readFile(f.journal),journal);
});
test("a guard failing immediately before marker commit leaves original bytes and no active journal", async t => {
  const f = await fixture(t), original = Buffer.from("1\n"); await fsp.writeFile(f.marker,original); let calls = 0;
  await assert.rejects(f.manager.prepare(f.game,{guard:async () => {await Promise.resolve();if (++calls === 4) throw Object.assign(Error("game appeared"),{code:"GAME_RUNNING"});}}),{code:"GAME_RUNNING"});
  assert.equal(calls,4); assert.deepEqual(await fsp.readFile(f.marker),original); assert.equal(fs.existsSync(f.journal),false);
});
test("late changes to marker bytes are never overwritten at clean commit", async t => {
  const f = await fixture(t); await fsp.writeFile(f.marker,"1\n"); let calls = 0;
  await assert.rejects(f.manager.prepare(f.game,{guard:async () => {if (++calls === 4) await fsp.writeFile(f.marker,"user changed it\n");}}));
  assert.equal(await fsp.readFile(f.marker,"utf8"),"user changed it\n"); assert.equal(fs.existsSync(f.journal),true);
});
test("foreign and malformed journal records cannot overwrite the marker", async t => {
  const f = await fixture(t); await fsp.mkdir(f.store,{recursive:true}); await fsp.writeFile(f.marker,"1\n");
  for (const bytes of [Buffer.from("invalid JSON"),Buffer.from(JSON.stringify({schemaVersion:1,root:"other",marker:f.marker,before:null,after:"MAo="}))]) {
    await fsp.writeFile(f.journal,bytes); await assert.rejects(f.manager.prepare(f.game),{code:"OFFICIAL_MOD_NOT_READY"});
    assert.equal(await fsp.readFile(f.marker,"utf8"),"1\n"); assert.deepEqual(await fsp.readFile(f.journal),bytes);
  }
});
test("journal source bytes must be canonical base64 before recovery restores them", async t => {
  const f = await fixture(t); await f.manager.prepare(f.game);
  const value = JSON.parse(await fsp.readFile(f.journal,"utf8")); value.before = "%%%%";
  const journal = Buffer.from(JSON.stringify(value)); await fsp.writeFile(f.journal,journal);
  await assert.rejects(f.manager.recover(f.game),{code:"OFFICIAL_MOD_NOT_READY"});
  assert.equal(await fsp.readFile(f.marker,"utf8"),"0\n"); assert.deepEqual(await fsp.readFile(f.journal),journal);
});
test("marker and journal symlinks cannot redirect clean-mode writes", async t => {
  const f = await fixture(t), outside = path.join(f.home,"outside.txt"); await fsp.writeFile(outside,"1 external");
  await fsp.symlink(outside,f.marker,"file");
  await assert.rejects(f.manager.prepare(f.game)); assert.equal(await fsp.readFile(outside,"utf8"),"1 external"); await fsp.unlink(f.marker);
  await fsp.mkdir(f.store,{recursive:true}); await fsp.symlink(outside,f.journal,"file");
  await assert.rejects(f.manager.prepare(f.game)); assert.equal(await fsp.readFile(outside,"utf8"),"1 external"); assert.equal(fs.existsSync(f.marker),false);
});
