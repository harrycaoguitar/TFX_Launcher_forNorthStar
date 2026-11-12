;
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const page = $('r1deltaPage');
  if (!page) return;
  const list = $('r1AddonList');
  const serverList = $('r1ServerList');
  const pathLabel = $('r1GamePath');
  const statusLine = $('r1StatusLine');
  const installState = $('r1InstallState');
  const addonsState = $('r1AddonsState');
  const modsPath = $('r1ModsGamePath');
  const modsStatus = $('r1ModsStatusLine');
  const modsAddons = $('r1ModsAddonsState');
  const serverState = $('r1ServerState');
  const progressPanel = $('r1Progress');
  const progressLabel = $('r1ProgressLabel');
  const progressValue = $('r1ProgressValue');
  const progressBar = $('r1ProgressBar');
  let latest = null;
  let servers = [];
  let busy = false;
  let platform = localStorage.getItem('tfx-platform') === 'tf1' ? 'tf1' : 'tf2';
  const notify = (title, message, error = false) => {
    try { new Toast({scheme:error?'error':'success', title, description:message||'', timeout:error?8000:4000}); }
    catch (_) { console.log(title, message || ''); }
  };
  function renderPlatform() {
    for (const button of document.querySelectorAll('#platformSwitch [data-platform]')) {
      const active = button.dataset.platform === platform;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    document.body.dataset.platform = platform;
  }
  function setPlatform(value, navigate = true) {
    const was = platform;
    platform = value === 'tf1' ? 'tf1' : 'tf2';
    localStorage.setItem('tfx-platform', platform);
    renderPlatform();
    if (!navigate || platform === was) return;
    Fold.navigate('home');
  }
  function renderProgress(value) {
    if (!progressPanel) return;
    if (!value || value.stage === 'error') { progressPanel.hidden = true; return; }
    progressPanel.hidden = false;
    const percent = Number.isFinite(Number(value.percent)) ? Math.min(100, Math.max(0, Number(value.percent))) : null;
    const labels = {download:'正在下载 R1Delta 客户端…', verify:'正在校验官方文件…', extract:'正在解压客户端文件…', install:'正在部署到游戏目录…', complete:'R1Delta 安装完成'};
    progressLabel.textContent = labels[value.stage] || '正在处理 R1Delta…';
    progressValue.textContent = percent === null ? '' : Math.round(percent) + '%';
    progressBar.style.width = (percent === null ? 35 : percent) + '%';
  }
  function render(status) {
    latest = status || latest;
    const data = latest || {gamepath:'', installed:false, addons:[]};
    const addons = Array.isArray(data.addons) ? data.addons : [];
    if (pathLabel) { pathLabel.textContent = data.gamepath || '未选择'; pathLabel.title = data.gamepath || ''; }
    if (statusLine) statusLine.textContent = data.gameInstalled ? '已检测到 Titanfall.exe 与 VPK 资源' : data.gamepath ? '所选目录缺少 Titanfall.exe 或 VPK 资源' : '未检测到游戏';
    if (installState) { installState.textContent = data.installed ? (data.clientVersion ? '已安装 ' + data.clientVersion : '已安装') : '未安装'; installState.style.color = data.installed ? '#8df0c0' : ''; }
    if (addonsState) addonsState.textContent = data.gamepath ? (addons.length + ' 个 Addon') : '尚未读取';
    if (modsPath) modsPath.textContent = data.gamepath || '未选择';
    if (modsStatus) modsStatus.textContent = data.gamepath ? (data.gameInstalled ? (data.installed ? '目录有效' : '等待安装 R1Delta') : '目录缺少游戏文件或 VPK 资源') : '请选择已安装且包含 Titanfall.exe 与 VPK 资源的目录';
    if (modsAddons) modsAddons.textContent = data.gamepath ? (addons.length + ' 个 Addon') : '尚未读取';
    if ($('r1Launch')) {
      $('r1Launch').disabled = busy;
      $('r1Launch').textContent = busy ? '正在处理…' : !data.gameInstalled ? '安装 Titanfall 1' : !data.installed ? '安装 R1Delta' : '启动游戏';
    }
    if ($('r1CheckUpdates')) $('r1CheckUpdates').disabled = busy || !data.gameInstalled || !data.installed;
    for (const id of ['r1Import','r1OpenAddons','r1ModsOpen','r1InstallImport','r1InstallOpen']) {
      const element = $(id);
      if (element) element.disabled = busy || !data.gamepath;
    }

    if (list) {
      list.textContent = '';
      if (!data.gamepath) list.append(Object.assign(document.createElement('div'), {className:'r1-addon-empty', textContent:'先选择泰坦陨落 1 游戏目录。'}));
      else if (!addons.length) list.append(Object.assign(document.createElement('div'), {className:'r1-addon-empty', textContent:'r1\\addons 里还没有 Mod。点右上角「导入 Mod」添加。'}));
      else for (const addon of addons) {
        const row = document.createElement('div'); row.className = 'r1-addon-row';
        const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = !!addon.enabled; toggle.disabled = busy;
        toggle.addEventListener('change', () => toggleAddon(addon.name, toggle.checked));
        const name = document.createElement('span'); name.className = 'r1-addon-name'; name.textContent = addon.name;
        const type = document.createElement('small'); type.className = 'r1-addon-type'; type.textContent = addon.type === 'vpk' ? 'VPK' : '文件夹';
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除'; remove.disabled = busy;
        remove.addEventListener('click', () => removeAddon(addon.name));
        row.append(toggle, name, type, remove); list.append(row);
      }
    }
  }
  function renderServers(data) {
    servers = Array.isArray(data) ? data : servers;
    if (!serverList) return;
    serverList.textContent = '';
    serverState.textContent = servers.length ? (servers.length + ' 个服务器') : '没有找到服务器';
    if (!servers.length) { serverList.append(Object.assign(document.createElement('div'), {className:'r1-addon-empty', textContent:'没有找到 R1Delta 服务器。'})); return; }
    for (const server of servers) {
      const row = document.createElement('div'); row.className = 'r1-server-row';
      const main = document.createElement('div'); main.className = 'r1-server-main';
      const name = document.createElement('div'); name.className = 'r1-server-name'; name.textContent = server.name;
      const meta = document.createElement('div'); meta.className = 'r1-server-meta';
      meta.textContent = [server.map || '未知地图', server.mode || '未知模式', server.password ? '有密码' : '', server.version].filter(Boolean).join(' · ');
      main.append(name, meta);
      const count = document.createElement('span'); count.className = 'r1-server-count'; count.textContent = server.players + ' / ' + server.maxPlayers;
      const join = document.createElement('button'); join.type = 'button'; join.className = 'fold-button compact'; join.textContent = '加入'; join.disabled = busy;
      join.addEventListener('click', () => joinServer(server));
      row.append(main, count, join); serverList.append(row);
    }
  }
  async function refresh() {
    try { render(await ipcRenderer.invoke('r1delta-status')); }
    catch (error) { notify('R1Delta 状态读取失败', error?.message || String(error), true); }
  }
  async function refreshServers() {
    if (!serverState) return;
    serverState.textContent = '正在读取…';
    try {
      const result = await ipcRenderer.invoke('r1delta-servers');
      if (!result?.ok) throw Error(result?.error || '读取失败');
      renderServers(result.servers);
    } catch (error) { serverState.textContent = '读取失败'; renderServers([]); notify('R1Delta 服务器', error?.message || String(error), true); }
  }
  async function run(action, success, failure) {
    if (busy) return;
    busy = true; render(latest);
    try {
      const result = await action();
      if (result?.canceled) return;
      if (result?.ok === false) throw Error(result.error || failure || '操作失败');
      if (result?.ok !== false) { if (success) notify(success, result?.message || ''); await refresh(); }
    } catch (error) { notify('R1Delta', error?.message || String(error), true); }
    finally {
      busy = false;
      window.setTimeout(() => { if (progressPanel?.hidden === false) progressPanel.hidden = true; }, 900);
      render(latest);
    }
  }
  const toggleAddon = (name, enabled) => run(() => ipcRenderer.invoke('r1delta-toggle-addon', name, enabled));
  const removeAddon = name => { if (confirm('删除 Addon：' + name + '？')) run(() => ipcRenderer.invoke('r1delta-remove-addon', name), 'Addon 已删除'); };
  const joinServer = server => run(() => ipcRenderer.invoke('r1delta-join', server.ip, server.port), '正在加入服务器');
  async function ensurePathThen(action) {
    if (!latest?.gamepath) {
      const selected = await ipcRenderer.invoke('r1delta-select');
      if (!selected?.ok) return selected;
      render(selected); await refresh();
    }
    return action();
  }
  if ($('r1Select')) $('r1Select').addEventListener('click', () => run(() => ipcRenderer.invoke('r1delta-select'), '游戏目录已保存'));
  if ($('r1ModsSelect')) $('r1ModsSelect').addEventListener('click', () => run(() => ipcRenderer.invoke('r1delta-select'), '游戏目录已保存'));

  async function launchOrInstall() {
    if (busy) return;
    try {
      let status = await ipcRenderer.invoke('r1delta-status');
      if (!status?.ok) throw Error(status?.error || '无法检测游戏目录');
      render(status);
      if (!status.gameInstalled) {
        if (!confirm('未检测到完整的泰坦陨落 1 游戏目录。是否打开 Steam 安装游戏？')) return;
        const result = await ipcRenderer.invoke('r1delta-open-steam');
        if (result?.ok === false) throw Error(result.error || '无法打开 Steam');
        notify('已打开 Steam', '安装完成后返回此页面，启动器会重新检测游戏目录。');
        return;
      }
      if (!status.installed) {
        if (!confirm('已检测到泰坦陨落 1。是否下载并由 TFX 安装 R1Delta 客户端到游戏目录？')) return;
        await run(() => ipcRenderer.invoke('r1delta-install'), 'R1Delta 已安装');
        return;
      }
      await run(() => ipcRenderer.invoke('r1delta-launch'), '游戏已启动');
    } catch (error) { notify('泰坦陨落 1', error?.message || String(error), true); }
  }
  async function checkUpdates() {
    if (busy) return;
    busy = true; render(latest);
    try {
      const check = await ipcRenderer.invoke('r1delta-check-updates');
      if (!check?.ok) throw Error(check?.error || '无法检查更新');
      if (!check.updateAvailable) {
        notify('R1Delta 已是最新版本', '当前版本 ' + check.currentVersion);
        return;
      }
      const current = check.currentVersion || '未知';
      if (!confirm(`发现 R1Delta ${check.latestVersion}（当前 ${current}）。是否由 TFX 下载并更新客户端？`)) return;
      const result = await ipcRenderer.invoke('r1delta-install');
      if (!result?.ok) throw Error(result?.error || '更新失败');
      notify('R1Delta 更新完成', result.message || '');
      await refresh();
    } catch (error) { notify('R1Delta 更新', error?.message || String(error), true); }
    finally { busy = false; render(latest); }
  }
  if ($('r1Launch')) $('r1Launch').addEventListener('click', launchOrInstall);
  if ($('r1CheckUpdates')) $('r1CheckUpdates').addEventListener('click', checkUpdates);
  if ($('r1OpenAddons')) $('r1OpenAddons').addEventListener('click', () => run(() => ipcRenderer.invoke('r1delta-open-addons')));
  if ($('r1ModsOpen')) $('r1ModsOpen').addEventListener('click', () => run(() => ipcRenderer.invoke('r1delta-open-addons')));
  if ($('r1InstallOpen')) $('r1InstallOpen').addEventListener('click', () => run(() => ipcRenderer.invoke('r1delta-open-addons')));
  if ($('r1Import')) $('r1Import').addEventListener('click', () => run(() => ensurePathThen(() => ipcRenderer.invoke('r1delta-import-addon')), 'Mod 已导入'));
  if ($('r1InstallImport')) $('r1InstallImport').addEventListener('click', () => run(() => ensurePathThen(() => ipcRenderer.invoke('r1delta-import-addon')), 'Mod 已导入'));
  if ($('r1OpenEA')) $('r1OpenEA').addEventListener('click', () => run(() => ipcRenderer.invoke('r1delta-open-ea'), '已打开 EA App'));
  if ($('r1OpenSteam')) $('r1OpenSteam').addEventListener('click', () => run(() => ipcRenderer.invoke('r1delta-open-steam'), '已打开 Steam'));
  if ($('r1Refresh')) $('r1Refresh').addEventListener('click', refresh);
  if ($('r1ServersRefresh')) $('r1ServersRefresh').addEventListener('click', refreshServers);
  ipcRenderer.on('r1delta-progress', (_event, value) => renderProgress(value));
  for (const button of document.querySelectorAll('#platformSwitch [data-platform]')) button.addEventListener('click', () => setPlatform(button.dataset.platform));
  window.addEventListener('vyra-view-change', event => {
    if (platform !== 'tf1') return;
    if (event.detail?.view === 'servers') void refreshServers();
    if (['r1delta','mods','servers','skins'].includes(event.detail?.view)) void refresh();
  });
  renderPlatform();
  if (platform === 'tf1') window.setTimeout(() => Fold.navigate('home'), 50);
  window.R1Delta = Object.freeze({refresh, refreshServers, setPlatform, get platform() { return platform; }, get state() { return latest; }});
  void refresh();
  window.setInterval(refresh, 6000);
})();
