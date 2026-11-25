/* Process-confirmed launch feedback; the main process owns the launch lock. */
(() => {
  'use strict';
  let latest = null, connection = null;
  const connectionCopy = {
    'session-expired': ['登录会话已失效。请退出其他目录或设备上同时运行的北极星，再重新启动游戏。若没有重复客户端，也可重启游戏重新登录。', 'Your login session has expired. Close other Northstar clients using this account, then restart the game to sign in again.'],
    'master-unreachable': ['暂时无法连接北极星主服务器。请检查网络或代理是否可用，再在游戏中重试。这个错误不代表 EA 账号无效。', 'Cannot reach the Northstar master server. Check your connection or proxy, then retry in game. This does not mean your EA account is invalid.'],
    'auth-rejected': ['游戏账号认证未通过。请确认 Steam / EA App 已登录拥有游戏的账号，再退出游戏重新启动。', 'Game account authentication was rejected. Sign in to the account that owns the game in Steam / EA App, then restart the game.'],
    'server-timeout': ['连接这台游戏服务器超时。请换一台服务器重试；若多台服务器都无法连接，再检查网络或代理。', 'The game server connection timed out. Try another server; if several fail, check your connection or proxy.']
  };
  function connectionText() {
    const copy = connectionCopy[connection?.code];
    if (!copy) return '';
    const prefix = connection.code === 'server-timeout' && connection.authenticated ? text('主服务器认证已通过。', 'Master server authentication succeeded. ') : '';
    return prefix + text(...copy) + ' [' + connection.code + ']';
  }
  let clientPreparation = '';
  const regionLocks = new Map();
  const text = (zh,en) => I18n.current === 'zh-CN' ? zh : I18n.text(en);
  const phaseKeys = {'prepare-ea':'launch.eaStarting','wait-ea':'launch.eaWaiting','retry-ea':'launch.eaRetry'};
  function render() {
    const pending = latest?.state === 'starting';
    launchPending = pending;
    for (const button of document.querySelectorAll('[data-launch-region],[data-server-region],[data-vanilla-mods],[data-mode]')) {
      if (pending) {
        if (!regionLocks.has(button)) regionLocks.set(button, button.disabled);
        button.disabled = true;
      } else if (regionLocks.has(button)) {
        button.disabled = regionLocks.get(button);
        regionLocks.delete(button);
      }
    }
    for (const button of document.querySelectorAll('.playBtn')) {
      button.setAttribute('aria-busy', String(pending));
      if (pending) {
        button.disabled = true;
        button.textContent = text('正在启动…','Starting…');
      }
    }
    for (const status of document.querySelectorAll('.fold-launch-status')) {
      const connectionMessage = connectionText();
      status.hidden = (!latest || latest.state === 'confirmed') && !connectionMessage;
      status.classList.toggle('failed', latest?.state === 'failed' || Boolean(connectionMessage));
      status.textContent = pending ? (phaseKeys[latest?.phase] ? I18n.t(phaseKeys[latest.phase]) : clientPreparation ? I18n.text(clientPreparation) : text('正在等待游戏进程…','Waiting for the game process…')) : latest?.state === 'failed' ? window.OfficialErrors?.has(latest) ? window.OfficialErrors.text(latest) : I18n.text(latest.error || text('启动失败，请重试。','Launch failed. Try again.')) : '';
      if (!pending && latest?.state !== 'failed' && connectionMessage) status.textContent = connectionMessage;
      status.title = latest?.state === 'failed' && latest.error ? I18n.text(latest.error) : '';
    }
    window.VyraClient?.renderAction();
    window.OfficialClient?.renderAction();
  }
  function receive(result) {
    if (!result || !['starting','confirmed','failed'].includes(result.state)) return;
    latest = result;
    if (result.state === 'starting' && !result.phase) connection = null;
    if (result.state !== 'starting') clientPreparation = '';
    launchPending = result.state === 'starting';
    if (!launchPending) {
      for (const button of document.querySelectorAll('.playBtn')) {
        const version = button.id === 'playTfBtn' ? 'vanilla' : 'northstar';
        const region = settings.northstarRegion === 'global' ? 'global' : 'cn';
        const availability = window.VyraLaunchAvailability;
        const snapshot = window.VyraGameProcesses?.snapshot;
        const occupied = availability?.rootOccupied(snapshot, settings, version, region) === true;
        button.disabled = availability?.directoryReady(settings, version, region, {cn: gameDirectoryReady, global: globalGameDirectoryReady}) !== true || availability?.canLaunch(snapshot, settings, version, region) !== true;
        button.textContent = occupied ? lang('general.running') : lang('gui.launch');
      }
    }
    render();
  }
  ipcRenderer.on('northstar-connection', (_event, value) => {
    if (!value || !(value.code === 'authenticated' || Object.hasOwn(connectionCopy, value.code))) return;
    const changed = connection?.code !== value.code || connection?.authenticated !== (value.authenticated === true);
    connection = {code:value.code, authenticated:value.authenticated === true};
    render();
    if (changed && connectionCopy[value.code]) new Toast({key:'northstar-connection', timeout:12000,
      title:text('北极星联机提示', 'Northstar connection'), description:connectionText()});
  });
  ipcRenderer.on('launch-status', (_event, result) => receive(result));
  ipcRenderer.on('launch-compatibility', (_event, result) => {
    if (!result || (!result.applied?.length && !result.restored?.length)) return;
    const adjusted = Boolean(result.applied?.length);
    const names = (adjusted ? result.applied : result.restored).map(item => item.name).join(', ');
    new Toast({key:'mod-compatibility',timeout:6500,
      title: text(adjusted ? '已调整模组兼容性' : '已恢复模组原有顺序',adjusted ? 'Mod compatibility adjusted' : 'Original mod order restored'),
      description: text(adjusted ? `${names}：已调整加载顺序，避免全球服大厅崩溃。皮肤及模组开关设置保持不变。` : `${names}：已为当前客户端恢复原有加载顺序。`,adjusted ? `${names}: adjusted load order to prevent the Global lobby crash. Your skin and mod enable settings are unchanged.` : `${names}: restored the original load order for this client.`)
    });
  });
  // Legacy path and process events may update the same buttons. Pending launch
  // owns them until confirmation or a failure releases the lock.
  for (const channel of ['game-process-snapshot','is-running','gamepath-status','newpath','set-buttons','ns-update-event']) {
    ipcRenderer.on(channel, () => { if (launchPending) queueMicrotask(render); });
  }
  window.addEventListener('vyra-language-changed', render);
  window.VyraLaunch = Object.freeze({begin(gameVersion) { clientPreparation = ''; receive({state:'starting',gameVersion}); }, clientPreparation(value) { clientPreparation = typeof value === 'string' ? value : ''; render(); }, get state() { return latest ? {...latest,clientPreparation} : {state:'idle'}; }});
})();
