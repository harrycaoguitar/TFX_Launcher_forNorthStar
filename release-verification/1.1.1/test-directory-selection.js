const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const archiveFs = process.versions.electron ? require('original-fs') : fs;
const archive = process.argv[2];
const logFile = process.argv[3];
const restricted = process.argv[4] !== 'normal';
const raw = archiveFs.readFileSync(archive);
const header = JSON.parse(raw.subarray(16, 16 + raw.readUInt32LE(12)));
const base = 8 + raw.readUInt32LE(4);
function source(name) {
  let entry = header;
  for (const part of name.split('/')) entry = entry.files[part];
  const offset = base + Number(entry.offset);
  return raw.subarray(offset, offset + entry.size).toString('utf8');
}
function evaluate(name, dependencies) {
  const module = {exports:{}};
  vm.runInNewContext(source(name), {
    module, exports: module.exports, process, Buffer, console,
    setInterval: () => 0,
    require: id => Object.hasOwn(dependencies,id) ? dependencies[id] : require(id),
  }, {filename: name});
  return module.exports;
}
const originalExec = cp.execFileSync;
const restrictedCp = {
  execFileSync: (file, ...args) => {
    if (restricted && path.basename(file).toLowerCase() === 'fsutil.exe') throw Object.assign(Error('Access is denied.'), {status:1});
    return originalExec(file, ...args);
  }
};
const dual = evaluate('src/modules/dual-install.js', {'child_process': restrictedCp});
const findgame = evaluate('src/modules/findgame.js', {'./keyvalues': {parse:()=>({})}, './console': console});
const logs = [];
let failures = 0;
(async () => {
  const work = fs.mkdtempSync(path.join(__dirname, 'selection-'));
  const steamRoot = process.argv[5] || path.join(work, 'SteamLibrary', 'steamapps', 'common', 'Titanfall2');
  const actualTarget = process.argv[6];
  if (!process.argv[5]) {
    fs.mkdirSync(steamRoot,{recursive:true});
    fs.writeFileSync(path.join(steamRoot, 'Titanfall2.exe'), 'harmless test fixture');
  }
  const root = path.parse(work).root;
  const rootTarget = fs.mkdtempSync(path.join(root, 'tfx-empty-selection-'));
  const nestedTarget = path.join(work, '游戏文件夹', 'Northstar empty', '嵌套空目录');
  fs.mkdirSync(nestedTarget,{recursive:true});
  const occupiedTarget = path.join(work, '已有其他内容', '空白安装目录');
  fs.mkdirSync(occupiedTarget, {recursive:true});
  fs.writeFileSync(path.join(path.dirname(occupiedTarget), '已有文件.txt'), 'leave this file unchanged');
  fs.mkdirSync(path.join(path.dirname(occupiedTarget), '其他文件夹'));
  const gameParentTarget = path.join(work, '另一个游戏目录', '空白安装目录');
  fs.mkdirSync(gameParentTarget, {recursive:true});
  fs.writeFileSync(path.join(path.dirname(gameParentTarget), 'Titanfall2.exe'), 'harmless parent fixture');
  const nonemptyTarget = path.join(work, '非空目标');
  fs.mkdirSync(nonemptyTarget);
  fs.writeFileSync(path.join(nonemptyTarget,'keep.txt'),'preserve this file');
  const completeRoot = path.join(work, '完整游戏目录');
  fs.mkdirSync(completeRoot);
  fs.writeFileSync(path.join(completeRoot,'Titanfall2.exe'),'harmless game fixture');
  for(const dir of ['Core','bin','platform','r2','vpk'])fs.mkdirSync(path.join(completeRoot,dir));
  const partialRoot = path.join(work,'部分游戏文件');
  fs.mkdirSync(partialRoot);
  fs.writeFileSync(path.join(partialRoot,'Titanfall2.exe'),'partial fixture');
  const targets = actualTarget ? [['user supplied path', actualTarget, 'actual-accept']] : [['volume-root child',rootTarget],['nested Unicode/space',nestedTarget],
    ['occupied ordinary parent',occupiedTarget],['parent contains Titanfall2.exe',gameParentTarget],
    ['nonempty target accepted',nonemptyTarget,'nonempty-accept'],['existing complete game',completeRoot,'ready'],
    ['partial game accepted for completion',partialRoot,'partial'],
    ['same CN and global directory',completeRoot,'same-region']];
  try {
    for (const region of ['cn','global']) for (const [depth, target, kind] of targets) {
      const actualSnapshot = kind==='actual-accept' ? JSON.stringify(fs.readdirSync(target).sort()) : '';
      const alerts=[], events=[];
      const conf={gamepath:steamRoot, chinaSourceGamepath:steamRoot, globalGamepath:'', chinaInstallTarget:''};
      if(kind==='same-region') {
        if(region==='cn')conf.globalGamepath=target;
        else conf.gamepath=target;
      }
      conf.save=async value=>Object.assign(conf,value);
      let dialogCalls=0;
      const window={send:(channel,value)=>events.push({channel,value}),isVisible:()=>true,show:()=>{},alert:async text=>alerts.push(text)};
      const dialog={showOpenDialog:async()=>dialogCalls++===0?{canceled:false,filePaths:[target]}:{canceled:true,filePaths:[]}};
      const gamepath=evaluate('src/modules/gamepath.js',{
        'fs-extra': fs, '../win': ()=>window, 'electron':{dialog,ipcMain:{on:()=>{}}},
        './version':{send_info:()=>{}}, './settings':()=>conf, './findgame':findgame, './dual-install':dual,
        './update':{northstar_autoupdate:()=>{}},
      });
      if(region==='cn')gamepath.setGlobal=async()=>false;
      const result=region==='cn'?await gamepath.set(window,true):await gamepath.setGlobal(window,true);
      let status;
      try {
        if(kind==='same-region') {
          assert.equal(result,false,'same CN/global directory must be rejected');
          assert.ok(alerts.length);
          logs.push('PASS '+region+' '+depth+' rejected');
          continue;
        }
        if (kind==='reject' || kind==='actual-reject') {
          assert.equal(result,false);
          assert.ok(alerts.length);
          assert.equal(conf.gamepath,steamRoot);
          assert.equal(conf.chinaInstallTarget,'');
          assert.equal(conf.globalGamepath,'');
          if(kind==='reject')assert.equal(fs.readFileSync(path.join(target,'keep.txt'),'utf8'),'preserve this file');
          if(kind==='actual-reject')assert.equal(JSON.stringify(fs.readdirSync(target).sort()),actualSnapshot);
          logs.push('PASS '+region+' '+depth+'; rejected non-empty target; config and existing content preserved');
          continue;
        }
        if (kind==='nonempty-accept' || kind==='actual-accept') {
          assert.ok(result,'selection rejected: '+alerts.join(';'));
          status=events.find(event=>event.channel===(region==='cn'?'gamepath-status':'globalpath-status')&&event.value.path.toLowerCase()===target.toLowerCase()&&event.value.installable);
          assert.ok(status,'installable status missing; alerts='+alerts.join(';'));
          assert.equal(JSON.stringify(fs.readdirSync(target).sort()), kind==='actual-accept'?actualSnapshot:JSON.stringify(['keep.txt']));
          logs.push('PASS '+region+' '+depth+'; nonempty directory accepted without changing contents');
          continue;
        }
        assert.ok(result,'selection rejected: '+alerts.join(';'));
        status=events.find(event=>event.channel===(region==='cn'?'gamepath-status':'globalpath-status')&&event.value.path.toLowerCase()===target.toLowerCase()&&(kind==='ready'?event.value.valid:event.value.installable));
        assert.ok(status,'expected status missing; alerts='+alerts.join(';'));
        if(kind!=='ready')assert.equal(status.value.valid,false,'pending installation must not enable launching');
        assert.equal(status.value.path.toLowerCase(),target.toLowerCase());
        assert.equal(region==='cn'?(kind==='ready'?conf.gamepath:conf.chinaInstallTarget):conf.globalGamepath,status.value.path);
        if(kind==='ready') {
          logs.push('PASS '+region+' '+depth+'; valid=true; selected exact existing game folder');
          continue;
        }
        if(kind==='partial') {
          assert.deepEqual(fs.readdirSync(target),['Titanfall2.exe']);
          logs.push('PASS '+region+' '+depth+'; installable=true; original file preserved');
          continue;
        }
        assert.deepEqual(fs.readdirSync(target),[], 'selection must leave destination empty');
        logs.push('PASS '+region+' '+depth+' selected exact empty folder; installable=true; target contents=[]');
      } catch(error) {
        failures++;logs.push('FAIL '+region+' '+depth+': '+error.message);
      }
    }
  } finally {
    fs.rmSync(rootTarget,{recursive:true,force:true});
    fs.rmSync(work,{recursive:true,force:true});
  }
  logs.push('RESULT failures='+failures);
  if(logFile)fs.writeFileSync(logFile,logs.join('\n')+'\n');
  console.log(logs.join('\n'));
  process.exitCode=failures?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
