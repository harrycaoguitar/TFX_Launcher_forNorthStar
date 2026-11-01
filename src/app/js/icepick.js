/* Icepick campaign mods stay separate from the Northstar mod manager. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const manager = $('icepickManager');
  if (!manager) return;
  const actions = manager.querySelector('.icepick-manager-actions');
  const select = document.createElement('button');
  select.type = 'button';
  select.className = 'fold-button compact';
  select.textContent = '选择 Icepick 目录';
  actions.prepend(select);
  let status = null;
  let busy = false;
  const text = (zh, en) => I18n.current === 'zh-CN' ? zh : en;
  const translate = (key, values) => I18n.t(key, values);
  const toast = (title, error = false) => new Toast({scheme:error ? 'error' : 'success', title, timeout:error ? 9000 : 4500});

  function render() {
    const found = Boolean(status?.ok);
    const mods = status?.mods || [];
    const state = $('icepickManagerState');
    const empty = $('icepickManagerEmpty');
    const list = $('icepickManagerList');
    state.textContent = found
      ? translate('icepick.managerState', {path:status.path, count:mods.length})
      : text('未检测到 Icepick。导入模组时可选择 Icepick 安装目录。', 'Icepick was not found. Choose its folder when importing a mod.');
    $('icepickManagerImport').disabled = busy;
    $('icepickManagerRefresh').disabled = busy;
    select.disabled = busy;
    list.replaceChildren();
    empty.hidden = Boolean(mods.length);
    empty.textContent = found
      ? text('还没有 Icepick Mod。使用“导入 Icepick Mod”添加。', 'No Icepick mods yet. Use “Import Icepick Mod” to add one.')
      : text('选择或安装 Icepick 后，这里会单独显示战役模组。', 'Campaign mods will appear here after Icepick is selected or installed.');
    for (const mod of mods) {
      const card = document.createElement('article');
      card.className = 'icepick-mod' + (mod.enabled ? '' : ' is-disabled');
      card.dataset.modId = mod.id;
      const copy = document.createElement('div');
      copy.className = 'icepick-mod-copy';
      const name = document.createElement('strong');
      name.textContent = mod.name;
      name.title = mod.name;
      const meta = document.createElement('small');
      meta.textContent = [mod.version ? 'v' + mod.version.replace(/^v/u, '') : '', (mod.authors || []).join(', '), mod.core ? text('核心框架', 'Core framework') : ''].filter(Boolean).join(' · ');
      const description = document.createElement('p');
      description.textContent = mod.description || text('没有说明。', 'No description.');
      copy.append(name, meta, description);
      const actions = document.createElement('div');
      actions.className = 'icepick-mod-actions';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'fold-button compact';
      toggle.dataset.modAction = 'toggle';
      toggle.textContent = mod.enabled ? translate('icepick.disable') : translate('icepick.enable');
      toggle.disabled = busy || mod.core;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'fold-button compact fold-danger';
      remove.dataset.modAction = 'remove';
      remove.textContent = translate('icepick.remove');
      remove.disabled = busy || mod.core;
      actions.append(toggle, remove);
      card.append(copy, actions);
      list.append(card);
    }
  }

  async function refresh() {
    try {
      const result = await ipcRenderer.invoke('icepick-status');
      if (!result?.ok) throw new Error(result?.error || 'Icepick status failed');
      status = result.status || null;
    } catch (_) {
      status = null;
    }
    render();
  }

  async function run(channel, payload) {
    if (busy) return;
    busy = true;
    render();
    try {
      const result = await ipcRenderer.invoke(channel, payload);
      if (!result?.ok && !result?.canceled) throw new Error(result?.error || 'Icepick operation failed');
      await refresh();
      if (result?.ok) toast(text('Icepick 模组列表已更新。', 'Icepick mod list updated.'));
    } catch (error) {
      toast(error.message || String(error), true);
    } finally {
      busy = false;
      render();
    }
  }

  $('icepickManagerRefresh').addEventListener('click', () => void refresh());
  select.addEventListener('click', () => void run('icepick-select'));
  $('icepickManagerImport').addEventListener('click', () => void run('icepick-import'));
  $('icepickManagerList').addEventListener('click', async event => {
    const button = event.target.closest?.('[data-mod-action]');
    const card = button?.closest?.('[data-mod-id]');
    if (!button || !card || busy) return;
    const id = card.dataset.modId;
    if (button.dataset.modAction === 'toggle') await run('icepick-toggle', id);
    else if (button.dataset.modAction === 'remove' && window.confirm(text(`删除 Mod“${id}”？`, `Delete mod “${id}”?`))) await run('icepick-remove', id);
  });
  window.addEventListener('vyra-view-change', event => { if (event.detail?.view === 'mods') void refresh(); });
  window.addEventListener('vyra-language-changed', render);
  window.addEventListener('tfx-settings-persisted', event => { if (event.detail?.keys?.some(key => ['gamepath','icepickPath'].includes(key))) void refresh(); });
  window.addEventListener('vyra-settings-restored', () => void refresh());
  render();
  void refresh();
  window.Icepick = Object.freeze({refresh, get status() { return status ? {...status} : null; }, get busy() { return busy; }});
})();
