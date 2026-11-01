/* EA emulator page, account card, header chip and diagnostics. */
(() => {
  'use strict';

  const emulatorPage = document.getElementById('eaEmulatorPage');
  const state = document.getElementById('eaAccountState');
  const badge = document.getElementById('eaAccountBadge');
  const errorBox = document.getElementById('eaAccountError');
  const loginButton = document.getElementById('eaLoginButton');
  const logoutButton = document.getElementById('eaLogoutButton');
  const refreshButton = document.getElementById('eaRefreshButton');
  const emulatorToggle = document.getElementById('eaEmulatorSwitch');
  const emulatorSaveState = document.getElementById('eaEmulatorSaveState');
  if (!emulatorPage || !state || !loginButton || !emulatorToggle) return;

  const chip = document.getElementById('eaAccountChip');
  const chipAvatar = document.getElementById('eaAccountChipAvatar');
  const chipInitial = document.getElementById('eaAccountChipInitial');
  const chipName = document.getElementById('eaAccountChipName');
  const chipState = document.getElementById('eaAccountChipState');
  const chipDot = document.getElementById('eaAccountChipDot');
  const diagState = document.getElementById('eaDiagnosticsState');
  const diagRows = document.getElementById('eaDiagnosticsRows');
  const diagHint = document.getElementById('eaDiagnosticsHint');
  const diagRefresh = document.getElementById('eaDiagnosticsRefresh');
  const diagRepair = document.getElementById('eaDiagnosticsRepair');
  const diagCopy = document.getElementById('eaDiagnosticsCopy');
  const diagOpenEa = document.getElementById('eaDiagnosticsOpenEa');
  const diagOpenLsx = document.getElementById('eaDiagnosticsOpenLsx');
  const accountPanels = [...document.querySelectorAll('[data-ea-account]')];

  let current = null;
  let busy = false;
  let diagnostics = null;
  let diagBusy = false;
  let diagMessage = '';
  let emulatorSaving = false;
  const t = (key, parameters) => I18n.t(key, parameters);
  const text = (zh, en) => I18n.current === 'zh-CN' ? zh : en;

  chipAvatar?.addEventListener('error', () => {
    if (chipAvatar) chipAvatar.hidden = true;
    if (chipInitial) chipInitial.hidden = false;
  });

  function showError(message) {
    if (!errorBox) return;
    errorBox.hidden = !message;
    errorBox.textContent = message || '';
  }

  function emulatorEnabled() {
    return typeof settings === 'object' && settings?.eaEmulator === true;
  }

  function syncEmulatorToggle() {
    const enabled = emulatorEnabled();
    emulatorToggle.classList.toggle('on', enabled);
    emulatorToggle.classList.toggle('off', !enabled);
    emulatorToggle.setAttribute('aria-checked', String(enabled));
    emulatorToggle.disabled = busy || emulatorSaving;
    emulatorToggle.setAttribute('aria-busy', String(emulatorSaving));
  }

  async function toggleEmulator() {
    if (busy || emulatorSaving) return;
    const previous = emulatorEnabled();
    const next = !previous;
    emulatorSaving = true;
    Settings.switch(emulatorToggle, next);
    emulatorSaveState.hidden = false;
    emulatorSaveState.classList.remove('is-error');
    emulatorSaveState.textContent = t('eaAccount.saving');
    syncEmulatorToggle();
    try {
      const result = await Settings.savePatch({eaEmulator:next});
      if (!result?.ok) throw Error(result?.error || t('eaAccount.saveFailed'));
      emulatorSaveState.textContent = t('eaAccount.saved');
      diagMessage = '';
    } catch (error) {
      settings = {...settings, eaEmulator:previous};
      emulatorSaveState.textContent = t('eaAccount.saveFailed');
      emulatorSaveState.title = error?.message || String(error);
      emulatorSaveState.classList.add('is-error');
    } finally {
      emulatorSaving = false;
      syncEmulatorToggle();
      render();
    }
  }

  function expiryText(epoch) {
    if (!Number.isFinite(Number(epoch)) || Number(epoch) <= 0) return t('eaAccount.expiresUnknown');
    try {
      const time = new Intl.DateTimeFormat(I18n.current || 'en-US', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false}).format(new Date(Number(epoch)));
      return t('eaAccount.expiresAt', {time});
    } catch (_) { return t('eaAccount.expiresUnknown'); }
  }

  function initialFor(value) {
    const match = String(value || '').trim().match(/[A-Za-z0-9\u00c0-\uffff]/u);
    return match ? match[0].toUpperCase() : 'EA';
  }

  function renderChip(status) {
    if (!chip) return;
    const loggedIn = Boolean(status?.loggedIn && !status.expired);
    const name = loggedIn ? status.playerName || status.userId || 'EA' : status?.expired ? text('登录已过期','Expired') : t('eaAccount.login');
    chipName.textContent = name;
    chipState.textContent = loggedIn ? expiryText(status.expiresAt) : status?.expired ? text('请重新登录','Sign in again') : emulatorEnabled() ? text('需登录','Sign in') : text('可选','Optional');
    chipDot.classList.toggle('online', loggedIn);
    chipDot.classList.toggle('expired', Boolean(!loggedIn && status?.expired));
    chip.setAttribute('aria-label', loggedIn ? t('eaAccount.loggedIn', {name:status.playerName || 'EA'}) : t('eaAccount.loginHint'));
    if (status?.avatarUrl) {
      chipAvatar.src = status.avatarUrl;
      chipAvatar.hidden = false;
      chipInitial.hidden = true;
    } else {
      chipAvatar.removeAttribute('src');
      chipAvatar.hidden = true;
      chipInitial.hidden = false;
      chipInitial.textContent = loggedIn ? initialFor(status.playerName) : 'EA';
    }
  }

  function renderAccountPanels(status) {
    if (!accountPanels.length) return;
    const loggedIn = Boolean(status?.loggedIn && !status.expired);
    const name = loggedIn ? status.playerName || status.userId || 'EA' : status?.expired ? text('登录已过期','Expired') : t('eaAccount.login');
    const stateText = loggedIn ? expiryText(status.expiresAt) : status?.expired ? t('eaAccount.sessionExpired') : emulatorEnabled() ? t('eaAccount.emulatorNeedsLogin') : t('eaAccount.homeHint');
    for (const bar of accountPanels) {
      const image = bar.querySelector('[data-ea-avatar]');
      const initial = bar.querySelector('[data-ea-initial]');
      const nameField = bar.querySelector('[data-ea-name]');
      const stateField = bar.querySelector('[data-ea-state]');
      const login = bar.querySelector('[data-ea-login]');
      const logout = bar.querySelector('[data-ea-logout]');
      if (nameField) nameField.textContent = name;
      if (stateField) stateField.textContent = stateText;
      if (image && initial) {
        if (status?.avatarUrl) {
          image.src = status.avatarUrl;
          image.hidden = false;
          initial.hidden = true;
        } else {
          image.removeAttribute('src');
          image.hidden = true;
          initial.hidden = false;
          initial.textContent = loggedIn ? initialFor(status.playerName) : 'EA';
        }
      }
      if (login) {login.hidden = loggedIn;login.disabled = busy;}
      if (logout) {logout.hidden = !loggedIn;logout.disabled = busy;}
      const refreshButton = bar.querySelector('[data-ea-refresh]');
      if (refreshButton) refreshButton.disabled = busy;
    }
  }

  function render() {
    const status = current || {loggedIn:false, expired:false};
    const loggedIn = Boolean(status.loggedIn && !status.expired);
    syncEmulatorToggle();
    badge.hidden = !current;
    if (current) {
      badge.textContent = loggedIn ? text('已登录','Signed in') : status.expired ? text('已过期','Expired') : text('未登录','Not signed in');
      badge.classList.toggle('online', loggedIn);
    }
    if (loggedIn) {
      state.textContent = t('eaAccount.loggedIn', {name:status.playerName || status.userId || 'EA'});
    } else if (status.expired) {
      state.textContent = t('eaAccount.sessionExpired');
    } else if (emulatorEnabled()) {
      state.textContent = t('eaAccount.emulatorNeedsLogin');
    } else {
      state.textContent = t('eaAccount.loggedOut');
    }
    loginButton.hidden = loggedIn;
    logoutButton.hidden = !current || (!status.loggedIn && !status.expired);
    refreshButton.hidden = !current;
    for (const button of allActionButtons()) button.disabled = busy;
    state.title = state.textContent;
    renderChip(status);
    renderAccountPanels(status);
    renderDiagnostics();
  }

  function allActionButtons() {
    return [loginButton, logoutButton, refreshButton, chip, ...document.querySelectorAll('[data-ea-login],[data-ea-logout],[data-ea-refresh]')].filter(Boolean);
  }

  function setBusy(value) {
    busy = value;
    syncEmulatorToggle();
    if (value) state.textContent = t('eaAccount.working');
    for (const button of allActionButtons()) button.disabled = value;
  }

  async function refresh(showFailure = false) {
    try {
      const status = await ipcRenderer.invoke('ea-status');
      if (status && typeof status === 'object') { current = status; showError(''); }
    } catch (error) {
      if (showFailure) showError(String(error?.message || error));
    } finally {
      render();
    }
  }

  async function login() {
    if (busy) return;
    showError('');
    setBusy(true);
    try {
      const result = await ipcRenderer.invoke('ea-login', {});
      if (!result?.ok) throw Object.assign(Error(result?.error || t('eaAccount.failed', {error:''})), {code:result?.code});
      current = result.status || current;
      render();
      window.dispatchEvent(new CustomEvent('tfx-ea-changed', {detail:{status:current}}));
      void refreshDiagnostics();
    } catch (error) {
      if (error?.code !== 'EA_LOGIN_CANCELLED') showError(t('eaAccount.failed', {error:error?.message || String(error)}));
    } finally {
      setBusy(false);
      render();
    }
  }

  async function logout() {
    if (busy) return;
    if (!window.confirm(text('退出 EA 登录？EA 模拟器将无法启动游戏。','Sign out of EA? The EA emulator will need a sign-in before launching games.'))) return;
    showError('');
    setBusy(true);
    try {
      const result = await ipcRenderer.invoke('ea-logout');
      if (!result?.ok) throw Object.assign(Error(result?.error || 'EA logout failed'), {code:result?.code});
      current = result.status || {loggedIn:false};
      render();
      window.dispatchEvent(new CustomEvent('tfx-ea-changed', {detail:{status:current}}));
      void refreshDiagnostics();
    } catch (error) {
      showError(error?.message || String(error));
    } finally {
      setBusy(false);
      render();
    }
  }

  async function renew() {
    if (busy) return;
    showError('');
    setBusy(true);
    try {
      const result = await ipcRenderer.invoke('ea-refresh');
      if (result?.ok && result.status) current = result.status;
      else if (result?.code !== 'EA_LOGIN_REQUIRED') showError(result?.error || t('eaAccount.sessionExpired'));
    } catch (error) {
      showError(error?.message || String(error));
    } finally {
      setBusy(false);
      render();
    }
  }

  function row(label, value, tone = '') {
    const element = document.createElement('div');
    element.className = 'ea-diagnostics-row';
    const name = document.createElement('span');
    name.textContent = label;
    const content = document.createElement('strong');
    content.textContent = value;
    if (tone) content.classList.add(tone);
    element.append(name, content);
    return element;
  }

  function lastRequest() {
    const recent = diagnostics?.emulator?.recent;
    if (!Array.isArray(recent) || !recent.length) return '';
    const request = [...recent].reverse().find(item => item?.stage === 'request');
    if (!request) return '';
    return String(request.type || '') + (request.empty ? text('（空响应）',' (empty)') : '');
  }

  function renderDiagnostics() {
    if (!diagRows) return;
    diagRows.replaceChildren();
    if (!diagnostics) {
      diagRows.append(row(t('eaAccount.diagnostics'), t('eaAccount.diagUnknown'), 'warn'));
      if (diagState) {diagState.textContent = '';diagState.className = 'ea-diagnostics-state';}
      return;
    }
    let warnings = 0;
    const accountStatus = diagnostics.account || {};
    const loggedIn = Boolean(accountStatus.loggedIn && !accountStatus.expired);
    diagRows.append(row(t('eaAccount.diagAccount'), loggedIn ? t('eaAccount.loggedIn', {name:accountStatus.playerName || 'EA'}) + ' · ' + expiryText(accountStatus.expiresAt) : accountStatus.expired ? t('eaAccount.sessionExpired') : t('eaAccount.loggedOut'), loggedIn ? 'ok' : 'warn'));
    if (!loggedIn) warnings++;
    diagRows.append(row(t('eaAccount.diagEmulator'), diagnostics.emulatorEnabled ? t('eaAccount.diagOk') : t('eaAccount.diagOff'), diagnostics.emulatorEnabled ? 'ok' : 'warn'));
    if (!diagnostics.emulatorEnabled) warnings++;
    const port = diagnostics.port || {};
    if (port.owner === 'other') {diagRows.append(row(t('eaAccount.diagPort'), t('eaAccount.diagPortBusy'), 'fail')); warnings++;}
    const game = diagnostics.game || {};
    if (!game.valid) {diagRows.append(row(t('eaAccount.diagGame'), text('请选择有效的游戏目录','Choose a valid game folder'), 'warn')); warnings++;}
    const emulator = diagnostics.emulator || {};
    if (emulator.active) diagRows.append(row(t('eaAccount.diagLsx'), t('eaAccount.diagActive'), 'ok'));
    if (diagState) {
      diagState.textContent = warnings ? t('eaAccount.diagWarn') : t('eaAccount.diagOk');
      diagState.className = 'ea-diagnostics-state ' + (warnings ? 'warn' : 'ok');
    }
    if (diagHint) diagHint.textContent = diagMessage;
    for (const button of [diagRefresh, diagRepair, diagCopy, diagOpenEa, diagOpenLsx]) if (button) button.disabled = diagBusy;
  }

  async function refreshDiagnostics() {
    if (diagBusy) return;
    diagBusy = true;
    diagMessage = '';
    renderDiagnostics();
    try {
      const result = await ipcRenderer.invoke('ea-diagnostics');
      if (!result?.ok || !result.diagnostics) throw Object.assign(Error(result?.error || 'diagnostics failed'), {code:result?.code});
      diagnostics = result.diagnostics;
      if (diagnostics.account) current = diagnostics.account;
      if (diagnostics.port?.owner === 'other') diagMessage = t('eaAccount.diagPortBusy');
    } catch (error) {
      diagMessage = error?.message || String(error);
    } finally {
      diagBusy = false;
      render();
    }
  }

  async function repair() {
    if (diagBusy) return;
    diagBusy = true;
    diagMessage = '';
    renderDiagnostics();
    try {
      const result = await ipcRenderer.invoke('ea-diagnostics-repair');
      if (!result?.ok) throw Object.assign(Error(result?.error || 'repair failed'), {code:result?.code});
      if (result.diagnostics) {
        diagnostics = result.diagnostics;
        if (diagnostics.account) current = diagnostics.account;
      } else {
        await refreshDiagnostics();
      }
      if (!diagnostics?.account?.loggedIn) diagMessage = t('eaAccount.diagLoginNeeded');
      else if (diagnostics?.port?.owner === 'other') diagMessage = t('eaAccount.diagPortBusy');
      else diagMessage = t('eaAccount.diagRepairDone');
      if (window.Settings && result.diagnostics) {
        settings = {...settings, eaEmulator:true};
        const toggle = document.querySelector('.option[name="eaEmulator"] .actions .switch');
        if (toggle) {toggle.classList.add('on');toggle.classList.remove('off');toggle.setAttribute('aria-checked','true');}
      }
    } catch (error) {
      diagMessage = error?.message || String(error);
    } finally {
      diagBusy = false;
      render();
    }
  }

  function diagnosticText() {
    const lines = [
      'TFX EA diagnostics',
      'time: ' + new Date().toISOString(),
      'account: ' + (current?.loggedIn ? (current.playerName || 'EA') : 'not signed in') + (current?.expired ? ' (expired)' : ''),
      'emulator: ' + (diagnostics?.emulatorEnabled ? 'enabled' : 'off'),
      'port3216: ' + JSON.stringify(diagnostics?.port || null),
      'game: ' + JSON.stringify(diagnostics?.game || null),
      'lsx: ' + JSON.stringify({active:diagnostics?.emulator?.active, recent:diagnostics?.emulator?.recent?.slice(-15) || []}),
      'paths: ' + JSON.stringify(diagnostics?.paths || null)
    ];
    return lines.join('\n');
  }

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(diagnosticText());
      diagMessage = t('eaAccount.diagCopied');
    } catch (_) {
      try {
        const area = document.createElement('textarea');
        area.value = diagnosticText();
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        diagMessage = t('eaAccount.diagCopied');
      } catch (error) {
        diagMessage = t('eaAccount.diagCopyFailed');
      }
    }
    renderDiagnostics();
  }

  async function openLog(kind) {
    try {
      const result = await ipcRenderer.invoke('ea-diagnostics-open-log', kind);
      if (!result?.ok) diagMessage = result?.error || text('日志尚未生成。','The log does not exist yet.');
    } catch (error) {
      diagMessage = error?.message || String(error);
    }
    renderDiagnostics();
  }

  function openSettings() {
    window.Fold?.navigate('eaEmulator');
    setTimeout(() => void refreshDiagnostics(), 60);
  }

  loginButton.addEventListener('click', login);
  logoutButton?.addEventListener('click', logout);
  refreshButton?.addEventListener('click', renew);
  emulatorToggle.addEventListener('click', () => void toggleEmulator());
  for (const bar of accountPanels) {
    bar.querySelector('[data-ea-login]')?.addEventListener('click', login);
    bar.querySelector('[data-ea-logout]')?.addEventListener('click', logout);
    const image = bar.querySelector('[data-ea-avatar]');
    image?.addEventListener('error', () => {
      image.hidden = true;
      const initial = bar.querySelector('[data-ea-initial]');
      if (initial) initial.hidden = false;
    });
  }
  chip?.addEventListener('click', () => {
    if (busy) return;
    if (current?.loggedIn && !current.expired) openSettings();
    else void login();
  });
  diagRefresh?.addEventListener('click', () => void refreshDiagnostics());
  diagRepair?.addEventListener('click', () => void repair());
  diagCopy?.addEventListener('click', () => void copyDiagnostics());
  diagOpenEa?.addEventListener('click', () => void openLog('ea'));
  diagOpenLsx?.addEventListener('click', () => void openLog('lsx'));
  window.addEventListener('vyra-language-changed', render);
  window.addEventListener('tfx-settings-persisted', render);
  window.addEventListener('vyra-settings-restored', render);
  window.addEventListener('vyra-view-change', event => {
    if (event.detail?.view === 'eaEmulator') void refreshDiagnostics();
  });
  render();
  void refresh();
  window.EaAccount = Object.freeze({refresh, refreshDiagnostics, get status() { return current ? {...current} : null; }, get busy() { return busy; }});
})();
