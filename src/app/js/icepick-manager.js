/* Icepick management within My Mods and the unified importer. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('icepickManager')) return;
  let state = null;
  let busy = false;
  const t = (key, parameters) => I18n.t(key, parameters);
  const text = (zh, en) => I18n.current === 'zh-CN' ? zh : en;
  const toast = (title, error = false, description = '') => new Toast({scheme:error ? 'error' : 'success', title, description, timeout:error ? 9000 : 4500});

  function setBusy(value) {
    busy = value;
    for (const button of document.querySelectorAll('#icepickManager button')) button.disabled = value;
    render();
  }

  function statusLine(message, error = false) {
    const line = $('icepickManagerState');
    line.textContent = message || '';
    line.classList.toggle('icepick-error', error);
  }

  function renderMods(status) {
    const list = $('icepickManagerList');
    const empty = $('icepickManagerEmpty');
    list.replaceChildren();
    const mods = status?.mods || [];
    empty.hidden = Boolean(mods.length);
    if (!mods.length) {
      empty.textContent = status?.ok ? text('还没有战役 Mod。拖入 Mod 文件，或点击“导入 Icepick Mod”。', 'No campaign mods yet. Drop a mod file here or use Import Icepick Mod.') : text('未检测到 Icepick。选择包含 Titanfall-2-Icepick.exe 的目录后，这里会显示战役 Mod。', 'Icepick was not found. Select the folder containing Titanfall-2-Icepick.exe to list campaign mods.');
      return;
    }
    for (const mod of mods) {
      const card = document.createElement('article');
      card.className = 'icepick-mod' + (mod.enabled ? '' : ' is-disabled');
      card.dataset.modId = mod.id;
      const icon = document.createElement('div');
      icon.className = 'icepick-mod-icon';
      if (mod.imageUrl) {
        const image = document.createElement('img');
        image.src = mod.imageUrl; image.alt = '';
        image.addEventListener('error', () => image.remove());
        icon.append(image);
      } else {
        const initial = document.createElement('span');
        initial.textContent = (mod.name || 'M').trim().slice(0, 1).toUpperCase();
        icon.append(initial);
      }
      const copy = document.createElement('div');
      copy.className = 'icepick-mod-copy';
      const title = document.createElement('strong');
      title.textContent = mod.name;
      title.title = mod.name;
      const meta = document.createElement('small');
      meta.textContent = [mod.version ? 'v' + mod.version.replace(/^v/u, '') : '', mod.authors.join(', '), mod.core ? text('核心框架', 'Core framework') : ''].filter(Boolean).join(' · ');
      const description = document.createElement('p');
      description.textContent = mod.description || text('没有说明。', 'No description.');
      copy.append(title, meta, description);
      const actions = document.createElement('div');
      actions.className = 'icepick-mod-actions';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'fold-button compact';
      toggle.dataset.modAction = 'toggle';
      toggle.textContent = mod.enabled ? t('icepick.disable') : t('icepick.enable');
      toggle.disabled = busy || mod.core;
      if (mod.core) toggle.title = text('核心框架保持启用。', 'The core framework stays enabled.');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'fold-button compact fold-danger';
      remove.dataset.modAction = 'remove';
      remove.textContent = t('icepick.remove');
      remove.disabled = busy || mod.core;
      actions.append(toggle, remove);
      card.append(icon, copy, actions);
      list.append(card);
    }
  }

  function render() {
    const status = state?.status || null;
    const found = Boolean(status?.ok);
    const mods = status?.mods || [];
    statusLine(found ? t('icepick.managerState', {path:status.path, count:mods.length}) : text('未检测到 Icepick，请点击“选择 Icepick 目录”。', 'Icepick not found. Use Choose Icepick folder.'));
    $('icepickManagerSelect').disabled = busy;
    $('icepickManagerImport').disabled = busy || !found;
    renderMods(status);
    
  }

  async function refresh() {
    try {
      const result = await ipcRenderer.invoke('icepick-status');
      if (!result?.ok) throw Object.assign(Error(result?.error || 'Icepick status failed'), {code:result?.code});
      state = result;
      render();
    } catch (error) {
      state = {status:{ok:false, found:false, mods:[]}};
      render();
      statusLine(error?.message || String(error), true);
    }
  }

  async function run(channel, payload, success) {
    if (busy) return null;
    setBusy(true);
    try {
      const result = await ipcRenderer.invoke(channel, payload);
      if (result?.status) state = result;
      if (!result?.ok && !result?.canceled) throw Object.assign(Error(result?.error || 'Icepick operation failed'), {code:result?.code});
      if (success) toast(success);
      return result;
    } catch (error) {
      toast(error?.message || String(error), true);
      statusLine(error?.message || String(error), true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  $('icepickManagerSelect').addEventListener('click', async () => { await run('icepick-select', undefined, text('Icepick 目录已保存。', 'Icepick folder saved.')); });
  $('icepickManagerRefresh')?.addEventListener('click',()=>void refresh());
  $('icepickManagerImport')?.addEventListener('click',async()=>{const result=await run('icepick-import',undefined,text('Mod 已导入。','Mod imported.'));if(result?.status)state={status:result.status};await refresh();});
  $('icepickManagerList')?.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-mod-action]'),card=button?.closest?.('[data-mod-id]');if(!button||!card)return;
    const id=card.dataset.modId;
    if(button.dataset.modAction==='toggle')await run('icepick-toggle',id,text('Mod 状态已更新。','Mod state updated.'));
    else if(button.dataset.modAction==='remove'&&window.confirm(text(`删除 Mod“${id}”？`,`Delete mod “${id}”?`)))await run('icepick-remove',id,text('Mod 已删除。','Mod removed.'));
  });
  window.addEventListener('vyra-view-change', event => { if (event.detail?.view === 'mods') void refresh(); });
  window.addEventListener('vyra-language-changed', render);
  window.addEventListener('tfx-settings-persisted', event => {
    if (event.detail?.keys?.some(key => ['gamepath','icepickPath'].includes(key))) void refresh();
  });
  window.addEventListener('vyra-settings-restored', () => void refresh());
  render();
  void refresh();
  window.Icepick = Object.freeze({refresh, get status() { return state?.status ? {...state.status} : null; }, get busy() { return busy; }});
})();
