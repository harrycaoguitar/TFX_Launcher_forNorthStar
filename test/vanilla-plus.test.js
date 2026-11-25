"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), fsp = fs.promises;
const path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const {createManager,PACKAGE_ID,MOD_NAME,VERSION} = require("../src/modules/vanilla-plus");
const bundleRoot = path.resolve(__dirname,"../src/tools/vanilla-plus");
async function fixture(t) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(),"tfx-vanilla-plus-")), profile = path.join(root,"R2Northstar");
  await fsp.mkdir(profile); t.after(() => fsp.rm(root,{recursive:true,force:true}));
  return {root,profile,manager:createManager(),destination:path.join(profile,"packages",PACKAGE_ID)};
}
test("bundled original ZIP content and integration license supplements verify and install exactly once", async t => {
  const f = await fixture(t), stages = [];
  assert.equal((await f.manager.inspect(f.profile)).state,"missing");
  const result = await f.manager.install(f.profile,{onProgress:value => stages.push(value)});
  assert.equal(result.verified,true); assert.equal(result.changed,true); assert.equal(result.version,VERSION);
  assert.equal(result.modPath,path.join(f.destination,"mods/NP.VanillaPlus"));
  for (const file of ["LICENSE","README.md","FAQ.md","FONT-NOTICES.txt","Lato-OFL.txt","NorthstarMono-OFL.txt"]) assert.ok((await fsp.readFile(path.join(f.destination,file))).length);
  const snapshot = await fsp.stat(path.join(f.destination,"mods/NP.VanillaPlus/mod.json"));
  const again = await f.manager.install(f.profile); assert.equal(again.changed,false);
  assert.equal((await fsp.stat(path.join(f.destination,"mods/NP.VanillaPlus/mod.json"))).mtimeMs,snapshot.mtimeMs);
  assert.deepEqual(stages.at(-1),{percent:100,stage:"complete"});
});
test("installation leaves enabled states, user Mods and packages intact", async t => {
  const f = await fixture(t), state = Buffer.from('{"Version":1,"Northstar.Client":{"1.31.13":true},"Example":{"1":false}}');
  await fsp.writeFile(path.join(f.profile,"enabledmods.json"),state);
  await fsp.mkdir(path.join(f.profile,"mods/User.Mod"),{recursive:true}); await fsp.writeFile(path.join(f.profile,"mods/User.Mod/mod.json"),'{"Name":"User.Mod","Version":"1"}');
  await f.manager.install(f.profile);
  assert.deepEqual(await fsp.readFile(path.join(f.profile,"enabledmods.json")),state);
  assert.equal(await fsp.readFile(path.join(f.profile,"mods/User.Mod/mod.json"),"utf8"),'{"Name":"User.Mod","Version":"1"}');
});
test("repair replaces a damaged recognized package only after preserving every original byte", async t => {
  const f = await fixture(t); await f.manager.install(f.profile);
  const file = path.join(f.destination,"mods/NP.VanillaPlus/mod.json"); await fsp.unlink(file);
  await fsp.writeFile(path.join(f.destination,"custom-note.txt"),"keep this");
  assert.equal((await f.manager.inspect(f.profile)).state,"damaged");
  const repaired = await f.manager.install(f.profile);
  assert.equal(repaired.verified,true); assert.ok(repaired.backupPath);
  assert.equal(await fsp.readFile(path.join(repaired.backupPath,"custom-note.txt"),"utf8"),"keep this");
  assert.equal(fs.existsSync(path.join(repaired.backupPath,"mods/NP.VanillaPlus/mod.json")),false);
  assert.equal(fs.existsSync(path.join(f.destination,"custom-note.txt")),false);
});
test("an existing correct upstream package can be adopted with an intact backup", async t => {
  const f = await fixture(t); await fsp.mkdir(path.dirname(f.destination)); await fsp.cp(path.join(bundleRoot,"payload"),f.destination,{recursive:true});
  await fsp.unlink(path.join(f.destination,"TFX-INTEGRATION.json"));
  const result = await f.manager.install(f.profile); assert.equal(result.verified,true); assert.ok(result.backupPath);
  assert.equal(fs.existsSync(path.join(result.backupPath,"TFX-INTEGRATION.json")),false);
});
test("foreign same-name destination is never overwritten", async t => {
  const f = await fixture(t); await fsp.mkdir(f.destination,{recursive:true}); await fsp.writeFile(path.join(f.destination,"personal.txt"),"private");
  await assert.rejects(f.manager.install(f.profile),{code:"VANILLA_PLUS_FOREIGN"});
  assert.equal(await fsp.readFile(path.join(f.destination,"personal.txt"),"utf8"),"private");
});
test("duplicate and legacy compatibility packages block installation instead of enabling two copies", async t => {
  const f = await fixture(t), folder = path.join(f.profile,"mods/SomeOtherName");
  await fsp.mkdir(folder,{recursive:true}); await fsp.writeFile(path.join(folder,"mod.json"),'// accepts legitimate commented mod definitions\n{"Name":"VanillaPlus", "Version":"2.4",}');
  const status = await f.manager.inspect(f.profile); assert.equal(status.state,"conflict"); assert.equal(status.code,"VANILLA_PLUS_DUPLICATE");
  await assert.rejects(f.manager.install(f.profile),{code:"VANILLA_PLUS_DUPLICATE"});
  await fsp.rm(folder,{recursive:true}); const legacy = path.join(f.profile,"packages/NanohmProtogen-VanillaPlus-1.0"); await fsp.mkdir(legacy,{recursive:true});
  await assert.rejects(f.manager.install(f.profile),{code:"VANILLA_PLUS_DUPLICATE"});
});
test("profile or package junctions cannot redirect installation outside the selected profile", async t => {
  const f = await fixture(t), outside = path.join(f.root,"external"), linked = path.join(f.root,"linked");
  await fsp.mkdir(outside); await fsp.symlink(outside,linked,process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(f.manager.install(linked),{code:"VANILLA_PLUS_UNSAFE"});
  await fsp.symlink(outside,path.join(f.profile,"packages"),process.platform === "win32" ? "junction" : "dir");
  assert.equal((await f.manager.inspect(f.profile)).code,"VANILLA_PLUS_UNSAFE");
  await assert.rejects(f.manager.install(f.profile),{code:"VANILLA_PLUS_UNSAFE"});
  assert.deepEqual(await fsp.readdir(outside),[]);
});
test("bundle tampering and manifest traversal fail before any profile write", async t => {
  const f = await fixture(t), bundle = path.join(f.root,"bundle"); await fsp.cp(bundleRoot,bundle,{recursive:true});
  const manager = createManager({bundleRoot:bundle}); await fsp.appendFile(path.join(bundle,"payload/README.md"),"changed");
  await assert.rejects(manager.install(f.profile),{code:"VANILLA_PLUS_BUNDLE"}); assert.deepEqual(await fsp.readdir(f.profile),[]);
  const manifest = JSON.parse(await fsp.readFile(path.join(bundle,"manifest.json"),"utf8")); manifest.files[0].path = "../escaped.txt";
  await fsp.writeFile(path.join(bundle,"manifest.json"),JSON.stringify(manifest));
  await assert.rejects(manager.install(f.profile),{code:"VANILLA_PLUS_BUNDLE"}); assert.deepEqual(await fsp.readdir(f.profile),[]);
});
test("runtime guards stop installation without committing partial content", async t => {
  const f = await fixture(t); let calls = 0;
  await assert.rejects(f.manager.install(f.profile,{guard:() => { if (++calls === 8) throw Object.assign(Error("game started"),{code:"GAME_RUNNING"}); }}),{code:"GAME_RUNNING"});
  assert.equal(fs.existsSync(f.destination),false); assert.deepEqual(await fsp.readdir(f.profile),[]);
});
test("late concurrent changes are preserved and detected before replacing a damaged package", async t => {
  const f = await fixture(t); await f.manager.install(f.profile);
  await fsp.writeFile(path.join(f.destination,"note.txt"),"before"); let changed = false;
  await assert.rejects(f.manager.install(f.profile,{onProgress:value => {if (!changed && value.percent >= 80) {changed = true; fs.writeFileSync(path.join(f.destination,"note.txt"),"newer bytes");}}}),{code:"VANILLA_PLUS_CHANGED"});
  assert.equal(await fsp.readFile(path.join(f.destination,"note.txt"),"utf8"),"newer bytes");
});
test("the package contains the expected Mod identity and exact original font hashes", async () => {
  const raw = await fsp.readFile(path.join(bundleRoot,"payload/mods/NP.VanillaPlus/mod.json"),"utf8");
  assert.match(raw,new RegExp('"Name"\\s*:\\s*"'+MOD_NAME+'"'));
  const manifest = JSON.parse(await fsp.readFile(path.join(bundleRoot,"manifest.json"),"utf8"));
  for (const font of ["Lato-Regular.ttf","NorthstarMono.ttf"]) {
    const file = "mods/NP.VanillaPlus/mod/resource/"+font, bytes = await fsp.readFile(path.join(bundleRoot,"payload",file));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),manifest.files.find(item => item.path === file).sha256);
  }
});
test("VanillaPlus UI scripts use the Global 1.31.13 mod-information APIs", async () => {
  const paths = [
    "mods/NP.VanillaPlus/mod/scripts/vscripts/ui/ns_menu_modmenu.nut",
    "mods/NP.VanillaPlus/mod/scripts/vscripts/ui/menu_set_vanillaplus_version.nut"
  ];
  const supported = new Set(["NSGetModsInformation","NSGetModInformation","NSSetModEnabled","NSReloadMods"]);
  const used = new Set();
  for (const relative of paths) {
    const source = await fsp.readFile(path.join(bundleRoot,"payload",relative),"utf8");
    for (const match of source.matchAll(/\b(NS[A-Za-z0-9_]+)\s*\(/g)) used.add(match[1]);
  }
  assert.deepEqual([...used].filter(name => !supported.has(name)).sort(),[]);
});
