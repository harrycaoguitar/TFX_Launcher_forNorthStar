/* Each regional client has an explicit installation step before launching. */
(() => {
  'use strict';
  const versionLabel = document.getElementById('nsversion');
  const detailLabel = document.getElementById('northstarClientState');
  const playButton = document.getElementById('playNsBtn');
  const updateButton = document.getElementById('update');
  if (!versionLabel || !detailLabel || !playButton) return;
  const statuses = new Map();
  const requests = new Map();
  const requestContexts = new Map();
  const queuedRequests = new Map();
  const statusContexts = new Map();
  const statusTimes = new Map();
  const revisions = new Map();
  let progress = null;
  let installing = null;
  let externalUpdate = false;
  let pendingStart = null;
  const installationLocks = new Map();
  let lastStart = null;
  const region = () => settings.northstarRegion === 'global' ? 'global' : 'cn';
  const context = () => JSON.stringify([settings.gamepath || '', settings.globalGamepath || '', settings.nsargs || '']);
  let observedContext = context();
  const copy = (zh,en) => window.I18n?.current === 'zh-CN' ? zh : window.I18n?.text(en) || en;
  const name = value => value === 'global' ? (copy("全球服","Global")) : value === 'cn' ? (copy("国服","China")) : (copy("未识别的客户端","Unknown client"));
  const validRegion = value => ['cn', 'global'].includes(value);
  const validVersion = value => typeof value === 'string' && value !== 'unknown' && value.trim() !== '';
  const translatedError = value => window.I18n?.text(String(value || '')) || String(value || '');
  const damaged = status => status?.installState === 'damaged' || status?.state === 'needs-repair';
  const launchBusy = () => typeof launchPending !== 'undefined' && launchPending;
  const rootAvailable = (selected = region()) => window.VyraLaunchAvailability?.canLaunch(window.VyraGameProcesses?.snapshot, settings, 'northstar', selected) === true;
  const rootOccupied = (selected = region()) => window.VyraLaunchAvailability?.rootOccupied(window.VyraGameProcesses?.snapshot, settings, 'northstar', selected) === true;
  const directoryReady = (selected = region()) => window.VyraLaunchAvailability?.directoryReady(settings, 'northstar', selected, {cn: gameDirectoryReady, global: globalGameDirectoryReady}) === true;
  const requestDirectory = (selected = region()) => selected === 'global' ? setglobalpath() : setpath();
  const preferencesBusy = () => Boolean(window.Settings?.saving || window.OfficialClient?.busy);
  function startWhenReady(startGame, selected, expectedContext) {
    const snapshot = window.VyraGameProcesses?.snapshot;
    const snapshotAllowsStart = snapshot?.ok ? window.VyraLaunchAvailability?.canLaunch(snapshot, settings, 'northstar', selected) === true : true;
    if (typeof startGame !== 'function' || region() !== selected || context() !== expectedContext || !directoryReady(selected) || rootOccupied(selected) || !snapshotAllowsStart) return false;
    lastStart = {startGame, region: selected, context: expectedContext};
    startGame();
    return true;
  }
  function continuePendingStart(selected) {
    const pending = pendingStart;
    if (!pending || pending.region !== selected || region() !== selected || pending.context !== context() || requests.has(selected)) return;
    pendingStart = null;
    const status = statuses.get(selected);
    if (status?.error || (!damaged(status) && status?.installed !== true && status?.installed !== false)) return;
    activate(pending.startGame);
  }
  const selectionBlocked = () => Boolean(installing || launchBusy() || externalUpdate || preferencesBusy());
  const controlAvailability = (selected = region()) => window.VyraLaunchAvailability.controlAvailability({blocked: selectionBlocked(), canLaunch: rootAvailable(selected)});
  const phaseCopy = phase => ({
    copying: region() === 'global' ? copy("正在复制全球服游戏文件","Copying Global game files") : copy("正在复制国服游戏文件","Copying China game files"),
    checking: copy("正在检查客户端文件","Checking client files"),
    preparing: copy("正在准备客户端文件","Preparing client files"),
    switching: copy("正在切换客户端文件","Switching client files"),
    verifying: copy("正在校验客户端文件","Verifying client files")
  })[phase];
  function preparationText(value = progress) {
    if (!value || !phaseCopy(value.phase)) return '';
    const percent = typeof value.percent === 'number' && Number.isFinite(value.percent) ? ' · ' + Math.round(Math.min(100, Math.max(0, value.percent))) + '%' : '';
    return name(value.region) + ' · ' + phaseCopy(value.phase) + percent;
  }
  function dismissInstallNotices() {
    for (const notice of document.querySelectorAll('[data-toast-key="northstar-client-install"]')) dismissToast(notice.id);
  }
  function render() {
    const selected = region();
    const status = statuses.get(selected);
    versionLabel.textContent = name(selected) + ' · ' + (validVersion(status?.version) ? status.version.replace(/^v(?=\d)/, '') : requests.has(selected) ? (copy("读取中","Loading")) : (copy("待获取","Not cached")));
    versionLabel.dataset.clientRegion = selected;
    versionLabel.title = name(selected) + (validVersion(status?.version) ? ' · ' + status.version : '');
    const activeProgress = progress && progress.region === selected && phaseCopy(progress.phase);
    detailLabel.classList.toggle('failed', Boolean(status?.error) || damaged(status));
    if (progress?.phase === 'copying' && progress.region === selected) {
      const percent = Number.isFinite(progress.percent) ? ' · ' + Math.round(Math.min(100, Math.max(0, progress.percent))) + '%' : '';
      detailLabel.textContent = phaseCopy('copying') + percent;
    }
    else if (activeProgress) detailLabel.textContent = preparationText();
    else if (status?.error) detailLabel.textContent = translatedError(status.error);
    else if (requests.has(selected)) detailLabel.textContent = copy("正在检查对应客户端是否已安装…","Checking whether this client is installed…");
    else if (damaged(status)) detailLabel.textContent = copy("客户端文件不完整 · 需要修复","Client files are incomplete · Repair required");
    else if (status?.installed === false) detailLabel.textContent = copy("未安装 · 需要安装对应客户端","Not installed · Install the selected client");
    else if (status?.pending) detailLabel.textContent = copy("上次切换未完成 · 启动时恢复","Previous switch incomplete · Recovers on launch");
    else if (status?.active) detailLabel.textContent = copy("当前已安装对应客户端","Installed client matches your selection");
    else if (status?.installed === true) detailLabel.textContent = copy("已安装 · 启动时切换","Installed · Switches on launch");
    else detailLabel.textContent = copy("客户端状态暂时无法获取 · 请重新检查","Client status unavailable · Check again");
    detailLabel.title = detailLabel.textContent;
    detailLabel.dataset.clientState = activeProgress ? 'preparing' : status?.error ? 'failed' : requests.has(selected) ? 'checking' : status?.state || 'unknown';
    renderAction();
  }
  function installLabel(selected, repair = false) {
    const template=repair?copy('修复{client}客户端','Repair {client} client'):copy('安装{client}客户端','Install {client} client');
    return template.replaceAll('{client}',name(selected));
  }
  function renderAction() {
    const selected = region(), status = statuses.get(selected), locked = Boolean(installing);
    if (updateButton) updateButton.hidden = !status?.installed || Boolean(status.error) || damaged(status) || locked || requests.has(selected);
    for (const button of document.querySelectorAll('[data-launch-region],[data-server-region],[data-vanilla-mods],[data-mode],.disable-when-installing,.playBtn')) {
      if (locked) {
        if (!installationLocks.has(button)) installationLocks.set(button, button.disabled);
        button.disabled = true;
      } else if (installationLocks.has(button)) {
        button.disabled = installationLocks.get(button);
        installationLocks.delete(button);
      }
    }
    for (const button of document.querySelectorAll('[data-launch-region]')) button.disabled = !controlAvailability(button.dataset.launchRegion).canSelect;
    for (const button of document.querySelectorAll('[data-server-region]')) button.disabled = !controlAvailability(button.dataset.serverRegion).canSelect;
    for (const button of document.querySelectorAll('[data-vanilla-mods]')) button.disabled = !controlAvailability('cn').canSelect;
    if (launchBusy() || preferencesBusy()) { playButton.disabled = true; return; }
    if (!directoryReady(selected)) {
      playButton.setAttribute('aria-busy', 'false');
      const canInstallRoot = selected === 'global' ? globalGameDirectorySelected : Boolean(settings.chinaInstallTarget && chinaGameDirectorySelected);
      playButton.dataset.clientAction = canInstallRoot ? (locked ? 'installing-root' : 'install-root') : 'select-directory';
      playButton.textContent = canInstallRoot
        ? (locked ? (selected === 'global' ? copy('正在安装全球服游戏…','Installing Global game…') : copy('正在安装国服游戏…','Installing China game…')) : (selected === 'global' ? copy('安装全球服','Install Global game') : copy('安装国服','Install China game')))
        : copy('选择{client}目录', 'Select {client} folder').replaceAll('{client}', name(selected));
      playButton.disabled = selectionBlocked() || Boolean(canInstallRoot && window.VyraLaunchAvailability?.canInstall(window.VyraGameProcesses?.snapshot, settings, 'northstar', selected) !== true);
      return;
    }
    playButton.setAttribute('aria-busy', String(locked || requests.has(selected)));
    playButton.dataset.clientAction = locked ? 'installing' : requests.has(selected) ? 'checking' : damaged(status) ? 'repair' : status?.installed === false ? 'install' : status?.installed === true ? 'launch' : 'retry-status';
    if (locked) {
      playButton.textContent = installing.repair ? copy('正在修复…','Repairing…') : copy('正在安装…','Installing…');
      playButton.disabled = true;
    } else if (rootOccupied()) {
      playButton.textContent = copy("运行中","Running");
      playButton.disabled = true;
    } else if (requests.has(selected)) {
      playButton.textContent = copy("正在检查客户端…","Checking client…");
      playButton.disabled = true;
    } else {
      if (damaged(status)) playButton.textContent = installLabel(selected, true);
      else if (status?.installed === false) playButton.textContent = installLabel(selected);
      else if (status?.installed === true && !status?.error) playButton.textContent = copy("启动游戏","Play");
      else playButton.textContent = copy("重新检查客户端","Retry client check");
      const installAction = damaged(status) || status?.installed === false;
      const actionAvailable = installAction
        ? window.VyraLaunchAvailability?.canInstall(window.VyraGameProcesses?.snapshot, settings, 'northstar', selected) === true
        : controlAvailability(selected).canStart;
      playButton.disabled = !directoryReady(selected) || !actionAvailable;
    }
    if (externalUpdate) {
      for (const button of document.querySelectorAll('[data-launch-region],[data-server-region],[data-vanilla-mods]')) button.disabled = true;
      playButton.disabled = true;
    }
  }
  async function install(selected, repair, startGame = null, expectedContext = context()) {
    if (installing || externalUpdate || launchBusy() || rootOccupied(selected) || preferencesBusy()) return;
    dismissInstallNotices();
    installing = {region: selected, repair};
    progress = {region: selected, phase: 'checking'};
    statuses.set(selected, {...statuses.get(selected), error: undefined});
    render();
    try {
      const result = await ipcRenderer.invoke('northstar-client-install', {region: selected, ...(repair ? {repair: true} : {})});
      if (result?.status?.region === selected) statuses.set(selected, {...result.status});
      if (!result || result.region !== selected || !result.ok) throw new Error(result?.error || (copy("客户端安装失败，请重试。","Client installation failed. Try again.")));
      revisions.set(selected, (revisions.get(selected) || 0) + 1);
      // Continue only after fresh installed state has been received; a double
      // click cannot bypass the install lock or the selected-root checks.
      const fresh = await refresh(selected, true);
      if (!fresh?.installed || fresh.error || damaged(fresh)) throw new Error(fresh?.error || (copy("无法确认客户端安装结果，请重新检查。","Installed client could not be verified. Check again.")));
      const continued = startWhenReady(startGame, selected, expectedContext);
      new Toast({key: 'northstar-client-install', scheme: 'success', title: copy("客户端已安装","Client installed"), description: continued ? copy('正在启动{client}…','Starting {client}…').replaceAll('{client}',name(selected)) : copy('现在可以启动{client}。','You can now launch {client}.').replaceAll('{client}',name(selected)), timeout: 3500});
    } catch (error) {
      const message = error?.message || String(error);
      statuses.set(selected, {...statuses.get(selected), region: selected, error: message});
      revisions.set(selected, (revisions.get(selected) || 0) + 1);
      new Toast({key: 'northstar-client-install', scheme: 'error', title: copy("客户端安装失败","Client installation failed"), description: translatedError(message), timeout: 9000});
    } finally {
      installing = null;
      progress = null;
      render();
    }
  }
  async function installGlobalRootAndClient(startGame = null) {
    if (installing || externalUpdate || launchBusy() || rootOccupied('global') || preferencesBusy()) return;
    dismissInstallNotices();
    installing = {region: 'global', repair: false, root: true};
    progress = {region: 'global', phase: 'copying', percent: 0};
    render();
    try {
      const root = await ipcRenderer.invoke('global-game-root-install');
      if (!root?.ok || typeof root.root !== 'string') throw new Error(root?.error || copy('全球服游戏文件安装失败，请重试。','Global game installation failed. Try again.'));
      settings.globalGamepath = root.root;
      globalGameDirectoryReady = true;
      globalGameDirectorySelected = true;
      statuses.delete('global');
      revisions.set('global', (revisions.get('global') || 0) + 1);
      progress = {region: 'global', phase: 'checking'};
      installing = null;
      render();
      await install('global', false, startGame, context());
    } catch (error) {
      const message = error?.message || String(error);
      statuses.set('global', {...statuses.get('global'), region: 'global', error: message});
      revisions.set('global', (revisions.get('global') || 0) + 1);
      new Toast({key: 'northstar-client-install', scheme: 'error', title: copy('全球服安装失败','Global installation failed'), description: translatedError(message), timeout: 9000});
    } finally {
      installing = null;
      progress = null;
      render();
    }
  }
  async function installChinaRootAndClient(startGame = null, installClient = true) {
    if (installing || externalUpdate || launchBusy() || rootOccupied('cn') || preferencesBusy()) return;
    dismissInstallNotices();
    installing = {region: 'cn', repair: false, root: true};
    progress = {region: 'cn', phase: 'copying', percent: 0};
    render();
    try {
      const root = await ipcRenderer.invoke('china-game-root-install');
      if (!root?.ok || typeof root.root !== 'string') throw new Error(root?.error || copy('国服游戏文件安装失败，请重试。','China game installation failed. Try again.'));
      settings.gamepath = root.root;
      settings.chinaInstallTarget = '';
      gameDirectoryReady = true;
      chinaGameDirectoryReady = true;
      chinaGameDirectorySelected = true;
      statuses.delete('cn');
      revisions.set('cn', (revisions.get('cn') || 0) + 1);
      progress = {region: 'cn', phase: 'checking'};
      installing = null;
      render();
      if (installClient) await install('cn', false, startGame, context());
      else if (typeof startGame === 'function') {installing = null; progress = null; render(); startGame();}
    } catch (error) {
      const message = error?.message || String(error);
      statuses.set('cn', {...statuses.get('cn'), region: 'cn', error: message});
      revisions.set('cn', (revisions.get('cn') || 0) + 1);
      new Toast({key: 'northstar-client-install', scheme: 'error', title: copy('国服安装失败','China installation failed'), description: translatedError(message), timeout: 9000});
    } finally {
      installing = null;
      progress = null;
      render();
    }
  }
  function activate(startGame) {
    const selected = region();
    if (installing || externalUpdate || launchBusy() || rootOccupied(selected) || preferencesBusy()) return;
    if (!directoryReady(selected)) {
      if (selected === 'global' && globalGameDirectorySelected) void installGlobalRootAndClient(startGame);
      else if (selected === 'cn' && settings.chinaInstallTarget && chinaGameDirectorySelected) void installChinaRootAndClient(startGame);
      else requestDirectory(selected);
      return;
    }
    if (requests.has(selected)) { pendingStart = {startGame, region: selected, context: context()}; return; }
    const status = statuses.get(selected);
    if (damaged(status)) void install(selected, true, startGame, context());
    else if (status?.installed === false) void install(selected, false, startGame, context());
    else if (status?.installed === true && !status?.error) startWhenReady(startGame, selected, context());
    else { pendingStart = {startGame, region: selected, context: context()}; void refresh(selected, true); }
  }
  function reinstallIfNeeded() {
    const selected = region();
    if (installing || externalUpdate || launchBusy() || rootOccupied(selected) || preferencesBusy()) return true;
    if (!directoryReady(selected)) {
      if (selected === 'global' && globalGameDirectorySelected) void installGlobalRootAndClient();
      else if (selected === 'cn' && settings.chinaInstallTarget && chinaGameDirectorySelected) void installChinaRootAndClient();
      else requestDirectory(selected);
      return true;
    }
    if (requests.has(selected)) return true;
    const status = statuses.get(selected);
    if (damaged(status)) { void install(selected, true); return true; }
    if (status?.installed === false) { void install(selected, false); return true; }
    if (status?.installed !== true || status?.error) { void refresh(selected, true); return true; }
    return false;
  }
  async function refresh(selected = region(), force = false) {
    if (!validRegion(selected)) return null;
    if (requests.has(selected)) {
      if (!force && requestContexts.get(selected) === context()) return requests.get(selected);
      if (queuedRequests.has(selected)) return queuedRequests.get(selected);
      revisions.set(selected, (revisions.get(selected) || 0) + 1);
      const queued = requests.get(selected).then(() => refresh(selected)).finally(() => { if (queuedRequests.get(selected) === queued) queuedRequests.delete(selected); });
      queuedRequests.set(selected, queued);
      return queued;
    }
    const requestContext = context();
    const revision = (revisions.get(selected) || 0) + 1;
    revisions.set(selected, revision);
    const request = Promise.resolve().then(() => ipcRenderer.invoke('northstar-client-status', {region: selected}))
      .then(value => {
        if (!value || value.region !== selected) throw new Error(value?.error || (copy("客户端状态暂时无法获取，请重试。","Client status unavailable. Try again.")));
        if (revisions.get(selected) === revision && requestContext === context()) {
          statuses.set(selected, {...value});
          statusContexts.set(selected, requestContext);
          statusTimes.set(selected, Date.now());
        }
        return value;
      }).catch(error => {
        if (revisions.get(selected) === revision && requestContext === context()) statuses.set(selected, {...statuses.get(selected), region: selected, error: error.message});
        return null;
      }).finally(() => {
        if (requests.get(selected) === request) { requests.delete(selected); requestContexts.delete(selected); }
        render();
        continuePendingStart(selected);
      });
    requests.set(selected, request);
    requestContexts.set(selected, requestContext);
    render();
    return request;
  }
  function receiveVersion(versions) {
    const value = versions?.client;
    const captured = versions?.clientContext;
    const current = Boolean(value && captured && typeof captured.gamePath === 'string' && typeof captured.globalGamePath === 'string' && typeof captured.nsargs === 'string' && captured.region === region() && value.region === captured.region && JSON.stringify([captured.gamePath,captured.globalGamePath,captured.nsargs]) === context());
    // A version check may have started for a different directory/profile.
    // Never infer that identity from current settings or replace a direct
    // status request already checking the current selection.
    if (current && !requests.has(value.region)) {
      statuses.set(value.region, {...statuses.get(value.region), error: undefined, ...value});
      statusContexts.set(value.region, context());
      statusTimes.set(value.region, Date.now());
      revisions.set(value.region, (revisions.get(value.region) || 0) + 1);
    }
    // The legacy `ns` field describes files on disk. It must never stand in for
    // the selected global client when the installed files belong to China.
    render();
    // Version metadata already includes a fresh regional client check.
    // Repeating it here raced startup directory validation and scanned the
    // same installation again before the user could press Play.
    if (!current) void refresh();
  }
  function receiveProgress(value) {
    if (!value || !validRegion(value.region) || !['checking', 'preparing', 'switching', 'verifying', 'done', 'failed'].includes(value.phase)) return;
    progress = {...value};
    if (value.phase !== 'failed') {
      const status = statuses.get(value.region);
      if (status?.error) statuses.set(value.region, {...status, error: undefined});
    }
    if (value.phase === 'done') {
      const selectedStatus = statuses.get(value.region);
      const installedVersion = validVersion(value.version) ? value.version : selectedStatus?.version;
      statuses.set(value.region, {...selectedStatus, version: installedVersion, installed: true, active: true, state: 'active', installState: 'installed'});
      for (const [key, status] of statuses) {
        statuses.set(key, {...status, active: key === value.region, state: status.installed ? (key === value.region ? 'active' : 'standby') : status.state, installedRegion: value.region, installedVersion, pending: false, error: undefined});
        revisions.set(key, (revisions.get(key) || 0) + 1);
      }
      if (!installing) { window.VyraLaunch?.clientPreparation(null); void refresh(value.region, true); }
    } else if (value.phase === 'failed') {
      const error = value.message || (copy("客户端切换失败，未启动游戏。","Client switch failed. No game was launched."));
      statuses.set(value.region, {...statuses.get(value.region), region: value.region, error});
      revisions.set(value.region, (revisions.get(value.region) || 0) + 1);
      if (!installing) window.VyraLaunch?.clientPreparation(null);
    } else if (!installing) window.VyraLaunch?.clientPreparation(preparationText(value));
    render();
  }
  ipcRenderer.on('northstar-client-progress', (_event, value) => receiveProgress(value));
  ipcRenderer.on('global-game-root-progress', (_event, value) => {
    if (!installing?.root || !value || !['copying', 'done'].includes(value.phase)) return;
    progress = {region: 'global', ...value};
    render();
  });
  ipcRenderer.on('china-game-root-progress', (_event, value) => {
    if (!installing?.root || installing.region !== 'cn' || !value || !['copying', 'done'].includes(value.phase)) return;
    progress = {region: 'cn', ...value};
    render();
  });
  ipcRenderer.on('changed-settings', (_event, value) => {
    if (value && ['northstarRegion','globalGamepath','gamepath','chinaSourceGamepath','chinaInstallTarget','nsargs'].some(key => Object.prototype.hasOwnProperty.call(value,key))) { pendingStart = null; lastStart = null; dismissInstallNotices(); render(); void refresh(); }
  });
  ipcRenderer.on('launch-status', (_event, value) => {
    if (value?.state === 'confirmed') { lastStart = null; progress = null; render(); void refresh(region(), true); }
    else if (value?.state === 'failed') {
      if (value.code !== 'CLIENT_NOT_INSTALLED') lastStart = null;
      progress = null;
      if (value.code === 'CLIENT_NOT_INSTALLED') {
        const selected = region();
        statuses.set(selected, {...statuses.get(selected), installed: false, active: false, state: 'missing', installState: 'not-installed', error: undefined});
        revisions.set(selected, (revisions.get(selected) || 0) + 1);
        const retry = lastStart?.region === selected && lastStart.context === context() ? lastStart : null;
        lastStart = null;
        if (retry) void install(selected, false, retry.startGame, retry.context);
        else void refresh(selected, true);
      }
      render();
    }
  });
  for (const channel of ['newpath', 'globalpath-selected', 'globalpath-status', 'gamepath-status']) ipcRenderer.on(channel, () => {
    const nextContext = context();
    if (nextContext !== observedContext) {
      observedContext = nextContext;
      statuses.clear();
      for (const [key, value] of revisions) revisions.set(key, value + 1);
    }
    // Directory acceptance emits both newpath and gamepath-status. A client
    // check completed moments before those events is already current for the
    // same path/arguments. This short reuse applies only to UI status; launch
    // still performs the main process's current safety checks.
    if (statusContexts.get(region()) === nextContext && Date.now() - (statusTimes.get(region()) || 0) < 750) return;
    void refresh();
  });
  window.addEventListener('vyra-region-changed', () => { pendingStart = null; lastStart = null; dismissInstallNotices(); render(); void refresh(); });
  window.addEventListener('tfx-settings-saving-changed',renderAction);
  ipcRenderer.on('set-buttons', (_event, enabled) => { if (!installing) externalUpdate = !enabled; renderAction(); });
  ipcRenderer.on('ns-update-event', (_event, value) => {
    const key = typeof value === 'string' ? value : value?.key;
    if (!installing) externalUpdate = !['cli.update.uptodate_short', 'cli.update.no_internet', 'cli.update.check_failed'].includes(key);
    renderAction();
  });
  ipcRenderer.on('is-running', () => renderAction());
  window.addEventListener('vyra-game-processes-changed', renderAction);
  ipcRenderer.on('game-process-snapshot', renderAction);
  window.addEventListener('vyra-settings-restored', () => { render(); void refresh(); });
  window.addEventListener('vyra-language-changed', () => {
    dismissInstallNotices();
    render();
    if (!installing && progress && phaseCopy(progress.phase)) window.VyraLaunch?.clientPreparation(preparationText());
  });
  window.VyraClient = Object.freeze({refresh, receiveVersion, renderAction, activate, reinstallIfNeeded, installChinaRoot: startGame => installChinaRootAndClient(startGame, false), get busy() { return Boolean(installing); }, get state() { return {region: region(), status: {...statuses.get(region())}, progress: progress ? {...progress} : null, loading: requests.has(region()), installing: installing ? {...installing} : null}; }});
  versionLabel.setAttribute('data-i18n-ignore', '');
  detailLabel.setAttribute('data-i18n-ignore', '');
  playButton.setAttribute('data-i18n-ignore', '');
  render();
  void refresh();
})();
