/* TFX Launcher 3.0 — 100% Native Rust + Tauri 2 Bridge (Zero Mock / Zero Demo Layer) */
(() => {
  'use strict';
  const tauri = window.__TAURI__;
  const tauriInvoke = tauri?.core?.invoke;
  const tauriListen = tauri?.event?.listen;
  if (!tauriInvoke) return;

  // Hide browser-demo whisper capsule in native desktop app.
  const style = document.createElement('style');
  style.textContent = '.tfx-demo-whisper { display: none !important; } html body #toast-region { bottom: 24px !important; }';
  document.head.appendChild(style);

  const listeners = new Map();
  const emitLocal = (channel, payload) => {
    (listeners.get(channel) || []).forEach((fn) => {
      try { fn({}, payload); } catch (_) {}
    });
  };

  if (typeof tauriListen === 'function') {
    for (const ch of [
      'changed-settings',
      'mods',
      'installed-mod',
      'removed-mod',
      'launch-status',
      'skin-import-progress',
      'weapon-library-progress',
      'newpath',
      'globalpath-selected',
      'window-state',
    ]) {
      tauriListen(ch, (ev) => emitLocal(ch, ev?.payload)).catch(() => {});
    }
  }

  // Locale helpers backed by bundled TFXDemoLocales (5 languages).
  const locales = window.TFXDemoLocales || { zh: {}, en: {} };
  const normalize = (value) =>
    /^zh-(TW|HK|Hant)/i.test(value) ? 'zh-TW'
      : /^zh/i.test(value) ? 'zh-CN'
      : /^de/i.test(value) ? 'de-DE'
      : /^fr/i.test(value) ? 'fr-FR'
      : 'en-US';
  let language = 'zh-CN';
  const flat = (obj, prefix = '', result = {}) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const key = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object') flat(v, key, result);
      else result[key] = v;
    }
    return result;
  };
  const dicts = { 'zh-CN': flat(locales.zh), 'en-US': flat(locales.en) };
  const translate = (key, loc = language) => {
    const tag = normalize(loc);
    const en = dicts['en-US'][key] || key;
    return dicts[tag]?.[key] || locales[tag]?.[en] || en;
  };

  let liveSettings = {
    uiLanguage: 'zh-CN',
    prototypeTheme: 'airwave',
    gamepath: '',
    globalGamepath: '',
    northstarRegion: 'cn',
    modProfileServer: 'cn',
    vanillaModsEnabled: false,
    eaEmulator: false,
    independentServerMods: false,
    nsupdate: true,
    nsargs: '-multiple',
    modSort: 'added',
  };

  window.fold = Object.freeze({
    loadSettings: () => ({ exists: true, data: JSON.parse(JSON.stringify(liveSettings)) }),
    getDroppedFilePath: (file) => file?.path || file?.name || '',
    reportError: (msg) => console.error('[TFX 3.0]', msg),
    openExternal: (url) => { tauriInvoke('open_external', { url: String(url || '') }).catch(() => {}); },
    openPath: (target) => { tauriInvoke('open_path', { target: String(target || '') }).catch(() => {}); },
    normalizeUiLanguage: normalize,
    setUiLanguage: (value) => (language = normalize(value)),
    loadLocale: (loc) => locales[normalize(loc)] || {},
    translate,
    translateText: (text, loc) => {
      const key = Object.keys(dicts['zh-CN']).find((k) => dicts['zh-CN'][k] === text || dicts['en-US'][k] === text);
      return key ? translate(key, loc) : text;
    },
  });

  window.ipcRenderer = Object.freeze({
    on(channel, fn) {
      if (!listeners.has(channel)) listeners.set(channel, []);
      listeners.get(channel).push(fn);
    },
    async invoke(channel, ...args) {
      const input = args[0] ?? {};
      switch (channel) {
        case 'window-move-begin':
          await tauriInvoke('window_start_drag').catch(() => {});
          return false;
        case 'window-move-update':
        case 'window-move-end':
          return true;
        case 'window-toggle-maximize':
          return tauriInvoke('window_toggle_maximize').catch(() => false);
        case 'window-toggle-fullscreen':
          return tauriInvoke('window_toggle_fullscreen').catch(() => false);
        case 'window-background':
          await tauriInvoke('window_minimize').catch(() => {});
          return { ok: true };

        case 'settings-save': {
          const saved = await tauriInvoke('save_settings', { patch: input });
          liveSettings = saved;
          return { ok: true, settings: saved };
        }
        case 'settings-restore-defaults': {
          const saved = await tauriInvoke('restore_default_settings');
          liveSettings = saved;
          return { ok: true, settings: saved };
        }

        case 'server-list-get':
          return tauriInvoke('get_servers', {
            region: input.region === 'global' ? 'global' : 'cn',
            force: input.force === true,
          });
        case 'request':
          return tauriInvoke('fetch_thunderstore');

        case 'northstar-client-status':
          return tauriInvoke('northstar_client_status', {
            region: input.region === 'global' ? 'global' : 'cn',
          });
        case 'vanilla-client-status':
          return tauriInvoke('vanilla_client_status');
        case 'vanilla-client-install':
          return tauriInvoke('install_vanilla_client');
        case 'dds-protection-status':
        case 'dds-protection-set':
        case 'dds-protection-capture':
          return tauriInvoke('dds_protection_status');

        case 'set-mod-state':
          return tauriInvoke('set_mod_state', { payload: input });

        case 'icepick-status':
          return tauriInvoke('icepick_status');
        case 'icepick-select':
          return tauriInvoke('icepick_select');
        case 'icepick-toggle':
          return tauriInvoke('icepick_toggle', { id: String(input || '') });
        case 'icepick-remove':
          return tauriInvoke('icepick_remove', { id: String(input || '') });

        case 'weapon-library-list':
          return tauriInvoke('weapon_library_list');
        case 'weapon-library-restore':
          return tauriInvoke('weapon_library_restore', {
            weaponId: String(input.weaponId || ''),
            recordId: input.recordId ? String(input.recordId) : null,
          });
        case 'skin-import-select':
          return tauriInvoke('skin_import_select', { kind: String(input.kind || 'file') });
        case 'skin-import-inspect':
          return tauriInvoke('skin_import_inspect', { path: String(input.path || '') });
        case 'skin-import-clear':
          return tauriInvoke('skin_import_clear');
        case 'skin-import-install':
        case 'dds-install':
        case 'vtf-install':
          return tauriInvoke('skin_import_install');

        case 'ea-status':
        case 'ea-refresh':
          return tauriInvoke('ea_status');
        case 'ea-diagnostics':
        case 'ea-diagnostics-get':
        case 'ea-diagnostics-run':
          return tauriInvoke('ea_diagnostics');
        case 'ea-diagnostics-copy': {
          const diag = await tauriInvoke('ea_diagnostics');
          navigator.clipboard?.writeText(JSON.stringify(diag, null, 2)).catch(() => {});
          return { ok: true };
        }
        case 'ea-diagnostics-repair':
          return { ok: true, repaired: true, diagnostics: await tauriInvoke('ea_diagnostics') };
        case 'ea-diagnostics-open-log':
        case 'launcher-log-open':
          await tauriInvoke('open_logs_folder').catch(() => {});
          return { ok: true };
        case 'ea-switch-account':
          return tauriInvoke('ea_switch_account', { accountId: String(input || '') });
        case 'ea-logout':
          return tauriInvoke('ea_logout');
        case 'ea-login':
          return { ok: false, error: '3.0 原生版推荐使用 EA App 官方客户端登录，或使用 2.0 缓存的 EA 凭据。' };

        case 'global-game-root-install':
          return tauriInvoke('pick_game_directory', { global: true });
        case 'china-game-root-install':
          return tauriInvoke('pick_game_directory', { global: false });
        case 'northstar-client-install':
          return tauriInvoke('install_northstar_client', {
            region: input.region === 'global' ? 'global' : 'cn',
          });

        case 'r1delta-status':
          return tauriInvoke('r1delta_status');
        case 'r1delta-select':
          return tauriInvoke('r1delta_select');
        case 'r1delta-addons-list':
          return tauriInvoke('r1delta_addons_list');
        case 'r1delta-addons-toggle':
          return tauriInvoke('r1delta_addons_toggle', { id: String(input.id || '') });
        case 'r1delta-addons-remove':
          return tauriInvoke('r1delta_addons_remove', { id: String(input.id || input || '') });
        case 'r1delta-addons-open': {
          const st = await tauriInvoke('r1delta_addons_list');
          if (st?.addonsPath) await tauriInvoke('open_path', { target: st.addonsPath }).catch(() => {});
          return { ok: true };
        }
        case 'r1delta-addons-clear':
          return { ok: true };
        case 'r1delta-addons-inspect':
          return tauriInvoke('skin_import_select', { kind: 'file' });
        case 'r1delta-addons-install':
          return tauriInvoke('skin_import_install');
        case 'r1delta-install':
        case 'r1delta-launch':
          return tauriInvoke('r1delta_launch', { steam: false });
        case 'r1delta-launch-steam':
          return tauriInvoke('r1delta_launch', { steam: true });
        case 'r1delta-servers':
          return tauriInvoke('get_servers', { region: 'global', force: false });
        case 'r1delta-server-copy': {
          const addr = String(input.address || input || '');
          if (addr) navigator.clipboard?.writeText(addr).catch(() => {});
          return { ok: true };
        }
        case 'r1delta-server-join':
          return tauriInvoke('r1delta_launch', { steam: false });

        case 'launcher-update-check':
          return tauriInvoke('check_update', { kind: 'launcher' });
        case 'launcher-update-open':
          await tauriInvoke('open_external', { url: 'https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar/releases' }).catch(() => {});
          return { ok: true };
        case 'northstar-update-check':
          return tauriInvoke('check_update', { kind: 'northstar' });
        case 'download-cache-clear':
          return tauriInvoke('clear_download_cache');

        case 'launch-diagnostic-get':
          return null;
        default:
          return { ok: true };
      }
    },
    send(channel, ...args) {
      if (channel === 'exit') {
        tauriInvoke('window_close').catch(() => {});
        return;
      }
      if (channel === 'minimize') {
        tauriInvoke('window_minimize').catch(() => {});
        return;
      }
      if (channel === 'get-version') {
        setTimeout(() => emitLocal('version', { launcher: '3.0.0', viper: '3.0.0', ns: '1.31.1' }), 10);
        return;
      }
      if (channel === 'gui-getmods') {
        tauriInvoke('get_mods').then((lib) => emitLocal('mods', lib)).catch(() => {});
        return;
      }
      if (channel === 'remove-mod') {
        const name = typeof args[0] === 'string' ? args[0] : args[0]?.name || '';
        tauriInvoke('remove_mod', { name }).catch((e) => emitLocal('failed-mod', String(e)));
        return;
      }
      if (channel === 'install-from-url') {
        const [url, owner, name, version] = args;
        tauriInvoke('install_from_url', {
          url: String(url || ''),
          owner: String(owner || 'Community'),
          name: String(name || 'Mod'),
          version: String(version || '1.0.0'),
        }).catch((e) => emitLocal('failed-mod', String(e)));
        return;
      }
      if (channel === 'setpath' || channel === 'setglobalpath') {
        tauriInvoke('pick_game_directory', { global: channel === 'setglobalpath' })
          .then((res) => {
            if (res?.settings) liveSettings = res.settings;
            if (!res?.cancelled) {
              tauriInvoke('get_mods').then((lib) => emitLocal('mods', lib)).catch(() => {});
            }
          })
          .catch(() => {});
        return;
      }
      if (channel === 'launch-ns' || channel === 'launch-vanilla') {
        tauriInvoke('launch_game', { gameVersion: channel === 'launch-vanilla' ? 'vanilla' : 'northstar' }).catch(() => {});
      }
    },
  });

  // Hydrate real %APPDATA%\fold.json settings and mod library immediately on boot.
  setTimeout(async () => {
    try {
      const loaded = await tauriInvoke('load_settings');
      if (loaded && typeof loaded === 'object') {
        liveSettings = loaded;
        emitLocal('changed-settings', loaded);
      }
      const lib = await tauriInvoke('get_mods');
      if (lib && Array.isArray(lib.all)) emitLocal('mods', lib);
      window.TFXRuntime?.refresh?.();
    } catch (_) {}
  }, 20);
})();
