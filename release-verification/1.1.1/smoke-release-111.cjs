const fs = require('fs');
const path = require('path');
(async () => {
  const port = process.argv[2] || '19294';
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = pages.find(p => p.title === 'TFX Launcher');
  if (!target) throw Error('Packaged launcher page not found');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {ws.onopen = resolve; ws.onerror = reject;});
  let sequence = 0;
  const pending = new Map();
  ws.onmessage = event => {const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}}};
  const call = (method, params={}) => new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate = async expression => {const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const pause = () => new Promise(resolve => setTimeout(resolve, 650));
  const result = {url:target.url,checks:[],languages:[]};
  const check = (name, pass) => result.checks.push({name,pass:Boolean(pass)});
  check('visible version is 1.1.1', await evaluate(`document.querySelector('#launcherEditionVersion').textContent.includes('1.1.1')`));
  check('platform entry is absent', await evaluate(`!document.getElementById('platformSwitch')`));
  await evaluate(`localStorage.setItem('tfx-platform','tf1');Fold.navigate('home')`);
  await pause();
  for (const view of ['home','mods','servers','skins']) {
    await evaluate(`Fold.navigate('${view}')`); await pause();
    check(`${view} has no hidden game content exposed`, await evaluate(`['r1deltaPage','r1deltaModsPage','r1deltaServersPage','r1deltaInstallPage'].every(id=>{const e=document.getElementById(id);return e.hidden&&e.inert&&e.getBoundingClientRect().height===0})`));
  }
  await evaluate(`Fold.navigate('r1delta')`);
  check('direct hidden route is unavailable', await evaluate(`Fold.view==='skins' && typeof window.R1Delta==='undefined'`));
  for (const locale of ['zh-CN','zh-TW','en-US','de-DE','fr-FR']) {
    await evaluate(`I18n.preview('${locale}')`); await pause();
    const state = await evaluate(`({locale:I18n.current,play:I18n.text('启动游戏'),folder:I18n.text('更改目录'),nav:document.getElementById('foldPageTitle').textContent})`);
    result.languages.push(state);
    check(`${locale} language applies`, state.locale === locale && state.play && state.folder);
  }
  await evaluate(`I18n.preview('en-US');Fold.navigate('skins');Fold.setSkinFormat('icepick')`);await pause();
  check('four format tabs including Icepick', await evaluate(`[...document.querySelectorAll('[data-skin-format]')].map(e=>e.dataset.skinFormat).join(',')==='dds,vtf,mod,icepick'`));
  check('Icepick panel visible', await evaluate(`document.getElementById('skinIcepickWorkspace').getBoundingClientRect().height>0`));
  check('standalone Icepick entry absent', await evaluate(`!document.getElementById('icepickPage')&&!document.querySelector('[data-view="icepick"]')`));
  await evaluate(`Fold.setMode('vanilla')`); await pause();
  check('vanilla launch page visible', await evaluate(`document.getElementById('playTfBtn').getBoundingClientRect().height>0 && document.querySelector('#tfContent .fold-home').getBoundingClientRect().height>0`));
  await evaluate(`Fold.setMode('northstar')`); await pause();
  check('Northstar launch page visible after return', await evaluate(`document.getElementById('playNsBtn').getBoundingClientRect().height>0`));
  check('directory selection controls visible', await evaluate(`[...document.querySelectorAll('[onclick="set_home_gamepath()"]')].some(e=>e.getBoundingClientRect().height>0)`));
  const shot = await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,`release-111-home-${port}.png`),Buffer.from(shot.data,'base64'));
  await evaluate(`I18n.preview('zh-CN');Fold.navigate('skins');Fold.setSkinFormat('icepick')`); await pause();
  const modShot=await call('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(__dirname,`release-111-mods-${port}.png`),Buffer.from(modShot.data,'base64'));
  result.failures=result.checks.filter(c=>!c.pass).length;
  fs.writeFileSync(path.join(__dirname,`release-111-smoke-${port}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  ws.close();
  if(result.failures)process.exitCode=1;
})().catch(error=>{console.error(error);process.exit(1);});
