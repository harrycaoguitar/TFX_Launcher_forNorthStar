/* VYRA presentation and integrated DDS workspace. All game operations go through
 * the isolated preload bridge and the retained Northstar launcher engine. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  // Anchor the filter popover below its toolbar instead of over its toggle.
  document.querySelector('#browser .misc').append($('filters'));
  const legacyPage = page;
  const originalSettingsToggle = Settings.toggle;
  const titles = {
    home: ['TFX', '开始游戏'],
    servers: ['SERVER DIRECTORY', '社区服务器'],
    mods: ['MOD MANAGER', '我的模组'],
    eaEmulator: ['EA EMULATOR', 'EA 模拟器'],
    icepick: ['ICEPICK MOD', '模组安装'],
    skins: ['SKIN INSTALLER', '皮肤安装']
  };
  let currentView = 'home';
  let skinFormat = 'dds';
  let selectedMode = settings.modProfileServer === 'official' ? 'vanilla' : 'northstar';
  let changingMode = false;
  let visiblePage = null;
  let pendingPage = null;
  let returnFocus = null;
  let popupFocusSequence = 0;
  const dds = { package: null, game: {ready:false}, backups: [], protection:null, original:null, selectionRevision:0, busy: false, locallyCleared:false, error:'', log: [] };
  const pathStates = new Map();
  let ddsRefreshSequence = 0;
  let ddsRefreshRequest = null;
  const icon = name => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('fold-icon'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg','use'); use.setAttribute('href', '#i-' + name); svg.append(use); return svg;
  };
  const bytes = value => {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return '0 B';
    const units = ['B','KB','MB','GB']; let n = Number(value), i = 0;
    while (n >= 1024 && i < units.length-1) { n /= 1024; i++; }
    return n.toFixed(i ? 1 : 0) + ' ' + units[i];
  };
  const showToast = (title, error = false, description = '') => new Toast({scheme:error?'error':'success',title,description,timeout:error?9000:4500});

  function showPath(value, unavailable = false, state = null) {
    const target = typeof value === 'string' ? value.trim() : '';
    state = state || pathStates.get(normalizePath(target)) || null;
    for (const el of document.querySelectorAll('.fold-game-path')) { el.textContent = target || '尚未选择游戏目录'; el.title = target; }
    for (const el of document.querySelectorAll('.fold-path-state')) {
      el.textContent = state && state.checking ? '检查中' : unavailable ? '目录不可用' : state && state.valid ? (state.source === 'automatic' ? '已自动识别' : '已识别') : target ? '待验证' : '未配置';
      el.classList.toggle('unavailable', unavailable || !target);
    }
    $('ddsGamePath').textContent = target || '尚未选择游戏目录'; $('ddsGamePath').title = target;
  }
  const normalizePath = value => String(value || '').trim().replace(/[\\/]+/g,'/').replace(/\/+$/,'').toLowerCase();
  const selectedGameServer = () => ['cn','global','official'].includes(settings.modProfileServer) ? settings.modProfileServer : settings.northstarRegion === 'global' ? 'global' : 'cn';
  const selectedGamePath = () => selectedGameServer() === 'global' ? settings.globalGamepath || '' : settings.chinaInstallTarget || settings.gamepath || '';
  function showSelectedPath(unavailable = false) {
    const target = selectedGamePath();
    showPath(target,unavailable,pathStates.get(normalizePath(target)) || null);
  }
  function updateClock() {
    $('foldClock').textContent = new Intl.DateTimeFormat(window.I18n?.current || 'en-US',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  }
  function setNavigation(view) {
    for (const button of document.querySelectorAll('.fold-nav button[data-view],.fold-secondary-nav button[data-view]')) {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current',active?'page':'false');
    }
    const title = titles[view] || titles.home;
    $('foldPageEyebrow').textContent = title[0]; $('foldPageTitle').textContent = window.I18n?.text(title[1]) || title[1];
    document.body.dataset.foldView = view;
  }
  function setSkinFormat(format) {
    if (!['dds','vtf','mod','icepick'].includes(format)) return;
    // Keep the active installation visible until its transaction is complete.
    if (format !== skinFormat && (dds.busy || window.VTF?.state.busy || window.SkinRecovery?.busy || window.SkinImport?.state.phase==='installing')) return;
    skinFormat = format;
    for (const kind of ['dds','vtf','mod','icepick']) $(kind==='mod'?'skinModWorkspace':kind==='icepick'?'skinIcepickWorkspace':kind+'Workspace')?.classList.toggle('hidden',kind!==format);
    for (const button of document.querySelectorAll('[data-skin-format]')) {
      const active=button.dataset.skinFormat===format;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    $('skinWorkspace').dataset.format=format;
    if (format==='dds') refreshDds();else if(format==='vtf') window.VTF?.refresh();
  }
  function adoptDdsImport(value) {
    ++ddsRefreshSequence;dds.error=value?.error||'';dds.busy=false;
    dds.package=value?.package||null;dds.original=value?.original||null;dds.conflictPreview=value?.conflictPreview||null;
    dds.locallyCleared=!value?.package;
    renderDds(value);
    if(value?.package)window.SkinFeedback?.importResult('dds',value);
  }
  function navigate(view) {
    if (view!=='settings' && !Settings.canLeave(() => navigate(view))) return;
    if(view==='dds'||view==='vtf'||view==='icepick'){setSkinFormat(view);view='skins';}
    if (view === 'store') { Browser.toggle(true); return; }
    if (view === 'settings') { Settings.toggle(true); return; }
    if (!(view in titles)) return;
    popups.set_all(false);
    const requestedMode = selectedMode;
    const nextPage = view === 'home' ? (requestedMode === 'vanilla' ? $('tfContent').querySelector('.fold-home') : $('nsMain')) : $(view === 'servers' ? 'serverPage' : view === 'mods' ? 'nsMods' : view === 'eaEmulator' ? 'eaEmulatorPage' : 'skinWorkspace');
    if (view === currentView && nextPage === (pendingPage || visiblePage)) return;
    currentView = view;
    pendingPage = nextPage;
    setNavigation(view);
    window.VyraMotion.changePage(visiblePage, nextPage, () => {
      legacyPage(view === 'home' && requestedMode === 'vanilla' ? 2 : 1);
      for (const id of ['nsMain','serverPage','nsMods','nsRelease','eaEmulatorPage','skinWorkspace','ddsWorkspace','vtfWorkspace']) $(id).classList.add('hidden');
      if (view === 'home') $('nsMain').classList.remove('hidden');
      if (view === 'servers') $('serverPage').classList.remove('hidden');
      if (view === 'mods') { showNsSection('mods'); $('ddsWorkspace').classList.add('hidden'); }
      if (view === 'eaEmulator') { $('eaEmulatorPage').classList.remove('hidden'); }
      if (view === 'release') { showNsSection('release'); $('ddsWorkspace').classList.add('hidden'); }
      if (view === 'skins') { $('skinWorkspace').classList.remove('hidden');setSkinFormat(skinFormat); }
      const activeContent = view === 'home' && requestedMode === 'vanilla' ? $('tfContent') : $('nsContent');
      activeContent.scrollTop = 0;
      visiblePage = nextPage;
      pendingPage = null;
      window.dispatchEvent(new CustomEvent('vyra-view-change',{detail:{view,mode:requestedMode}}));
    });
  }
  async function setMode(mode) {
    const region = settings.northstarRegion === 'global' ? 'global' : 'cn';
    const selection = window.VyraLaunchAvailability.controlAvailability({blocked: changingMode || launchPending || window.VyraClient?.busy || window.OfficialClient?.busy, canLaunch: window.VyraLaunchAvailability.canLaunch(window.VyraGameProcesses?.snapshot, settings, mode, region)});
    if (!['northstar','vanilla'].includes(mode) || !selection.canSelect) return;
    if (!Settings.canLeave(() => setMode(mode))) return;
    const server = mode === 'vanilla' ? 'official' : settings.northstarRegion === 'global' ? 'global' : 'cn';
    if (settings.modProfileServer !== server) {
      changingMode = true;
      for (const button of document.querySelectorAll('[data-mode]')) button.disabled = true;
      try {
        const result = await Settings.savePatch({modProfileServer:server});
        if (!result?.ok || result.settings?.modProfileServer !== server) {
          const reason = Settings.modStateError(result?.code,'official.saveFailed');
          new Toast({key:'launch-mode-change',scheme:'error',title:I18n.t('official.saveFailed'),description:I18n.t(reason),timeout:7000});
          return;
        }
      } finally {
        changingMode = false;
        for (const button of document.querySelectorAll('[data-mode]')) {
          button.disabled = !window.VyraLaunchAvailability.controlAvailability({blocked: launchPending || window.VyraClient?.busy || window.OfficialClient?.busy, canLaunch: true}).canSelect;
        }
      }
    }
    selectedMode = mode;
    for (const button of document.querySelectorAll('[data-mode]')) {
      button.classList.toggle('selected',button.dataset.mode === mode);
      button.setAttribute('aria-pressed',String(button.dataset.mode === mode));
    }
    navigate('home');
  }
  function synchronizeMode() {
    const mode = settings.modProfileServer === 'official' ? 'vanilla' : 'northstar';
    selectedMode = mode;
    for (const button of document.querySelectorAll('[data-mode]')) {
      button.classList.toggle('selected',button.dataset.mode === mode);
      button.setAttribute('aria-pressed',String(button.dataset.mode === mode));
    }
    // A settings transaction can commit the mode before its controls unlock.
    // Keep the preferences open and reconcile the home when they are closed,
    // including a second sync whose selected mode is already up to date.
    if (currentView === 'home' && !Settings.saving && !$('options').classList.contains('shown')) navigate('home');
  }
  window.addEventListener('tfx-settings-persisted',synchronizeMode);
  window.addEventListener('vyra-settings-restored',synchronizeMode);
  ipcRenderer.on('changed-settings',(_event,value) => {
    if (value && Object.prototype.hasOwnProperty.call(value,'modProfileServer')) synchronizeMode();
  });
  // Original loss-of-directory handling routes into an actionable home, retaining
  // the original picker flow without exposing the removed launcher-update page.
  window.page = index => setMode(index === 2 ? 'vanilla' : 'northstar');
  Settings.toggle = state => originalSettingsToggle(state);

  function addLog(message) {
    if (!message) return;
    const stamp = new Intl.DateTimeFormat(window.I18n?.current || 'en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    dds.log.push('[' + stamp + '] ' + String(message)); if (dds.log.length > 200) dds.log.shift();
  }
  function renderDds(state) {
    if (state) {
      // A status request that started before a new import cannot revive its package.
      if (Number.isSafeInteger(state.selectionRevision) && state.selectionRevision < dds.selectionRevision) return;
      if (Number.isSafeInteger(state.selectionRevision)) dds.selectionRevision = state.selectionRevision;
      if (state.selectionError) dds.error = state.selectionError;
      if (state.game) dds.game = state.game;
      if ('package' in state && !dds.locallyCleared) dds.package = state.package;
      if (state.backups) dds.backups = state.backups;
      if ('pending' in state) dds.pending = state.pending || [];
      if ('protection' in state) dds.protection = state.protection;
      if ('original' in state && !dds.locallyCleared) dds.original = state.original;
      if ('skinRepair' in state) dds.skinRepair = state.skinRepair;
      if ('conflictPreview' in state && !dds.locallyCleared) dds.conflictPreview = state.conflictPreview;
      if ('busy' in state) dds.busy = Boolean(state.busy);
    }
    const pkg = dds.package;
    window.SkinConflictPreview?.render('dds',dds);
    $('ddsPackageInfo').hidden = !pkg;
    $('ddsSelectPackage').hidden = Boolean(pkg);
    $('ddsSummary').hidden = !pkg;
    $('ddsEmptyState').hidden = Boolean(pkg);
    $('ddsGamePath').textContent = dds.game.path || selectedGamePath() || '尚未选择游戏目录';
    $('ddsGamePath').title = $('ddsGamePath').textContent;
    const resourceUsable = Boolean(dds.game.ready || dds.game.canRepair);
    $('ddsStatus').classList.toggle('fold-dds-error',Boolean(pkg && !resourceUsable));
    if (pkg) {
      $('ddsPackageName').textContent = pkg.name;
      $('ddsPackageMeta').textContent = `${pkg.count} 个皮肤文件 · ${bytes(pkg.bytes)}`;
      $('ddsTextureCount').textContent = String(pkg.count);
      const files = pkg.files || [];
      $('ddsTargetCount').textContent = String(new Set(files.map(item => item.target)).size);
      $('ddsValidationState').textContent = dds.game.ready ? '检查通过' : dds.game.canRepair ? I18n.t('ddsResource.repairable') : '需要处理';
      $('ddsValidationState').classList.toggle('fold-dds-error',!resourceUsable);
      $('ddsStatus').textContent = dds.game.ready ? '格式与目标资源已检查，可以安装' : dds.game.canRepair ? I18n.t('ddsResource.repairHint') : I18n.text(dds.game.error || '请先选择有效的游戏目录');
      $('ddsReadyHint').textContent = dds.game.canRepair ? I18n.t('ddsResource.installHint') : dds.game.ready ? '安装前资源将自动备份。' : '处理提示后即可安装。';
      $('ddsFileList').replaceChildren();
      for (const item of files) {
        const row = document.createElement('div'); row.className = 'fold-dds-file';
        const content = document.createElement('div'); const name = document.createElement('strong'); name.textContent = item.name; name.title = item.name;
        const meta = document.createElement('small'); meta.textContent = `${item.width} × ${item.height} · ${item.format} · ${item.target}`; meta.title = meta.textContent;
        content.append(name, meta); row.append(content,icon('check')); $('ddsFileList').append(row);
      }
    } else {
      $('ddsStatus').textContent = dds.game.ready ? '导入皮肤后，在这里预览安装计划' : dds.game.error || '请先选择游戏目录，再导入皮肤';
      $('ddsReadyHint').textContent = '先导入，再检查，最后安装。';
    }
    if (dds.error) { $('ddsStatus').textContent = I18n.text(dds.error); $('ddsStatus').classList.add('fold-dds-error'); }
    const pendingRecovery = Boolean(dds.pending?.length);
    if (pendingRecovery && !dds.error) {
      $('ddsStatus').textContent = I18n.text('上次跨格式换肤尚未完成，请先在武器库中恢复。');
      $('ddsStatus').classList.add('fold-dds-error');
      $('ddsValidationState').textContent = I18n.text('需要处理');
      $('ddsReadyHint').textContent = I18n.text('处理提示后即可安装。');
    }
    const needsOriginal = pkg && window.DDSOriginal && !window.DDSOriginal.canInstall(pkg,dds.original);
    if (needsOriginal && resourceUsable && !dds.error) {
      $('ddsValidationState').textContent = I18n.t('ddsOriginal.needsSource');
      $('ddsValidationState').classList.add('fold-dds-error');
      $('ddsStatus').textContent = I18n.t('ddsOriginal.installBlocked');
      $('ddsReadyHint').textContent = I18n.t('ddsOriginal.installBlockedHint');
    }
    const recoveryAvailable = window.SkinRecovery?.canStart('dds',dds);
    $('ddsInstall').disabled = dds.busy || window.SkinRecovery?.busy || dds.skinRepair?.state==='error' || pendingRecovery || !pkg || (!recoveryAvailable && (!resourceUsable || needsOriginal)) || window.DDSOriginal?.busy || (typeof is_running !== 'undefined' && is_running);
    $('ddsInstall').querySelector('[data-skin-install-label]').textContent = (!dds.game.ready || needsOriginal || dds.skinRepair?.ready===false) && recoveryAvailable ? I18n.t('skinRecovery.autoInstall') : I18n.text('安装皮肤');
    $('ddsSelectPackage').disabled = dds.busy; $('ddsSelectFolder').disabled = dds.busy;
    $('ddsClearPackage').disabled = dds.busy;
    $('ddsWorkspace').setAttribute('aria-busy',String(dds.busy));
    window.DDSGuard?.update({package:dds.package,protection:dds.protection,busy:dds.busy});
    window.DDSOriginal?.update({...dds,busy:dds.busy||window.SkinRecovery?.busy});
    window.SkinRecovery?.update('dds',dds);
    window.SkinFeedback?.sync('dds',dds);
    window.SkinImport?.render();
  }
  function refreshDds() {
    if (dds.busy) return null;
    const requestPath = selectedGamePath();
    if (ddsRefreshRequest?.path === requestPath && ddsRefreshRequest.sequence === ddsRefreshSequence) return ddsRefreshRequest.promise;
    const sequence = ++ddsRefreshSequence;
    const promise = (async () => {
      try {
        const state = await ipcRenderer.invoke('dds-status');
        if (sequence !== ddsRefreshSequence || requestPath !== selectedGamePath()) return state;
        if (!state.ok) throw new Error(state.error || '无法读取 DDS 安装状态');
        renderDds(state); return state;
      } catch (error) { if (sequence === ddsRefreshSequence) { $('ddsStatus').textContent = error.message; $('ddsStatus').classList.add('fold-dds-error'); addLog(error.message); } return null; }
      finally { if (ddsRefreshRequest?.sequence === sequence) ddsRefreshRequest = null; }
    })();
    ddsRefreshRequest = {path:requestPath,sequence,promise};
    return promise;
  }
  function refreshVisibleDds() {
    if ((currentView === 'skins' && skinFormat === 'dds') || dds.package || dds.busy) return refreshDds();
  }
  async function ddsAction(channel, input, options = {}) {
    if (dds.busy || window.DDSOriginal?.busy || (options.select && window.SkinRecovery?.busy)) return null;
    if(options.select){
      if(channel==='dds-clear')window.SkinFeedback?.clear('dds');
      else window.SkinFeedback?.beginImport('dds',{path:input?.path,picking:channel==='dds-select'});
    }
    if(!options.select&&channel!=='dds-install')window.SkinFeedback?.clearProgress('dds');
    // Invalidate any in-flight refresh before clearing the visible selection.
    ++ddsRefreshSequence;
    dds.busy = true; dds.error = '';
    if (options.select) { dds.locallyCleared = true; dds.package = null; dds.original = null; dds.skinRepair=null; dds.conflictPreview=null; }
    renderDds();
    if(!options.select&&channel!=='dds-install'){$('ddsProgress').hidden = Boolean(options.hideProgress); $('ddsProgressValue').textContent = '0%'; $('ddsProgressBar').style.width = '0%';$('ddsProgressLabel').textContent = options.label || '正在准备…';}
    try {
      const state = await ipcRenderer.invoke(channel,input);
      if (Number.isSafeInteger(state.selectionRevision) && state.selectionRevision < dds.selectionRevision) return null;
      // Failure and cancellation responses also carry the backend selection revision.
      if (Number.isSafeInteger(state.selectionRevision)) dds.selectionRevision = Math.max(dds.selectionRevision,state.selectionRevision);
      if ('package' in state && state.package === null) { dds.package = null; dds.original = null; dds.locallyCleared = true; }
      if (state.cancelled) { if(options.select)window.SkinFeedback?.importResult('dds',state);else window.SkinFeedback?.finish('dds',state); return state; }
      if (!state.ok) throw new Error(state.error || '皮肤操作未能完成');
      if (options.select && state.package) dds.locallyCleared = false;
      renderDds(state);
      if(options.select&&channel!=='dds-clear')window.SkinFeedback?.importResult('dds',state);
      if (options.success) showToast(options.success);
      return state;
    } catch (error) {
      if(options.select&&channel!=='dds-clear')window.SkinFeedback?.importResult('dds',{ok:false,error:error.message});
      if(channel==='dds-install')window.SkinFeedback?.finish('dds',{ok:false,error:error.message});
      dds.error = error.message; $('ddsStatus').textContent = I18n.text(error.message); $('ddsStatus').classList.add('fold-dds-error'); addLog(error.message); showToast('皮肤操作未完成',true,I18n.text(error.message));
      return {ok:false,error:error.message};
    } finally {
      dds.busy = false; renderDds();
      // A failed write can publish a recovery journal. Load its restore control
      // while keeping the concrete error message on screen.
      if (dds.error && channel === 'dds-install') await refreshDds();
    }
  }
  async function selectPackage(kind = 'file') {
    const result = await ddsAction('dds-select',{kind},{select:true,label:'正在选择皮肤…'});
    if (result?.ok && !result.cancelled) { addLog(`已导入 ${result.package?.name || '皮肤'}，完成格式与资源检查。`); }
    return result;
  }
  async function inspectPackage(filePath) {
    const result = await ddsAction('dds-inspect',{path:filePath},{select:true,label:'正在检查皮肤…'});
    if (result?.ok) { addLog(`已导入 ${result.package?.name || '皮肤'}，完成格式与资源检查。`); }
    return result;
  }
  async function clearPackage(message = '') {
    const result = await ddsAction('dds-clear',undefined,{select:true,hideProgress:true});
    if (result?.ok && message) {
      dds.error = message; addLog(message); renderDds();
      showToast('皮肤操作未完成',true,I18n.text(message));
    }
    return result;
  }
  async function installTextures({skipRecovery=false}={}) {
    if(!skipRecovery&&window.SkinRecovery){if(!dds.package||dds.busy||window.SkinRecovery.busy||!window.SkinRecovery.canStart('dds',dds))return null;window.SkinFeedback?.beginInstall('dds');return window.SkinRecovery.install('dds');}
    if (!dds.package || !(dds.game.ready || dds.game.canRepair) || dds.pending?.length || dds.busy || window.DDSOriginal?.busy || (window.DDSOriginal && !window.DDSOriginal.canInstall(dds.package,dds.original))) return null;
    window.SkinFeedback?.beginInstall('dds');
    const result = await ddsAction('dds-install',{packageId:dds.package.id,selectionRevision:dds.selectionRevision},{label:dds.game.canRepair ? I18n.t('ddsResource.preparing') : '正在备份安装前资源…'});
    return finishInstallation(result);
  }
  async function finishInstallation(result) {
    window.SkinFeedback?.finish('dds',result);
    window.SkinImport?.installationResult('dds',result);
    if (result?.ok && !result.cancelled && !result.waiting && !result.confirmationRequired) {
      new Toast({scheme:'success',variant:'skin-complete',key:'skin-install-complete',title:I18n.text('皮肤安装完成'),description:I18n.t('skinImport.completeHint'),timeout:5000});
      addLog('皮肤写入与校验完成，安装前备份已保存。');
      const installed = result.result || result;
      const resetCount = Number(installed.resetCount) || 0;
      const replacedCount = Number(installed.replacedCount) || (Array.isArray(installed.supersedes) ? installed.supersedes.length : 0);
      if (resetCount || replacedCount) addLog(I18n.current === 'en-US' ? `Skin replacement cleanup: ${resetCount} old skin slots restored; ${replacedCount} earlier installation records superseded.` : `换肤清理：已恢复 ${resetCount} 处旧皮肤残留，替换 ${replacedCount} 份旧安装记录。`);
      const cleanup = installed.crossFormatReset;
      if (cleanup && (cleanup.vtfPaths || cleanup.ddsRanges)) addLog(I18n.current === 'en-US' ? `Format switch: restored ${cleanup.vtfPaths || 0} model/material paths and ${cleanup.ddsRanges || 0} DDS skin regions.` : `格式切换：已恢复 ${cleanup.vtfPaths || 0} 个模型与材质入口、${cleanup.ddsRanges || 0} 处 DDS 皮肤区域。`);
      if (result.protectionWarning) {
        addLog(result.protectionWarning);
        new Toast({scheme:'warning',title:I18n.text('皮肤安装完成，但启动保护需要处理'),description:I18n.text(result.protectionWarning),timeout:9000});
      }
      // Install IPC already returns the verified post-write state. Reusing it
      // avoids another resource/conflict/backup scan, while incomplete or stale
      // responses still take the existing guarded refresh path.
      const fresh = result.game?.path === selectedGamePath() && result.package?.id === dds.package?.id && result.selectionRevision === dds.selectionRevision && Array.isArray(result.backups) && Array.isArray(result.pending);
      if (fresh) renderDds(result); else await refreshDds();
    }
    return result;
  }
  const folderButton = document.createElement('button'); folderButton.id = 'ddsSelectFolder'; folderButton.className = 'fold-folder-import'; folderButton.textContent = '选择 DDS 文件夹';
  folderButton.addEventListener('click',() => selectPackage('folder')); $('ddsSelectPackage').after(folderButton);
  $('ddsSelectPackage').addEventListener('click',() => selectPackage());
  $('ddsInstall').addEventListener('click',installTextures);
  $('ddsClearPackage').addEventListener('click',() => window.SkinImport ? window.SkinImport.clear() : clearPackage());
  ipcRenderer.on('dds-progress',(_event,data) => {
    if (!data) return;
    const handled=window.SkinFeedback?.progress('dds',data);
    if(!handled&&dds.busy){$('ddsProgress').hidden=false;const percent=Math.max(0,Math.min(100,Number(data.percent)||0));$('ddsProgressLabel').textContent=I18n.text(data.message||'正在处理皮肤…');$('ddsProgressValue').textContent=Math.round(percent)+'%';$('ddsProgressBar').style.width=percent+'%';}
    if (data.message) addLog(data.message);
    if (data.phase === 'error') { $('ddsStatus').textContent = data.message; $('ddsStatus').classList.add('fold-dds-error'); }
  });
  // Capture the DDS drop before the legacy Northstar ZIP import listener sees it.
  document.addEventListener('dragover',event => {
    if (currentView !== 'dds' || $('browser')?.classList.contains('shown')) return;
    event.preventDefault(); event.stopImmediatePropagation(); $('dragUI').classList.remove('shown'); $('ddsSelectPackage').classList.add('dragging');
  },true);
  document.addEventListener('dragleave',event => { if (!event.relatedTarget) $('ddsSelectPackage').classList.remove('dragging'); },true);
  document.addEventListener('drop',event => {
    const file = event.dataTransfer?.files?.[0];
    if (!file || currentView === 'skins' || currentView === 'mods' || $('browser')?.classList.contains('shown') || (currentView !== 'dds' && (currentView === 'vtf' || !/\.dds$/i.test(file.name)))) return;
    event.preventDefault(); event.stopImmediatePropagation(); $('dragUI').classList.remove('shown'); $('ddsSelectPackage').classList.remove('dragging');
    if(dds.busy||window.DDSOriginal?.busy||window.SkinRecovery?.busy)return;
    navigate('dds');
    if (event.dataTransfer.files.length > 1) { clearPackage('一次只能导入一个 DDS 皮肤包。多个皮肤文件请放入同一文件夹或 ZIP 安装包，再导入。'); return; }
    inspectPackage(fold.getDroppedFilePath(file));
  },true);

  let clockTimer;
  function syncClockTimer() {
    clearInterval(clockTimer); clockTimer=undefined;
    if (!document.hidden) { updateClock();clockTimer=setInterval(updateClock,30000); }
  }
  document.addEventListener('visibilitychange',syncClockTimer);
  showSelectedPath(); syncClockTimer(); setMode(selectedMode);
  ipcRenderer.on('newpath',(_event,value) => { if (normalizePath(value) === normalizePath(selectedGamePath())) showSelectedPath(); refreshVisibleDds(); });
  ipcRenderer.on('globalpath-selected',(_event,value) => {
    if (value) pathStates.set(normalizePath(value),{path:value,valid:true,checking:false,source:'selected'});
    if (normalizePath(value) === normalizePath(selectedGamePath())) showSelectedPath();
    refreshVisibleDds();
  });
  ipcRenderer.on('changed-settings',(_event,value) => {
    if (value && ['gamepath','globalGamepath','chinaInstallTarget','northstarRegion','modProfileServer'].some(key => key in value)) { showSelectedPath(); refreshVisibleDds(); }
  });
  ipcRenderer.on('gamepath-lost',() => { if (normalizePath(settings.gamepath) === normalizePath(selectedGamePath())) showSelectedPath(true); refreshVisibleDds(); });
  ipcRenderer.on('gamepath-status',(_event,state) => {
    if (!state) return;
    pathStates.set(normalizePath(state.path),state);
    if (normalizePath(state.path) === normalizePath(selectedGamePath())) showSelectedPath(Boolean(state.path)&&!state.valid&&!state.checking);
    refreshVisibleDds();
  });
  ipcRenderer.on('gamepath-error',(_event,message) => showToast('游戏目录不可用',true,message));
  ipcRenderer.on('is-running',() => renderDds());
  window.addEventListener('vyra-language-changed',() => {
    setNavigation(currentView); updateClock(); renderDds();
  });
  for (const control of document.querySelectorAll('#winbtns > div')) {
    control.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); control.click(); } });
  }
  const labels = {options:'偏好设置',browser:'发现模组',nsnotice:'北极星客户端说明'};
  for (const popup of document.querySelectorAll('.popup')) {
    popup.setAttribute('role','dialog'); popup.setAttribute('aria-modal','true'); popup.setAttribute('aria-label',labels[popup.id]); popup.setAttribute('aria-hidden','true');
  }
  for (const id of ['serverstatus','ddsStatus','ddsProgressLabel']) $(id).setAttribute('aria-live','polite');
  events.on('popup-changed',({popup,new_state:shown}) => {
    popup.setAttribute('aria-hidden',String(!shown));
    if (popup.id === 'options' && !shown) queueMicrotask(synchronizeMode);
    const sequence = ++popupFocusSequence;
    if (shown) {
      if (!returnFocus && !document.activeElement.closest('.popup')) returnFocus = document.activeElement;
      requestAnimationFrame(() => {
        if (sequence !== popupFocusSequence || !popup.classList.contains('shown')) return;
        Array.from(popup.querySelectorAll('input:not([disabled]),button:not([disabled]),summary,a[href],[tabindex="0"]')).find(el => el.getClientRects().length && !el.closest('[hidden],.hidden,[inert]'))?.focus({preventScroll:true});
      });
    } else if (!document.querySelector('.popup.shown')) {
      if (returnFocus?.isConnected && returnFocus.getClientRects().length && !returnFocus.closest('[inert],.hidden,[hidden]')) returnFocus.focus({preventScroll:true});
      returnFocus = null;
    }
  });
  document.addEventListener('keydown',event => {
    if(window.Settings?.saving&&document.querySelector('#options.shown')){if(event.key==='Escape'){event.preventDefault();return;}}
    if (event.key === 'Escape') { popups.set_all(false); return; }
    if (event.key !== 'Tab') return;
    const popup = document.querySelector('.popup.shown'); if (!popup) return;
    const controls = Array.from(popup.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),a[href],summary,[tabindex="0"]')).filter(el => el.getClientRects().length);
    const first = controls[0], last = controls[controls.length-1]; if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.Fold = Object.freeze({navigate,setMode,setSkinFormat,get skinFormat(){return skinFormat;},get view(){return currentView;},get mode(){return selectedMode;},DDS:Object.freeze({adoptImport:adoptDdsImport,refresh:refreshDds,render:()=>renderDds(),select:selectPackage,inspect:inspectPackage,clear:clearPackage,install:installTextures,finishInstallation,clearError(){dds.error="";renderDds();},setProtection:enabled=>window.DDSGuard.setEnabled(enabled),captureProtection:options=>window.DDSGuard.capture(options),get state(){return {...dds};}})});
})();

