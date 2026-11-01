/* Shared skin protection lives in settings; DDS coverage stays beside its import. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (key, parameters) => I18n.t('ddsGuard.' + key, parameters);
  const state = {package:null,protection:null,game:{ready:false,path:''},busy:false,actionBusy:false,error:'',confirming:false,refreshBusy:false};
  let revision = 0;
  let refreshing = null;
  let refreshingPath = '';
  let ddsWasBusy = false;
  const visible = () => $('options').classList.contains('shown');
  const refreshVisible = () => { if (visible() || state.package || state.actionBusy) return refresh(); };
  const normalizedPath = path => String(path || '').trim().replace(/[\\/]+/g,'/').replace(/\/+$/,'').toLowerCase();
  const selectedServer = () => typeof settings === 'undefined' ? 'cn' : ['cn','global','official'].includes(settings.modProfileServer) ? settings.modProfileServer : settings.northstarRegion === 'global' ? 'global' : 'cn';
  const gamePath = () => normalizedPath(typeof settings === 'undefined' ? '' : selectedServer() === 'global' ? settings.globalGamepath : settings.gamepath);
  const currentProtection = protection => !protection || !Object.prototype.hasOwnProperty.call(protection,'gamePath') || normalizedPath(protection.gamePath) === gamePath();
  const running = () => {
    const server = selectedServer(), availability = window.VyraLaunchAvailability, snapshot = window.VyraGameProcesses?.snapshot;
    if (!availability || !snapshot) return true;
    return availability.rootOccupied(snapshot, settings, server === 'official' ? 'vanilla' : 'northstar', server === 'global' ? 'global' : 'cn');
  };
  const operationBusy = () => state.busy || Boolean(window.Settings?.saving || window.VTF?.state?.busy || window.Fold?.DDS?.state?.busy);
  const canCapture = () => state.game.ready && !running() && !operationBusy() && !state.refreshBusy && !state.actionBusy && Number(state.protection?.activeCount)>0 && ['ready','changed','unrecorded'].includes(state.protection?.state);
  const toast = (key, error = false, description = '') => new Toast({scheme:error?'error':'success',title:t(key),description:I18n.text(description),timeout:error?9000:4500});
  function renderCoverage() {
    const coverage = state.package?.coverage;
    $('ddsCoverage').hidden = !state.package;
    if (!state.package) return;
    const status = ['complete','partial'].includes(coverage?.state) ? coverage.state : 'unknown';
    $('ddsCoverage').dataset.state = status;
    $('ddsCoverageState').textContent = t(status === 'complete' ? 'coverageComplete' : status === 'partial' ? 'coveragePartial' : 'coverageUnknown');
    const supportedCount = coverage?.supportedCount ?? coverage?.expectedCount;
    const hasCounts = Number.isFinite(coverage?.coveredCount) && Number.isFinite(supportedCount) && supportedCount > 0;
    $('ddsCoverageCount').hidden = !hasCounts;
    $('ddsCoverageCount').textContent = hasCounts ? t('coverageCount',{covered:coverage.coveredCount,expected:supportedCount}) : '';
    $('ddsCoverageHint').textContent = t(status === 'complete' ? 'coverageCompleteHint' : status === 'partial' ? 'coveragePartialHint' : 'coverageUnknownHint');
    const missing = Array.isArray(coverage?.missing) ? coverage.missing : [];
    $('ddsCoverageMissing').hidden = !missing.length;
    $('ddsCoverageMissingSummary').textContent = t('coverageMissing',{count:Number.isFinite(coverage?.missingCount)?coverage.missingCount:missing.length});
    $('ddsCoverageMissingList').replaceChildren();
    for (const item of missing) {
      const row = document.createElement('li'), name = document.createElement('span'), size = document.createElement('span');
      name.textContent = String(item.name || 'DDS'); name.title = name.textContent;
      size.textContent = `${item.width} × ${item.height}`;
      row.append(name,size); $('ddsCoverageMissingList').append(row);
    }
  }
  function renderProtection() {
    const protection = state.protection, busy = operationBusy() || state.actionBusy || state.refreshBusy;
    const activeCount = Number(protection?.activeCount) || 0;
    const status = state.refreshBusy ? 'loading' : !state.game.ready ? 'no-game' : protection ? ['inactive','ready','changed','missing-config','unrecorded','error'].includes(protection.state) ? protection.state : 'error' : 'loading';
    const enabled = protection ? Boolean(protection.enabled) : true;
    $('ddsProtection').dataset.state = !enabled && protection && state.game.ready && !state.refreshBusy ? 'disabled' : status;
    $('ddsProtection').setAttribute('aria-busy',String(busy));
    const stateKeys = {inactive:'stateInactive',ready:'stateReady',changed:'stateChanged','missing-config':'stateMissing',unrecorded:'stateUnrecorded',error:'stateError',loading:'loading','no-game':'noGame'};
    $('ddsProtectionStatus').textContent = t(!enabled && protection && state.game.ready && !state.refreshBusy ? 'disabled' : stateKeys[status]);
    $('ddsProtectionToggle').setAttribute('aria-checked',String(enabled));
    $('ddsProtectionToggle').disabled = busy || !protection || !state.game.ready;
    const hintKeys = {inactive:'inactiveHint',ready:'readyHint',changed:'changedHint','missing-config':'missingHint',unrecorded:'unrecordedHint',error:'errorHint',loading:'loading','no-game':'noGameHint'};
    $('ddsProtectionDetail').textContent = t(!enabled && protection && state.game.ready && !state.refreshBusy ? 'disabledHint' : hintKeys[status]);
    const ddsCount=Number(protection?.ddsCount),vtfCount=Number(protection?.vtfCount);
    $('ddsProtectionActive').textContent = Number.isFinite(ddsCount)&&Number.isFinite(vtfCount) ? t('formatCount',{count:activeCount,dds:ddsCount,vtf:vtfCount}) : t('activeCount',{count:activeCount});
    $('ddsProtectionCapture').disabled = !canCapture();
    $('ddsProtectionRefresh').disabled = Boolean(window.Settings?.saving) || state.actionBusy || state.refreshBusy;
    $('ddsProtectionRunning').hidden = !running();
    const snapshot = protection?.snapshot;
    $('ddsProtectionRecord').hidden = !snapshot;
    if (snapshot) {
      const date = new Date(snapshot.capturedAt);
      $('ddsProtectionRecordedAt').textContent = Number.isNaN(date.getTime()) ? '' : t('snapshotAt',{date:date.toLocaleString(I18n.current,{hour12:false})});
      const values = snapshot.values || {};
      $('ddsProtectionStreamMemory').textContent = values['setting.stream_memory'] ?? '—';
      $('ddsProtectionPicmip').textContent = values['setting.mat_picmip'] ?? '—';
      $('ddsProtectionConfigPath').hidden = !protection.configPath;
      $('ddsProtectionConfigPath').textContent = protection.configPath ? t('configLocation') + ' · ' + protection.configPath : '';
    }
    if (!canCapture()) state.confirming = false;
    $('ddsProtectionConfirm').hidden = !state.confirming;
    $('ddsProtectionCaptureConfirm').disabled = !canCapture();
    $('ddsProtectionCaptureCancel').disabled = busy;
    const error = state.error || (status === 'error' ? protection?.reason : '') || '';
    $('ddsProtectionError').hidden = !error;
    $('ddsProtectionError').textContent = I18n.text(error);
  }
  function render() { renderCoverage(); renderProtection(); }
  function update(value = {}) {
    if (Object.prototype.hasOwnProperty.call(value,'package')) state.package = value.package;
    if (Object.prototype.hasOwnProperty.call(value,'protection') && !Object.prototype.hasOwnProperty.call(value,'package') && currentProtection(value.protection)) state.protection = value.protection;
    if (value.game && (!value.game.path || normalizedPath(value.game.path) === gamePath())) state.game = value.game;
    if (Object.prototype.hasOwnProperty.call(value,'globalBusy')) state.busy = Boolean(value.globalBusy);
    render();
    if (Object.prototype.hasOwnProperty.call(value,'package')) {
      const completed = ddsWasBusy && value.busy === false;
      ddsWasBusy = Boolean(value.busy);
      if (completed) refresh({fresh:true});
    }
  }
  async function refresh(options = {}) {
    if (refreshing && !options.fresh && refreshingPath === gamePath()) return refreshing;
    const ticket = ++revision;
    const requestPath = gamePath();
    refreshingPath = requestPath;
    state.refreshBusy = true;
    state.confirming = false;
    renderProtection();
    const request = (async () => {
      try {
        const result = await ipcRenderer.invoke('dds-protection-status');
        if (ticket !== revision || requestPath !== gamePath() || !currentProtection(result?.protection) || result?.game?.path && normalizedPath(result.game.path) !== requestPath) return {stale:true};
        if (!result?.ok) throw new Error(result?.error || t('operationError'));
        state.protection = result.protection || null;
        state.game = result.game || {ready:false,path:''};
        state.busy = Boolean(result.busy);
        state.error = '';
        return result;
      } catch (error) {
        if (ticket !== revision || requestPath !== gamePath()) return {stale:true};
        state.error = error.message;
        return {ok:false,error:error.message};
      } finally {
        if (ticket === revision) {state.refreshBusy=false;refreshing=null;renderProtection();}
      }
    })();
    refreshing = request;
    return request;
  }
  async function action(channel, input, success) {
    if (state.actionBusy || state.refreshBusy || operationBusy()) return null;
    state.actionBusy = true; state.error = ''; renderProtection();
    try {
      const result = await ipcRenderer.invoke(channel,input);
      if (!result?.ok) throw new Error(result?.error || t('operationError'));
      if (result.protection && currentProtection(result.protection)) state.protection = result.protection;
      state.confirming = false;
      toast(success);
      await refresh({fresh:true});
      return result;
    } catch (error) {
      state.error = error.message; toast('operationFailed',true,error.message);
      return {ok:false,error:error.message};
    } finally {state.actionBusy = false; renderProtection();}
  }
  async function setEnabled(enabled) {
    if (state.refreshBusy || !state.protection || !state.game.ready) return null;
    return action('dds-protection-set',{enabled:Boolean(enabled)},'saved');
  }
  async function capture(options = {}) {
    if (!canCapture()) return null;
    if (state.protection?.snapshot && !options.confirmed) {
      state.confirming = true; renderProtection(); $('ddsProtectionCaptureConfirm').focus();
      return {confirmationRequired:true};
    }
    return action('dds-protection-capture',{},'captured');
  }
  $('ddsProtectionToggle').addEventListener('click',() => setEnabled(!state.protection?.enabled));
  $('ddsProtectionCapture').addEventListener('click',() => capture());
  $('ddsProtectionCaptureConfirm').addEventListener('click',() => capture({confirmed:true}));
  $('ddsProtectionCaptureCancel').addEventListener('click',() => {state.confirming=false;renderProtection();$('ddsProtectionCapture').focus();});
  $('ddsProtectionRefresh').addEventListener('click',() => refresh({fresh:true}));
  ipcRenderer.on('launch-guard-result',(_event,result) => {
    if (!result) return;
    if (!result.ok && result.scope === 'client') new Toast({scheme:'error',title:I18n.t(window.OfficialErrors?.has(result)?'official.errorTitle':'client.switchFailed'),description:window.OfficialErrors?.has(result)?window.OfficialErrors.text(result):I18n.text(result.error || result.reason || ''),timeout:9000});
    else if (!result.ok) toast('launchFailed',true,result.error || result.reason || t('operationError'));
    else if (result.restored) toast('restored');
    refreshVisible();
  });
  ipcRenderer.on('newpath',(_event,path) => {if (normalizedPath(path) !== gamePath()) return;state.game={ready:false,path:path||''};refreshVisible();});
  function invalidateGame() {++revision;refreshing=null;state.refreshBusy=false;state.game={ready:false,path:''};state.protection=null;state.confirming=false;renderProtection();}
  ipcRenderer.on('gamepath-status',(_event,game) => {if (normalizedPath(game?.path) !== gamePath()) return;if (!game?.valid) invalidateGame(); else refreshVisible();});
  ipcRenderer.on('gamepath-lost',() => {if (gamePath() === normalizedPath(settings.gamepath)) invalidateGame();});
  let observedPath = gamePath();
  function refreshProfile() {
    const nextPath = gamePath();
    if (nextPath !== observedPath) {observedPath=nextPath;invalidateGame();}
    refreshVisible();
  }
  ipcRenderer.on('globalpath-selected',(_event,path) => {if (normalizedPath(path) === gamePath()) refreshProfile();});
  ipcRenderer.on('changed-settings',(_event,value) => {if (value && ['gamepath','globalGamepath','northstarRegion','modProfileServer','nsargs'].some(key => Object.prototype.hasOwnProperty.call(value,key))) refreshProfile();});
  ipcRenderer.on('game-process-snapshot',() => {renderProtection();refreshVisible();});
  ipcRenderer.on('is-running',() => renderProtection());
  events.on('popup-changed',({popup,new_state:shown}) => {if (popup.id === 'options' && shown) refresh();});
  window.addEventListener('vyra-language-changed',render);
  window.addEventListener('tfx-settings-saving-changed',renderProtection);
  window.DDSGuard = Object.freeze({update,refresh,setEnabled,capture,get state(){return {...state};}});
  render();
})();
