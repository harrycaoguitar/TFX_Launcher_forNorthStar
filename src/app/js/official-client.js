/* Explicit official-game Mod mode. Installation and launch remain separate actions. */
(() => {
  'use strict';
  const playButton = document.getElementById('playTfBtn');
  const detail = document.getElementById('officialClientState');
  const progressPanel = document.getElementById('officialClientProgress');
  if (!playButton || !detail || !progressPanel) return;
  const choices = [...document.querySelectorAll('[data-vanilla-mods]')];
  const locks = new Map();
  let status = null, request = null, requestContext = '', queued = null;
  let generation = 0, installing = false, changing = false, externalUpdate = false, progress = null;
  let lastStart = null;
  let pendingStart = null;
  const context = () => JSON.stringify([settings.gamepath || '',settings.globalGamepath || '',settings.chinaInstallTarget || '',settings.nsargs || '']);
  let observedContext = context();
  function synchronizeContext() {
    const nextContext = context();
    if (nextContext === observedContext) return false;
    observedContext = nextContext; status = null; generation++; pendingStart = null; lastStart = null;
    return true;
  }
  const enabled = () => settings.vanillaModsEnabled === true;
  const running = () => window.VyraLaunchAvailability?.rootOccupied(window.VyraGameProcesses?.snapshot, settings, 'vanilla') === true;
  const modeAvailable = mode => window.VyraLaunchAvailability?.canLaunch(window.VyraGameProcesses?.snapshot, settings, mode, settings.northstarRegion) === true;
  const launching = () => typeof launchPending !== 'undefined' && launchPending;
  const blocked = () => installing || changing || launching() || window.Settings?.saving || window.VyraClient?.busy || externalUpdate;
  const t = (key, parameters) => I18n.t('official.' + key, parameters);
  const damaged = value => value?.installState === 'damaged' || ['damaged','needs-repair'].includes(value?.state);
  const runtimeAction = value => value?.runtimeState === 'cn' ? 'replaceRuntime' : value?.runtimeState === 'missing' ? 'installRuntime' : ['damaged','outdated'].includes(value?.runtimeState) ? 'repairRuntime' : null;
  function startWhenReady(startGame, expectedContext) {
    const region = settings.northstarRegion === 'global' ? 'global' : 'cn';
    const snapshot = window.VyraGameProcesses?.snapshot;
    const snapshotAllowsStart = snapshot?.ok ? window.VyraLaunchAvailability?.canLaunch(snapshot, settings, 'vanilla', region) === true : true;
    if (typeof startGame !== 'function' || !enabled() || context() !== expectedContext || !gameDirectoryReady || running() || !snapshotAllowsStart) return false;
    lastStart = {startGame, context: expectedContext};
    startGame();
    return true;
  }
  function continuePendingStart() {
    const pending = pendingStart;
    if (!pending || request || context() !== pending.context) return;
    pendingStart = null;
    if (status?.error || (status?.installed !== true && status?.installed !== false)) return;
    activate(pending.startGame);
  }
  const phaseKeys = {checking:'checking',preparing:'preparing',installing:'installing',verifying:'verifying'};
  const errorText = value => window.OfficialErrors?.text(value) || I18n.text(String(value?.error || value?.message || value || t('statusFailed')));
  function dismissNotice() {
    for (const notice of document.querySelectorAll('[data-toast-key="official-client-install"]')) dismissToast(notice.id);
  }
  function renderProgress() {
    progressPanel.hidden = !installing;
    if (!installing) return;
    const percent = typeof progress?.percent === 'number' && Number.isFinite(progress.percent) ? Math.min(100, Math.max(0, progress.percent)) : null;
    document.getElementById('officialClientProgressLabel').textContent = t(phaseKeys[progress?.phase] || 'installing');
    document.getElementById('officialClientProgressValue').textContent = percent === null ? '' : Math.round(percent) + '%';
    const track = progressPanel.querySelector('[role="progressbar"]');
    track.setAttribute('aria-valuemin','0'); track.setAttribute('aria-valuemax','100');
    if (percent === null) track.removeAttribute('aria-valuenow'); else track.setAttribute('aria-valuenow',String(Math.round(percent)));
    progressPanel.classList.toggle('indeterminate',percent === null);
    document.getElementById('officialClientProgressBar').style.width = percent === null ? '35%' : percent + '%';
  }
  function renderAction() {
    const installingChinaRoot = !gameDirectoryReady && Boolean(settings.chinaInstallTarget);
    const canInstallChinaRoot = installingChinaRoot && window.VyraLaunchAvailability?.canInstall(window.VyraGameProcesses?.snapshot, settings, 'vanilla', 'cn') === true;
    for (const button of document.querySelectorAll('[data-launch-region],[data-server-region],[data-mode],[data-vanilla-mods],.disable-when-installing,.playBtn')) {
      if (installing) {
        if (!locks.has(button)) locks.set(button,button.disabled);
        button.disabled = true;
      } else if (locks.has(button)) {
        button.disabled = locks.get(button); locks.delete(button);
      }
    }
    for (const button of choices) {
      const chosen = (button.dataset.vanillaMods === 'true') === enabled();
      button.classList.toggle('selected',chosen); button.setAttribute('aria-pressed',String(chosen));
      button.disabled = Boolean(blocked()) || running();
    }
    for (const button of document.querySelectorAll('[data-mode]')) button.disabled = !window.VyraLaunchAvailability.controlAvailability({blocked: blocked(), canLaunch: modeAvailable(button.dataset.mode === 'vanilla' ? 'vanilla' : 'northstar')}).canSelect;
    if (launching()) { playButton.disabled = true; return; }
    playButton.setAttribute('aria-busy',String(installing || changing || Boolean(enabled() && request)));
    playButton.disabled = installingChinaRoot
      ? Boolean(blocked() || running() || !canInstallChinaRoot)
      : !window.VyraLaunchAvailability.controlAvailability({blocked: Boolean(blocked() || running() || !gameDirectoryReady || (enabled() && request)), canLaunch: modeAvailable('vanilla')}).canStart;
    if (running()) { playButton.textContent = lang('general.running'); return; }
    if (installing) playButton.textContent = t('installing');
    else if (changing) playButton.textContent = t('saving');
    else if (installingChinaRoot) playButton.textContent = I18n.current === 'zh-CN' ? '安装国服' : 'Install China game';
    else if (!enabled()) playButton.textContent = lang('gui.launch');
    else if (request) playButton.textContent = t('checking');
    else if (runtimeAction(status)) playButton.textContent = t(runtimeAction(status));
    else if (damaged(status)) playButton.textContent = t('repair');
    else if (status?.installed === false) playButton.textContent = t('install');
    else if (status?.installed === true && !status.error) playButton.textContent = lang('gui.launch');
    else playButton.textContent = t('retry');
    playButton.dataset.clientAction = installingChinaRoot ? 'install-root' : !enabled() ? 'launch' : installing ? 'installing' : request ? 'checking' : damaged(status) ? 'repair' : status?.installed === false ? 'install' : status?.installed && !status.error ? 'launch' : 'retry-status';
  }
  function render() {
    detail.hidden = installing;
    detail.classList.toggle('failed',enabled() && Boolean(status?.error || damaged(status)));
    if (!enabled()) detail.textContent = t('cleanHint');
    else if (installing) detail.textContent = t(phaseKeys[progress?.phase] || 'installing');
    else if (changing) detail.textContent = t('saving');
    else if (request) detail.textContent = t('checking');
    else if (status?.error) detail.textContent = errorText(status);
    else if (damaged(status)) detail.textContent = t('damaged');
    else if (status?.installed === false) detail.textContent = t('missing');
    else if (status?.installed === true) detail.textContent = status.version && status.version !== 'unknown' ? t('ready',{version:String(status.version).replace(/^v(?=\d)/u,'')}) : t('installed');
    else detail.textContent = t('statusFailed');
    detail.title = status?.error && enabled() ? I18n.text(status.error) : detail.textContent;
    detail.dataset.clientState = !enabled() ? 'clean' : installing ? 'installing' : request ? 'checking' : status?.error ? 'failed' : status?.state || (status?.installed ? 'installed' : 'unknown');
    renderProgress(); renderAction();
  }
  async function refresh(force = false) {
    synchronizeContext();
    if (!enabled() || !gameDirectoryReady) { render(); return null; }
    if (request) {
      if (!force && requestContext === context()) return request;
      if (queued) return queued;
      generation++;
      queued = request.then(() => refresh()).finally(() => { queued = null; });
      return queued;
    }
    const capturedContext = context(), revision = ++generation;
    requestContext = capturedContext;
    const pending = Promise.resolve().then(() => ipcRenderer.invoke('vanilla-client-status'))
      .then(value => {
        if (!value || typeof value.installed !== 'boolean') throw Object.assign(Error(value?.error || t('statusFailed')),{code:value?.code});
        if (generation === revision && context() === capturedContext) status = {...value};
        return value;
      }).catch(error => {
        if (generation === revision && context() === capturedContext) status = {...status,error:error.message,code:error.code};
        return null;
      }).finally(() => { if (request === pending) request = null; render(); continuePendingStart(); });
    request = pending; render(); return pending;
  }
  async function choose(value) {
    if (blocked() || running() || typeof value !== 'boolean' || value === enabled()) return;
    changing = true; dismissNotice(); render();
    try {
      const result = await Settings.savePatch({vanillaModsEnabled:value,modProfileServer:'official'});
      if (!result?.ok || result.settings?.vanillaModsEnabled !== value) {
        const reason = Settings.modStateError(result?.code,'official.saveFailed');
        new Toast({key:'official-mode-change',scheme:'error',title:t('saveFailed'),description:I18n.t(reason),timeout:7000});
        return;
      }
      window.dispatchEvent(new CustomEvent('tfx-official-mode-changed',{detail:{enabled:value}}));
    } finally { changing = false; render(); if (enabled()) void refresh(true); }
  }
  async function install(repair = false, startGame = null, expectedContext = context()) {
    if (blocked() || running() || !enabled() || !gameDirectoryReady) return;
    const capturedContext = expectedContext;
    if (capturedContext !== context()) return;
    installing = true; progress = {phase:'checking'}; dismissNotice(); render();
    try {
      const result = await ipcRenderer.invoke('vanilla-client-install',repair ? {repair:true} : {});
      if (result?.canceled) {if (capturedContext === context() && result.status) status = {...result.status}; return;}
      if (!result?.ok || capturedContext !== context()) throw Object.assign(Error(result?.error || t('installFailed')),{code:result?.code});
      if (result.status) status = {...result.status};
      const fresh = await refresh(true);
      if (!fresh?.installed || fresh.error || damaged(fresh)) throw Object.assign(Error(fresh?.error || t('statusFailed')),{code:fresh?.code});
      startWhenReady(startGame, capturedContext);
      new Toast({key:'official-client-install',scheme:'success',title:t('complete'),description:t('completeHint'),timeout:4500});
    } catch (error) {
      if (capturedContext === context()) status = {...status,error:error.message,code:error.code};
      new Toast({key:'official-client-install',scheme:'error',title:t('installFailed'),description:errorText(error),timeout:9000});
    } finally { installing = false; progress = null; render(); window.VyraClient?.renderAction(); }
  }
  function activate(startGame) {
    if (blocked() || running()) return;
    if (!gameDirectoryReady) {
      if (settings.chinaInstallTarget && window.VyraClient?.installChinaRoot) void window.VyraClient.installChinaRoot(() => activate(startGame));
      else setpath();
      return;
    }
    if (!enabled()) { startGame(); return; }
    if (request) { pendingStart = {startGame, context: context()}; return; }
    if (damaged(status)) void install(true, startGame, context());
    else if (status?.installed === false) void install(false, startGame, context());
    else if (status?.installed === true && !status.error) startWhenReady(startGame, context());
    else { pendingStart = {startGame, context: context()}; void refresh(true); }
  }
  for (const choice of choices) choice.addEventListener('click',() => choose(choice.dataset.vanillaMods === 'true'));
  ipcRenderer.on('vanilla-client-progress',(_event,value) => {
    if (!installing || !value || ![...Object.keys(phaseKeys),'done','failed'].includes(value.phase)) return;
    progress = {...value}; render();
  });
  ipcRenderer.on('changed-settings',(_event,value) => {
    if (!value || !['vanillaModsEnabled','gamepath','globalGamepath','chinaInstallTarget','nsargs'].some(key => Object.prototype.hasOwnProperty.call(value,key))) return;
    synchronizeContext();
    render(); if (!changing && !installing) void refresh(true);
  });
  for (const channel of ['newpath','gamepath-status']) ipcRenderer.on(channel,() => {
    synchronizeContext();
    render(); if (!installing) void refresh();
  });
  ipcRenderer.on('set-buttons',(_event,value) => { externalUpdate = !value; renderAction(); });
  ipcRenderer.on('ns-update-event',(_event,value) => {
    const key = typeof value === 'string' ? value : value?.key;
    externalUpdate = !['cli.update.uptodate_short','cli.update.no_internet','cli.update.check_failed'].includes(key); renderAction();
  });
  ipcRenderer.on('launch-status',(_event,value) => {
    if (value?.state === 'confirmed') lastStart = null;
    if (value?.state === 'failed' && /^VANILLA_RUNTIME_/u.test(value.code || '')) {lastStart = null; status = null; void refresh(true); return;}
    if (value?.state !== 'failed' || value.code !== 'VANILLA_CLIENT_NOT_INSTALLED') {
      if (value?.state === 'failed') lastStart = null;
      renderAction(); return;
    }
    const retry = lastStart && lastStart.context === context() && enabled() ? lastStart : null;
    lastStart = null;
    if (retry) { status = {installed:false,state:'missing',installState:'not-installed'}; void install(false,retry.startGame,retry.context); }
    renderAction();
  });
  for (const channel of ['game-process-snapshot','is-running']) ipcRenderer.on(channel,() => renderAction());
  window.addEventListener('vyra-game-processes-changed',renderAction);
  window.addEventListener('tfx-settings-saving-changed',() => {
    renderAction();
    // Ordinary preference saves acknowledge their new arguments without an IPC
    // broadcast. Recheck the selected profile after that acknowledgement too.
    if (!window.Settings?.saving && synchronizeContext()) {
      render(); if (!changing && !installing) void refresh(true);
    }
  });
  window.addEventListener('vyra-language-changed',render);
  window.addEventListener('vyra-settings-restored',() => { status = null; generation++; render(); void refresh(true); });
  window.addEventListener('vyra-view-change',() => { render(); if (window.Fold?.mode === 'vanilla' && !installing) void refresh(); });
  playButton.setAttribute('data-i18n-ignore','');
  window.OfficialClient = Object.freeze({activate,refresh,renderAction,choose,get busy() { return installing || changing; },get state() { return {enabled:enabled(),status:status ? {...status} : null,installing,changing,loading:Boolean(request)}; }});
  render(); void refresh();
})();
