/* Browser-only stand-in for Electron IPC. No account, game, filesystem or network access. */
(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const listeners = new Map(), calls = [], errors = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const emit = (channel, value) => (listeners.get(channel)||[]).forEach(fn=>fn({},clone(value??{})));
  const notice = text => { if (typeof toast==='function') toast(text); };
  const defaults = {uiLanguage:'zh-CN',prototypeTheme:'airwave',gamepath:'D:\\Games\\Titanfall2',globalGamepath:'D:\\Games\\Titanfall2-Global',northstarRegion:'global',modProfileServer:'global',vanillaModsEnabled:false,eaEmulator:false,independentServerMods:true,nsupdate:true,nsargs:'',modSort:'added'};
  let prefs={...defaults}, selected=null, maximized=false, fullscreen=false, logged=true, active='demo-pilot', scenario='success';
  let accountRows=[{accountId:'demo-pilot',playerName:'Pilot_01',userId:'DEMO-0001'},{accountId:'demo-vanguard',playerName:'Vanguard',userId:'DEMO-0002'}];
  let mods=[
    {name:'Northstar.Client',manifest_name:'Northstar.Client',author:'Northstar',description:'北极星客户端核心组件',version:'1.31.1',required:true,stateControl:false},
    {name:'Northstar.Custom',manifest_name:'Northstar.Custom',author:'Northstar',description:'自定义游戏支持',version:'1.31.1',required:true,stateControl:false},
    {name:'Northstar.CustomServers',manifest_name:'Northstar.CustomServers',author:'Northstar',description:'社区服务器支持',version:'1.31.1',required:true,stateControl:false},
    {name:'TFX.R99Edge',manifest_name:'R99 EDGE',author:'TFX',description:'枪械光效、换弹特效与子弹计数器',version:'1.1.1',disabled:false,stateControl:true},
    {name:'TFX.PilotHUD',manifest_name:'Pilot HUD',author:'TFX',description:'清晰简洁的战斗信息界面',version:'1.0.0',disabled:false,stateControl:true},
    {name:'TFX.PhotoMode',manifest_name:'Photo Mode',author:'TFX',description:'截图与画面展示',version:'1.0.0',disabled:true,stateControl:true}
  ];
  let ice=[{id:'ice-campaign',name:'Campaign Tools',author:'TFX',description:'单人战役演示工具',version:'1.0.0',enabled:true},{id:'ice-camera',name:'Free Camera',author:'TFX',description:'镜头与构图',version:'1.0.0',enabled:false}];
  let addons=[{id:'addon-hud',name:'Frontier HUD',title:'Frontier HUD',type:'folder',kind:'folder',author:'TFX',description:'泰坦陨落 1 界面模组',version:'1.0.0',valid:true,enabled:true,bytes:2460000},{id:'addon-texture',name:'Titan Texture',title:'Titan Texture',type:'vpk',kind:'vpk',author:'TFX',description:'泰坦材质包',version:'1.0.0',valid:true,enabled:false,bytes:8470000}];
  let records=[{id:'skin-r99',name:'R99 EDGE',format:'dds',weaponIds:['r97'],currentWeaponIds:['r97'],createdAt:'2026-11-24 12:00'},{id:'skin-car',name:'CAR · Monochrome',format:'vtf',weaponIds:['car'],currentWeaponIds:['car'],createdAt:'2026-11-23 16:30'}];
  const weapons=[{id:'r97',name:'R-97',category:'smg'},{id:'car',name:'CAR',category:'smg'},{id:'r201',name:'R-201',category:'rifle'},{id:'flatline',name:'VK-47 平行步枪',category:'rifle'},{id:'kraber',name:'克雷贝尔',category:'sniper'},{id:'wingman',name:'小帮手',category:'pistol'}];
  const now=()=>new Date().toISOString();
  function account(){return {ok:true,loggedIn:logged,accountId:logged?active:null,...(logged?accountRows.find(a=>a.accountId===active):{}),accounts:accountRows.map(a=>({...a,expired:false})),ownsGame:logged,country:'CN',expiresAt:Date.now()+86400000};}
  const protection=()=>({ok:true,game:{ready:true,path:prefs.gamepath},protection:{enabled:prefs.protection!==false,state:'ready',originalsReady:true}});
  const client=region=>({ok:true,installed:true,version:region==='cn'?'1.17.7':'1.31.1',installedVersion:region==='cn'?'1.17.7':'1.31.1',selectedVersion:region==='cn'?'1.17.7':'1.31.1',region,root:region==='cn'?prefs.gamepath:prefs.globalGamepath});
  const delta=()=>({ok:true,installed:true,gameInstalled:true,version:'1.0.0',gamepath:'D:\\Games\\Titanfall',corepath:'D:\\Games\\Titanfall\\r1delta',gamePath:'D:\\Games\\Titanfall',root:'D:\\Games\\Titanfall'});
  function servers(region='global',r1=false){const rows=[['Frontier · Attrition','消耗战','天使城',12,16,'经典消耗战地图轮换 · 原版武器平衡，新手与老铁驭皆宜，随时加入。'],['Pilot Arena','铁驭对铁驭','殖民地',8,12,'纯铁驭高机动对抗 · 专注蹬墙、滑铲与精准枪法博弈。'],['Last Titan Standing','最终泰坦之战','黑水运河',6,10,'全员首发泰坦 · 5 局 3 胜团队机甲协同对抗，无额外模组要求。'],['Frontier Defense','边境防御','家园',3,4,'4 人协作守护收割机 · 常规难度，适合日常热身与机甲升级。']];return {ok:true,status:'online',fetchedAt:now(),servers:rows.map((r,i)=>({key:(r1?'delta-':region+'-')+i,name:r[0],mode:r[1],map:r[2],players:r[3],maxPlayers:r[4],location:region==='cn'?'中国大陆':'国际社区',description:r[5],requiredMods:[],version:'1.0.0',address:'frontier.tfx.local:'+(37015+i),password:false}))};}
  function diagnostics(){return {at:now(),view:{state:'ok',label:'连接正常',checks:[['emulator','本地模拟器开关',prefs.eaEmulator?'已启用':'未启用','本地模拟服务配置与当前模式一致'],['account','账户凭据',logged?'已连接':'未登录','本地缓存凭据有效，启动时自动验证'],['game','游戏目录','已找到','已检测到 Titanfall2.exe 主程序与核心目录'],['bridge','游戏启动桥接','已就绪','启动注入桥接完整且与当前版本匹配'],['lsx','LSX 通道','待命','本地 LSX 通信管道就绪，等待游戏握手'],['network','EA 登录网络','可连接','认证节点连通正常，平均响应 38 ms']].map(([id,title,value,detail])=>({id,title,value,state:'ok',detail}))}};}
  async function progress(channel,stage,name){for(const [percent,phase] of [[8,'validating'],[32,'staging'],[67,'committing'],[91,'verify'],[100,'complete']]){emit(channel,{stage,sourceName:name,phase,percent});await wait(310);}}
  async function launch(gameVersion='northstar',r1=false){
    emit('launch-status',{state:'starting',gameVersion});
    if(scenario==='duplicate'){await wait(500);emit('launch-status',{state:'failed',gameVersion,code:'NORTHSTAR_OTHER_INSTANCE',error:'另一目录中的泰坦陨落2或北极星正在运行。请先退出另一份游戏，再启动。'});return;}
    if(r1){await progress('r1delta-progress','installing','Delta');return;}
    for(const phase of ['prepare-ea','wait-ea','wait-game']){await wait(700);emit('launch-status',{state:'starting',gameVersion,phase});}
    await wait(600);emit('launch-status',{state:'confirmed',gameVersion,pid:2026});
    if(gameVersion==='northstar'){await wait(650);emit('northstar-connection',{code:scenario==='success'?'authenticated':scenario,authenticated:scenario==='success'||scenario==='server-timeout'});}
  }
  async function inspect(channel,input={}){
    let format=channel.startsWith('dds')?'dds':channel.startsWith('vtf')?'vtf':String(typeof state!=='undefined'?state.format:'Northstar Mod').toLowerCase();
    format=({ 'northstar mod':'mod',icepick:'icepick',dds:'dds',vtf:'vtf' })[format]||'mod';
    const sourceName=input.name||input.path?.split(/[\\/]/).pop()||({dds:'R99 EDGE.zip',vtf:'CAR Monochrome.zip',icepick:'Campaign Tools.zip',mod:'Pilot HUD.zip'})[format];
    emit('skin-import-progress',{stage:'reading',sourceName});await wait(1000);
    selected={ok:true,format,sourceName,state:{selectionRevision:1,game:{ready:true},original:{state:'ready'},skinRepair:{ready:true},package:{id:'demo-import',name:sourceName.replace(/\.(zip|7z|rar|dds|vtf)$/i,''),bytes:12400000,count:3,files:[{name:'weapon_diffuse.'+(format==='vtf'?'vtf':'dds'),width:2048,height:2048},{name:'weapon_normal.'+(format==='vtf'?'vtf':'dds'),width:2048,height:2048},{name:'mod.json'}],weaponIds:['r97'],entries:[]}}};return selected;
  }
  async function invoke(channel,...args){
    calls.push(channel);const input=args[0]??{};await wait(90);
    if(channel==='settings-save'){Object.assign(prefs,input);emit('changed-settings',prefs);return {ok:true,settings:clone(prefs)};}
    if(channel==='settings-restore-defaults'){prefs={...defaults};emit('changed-settings',prefs);return {ok:true,settings:clone(prefs)};}
    if(channel==='northstar-client-status')return client(input.region);
    if(channel==='vanilla-client-status')return {ok:true,installed:true,version:'1.31.1'};
    if(channel==='dds-protection-status')return protection();
    if(channel==='dds-protection-set'){prefs.protection=input.enabled;return protection();}
    if(channel==='dds-protection-capture')return {ok:true,captured:true};
    if(channel==='server-list-get')return servers(input.region);
    if(channel==='request')return [{name:'PilotHUD',owner:'TFX',versions:[{description:'简洁战斗界面',version_number:'1.0.0',file_size:2400000,download_url:'demo:pilot-hud'}]},{name:'PhotoMode',owner:'TFX',versions:[{description:'截图与自由镜头',version_number:'1.0.0',file_size:1900000,download_url:'demo:photo-mode'}]}];
    if(channel==='set-mod-state'){for(const row of input.selections||(input.names?[input]:[]))for(const m of mods)if(row.names?.includes(m.name))m.disabled=!row.enabled;emit('mods',{all:mods});return {ok:true};}
    if(channel==='weapon-library-list')return {ok:true,items:clone(records).map(r=>({...r,stateRestoreWeaponIds:r.weaponIds})),weapons,stateRestoreWeaponIds:['r97','car'],stateOriginalCurrentWeaponIds:[]};
    if(channel==='weapon-library-restore'){await progress('weapon-library-progress','installing','材质');for(const r of records)if(r.weaponIds.includes(input.weaponId))r.currentWeaponIds=input.recordId===r.id?[input.weaponId]:[];return {ok:true,stateRestored:true};}
    if(channel==='weapon-library-prune'){records=records.filter(r=>r.id!==input.recordId);return {ok:true};}
    if(channel==='icepick-status')return {ok:true,status:{installed:true,modsDirectory:'D:\\Games\\Titanfall2\\Icepick\\mods',mods:clone(ice)}};
    if(channel==='icepick-toggle'){const m=ice.find(m=>m.id===(input.id||input));if(m)m.enabled=!m.enabled;return {ok:true};}
    if(channel==='icepick-remove'){ice=ice.filter(m=>m.id!==(input.id||input));return {ok:true};}
    if(channel==='icepick-import'){await progress('skin-import-progress','installing','Campaign Tools');return {ok:true,installed:true};}
    if(channel==='ea-status')return account();
    if(channel==='ea-login'){await wait(800);if(logged&&!input.accountId){const id='demo-'+(accountRows.length+1);accountRows.push({accountId:id,playerName:'Pilot_0'+(accountRows.length+1),userId:'DEMO-000'+(accountRows.length+1)});active=id;}logged=true;return account();}
    if(channel==='ea-logout'){accountRows=accountRows.filter(a=>a.accountId!==active);active=accountRows[0]?.accountId;logged=!!active;return account();}
    if(channel==='ea-switch-account'){active=input.accountId||input;logged=true;return account();}
    if(channel==='ea-refresh')return account();
    if(channel==='ea-diagnostics'){await wait(450);return {ok:true,diagnostics:diagnostics()};}
    if(channel==='ea-diagnostics-repair'){prefs.eaEmulator=true;return {ok:true,repaired:true,diagnostics:diagnostics()};}
    if(channel==='ea-diagnostics-copy'){notice('演示诊断已生成，不包含真实账户信息');return {ok:true};}
    if(/^(skin-import|dds|vtf)-(select|inspect|preview)$/.test(channel))return inspect(channel,input);
    if(/^(skin-import|dds|vtf)-clear$/.test(channel)){selected=null;return {ok:true};}
    if(/^(skin-import|dds|vtf|icepick)-install$/.test(channel)){
      const name=selected?.state.package.name||'演示模组';await progress('skin-import-progress','installing',name);
      if(selected?.format==='mod')mods.push({name:'TFX.Import'+mods.length,manifest_name:name,author:'TFX',version:'1.0.0',description:'演示导入的模组',stateControl:true,disabled:false});
      else if(selected?.format==='icepick')ice.push({id:'ice-'+ice.length,name,enabled:true,author:'TFX',version:'1.0.0'});
      else records.push({id:'skin-'+records.length,name,format:selected?.format||'dds',weaponIds:['r97'],currentWeaponIds:['r97'],createdAt:'2026-11-24 12:30'});
      emit('mods',{all:mods});return {ok:true,installed:true};
    }
    if(/^(dds|vtf)-status$/.test(channel))return {ok:true,state:selected?.state||{game:{ready:true},original:{state:'ready'},package:null}};
    if(/^(dds|vtf)-(restore|delete-backup)$/.test(channel))return {ok:true,stateRestored:true};
    if(/^(dds|vtf)-resource-plan$/.test(channel))return {ok:true,plan:{localRepair:true}};
    if(/^(dds|vtf)-resource-download$/.test(channel)){await progress('skin-resource-progress','installing','原始资源');return {ok:true,installed:true};}
    if(channel==='r1delta-status'||channel==='r1delta-select')return delta();
    if(channel==='r1delta-install'){await progress('r1delta-progress','installing','Delta');return delta();}
    if(channel==='r1delta-launch'||channel==='r1delta-launch-steam'||channel==='r1delta-server-join'){await launch('delta',true);return {ok:true};}
    if(channel==='r1delta-servers')return servers('global',true);
    if(channel==='r1delta-addons-list')return {ok:true,addons:clone(addons),gameInstalled:true,addonsPath:'D:\\Games\\Titanfall\\r1delta\\addons'};
    if(channel==='r1delta-addons-inspect'){const sourceName=input.name||'Frontier HUD.zip';emit('r1delta-addon-progress',{stage:'reading',sourceName});await wait(950);return {ok:true,id:'delta-demo-import',sourceName,bytes:3500000,entries:[{id:'demo-addon',name:'Frontier HUD',title:'Frontier HUD',type:'folder',kind:'folder',files:6,bytes:3500000,replaces:false}]};}
    if(channel==='r1delta-addons-install'){await progress('r1delta-addon-progress','installing','Frontier HUD');addons.push({id:'delta-'+addons.length,name:'Frontier HUD '+addons.length,title:'Frontier HUD',type:'folder',kind:'folder',author:'TFX',valid:true,enabled:true,description:'演示安装的 Addon'});return {ok:true,installed:true};}
    if(channel==='r1delta-addons-toggle'){const row=addons.find(a=>a.id===input.id);if(row)row.enabled=input.enabled;return {ok:true};}
    if(channel==='r1delta-addons-remove'){addons=addons.filter(a=>a.id!==(input.id||input));return {ok:true};}
    if(channel==='r1delta-addons-clear')return {ok:true};
    if(/^(northstar|launcher)-update-check$/.test(channel)){await wait(700);return {ok:true,status:'up-to-date',currentVersion:channel.startsWith('launcher')?'2.0.0':prefs.northstarRegion==='global'?'1.31.1':'1.17.7',latestVersion:channel.startsWith('launcher')?'2.0.0':prefs.northstarRegion==='global'?'1.31.1':'1.17.7',region:prefs.northstarRegion};}
    if(channel==='download-cache-clear'){await wait(400);return {ok:true,files:4,bytes:12582912};}
    if(['northstar-client-install','vanilla-client-install','global-game-root-install','china-game-root-install'].includes(channel)){await progress('northstar-client-progress','installing','Northstar');return {ok:true,installed:true};}
    if(channel==='window-toggle-fullscreen'){fullscreen=!fullscreen;emit('window-state',{fullscreen,maximized});if(fullscreen)document.documentElement.requestFullscreen?.().catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});return true;}
    if(channel==='window-toggle-maximize'){maximized=!maximized;emit('window-state',{maximized,fullscreen});return true;}
    if(channel.startsWith('window-move-'))return false;
    if(channel==='window-background'){notice('演示模式：窗口不会转入后台');return {ok:true};}
    if(channel==='launch-diagnostic-get')return null;
    if(/open|copy|select|backups|launch|registry|cancel|flush|dns|export/.test(channel)){notice('演示模式：已展示操作反馈，不会修改系统或启动游戏');return {ok:true};}
    errors.push('Unhandled demo IPC: '+channel);return {ok:false,error:'该操作不涉及真实文件；请通过演示页面继续浏览。'};
  }
  window.ipcRenderer=Object.freeze({on(channel,fn){if(!listeners.has(channel))listeners.set(channel,[]);listeners.get(channel).push(fn);},invoke,send(channel,...args){calls.push(channel);
    if(channel==='gui-getmods')setTimeout(()=>emit('mods',{all:mods}),20);
    else if(channel==='get-version')setTimeout(()=>emit('version',{launcher:'2.0.0',viper:'2.0.0',ns:'1.31.1'}),20);
    else if(channel==='launch-ns'||channel==='launch-vanilla')void launch(channel==='launch-ns'?'northstar':'vanilla');
    else if(channel==='setpath'||channel==='setglobalpath'){notice('已选择演示游戏目录');emit(channel==='setpath'?'newpath':'globalpath-selected',{});}
    else if(channel==='remove-mod'){const name=args[0]?.name||args[0];mods=mods.filter(m=>m.name!==name);emit('mods',{all:mods});emit('removed-mod',{});}
    else if(channel==='download-mod'){void progress('skin-import-progress','installing','Pilot HUD').then(()=>{mods.push({name:'TFX.Download',manifest_name:'Pilot HUD',author:'TFX',disabled:false,stateControl:true});emit('mods',{all:mods});emit('installed-mod',{});});}
    else if(channel==='exit'||channel==='minimize')notice('演示模式：不会关闭浏览器');
  }});
  const normalize=value=>/^zh-(TW|HK|Hant)/i.test(value)?'zh-TW':/^zh/i.test(value)?'zh-CN':/^de/i.test(value)?'de-DE':/^fr/i.test(value)?'fr-FR':'en-US';
  let language='zh-CN';
  const flat=(obj,prefix='',result={})=>{for(const[k,v]of Object.entries(obj)){const key=prefix?prefix+'.'+k:k;if(v&&typeof v==='object')flat(v,key,result);else result[key]=v;}return result;};
  const dictionaries={'zh-CN':flat(window.TFXDemoLocales.zh),'en-US':flat(window.TFXDemoLocales.en)};
  const translate=(key,locale=language)=>{const tag=normalize(locale),en=dictionaries['en-US'][key]||key;return dictionaries[tag]?.[key]||window.TFXDemoLocales[tag]?.[en]||en;};
  window.fold=Object.freeze({loadSettings:()=>({exists:true,data:clone(prefs)}),getDroppedFilePath:file=>file.name,reportError:message=>errors.push(String(message)),openExternal:()=>notice('演示模式：外部链接不会打开'),openPath:()=>notice('演示模式：不访问本地文件夹'),normalizeUiLanguage:normalize,setUiLanguage:value=>(language=normalize(value)),loadLocale:locale=>window.TFXDemoLocales[normalize(locale)]||{},translate,translateText:(text,locale)=>{const key=Object.keys(dictionaries['zh-CN']).find(k=>dictionaries['zh-CN'][k]===text||dictionaries['en-US'][k]===text);return key?translate(key,locale):text;}});
  window.TFXDemo=Object.freeze({version:'2.0.0',emit,invoke,get calls(){return [...calls];},get errors(){return [...errors];},setScenario(value){if(['success','duplicate','session-expired','master-unreachable','auth-rejected','server-timeout'].includes(value))scenario=value;},reset(){location.reload();}});
})();
