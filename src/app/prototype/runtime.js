/* The selected HTML is kept intact. This adapter replaces only demo data/actions. */
(() => {
  'use strict';
  window.addEventListener('error',event=>window.fold?.reportError?.(event.error?.stack||event.message||'Resource load failed'));
  window.addEventListener('unhandledrejection',event=>window.fold?.reportError?.(event.reason?.stack||String(event.reason)));
  const indicatorSpringTime=640;
  const indicatorSpringStops=Array.from({length:49},(_,i)=>{
    const t=i/48*indicatorSpringTime/1000,damping=25,omega=Math.sqrt(330-damping*damping/4);
    return i===48?1:1-Math.exp(-damping*t/2)*(Math.cos(omega*t)+damping/(2*omega)*Math.sin(omega*t));
  });
  const frameStyle = document.createElement('style');
  frameStyle.textContent = `
    html[data-theme] { --window-radius:var(--tfx-radius-shell); background: transparent !important; height: 100%; overflow: hidden; color-scheme: normal !important; }
    html[data-window-expanded] { --window-radius:0px; }
    html body {
      height: 100dvh; min-height: 0; overflow-y: auto;
      background: transparent !important; color-scheme:var(--palette-scheme);
      border-radius: var(--window-radius) !important;
      clip-path: inset(0 round var(--window-radius));
    }
    html body::before { content: ""; position: fixed; inset: 0; z-index: -2; background: color-mix(in srgb, var(--bg) 80%, transparent); pointer-events: none; }
  `;
  document.head.append(frameStyle);
  const syncFrameTheme = syncThemeVariables;
  syncThemeVariables = function(...args) {
    syncFrameTheme(...args);
    // Keep the body background from propagating to Chromium's rectangular canvas.
    document.body.style.setProperty('background-color', 'transparent', 'important');
  };
  let maximized = false, fullscreen = false;
  const ipc = window.ipcRenderer;
  if (!ipc || !window.fold) throw Error('TFX preload is required');
  ipc.on('window-state', (_event, value) => {
    maximized = !!value.maximized; fullscreen = !!value.fullscreen;
    document.documentElement.toggleAttribute('data-window-expanded', maximized || fullscreen);
    updateWindowControls();
  });
  const windowGlyphs = {
    fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    restore:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
    background:'<path d="M8 4h11a2 2 0 0 1 2 2v8M5 8h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2M7 12h6M7 16h3"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>'
  };
  const glyph = name => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+windowGlyphs[name]+'</svg>';
  const controls=document.createElement('div');
  controls.className='tfx-window-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','窗口控制');
  controls.innerHTML=[['background','后台运行'],['fullscreen','全屏'],['close','关闭']].map(([name,label])=>'<button type="button" class="tfx-window-button" data-window-control="'+name+'" aria-label="'+label+'" title="'+label+'">'+glyph(name)+'</button>').join('');
  document.querySelector('.top-actions')?.append(controls);
  frameStyle.textContent+=`
    .tfx-window-controls { display:flex; align-items:center; gap:4px; padding-left:12px; margin-left:8px; border-left:1px solid var(--line); }
    .tfx-window-button { display:grid; place-items:center; width:36px; height:36px; color:var(--muted); border-radius:var(--tfx-radius-control)!important; transition:background-color 160ms,color 160ms,transform 160ms; }
    .tfx-window-button:hover { background:var(--surface); color:var(--text); }
    .tfx-window-button:active { transform:scale(.9); }
    .tfx-window-button[data-window-control="close"]:hover { background:#a83232; color:#fff; }
    @media(prefers-reduced-motion:reduce) { .tfx-window-button { transition:none; } }
  `;
  function updateWindowControls(){
    const button=controls.querySelector('[data-window-control="fullscreen"]');if(!button)return;
    button.innerHTML=glyph(fullscreen?'restore':'fullscreen');
    button.setAttribute('aria-label',fullscreen?'退出全屏':'全屏');button.title=fullscreen?'退出全屏':'全屏';button.setAttribute('aria-pressed',String(fullscreen));
  }
  controls.addEventListener('click',async event=>{
    const action=event.target.closest('[data-window-control]')?.dataset.windowControl;
    try{
      if(action==='close')ipc.send('exit');
      if(action==='fullscreen')await ipc.invoke('window-toggle-fullscreen');
      if(action==='background'){const result=await ipc.invoke('window-background');if(!result.ok)toast('后台运行未成功，请重试');}
    }catch(error){toast(error.message);}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='F11'||event.key==='Escape'&&fullscreen&&!document.querySelector('dialog[open]')){
      event.preventDefault();ipc.invoke('window-toggle-fullscreen').catch(error=>toast(error.message));
    }
  });
  // The desktop design explicitly enables motion without changing OS preferences.
  motionReduced=()=>false;
  const logo=document.querySelector('.rail .brand');
  if(logo)logo.innerHTML='<span class="tfx-image-logo" aria-hidden="true"></span>';
  document.querySelector('.wordmark-mark')?.remove();
  frameStyle.textContent+=`
    .rail .brand .tfx-image-logo { display:block; width:38px; height:38px; background:var(--accent); mask:url('../../assets/icons/tfx-mark.svg') center/contain no-repeat; transition:transform 280ms cubic-bezier(.2,.8,.2,1); }
    .rail .brand:hover .tfx-image-logo { transform:scale(1.06); }
    button.toggle { transition:background-color 260ms ease!important; }
    html body button.toggle::after,html body button.toggle.on::after { transition:transform 360ms cubic-bezier(.22,.8,.2,1)!important; transition-delay:0ms!important; transform:translate3d(var(--toggle-x),0,0) rotate(var(--toggle-rotation))!important; will-change:transform; }
    .nav-active-indicator,.hover-track-indicator { transform-origin:0 0; will-change:transform!important; }
    @media(prefers-reduced-motion:reduce) {
      html body button.toggle,html body button.toggle::after,html body button.toggle.on::after { transition:none!important; }
    }

  `;
  frameStyle.textContent+=`
    /* Alpha belongs to surfaces, so text and icons retain their contrast. */
    html body .rail { background:color-mix(in srgb,var(--rail) 76%,transparent)!important; box-shadow:0 10px 24px -8px #0006,0 2px 7px #0003,inset 0 1px 0 #ffffff16!important; }
    html body .home-launch-v2.play-stage { background:color-mix(in srgb,var(--surface) 48%,transparent); border:1px solid var(--line); }
    html body .home-v2 .home-bottom>section { background:color-mix(in srgb,var(--surface) 36%,transparent); }
    html body .launch-topline .segment,html body .home-launch-v2 .region-option:not(.active) { background:color-mix(in srgb,var(--bg) 46%,transparent); }
    html body .search,html body input,html body textarea,html body .log { background:color-mix(in srgb,var(--surface) 64%,transparent); }
    html body .search input { background:transparent; }
    html body .launch-progress-track { overflow:hidden; position:relative; }
    html body .launch-progress-track.is-waiting .launch-progress-bar { width:38%!important; animation:tfx-launch-wait 1150ms cubic-bezier(.45,0,.55,1) infinite!important; transition:none!important; will-change:transform; }
    @keyframes tfx-launch-wait { from { transform:translateX(-105%); } to { transform:translateX(365%); } }
    /* Chromium's customizable picker stays in the top layer, with native keyboard semantics. */
    html body select,html body select::picker(select) { appearance:base-select; }
    html body select { display:inline-flex; align-items:center; justify-content:space-between; gap:20px; background:color-mix(in srgb,var(--surface) 70%,transparent); color:var(--text); border:1px solid var(--line); border-radius:var(--tfx-radius-control)!important; }
    html body select::picker-icon { color:var(--muted); transition:transform 180ms ease!important; }
    html body select:open::picker-icon { transform:rotate(180deg); }
    html body select:open { border-color:var(--accent); }
    html body select::picker(select) { padding:6px; margin:7px 0; max-height:min(340px,60vh); overflow-y:auto; background:var(--surface); color:var(--text); border:1px solid var(--line); border-radius:var(--tfx-radius-well); box-shadow:0 12px 32px #0005,0 2px 6px #0002; opacity:1; transform:translateY(0); transition:opacity 150ms ease,transform 150ms ease,display 150ms allow-discrete,overlay 150ms allow-discrete; scrollbar-width:thin; scrollbar-color:var(--muted) transparent; }
    @starting-style { html body select:open::picker(select) { opacity:0; transform:translateY(-5px); } }
    html body select option { min-height:38px; padding:9px 12px; gap:12px; border-radius:var(--tfx-radius-control)!important; color:var(--text); background:transparent; white-space:normal; overflow-wrap:anywhere; }
    html body select option:hover,html body select option:focus { background:var(--raised); outline:none; }
    html body select option:checked { color:var(--accent); background:var(--accent-tint); }
    html body select option::checkmark { color:var(--accent); }
    html body select option:disabled { color:var(--muted); opacity:.55; }
  `;
  // Recompose the existing home controls so their IDs/actions keep the same contracts.
  const originalHomePage=homePage;
  homePage=function(){
    const template=document.createElement('template');template.innerHTML=originalHomePage();
    const content=template.content,stage=content.querySelector('.home-launch-v2');
    if(!stage)return template.innerHTML;
    const r1=state.title==='tf1',steam=state.r1Mode==='steam';
    const titles=document.createElement('div');titles.className='hover-track segment title-choice';titles.setAttribute('aria-label','选择游戏');
    titles.innerHTML=['tf1','tf2'].map((id,i)=>'<button data-action="title-'+id+'" aria-pressed="'+(state.title===id)+'" class="'+(state.title===id?'active':'')+'">泰坦陨落 '+(i+1)+'</button>').join('');
    content.querySelector('.page-heading .heading-actions').prepend(titles);
    if(r1){
      stage.classList.add('titanfall-one');stage.querySelector('.launch-edition').textContent='TFX / TITANFALL 1';stage.querySelector('.launch-topline .segment').remove();
      stage.querySelector('.launch-label').innerHTML='<span>启动方式</span><span class="faint">TITANFALL 1</span>';
      stage.querySelector('.region-choice').innerHTML='<button class="region-option '+(steam?'active':'')+'" data-action="r1mode-steam" aria-pressed="'+steam+'"><strong>Steam</strong><small>原版游戏</small></button><button class="region-option '+(!steam?'active':'')+'" data-action="r1mode-delta" aria-pressed="'+!steam+'"><strong>Delta</strong><small>社区客户端</small></button>';
      const ready=steam||titanfall1.installed&&titanfall1.gameInstalled;
      if(ready)stage.querySelector('.status-dot').removeAttribute('style');
      stage.querySelector('.launch-button').innerHTML=I(state.busy?'refresh':ready?'play':'download')+'<span class="launch-button-label">'+(state.busy?'正在启动':steam?'启动 Steam':ready?'启动 Delta':'安装并启动')+'</span>'+I('arrow');
      stage.querySelector('.launch-checklist').innerHTML=['游戏目录','Delta 核心','启动进程'].map(label=>'<li>'+I('checkcircle')+'<span>'+label+'</span></li>').join('');
      stage.querySelector('.path-label').textContent='泰坦陨落 1 游戏目录';stage.querySelector('.path').textContent=titanfall1.gamepath||'尚未选择游戏目录';stage.querySelector('.home-path .badge')?.remove();
      content.querySelector('.home-bottom').innerHTML='<section class="panel"><div class="panel-header"><h2>Delta 安装</h2><span class="faint">R1DELTA</span></div><p class="r1-install-note">选择已购买并下载的泰坦陨落 1，启动器仅安装 Delta 核心。</p><div class="health-row"><span>核心版本</span><span>'+(titanfall1.version?esc(titanfall1.version):'未安装')+'</span></div><div class="path-strip"><div class="grow"><div class="path-label">Delta 核心目录</div><p class="path">'+esc(titanfall1.corepath||'安装后显示')+'</p></div></div></section><section class="panel"><div class="panel-header"><h2>启动检查</h2></div><div class="health-row"><span>游戏目录</span><span>'+(titanfall1.gameInstalled?'已找到':'未找到')+'</span></div><div class="health-row"><span>Delta 核心</span><span>'+(titanfall1.installed?'已就绪':'未安装')+'</span></div><div class="health-row"><span>启动方式</span><span>'+(steam?'Steam':'Delta')+'</span></div></section>';
    }
    stage.classList.add('home-launch-editorial');
    const identity=document.createElement('div');identity.className='launch-identity';
    const topline=stage.querySelector('.launch-topline'),edition=topline.querySelector('.launch-edition');
    identity.append(edition);const modes=topline.querySelector('.segment');if(modes)identity.append(modes);
    const title=document.createElement('h2');title.className='launch-display';
    title.setAttribute('aria-label',r1?'Titanfall 1':state.game==='northstar'?'Northstar 北极星':'Titanfall 2');
    title.innerHTML=r1?'<span>TITAN</span><span>FALL<span class="launch-display-dot">1</span></span>':state.game==='northstar'?'<span>NORTH</span><span>STAR<span class="launch-display-dot">.</span></span>':'<span>TITAN</span><span>FALL<span class="launch-display-dot">2</span></span>';
    identity.append(title);topline.replaceWith(identity);
    const workspace=document.createElement('div');workspace.className='launch-workspace';
    const overview=stage.querySelector('.play-overview'),action=stage.querySelector('.launch-action-pane');
    stage.insertBefore(workspace,overview);workspace.append(overview,action);
    const commit=document.createElement('div');commit.className='launch-commit';
    commit.append(action.querySelector('.launch-state'),action.querySelector('.launch-button'));
    action.prepend(commit);
    stage.querySelector('.launch-secondary')?.remove();
    content.querySelector('.home-v2').classList.add('home-editorial');
    content.querySelector('.page-heading').classList.add('home-editorial-heading');
    return template.innerHTML;
  };
  frameStyle.textContent+=`
    html body .home-editorial-heading { min-height:65px; margin-bottom:0; }
    html body .home-editorial-heading h1 { font-size:30px!important; letter-spacing:-1px; }
    html body .home-editorial { gap:26px; }
    html body .home-launch-editorial.play-stage { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.1fr); column-gap:64px; padding:0; border:0; border-radius:0!important; background:transparent; overflow:visible; }
    html body .launch-identity { display:flex; flex-direction:column; min-width:0; padding:0 0 18px; border-top:1px solid var(--line); }
    html body .launch-identity .launch-edition { display:block; padding:18px 0 16px; color:var(--muted); font-size:10px!important; letter-spacing:2.3px; }
    html body .launch-identity .segment { display:flex; flex:none; align-self:flex-start; width:auto; gap:4px; padding:3px; border:1px solid var(--line); background:color-mix(in srgb,var(--surface) 34%,transparent); border-radius:var(--tfx-radius-well)!important; }
    html body .launch-identity .segment button { flex:none; min-height:34px; padding:6px 15px; font-size:12px!important; }
    html body .launch-display { margin:auto 0; padding:18px 0 8px; font-family:Arial,Helvetica,sans-serif; font-weight:800; font-size:clamp(60px,7.4vw,106px)!important; line-height:.83; letter-spacing:-.075em; color:var(--text); }
    html body .launch-display>span { display:block; font-size:inherit!important; line-height:inherit; }
    html body .launch-display>span+span { margin-top:9px; color:var(--accent); }
    html body .launch-display-dot { display:inline; font-size:inherit!important; color:var(--muted); }
    html body .home-launch-editorial .launch-identity .launch-secondary { display:flex; grid-column:auto; grid-row:auto; flex-wrap:wrap; justify-content:flex-start; gap:12px 22px; margin:auto 0 0; padding:0 0 22px; }
    html body .home-launch-editorial .launch-identity .launch-secondary .text-button { font-size:11px!important; gap:6px; }
    html body .launch-workspace { min-width:0; border-top:1px solid var(--line); padding:18px 0 0; }
    html body .home-launch-editorial.play-stage .play-overview { display:block; padding:0; }
    html body .home-launch-editorial.play-stage .launch-label { margin:0 0 20px!important; min-height:14px; font-size:11px!important; }
    html body .home-launch-editorial.play-stage .region-choice { display:grid; grid-template-columns:1fr; gap:10px!important; width:100%; }
    html body .home-launch-editorial.play-stage .region-option { display:grid; grid-template-columns:minmax(0,1fr) auto; align-content:center; align-items:center; justify-content:initial; min-height:68px; padding:16px 20px!important; border-radius:var(--tfx-radius-control)!important; text-align:left; }
    html body .home-launch-editorial.play-stage .region-option strong { font-size:17px!important; letter-spacing:-.3px; }
    html body .home-launch-editorial.play-stage .region-option small { margin:0 18px 0 12px; font-size:10px!important; text-align:right; }
    html body .home-launch-editorial.play-stage .region-option.active:after { top:50%; right:16px; transform:translateY(-50%); }
    html body .home-launch-editorial.play-stage .launch-action-pane { display:block; padding:22px 0 0; border:0; }
    html body .launch-commit { display:flex; align-items:center; justify-content:space-between; gap:20px; }
    html body .home-launch-editorial.play-stage .launch-state { min-height:0; margin:0; font-size:11px!important; line-height:1.6; flex:1; }
    html body .home-launch-editorial.play-stage .launch-state>span { font-size:11px!important; }
    html body .home-launch-editorial.play-stage .launch-button { display:flex; flex:0 0 auto; width:196px; min-height:56px; height:56px; padding:0 18px; border-radius:var(--tfx-radius-control)!important; justify-content:space-between; gap:10px; }
    html body .home-launch-editorial.play-stage .launch-button-label { font-size:17px!important; letter-spacing:0; }
    html body .home-launch-editorial.play-stage .launch-button .icon:first-child { width:18px; height:18px; }
    html body .home-launch-editorial.play-stage .launch-button .icon:last-child { width:16px; height:16px; }
    html body .home-launch-editorial.play-stage .launch-inline-progress { margin:22px 0 0; min-height:0; }
    html body .home-launch-editorial.play-stage .launch-progress-copy { margin-bottom:8px; }
    html body .home-launch-editorial.play-stage .launch-progress-track { height:2px; }
    html body .home-launch-editorial.play-stage .launch-checklist { margin:10px 0 20px; justify-content:space-between; gap:8px; }
    html body .home-launch-editorial.play-stage .launch-checklist li { font-size:10px!important; }
    html body .home-launch-editorial.play-stage .launch-footline { display:block; padding:16px 0; margin-top:14px; background:transparent; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
    html body .home-launch-editorial.play-stage .home-path { display:flex; width:100%; gap:12px; }
    html body .home-launch-editorial.play-stage .home-path>.grow { display:flex; gap:20px; align-items:baseline; min-width:0; }
    html body .home-launch-editorial.play-stage .home-path .path-label { flex:none; margin:0; font-size:10px!important; }
    html body .home-launch-editorial.play-stage .home-path .path { font-size:11px!important; }
    html body .home-editorial .home-bottom { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); gap:48px; padding:0; }
    html body .home-editorial .home-bottom>section { grid-column:auto; padding:0; border:0; border-radius:0!important; background:transparent; }
    html body .home-editorial .home-bottom>section+section { padding-left:28px; border-left:1px solid var(--line); }
    html body .home-editorial .home-bottom .panel-header { margin:0 0 10px; }
    html body .home-editorial .home-bottom h2 { font-size:17px!important; }
    html body .home-editorial .mini-mod-row { padding:10px 0; }
    html body .home-editorial .health-row { padding:10px 0; }
    @media(max-width:1150px) { html body .home-launch-editorial.play-stage { column-gap:36px; grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr); } html body .launch-display { font-size:76px!important; } html body .home-launch-editorial.play-stage .launch-button { width:170px; } html body .home-launch-editorial.play-stage .launch-state>span { font-size:10px!important; } html body .launch-commit { gap:14px; } }
    @media(max-width:900px) { html body .launch-display { font-size:61px!important; } html body .home-launch-editorial.play-stage { column-gap:28px; grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr); } html body .home-launch-editorial.play-stage .region-option { padding:14px!important; } html body .home-launch-editorial.play-stage .region-option small { margin-right:12px; font-size:9px!important; } html body .launch-commit { flex-wrap:wrap; } html body .home-launch-editorial.play-stage .launch-state { flex-basis:100%; } html body .home-launch-editorial.play-stage .launch-button { width:100%; } }
    @media(max-width:640px) { html body .home-launch-editorial.play-stage { grid-template-columns:1fr; } html body .launch-display { margin:22px 0; font-size:76px!important; } html body .launch-workspace { margin-top:8px; } html body .home-editorial .home-bottom { grid-template-columns:1fr; gap:24px; } html body .home-editorial .home-bottom>section+section { padding:20px 0 0; border-left:0; border-top:1px solid var(--line); } html body .home-launch-editorial.play-stage .home-path>.grow { display:block; } }
  `;
  // Editorial collection: compose the original controls, preserving their action contracts.
  const baseModsPage=modsPage,baseModRows=modRows,baseCatalogCards=catalogCards;
  const collectionTabs=['installed','icepick','discover','arsenal'];
  const collectionNames=['NORTHSTAR','ICEPICK','DISCOVER','ARCHIVE'];
  const fragmentOf=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};
  modRows=function(list){
    const t=fragmentOf(baseModRows(list));
    t.content.querySelectorAll('.mod-row').forEach((row,i)=>{
      const number=document.createElement('span');number.className='mod-index';number.setAttribute('aria-hidden','true');
      number.textContent=String(i+1).padStart(2,'0');row.prepend(number);
    });return t.innerHTML;
  };
  catalogCards=function(){
    const t=fragmentOf(baseCatalogCards());
    t.content.querySelectorAll('.catalog-card').forEach((card,i)=>{
      const action=card.querySelector('[data-action^="cataloginfo-"]');card.dataset.collectionKey=action?.dataset.action||String(i);
      const number=document.createElement('span');number.className='catalog-index';number.setAttribute('aria-hidden','true');
      number.textContent=String(i+1).padStart(2,'0');card.querySelector('.catalog-art').prepend(number);
    });return t.innerHTML;
  };
  modsPage=function(){
    const t=fragmentOf(baseModsPage()),content=t.content;
    const root=document.createElement('div');root.className='mods-editorial';root.dataset.collection=state.modTab;
    const heading=content.querySelector('.page-heading'),title=heading.querySelector('h1');
    const identity=document.createElement('div');identity.className='collection-identity';
    const kicker=document.createElement('span');kicker.className='collection-kicker';kicker.textContent='TFX / MOD COLLECTION';
    title.replaceWith(identity);identity.append(kicker,title);
    const local=state.modTab==='installed'||state.modTab==='icepick';
    const entries=local?state.mods.filter(m=>(m.kind==='icepick')===(state.modTab==='icepick')):state.modTab==='arsenal'?arsenalRecords:catalog;
    const summary=document.createElement('div');summary.className='collection-summary';
    summary.innerHTML=`<div><strong data-collection-total>${String(entries.length).padStart(2,'0')}</strong><span>${local?'个模组':state.modTab==='arsenal'?'材质记录':'社区模组'}</span></div>${local?`<div><strong data-collection-enabled>${String(entries.filter(m=>m.enabled).length).padStart(2,'0')}</strong><span>已启用</span></div>`:''}`;
    heading.insertBefore(summary,heading.querySelector('.heading-actions'));
    const tabs=content.querySelector('.mod-tabs');tabs.classList.replace('hover-track','collection-tabs');tabs.setAttribute('aria-label','模组分类');
    [...tabs.querySelectorAll('button')].forEach((button,i)=>{
      const label=document.createElement('span');label.className='collection-tab-label';label.append(...button.childNodes);
      button.innerHTML=`<span class="collection-tab-index" aria-hidden="true">0${i+1}</span>`;button.append(label);
      const caption=document.createElement('span');caption.className='collection-tab-caption';caption.textContent=collectionNames[i];caption.setAttribute('aria-hidden','true');button.append(caption);
      button.setAttribute('aria-current',button.classList.contains('active')?'page':'false');
    });
    root.append(heading,tabs);
    const body=document.createElement('div');body.className='collection-body';body.append(...content.childNodes);root.append(body);
    if(local){
      const skin=body.querySelector('[data-action="modscope-skin"]');if(skin){const text=[...skin.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(text)text.textContent='VTF / DDS';skin.setAttribute('aria-label','VTF / DDS');}
      const layout=body.querySelector('.mods-layout'),sidebar=layout.querySelector('.mods-sidebar'),panel=layout.querySelector(':scope > section');
      const work=document.createElement('div');work.className='collection-work';
      const toolbar=body.querySelector('.toolbar'),path=body.querySelector('.path-strip');
      work.append(toolbar);if(path)work.append(path);work.append(panel);layout.replaceChildren(sidebar,work);
      const modResults=panel.querySelector('#mod-results');
      modResults.dataset.scrollKey=state.modTab;
      sidebar.querySelectorAll('[data-action^="modscope-"]').forEach(button=>{
        const kind=button.dataset.action.slice(9);button.querySelector('span').textContent=entries.filter(m=>kind==='all'||m.kind===kind).length;
        button.setAttribute('aria-pressed',button.classList.contains('active'));
      });
      if(state.modTab==='icepick')body.querySelector('#mod-search').setAttribute('aria-label','搜索 Icepick 模组');
    }
    if(state.modTab==='discover'){
      const caption=body.querySelector('.toolbar .count-label');if(caption)caption.textContent='THUNDERSTORE / COMMUNITY';
    }
    if(state.modTab==='arsenal'){
      body.querySelectorAll('.arsenal-row').forEach((row,i)=>{row.dataset.collectionKey=String(i)+'-'+row.querySelector('strong').textContent;});
    }
    content.append(root);return t.innerHTML;
  };
  function syncCollectionStats(){
    if(state.title==='tf1')return;
    if(state.page!=='mods'||!['installed','icepick'].includes(state.modTab))return;
    const mods=state.mods.filter(m=>(m.kind==='icepick')===(state.modTab==='icepick'));
    const enabled=document.querySelector('[data-collection-enabled]');if(enabled){const value=String(mods.filter(m=>m.enabled).length).padStart(2,'0');if(enabled.textContent!==value){enabled.textContent=value;enabled.getAnimations().forEach(a=>a.cancel());enabled.animate([{transform:'translateY(6px)',opacity:.35},{transform:'translateY(0)',opacity:1}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'});}}
    document.querySelectorAll('#mod-results .mod-index').forEach((n,i)=>n.textContent=String(i+1).padStart(2,'0'));
  }
  const baseReconcileRows=reconcileRows;
  reconcileRows=function(root,html,selector,key,animate=true){
    if(key!=='mod')return baseReconcileRows(root,html,selector,key);
    animate=animate&&!motionReduced();
    const focused=document.activeElement;
    const before=new Map([...root.querySelectorAll(selector)].map(node=>[node.dataset[key],{node,box:animate?node.getBoundingClientRect():null}]));
    const t=fragmentOf(html);
    for(const fresh of t.content.querySelectorAll(selector)){const old=before.get(fresh.dataset[key]);if(old)fresh.replaceWith(old.node);}
    root.replaceChildren(t.content);
    if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
    if(!animate)return;
    // Read all final positions before starting animations; large lists avoid per-row layout flushes.
    const rows=[...root.querySelectorAll(selector)].map(node=>({node,box:node.getBoundingClientRect(),old:before.get(node.dataset[key])}));
    let animated=0;
    for(const {node,box,old} of rows){
      if(box.bottom<0||box.top>innerHeight||animated>=14)continue;
      const dy=old?old.box.top-box.top:12;if(old&&Math.abs(dy)<1)continue;
      node.getAnimations().forEach(a=>a.cancel());
      node.animate([{transform:`translateY(${dy}px)`,opacity:old?1:0},{transform:'translateY(0)',opacity:1}],{duration:360,easing:'cubic-bezier(.16,1,.3,1)'});animated++;
    }
  };
  const baseUpdateModRows=updateModRows,baseRefreshModFeedback=refreshModFeedback;
  updateModRows=function(...args){baseUpdateModRows(...args);syncCollectionStats();};
  function filterInstalledMods(scope,clearSearch=false){
    const main=document.getElementById('main');
    const selected=main?.querySelector(`[data-action="modscope-${CSS.escape(scope)}"]`);
    const results=main?.querySelector('#mod-results');
    if(!selected||!results||(!clearSearch&&scope===state.modScope))return;
    state.modScope=scope;
    const search=main.querySelector('#mod-search');
    if(clearSearch){state.modQuery='';search.value='';}
    for(const button of main.querySelectorAll('[data-action^="modscope-"]')){
      button.classList.toggle('active',button===selected);
      button.setAttribute('aria-pressed',String(button===selected));
    }
    selected.closest('.spring-choice')?._refreshChoice();
    const restoreFocus=clearSearch&&results.contains(document.activeElement);
    updateModRows(false);
    if(restoreFocus)search.focus({preventScroll:true});
    results.scrollTop=0;
    delete main._tfxHTML;
    I18n.apply();
  }
  refreshModFeedback=function(...args){baseRefreshModFeedback(...args);syncCollectionStats();};
  function collectionSnapshot(main){
    const root=main.querySelector('.mods-editorial');if(!root)return null;
    const nodes=[...root.querySelectorAll('.mod-row,.catalog-card,.arsenal-row,.arsenal-weapon')];
    const rows=new Map();for(const node of nodes){const box=node.getBoundingClientRect();if(box.bottom<0||box.top>innerHeight)continue;rows.set(node.dataset.mod||node.dataset.collectionKey||node.dataset.action,{box,html:node.innerHTML});}
    return {tab:root.dataset.collection,rows};
  }
  function animateCollection(main,previous){
    const root=main.querySelector('.mods-editorial');if(!root)return;
    const changed=previous?.tab!==root.dataset.collection;
    const nodes=[...root.querySelectorAll('.mod-row,.catalog-card,.arsenal-row,.arsenal-weapon')];
    const measured=nodes.map(node=>({node,box:node.getBoundingClientRect(),old:previous?.rows.get(node.dataset.mod||node.dataset.collectionKey||node.dataset.action)}));
    let index=0;
    for(const {node,box,old} of measured){
      if(box.bottom<0||box.top>innerHeight||index>=14)continue;
      const dx=old?old.box.left-box.left:0,dy=old?old.box.top-box.top:0;
      if(!changed&&old&&Math.abs(dx)+Math.abs(dy)<1)continue;
      node.getAnimations().forEach(a=>a.cancel());
      const direction=previous?Math.sign(collectionTabs.indexOf(root.dataset.collection)-collectionTabs.indexOf(previous.tab)):1;
      node.animate(changed||!old?[{opacity:0,transform:`translate(${changed?direction*20:0}px,${changed?10:12}px)`},{opacity:1,transform:'translate(0,0)'}]:[{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:changed?440:340,delay:changed?Math.min(index,7)*24:0,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});index++;
    }
    if(changed){const heading=root.querySelector('.collection-summary,.collection-identity');heading?.animate([{opacity:.3,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,easing:'cubic-bezier(.16,1,.3,1)'});}
  }
  const baseCatalogUpdate=updateCatalogResults;
  updateCatalogResults=function(){const main=document.getElementById('main'),snapshot=collectionSnapshot(main);baseCatalogUpdate();animateCollection(main,snapshot);};
  frameStyle.textContent+=`
    .spring-choice { position:relative; isolation:isolate; }
    .spring-choice-clip { position:absolute; inset:0 auto auto 0; width:0; height:0; overflow:clip; pointer-events:none; }
    .spring-choice-clip>.hover-track-indicator { background:var(--accent-tint); }
    .spring-choice>button { position:relative; z-index:1; }
    html body :is(.settings-menu,.mods-sidebar .scope-choice).spring-choice button:is(.active,:hover) { background:transparent!important; }
    html body .mods-editorial { grid-column:1/-1; min-width:0; --collection-rule:color-mix(in srgb,var(--text) 16%,transparent); }
    html body .mods-editorial .page-heading { gap:36px; align-items:center; margin:0 0 24px; min-height:90px; }
    html body .collection-identity { margin-right:auto; }
    html body .collection-kicker { display:block; font:10px/1.4 Arial,sans-serif; letter-spacing:2.4px; color:var(--muted); margin-bottom:10px; }
    html body .mods-editorial .page-heading h1 { font-size:32px!important; letter-spacing:-1.2px; line-height:1.2; }
    html body .collection-summary { display:flex; align-items:center; gap:32px; }
    html body .collection-summary>div { display:flex; align-items:baseline; gap:10px; }
    html body .collection-summary strong { display:inline-block; font-family:Arial,sans-serif; font-size:50px!important; font-weight:500; letter-spacing:-3px; line-height:1; font-variant-numeric:tabular-nums; }
    html body .collection-summary>div+div strong { color:var(--accent); }
    html body .collection-summary span { color:var(--muted); font-size:10px!important; white-space:nowrap; }
    html body .mods-editorial .heading-actions .btn { min-height:38px; padding:9px 15px; font-size:12px!important; }
    html body .mods-editorial .mod-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); padding:7px 0; gap:8px; margin:0 0 26px; border-top:1px solid var(--collection-rule); border-bottom:1px solid var(--collection-rule); }
    html body .mods-editorial .mod-tabs>button { display:grid; grid-template-columns:24px minmax(0,1fr); grid-template-rows:auto auto; align-items:center; gap:4px 10px; padding:10px 14px; border-radius:var(--tfx-radius-control)!important; text-align:left; min-height:55px; background:transparent; }
    html body .mods-editorial .collection-tabs { position:relative; isolation:isolate; align-items:stretch; overflow:clip; }
    @property --tfx-collection-position { syntax:'<number>'; inherits:false; initial-value:0; }
    .collection-tabs::before {
      --tfx-collection-position:var(--collection-hover-tab,var(--collection-active-tab,0));
      --collection-bound:clamp(0,var(--tfx-collection-position),3);
      --collection-bounce:clamp(.92,calc(1 - abs(var(--tfx-collection-position) - var(--collection-bound))),1);
      content:''; position:absolute; inset:7px auto 7px 0; width:calc((100% - 24px) / 4);
      border-radius:var(--tfx-radius-control); background:var(--accent-tint); pointer-events:none;
      transform-origin:calc(var(--collection-bound) * 100% / 3) center;
      transform:translate3d(calc(var(--collection-bound) * (100% + 8px)),0,0) scaleX(var(--collection-bounce));
      transition:--tfx-collection-position ${indicatorSpringTime}ms linear(${indicatorSpringStops.map(p=>p.toFixed(6)).join(',')});
    }
    .mods-editorial[data-collection=icepick] .collection-tabs { --collection-active-tab:1; }
    .mods-editorial[data-collection=discover] .collection-tabs { --collection-active-tab:2; }
    .mods-editorial[data-collection=arsenal] .collection-tabs { --collection-active-tab:3; }
    html body .mods-editorial .collection-tabs>button { white-space:normal; overflow-wrap:anywhere; z-index:1; }
    html body .mods-editorial .collection-tabs>button:hover { color:var(--text); }
    html body .mods-editorial .collection-tabs>button:focus-visible { outline-offset:-2px; }
    @media(prefers-reduced-motion:reduce){
      /* Keep the desktop tab plate in sync with the home region's JS-driven spring. */
      .collection-tabs::before { transition-duration:${indicatorSpringTime}ms!important; }
    }
    html body .collection-tab-index { grid-row:1/3; align-self:start; font:11px/1.5 Arial,sans-serif!important; color:var(--muted); }
    html body .collection-tab-label { font-size:14px!important; font-weight:600; }
    html body .collection-tab-label small { margin-left:8px; font-size:10px!important; font-weight:400; }
    html body .collection-tab-caption { font:8px/1.4 Arial,sans-serif!important; letter-spacing:1.8px; opacity:.6; }
    html body .mods-editorial .mod-tabs>button.active .collection-tab-index { color:var(--accent); }
    html body .mods-editorial .mods-layout { display:grid; grid-template-columns:174px minmax(0,1fr); gap:34px; align-items:start; }
    html body .mods-editorial .mods-sidebar { position:sticky; top:22px; padding:0 22px 0 0; border:0; border-right:1px solid var(--collection-rule); border-radius:0!important; background:transparent; }
    html body .mods-editorial .side-section { padding:0; }
    html body .mods-editorial .side-section h3 { font-size:11px!important; color:var(--muted); font-weight:400; margin-bottom:16px; }
    html body .mods-editorial .scope-choice { gap:5px; }
    html body .mods-editorial .scope-choice button { min-height:37px; padding:9px 10px; border-radius:var(--tfx-radius-control)!important; font-size:12px!important; }
    html body .mods-editorial .scope-choice button span { font:10px Arial,sans-serif!important; }
    html body .mods-editorial .side-separator { margin:24px 0; border-color:var(--collection-rule); }
    html body .mods-editorial .side-separator:last-child { display:none; }
    html body .collection-work { min-width:0; grid-column:2; grid-row:1; }
    html body .mods-editorial .mods-sidebar { grid-column:1; grid-row:1; display:block; }
    html body .mods-editorial .arsenal-weapons { grid-column:1; grid-row:1; }
    html body .mods-editorial .arsenal-records { grid-column:2; grid-row:1; }
    html body .mods-editorial .arsenal-selection { display:block; }
    html body .mods-editorial .toolbar { gap:14px; margin-bottom:22px; flex-wrap:wrap; }
    html body .collection-work .toolbar .search { flex:1 1 220px; width:auto; min-width:160px; max-width:400px; }
    html body .mods-editorial .toolbar .text-button { font-size:11px!important; gap:5px; }
    html body .mods-editorial .toolbar .text-button.danger { opacity:.7; }
    html body .mods-editorial .sort-trigger { min-height:40px; padding:9px 12px; font-size:11px!important; }
    html body .mods-editorial .search { min-height:40px; border-radius:var(--tfx-radius-control)!important; }
    html body .mods-editorial .search input { font-size:12px!important; }
    html body .collection-work>section { padding:0; background:transparent; border:0; border-radius:0!important; }
    html body .collection-work .panel-header { margin:0; padding:0 0 12px; border-bottom:1px solid var(--collection-rule); }
    html body .collection-work .panel-header h2 { font-size:13px!important; }
    html body .collection-work .mod-list { display:block; }
    html body .mods-editorial .mod-row { display:grid; grid-template-columns:23px 28px minmax(0,1fr) auto; gap:14px; padding:18px 8px 18px 0; min-height:94px; border-bottom:1px solid var(--collection-rule); border-radius:0!important; position:relative; background:transparent; transition:background 180ms ease!important; }
    html body .mods-editorial .mod-row::before { content:''; position:absolute; inset:13px auto 13px -12px; width:2px; background:var(--accent); transform:scaleY(0); transition:transform 280ms cubic-bezier(.16,1,.3,1)!important; }
    html body .mods-editorial .mod-row:hover::before,html body .mods-editorial .mod-row:focus-within::before { transform:scaleY(1); }
    html body .mods-editorial .mod-row:hover,html body .mods-editorial .mod-row:focus-within { background:color-mix(in srgb,var(--surface) 25%,transparent); }
    html body .mod-index { font:10px Arial,sans-serif!important; color:var(--muted); font-variant-numeric:tabular-nums; }
    html body .mods-editorial .mod-glyph { width:28px; height:28px; background:transparent; color:var(--muted); }
    html body .mods-editorial .mod-row[data-enabled=true] .mod-glyph { color:var(--accent); }
    html body .mods-editorial .mod-title strong { font-size:14px!important; font-weight:600; overflow-wrap:anywhere; }
    html body .mods-editorial .mod-row p { margin:5px 0; font-size:11px!important; line-height:1.6; color:var(--muted); }
    html body .mods-editorial .mod-meta { font-size:10px!important; opacity:.7; }
    html body .mods-editorial .mod-row .actions { gap:13px; }
    html body .mods-editorial .mod-state { font-size:10px!important; min-width:40px; }
    html body .mods-editorial .mod-row .icon-button { width:28px; height:30px; }
    html body .mods-editorial .path-strip { border:0; border-top:1px solid var(--collection-rule); border-bottom:1px solid var(--collection-rule); border-radius:0!important; background:transparent; padding:12px 0; gap:12px; }
    html body .mods-editorial .path-strip .path { font-size:11px!important; }
    html body .mods-editorial .catalog-grid { grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:0 30px; align-items:start; padding-bottom:26px; }
    html body .mods-editorial .catalog-card { padding:22px 0 20px; border:0; border-top:1px solid var(--collection-rule); border-radius:0!important; background:transparent; overflow:visible; transition:transform 320ms cubic-bezier(.16,1,.3,1)!important; }
    html body .mods-editorial .catalog-card:nth-child(even) { margin-top:28px; }
    html body .mods-editorial .catalog-card:hover,html body .mods-editorial .catalog-card:focus-within { transform:translateY(-5px); }
    html body .mods-editorial .catalog-art { display:flex; gap:12px; align-items:center; height:auto; min-height:0; margin:0 0 18px; padding:0; border:0; background:transparent; }
    html body .mods-editorial .catalog-index { margin-right:auto; font:44px/.9 Arial,sans-serif!important; letter-spacing:-2px; color:var(--muted); opacity:.65; }
    html body .mods-editorial .catalog-art>.icon { width:20px; height:20px; color:var(--accent); }
    html body .mods-editorial .catalog-art .badge { position:static; }
    html body .mods-editorial .catalog-content { padding:0; }
    html body .mods-editorial .catalog-content h2 { font-size:24px!important; letter-spacing:-.7px; overflow-wrap:anywhere; line-height:1.2; margin:0 0 12px; }
    html body .mods-editorial .catalog-card:first-child .catalog-content h2 { font-size:34px!important; }
    html body .mods-editorial .catalog-content p { font-size:12px!important; line-height:1.7; min-height:40px; color:var(--muted); }
    html body .mods-editorial .catalog-meta { font-size:10px!important; margin:15px 0; flex-wrap:wrap; overflow-wrap:anywhere; }
    html body .mods-editorial .catalog-actions { border-top:0; margin:0; padding:0; }
    html body .mods-editorial .catalog-actions .text-button { font-size:11px!important; }
    html body .mods-editorial .catalog-actions .btn { min-width:80px; }
    html body .mods-editorial .arsenal-heading { margin-bottom:24px; }
    html body .mods-editorial .arsenal-heading h2 { font-size:16px!important; }
    html body .mods-editorial .arsenal-layout { grid-template-columns:210px minmax(0,1fr); gap:34px; }
    html body .mods-editorial .arsenal-weapons { padding:0 22px 0 0; border-right:1px solid var(--collection-rule); }
    html body .mods-editorial .arsenal-column-heading { padding:0 10px 14px; font-size:10px!important; color:var(--muted); }
    html body .mods-editorial .arsenal-weapon { padding:13px 10px; border-radius:var(--tfx-radius-control)!important; min-height:48px; }
    html body .mods-editorial .arsenal-weapon span { font-size:12px!important; }
    html body .mods-editorial .arsenal-weapon small { font-size:10px!important; }
    html body .mods-editorial .arsenal-toolbar { align-items:flex-start; padding:0 0 22px; gap:20px; }
    html body .mods-editorial .arsenal-selection h3 { font-size:28px!important; letter-spacing:-1px; line-height:1.2; }
    html body .mods-editorial .arsenal-selection>span { display:block; margin-top:8px; font-size:11px!important; }
    html body .mods-editorial .arsenal-toolbar-actions { gap:12px; }
    html body .mods-editorial .arsenal-restore-top { font-size:10px!important; }
    html body .mods-editorial .arsenal-list { padding-left:16px; border-left:1px solid var(--collection-rule); }
    html body .mods-editorial .arsenal-row { position:relative; display:flex; gap:20px; padding:19px 12px 19px 18px; min-height:78px; border-radius:0!important; border-bottom:1px solid var(--collection-rule); background:transparent; transition:background 180ms ease!important; }
    html body .mods-editorial .arsenal-row::before { content:''; position:absolute; left:-21px; top:32px; width:7px; height:7px; border:1px solid var(--muted); border-radius:var(--tfx-radius-round); background:var(--bg); }
    html body .mods-editorial .arsenal-row[data-record-state=current] { background:color-mix(in srgb,var(--accent) 7%,transparent); }
    html body .mods-editorial .arsenal-row[data-record-state=current]::before { background:var(--accent); border-color:var(--accent); box-shadow:0 0 0 5px var(--accent-tint); }
    html body .mods-editorial .arsenal-row:hover { background:var(--accent-tint); }
    html body .mods-editorial .arsenal-format { width:42px; height:auto; padding:0; background:transparent; font:18px Arial,sans-serif!important; letter-spacing:-1px; color:var(--muted); }
    html body .mods-editorial .arsenal-row strong { font-size:13px!important; overflow-wrap:anywhere; }
    html body .mods-editorial .arsenal-row small { font-size:10px!important; }
    html body .mods-editorial .arsenal-row .btn { font-size:10px!important; }
    html body .mods-editorial .arsenal-expand { text-align:left; padding:16px 10px; font-size:11px!important; }
    html body .mods-editorial .arsenal-confirm { border-left:2px solid var(--accent); border-radius:0!important; margin-top:18px; }
    html body .mods-editorial button:focus-visible,html body .mods-editorial input:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    @media(max-width:1150px) {
      html body .mods-editorial .page-heading { gap:24px; }
      html body .collection-summary { gap:22px; }
      html body .collection-summary strong { font-size:42px!important; }
      html body .mods-editorial .mods-layout { grid-template-columns:150px minmax(0,1fr); gap:24px; }
      html body .mods-editorial .mods-sidebar { padding-right:15px; }
      html body .mods-editorial .mod-row { grid-template-columns:20px minmax(0,1fr) auto; gap:12px; }
      html body .mods-editorial .mod-glyph { display:none; }
      html body .mods-editorial .mod-row .actions { gap:9px; }
      html body .mods-editorial .arsenal-layout { grid-template-columns:170px minmax(0,1fr); gap:24px; }
      html body .mods-editorial .arsenal-selection h3 { font-size:23px!important; }
    }
    @media(max-width:850px) {
      html body .collection-tab-caption { display:none; }
      html body .mods-editorial .mod-tabs>button { grid-template-columns:1fr; gap:6px; }
      html body .collection-tab-index { grid-row:auto; }
      html body .collection-summary>div { display:block; }
      html body .collection-summary span { display:block; margin-top:4px; }
      html body .mods-editorial .mod-state { display:none; }
      html body .mods-editorial .arsenal-toolbar { flex-wrap:wrap; }
    }
    @media(max-width:640px) {
      html body .mods-editorial .page-heading { flex-wrap:wrap; gap:16px; }
      html body .collection-summary strong { font-size:32px!important; }
      html body .mods-editorial .mods-layout,html body .mods-editorial .arsenal-layout,html body .mods-editorial .catalog-grid { grid-template-columns:1fr; }
      html body .collection-work,html body .mods-editorial .arsenal-records { grid-column:1; grid-row:2; }
      html body .mods-editorial .mods-sidebar { position:static; border-right:0; padding:0 0 18px; }
      html body .mods-editorial .scope-choice { display:grid; grid-template-columns:repeat(3,1fr); }
      html body .mods-editorial .catalog-card:nth-child(even) { margin-top:0; }
      html body .mods-editorial .arsenal-weapons { border-right:0; }
    }
  `;

  const baseInstallerPage=installerPage;
  installerPage=function(){
    const t=fragmentOf(baseInstallerPage()),root=t.content.querySelector('.install-layout');if(!root)return t.innerHTML;
    const heading=t.content.querySelector('.page-heading'),title=heading.querySelector('h1'),identity=document.createElement('div');
    identity.className='installer-identity';identity.innerHTML='<span class="installer-kicker">TFX / ASSET WORKBENCH</span>';identity.append(title);heading.insertBefore(identity,heading.querySelector('.heading-actions'));
    [...heading.querySelectorAll('.format-tabs button')].forEach((button,i)=>{const label=button.textContent;button.innerHTML=`<span>${label}</span>`;button.setAttribute('aria-current',button.classList.contains('active')?'page':'false');});
    const intro=root.querySelector(':scope > section:first-child'),details=root.querySelector('#install-details'),history=root.querySelector('.history');
    intro.querySelector('.panel-header h2').innerHTML='<span class="section-index" aria-hidden="true">01</span>导入模组';
    intro.querySelector('.panel-header .badge').textContent=I18n.text('自动识别');
    intro.querySelector('.dropzone strong').textContent='把文件放到这里';
    intro.querySelector('.dropzone').insertAdjacentHTML('beforeend','<small class="dropzone-hint">支持拖拽，或从本机选择文件</small>');
    intro.querySelector('.import-format-line').remove();
    intro.querySelector('.demo-files p').textContent='或从下面选择一个文件';
    const labels={'R-201_Glacier.dds':'选择 DDS 纹理文件','Pulse_Blade.vtf':'选择 VTF 纹理文件','Movement_Gym.zip':'选择 Northstar 模组压缩包','Icepick_Photo_Tools.zip':'选择 Icepick 模组文件'};
    intro.querySelectorAll('.demo-file').forEach(button=>{const name=button.querySelector('.badge')?.textContent||'';const text=button.textContent.trim();button.setAttribute('aria-label',text);const label=Object.entries(labels).find(([file])=>text.includes(file))?.[1];if(label){const copy=[...button.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(copy)copy.textContent=' '+label+' ';}});
    details.querySelector('.panel-header h2').textContent='核对与安装';history.querySelector('.panel-header h2').innerHTML='<span class="section-index" aria-hidden="true">03</span>最近装配';
    const empty=details.querySelector('.import-empty');if(empty){const h=empty.querySelector('h3'),p=empty.querySelector(':scope > p');if(h)h.textContent='选择一个文件开始';if(p)p.textContent='导入 DDS、VTF 或模组压缩包，启动器会检查内容并显示安装目标。';const steps=empty.querySelectorAll('.import-steps li');[['选择文件','从本机选择要安装的文件'],['检查内容','确认格式、资源和安装位置'],['完成安装','安装后可在对应页面管理']].forEach((item,i)=>{if(!steps[i])return;const strong=steps[i].querySelector('strong'),small=steps[i].querySelector('small');if(strong)strong.textContent=item[0];if(small)small.textContent=item[1];});}
    root.classList.add('install-editorial');return t.innerHTML;
  };
  frameStyle.textContent+=`
    html body .install-editorial { grid-column:1/-1; min-width:0; display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr); grid-template-rows:auto auto; gap:48px 48px; }
    html body .installer-identity { display:flex; flex-direction:column; }
    html body .installer-kicker { color:var(--muted); font:10px Arial,sans-serif; letter-spacing:2.4px; margin-bottom:10px; }
    html body .install-editorial .page-heading { grid-column:1/-1; min-height:90px; margin:0; }
    html body .install-editorial .page-heading h1 { font-size:32px!important; }
    html body .installer-summary { display:flex; align-items:baseline; gap:10px; margin-left:auto; }
    html body .installer-summary strong { font:500 50px Arial,sans-serif!important; letter-spacing:-3px; }
    html body .installer-summary span { color:var(--muted); font-size:10px!important; }
    html body .install-editorial .format-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; padding:7px 0; border-block:1px solid var(--line); }
    html body .install-editorial .format-tabs>button { display:grid; grid-template-columns:1fr; grid-template-rows:auto; gap:0; min-height:58px; padding:10px; border-radius:var(--tfx-radius-control)!important; text-align:left; }
    html body .install-editorial .format-tabs button>span:nth-child(2) { font-size:13px!important; font-weight:600; }
    html body .install-editorial .format-tabs button small { display:none!important; }
    html body .install-editorial>section { min-width:0; }
    html body .install-editorial>section:first-child { grid-column:1; grid-row:1; padding:0; border:0; }
    html body .install-editorial>#install-details { grid-column:2; grid-row:1; padding:0 0 0 26px; border:0; border-left:1px solid var(--line); min-height:0; }
    html body .install-editorial>.history { grid-column:1/-1; grid-row:2; padding:18px 0 0; border:0; border-top:1px solid var(--line); }
    html body .install-editorial .panel-header { padding:0 0 14px; margin-bottom:0; border-bottom:1px solid var(--line); }
    html body .install-editorial .panel-header h2 { font-size:15px!important; }
    html body .install-editorial .dropzone { min-height:270px; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:12px; border:1px dashed color-mix(in srgb,var(--accent) 48%,var(--line)); border-radius:var(--tfx-radius-well)!important; background:color-mix(in srgb,var(--surface) 26%,transparent); transition:border-color 180ms ease,background 180ms ease,transform 180ms ease!important; }
    html body .install-editorial .dropzone:hover,html body .install-editorial .dropzone.dragover { transform:translateY(-2px); border-color:var(--accent); background:color-mix(in srgb,var(--accent) 8%,transparent); }
    html body .install-editorial .dropzone strong { font-size:20px!important; }
    html body .install-editorial .dropzone-hint { color:var(--muted); font-size:10px!important; }
    html body .install-editorial .upload-icon { width:52px; height:52px; display:grid; place-items:center; color:var(--accent); border:1px solid var(--accent); border-radius:var(--tfx-radius-round); }
    html body .install-editorial .import-format-line { margin:12px 0 18px; color:var(--muted); }
    html body .install-editorial .demo-files { padding-top:14px; border-top:1px solid var(--line); }
    html body .install-editorial .demo-files>p { color:var(--muted); margin-bottom:8px; }
    html body .install-editorial .demo-file { width:100%; justify-content:flex-start; padding:11px 0; text-align:left; border-bottom:1px solid var(--line); font-size:11px!important; }
    html body .install-editorial .demo-file:hover { color:var(--accent); padding-left:8px; }
    html body .install-editorial .import-empty { padding-top:25px; }
    html body .install-editorial .import-empty h3 { font-size:22px!important; margin:18px 0 8px; }
    html body .install-editorial .import-empty>p { max-width:36em; color:var(--muted); line-height:1.7; }
    html body .install-editorial .import-steps { list-style:none; margin:26px 0 0; padding:0; border-top:1px solid var(--line); }
    html body .install-editorial .import-steps li { display:flex; gap:14px; padding:14px 0; border-bottom:1px solid var(--line); }
    html body .install-editorial .import-steps li>span { color:var(--accent); font:11px Arial,sans-serif; }
    html body .install-editorial .import-steps strong,html body .install-editorial .import-steps small { display:block; font-size:11px!important; }
    html body .install-editorial .import-steps small { color:var(--muted); margin-top:4px; }
    html body .install-editorial .file-receipt,html body .install-editorial .file-details,html body .install-editorial .install-target,html body .install-editorial .file-table { margin-top:16px; }
    html body .install-editorial .file-receipt { display:grid; grid-template-columns:24px 22px minmax(0,1fr) auto; gap:9px; align-items:center; padding-bottom:14px; border-bottom:1px solid var(--line); }
    html body .install-editorial .receipt-index { color:var(--accent); font:11px Arial,sans-serif; }
    html body .install-editorial .file-receipt p { overflow-wrap:anywhere; }
    html body .install-editorial .file-details { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    html body .install-editorial .file-details>div { padding:11px 0; border-top:1px solid var(--line); }
    html body .install-editorial .file-details strong { display:block; margin-top:7px; font-size:13px!important; overflow-wrap:anywhere; }
    html body .install-editorial .install-target { padding:13px 0; border-block:1px solid var(--line); }
    html body .install-editorial .file-table { width:100%; }
    html body .install-editorial .file-table th { color:var(--muted); font-size:10px!important; }
    html body .install-editorial .file-table td { padding:9px 0; font-size:10px!important; overflow-wrap:anywhere; }
    html body .install-editorial .install-summary { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:18px; padding-top:14px; border-top:1px solid var(--line); }
    html body .install-editorial .install-summary p { color:var(--muted); font-size:10px!important; }
    html body .install-editorial .history .panel-header { border:0; padding:0 0 14px; }
    html body .install-editorial .history-row { display:grid; grid-template-columns:22px minmax(0,1fr) auto auto; gap:12px; align-items:center; padding:13px 0; border-top:1px solid var(--line); }
    html body .install-editorial .history-row p { font-size:12px!important; }
    html body .install-editorial .history-row .date { color:var(--muted); font-size:10px!important; }
    html body :is(#dropzone,#r1-dropzone)[data-import-state] {
      gap:18px; padding-inline:clamp(14px, 3vw, 28px); transform:none;
      border-style:solid; border-color:color-mix(in srgb,var(--accent) 28%,var(--line));
      background:radial-gradient(ellipse at 18% 8%,color-mix(in srgb,var(--accent) 8%,transparent),transparent 76%),color-mix(in srgb,var(--surface) 55%,transparent);
    }
    html body :is(#dropzone,#r1-dropzone)[data-import-state$="Error"] { border-color:color-mix(in srgb,var(--warning) 46%,var(--line)); }
    :is(#dropzone,#r1-dropzone)[data-import-state]>:is(.upload-icon,div:has(>strong),strong,small),
    .import-feedback[hidden],#install-details :is(.import-empty,.empty,.r1-feedback)[hidden] { display:none!important; }
    .import-feedback { --receipt-ink:var(--accent); display:grid; grid-template-columns:64px minmax(0,1fr); align-items:center; gap:16px; width:min(100%,360px); text-align:left; }
    .import-feedback[data-stage$="Error"] { --receipt-ink:var(--warning); }
    .import-feedback[data-stage="cancelled"] { --receipt-ink:var(--muted); }
    .import-receipt-art { width:64px; height:68px; color:var(--receipt-ink); fill:none; stroke:currentColor; stroke-width:1.35; stroke-linecap:round; stroke-linejoin:round; }
    .import-receipt-art .receipt-back { opacity:.28; fill:var(--surface); }
    .import-receipt-art .receipt-sheet { stroke-opacity:.62; fill:color-mix(in srgb,currentColor 7%,var(--surface)); }
    .import-receipt-art .receipt-fold,.import-receipt-art .receipt-line { opacity:.4; }
    .import-receipt-art :is(.receipt-light,.receipt-seal,.receipt-check,.receipt-cross) { opacity:0; }
    .import-feedback[data-stage="reading"] .receipt-light { opacity:1; animation:tfx-receipt-read 1.55s ease-in-out infinite alternate; }
    .import-feedback[data-stage="installing"] .receipt-line { animation:tfx-receipt-write 1.7s ease-in-out infinite both; }
    .import-feedback[data-stage="installing"] .receipt-line:nth-of-type(5) { animation-delay:.16s; }
    .import-feedback[data-stage="installing"] .receipt-line:nth-of-type(6) { animation-delay:.32s; }
    .import-feedback:is([data-stage="done"],[data-stage$="Error"]) .receipt-seal { opacity:1; transform-origin:49px 52px; animation:tfx-receipt-stamp .3s ease-out both; }
    .receipt-seal circle { fill:var(--surface); }
    .import-feedback[data-stage="done"] .receipt-check,.import-feedback[data-stage$="Error"] .receipt-cross { opacity:1; }
    .import-receipt-copy { min-width:0; }
    .import-receipt-file { margin:5px 0 0; color:var(--text); font-size:13px!important; font-weight:600; line-height:1.5; overflow-wrap:anywhere; }
    .import-receipt-status { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; }
    html body :is(#dropzone,#r1-dropzone) .import-receipt-status strong { color:var(--receipt-ink); font-size:16px!important; font-weight:650; line-height:1.4; }
    .import-receipt-detail { margin:5px 0 0; color:var(--muted); font-size:11px!important; line-height:1.5; overflow-wrap:anywhere; }
    .import-feedback-percent { color:var(--receipt-ink); font-size:11px!important; font-variant-numeric:tabular-nums; }
    :is(#dropzone,#r1-dropzone)[data-import-state]>.row { justify-content:center; flex-wrap:wrap; }
    @keyframes tfx-receipt-read { from { transform:translateY(-8px); opacity:.35; } to { transform:translateY(14px); opacity:1; } }
    @keyframes tfx-receipt-write { 0%,75%,100% { opacity:.33; transform:translateX(0); } 32% { opacity:1; transform:translateX(2px); } }
    @keyframes tfx-receipt-stamp { from { opacity:0; transform:translateY(-4px) scale(1.14); } to { opacity:1; transform:none; } }
    @media(prefers-reduced-motion:reduce) { .import-receipt-art * { animation:none!important; } }
    @media(max-width:1050px){html body .install-editorial{gap:36px 26px}html body .install-editorial>#install-details{padding-left:17px}html body .install-editorial .dropzone{min-height:240px}}
    @media(max-width:780px){html body .install-editorial{grid-template-columns:1fr;gap:30px}html body .install-editorial>section:first-child,html body .install-editorial>#install-details,html body .install-editorial>.history{grid-column:1;grid-row:auto}html body .install-editorial>#install-details{padding:23px 0 0;border-left:0;border-top:1px solid var(--line)}html body .install-editorial .format-tabs{grid-template-columns:repeat(2,1fr)}html body .installer-summary strong{font-size:38px!important}}
    @media(max-width:560px){html body .install-editorial .format-tabs button small{display:none}html body .install-editorial .file-details{grid-template-columns:1fr 1fr}html body .install-editorial .install-summary{align-items:flex-start;flex-direction:column}}
  `;

  const uiPerform = perform, uiRender = render, uiNavigate = navigate;
  let prefs = fold.loadSettings().data || {}, selection = null, operation = false;
  let client = {}, official = null, account = {}, protection = null, gameReady = false;
  let titanfall1={installed:false,gameInstalled:false},r1StatusTask=null;
  try{state.title=localStorage.getItem('tfx-title')==='tf1'?'tf1':'tf2';state.r1Mode=localStorage.getItem('tfx-r1-mode')==='steam'?'steam':'delta';}catch{state.title='tf2';state.r1Mode='delta';}
  frameStyle.textContent+='html body .title-choice{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:var(--tfx-radius-well)!important}html body .title-choice button{padding:7px 13px;min-height:32px;white-space:nowrap;font-size:12px!important}html body .r1-install-note{color:var(--muted);line-height:1.8;margin:6px 0 12px;font-size:12px!important}html body .titanfall-one .launch-identity{justify-content:flex-start}';
  let icepickPath='',versions = {}, library = null, diagnostics = null, loadingCatalog = null;
  let eaTask='',eaMessage='',eaError=false,accountCheckedAt='';
  const log = [], serverIds = new Map(), pendingMods = new Set();
  let nextServerId = 1, requestGeneration = 0;
  let modePending=false,modeDesired=null,modeTask=null,motionUntil=0,motionPage=null,renderTimer=null;
  const modRequests=new Map();
  let modWriteTail=Promise.resolve();
  const now=()=>window.performance?.now?.()||Date.now();
  // Keep the feedback node stable while backend progress arrives: replacing the
  // whole page for each update interrupts transitions and can lose focus.
  const importFeedback=(()=>{
    let current={game:null,stage:'idle',name:'',detail:'',percent:null};
    const labels={choosing:'等待选择文件',reading:'正在读取文件',ready:'读取完成，可以核对安装',installing:'正在安装',done:'安装完成',readError:'读取失败',installError:'安装失败',cancelled:'已取消'};
    const putText=(node,text)=>{text=text??'';if(node.textContent!==text)node.textContent=text;};
    function paint(){
      if(state.page!=='installer')return;
      const zone=document.getElementById(state.title==='tf1'?'r1-dropzone':'dropzone');
      if(!zone)return;
      const stage=current.game===state.title?current.stage:'idle', visible=stage!=='idle';
      const active=['choosing','reading','installing'].includes(stage);
      let card=zone.querySelector('.import-feedback');
      if(visible&&!card){
        card=document.createElement('section');card.className='import-feedback';
        card.innerHTML=`<svg class="import-receipt-art" viewBox="0 0 64 68" aria-hidden="true">
          <path class="receipt-back" d="M15 9h29l8 8v34a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z" transform="rotate(9 32 34) translate(4 0)"/>
          <path class="receipt-sheet" d="M11 7h25l11 11v36a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z"/>
          <path class="receipt-fold" d="M36 7v8a3 3 0 0 0 3 3h8"/>
          <path class="receipt-line" d="M16 27h19"/><path class="receipt-line" d="M16 34h15"/><path class="receipt-line" d="M16 41h10"/>
          <path class="receipt-light" d="M11 31h32"/>
          <g class="receipt-seal"><circle cx="49" cy="52" r="9"/><path class="receipt-check" d="m45 52 2.7 2.8 5.3-5.6"/><path class="receipt-cross" d="m46 49 6 6m0-6-6 6"/></g>
        </svg><div class="import-receipt-copy"><div class="import-receipt-status"><strong role="status"></strong><span class="import-feedback-percent"></span></div><p class="import-receipt-file"></p><p class="import-receipt-detail"></p></div>`;
        zone.querySelector(':scope > .row').before(card);
      }
      if(card)card.hidden=!visible;
      if(visible){
        if(card.dataset.stage!==stage)card.dataset.stage=stage;
        zone.dataset.importState=stage;
        const pct=Number.isFinite(current.percent)?Math.max(0,Math.min(99,Math.round(current.percent))):null;
        const detail=stage==='reading'?'':current.detail;
        putText(card.querySelector('strong'),I18n.text(labels[stage]));
        putText(card.querySelector('.import-receipt-file'),current.name);
        putText(card.querySelector('.import-receipt-detail'),detail?I18n.text(detail):'');
        putText(card.querySelector('.import-feedback-percent'),active&&pct!==null?pct+'%':'');
        card.querySelector('.import-receipt-file').hidden=!current.name;
        card.querySelector('.import-receipt-detail').hidden=!detail;
      }else delete zone.dataset.importState;
      // The file receipt is the only place that narrates import. Details appear once there is something to review.
      const preview=document.querySelector('#install-details :is(.import-empty,.empty)');
      if(preview)preview.hidden=visible&&stage!=='cancelled';
      const addonError=document.querySelector('#install-details .r1-feedback');
      if(addonError)addonError.hidden=stage.endsWith('Error')&&addonError.textContent===I18n.text(current.detail);
      for(const button of document.querySelectorAll('#dropzone button,#r1-dropzone button,[data-action="install-package"],[data-action="r1-install"],[data-action="clear-file"],[data-action="r1-clear"]')){
        if(active&&!button.disabled){button.disabled=true;button.dataset.importDisabled='1';}
        else if(!active&&button.dataset.importDisabled){button.disabled=false;delete button.dataset.importDisabled;}
      }
    }
    function set(patch){current={...current,...patch};paint();}
    return {set,paint,get state(){return current;},frame:()=>new Promise(resolve=>{if(document.visibilityState==='hidden'){setTimeout(resolve,0);return;}requestAnimationFrame(()=>requestAnimationFrame(resolve));})};
  })();
  function protectMotion(){if(!document.getElementById('main'))return;motionPage=state.page;motionUntil=now()+420;}
  function applyPendingMods(){for(const mod of state.mods){const pending=modRequests.get(mod.id);if(pending)mod.enabled=pending.desired;}}

  const call = (channel, ...args) => ipc.invoke(channel, ...args);
  const ok = result => {
    if (result?.cancelled || result?.canceled) return false;
    if (result?.ok === false || result?.success === false) throw Error(result.error || result.message || '操作未完成');
    return result;
  };
  const report = error => {window.fold?.reportError?.(error?.stack||String(error));const message=String(error?.message || error);log.push(message);toast(message);};
  const root = () => state.game === 'northstar' && state.region === 'global' ? prefs.globalGamepath : prefs.gamepath;
  const context = () => [prefs.gamepath,prefs.globalGamepath,prefs.modProfileServer].join('|');
  const uiLanguages = Object.fromEntries(window.TFXLanguages.map(({id,locale})=>[locale,id]));
  const nativeLanguages = Object.fromEntries(window.TFXLanguages.map(({id,locale})=>[id,locale]));
  frameStyle.textContent+=`
    html:not(:lang(zh)) .launch-button-label{white-space:normal;overflow-wrap:anywhere;min-width:0;line-height:1.25}
    html:not(:lang(zh)) .launch-button .icon{flex-shrink:0}
  `;
  const nativeAlert=window.alert.bind(window),nativeConfirm=window.confirm.bind(window);
  window.alert=message=>nativeAlert(I18n.text(String(message)));
  window.confirm=message=>nativeConfirm(I18n.text(String(message)));
  const prototypeSetLanguage=setLanguage;
  setLanguage=function(value){
    if(!nativeLanguages[value])return;
    I18n.preview(nativeLanguages[value]);
    const main=document.getElementById('main');if(main)delete main._tfxHTML;
    prototypeSetLanguage(value);
    refreshHoverTracks();
  };
  const prototypeDiscardSettings=discardSettings;
  discardSettings=function(){prototypeDiscardSettings();I18n.preview(nativeLanguages[state.language]);};
  const prototypeSettingsPage=settingsPage;
  settingsPage=()=>prototypeSettingsPage().replace('所有设置已保存  /  仅保存在当前预览中','所有设置已保存').replace('重置本预览中的偏好，不影响正式启动器。','恢复启动器的默认偏好设置。');
  let appliedTheme;
  function settingsToState() {
    const visual=modePending?{game:state.game,region:state.region,vanilla:state.vanilla}:null;
    state.game = prefs.modProfileServer === 'official' ? 'vanilla' : 'northstar';
    state.region = prefs.northstarRegion === 'global' ? 'global' : 'cn';
    state.vanilla = prefs.vanillaModsEnabled ? 'mods' : 'clean';
    state.gamePath = prefs.gamepath || '';
    state.nsPaths = {cn:prefs.chinaInstallTarget || prefs.gamepath || '',global:prefs.globalGamepath || ''};
    state.eaEnabled = prefs.eaEmulator === true;
    state.independent = prefs.independentServerMods === true;
    state.autoUpdate = prefs.nsupdate !== false;
    state.nsArgs = prefs.nsargs || '';
    state.modSort = prefs.modSort || 'added';
    state.favorites = servers.filter(s=>(prefs.prototypeFavorites||[]).includes(s.key)).map(s=>s.id);
    if (!state.dirty) {
      state.theme = TFXThemes.normalize(prefs.prototypeTheme);
      state.language = uiLanguages[fold.normalizeUiLanguage(prefs.uiLanguage)] || 'en';
      I18n.preview(nativeLanguages[state.language]);
      const themeChanged=appliedTheme!==state.theme;appliedTheme=state.theme;
      document.documentElement.dataset.theme = state.theme;
      document.documentElement.lang = nativeLanguages[state.language];
      if(themeChanged)syncThemeVariables();
    }
    if(visual)Object.assign(state,visual);
  }
  function updateSwitch(action,enabled) {
    for(const button of document.querySelectorAll('button.toggle')) {
      if(button.dataset.action!==action)continue;
      button.classList.toggle('on',enabled);button.setAttribute('aria-checked',String(enabled));
      animateToggle(button,enabled);
      if(action.startsWith('modtoggle-'))refreshModFeedback(button);
    }
    document.querySelector('.settings-save')?.classList.toggle('is-dirty',state.dirty);
    const main=document.getElementById?.('main');if(main)delete main._tfxHTML;
  }
  async function save(patch) {
    const response = ok(await call('settings-save', patch));
    if (!response) return false;
    prefs = response.settings || {...prefs,...patch};
    return true;
  }
  async function exclusive(task) {
    if (operation || state.busy || modePending || modRequests.size || (state.title==='tf1' && deltaViews.busy)) return;
    operation = true;
    try {return await task();} catch(error){report(error);} finally {operation=false;render();}
  }
  const eaAccountActions=new Set(['login','ea-add-account','ea-reconnect','logout','refresh-account']);
  const eaActions=new Set([...eaAccountActions,'ea-toggle','diagnose','repair-ea','copy-diagnostics','open-ea-log','open-lsx-log']);
  const eaSwitchPrefix='ea-switch-';
  const eaTime=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(document.documentElement.lang||'zh-CN',{hour12:false}):'尚未检查';
  function eaAccountList(){
    const entries=account.accounts||[];
    if(!entries.length)return '';
    return `<section class="ea-saved-accounts" aria-labelledby="ea-saved-accounts-title">
      <div class="row between"><h3 id="ea-saved-accounts-title">已保存账号</h3>${btn('添加账号','ea-add-account','plus','small ghost')}</div>
      <ul class="ea-account-options">${entries.map(entry=>{
        const current=entry.accountId===account.accountId;
        const name=esc(entry.playerName||entry.userId||'EA');
        return `<li><button type="button" data-action="${eaSwitchPrefix+esc(entry.accountId)}" aria-current="${current?'true':'false'}">
          <span class="ea-account-option-icon">${I(current?'checkcircle':'account')}</span>
          <strong data-i18n-ignore>${name}</strong>
          <small>${entry.expired?'登录已过期':current?'当前':'切换'}</small>
        </button></li>`;
      }).join('')}</ul></section>`;
  }
  accountPage=function(){
    const saved=Boolean(account.accountId),logged=!!account.loggedIn,expired=saved&&account.expired;
    const view=diagnostics?.view;
    const avatar=logged&&/^file:/i.test(account.avatarUrl||'')?`<img src="${esc(account.avatarUrl)}" alt="EA 账户头像">`:logged?esc((account.playerName||'EA').slice(0,1)):I('account');
    const checks=view?.checks||['本地模拟服务','账户凭据','游戏目录','游戏启动桥接','LSX 通道','EA 登录连接'].map(title=>({title,value:'尚未检查',state:'idle',detail:'打开页面后自动检查本地状态。'}));
    return heading(btn('刷新账户','refresh-account','refresh'))+`<div class="account-layout" aria-busy="${!!eaTask}"><section class="panel account-card"><div class="panel-header"><h2>账户</h2>${badge(expired?'登录已过期':logged?'账户已连接':'尚未连接',expired?'amber':logged?'green':'')}</div><div class="account-identity"><div class="account-avatar">${avatar}</div><div><h2>${saved||logged?esc(account.playerName||'EA 账户'):'尚未连接'}</h2><p>${saved||logged?'EA ID  /  '+esc(account.userId||'—'):'连接你的 EA 账户'}</p>${badge(!logged?'未登录':account.ownsGame===true?'TITANFALL 2 已拥有':'游戏授权将在启动时验证',account.ownsGame===true?'green':'')}</div></div><dl class="account-well"><div><dt>登录状态</dt><dd>${expired?'登录已过期':!logged?'尚未登录':'本地凭据已缓存'}</dd></div><div><dt>凭据到期</dt><dd>${account.expiresAt?eaTime(new Date(account.expiresAt).toISOString()):'—'}</dd></div><div><dt>账户区域</dt><dd>${esc(account.country||'—')}</dd></div><div><dt>最近检查</dt><dd>${eaTime(accountCheckedAt)}</dd></div></dl>${eaAccountList()}<div class="setting-row" style="margin-top:10px"><div><p>EA 模拟器</p><small>Icepick 使用时请关闭 EA 模拟器。</small></div>${toggle(state.eaEnabled,'ea-toggle','EA 模拟器')}</div><div class="row wrap" style="margin-top:14px">${saved||logged?btn('退出登录','logout','logOut')+btn('重新连接',saved?'ea-reconnect':'login','refresh','soft'):btn('连接 EA 账户','login','account','primary')}</div></section><div class="stack"><section class="panel ea-diagnostics-panel"><div class="panel-header"><h2>连接诊断</h2>${badge(view?.label||'尚未检查',view?.state==='ok'?'green':view?.state==='warn'?'amber':'')}</div>${checks.map(check=>`<div class="diagnostic-row" data-check="${esc(check.id||'')}" data-state="${check.state}">${I(check.state==='ok'?'checkcircle':'info')}<span>${esc(check.title)}</span><span>${esc(check.value)}</span><small>${esc(check.detail)}</small></div>`).join('')}<div class="diagnostic-footer">${btn('重新诊断','diagnose','refresh','small')}${btn('修复连接','repair-ea','tool','small')}${btn('复制报告','copy-diagnostics','copy','small ghost')}</div><div class="row wrap ea-log-links"><button class="text-button" data-action="open-ea-log">EA 日志 ${I('arrow-up-right')}</button><button class="text-button" data-action="open-lsx-log">LSX 日志 ${I('arrow-up-right')}</button></div><p class="ea-diagnostic-time">${diagnostics?'最近诊断 '+eaTime(diagnostics.at):'重新诊断会检查本地状态及 EA 登录站点连接。'}</p><p class="ea-repair-note">修复连接会启用模拟器并配置启动桥接；账户登录仍需手动完成。</p></section><p id="ea-feedback" role="status" aria-live="polite"></p></div></div>`;
  };
  frameStyle.textContent+=`
    .account-avatar img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
    .ea-saved-accounts{min-width:0;margin-top:18px;padding-block:10px 14px;border-block:1px solid var(--line)}
    .ea-saved-accounts h3{margin:0;color:var(--muted);font-size:12px!important;font-weight:600}
    .ea-account-options{list-style:none;padding:0;margin:6px 0 0;display:grid;gap:3px;max-height:184px;overflow:auto;scrollbar-gutter:stable}
    .ea-account-options button{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-height:40px;padding:8px 10px;text-align:left;border:1px solid transparent;border-radius:var(--tfx-radius-control)!important}
    .ea-account-options button[aria-current="true"]{background:var(--accent-tint);border-color:color-mix(in srgb,var(--accent) 36%,transparent)}
    .ea-account-options button:not([aria-current="true"]):hover{background:var(--raised)}
    .ea-account-options button:focus-visible{outline-offset:-2px}
    .ea-account-options button strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px!important}
    .ea-account-options button small{font-size:11px!important;color:var(--muted);text-align:right}
    .ea-account-option-icon{display:flex;color:var(--accent)}
    .ea-account-option-icon .icon{width:16px;height:16px}
    .ea-diagnostics-panel .diagnostic-row{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:3px 10px;align-items:center;padding:12px 0}
    .ea-diagnostics-panel .diagnostic-row small{grid-column:2/-1;color:var(--muted);font-size:11px;line-height:1.65}
    .ea-diagnostics-panel .diagnostic-row[data-state="warn"]>span:last-of-type,.ea-diagnostics-panel .diagnostic-row[data-state="warn"]>.icon{color:var(--warning)}
    .ea-diagnostics-panel .diagnostic-row[data-state="idle"]>span:last-of-type{color:var(--muted)}
    .ea-diagnostics-panel .diagnostic-footer{flex-wrap:wrap;gap:8px}
    .ea-log-links{margin-top:16px;gap:20px}
    .ea-diagnostic-time,.ea-repair-note{color:var(--muted);font-size:11px;line-height:1.75;margin:14px 0 0}
    .ea-repair-note{margin-top:6px}
    #ea-feedback{min-height:24px;color:var(--muted);font-size:12px;line-height:1.8;margin:0 4px}
    #ea-feedback[data-error="true"]{color:var(--warning)}
    .account-layout[aria-busy="true"] .ea-diagnostics-panel{border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
  `;
  function paintAccount(){
    const panel=document.querySelector('.account-layout');if(!panel)return;
    panel.setAttribute('aria-busy',String(!!eaTask));
    for(const button of panel.querySelectorAll('button[data-action]')){
      const action=button.dataset.action,switching=action.startsWith(eaSwitchPrefix);
      if(!switching&&!eaActions.has(action))continue;
      const managed=switching||eaAccountActions.has(action);
      button.disabled=!!eaTask||(state.busy&&(managed||action==='repair-ea'||action==='ea-toggle'));
    }
    const feedback=document.getElementById('ea-feedback');if(feedback){feedback.textContent=eaTask||eaMessage;feedback.dataset.error=String(eaError);}
  }
  async function runEA(label,task){
    if(eaTask)return;
    eaTask=label;eaMessage='';eaError=false;paintAccount();
    try{return await task();}
    catch(error){eaError=true;eaMessage=error?.message||String(error);report(error);}
    finally{eaTask='';render();}
  }
  async function refreshDiagnostics(network=false){
    const result=ok(await call('ea-diagnostics',{network}));
    if(!result?.diagnostics)throw Error('未收到诊断结果，请重试。');
    diagnostics=result.diagnostics;render();return diagnostics;
  }
  function showResult(title, value) {
    showModal(title, `<div class="log" style="white-space:pre-wrap;user-select:text">${esc(typeof value==='string'?value:JSON.stringify(value,null,2))}</div>`,btn('关闭','close-modal'));
  }
  let northstarUpdate=null,launcherUpdate=null;
  const updateTitle=northstar=>northstar?'北极星更新':'TFX Launcher';
  function updateDialog(northstar,message,versions='',actions=''){
    showModal(updateTitle(northstar),`<div class="modal-description"><p id="settings-update-status" role="status">${esc(message)}</p>${versions?'<p>'+esc(versions)+'</p>':''}</div>`,actions||btn('关闭','close-modal'));
    I18n.apply();
  }
  function showUpdateResult(northstar,result){
    const versions=result.latestVersion?`本地版本 ${result.localVersion||result.currentVersion||'—'} · GitHub ${result.latestVersion}`:'';
    if(result.status==='available'){
      const actions=(northstar||result.canInstall?btn('立即更新',northstar?'install-northstar-update':'install-launcher-update','download','primary'):'')+
        (!northstar?btn('发布页面','open-launcher-release','arrow-up-right'):'')+btn('关闭','close-modal');
      return updateDialog(northstar,northstar||result.canInstall?'有可用更新。':'发现新版，但没有可校验的一键安装包。',versions,actions);
    }
    updateDialog(northstar,result.status==='up-to-date'?'已是最新，无需更新。':
      result.status==='no-release'?'GitHub 上没有可用的正式发布。':result.error||'更新检查失败，请重试。',versions);
  }
  async function checkSettingsUpdate(northstar){
    return exclusive(async()=>{
      if(northstar)northstarUpdate=null;else launcherUpdate=null;
      updateDialog(northstar,'正在检查 GitHub 更新…');
      try{
        const result=await call(northstar?'northstar-update-check':'launcher-update-check',{force:true});
        if(result?.status==='available'){if(northstar)northstarUpdate=result;else launcherUpdate=result;}
        if(modal.open)showUpdateResult(northstar,result||{});
      }catch(error){if(modal.open)updateDialog(northstar,error.message);}
    });
  }
  async function installSettingsUpdate(northstar){
    const result=northstar?northstarUpdate:launcherUpdate;
    if(!result||(!northstar&&!result.canInstall))return;
    return exclusive(async()=>{
      updateDialog(northstar,'正在下载更新…');
      try{
        const installed=ok(await call(northstar?'northstar-update-install':'launcher-update-install',{
          version:result.latestVersion,...(northstar?{region:result.region}:{})
        }));
        if(northstar)await clients();
        if(modal.open)updateDialog(northstar,northstar?(installed.status==='up-to-date'?'已是最新，无需更新。':'更新完成，已保留自装模组。'):'校验完成，启动器即将退出并安装更新。');
      }catch(error){if(modal.open)updateDialog(northstar,error.message);else toast(error.message);}
    });
  }
  function paintData() {
    importFeedback.paint();
    syncCollectionStats();
    const selected = client[state.region];
    if(state.title!=='tf1'&&state.page==='mods'&&state.modTab==='icepick'){const path=document.querySelector('.path-strip .path');if(path)path.textContent=icepickPath||'—';}
    const status = document.querySelector('.launch-state>span');
    if(status) status.textContent = state.title==='tf1'
      ? state.r1Mode==='steam'?'通过 Steam 启动原版游戏':!titanfall1.gameInstalled?'请先选择泰坦陨落 1 游戏目录':titanfall1.installed?'Delta '+titanfall1.version:'尚未安装 Delta 核心'
      : state.game==='northstar'
      ? selected?.installed ? '客户端已就绪  /  '+(selected.version || versions.ns || '—') : selected?.error || '尚未安装此区域客户端'
      : gameReady ? (state.vanilla==='mods'&&!official?.installed?'需要安装国际版框架':'游戏已就绪') : '尚未选择游戏目录';
    const health = document.querySelectorAll('.health-row');
    if(state.title!=='tf1'&&health[0]?.lastElementChild) health[0].lastElementChild.textContent=gameReady?'已找到':'未找到';
    if(state.title!=='tf1'&&health[3]?.lastElementChild) health[3].lastElementChild.textContent='—';
    const number = document.getElementById('launch-progress-number');
    if(number) number.textContent=state.busy&&!state.launchProgress?'…':state.launchProgress?state.launchProgress+'%':'待命';
    const progressTrack=document.querySelector('.launch-progress-track');
    if(progressTrack){
      const waiting=!!state.busy&&!state.launchProgress;
      progressTrack.classList.toggle('is-waiting',waiting);
      if(waiting)progressTrack.removeAttribute('aria-valuenow');
      else progressTrack.setAttribute('aria-valuenow',String(state.launchProgress||0));
      progressTrack.setAttribute('aria-valuetext',state.launchStep||'待命');
    }
    const progressBar=document.getElementById('launch-progress-bar');if(progressBar)progressBar.style.width=(state.launchProgress||0)+'%';
    const progressStep=document.getElementById('launch-progress-step');if(progressStep)progressStep.textContent=state.launchStep||'待命';
    const launchButton=document.querySelector('[data-action="launch"]');
    if(launchButton) launchButton.disabled=operation||state.busy||modePending||modRequests.size>0||(state.title==='tf1'&&deltaViews.busy);
    for(const button of document.querySelectorAll('[data-action^="game-"],[data-action^="region-"],[data-action^="vanilla-"],[data-action^="title-"],[data-action^="r1mode-"]')) button.disabled=operation||state.busy||modePending||modRequests.size>0||deltaViews.busy;
    if(state.title==='tf1'){
      const checks=document.querySelectorAll('.launch-checklist li');[titanfall1.gameInstalled,state.r1Mode==='steam'||titanfall1.installed,state.launchProgress===100].forEach((value,i)=>checks[i]?.classList.toggle('is-checked',!!value));
      const coreCheck=document.querySelector('.launch-checklist li:nth-child(2) span');if(coreCheck&&state.r1Mode==='steam')coreCheck.textContent='Steam 客户端';
    }
    for(const button of document.querySelectorAll('[data-action^="modtoggle-"]')){
      const mod=state.mods.find(m=>m.id===button.dataset.action.slice(10));
      button.disabled=operation||state.busy||modePending||!!mod?.core||mod?.controllable===false;
    }
    for(const button of document.querySelectorAll('[data-action^="arsenal-restore-"]')){
      const id=button.dataset.action.slice(16),record=arsenalRecords.find(r=>r.id===id);
      button.disabled=operation||(id==='original'?!library?.stateRestoreWeaponIds?.includes(state.arsenal.weapon):!record?.record.stateRestoreWeaponIds?.includes(record.weapon));
    }
    if(state.page==='installer'&&state.file&&selection){
      const pack=selection.state.package,files=pack.files||[],values=document.querySelectorAll('.file-details strong');
      if(values[0])values[0].textContent=String(pack.modCount||pack.count||files.length);
      if(values[1])values[1].textContent=files.some(f=>f.width&&f.height)?[...new Set(files.filter(f=>f.width&&f.height).map(f=>f.width+' × '+f.height))].join(' / '):'—';
      const ready=selection.format==='mod'||selection.state.game?.ready===true;
      if(values[2])values[2].textContent=ready?'已通过':'待检查';
      const badge=document.querySelector('#install-details .panel-header .badge');if(badge)badge.textContent=ready?'检查通过':'待检查';
      const rows=document.querySelector('.file-table tbody');if(rows)rows.innerHTML=files.map(f=>'<tr><td>'+esc(f.path||f.name)+'</td><td class="positive">'+(ready?'可安装':'待检查')+'</td></tr>').join('');
    }
    if(state.page==='settings'){
      const values=document.querySelectorAll('#settings-content .account-well p');
      if(state.settingsView==='protection'){
        if(values[0])values[0].textContent=protection?.snapshot?'已记录':'—';
        if(values[1])values[1].textContent=protection?.state==='ready'?'与当前游戏匹配':protection?.reason||'—';
      }
      if(state.settingsView==='update'){
        const notice=document.getElementById('ns-settings-version'),status=client[state.region];
        const value=status?.installed?'当前 Northstar '+(status.selectedVersion||status.installedVersion||'—'):'所选区域的北极星客户端尚未安装。';
        if(notice?.lastChild?.nodeType===3&&notice.lastChild.textContent!==value)notice.lastChild.textContent=value;
      }
    }
    if(state.page==='account')paintAccount();
    I18n.apply();
  }
  // Animation frames follow the display refresh rate; controls survive backend updates.
  animateSpringIndicator = function(indicator){
    const spring=indicator._spring;if(!spring||motionReduced())return;
    const targetKey=[spring.targetX,spring.targetY,spring.targetWidth,spring.targetHeight].join('|');
    if(indicator._motionTarget===targetKey&&indicator._motion?.playState==='running')return;
    indicator._motionTarget=targetKey;
    const matrix=new DOMMatrixReadOnly(getComputedStyle(indicator).transform);
    const width=parseFloat(indicator.style.width)||spring.width||spring.targetWidth;
    const height=parseFloat(indicator.style.height)||spring.height||spring.targetHeight;
    const from={x:matrix.m41,y:matrix.m42,width:width*matrix.m11,height:height*matrix.m22};
    indicator._motion?.cancel();
    if(Math.abs(from.x-spring.targetX)+Math.abs(from.y-spring.targetY)+Math.abs(from.width-spring.targetWidth)+Math.abs(from.height-spring.targetHeight)<.1){
      Object.assign(spring,{x:spring.targetX,y:spring.targetY,width:spring.targetWidth,height:spring.targetHeight});
      originalSetSpringValue(indicator,spring);indicator._motion=null;return;
    }
    const frames=indicatorSpringStops.map(p=>{
      let x=from.x+(spring.targetX-from.x)*p,y=from.y+(spring.targetY-from.y)*p,w=from.width+(spring.targetWidth-from.width)*p,h=from.height+(spring.targetHeight-from.height)*p;
      if(spring.bounds){
        // Neither the moving plate nor its overshoot may extend the scrollable area.
        const {left,top,right,bottom}=spring.bounds;
        w=Math.max(1,Math.min(w,right-x,right-left));h=Math.max(1,Math.min(h,bottom-y,bottom-top));
        x=Math.max(left,Math.min(x,right-w));y=Math.max(top,Math.min(y,bottom-h));
      }
      return {transform:`translate3d(${x}px,${y}px,0) scale(${w/width},${h/height})`};
    });
    indicator.style.transform=frames.at(-1).transform;
    spring.x=spring.targetX;spring.y=spring.targetY;spring.width=spring.targetWidth;spring.height=spring.targetHeight;spring.frame=0;
    const motion=indicator._motion=indicator.animate(frames,{duration:indicatorSpringTime,easing:'linear'});
    motion.onfinish=()=>{
      if(indicator._motion!==motion)return;
      // Settle on actual dimensions: leaving scale() distorts corners on unequal tabs.
      indicator.style.width=spring.targetWidth+'px';indicator.style.height=spring.targetHeight+'px';
      indicator.style.transform=`translate3d(${spring.targetX}px,${spring.targetY}px,0)`;
      indicator._motion=null;
    };
  };
  const originalSetSpringValue=setSpringValue;
  setSpringValue=function(indicator,spring){indicator._motion?.cancel();originalSetSpringValue(indicator,spring);};
  updateNavIndicator = function(rail, selector, immediate=false){const active=rail.querySelector(`${selector}.active`);if(!active)return;let indicator=rail.querySelector(':scope > .nav-active-indicator');rail.querySelectorAll(':scope > .nav-track > .nav-active-indicator').forEach(el=>el.remove());if(!indicator){indicator=document.createElement('span');indicator.className='nav-active-indicator';indicator.setAttribute('aria-hidden','true');indicator.dataset.ready='0';indicator._spring={x:0,y:0,width:0,height:0,vx:0,vy:0,vwidth:0,vheight:0,targetX:0,targetY:0,targetWidth:0,targetHeight:0,frame:0,initialized:false};rail.prepend(indicator);}const spring=indicator._spring,version=rail._navMeasureVersion=(rail._navMeasureVersion||0)+1;const apply=()=>{if(version!==rail._navMeasureVersion)return;const railBox=rail.getBoundingClientRect(),itemBox=active.getBoundingClientRect();spring.targetX=itemBox.left-railBox.left-rail.clientLeft;spring.targetY=itemBox.top-railBox.top-rail.clientTop;spring.targetWidth=itemBox.width;spring.targetHeight=itemBox.height;if(immediate||!spring.initialized||motionReduced()){if(spring.frame)cancelAnimationFrame(spring.frame);spring.frame=0;spring.x=spring.targetX;spring.y=spring.targetY;spring.width=spring.targetWidth;spring.height=spring.targetHeight;spring.vx=spring.vy=spring.vwidth=spring.vheight=0;spring.initialized=true;setSpringValue(indicator,spring);indicator.dataset.ready='1';return;}indicator.dataset.ready='1';animateSpringIndicator(indicator);};if(!spring.initialized){indicator.style.opacity='0';window.setTimeout(()=>window.setTimeout(()=>{apply();if(version===rail._navMeasureVersion)indicator.style.opacity='1';},0),0);}else window.setTimeout(apply,0);};
  animateToggle = function(button,enabled,immediate=false){
    if(button._toggleFrame)cancelAnimationFrame(button._toggleFrame);button._toggleFrame=0;
    if(immediate||motionReduced())button.style.setProperty('transition','none','important');
    setToggleProgress(button,enabled?1:0);button.style.setProperty('--toggle-rotation',enabled?'210deg':'0deg');
    if(immediate||motionReduced())button.style.removeProperty('transition');
  };
  function choiceGeometry(track,target){
    const box=target.getBoundingClientRect(),parent=track.getBoundingClientRect();
    return [box.left-parent.left-track.clientLeft+track.scrollLeft,box.top-parent.top-track.clientTop+track.scrollTop,box.width,box.height];
  }
  moveHoverTrack = function(track,target,immediate=false,geometry){
    const indicator=hoverIndicator(track._choiceClip||track),spring=indicator._spring;
    if(!target){
      if(spring.frame)cancelAnimationFrame(spring.frame);
      spring.frame=0;indicator.classList.remove('is-visible');indicator.style.opacity='0';return;
    }
    [spring.targetX,spring.targetY,spring.targetWidth,spring.targetHeight]=geometry||choiceGeometry(track,target);
    indicator.style.setProperty('border-radius',getComputedStyle(target).borderRadius,'important');
    if(immediate||!spring.initialized||motionReduced()){
      if(spring.frame)cancelAnimationFrame(spring.frame);
      spring.frame=0;spring.x=spring.targetX;spring.y=spring.targetY;spring.width=spring.targetWidth;spring.height=spring.targetHeight;
      spring.vx=spring.vy=spring.vwidth=spring.vheight=0;spring.initialized=true;setSpringValue(indicator,spring);indicator.dataset.ready='1';
    }else animateSpringIndicator(indicator);
    indicator.classList.add('is-visible');indicator.style.opacity='1';
  };
  const springChoiceSelector='.segment,.region-choice,.tabbar:not(.collection-tabs),.format-tabs,.arsenal-filters,.settings-menu,.scope-choice';
  const selectedChoice='button.active,button[aria-pressed="true"],button[aria-current="page"],button[aria-checked="true"]';
  function disposeTrack(track){
    track._hoverResizeObserver?.disconnect();
    const indicator=(track._choiceClip||track).querySelector(':scope > .hover-track-indicator');
    indicator?._motion?.cancel();
    if(indicator?._spring.frame)cancelAnimationFrame(indicator._spring.frame);
  }
  disposeHoverTracks=function(root){root.querySelectorAll('.hover-track,.spring-choice').forEach(disposeTrack);};
  refreshHoverTracks=function(){
    document.querySelectorAll('.spring-choice').forEach(track=>track._refreshChoice?.());
    document.querySelectorAll('.hover-track').forEach(track=>{
      if(track._hoverTarget)return;
      const target=track.querySelector(selectedChoice);
      if(target)moveHoverTrack(track,target);
    });
  };
  const bindOtherHoverTracks=bindHoverTracks;
  bindHoverTracks=function(){
    document.querySelectorAll(springChoiceSelector).forEach(bindSpringChoice);
    bindOtherHoverTracks();
  };
  function bindSpringChoice(track){
    if(track._refreshChoice)return;
    track.classList.remove('hover-track');
    track.classList.add('spring-choice');
    const buttons=[...track.querySelectorAll(':scope > button')];
    const clip=track._choiceClip=document.createElement('span');
    clip.className='spring-choice-clip';
    clip.setAttribute('aria-hidden','true');
    track.prepend(clip);
    let hovered=null,lastTarget=null,lastGeometry=null;
    const pick=()=>hovered?.getClientRects().length?hovered:buttons.find(button=>button.matches(selectedChoice)&&button.getClientRects().length);
    const refresh=(measure=false)=>{
      if(!track.isConnected)return;
      const target=pick();
      if(!target){
        if(lastTarget){clip.querySelector('.hover-track-indicator')?._motion?.cancel();moveHoverTrack(track,null);}
        lastTarget=null;lastGeometry=null;
        return;
      }
      if(target===lastTarget&&!measure)return;
      const geometry=choiceGeometry(track,target);
      const origin=track.getBoundingClientRect();
      const left=origin.left+track.clientLeft-track.scrollLeft,top=origin.top+track.clientTop-track.scrollTop;
      const boxes=buttons.filter(button=>button.getClientRects().length).map(button=>button.getBoundingClientRect());
      const bounds=hoverIndicator(clip)._spring.bounds={
        left:Math.min(...boxes.map(box=>box.left))-left,top:Math.min(...boxes.map(box=>box.top))-top,
        right:Math.max(...boxes.map(box=>box.right))-left,bottom:Math.max(...boxes.map(box=>box.bottom))-top,
      };
      clip.style.width=Math.max(0,bounds.right)+'px';
      clip.style.height=Math.max(0,bounds.bottom)+'px';
      // A click can trigger ResizeObserver even when the hovered tab has not moved.
      // Keep that animation running; real geometry changes retarget from the rendered frame.
      if(lastGeometry&&geometry.every((value,i)=>Math.abs(value-lastGeometry[i])<.1)){
        lastTarget=target;
        return;
      }
      moveHoverTrack(track,target,!lastTarget,geometry);
      lastTarget=target;
      lastGeometry=geometry;
    };
    track._refreshChoice=refresh;
    track.addEventListener('pointerover',event=>{
      const target=event.pointerType==='touch'?null:event.target.closest('button');
      if(event.pointerType!=='touch'&&(!buttons.includes(target)||target.disabled))return;
      if(target===hovered)return;
      hovered=target;
      refresh();
    },{passive:true});
    const clear=()=>{hovered=null;refresh();};
    track.addEventListener('pointerleave',()=>{if(track.isConnected)clear();},{passive:true});
    track.addEventListener('pointercancel',clear,{passive:true});
    const observer=track._hoverResizeObserver=new ResizeObserver(()=>refresh(true));
    observer.observe(track);
    buttons.forEach(button=>observer.observe(button));
  }
  function retainTracks(main) {
    const tracks=new Map();
    if(main._tfxPage!==state.page)return tracks;
    for(const group of main.querySelectorAll(springChoiceSelector)) {
      const key=[...group.querySelectorAll('button[data-action]')].map(b=>b.dataset.action).join('|');
      if(!key)continue;
      tracks.set(key,{group,left:group.scrollLeft,top:group.scrollTop});
      group.remove();
    }
    return tracks;
  }
  function restoreTracks(main,tracks) {
    for(const fresh of main.querySelectorAll(springChoiceSelector)) {
      const buttons=[...fresh.querySelectorAll('button[data-action]')],key=buttons.map(b=>b.dataset.action).join('|'),saved=tracks.get(key);
      if(!saved)continue;
      const old=saved.group,existing=[...old.querySelectorAll('button[data-action]')];
      buttons.forEach((button,i)=>{
        const target=existing[i];
        target.className=button.className;
        target.disabled=button.disabled;
        const oldCount=target.querySelector('small,.scope-choice button>span'),newCount=button.querySelector('small,.scope-choice button>span');
        if(oldCount&&newCount&&oldCount.textContent!==newCount.textContent)oldCount.textContent=newCount.textContent;
        for(const attr of ['aria-pressed','aria-checked','aria-current']){
          if(button.hasAttribute(attr))target.setAttribute(attr,button.getAttribute(attr));
          else target.removeAttribute(attr);
        }
      });
      fresh.replaceWith(old);
      if(saved.left||saved.top)old.scrollTo({left:saved.left,top:saved.top,behavior:'instant'});
      tracks.delete(key);
    }
    for(const {group} of tracks.values())disposeTrack(group);
  }
  function bindCollectionTabPointer(rail){
    const tabs=[...rail.querySelectorAll(':scope > button')];
    let hovered=-1;
    const clear=()=>{
      if(hovered<0)return;
      hovered=-1;
      rail.style.removeProperty('--collection-hover-tab');
    };
    // Hover retargets the same plate by column; the selected tab is its CSS fallback.
    rail.addEventListener('pointerover',event=>{
      if(event.pointerType==='touch'){clear();return;}
      const button=event.target.closest('button');
      const index=tabs.indexOf(button);
      if(index<0||button.disabled||index===hovered)return;
      hovered=index;
      rail.style.setProperty('--collection-hover-tab',String(index));
    },{passive:true});
    rail.addEventListener('pointerleave',clear,{passive:true});
    rail.addEventListener('pointercancel',clear,{passive:true});
  }
  function replaceViewContent(main,html){
    const current=state.page==='mods'&&state.title==='tf2'&&main.querySelector(':scope > .mods-editorial');
    const rail=current&&current.querySelector(':scope > .collection-tabs');
    if(!rail){
      main.innerHTML=html;
      const mounted=main.querySelector('.collection-tabs');
      if(mounted)bindCollectionTabPointer(mounted);
      return;
    }
    const next=fragmentOf(html).content.firstElementChild;
    const buttons=next.querySelectorAll('.collection-tabs > button');
    const existing=rail.querySelectorAll('button');
    for(let i=0;i<existing.length;i++){
      const button=existing[i],incoming=buttons[i],active=incoming.classList.contains('active');
      button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'page':'false');
      const count=button.querySelector('small'),nextCount=incoming.querySelector('small');
      if(count&&nextCount&&count.textContent!==nextCount.textContent)count.textContent=nextCount.textContent;
    }
    // The rail stays mounted so focus and an in-flight transition survive async content updates.
    current.dataset.collection=next.dataset.collection;
    for(const selector of [':scope > .page-heading',':scope > .collection-body']){
      current.querySelector(selector).replaceWith(next.querySelector(selector));
    }
  }
  function renderView(animatePage=false){const main=document.getElementById('main');if(!main)return uiRender(animatePage);const html=({home:homePage,servers:serversPage,mods:modsPage,installer:installerPage,account:accountPage,settings:settingsPage}[state.page])();if(!animatePage&&main._tfxHTML===html){renderShell();return;}if(!animatePage&&state.page==='settings'&&main._tfxPage==='settings'&&patchSettingsSection(main,html))return;main._tfxHTML=html;const collectionBefore=collectionSnapshot(main);const saved=animatePage||main._tfxPage!==state.page?null:captureLocalViewState();renderShell();clearPageEnter(main);const tracks=retainTracks(main);disposeHoverTracks(main);main._tfxPage=state.page;const previousButtons=new Map([...main.querySelectorAll('button.toggle')].map(button=>[button.dataset.action,button]));const previousToggles=new Map([...previousButtons].map(([key,button])=>[key,Number(button.dataset.toggleProgress)]));replaceViewContent(main,html);restoreTracks(main,tracks);main.querySelectorAll('button.toggle').forEach(fresh=>{const old=previousButtons.get(fresh.dataset.action);if(!old)return;old.className=fresh.className;old.disabled=fresh.disabled;for(const name of ['aria-checked','aria-label','title']){if(fresh.hasAttribute(name))old.setAttribute(name,fresh.getAttribute(name));else old.removeAttribute(name);}fresh.replaceWith(old);});syncToggleVisuals(main,previousToggles);bindPolishedState(main);if(animatePage&&!motionReduced()){void main.offsetWidth;const onEnd=e=>{if(e.target!==main||e.animationName!=='tfx-page-enter')return;clearPageEnter(main);};main._pageEnterHandler=onEnd;main.addEventListener('animationend',onEnd);main.classList.add('page-enter');main._pageEnterTimer=window.setTimeout(()=>clearPageEnter(main),340);}document.title=`TFX Launcher - ${tr(state.page)}`;bindHoverTracks();if(document.fonts?.ready)document.fonts.ready.then(refreshHoverTracks);bindLocalInputs();restoreLocalViewState(saved);animateCollection(main,collectionBefore);requestAnimationFrame(()=>{refreshHoverTracks();});}
  function patchSettingsSection(main,html){
    const menu=main.querySelector('.settings-menu'),card=main.querySelector('.settings-card');
    if(!menu||!card||card.dataset.settingsView===state.settingsView)return false;
    const next=fragmentOf(html).content.querySelector('.settings-card');
    if(!next)return false;
    const selected=menu.querySelector(`[data-action="settingview-${CSS.escape(state.settingsView)}"]`);
    if(!selected)return false;
    for(const button of menu.querySelectorAll('button')){
      button.classList.toggle('active',button===selected);
      button.setAttribute('aria-current',button===selected?'page':'false');
    }
    menu._refreshChoice?.();
    disposeHoverTracks(card);
    card.replaceChildren(...next.childNodes);
    card.dataset.settingsView=state.settingsView;
    main._tfxHTML=html;
    syncToggleVisuals(card);
    bindPolishedState(main);
    bindLocalInputs();
    return true;
  }
  render = function(...args){
    if(library?.weapons)arsenalWeapons.splice(0,arsenalWeapons.length,...library.weapons.map(w=>[w.id,esc(w.names?.[I18n.current]||w.name||w.label||w.id),I18n.text(({rifle:'突击步枪',smg:'冲锋枪',lmg:'轻机枪',sniper:'狙击枪',shotgun:'霰弹枪',grenadier:'榴弹武器',pistol:'手枪',antiTitan:'反泰坦武器',titan:'泰坦武器'})[w.category]||w.category||'')]));
    applyPendingMods();
    if(motionPage===state.page&&now()<motionUntil){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{renderTimer=null;render();},Math.max(1,motionUntil-now()));paintData();return;}
    clearTimeout(renderTimer);renderTimer=null;renderView(...args);paintData();
  };
  function modData(value) {
    const grouped=new Map();
    for(const row of value?.all || []){
      const key=row.package?JSON.stringify([row.package.author,row.package.package_name,row.package.version]):row.name;
      let item=grouped.get(key);
      if(!item){item={id:'m'+encodeURIComponent(key),name:esc(row.package?.manifest?.name||row.package?.package_name||row.manifest_name||row.name),author:esc(row.author||row.package?.author||''),description:esc(row.description||''),version:esc(row.version||row.package?.version||''),enabled:false,core:false,kind:'client',icon:row.required?'shield':'cube',names:[],package:row.package,controllable:false};grouped.set(key,item);}
      item.names.push(row.name);item.enabled ||= !row.disabled;item.core ||= !!row.required;item.controllable ||= row.stateControl!==false;
    }
    state.mods=[...grouped.values(),...state.mods.filter(m=>m.kind==='icepick')];
    render();
  }
  async function clients() {
    const generation=++requestGeneration, at=context();
    const results=await Promise.allSettled([call('northstar-client-status',{region:'cn'}),call('northstar-client-status',{region:'global'}),call('vanilla-client-status'),call('dds-protection-status')]);
    if(generation!==requestGeneration||at!==context())return;
    results.forEach((r,i)=>{if(r.status!=='fulfilled')return;if(i<2)client[['cn','global'][i]]=r.value;else if(i===2)official=r.value;else{protection=r.value.protection;gameReady=!!r.value.game?.ready;state.protection=protection?.enabled!==false;}});
    state.ns={cn:!!client.cn?.installed,global:!!client.global?.installed};
    state.runtime=official?.installed?'global':'';render();
  }
  async function accounts(){account=ok(await call('ea-status'));state.loggedIn=!!account?.loggedIn;accountCheckedAt=new Date().toISOString();render();}
  async function accountPanel(){await accounts();return runEA('正在检查本地连接…',()=>refreshDiagnostics(false));}
  async function icepick(){const r=ok(await call('icepick-status'));const data=r?.status;if(!data)return;icepickPath=data.modsDirectory||'';state.mods=state.mods.filter(m=>m.kind!=='icepick');for(const m of data.mods||[])state.mods.push({id:'ice:'+encodeURIComponent(m.id||m.name),rawId:m.id||m.name,name:esc(m.name),author:esc((m.authors||[]).join(', ')),description:esc(m.description||''),version:esc(m.version||''),enabled:m.enabled!==false,core:!!m.core,controllable:!m.core,kind:'icepick',icon:'image'});render();}
  const communityCache=new Map(), communityRequests=new Map();
  function showCommunity(region){
    if(state.title!=='tf2'||state.serverRegion!==region)return;
    const r=communityCache.get(region);
    servers.splice(0,servers.length,...(r.servers||[]).map(s=>{
      if(!serverIds.has(s.key))serverIds.set(s.key,nextServerId++);
      return {id:serverIds.get(s.key),key:s.key,name:esc(s.name),region,mode:esc(s.mode),map:esc(s.map),players:s.players,max:s.maxPlayers,ping:'—',owner:esc(s.location||''),desc:esc(s.description),mods:esc((s.requiredMods||[]).map(m=>m.name+' '+m.version).join(' / '))};
    }));
    communityListView.status=r.status;
    communityListView.fetchedAt=r.fetchedAt;
    communityListView.refreshing=communityRequests.has(region);
    if(r.status==='online'&&servers.length){
      for(const [filter,field] of [['serverMode','mode'],['serverMap','map']]){
        if(state[filter]!=='all'&&!servers.some(s=>s[field]===state[filter]))state[filter]='all';
      }
    }
    state.favorites=servers.filter(s=>(prefs.prototypeFavorites||[]).includes(s.key)).map(s=>s.id);
    render();
  }
  function serverList(force=false){
    const region=state.serverRegion;
    if(!communityCache.has(region))communityCache.set(region,{status:'loading'});
    if(!communityRequests.has(region)){
      const task=call('server-list-get',{region,force}).then(r=>{
        communityCache.set(region,r);return r;
      }).catch(()=>{
        const previous=communityCache.get(region);
        const result={...previous,status:previous.fetchedAt!=null?'stale':'unavailable'};
        communityCache.set(region,result);return result;
      }).finally(()=>{communityRequests.delete(region);showCommunity(region);});
      communityRequests.set(region,task);
    }
    showCommunity(region);
    return communityRequests.get(region);
  }
  async function catalogList(){
    if(loadingCatalog)return loadingCatalog;
    loadingCatalog=(async()=>{let data=await call('request','northstar.thunderstore.io','/api/v1/package/','thunderstore-packages');if(typeof data==='string')data=JSON.parse(data);if(!Array.isArray(data))throw Error('模组列表暂时不可用');catalog.splice(0,catalog.length,...data.filter(p=>p.versions?.[0]).map((p,i)=>{const v=p.versions[0];return {id:'pkg'+i,name:esc(p.name),author:esc(p.owner),rawOwner:p.owner,rawName:p.name,kind:'client',tag:'客户端',art:'',icon:'cube',desc:esc(v.description||''),version:v.version_number,size:((v.file_size||0)/1048576).toFixed(1)+' MB',download:v.download_url};}));render();})().finally(()=>loadingCatalog=null);
    return loadingCatalog;
  }
  async function weaponList(){
    library=ok(await call('weapon-library-list'));if(!library)return;
    arsenalRecords.splice(0,arsenalRecords.length,...library.items.filter(item=>['dds','vtf'].includes(item.format)).flatMap(item=>(item.weaponIds||[]).map(weapon=>({id:item.id+':'+weapon,weapon,name:esc(item.name),format:String(item.format).toUpperCase(),state:(item.currentWeaponIds||[]).includes(weapon)?'当前装配':'历史记录',time:esc(item.createdAt||''),record:item}))));
    state.arsenal.restoredOriginal=library.stateOriginalCurrentWeaponIds||[];
    state.history=library.items.map(item=>({name:esc(item.name),format:String(item.format).toUpperCase(),time:esc(item.createdAt||'')}));render();
  }
  async function inspect(channel,input={}){
    if(state.page!=='installer')navigate('installer');
    const dropped=Boolean(input.path),name=dropped?String(input.name||input.path).split(/[\\/]/).pop():'';
    importFeedback.set({game:'tf2',stage:dropped?'reading':'choosing',name,detail:dropped?'正在检查文件内容':'',percent:null});
    selection=null;state.file=null;render();
    await importFeedback.frame();
    try{
      const at=context(),result=ok(await call(channel,input));
      if(!result){importFeedback.set({stage:'cancelled',detail:'',percent:null});return;}
      if(at!==context())throw Error('游戏目录已改变，请重新导入文件');
      selection=result;
      state.format={dds:'DDS',vtf:'VTF',mod:'Northstar Mod',icepick:'Icepick'}[result.format]||state.format;
      const pack=result.state?.package;
      state.file=pack?{name:pack.name||result.sourceName,size:((pack.bytes||0)/1048576).toFixed(1)+' MB'}:null;
      if(result.installed){selection=null;state.file=null;importFeedback.set({stage:'done',name:result.sourceName||name,detail:'',percent:100});toast('安装完成');}
      else importFeedback.set({stage:'ready',name:result.sourceName||pack?.name||name,detail:'',percent:null});
      navigate('installer');
    }catch(error){importFeedback.set({stage:importFeedback.state.stage==='installing'?'installError':'readError',detail:error.message||String(error),percent:null});throw error;}
  }
  async function installSelection(){
    if(!selection?.state?.package)return;
    const s=selection,pack=s.state.package;
    importFeedback.set({game:'tf2',stage:'installing',name:pack.name||s.sourceName||'',detail:'正在准备安装',percent:null});
    await importFeedback.frame();
    try{
    let result;
    const needsRecovery=['dds','vtf'].includes(s.format)&&(!s.state.game?.ready||(s.state.original&&s.state.original.state!=='ready')||s.state.skinRepair?.ready===false);
    if(needsRecovery){
      const identity={packageId:pack.id,selectionRevision:s.state.selectionRevision,installAfterRepair:true};
      const planned=ok(await call(s.format+'-resource-plan',identity));if(!planned){importFeedback.set({stage:'ready',detail:'',percent:null});return;}
      const plan=planned.plan||planned;
      if(!plan.localRepair&&!confirm('安装需要下载原始资源，确认继续？\n'+JSON.stringify(plan,null,2))){importFeedback.set({stage:'ready',detail:'',percent:null});return;}
      showResult('检查与安装','正在准备资源');
      try {result=ok(await call(s.format+'-resource-download',identity));}
      finally {modal.close();}
      if(result&&!result.installed)throw Error(result.message||'资源处理尚未完成');
    }else result=ok(await call(s.format==='mod'?'skin-import-install':s.format+'-install',s.format==='mod'?{id:pack.id}:{packageId:pack.id,selectionRevision:s.state.selectionRevision}));
    if(!result){importFeedback.set({stage:'ready',detail:'',percent:null});return;}
    if(result.confirmationRequired||result.waiting){importFeedback.set({stage:'ready',detail:'',percent:null});showResult('检查与安装',result);return;}
    state.file=null;selection=null;importFeedback.set({stage:'done',detail:'',percent:100});toast('安装完成');ipc.send('gui-getmods');
    }catch(error){importFeedback.set({stage:'installError',detail:error.message||String(error),percent:null});throw error;}
    await weaponList().catch(report);
  }
  async function selectMode(action) {
    if(state.busy||modRequests.size)return;
    const key=action.startsWith('game-')?'game':action.startsWith('region-')?'region':'vanilla';
    const prevRoot=root(), prevIndependent=state.independent;
    state[key]=action.slice(key.length+1);state.launchProgress=0;state.launchStep='';
    modeDesired={northstarRegion:state.region,modProfileServer:state.game==='vanilla'?'official':state.region,vanillaModsEnabled:state.vanilla==='mods'};
    modePending=true;
    // One immediate layout update retains the existing mode track and thumb.
    renderView();paintData();protectMotion();
    if(modeTask)return modeTask;
    modeTask=(async()=>{
      try {
        while(modeDesired){const patch=modeDesired;modeDesired=null;try{if(!await save(patch))throw Error('切换未完成');}catch(error){report(error);}}
      } finally {
        modePending=false;modeTask=null;settingsToState();
        const nextRoot=root();
        const needMods=prevRoot!==nextRoot||prevIndependent||state.independent;
        const needClients=!client.cn||!client.global||!official||prevRoot!==nextRoot;
        render();
        if(needMods)ipc.send('gui-getmods');
        if(needClients)clients().catch(report);
      }
    })();
    return modeTask;
  }
  async function toggleMod(id){
    const mod=state.mods.find(m=>m.id===id);if(!mod||mod.core||!mod.controllable||modePending)return;
    let pending=modRequests.get(id);
    if(pending){pending.desired=!pending.desired;mod.enabled=pending.desired;updateSwitch('modtoggle-'+id,pending.desired);protectMotion();return pending.task;}
    pending={desired:!mod.enabled,confirmed:mod.enabled,task:null};modRequests.set(id,pending);pendingMods.add(id);
    mod.enabled=pending.desired;updateSwitch('modtoggle-'+id,pending.desired);protectMotion();paintData();
    pending.task=(async()=>{
      try{
        while(pending.desired!==pending.confirmed){
          const target=pending.desired;
          try{
            const write=modWriteTail.then(()=>call(mod.kind==='icepick'?'icepick-toggle':'set-mod-state',mod.kind==='icepick'?mod.rawId:{names:mod.names,enabled:target,...(mod.package?{package:mod.package}:{})}));modWriteTail=write.catch(()=>{});const result=ok(await write);
            if(!result)throw Error('模组状态未保存');pending.confirmed=target;
            if(result.mods)modData(result.mods);
          }catch(error){report(error);pending.desired=pending.confirmed;}
        }
      }finally{
        const current=state.mods.find(m=>m.id===id);if(current)current.enabled=pending.confirmed;
        modRequests.delete(id);pendingMods.delete(id);updateSwitch('modtoggle-'+id,pending.confirmed);render();
        if(mod.kind==='icepick')icepick().catch(report);else ipc.send('gui-getmods');
      }
    })();return pending.task;
  }
  launch=async function(){
    if(state.busy||operation||modePending||modRequests.size||deltaViews.busy)return;
    if(state.title==='tf1')return runTitanfall1(true);
    await exclusive(async()=>{
      let dispatched=false;
      state.busy=true;state.launchProgress=0;state.launchStep='正在启动';
      // Paint before the first IPC await, bypassing the switch-animation render delay.
      renderView();paintData();
      try{
        if(!client[state.region] || !official)await clients();
        if(!root()){ipc.send(state.region==='global'&&state.game==='northstar'?'setglobalpath':'setpath');return;}
        if(state.game==='northstar'&&!state.ns[state.region]){await installClient();return;}
        if(state.game==='vanilla'&&state.vanilla==='mods'&&!official?.installed){ok(await call('vanilla-client-install',{}));await clients();return;}
        ipc.send(state.game==='northstar'?'launch-ns':'launch-vanilla');dispatched=true;
      }catch(error){state.launchStep=error.message||'启动失败';throw error;}
      finally{if(!dispatched){state.busy=false;if(state.launchStep==='正在启动')state.launchStep='待命';paintData();}}
    });
  };
  async function installClient(){
    if(!root()){
      const r=ok(await call(state.region==='global'?'global-game-root-install':'china-game-root-install'));if(!r)return;
      prefs=fold.loadSettings().data;settingsToState();
    }
    const r=ok(await call('northstar-client-install',{region:state.region,repair:true}));
    if(r){toast('客户端安装完成');await clients();}
  }
  saveSettings=async function(){
    const patch={prototypeTheme:state.theme,uiLanguage:nativeLanguages[state.language],independentServerMods:state.independent,nsupdate:state.autoUpdate,nsargs:state.nsArgs};
    if(protection && protection.enabled!==state.protection)ok(await call('dds-protection-set',{enabled:state.protection}));
    if(await save(patch)){state.dirty=false;state.savedSettings={...state.savedSettings,...Object.fromEntries(['theme','language','protection','independent','autoUpdate','nsArgs','gamePath'].map(k=>[k,state[k]]))};render();toast('设置已保存');}
  };
  handleFiles=files=>{if(files?.length)exclusive(()=>inspect('skin-import-inspect',{path:fold.getDroppedFilePath(files[0]),name:files[0].name}));};
  const deltaViews=window.createDeltaViews({state,call,ok,render:()=>render(),navigate:(...args)=>navigate(...args),report,toast,updateSwitch,protectMotion,esc,I,btn,toggle,heading,refreshStatus:()=>r1Status(),importFeedback});
  const titan2ServersPage=serversPage,titan2ModsPage=modsPage,titan2InstallerPage=installerPage;
  serversPage=function(){return state.title==='tf1'?deltaViews.servers():titan2ServersPage();};
  modsPage=function(){return state.title==='tf1'?deltaViews.mods():titan2ModsPage();};
  installerPage=function(){return state.title==='tf1'?deltaViews.installer():titan2InstallerPage();};
  navigate=function(page,...args){
    uiNavigate(page,...args);if(state.page!==page)return;protectMotion();
    if(state.title==='tf1'){const task=page==='servers'?deltaViews.refreshServers():['mods','installer'].includes(page)?deltaViews.refresh():null;task?.catch(report);return;}
    const task=page==='servers'?serverList():page==='account'?accountPanel():page==='mods'?(state.modTab==='arsenal'?weaponList():state.modTab==='discover'?catalogList():icepick()):page==='installer'?weaponList():null;task?.catch(report);if(page==='mods')ipc.send('gui-getmods');
  };
  const localPrefixes=['serverfilter-','modinfo-','cataloginfo-','arsenal-weapon-','arsenal-format-','settingview-','theme-','discard-'];
  async function r1Status(){
    if(r1StatusTask)return r1StatusTask;
    r1StatusTask=(async()=>{titanfall1=ok(await call('r1delta-status'));render();return titanfall1;})();
    try{return await r1StatusTask;}finally{r1StatusTask=null;}
  }
  async function runTitanfall1(start){return exclusive(async()=>{
    state.busy=true;state.launchProgress=0;state.launchStep=start?'正在启动':'正在检查 Delta 版本';renderView();paintData();
    try{
      if(start&&state.r1Mode==='steam'){ok(await call('r1delta-launch-steam'));state.launchStep='已向 Steam 发送启动请求';state.launchProgress=100;return;}
      titanfall1=ok(await call('r1delta-status'));
      if(!start||!titanfall1.installed||!titanfall1.gameInstalled){const result=ok(await call('r1delta-install'));if(!result){state.launchStep='已取消';state.launchProgress=0;return;}titanfall1=result;}
      if(start){state.launchProgress=0;state.launchStep='正在启动 Delta';paintData();ok(await call('r1delta-launch'));}else{state.launchStep='Delta 核心已就绪';state.launchProgress=100;}
    }catch(error){state.launchProgress=0;state.launchStep='操作失败';throw error;}finally{state.busy=false;render();}
  });}
  const localActions=new Set(['close-modal','home','account','language','release','feedback','open-arsenal','launch-options','toggle-sort','clear-mod-filters','clear-server-filters','toggle-history','arsenal-cancel','arsenal-toggle-weapons','arsenal-toggle-records']);
  async function dispatch(action){
    if(operation&&!['close-modal','cancel-resource'].includes(action))return;
    if(action.startsWith(eaSwitchPrefix)){
      const id=action.slice(eaSwitchPrefix.length);
      if(state.busy||id===account.accountId||!account.accounts?.some(entry=>entry.accountId===id))return;
      return runEA('正在切换 EA 账号…',async()=>{
        ok(await call('ea-switch-account',id));
        diagnostics=null;await accounts();await refreshDiagnostics(false);
        eaMessage=account.expired?'此账号的登录已过期，请重新连接。':'已切换 EA 账号。';
      });
    }
    if(state.title==='tf1'&&action.startsWith('r1-'))return deltaViews.dispatch(action);
    if(state.title==='tf2'&&state.page==='mods'){
      if(action.startsWith('modscope-'))return filterInstalledMods(action.slice(9));
      if(action==='clear-mod-filters'&&document.getElementById('mod-results'))return filterInstalledMods('all',true);
    }
    if(action.startsWith('title-')||action.startsWith('r1mode-')){
      if(state.busy||modePending||modRequests.size||deltaViews?.busy)return;
      if(action.startsWith('title-')){const next=action.slice(6);if(!['tf1','tf2'].includes(next))return;state.title=next;try{localStorage.setItem('tfx-title',next);}catch{}}
      else{const next=action.slice(7);if(!['steam','delta'].includes(next))return;state.r1Mode=next;try{localStorage.setItem('tfx-r1-mode',next);}catch{}}
      state.launchProgress=0;state.launchStep='等待启动';renderView();paintData();protectMotion();if(state.title==='tf1'){await r1Status();if(state.page==='servers')await deltaViews.refreshServers();else if(['mods','installer'].includes(state.page))await deltaViews.refresh();}else if(state.page==='servers')return serverList();return;
    }
    if(state.title==='tf1'&&state.page==='home'){
      if(action==='directory')return exclusive(async()=>{const result=ok(await call('r1delta-select'));if(result)titanfall1=result;});
      if(action==='install-client')return runTitanfall1(false);
      if(action==='repair'){await r1Status();showResult('启动检查',titanfall1);return;}
    }
    if(localActions.has(action)||localPrefixes.some(p=>action.startsWith(p))){uiPerform(action);return;}
    if(action.startsWith('arsenal-restore-')){
      const id=action.slice(16),record=arsenalRecords.find(r=>r.id===id);
      if(id==='original'?!library?.stateRestoreWeaponIds?.includes(state.arsenal.weapon):!record?.record.stateRestoreWeaponIds?.includes(record.weapon))throw Error('当前记录无法恢复');
      uiPerform(action);return;
    }
    if(action.startsWith('setlang-')){
      const previous=state.language,next=action.slice(8);if(!nativeLanguages[next])return;
      uiPerform(action);
      if(state.page!=='settings'){try{await save({uiLanguage:nativeLanguages[state.language]});state.savedSettings.language=state.language;}catch(error){setLanguage(previous);throw error;}}
      return;
    }
    if(action==='launch')return launch();
    if(action.startsWith('game-')||action.startsWith('region-')||action.startsWith('vanilla-'))return selectMode(action);
    if(action.startsWith('modtoggle-'))return toggleMod(action.slice(10));
    if(action==='servers-cn'||action==='servers-global'){
      const region=action.slice(8);
      if(region===state.serverRegion)return;
      Object.assign(state,{serverRegion:region,serverQuery:'',serverMode:'all',serverMap:'all',serverFilter:'all',selectedServer:null,serverDetailOpen:false});
      return serverList();
    }
    if(action.startsWith('favorite-')){uiPerform(action);await save({prototypeFavorites:servers.filter(s=>state.favorites.includes(s.id)).map(s=>s.key)});return;}
    if(action.startsWith('modtab-')){uiPerform(action);return state.modTab==='arsenal'?weaponList():state.modTab==='browse'||state.modTab==='discover'?catalogList():icepick();}
    if(action.startsWith('sort-')){uiPerform(action);return save({modSort:state.modSort});}
    if(action.startsWith('savego-'))return exclusive(async()=>{await saveSettings();modal.close();navigate(action.slice(7));});
    if(action.startsWith('remove-mod-'))return exclusive(async()=>{const m=state.mods.find(m=>m.id===action.slice(11));if(!m||m.core)return;if(!confirm('卸载模组：'+m.name+'？'))return;if(m.kind==='icepick'){ok(await call('icepick-remove',m.rawId));await icepick();}else ipc.send('remove-mod',{name:m.names[0],...(m.package?{package:m.package}:{})});modal.close();});
    if(action.startsWith('cataloginstall-')){const m=catalog.find(m=>m.id===action.slice(15));if(m)ipc.send('install-from-url',m.download,m.rawOwner,m.rawName,m.version);return;}
    if(action.startsWith('join-')||action==='confirm-join'){toast('启动器不提供直接加入服务器。');return;}
    if(action.startsWith('format-')){state.format=action.slice(7);state.file=null;selection=null;await call('skin-import-clear');render();return;}
    if(action.startsWith('sample-')||action.startsWith('folder-'))return exclusive(()=>inspect('skin-import-select',{kind:action.startsWith('folder-')?'folder':'file'}));
    switch(action){
      case 'directory':case 'game-directory':case 'install-target':ipc.send(action==='directory'&&state.game==='northstar'&&state.region==='global'?'setglobalpath':'setpath');return;
      case 'global-directory':ipc.send('setglobalpath');return;
      case 'open-folder':return fold.openPath(root()||'');
      case 'install-client':case 'confirm-client-install':return exclusive(state.game==='vanilla'?async()=>{ok(await call('vanilla-client-install',{}));await clients();}:installClient);
      case 'replace-runtime':return exclusive(async()=>{ok(await call('vanilla-client-install',{}));await clients();});
      case 'repair':await clients();showResult('启动检查',{client:client[state.region],official,protection});return;
      case 'refresh-servers':return serverList(true);
      case 'toggle-all':return exclusive(async()=>{
        const mods=state.mods.filter(m=>!m.core&&m.controllable&&(state.modTab==='icepick'?m.kind==='icepick':m.kind!=='icepick')),enabled=!mods.every(m=>m.enabled);
        if(!mods.length)return;
        if(state.modTab==='icepick'){for(const m of mods)if(m.enabled!==enabled)ok(await call('icepick-toggle',m.rawId));await icepick();}
        else{ok(await call('set-mod-state',{selections:mods.map(m=>({names:m.names,enabled,...(m.package?{package:m.package}:{})}))}));ipc.send('gui-getmods');}
      });
      case 'remove-all':case 'confirm-remove-all':return exclusive(async()=>{
        if(!confirm('卸载用户模组？核心组件会保留。'))return;
        if(state.modTab==='icepick'){for(const m of state.mods.filter(m=>m.kind==='icepick'&&!m.core))ok(await call('icepick-remove',m.rawId));await icepick();}
        else ipc.send('remove-mod','allmods');modal.close();
      });
      case 'choose-file':case 'import-mod':return exclusive(()=>inspect('skin-import-select'));
      case 'choose-folder':return exclusive(()=>inspect('skin-import-select',{kind:'folder'}));
      case 'clear-file':await call('skin-import-clear');selection=null;state.file=null;importFeedback.set({stage:'idle'});render();return;
      case 'install':case 'install-file':case 'install-skin':case 'install-package':return exclusive(installSelection);
      case 'icepick-directory':ok(await call('icepick-select'));return icepick();
      case 'refresh-icepick':return icepick();
      case 'ea-toggle':{
        if(eaTask||state.busy)return;
        const previous=state.eaEnabled;state.eaEnabled=!previous;protectMotion();updateSwitch(action,state.eaEnabled);
        return runEA('正在保存模拟器设置…',async()=>{try{await save({eaEmulator:state.eaEnabled});settingsToState();await refreshDiagnostics(false);eaMessage=state.eaEnabled?'已启用；本地服务会在启动游戏时建立。':'EA 模拟器已关闭。';}catch(error){state.eaEnabled=previous;updateSwitch(action,previous);throw error;}});
      }
      case 'independent':return exclusive(async()=>{await save({independentServerMods:!state.independent});settingsToState();ipc.send('gui-getmods');});
      case 'independent-setting':state.independent=!state.independent;markDirty();updateSwitch(action,state.independent);return;
      case 'protection-toggle':state.protection=!state.protection;markDirty();updateSwitch(action,state.protection);return;
      case 'auto-update':state.autoUpdate=!state.autoUpdate;markDirty();updateSwitch(action,state.autoUpdate);return;
      case 'login':case 'ea-add-account':case 'ea-reconnect':return runEA('等待 EA 登录窗口完成连接…',async()=>{
        if(state.busy)return;
        const result=await call('ea-login',action==='ea-reconnect'?{accountId:account.accountId}:{});
        if(result?.code==='EA_LOGIN_CANCELLED'||result?.cancelled){eaMessage='已取消登录。';return;}
        ok(result);diagnostics=null;await accounts();await refreshDiagnostics(false);eaMessage='EA 账户已连接。';
      });
      case 'logout':if(eaTask||state.busy||!confirm('退出当前 EA 账号？其他账号将保留。'))return;return runEA('正在退出账户…',async()=>{ok(await call('ea-logout'));diagnostics=null;await accounts();await refreshDiagnostics(false);eaMessage='已退出 EA 账户。';});
      case 'refresh-account':return runEA('正在刷新账户凭据…',async()=>{
        if(!state.loggedIn){await accounts();await refreshDiagnostics(false);eaMessage='尚未登录，请先连接 EA 账户。';return;}
        const result=await call('ea-refresh');await accounts();await refreshDiagnostics(false);ok(result);eaMessage='账户状态已刷新。';
      });
      case 'diagnose':return runEA('正在检查本地连接及 EA 登录站点…',async()=>{await refreshDiagnostics(true);eaMessage='诊断完成，'+diagnostics.view.label+'。';});
      case 'repair-ea':return runEA('正在修复启动桥接并复查连接…',async()=>{
        const result=ok(await call('ea-diagnostics-repair'));diagnostics=result.diagnostics;prefs=fold.loadSettings().data;settingsToState();await accounts();
        eaMessage=result.repaired?'启动桥接已修复；'+diagnostics.view.label+'。':'部分问题仍需处理，请查看诊断项目。';eaError=!result.repaired;
      });
      case 'copy-diagnostics':return runEA('正在复制诊断报告…',async()=>{if(!diagnostics)await refreshDiagnostics(false);ok(await call('ea-diagnostics-copy'));eaMessage='诊断报告已复制，可直接粘贴发送。';toast('诊断报告已复制');});
      case 'open-ea-log':case 'open-lsx-log':return runEA('正在打开日志…',async()=>{ok(await call('ea-diagnostics-open-log',action==='open-ea-log'?'ea':'lsx'));eaMessage=(action==='open-ea-log'?'EA':'LSX')+' 日志已打开。';});
      case 'check-protection':await clients();showResult('皮肤启动保护',protection);return;
      case 'capture-originals':if(!confirm('请确认当前资源处于原版状态。记录原始资源？'))return;return exclusive(async()=>{ok(await call('dds-protection-capture'));await clients();});
      case 'clear-cache':if(confirm('清理下载缓存？'))return exclusive(async()=>{
        const button=document.querySelector('[data-action="clear-cache"]');if(button)button.disabled=true;
        try{
          const result=ok(await call('download-cache-clear'));
          const bytes=result.bytes>=1048576?(result.bytes/1048576).toFixed(1)+' MB':(result.bytes/1024).toFixed(1)+' KB';
          showResult('下载缓存',result.files?I18n.text('清理完成。')+' '+bytes:'没有需要清理的下载缓存。');
        }finally{if(button)button.disabled=false;}
      });return;
      case 'view-logs':ok(await call('launcher-log-open'));return;
      case 'save-settings':return exclusive(saveSettings);
      case 'reset-settings':if(!confirm('恢复默认设置？'))return;return exclusive(async()=>{const result=ok(await call('settings-restore-defaults'));prefs=result.settings;state.dirty=false;settingsToState();await clients();});
      case 'arsenal-confirm':return exclusive(async()=>{const record=arsenalRecords.find(r=>r.id===state.arsenal.confirm);const r=ok(await call('weapon-library-restore',{weaponId:record?.weapon||state.arsenal.weapon,targetMode:state.arsenal.confirm==='original'?'original':'installed',...(record?{recordId:record.record.id}:{})}));if(r?.stateRestored){state.arsenal.confirm=null;await weaponList();toast('还原完成');}else showResult('还原材质',r);});
      case 'project-info':return fold.openExternal('https://github.com/harrycaoguitar/TFX_Launcher_forNorthStar');
      case 'check-update':return checkSettingsUpdate(state.settingsView==='update');
      case 'install-northstar-update':return installSettingsUpdate(true);
      case 'install-launcher-update':return installSettingsUpdate(false);
      case 'open-launcher-release':ok(await call('launcher-update-open',{kind:'release'}));return;
      default:toast('当前操作未接入：'+action);
    }
  }
  perform=action=>Promise.resolve(dispatch(action)).catch(report);
  // Capture switches before the prototype's optimistic demo handler changes state.
  document.addEventListener('click',event=>{const button=event.target.closest('button.toggle');if(!button)return;event.stopImmediatePropagation();event.preventDefault();if(!button.disabled&&!operation&&!state.busy)perform(button.dataset.action);},true);
  ipc.on('mods',(_event,value)=>modData(value));
  ipc.on('changed-settings',(_event,value)=>{prefs={...prefs,...value};if(!state.dirty)settingsToState();render();});
  for(const event of ['newpath','globalpath-selected','gamepath-status','globalpath-status'])ipc.on(event,()=>{prefs=fold.loadSettings().data;settingsToState();selection=null;state.file=null;clients().catch(report);});
  ipc.on('version',(_event,value)=>{versions=value;paintData();});
  ipc.on('launcher-update-progress',(_event,value)=>{
    const status=document.getElementById('settings-update-status');
    if(status&&Number.isFinite(value?.percent))status.textContent=I18n.text('正在下载更新…')+' '+value.percent+'%';
  });
  ipc.on('ns-update-event',(_event,value)=>{
    const status=document.getElementById('settings-update-status');
    if(status&&northstarUpdate&&Number.isFinite(value?.progress))status.textContent=I18n.text('正在下载更新…')+' '+value.progress+'%';
  });
  ipc.on('r1delta-progress',(_event,value)=>{if(state.title!=='tf1')return;state.launchStep=value.phase||'正在启动';state.launchProgress=Number.isFinite(value.percent)?Math.max(0,Math.min(100,value.percent)):0;paintData();if(value.error)report(value.error);});
  let connectionNotice = '';
  const connectionMessages = {
    'session-expired':'登录会话已失效。请退出其他目录或设备上的重复北极星客户端，再重启游戏重新登录。',
    'master-unreachable':'暂时无法连接北极星主服务器。请检查网络或代理后重试；这不代表 EA 账号无效。',
    'auth-rejected':'游戏账号认证未通过。请确认 Steam / EA App 已登录拥有游戏的账号，再重启游戏。',
    'server-timeout':'连接游戏服务器超时。请换一台服务器重试；多台都失败时，再检查网络或代理。'
  };
  ipc.on('northstar-connection',(_event,value)=>{
    if(!value || !(value.code==='authenticated'||Object.hasOwn(connectionMessages,value.code)))return;
    const message=value.code==='authenticated'?'北极星账号认证已通过':
      (value.code==='server-timeout'&&value.authenticated?'主服务器认证已通过。':'')+connectionMessages[value.code];
    const changed=connectionNotice!==message;connectionNotice=message;
    if(state.title==='tf1')return;
    state.launchStep=message;paintData();
    if(changed&&value.code!=='authenticated')toast(message);
  });
  const launchPhaseText = {'prepare-ea':'正在准备 EA 连接','wait-ea':'等待 EA 响应','retry-ea':'正在重试 EA 连接','wait-game':'正在拉起游戏','spawned':'游戏窗口已启动'};
  ipc.on('launch-status',(_event,value)=>{if(value.state==='starting'&&!value.phase)connectionNotice='';if(state.title==='tf1')return;state.busy=value.state==='starting';state.launchProgress=value.state==='confirmed'?100:value.phase==='spawned'?92:0;state.launchStep=value.state==='confirmed'?(connectionNotice||'游戏已启动'):value.state==='failed'?value.error||'启动失败':(launchPhaseText[value.phase]||'正在检查环境');render();});
  ipc.on('launch-guard-result',(_event,value)=>{if(value?.ok===false){state.busy=false;report(value.error||value.message);render();}});
  ipc.on('alert',(_event,value)=>{alert(value.message);ipc.send('alert-closed-'+value.id);});
  ipc.on('confirm',(_event,value)=>{const answer=confirm(value.message);ipc.send('confirm-closed-'+value.id,answer);});
  for(const event of ['unknown-error','gamepath-error','wrong-path','failed-mod'])ipc.on(event,(_event,value)=>report(value?.message||value?.error||value));
  ipc.on('log',(_event,value)=>{log.push(String(value));if(log.length>200)log.shift();});
  for(const event of ['installed-mod','removed-mod'])ipc.on(event,()=>ipc.send('gui-getmods'));
  for(const channel of ['dds-progress','vtf-progress','skin-import-progress','northstar-client-progress','vanilla-client-progress','weapon-library-progress'])ipc.on(channel,(_event,value)=>{
    log.push(JSON.stringify(value));const label=document.getElementById('progress-step');if(label)label.textContent=value.phase||'';const bar=document.getElementById('progress-bar');if(bar&&Number.isFinite(value.percent))bar.style.width=value.percent+'%';
    const feedback=importFeedback.state;
    if(feedback.game!=='tf2'||!['choosing','reading','installing'].includes(feedback.stage)||!['dds-progress','vtf-progress','skin-import-progress'].includes(channel))return;
    if(value.stage==='reading'){importFeedback.set({stage:'reading',name:value.sourceName||feedback.name,detail:'正在检查文件内容',percent:null});return;}
    if(value.stage==='installing'){importFeedback.set({stage:'installing',name:value.sourceName||feedback.name,detail:'正在准备安装',percent:null});return;}
    const names={inspect:'正在检查文件内容',validating:'正在校验文件',staging:'正在写入文件',committing:'正在完成安装',backup:'正在准备安装',install:'正在写入文件',installing:'正在准备安装',verify:'正在校验文件',complete:'正在完成安装'};
    if(names[value.phase])importFeedback.set({detail:names[value.phase],percent:Number.isFinite(value.percent)&&!value.estimate?Math.min(99,Math.max(0,Math.round(value.percent))):null});
  });
  let moving=null;
  const dragTarget=target=>target.closest?.('.topbar,.page-heading')&&!target.closest('button,a,input,select,textarea');
  const finishMove=()=>{if(moving){moving=null;call('window-move-end').catch(report);}};
  document.addEventListener('pointerdown',async event=>{
    if(event.button!==0||moving||!dragTarget(event.target))return;
    const session={id:event.pointerId,ready:false};moving=session;
    event.target.setPointerCapture(event.pointerId);
    const accepted=await call('window-move-begin',{x:event.screenX,y:event.screenY}).catch(()=>false);
    if(moving!==session){if(accepted)call('window-move-end').catch(report);return;}
    if(!accepted){finishMove();return;}session.ready=true;
  });
  document.addEventListener('pointermove',event=>{if(moving?.ready&&event.pointerId===moving.id)call('window-move-update',{x:event.screenX,y:event.screenY}).catch(finishMove);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,finishMove);
  window.addEventListener('blur',finishMove);
  document.addEventListener('dblclick',event=>{if(dragTarget(event.target)){finishMove();call('window-toggle-maximize').catch(report);}});
  ipc.on('skin-resource-progress',(_event,value)=>{
    const body=document.querySelector('#modal-content .log');if(body)body.textContent=[value.message||value.phase,Number.isFinite(value.percent)?value.percent+'%':'',...(value.qrLines||[])].filter(Boolean).join('\n');
    if(importFeedback.state.game==='tf2'&&importFeedback.state.stage==='installing')importFeedback.set({detail:'正在准备安装',percent:Number.isFinite(value.percent)&&!value.estimate?Math.min(99,Math.max(0,Math.round(value.percent))):null});
  });
  state.mods=[];state.history=[];state.file=null;state.loggedIn=false;state.busy=false;state.launchProgress=0;state.launchStep='等待启动';state.ns={cn:false,global:false};state.runtime='';
  servers.splice(0);catalog.splice(0);arsenalRecords.splice(0);arsenalWeapons.splice(0);
  settingsToState();state.savedSettings=Object.fromEntries(['theme','language','protection','independent','autoUpdate','nsArgs','gamePath'].map(k=>[k,state[k]]));render();ipc.send('gui-getmods');ipc.send('get-version');
  Promise.allSettled([clients(),accounts()]).then(()=>render());
  if(state.title==='tf1')r1Status().catch(report);
  window.TFXRuntime=Object.freeze({refresh:clients,ready:true,get settings(){return {...prefs};}});
})();
