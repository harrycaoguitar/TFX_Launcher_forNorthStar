const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const Module = require('node:module');
const archiveFs = process.versions.electron ? require('original-fs') : fs;

const [archive, reportFile] = process.argv.slice(2);
const records = [];
let failures = 0;
function readModule(filename) {
  const raw = archiveFs.readFileSync(filename);
  const header = JSON.parse(raw.subarray(16, 16 + raw.readUInt32LE(12)));
  const entry = header.files.src.files.modules.files['dual-install.js'];
  const offset = 8 + raw.readUInt32LE(4) + Number(entry.offset);
  const mod = new Module(path.resolve(filename) + '.dual-install.js');
  mod.filename = path.resolve(filename) + '.dual-install.js';
  mod._compile(raw.subarray(offset, offset + entry.size).toString('utf8'), mod.filename);
  return mod.exports;
}
function log(text) { records.push(text); console.log(text); }
async function check(name, fn) {
  try { await fn(); log('PASS ' + name); }
  catch (error) { failures++; log('FAIL ' + name + ': ' + (error.code || error.name) + ': ' + error.message); }
}
function sha(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

(async () => {
  const dual = readModule(archive);
  const parent = path.resolve(__dirname, 'test-data');
  fs.mkdirSync(parent, {recursive: true});
  const work = fs.mkdtempSync(path.join(parent, 'run-'));
  const cross = fs.mkdtempSync(path.join(process.env.PUBLIC, 'tfx-ntfs-'));
  const source = path.join(work, 'SteamLibrary', 'steamapps', 'common', 'Titanfall2');
  fs.mkdirSync(source, {recursive: true});
  for (const dir of ['Core', 'bin', 'platform', 'r2', 'vpk']) {
    fs.mkdirSync(path.join(source, dir), {recursive: true});
    fs.writeFileSync(path.join(source, dir, 'fixture.bin'), dir + '-payload');
  }
  fs.writeFileSync(path.join(source, 'Titanfall2.exe'), 'fixture-not-an-executable');
  try {
    log('ARCHIVE_SHA256 ' + sha(archiveFs.readFileSync(archive)));
    const elevated = cp.spawnSync(path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', '[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'], {encoding: 'utf8', windowsHide: true});
    log('ADMINISTRATOR ' + elevated.stdout.trim() + ' exit=' + elevated.status);
    const fsutil = cp.spawnSync(path.join(process.env.SystemRoot, 'System32', 'fsutil.exe'), ['fsinfo', 'volumeinfo', path.parse(source).root.slice(0,-1)], {encoding: 'utf8', windowsHide: true});
    log('FSUTIL exit=' + fsutil.status + ' stdout=' + JSON.stringify(fsutil.stdout) + ' stderr=' + JSON.stringify(fsutil.stderr));
    await check('actual NTFS volume query', () => assert.equal(dual.getVolumeFileSystem(source), 'NTFS'));
    const sameTarget = path.join(work, '任意目录 with spaces', 'nested', '国服');
    const globalTarget = path.join(cross, '嵌套目录', '全球服');
    const nonEmptyTarget = path.join(work, '已有内容的目录');
    fs.mkdirSync(nonEmptyTarget, {recursive: true});
    fs.writeFileSync(path.join(nonEmptyTarget, 'keep.txt'), 'keep this unrelated file');
    for (const target of [sameTarget, globalTarget]) fs.mkdirSync(target, {recursive: true});
    for (const [name, target] of [['same-volume nested empty directory', sameTarget], ['cross-volume nested empty directory', globalTarget]]) {
      await check(name, async () => assert.equal((await dual.inspectInstallTarget({sourceRoot: source, targetRoot: target})).installable, true));
    }
    await check('nonempty directory is installable', async () => {
      const inspected = await dual.inspectInstallTarget({sourceRoot: source, targetRoot: nonEmptyTarget});
      assert.equal(inspected.installable, true);
    });
    await check('non-NTFS directory is installable', async () => {
      const inspected = await dual.inspectInstallTarget({sourceRoot: source, targetRoot: path.join(work, '模拟非NTFS'), getFileSystem: () => 'exFAT'});
      assert.equal(inspected.installable, true);
    });
    await check('nonempty directory preserves unrelated files after install', async () => {
      const result = await dual.installChinaRoot({sourceRoot: source, targetRoot: nonEmptyTarget, getFileSystem: () => 'NTFS'});
      assert.equal(result.reused, false);
      assert.equal(fs.readFileSync(path.join(nonEmptyTarget, 'keep.txt'), 'utf8'), 'keep this unrelated file');
      assert.equal(fs.readFileSync(path.join(nonEmptyTarget, 'Titanfall2.exe'), 'utf8'), 'fixture-not-an-executable');
    });
    for (const [name, install, target, marker] of [['China', dual.installChinaRoot, sameTarget, dual.CHINA_INSTALL_MARKER], ['Global', dual.installGlobalRoot, globalTarget, dual.INSTALL_MARKER]]) {
      await check(name + ' real copy, verification and publication', async () => {
        const result = await install({sourceRoot: source, targetRoot: target});
        assert.equal(result.reused, false);
        assert.equal(JSON.parse(fs.readFileSync(path.join(target, marker), 'utf8')).totalFiles, 6);
        for (const relative of ['Titanfall2.exe', ...['Core', 'bin', 'platform', 'r2', 'vpk'].map(dir => path.join(dir, 'fixture.bin'))]) {
          assert.equal(sha(fs.readFileSync(path.join(target, relative))), sha(fs.readFileSync(path.join(source, relative))));
          assert.notEqual(fs.statSync(path.join(target, relative)).ino, fs.statSync(path.join(source, relative)).ino);
        }
        assert.equal((await dual.inspectInstallTarget({sourceRoot: source, targetRoot: target})).ready, true);
      });
    }
    const empty = path.join(work, 'empty'); fs.mkdirSync(empty);
    await check('volume detection failure does not block installation', async () => {
      assert.equal((await dual.inspectInstallTarget({sourceRoot: source, targetRoot: empty, getFileSystem: () => {throw Error('volume metadata unavailable');}})).installable, true);
    });
    await check('same physical directory remains rejected', async () => {
      await assert.rejects(dual.inspectInstallTarget({sourceRoot: source, targetRoot: source, getFileSystem: () => 'NTFS'}), {code: 'GLOBAL_TARGET_SAME_AS_SOURCE'});
    });
    await check('junction alias of same directory remains rejected', async () => {
      const alias = path.join(work,'same-source-alias');
      fs.symlinkSync(source,alias,'junction');
      await assert.rejects(dual.inspectInstallTarget({sourceRoot:source,targetRoot:alias}),{code:'GLOBAL_TARGET_SAME_AS_SOURCE'});
    });
    await check('nested target inside source installs without changing source files', async () => {
      const target = path.join(source, '北极星子目录');
      const before = sha(fs.readFileSync(path.join(source, 'Titanfall2.exe')));
      assert.equal((await dual.installGlobalRoot({sourceRoot: source, targetRoot: target})).reused, false);
      assert.equal(sha(fs.readFileSync(path.join(source, 'Titanfall2.exe'))), before);
      assert.equal(sha(fs.readFileSync(path.join(target, 'Titanfall2.exe'))), before);
    });
    await check('target may be source ancestor', async () => {
      const target = path.join(work, 'ancestor');
      const innerSource = path.join(target, 'source');
      fs.cpSync(source, innerSource, {recursive:true});
      assert.equal((await dual.installChinaRoot({sourceRoot:innerSource,targetRoot:target})).reused, false);
      assert.equal(fs.readFileSync(path.join(target,'Titanfall2.exe'),'utf8'),'fixture-not-an-executable');
      assert.equal(fs.readFileSync(path.join(innerSource,'Titanfall2.exe'),'utf8'),'fixture-not-an-executable');
    });
    await check('drive root can be selected as a target', async () => {
      assert.equal((await dual.inspectInstallTarget({sourceRoot:source,targetRoot:path.parse(source).root})).installable,true);
    });
    await check('failed merge restores replaced files and unrelated contents', async () => {
      const target = path.join(work, 'rollback-merge');
      fs.mkdirSync(path.join(target,'Core'),{recursive:true});
      fs.writeFileSync(path.join(target,'Core','fixture.bin'),'original target bytes');
      fs.writeFileSync(path.join(target,'keep.txt'),'unrelated');
      const rename = fs.promises.rename;
      fs.promises.rename = async (from,to) => {
        if(to===path.join(target,dual.CHINA_INSTALL_MARKER))throw Object.assign(Error('injected publication failure'),{code:'EACCES'});
        return rename.call(fs.promises,from,to);
      };
      try {await assert.rejects(dual.installChinaRoot({sourceRoot:source,targetRoot:target}),/injected publication failure/);}
      finally {fs.promises.rename=rename;}
      assert.deepEqual(fs.readdirSync(target).sort(),['Core','keep.txt']);
      assert.equal(fs.readFileSync(path.join(target,'Core','fixture.bin'),'utf8'),'original target bytes');
      assert.deepEqual(fs.readdirSync(path.join(target,'Core')),['fixture.bin']);
      assert.equal(fs.readFileSync(path.join(target,'keep.txt'),'utf8'),'unrelated');
    });
    // Exercise the reported failure on all hosts, even where fsutil happens to be permitted.
    const execFileSync = cp.execFileSync;
    cp.execFileSync = function(file, ...args) {
      if (path.basename(file).toLowerCase() === 'fsutil.exe') throw Object.assign(new Error('Access is denied.'), {status: 1});
      return execFileSync.call(this, file, ...args);
    };
    try {
      await check('NTFS detection with fsutil unavailable', () => assert.equal(readModule(archive).getVolumeFileSystem(source), 'NTFS'));
    } finally { cp.execFileSync = execFileSync; }
  } finally {
    fs.rmSync(work, {recursive: true, force: true});
    fs.rmSync(cross, {recursive: true, force: true});
  }
  log('RESULT failures=' + failures);
  if (reportFile) fs.writeFileSync(reportFile, records.join('\n') + '\n');
  process.exitCode = failures ? 1 : 0;
})().catch(error => { log(error.stack); if (reportFile) fs.writeFileSync(reportFile, records.join('\n') + '\n'); process.exitCode = 1; });
