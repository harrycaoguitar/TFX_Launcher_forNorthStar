/* ==========================================================================
   TFX Launcher 2.0 — Fluid Tactile Minimalism Interaction Engine (Final Ed.)
   - Zero keyboard shortcut clutter (pure direct mouse/touch ergonomics)
   - Full 5-locale i18n sync (zh-CN, zh-TW, en-US, de-DE, fr-FR)
   - Living ambient light mesh + Rauno instant-subsequent gliding rail tooltip
   - Liquid Pill Stretch on horizontal segmented controls
   - Family.co-style dynamic fluid container height interpolation
   - Cross-Page Morphing Status Capsule (Launch + Mod/Skin Install progress)
   - View Transitions fingertip radial theme reveal
   - Arsenal Before/After Skin Comparison Scrubber (auto-selects populated demo weapon)
   - Miniature theme preview internal layered depth parallax
   - Click-to-copy path + Amie refresh spin + rolling counters + FLIP mod reorder
   - Soft tactile matte acoustic micro-SFX (Web Audio API, default OFF)
   ========================================================================== */
(() => {
  'use strict';

  const prefersReduced = () =>
    typeof motionReduced === 'function'
      ? motionReduced()
      : window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  // ── 0. Full 5-Locale Dictionary ──────────────────────────────────────────
  const I18N_MAP = {
    'zh-CN': {
      sfxLabel: '轻触音效',
      sfxOn: '轻触音效：已开启',
      sfxOff: '轻触音效：已关闭',
      sfxToastOn: '轻触音效已开启',
      sfxToastOff: '轻触音效已关闭',
      copyPathTip: '点击复制路径',
      copyPathToast: '已复制游戏目录路径',
      noModsRequired: '模组要求：无必需模组',
      allGood: '一切正常',
      demoDiskFree: '128.4 GB 可用',
      skinBefore: '原版涂装',
      skinAfter: '当前涂装',
      skinDragLabel: '拖动对比原版与自定义涂装',
      launching: '正在启动',
      launchDone: '启动完成',
      installing: '正在安装',
      installDone: '安装完成',
      whisperTitle: '体验亮点',
      whisperThemes: '17 套液态换肤',
      whisperArsenal: '涂装对比滑块',
      whisperSfx: '轻触音效',
      whisperClose: '收起提示',
    },
    'zh-TW': {
      sfxLabel: '輕觸音效',
      sfxOn: '輕觸音效：已開啟',
      sfxOff: '輕觸音效：已關閉',
      sfxToastOn: '輕觸音效已開啟',
      sfxToastOff: '輕觸音效已關閉',
      copyPathTip: '點擊複製路徑',
      copyPathToast: '已複製遊戲目錄路徑',
      noModsRequired: '模組需求：無必需模組',
      allGood: '一切正常',
      demoDiskFree: '128.4 GB 可用',
      skinBefore: '原版塗裝',
      skinAfter: '目前塗裝',
      skinDragLabel: '拖曳對比原版與自訂塗裝',
      launching: '正在啟動',
      launchDone: '啟動完成',
      installing: '正在安裝',
      installDone: '安裝完成',
      whisperTitle: '體驗亮點',
      whisperThemes: '17 套液態換膚',
      whisperArsenal: '塗裝對比滑桿',
      whisperSfx: '輕觸音效',
      whisperClose: '收起提示',
    },
    'en-US': {
      sfxLabel: 'Tactile Sound',
      sfxOn: 'Tactile sound: On',
      sfxOff: 'Tactile sound: Off',
      sfxToastOn: 'Tactile sound enabled',
      sfxToastOff: 'Tactile sound muted',
      copyPathTip: 'Click to copy path',
      copyPathToast: 'Game directory path copied',
      noModsRequired: 'Required mods: None',
      allGood: 'All good',
      demoDiskFree: '128.4 GB free',
      skinBefore: 'Original finish',
      skinAfter: 'Custom finish',
      skinDragLabel: 'Drag to compare original and custom finish',
      launching: 'Launching',
      launchDone: 'Launch complete',
      installing: 'Installing',
      installDone: 'Installed',
      whisperTitle: 'Highlights',
      whisperThemes: '17 Fluid Themes',
      whisperArsenal: 'Skin Scrubber',
      whisperSfx: 'Tactile Sound',
      whisperClose: 'Dismiss',
    },
    'de-DE': {
      sfxLabel: 'Klick-Feedback',
      sfxOn: 'Klick-Feedback: Ein',
      sfxOff: 'Klick-Feedback: Aus',
      sfxToastOn: 'Klick-Feedback aktiviert',
      sfxToastOff: 'Klick-Feedback stumm',
      copyPathTip: 'Zum Kopieren klicken',
      copyPathToast: 'Spielpfad kopiert',
      noModsRequired: 'Erforderliche Mods: Keine',
      allGood: 'Alles bereit',
      demoDiskFree: '128.4 GB frei',
      skinBefore: 'Original-Finish',
      skinAfter: 'Custom-Skin',
      skinDragLabel: 'Ziehen zum Vergleichen von Original und Skin',
      launching: 'Wird gestartet',
      launchDone: 'Start abgeschlossen',
      installing: 'Wird installiert',
      installDone: 'Installiert',
      whisperTitle: 'Highlights',
      whisperThemes: '17 Fluid-Themes',
      whisperArsenal: 'Skin-Vergleich',
      whisperSfx: 'Klick-Sound',
      whisperClose: 'Schließen',
    },
    'fr-FR': {
      sfxLabel: 'Son tactile',
      sfxOn: 'Son tactile : Activé',
      sfxOff: 'Son tactile : Désactivé',
      sfxToastOn: 'Son tactile activé',
      sfxToastOff: 'Son tactile coupé',
      copyPathTip: 'Cliquer pour copier',
      copyPathToast: 'Chemin du jeu copié',
      noModsRequired: 'Mods requis : Aucun',
      allGood: 'Tout est prêt',
      demoDiskFree: '128.4 Go libres',
      skinBefore: 'Finition d’origine',
      skinAfter: 'Skin personnalisé',
      skinDragLabel: 'Glisser pour comparer l’original et le skin',
      launching: 'Lancement',
      launchDone: 'Lancement terminé',
      installing: 'Installation',
      installDone: 'Installé',
      whisperTitle: 'Découvrir',
      whisperThemes: '17 Thèmes fluides',
      whisperArsenal: 'Comparateur',
      whisperSfx: 'Son tactile',
      whisperClose: 'Masquer',
    },
  };

  function currentLocaleKey() {
    const lang = (document.documentElement.lang || (typeof state !== 'undefined' && state.language) || 'zh-CN').toLowerCase();
    if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk')) return 'zh-TW';
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('de')) return 'de-DE';
    if (lang.startsWith('fr')) return 'fr-FR';
    return 'en-US';
  }
  const L = (key) => (I18N_MAP[currentLocaleKey()] || I18N_MAP['en-US'])[key] || I18N_MAP['en-US'][key] || key;

  const PAGE_ORDER = ['home', 'servers', 'mods', 'installer', 'account', 'settings'];
  let lastPageId = typeof state !== 'undefined' ? state.page : 'home';

  let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
        lastPointer = { x: e.clientX, y: e.clientY };
      }
    },
    { capture: true, passive: true }
  );

  // ── 1. Living Ambient Mesh ──────────────────────────────────────────────
  function mountAmbientMesh() {
    if (document.querySelector('.tfx-ambient-mesh')) return;
    const mesh = document.createElement('div');
    mesh.className = 'tfx-ambient-mesh';
    mesh.setAttribute('aria-hidden', 'true');
    mesh.innerHTML = '<span></span><span></span>';
    document.body.prepend(mesh);
  }

  // ── 2. Family.co-Style Dynamic Fluid Container Height Interpolation ──────
  const trayHeights = new Map();
  const FLUID_SELECTORS = ['#install-details', '.arsenal-weapons', '.arsenal-records'];

  function snapshotFluidHeights() {
    for (const sel of FLUID_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) trayHeights.set(sel, el.getBoundingClientRect().height);
    }
  }

  function animateFluidHeights(main) {
    if (prefersReduced()) return;
    for (const sel of FLUID_SELECTORS) {
      const el = main.querySelector(sel);
      if (!el) continue;
      const prevH = trayHeights.get(sel);
      const nextH = el.getBoundingClientRect().height;
      trayHeights.set(sel, nextH);
      if (!prevH || Math.abs(nextH - prevH) < 10 || Math.abs(nextH - prevH) > 700) continue;

      el.getAnimations().forEach((a) => {
        if (a.id === 'tfx-fluid-height') a.cancel();
      });
      const prevOverflow = el.style.overflow;
      el.style.overflow = 'hidden';
      const anim = el.animate(
        [{ height: `${prevH.toFixed(1)}px` }, { height: `${nextH.toFixed(1)}px` }],
        { id: 'tfx-fluid-height', duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
      anim.onfinish = anim.oncancel = () => {
        el.style.overflow = prevOverflow;
      };
    }
  }

  // ── 3. Arsenal Before/After Skin Comparison Scrubber ─────────────────────
  const ARSENAL_SILHOUETTE = `<svg viewBox="0 0 420 124" fill="none" aria-hidden="true">
    <path d="M40 58 96 46 124 52 140 32h112l22 15 80 3 10 13 44 3v12l-50 1-12 10-88 2-30 28h-26l6-33-38-1-24 22h-34l-12-24-40 1z" fill="currentColor" opacity="0.22"/>
    <path class="skin-secondary-part" d="M140 32h112l22 15-4 8H132z" opacity="0.82"/>
    <path class="skin-accent-part" d="M244 56l24 3v11l-24 3zM104 65h22v10h-22zM156 58h68v6h-68z" opacity="0.95"/>
    <path d="M40 58 96 46 124 52 140 32h112l22 15 80 3 10 13 44 3v12l-50 1-12 10-88 2-30 28h-26l6-33-38-1-24 22h-34l-12-24-40 1z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" opacity="0.72"/>
    <circle cx="232" cy="64" r="3.5" fill="var(--bg)"/>
  </svg>`;

  let demoArsenalAutoPicked = false;
  function mountArsenalScrubber(main) {
    const records = main.querySelector('.arsenal-records');
    const toolbar = records?.querySelector('.arsenal-toolbar');
    if (!records || !toolbar) return;

    // In Demo mode, if landing on an empty weapon (e.g. R-201) for the first time,
    // smoothly jump to the first weapon that actually has a skin record (R-97 / R99 EDGE).
    if (window.TFXDemoLocales && !demoArsenalAutoPicked) {
      const hasRows = records.querySelector('.arsenal-row');
      if (!hasRows) {
        const firstPopulated = [...main.querySelectorAll('.arsenal-weapon')].find(
          (b) => b.dataset.action !== 'arsenal-weapon-all' && Number(b.querySelector(':scope > small')?.textContent?.trim()) > 0
        );
        if (firstPopulated) {
          demoArsenalAutoPicked = true;
          firstPopulated.click();
          return;
        }
      } else {
        demoArsenalAutoPicked = true;
      }
    }

    const currentRecord =
      records.querySelector('.arsenal-row[data-record-state="current"] strong')?.textContent?.trim() ||
      records.querySelector('.arsenal-row strong')?.textContent?.trim() ||
      '';
    const afterLabel = currentRecord ? `${L('skinAfter')} · ${currentRecord}` : L('skinAfter');

    let card = records.querySelector('.tfx-skin-compare');
    if (card) {
      const leftTag = card.querySelector('.tfx-skin-tag.left');
      const rightTag = card.querySelector('.tfx-skin-tag.right');
      if (leftTag) leftTag.textContent = L('skinBefore');
      if (rightTag) rightTag.textContent = afterLabel;
      return;
    }

    card = document.createElement('div');
    card.className = 'tfx-skin-compare';
    card.setAttribute('role', 'slider');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', L('skinDragLabel'));
    card.setAttribute('aria-valuemin', '10');
    card.setAttribute('aria-valuemax', '90');
    card.setAttribute('aria-valuenow', '52');
    card.innerHTML = `
      <div class="tfx-skin-layer is-before">${ARSENAL_SILHOUETTE}</div>
      <div class="tfx-skin-layer is-after">${ARSENAL_SILHOUETTE}</div>
      <span class="tfx-skin-tag left">${L('skinBefore')}</span>
      <span class="tfx-skin-tag right">${afterLabel}</span>
      <span class="tfx-skin-divider" aria-hidden="true"></span>
      <span class="tfx-skin-handle" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/></svg></span>
    `;

    let pct = 52;
    const setPct = (next) => {
      pct = Math.max(10, Math.min(90, Math.round(next)));
      card.style.setProperty('--split', `${pct}%`);
      card.setAttribute('aria-valuenow', String(pct));
    };
    const updateFromClientX = (clientX) => {
      const r = card.getBoundingClientRect();
      if (!r.width) return;
      setPct(((clientX - r.left) / r.width) * 100);
    };

    card.addEventListener('pointerdown', (e) => {
      card.setPointerCapture?.(e.pointerId);
      card.classList.add('is-dragging');
      updateFromClientX(e.clientX);
      playTouch('tap');
    });
    card.addEventListener('pointermove', (e) => {
      if (!card.classList.contains('is-dragging')) return;
      updateFromClientX(e.clientX);
    });
    const endDrag = () => card.classList.remove('is-dragging');
    card.addEventListener('pointerup', endDrag);
    card.addEventListener('pointercancel', endDrag);

    toolbar.insertAdjacentElement('afterend', card);
  }

  // ── 4. Liquid Pill Stretch for Horizontal Segmented Controls ─────────────
  const baseAnimateSpring = window.animateSpringIndicator;
  if (typeof baseAnimateSpring === 'function') {
    window.animateSpringIndicator = function liquidSpringIndicator(indicator) {
      const spring = indicator?._spring;
      if (!spring || prefersReduced() || !indicator.classList.contains('hover-track-indicator')) {
        return baseAnimateSpring(indicator);
      }
      const targetKey = [spring.targetX, spring.targetY, spring.targetWidth, spring.targetHeight].join('|');
      if (indicator._motionTarget === targetKey && indicator._motion?.playState === 'running') return;
      indicator._motionTarget = targetKey;

      const matrix = new DOMMatrixReadOnly(getComputedStyle(indicator).transform);
      const width = parseFloat(indicator.style.width) || spring.width || spring.targetWidth || 1;
      const height = parseFloat(indicator.style.height) || spring.height || spring.targetHeight || 1;
      const from = { x: matrix.m41, y: matrix.m42, width: width * matrix.m11, height: height * matrix.m22 };
      const dx = spring.targetX - from.x;
      const dy = spring.targetY - from.y;
      const horiz = Math.abs(dx) > 22 && Math.abs(dy) < 16;

      if (!horiz) return baseAnimateSpring(indicator);

      indicator._motion?.cancel();
      const steps = 36;
      const frames = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const t = u * 0.42;
        const p = i === steps ? 1 : 1 - Math.exp(-15 * t) * (Math.cos(14 * t) + (15 / 14) * Math.sin(14 * t));
        const x = from.x + dx * p;
        const y = from.y + dy * p;
        const w = from.width + (spring.targetWidth - from.width) * p;
        const h = from.height + (spring.targetHeight - from.height) * p;
        const bell = Math.sin(Math.min(1, u * 1.35) * Math.PI);
        const stretch = 1 + 0.13 * Math.max(0, bell);
        const sx = (w / width) * stretch;
        const sy = (h / height) / Math.sqrt(stretch);
        const offsetX = (w * (1 - stretch)) / 2;
        const offsetY = (h * (1 - 1 / Math.sqrt(stretch))) / 2;
        frames.push({
          transform: `translate3d(${(x + offsetX).toFixed(2)}px, ${(y + offsetY).toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
        });
      }
      indicator.style.transform = frames[frames.length - 1].transform;
      spring.x = spring.targetX;
      spring.y = spring.targetY;
      spring.width = spring.targetWidth;
      spring.height = spring.targetHeight;
      spring.frame = 0;

      const motion = (indicator._motion = indicator.animate(frames, { duration: 420, easing: 'linear' }));
      motion.onfinish = () => {
        if (indicator._motion !== motion) return;
        indicator.style.width = `${spring.targetWidth}px`;
        indicator.style.height = `${spring.targetHeight}px`;
        indicator.style.transform = `translate3d(${spring.targetX}px, ${spring.targetY}px, 0)`;
        indicator._motion = null;
      };
    };
  }

  // ── 5. Cross-Page Morphing Status Capsule (Launch + Mod/Skin Install) ────
  let liveCapsule = null;
  let capsuleHideTimer = 0;

  function ensureLiveCapsule() {
    if (liveCapsule) return liveCapsule;
    liveCapsule = document.createElement('div');
    liveCapsule.className = 'tfx-live-capsule';
    liveCapsule.setAttribute('role', 'status');
    liveCapsule.setAttribute('aria-live', 'polite');
    liveCapsule.innerHTML = `
      <span class="tfx-live-ring" aria-hidden="true">
        <svg viewBox="0 0 20 20">
          <circle class="ring-track" cx="10" cy="10" r="7.5"/>
          <circle class="ring-fill" cx="10" cy="10" r="7.5" stroke-dasharray="47.12" stroke-dashoffset="47.12"/>
          <path class="ring-check" d="M6.4 10.2 8.9 12.7 13.8 7.6"/>
        </svg>
      </span>
      <span class="tfx-live-capsule-text"></span>
      <span class="tfx-live-capsule-pct"></span>
    `;
    document.body.append(liveCapsule);
    return liveCapsule;
  }

  function updateLiveCapsule(visible, text, pct, done = false) {
    const cap = ensureLiveCapsule();
    clearTimeout(capsuleHideTimer);
    if (!visible) {
      cap.classList.remove('is-visible', 'is-done', 'is-indeterminate');
      return;
    }
    const indeterminate = !done && !Number.isFinite(pct);
    cap.querySelector('.tfx-live-capsule-text').textContent = text;
    cap.querySelector('.tfx-live-capsule-pct').textContent = done || indeterminate ? '' : `${pct}%`;
    const circ = 47.12;
    const fill = cap.querySelector('.ring-fill');
    if (done) {
      fill.style.strokeDashoffset = '0';
    } else if (indeterminate) {
      fill.style.strokeDashoffset = '33';
    } else {
      const offset = circ * (1 - Math.max(0.06, Math.min(1, pct / 100)));
      fill.style.strokeDashoffset = String(offset.toFixed(2));
    }
    cap.classList.toggle('is-indeterminate', indeterminate);
    cap.classList.toggle('is-done', done);
    cap.classList.add('is-visible');
    if (done) {
      capsuleHideTimer = window.setTimeout(() => cap.classList.remove('is-visible', 'is-done', 'is-indeterminate'), 2200);
    }
  }

  const LAUNCH_PHASE_LABELS = {
    'zh-CN': { check: '正在检查环境', 'prepare-ea': '正在准备 EA 连接', 'wait-ea': '等待 EA 响应', 'retry-ea': '正在重试 EA 连接', 'wait-game': '正在拉起游戏', spawned: '游戏窗口已启动', confirmed: '游戏已启动' },
    'zh-TW': { check: '正在檢查環境', 'prepare-ea': '正在準備 EA 連線', 'wait-ea': '等待 EA 回應', 'retry-ea': '正在重試 EA 連線', 'wait-game': '正在啟動遊戲', spawned: '遊戲視窗已啟動', confirmed: '遊戲已啟動' },
    'en-US': { check: 'Checking environment', 'prepare-ea': 'Preparing EA', 'wait-ea': 'Waiting for EA', 'retry-ea': 'Retrying EA', 'wait-game': 'Starting game', spawned: 'Game window opened', confirmed: 'Game launched' },
    'de-DE': { check: 'Umgebung prüfen', 'prepare-ea': 'EA vorbereiten', 'wait-ea': 'Warten auf EA', 'retry-ea': 'EA erneut verbinden', 'wait-game': 'Spiel wird gestartet', spawned: 'Spielfenster geöffnet', confirmed: 'Spiel gestartet' },
    'fr-FR': { check: 'Vérification', 'prepare-ea': 'Préparation EA', 'wait-ea': 'Attente EA', 'retry-ea': 'Nouvelle tentative EA', 'wait-game': 'Lancement du jeu', spawned: 'Fenêtre ouverte', confirmed: 'Jeu lancé' },
  };
  const launchPhaseLabel = (phase) => (LAUNCH_PHASE_LABELS[currentLocaleKey()] || LAUNCH_PHASE_LABELS['en-US'])[phase] || L('launching');

  let ipcLaunchActive = false;
  if (window.ipcRenderer?.on) {
    window.ipcRenderer.on('launch-status', (_ev, payload) => {
      if (!payload) return;
      if (payload.state === 'starting') {
        ipcLaunchActive = true;
        if (payload.phase === 'spawned') {
          updateLiveCapsule(true, launchPhaseLabel('spawned'), 100, true);
          ipcLaunchActive = false;
        } else {
          updateLiveCapsule(true, launchPhaseLabel(payload.phase || 'check'), null, false);
        }
      } else if (payload.state === 'confirmed') {
        ipcLaunchActive = false;
        updateLiveCapsule(true, launchPhaseLabel('confirmed'), 100, true);
      } else if (payload.state === 'failed') {
        ipcLaunchActive = false;
        updateLiveCapsule(false);
      }
    });
    window.ipcRenderer.on('skin-import-progress', (_ev, payload) => {
      if (!payload) return;
      const pct = Number.isFinite(payload.percent) ? payload.percent : 25;
      const name = payload.sourceName ? ` · ${payload.sourceName}` : '';
      if (payload.phase === 'complete' || pct >= 100) {
        updateLiveCapsule(true, `${L('installDone')}${name}`, 100, true);
      } else {
        updateLiveCapsule(true, `${L('installing')}${name}`, pct, false);
      }
    });
  }

  let capsuleWasBusy = false;
  function syncLaunchCapsule() {
    if (ipcLaunchActive) return;
    const isBusy = typeof state !== 'undefined' && state.busy === true;
    const stage = document.querySelector('.play-stage');
    const stepText = document.getElementById('launch-progress-step')?.textContent?.trim() || (typeof state !== 'undefined' && state.launchStep) || launchPhaseLabel('check');
    const pctRaw = document.getElementById('launch-progress-number')?.textContent?.trim() || '';
    const pctNum = parseInt(pctRaw, 10);
    const hasRealPct = Number.isFinite(pctNum) && pctNum > 0;

    if (isBusy || stage?.classList.contains('is-launching')) {
      capsuleWasBusy = true;
      updateLiveCapsule(true, stepText, hasRealPct ? pctNum : null, false);
    } else if (capsuleWasBusy) {
      capsuleWasBusy = false;
      updateLiveCapsule(true, stepText && stepText !== '等待启动' ? stepText : launchPhaseLabel('confirmed'), 100, true);
    }
  }

  // ── 6. Soft Matte/Wood Tactile Micro-SFX (Default OFF) ───────────────────
  const SFX_KEY = 'tfx.microSfx';
  let sfxEnabled = false;
  try { sfxEnabled = localStorage.getItem(SFX_KEY) === '1'; } catch {}
  let audioCtx = null;

  function ensureAudio() {
    if (!sfxEnabled) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playTouch(kind = 'tap', positive = true) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(kind === 'theme' ? 900 : 1400, now);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    if (kind === 'toggle') {
      osc.frequency.setValueAtTime(positive ? 340 : 410, now);
      osc.frequency.exponentialRampToValueAtTime(positive ? 560 : 250, now + 0.032);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
      osc.start(now); osc.stop(now + 0.04);
    } else if (kind === 'nav') {
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.022);
      gain.gain.setValueAtTime(0.032, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
      osc.start(now); osc.stop(now + 0.028);
    } else if (kind === 'theme') {
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.065);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      osc.start(now); osc.stop(now + 0.08);
    } else if (kind === 'launch') {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.14);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.start(now); osc.stop(now + 0.17);
    } else {
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.016);
      gain.gain.setValueAtTime(0.024, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.019);
      osc.start(now); osc.stop(now + 0.02);
    }
  }

  // ── 7. View Transitions Fingertip Radial Theme Reveal ────────────────────
  function applyThemeWithReveal(themeId, origin = lastPointer, commitFn = null) {
    const commit = () => {
      if (commitFn) commitFn();
      else {
        document.documentElement.dataset.theme = themeId;
        if (typeof state !== 'undefined') state.theme = themeId;
        if (typeof syncThemeVariables === 'function') syncThemeVariables();
      }
    };

    if (prefersReduced() || typeof document.startViewTransition !== 'function') {
      commit();
      playTouch('theme');
      return;
    }

    const x = Math.max(0, Math.min(window.innerWidth, origin?.x ?? window.innerWidth / 2));
    const y = Math.max(0, Math.min(window.innerHeight, origin?.y ?? window.innerHeight / 2));
    const maxRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const root = document.documentElement;
    root.style.setProperty('--vt-x', `${x.toFixed(1)}px`);
    root.style.setProperty('--vt-y', `${y.toFixed(1)}px`);
    root.style.setProperty('--vt-r', `${Math.ceil(maxRadius)}px`);
    root.classList.add('tfx-vt-active');

    playTouch('theme');
    try {
      const transition = document.startViewTransition(() => commit());
      transition.finished.finally(() => root.classList.remove('tfx-vt-active'));
    } catch {
      root.classList.remove('tfx-vt-active');
      commit();
    }
  }

  document.addEventListener(
    'click',
    (e) => {
      const themeBtn = e.target?.closest?.('.theme-choice[data-action^="theme-"]');
      if (!themeBtn || prefersReduced() || typeof document.startViewTransition !== 'function') return;
      const themeId = themeBtn.dataset.action.slice(6);
      if (!themeId || document.documentElement.dataset.theme === themeId) return;

      e.stopImmediatePropagation();
      e.preventDefault();
      const origin = { x: e.clientX || lastPointer.x, y: e.clientY || lastPointer.y };
      applyThemeWithReveal(themeId, origin, () => {
        if (typeof perform === 'function') perform(themeBtn.dataset.action);
        else {
          document.documentElement.dataset.theme = themeId;
          if (typeof syncThemeVariables === 'function') syncThemeVariables();
        }
      });
    },
    true
  );

  // ── 8. Topbar Soft Touch Audio Toggle & Demo-Only Judge Whisper Capsule ──
  function soundSvg(on) {
    return on
      ? '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.8a9 9 0 0 1 0 12.4"/></svg>'
      : '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m21 9-6 6M15 9l6 6"/></svg>';
  }

  function syncTopbarI18n() {
    const sfxBtn = document.querySelector('.tfx-sfx-toggle');
    if (sfxBtn) {
      sfxBtn.setAttribute('aria-label', L('sfxLabel'));
      sfxBtn.title = sfxEnabled ? L('sfxOn') : L('sfxOff');
    }
    const whisper = document.querySelector('.tfx-demo-whisper');
    if (whisper) {
      whisper.setAttribute('aria-label', L('whisperTitle'));
      const span = whisper.querySelector(':scope > span');
      if (span) span.textContent = L('whisperTitle');
      const bThemes = whisper.querySelector('[data-whisper="themes"]');
      const bArsenal = whisper.querySelector('[data-whisper="arsenal"]');
      const bSfx = whisper.querySelector('[data-whisper="sfx"]');
      const bClose = whisper.querySelector('[data-whisper="close"]');
      if (bThemes) bThemes.textContent = L('whisperThemes');
      if (bArsenal) bArsenal.textContent = L('whisperArsenal');
      if (bSfx) bSfx.textContent = L('whisperSfx');
      if (bClose) bClose.setAttribute('aria-label', L('whisperClose'));
    }
  }

  function mountTopbarUtilities() {
    const actions = document.querySelector('.top-actions');
    if (!actions) return;
    if (actions.querySelector('.tfx-sfx-toggle')) {
      syncTopbarI18n();
      return;
    }

    const sfxBtn = document.createElement('button');
    sfxBtn.type = 'button';
    sfxBtn.className = 'tfx-sfx-toggle';
    sfxBtn.setAttribute('aria-pressed', String(sfxEnabled));
    sfxBtn.innerHTML = soundSvg(sfxEnabled);
    sfxBtn.addEventListener('click', () => {
      sfxEnabled = !sfxEnabled;
      try { localStorage.setItem(SFX_KEY, sfxEnabled ? '1' : '0'); } catch {}
      sfxBtn.setAttribute('aria-pressed', String(sfxEnabled));
      sfxBtn.innerHTML = soundSvg(sfxEnabled);
      syncTopbarI18n();
      if (sfxEnabled) playTouch('toggle', true);
      if (typeof toast === 'function') toast(sfxEnabled ? L('sfxToastOn') : L('sfxToastOff'));
    });

    actions.prepend(sfxBtn);
    syncTopbarI18n();
  }

  function mountDemoWhisper() {
    if (!window.TFXDemoLocales || document.querySelector('.tfx-demo-whisper')) return;
    try { if (sessionStorage.getItem('tfx.whisperDismissed') === '1') return; } catch {}

    const bar = document.createElement('div');
    bar.className = 'tfx-demo-whisper';
    bar.setAttribute('aria-label', L('whisperTitle'));
    bar.innerHTML = `
      <span>${L('whisperTitle')}</span>
      <button type="button" data-whisper="themes">${L('whisperThemes')}</button>
      <button type="button" data-whisper="arsenal">${L('whisperArsenal')}</button>
      <button type="button" data-whisper="sfx">${L('whisperSfx')}</button>
      <button type="button" class="tfx-whisper-close" data-whisper="close" aria-label="${L('whisperClose')}">×</button>
    `;
    bar.addEventListener('click', (e) => {
      const act = e.target.closest('[data-whisper]')?.dataset.whisper;
      if (!act) return;
      if (act === 'themes') document.querySelector('.rail [data-page="settings"]')?.click();
      if (act === 'arsenal') {
        if (typeof state !== 'undefined') state.modTab = 'arsenal';
        document.querySelector('.rail [data-page="mods"]')?.click();
        window.setTimeout(() => document.querySelector('[data-action="modtab-arsenal"]')?.click(), 60);
      }
      if (act === 'sfx') document.querySelector('.tfx-sfx-toggle')?.click();
      if (act === 'close') {
        try { sessionStorage.setItem('tfx.whisperDismissed', '1'); } catch {}
        bar.remove();
      }
    });
    document.body.append(bar);
  }

  // ── 9. Directional Page Transitions & Deterministic Rail Indicator ───────
  function measureOffsetInRail(rail, item) {
    let x = 0, y = 0, el = item, guard = 0;
    while (el && el !== rail && guard++ < 8) {
      x += el.offsetLeft || 0;
      y += el.offsetTop || 0;
      el = el.offsetParent;
    }
    if (el !== rail) {
      const rb = rail.getBoundingClientRect();
      const ib = item.getBoundingClientRect();
      x = ib.left - rb.left - rail.clientLeft;
      y = ib.top - rb.top - rail.clientTop;
    }
    const w = item.offsetWidth || 50;
    const h = item.offsetHeight || 50;
    x = Math.max(0, Math.min(x, Math.max(0, rail.clientWidth - w)));
    y = Math.max(0, Math.min(y, Math.max(0, rail.clientHeight - h)));
    return { x, y, w, h };
  }

  window.updateNavIndicator = function deterministicNavIndicator(rail, selector, immediate = false) {
    if (!rail) return;
    const active = rail.querySelector(`${selector}.active`);
    if (!active) return;

    const nextPage = active.dataset.page;
    const main = document.getElementById('main');
    if (nextPage && nextPage !== lastPageId && main) {
      const fromIdx = PAGE_ORDER.indexOf(lastPageId);
      const toIdx = PAGE_ORDER.indexOf(nextPage);
      main.dataset.navDir = toIdx < fromIdx ? 'up' : 'down';
      lastPageId = nextPage;
    }

    let indicator = rail.querySelector(':scope > .nav-active-indicator');
    rail.querySelectorAll(':scope > .nav-track > .nav-active-indicator').forEach((el) => el.remove());
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'nav-active-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.dataset.ready = '0';
      rail.prepend(indicator);
    }

    indicator.getAnimations?.().forEach((a) => a.cancel());
    if (indicator._motion) {
      indicator._motion.cancel();
      indicator._motion = null;
    }
    if (indicator._spring?.frame) {
      clearTimeout(indicator._spring.frame);
      indicator._spring.frame = 0;
    }

    const snap = immediate || indicator.dataset.ready !== '1' || prefersReduced();
    const { x, y, w, h } = measureOffsetInRail(rail, active);
    if (snap) indicator.classList.add('is-snapping');
    indicator.style.width = `${w}px`;
    indicator.style.height = `${h}px`;
    indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    indicator.dataset.ready = '1';
    indicator.style.opacity = '1';
    if (snap) {
      void indicator.offsetWidth;
      requestAnimationFrame(() => indicator.classList.remove('is-snapping'));
    }
  };

  // ── 10. Pixel-Accurate Server Marker & Translucent Ping Capsule ──────────
  const DEMO_PINGS = [18, 26, 42, 94];
  function polishServerDOM(root) {
    if (!root) return;
    const modDetail = root.querySelector('.server-row-detail');
    if (modDetail && /^\s*(模组要求|模組需求|Required mods|Erforderliche Mods|Mods requis)[：:]\s*$/i.test(modDetail.textContent || '')) {
      modDetail.textContent = L('noModsRequired');
    }
    const isDemo = Boolean(window.TFXDemoLocales);
    let selectedDemoPing = null;
    root.querySelectorAll('tbody tr[data-server]').forEach((tr, idx) => {
      const cell = tr.querySelector('td:nth-child(4)');
      if (!cell) return;
      const existing = cell.querySelector('.tfx-ping-pill');
      let rawText = (existing ? existing.textContent : cell.textContent || '').trim();
      let num = parseInt(rawText, 10);
      if (isDemo && !Number.isFinite(num)) {
        num = DEMO_PINGS[idx % DEMO_PINGS.length];
        rawText = `${num} ms`;
      }
      if (tr.classList.contains('selected') && Number.isFinite(num)) {
        selectedDemoPing = num;
      }
      if (!existing || existing.textContent.trim() !== rawText) {
        const cls = Number.isFinite(num) ? (num < 60 ? 'is-good' : 'is-mid') : '';
        cell.innerHTML = `<span class="tfx-ping-pill ${cls}">${rawText}</span>`;
      }
    });
    if (isDemo && selectedDemoPing !== null) {
      const detailDd = root.querySelectorAll('.server-detail .detail-grid dd')[1];
      if (detailDd && /—/.test(detailDd.textContent || '')) {
        detailDd.textContent = `${selectedDemoPing} ms`;
      }
    }
  }

  window.positionServerMarker = function fixedPositionServerMarker(root, delta = 0) {
    polishServerDOM(root);
    const holder = root?.querySelector('.table-scroll');
    const row = root?.querySelector('tbody tr.selected');
    if (!holder) return;
    let marker = holder.querySelector('.server-selection-marker');
    if (!row) {
      marker?.remove();
      return;
    }
    if (!marker) {
      marker = document.createElement('span');
      marker.className = 'server-selection-marker';
      marker.setAttribute('aria-hidden', 'true');
      holder.append(marker);
    }

    requestAnimationFrame(() => {
      if (!row.isConnected || !holder.isConnected) return;
      const box = holder.getBoundingClientRect();
      const target = row.getBoundingClientRect();
      const y = target.top - box.top + holder.scrollTop;
      const h = target.height;
      const to = `translate3d(0px, ${y.toFixed(1)}px, 0)`;

      marker.getAnimations().forEach((a) => a.cancel());
      marker.style.height = `${h.toFixed(1)}px`;
      marker.style.transform = to;

      if (delta && !prefersReduced()) {
        marker.animate(
          [
            { transform: `translate3d(0px, ${(y + delta).toFixed(1)}px, 0)` },
            { transform: to },
          ],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' }
        );
      }
    });
  };

  // ── 11. Rolling Numerals & FLIP Mod Reorder ──────────────────────────────
  const prevCounts = new Map();
  function rollIfChanged(el, key) {
    if (!el || prefersReduced()) return;
    const text = (el.textContent || '').trim();
    const match = text.match(/^(\d+)(.*)$/);
    if (!match) return;
    const num = Number(match[1]);
    const prev = prevCounts.get(key);
    prevCounts.set(key, num);
    if (prev === undefined || prev === num) return;

    const dir = num > prev ? 'tfx-roll-up' : 'tfx-roll-down';
    el.innerHTML = `<span class="tfx-roll-num"><span class="${dir}">${match[1]}</span></span>${match[2] || ''}`;
  }

  let modPositions = new Map();
  function captureModPositions() {
    const list = document.querySelectorAll('#mod-results .mod-row[data-mod]');
    if (!list.length) return;
    const next = new Map();
    list.forEach((row) => next.set(row.dataset.mod, row.getBoundingClientRect().top));
    modPositions = next;
  }

  function playModFLIP(main) {
    if (prefersReduced() || !modPositions.size) return;
    const rows = main.querySelectorAll('#mod-results .mod-row[data-mod]');
    if (!rows.length) return;
    rows.forEach((row) => {
      const oldTop = modPositions.get(row.dataset.mod);
      if (oldTop === undefined) return;
      const newTop = row.getBoundingClientRect().top;
      const dy = oldTop - newTop;
      if (Math.abs(dy) > 2 && Math.abs(dy) < 600) {
        row.animate(
          [{ transform: `translate3d(0, ${dy.toFixed(1)}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
          { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' }
        );
      }
    });
    captureModPositions();
  }

  document.addEventListener('pointerdown', (e) => {
    if (e.target?.closest?.('.sort-menu, .scope-choice, button.toggle')) captureModPositions();
    if (e.target?.closest?.('.arsenal-expand, .arsenal-weapon, .demo-file, .format-tabs')) snapshotFluidHeights();
  }, { capture: true, passive: true });
  document.addEventListener('input', (e) => {
    if (e.target?.id === 'mod-search') captureModPositions();
  }, { capture: true, passive: true });

  // ── 12. DOM Enhancement Pass on Every View Render ────────────────────────
  let lastTitleText = '';
  let lastServerId = null;
  let lastArsenalWeapon = '';
  let lastReceiptKey = '';

  function enhanceRenderedDOM() {
    mountAmbientMesh();
    mountTopbarUtilities();
    mountDemoWhisper();
    syncTopbarI18n();
    syncLaunchCapsule();

    const main = document.getElementById('main');
    if (!main) return;

    main
      .querySelectorAll('.catalog-card, .theme-choice, .dropzone')
      .forEach((el) => el.classList.add('tfx-sheen'));
    main
      .querySelectorAll('.launch-button, .btn.primary')
      .forEach((el) => el.classList.add('tfx-magnetic'));
    document.querySelector('.rail .brand')?.classList.add('tfx-magnetic');
    main
      .querySelectorAll('.theme-choice, .catalog-card')
      .forEach((el) => el.classList.add('tfx-tilt'));

    const pathEl = main.querySelector('.home-path .path');
    if (pathEl) pathEl.title = L('copyPathTip');

    if (window.TFXDemoLocales) {
      main.querySelectorAll('.home-bottom .health-row').forEach((row) => {
        const val = row.querySelector(':scope > span:last-child');
        if (val && val.textContent.trim() === '—') val.textContent = L('demoDiskFree');
      });
    }
    main.querySelectorAll('.home-bottom .badge.green').forEach((b) => {
      if (b.textContent.trim() === '一切正常' && currentLocaleKey() !== 'zh-CN' && currentLocaleKey() !== 'zh-TW') {
        b.textContent = L('allGood');
      }
    });

    const installH2 = main.querySelector('#install-details .panel-header h2');
    if (installH2 && !installH2.querySelector('.section-index')) {
      installH2.insertAdjacentHTML('afterbegin', '<span class="section-index" aria-hidden="true">02</span>');
    }

    const displayTitle = main.querySelector('.launch-display');
    if (displayTitle) {
      const txt = displayTitle.textContent || '';
      if (lastTitleText && txt !== lastTitleText && !prefersReduced()) {
        displayTitle.classList.remove('tfx-title-enter');
        void displayTitle.offsetWidth;
        displayTitle.classList.add('tfx-title-enter');
      }
      lastTitleText = txt;
    }

    main.querySelectorAll('.collection-summary strong').forEach((el, i) => rollIfChanged(el, `mods-kpi-${i}`));
    const homeCount = main.querySelector('.home-bottom .count-label');
    if (homeCount) rollIfChanged(homeCount, 'home-mod-count');

    playModFLIP(main);
    mountArsenalScrubber(main);

    const activeWeapon = main.querySelector('.arsenal-weapon.active')?.dataset.action || '';
    const arsenalRecords = main.querySelector('.arsenal-records');
    if (arsenalRecords && activeWeapon && activeWeapon !== lastArsenalWeapon) {
      lastArsenalWeapon = activeWeapon;
      arsenalRecords.classList.remove('tfx-arsenal-arrive');
      void arsenalRecords.offsetWidth;
      arsenalRecords.classList.add('tfx-arsenal-arrive');
    }

    const serverRoot = main.querySelector('#server-results');
    if (serverRoot) {
      polishServerDOM(serverRoot);
      const selectedRow = serverRoot.querySelector('tbody tr.selected');
      const detail = serverRoot.querySelector('.server-detail');
      if (selectedRow && detail) {
        const sid = selectedRow.dataset.server;
        if (sid && sid !== lastServerId) {
          lastServerId = sid;
          detail.classList.remove('tfx-detail-arrive');
          void detail.offsetWidth;
          detail.classList.add('tfx-detail-arrive');
        }
      }
    }

    const details = main.querySelector('#install-details');
    const receipt = details?.querySelector('.file-receipt p')?.textContent || '';
    if (details && receipt && receipt !== lastReceiptKey) {
      lastReceiptKey = receipt;
      details.classList.remove('tfx-receipt-arrive');
      void details.offsetWidth;
      details.classList.add('tfx-receipt-arrive');
    } else if (!receipt) {
      lastReceiptKey = '';
    }

    animateFluidHeights(main);
    applyActiveSpins(main);
  }

  let enhanceQueued = false;
  const mainEl = document.getElementById('main');
  if (mainEl && window.MutationObserver) {
    const observer = new MutationObserver(() => {
      if (enhanceQueued) return;
      enhanceQueued = true;
      requestAnimationFrame(() => {
        enhanceQueued = false;
        enhanceRenderedDOM();
        const rail = document.querySelector('.rail');
        if (rail) window.updateNavIndicator(rail, '[data-page]', false);
        const serverRoot = document.getElementById('server-results');
        if (serverRoot) window.positionServerMarker(serverRoot);
      });
    });
    observer.observe(mainEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-busy'] });
  }

  if (window.MutationObserver) {
    new MutationObserver(() => syncTopbarI18n()).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
  }

  // ── 13. Delegated Pointer Interactions (Sheen, Magnetic, Layered 3D Tilt) ─
  let activeMagnetic = null;
  let activeTilt = null;
  let activeDropzone = null;

  function resetMagnetic(el) {
    if (!el) return;
    el.style.setProperty('--mag-x', '0px');
    el.style.setProperty('--mag-y', '0px');
  }
  function resetTilt(el) {
    if (!el) return;
    el.classList.remove('is-tilting');
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
  }
  function resetDropzone(el) {
    if (!el) return;
    el.style.setProperty('--drop-x', '0px');
    el.style.setProperty('--drop-y', '0px');
  }

  document.addEventListener(
    'pointermove',
    (e) => {
      const sheen = e.target?.closest?.('.tfx-sheen');
      if (sheen) {
        const rect = sheen.getBoundingClientRect();
        sheen.style.setProperty('--spot-x', `${(e.clientX - rect.left).toFixed(1)}px`);
        sheen.style.setProperty('--spot-y', `${(e.clientY - rect.top).toFixed(1)}px`);
      }

      if (prefersReduced()) return;

      const mag = e.target?.closest?.('.tfx-magnetic');
      if (activeMagnetic && activeMagnetic !== mag) resetMagnetic(activeMagnetic);
      activeMagnetic = mag || null;
      if (mag && !mag.disabled) {
        const rect = mag.getBoundingClientRect();
        const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        const strength = mag.classList.contains('launch-button') ? 4.5 : 3;
        mag.style.setProperty('--mag-x', `${(nx * strength).toFixed(2)}px`);
        mag.style.setProperty('--mag-y', `${(ny * strength).toFixed(2)}px`);
      }

      const tilt = e.target?.closest?.('.tfx-tilt');
      if (activeTilt && activeTilt !== tilt) resetTilt(activeTilt);
      activeTilt = tilt || null;
      if (tilt) {
        const rect = tilt.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        const maxDeg = tilt.classList.contains('catalog-card') ? 3.5 : 4.2;
        tilt.classList.add('is-tilting');
        tilt.style.setProperty('--tilt-x', `${(-py * maxDeg * 2).toFixed(2)}deg`);
        tilt.style.setProperty('--tilt-y', `${(px * maxDeg * 2).toFixed(2)}deg`);
        tilt.style.setProperty('--px', px.toFixed(3));
        tilt.style.setProperty('--py', py.toFixed(3));
      }

      const dz = e.target?.closest?.('.dropzone');
      if (activeDropzone && activeDropzone !== dz) resetDropzone(activeDropzone);
      activeDropzone = dz || null;
      if (dz) {
        const rect = dz.getBoundingClientRect();
        const dx = ((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 7;
        const dy = ((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 6;
        dz.style.setProperty('--drop-x', `${dx.toFixed(1)}px`);
        dz.style.setProperty('--drop-y', `${dy.toFixed(1)}px`);
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'dragover',
    (e) => {
      const dz = e.target?.closest?.('.dropzone');
      if (!dz || prefersReduced()) return;
      const rect = dz.getBoundingClientRect();
      const dx = ((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 9;
      const dy = ((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 8;
      dz.style.setProperty('--drop-x', `${dx.toFixed(1)}px`);
      dz.style.setProperty('--drop-y', `${dy.toFixed(1)}px`);
    },
    { passive: true }
  );

  document.addEventListener(
    'pointerleave',
    () => {
      resetMagnetic(activeMagnetic); activeMagnetic = null;
      resetTilt(activeTilt); activeTilt = null;
      resetDropzone(activeDropzone); activeDropzone = null;
    },
    { passive: true }
  );

  // ── 14. Press Ripple, Copy Path, Amie Refresh Spin & Elastic Toggle ──────
  function spawnRipple(host, clientX, clientY) {
    if (!host || prefersReduced()) return;
    host.classList.add('tfx-ripple-host');
    const rect = host.getBoundingClientRect();
    const x = clientX ? clientX - rect.left : rect.width / 2;
    const y = clientY ? clientY - rect.top : rect.height / 2;
    const maxDim = Math.max(rect.width, rect.height, 48);
    const ripple = document.createElement('span');
    ripple.className = 'tfx-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.setProperty('--rx', `${x.toFixed(1)}px`);
    ripple.style.setProperty('--ry', `${y.toFixed(1)}px`);
    ripple.style.setProperty('--rscale', String(Math.ceil((maxDim * 2.1) / 12)));
    host.append(ripple);
    window.setTimeout(() => ripple.remove(), 480);
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      const host = e.target?.closest?.('.btn, .region-option, .demo-file, .theme-choice, .arsenal-weapon');
      if (host && !host.disabled) spawnRipple(host, e.clientX, e.clientY);
    },
    { passive: true }
  );

  const SPIN_ACTIONS = new Set([
    'refresh-servers',
    'refresh-account',
    'ea-reconnect',
    'diagnose',
    'check-update',
    'refresh-icepick',
    'repair',
    'repair-ea',
  ]);
  const activeSpinUntil = new Map();

  function applyActiveSpins(root) {
    if (!root || prefersReduced() || !activeSpinUntil.size) return;
    const now = performance.now();
    activeSpinUntil.forEach((endAt, action) => {
      const remaining = endAt - now;
      if (remaining <= 40) {
        activeSpinUntil.delete(action);
        return;
      }
      const btn = root.querySelector(`[data-action="${CSS.escape(action)}"]`);
      const icon = btn?.querySelector('svg.icon');
      if (icon && !icon.classList.contains('tfx-icon-spin')) {
        icon.classList.add('tfx-icon-spin');
        window.setTimeout(() => {
          icon.classList.remove('tfx-icon-spin');
          if ((activeSpinUntil.get(action) || 0) <= performance.now()) {
            activeSpinUntil.delete(action);
          }
        }, Math.max(220, Math.round(remaining)));
      }
    });
  }

  document.addEventListener('click', (e) => {
    const spinBtn = e.target?.closest?.('[data-action]');
    if (spinBtn && SPIN_ACTIONS.has(spinBtn.dataset.action) && !prefersReduced()) {
      const action = spinBtn.dataset.action;
      activeSpinUntil.set(action, performance.now() + 560);
      const icon = spinBtn.querySelector('svg.icon');
      if (icon) {
        icon.classList.remove('tfx-icon-spin');
        void icon.offsetWidth;
        icon.classList.add('tfx-icon-spin');
        window.setTimeout(() => icon.classList.remove('tfx-icon-spin'), 560);
      }
    }

    const pathEl = e.target?.closest?.('.home-path .path');
    if (pathEl) {
      const txt = (pathEl.textContent || '').trim();
      if (txt && txt !== '尚未选择游戏目录') {
        navigator.clipboard?.writeText(txt).catch(() => {});
        const strip = pathEl.closest('.home-path');
        const icon = strip?.querySelector(':scope > svg.icon');
        if (strip && icon && !strip.classList.contains('is-copied')) {
          const prevSvg = icon.innerHTML;
          strip.classList.add('is-copied');
          icon.innerHTML = '<path d="m5 12 4 4 10-10"/>';
          window.setTimeout(() => {
            if (icon.isConnected) icon.innerHTML = prevSvg;
            strip.classList.remove('is-copied');
          }, 1500);
        }
        playTouch('toggle', true);
        if (typeof toast === 'function') toast(L('copyPathToast'));
      }
      return;
    }

    const toggleBtn = e.target?.closest?.('button.toggle');
    if (toggleBtn && !toggleBtn.disabled) {
      playTouch('toggle', toggleBtn.getAttribute('aria-checked') === 'true');
      if (!prefersReduced()) {
        toggleBtn.classList.remove('tfx-toggle-pop');
        void toggleBtn.offsetWidth;
        toggleBtn.classList.add('tfx-toggle-pop');
        const row = toggleBtn.closest('.mini-mod-row, .mod-row, .setting-row');
        if (row) {
          row.classList.remove('tfx-row-pulse');
          void row.offsetWidth;
          row.classList.add('tfx-row-pulse');
        }
      }
      return;
    }

    if (e.target?.closest?.('.launch-button')) {
      playTouch('launch');
      window.setTimeout(syncLaunchCapsule, 60);
      return;
    }
    if (e.target?.closest?.('.rail [data-page]')) {
      playTouch('nav');
      return;
    }
    if (e.target?.closest?.('.btn, .region-option, tbody tr[data-server], .arsenal-weapon')) {
      playTouch('tap');
    }
  });

  requestAnimationFrame(() => {
    enhanceRenderedDOM();
    captureModPositions();
    snapshotFluidHeights();
    const rail = document.querySelector('.rail');
    if (rail) window.updateNavIndicator(rail, '[data-page]', true);
  });
})();
