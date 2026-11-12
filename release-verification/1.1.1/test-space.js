const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const archiveFs = process.versions.electron ? require('original-fs') : fs;
const [archive] = process.argv.slice(2);
const raw = archiveFs.readFileSync(archive);
const header = JSON.parse(raw.subarray(16, 16 + raw.readUInt32LE(12)));
const entry = header.files.src.files.modules.files['dual-install.js'];
const offset = 8 + raw.readUInt32LE(4) + Number(entry.offset);
const mod = new Module(path.resolve(archive) + '.space.js');
mod.filename = mod.id;
mod._compile(raw.subarray(offset, offset + entry.size).toString('utf8') + '\nmodule.exports.measurePlan = createCopyPlan;', mod.filename);
const dual = mod.exports;
let failures = 0;
async function check(name, action) {
  try { await action(); console.log('PASS ' + name); }
  catch (error) { failures++; console.log('FAIL ' + name + ': ' + (error.code || error.name) + ': ' + error.message); }
}
(async () => {
  const work = fs.mkdtempSync(path.join(__dirname, 'test-data', 'space-'));
  const source = path.join(work, 'source');
  const gameFiles = ['Titanfall2.exe', 'Core/fixture.bin', 'bin/fixture.bin', 'platform/fixture.bin',
    'r2/fixture.bin', 'r2/paks/Win64/texture.tga', 'r2/media/intro.bik', 'vpk/fixture.bin'];
  let required = 0;
  for (const relative of gameFiles) {
    const filename = path.join(source, relative);
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    fs.writeFileSync(filename, 'game-resource:' + relative);
    required += fs.statSync(filename).size;
  }
  const captures = ['r2/movie00000.tga', 'r2/Movie00001.TGA', 'r2/Screenshots/screenshot.jpg', 'r2/Screenshots/nested/screenshot.tga'];
  for (const relative of captures) {
    const filename = path.join(source, relative);
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    fs.writeFileSync(filename, Buffer.alloc(4096, 7));
  }
  try {
    await check('copy plan excludes captures, retains nested game textures/media and counts exact required bytes', async () => {
      const plan = await dual.measurePlan(source);
      assert.equal(plan.totalBytes, required);
      assert.equal(plan.totalFiles, gameFiles.length);
      assert.deepEqual(plan.entries.filter(e => e.kind === 'file').map(e => e.relative.replaceAll('\\', '/')).sort(), [...gameFiles].sort());
    });
    for (const [region, install] of [['CN', dual.installChinaRoot], ['GLOBAL', dual.installGlobalRoot]]) {
      await check(region + ' install fits game bytes without budgeting or copying captures', async () => {
        const target = path.join(work, region);
        let checkedPath;
        const result = await install({sourceRoot: source, targetRoot: target, getFileSystem: () => 'NTFS',
          getAvailableBytes: filename => {checkedPath = filename; return required;}});
        assert.equal(result.totalBytes, required);
        assert.equal(checkedPath, work);
        for (const relative of gameFiles) assert.deepEqual(fs.readFileSync(path.join(target, relative)), fs.readFileSync(path.join(source, relative)));
        for (const relative of captures) assert.equal(fs.existsSync(path.join(target, relative)), false);
        for (const relative of captures) assert.equal(fs.statSync(path.join(source, relative)).size, 4096);
      });
    }
    await check('genuinely insufficient space stops before copying and names target, required and available GiB', async () => {
      const target = path.join(work, 'low');
      let copied = false;
      await assert.rejects(dual.installGlobalRoot({sourceRoot: source, targetRoot: target, getFileSystem: () => 'NTFS',
        getAvailableBytes: () => required - 1, copyTree: async () => {copied = true;}}), cause => {
          console.log('LOW_SPACE_MESSAGE ' + cause.message);
          assert.equal(cause.code, 'GLOBAL_DISK_SPACE_LOW');
          assert.ok(cause.message.includes(target));
          assert.match(cause.message, /GiB/);
          assert.ok(cause.message.includes(String(required)));
          assert.ok(cause.message.includes(String(required - 1)));
          return true;
        });
      assert.equal(copied, false);
      assert.equal(fs.existsSync(target), false);
    });
  } finally {fs.rmSync(work, {recursive: true, force: true});}
  console.log('RESULT failures=' + failures);
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
