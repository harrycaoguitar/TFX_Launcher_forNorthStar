/* Localized UI with reversible previews. The observer translates only known
 * product copy, keeping package names, paths and remote mod content untouched. */
(() => {
  'use strict';
  const normalize = value => {
    if (fold.normalizeUiLanguage) return fold.normalizeUiLanguage(value);
    const tag=String(value||'').replace(/_/g,'-');
    if(/^zh-(?:TW|HK|MO|Hant)(?:-|$)/i.test(tag))return 'zh-TW';
    if(/^zh(?:-|$)/i.test(tag))return 'zh-CN';
    if(/^de(?:-|$)/i.test(tag))return 'de-DE';
    if(/^fr(?:-|$)/i.test(tag))return 'fr-FR';
    return 'en-US';
  };
  const catalog = window.VyraLocales || {pairs:[]};
  const forward = new Map(catalog.pairs);
  const reverse = new Map(catalog.pairs.map(([zh,en]) => [en,zh]));
  const extraLocales=new Map(['zh-TW','de-DE','fr-FR'].map(locale=>[locale,fold.loadLocale?.(locale)||{}]));
  const englishKeys=new Set([...extraLocales.values()].flatMap(dictionary=>Object.keys(dictionary)));
  const localizedReverse=new Map(),localizedPatterns=new Map(),reversePatterns=[];
  function templateMatcher(template) {
    const tokens=[],parts=template.split(/(\$[1-9]|\{[A-Za-z][\w]*\})/u);
    if(parts.length===1)return null;
    const expression=parts.map(part=>{
      if(!/^(\$[1-9]|\{[A-Za-z][\w]*\})$/u.test(part))return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const existing=tokens.indexOf(part);if(existing>=0)return '\\k<p'+existing+'>';
      const index=tokens.push(part)-1;return '(?<p'+index+'>[\\s\\S]*?)';
    }).join('');
    return {expression:new RegExp('^'+expression+'$','u'),tokens,specificity:parts.filter(part=>!/^(\$[1-9]|\{[A-Za-z][\w]*\})$/u.test(part)).join('').length};
  }
  function fillTemplate(template,match,tokens) {
    return template.replace(/\$[1-9]|\{[A-Za-z][\w]*\}/gu,token=>match.groups['p'+tokens.indexOf(token)]??token);
  }
  for(const[locale,dictionary]of extraLocales){
    const list=[];
    for(const[english,translation]of Object.entries(dictionary)){
      if(typeof translation!=='string')continue;
      localizedReverse.set(translation,english);
      const matcher=templateMatcher(english);if(matcher)list.push({...matcher,replacement:translation});
      const back=templateMatcher(translation);if(back)reversePatterns.push({...back,replacement:english});
    }
    localizedPatterns.set(locale,list.sort((a,b)=>b.specificity-a.specificity));
  }
  reversePatterns.sort((a,b)=>b.specificity-a.specificity);
  function englishSource(text) {
    if(localizedReverse.has(text))return localizedReverse.get(text);
    for(const pattern of reversePatterns){const match=pattern.expression.exec(text);if(match)return fillTemplate(pattern.replacement,match,pattern.tokens);}
    return text;
  }
  function localizeEnglish(text,locale) {
    const dictionary=extraLocales.get(locale)||{};
    if(Object.prototype.hasOwnProperty.call(dictionary,text))return dictionary[text];
    for(const pattern of localizedPatterns.get(locale)||[]){
      const match=pattern.expression.exec(text);if(!match)continue;
      if(/^(?:Current theme: |Previewing )|, (?:light|dark) theme$/u.test(text)) {
        for(const name of Object.keys(match.groups||{}))match.groups[name]=localizeEnglish(match.groups[name],locale);
      }
      return fillTemplate(pattern.replacement,match,pattern.tokens);
    }
    // Translate known diagnostic prefixes independently of filenames and error
    // details; arbitrary mod descriptions and user names never enter this map.
    const separator=text.indexOf(': ');
    if(separator>0&&Object.prototype.hasOwnProperty.call(dictionary,text.slice(0,separator)))return dictionary[text.slice(0,separator)]+': '+localizeEnglish(text.slice(separator+2),locale);
    return text;
  }
  const sources = new WeakMap();
  const attributeSources = new WeakMap();
  const attributes = ['title','placeholder','aria-label'];
  const ignored = 'script,style,textarea,[data-i18n-ignore],#nsRelease,#vpReleaseNotes,#settingsGamePath,#settingsGlobalGamePath,#ddsPackageName,#vtfPackageName,#ddsFileList strong,#vtfFileList strong,#browserEntries .description,#browserEntries .name,#browserEntries .title,#modsdiv .el .name,#modsdiv .el .title,#modsdiv .el .description,#uiLanguage option';
  let current = normalize(fold.loadSettings().data.uiLanguage);
  let pending = 0;
  const changedRoots = new Set();
  // Older saved diagnostics keep their original signatures. Normalize these
  // messages at the presentation boundary, preserving user file names.
  const legacySkinCopy = [
    [/^没有匹配到受支持的纹理名称与尺寸$/u,'没有匹配到受支持的皮肤名称与尺寸'],
    [/^不支持的纹理尺寸目录$/u,'不支持的皮肤尺寸目录'],
    [/^(.+)：没有匹配到受支持的纹理名称与尺寸$/u,'$1：没有匹配到受支持的皮肤名称与尺寸'],
    [/^(.+)：不支持的纹理尺寸目录$/u,'$1：不支持的皮肤尺寸目录']
  ];
  const patterns = [
    [/^游戏在主菜单加载完成前退出（退出码 (.+)）。若不是手动关闭，请先排查最近启用的 Mod 或皮肤，再检查 EA App \/ Steam 登录提示与启动诊断。$/u,'The game exited before the main menu finished loading (code $1). If you did not close it, check recently enabled Mods or skins first, then EA App / Steam sign-in prompts and the launch diagnostics.'],
    [/^游戏在主菜单加载完成前退出（(.+)）。若不是手动关闭，请先排查最近启用的 Mod 或皮肤，再检查 EA App \/ Steam 登录提示与启动诊断。$/u,'The game exited before the main menu finished loading ($1). If you did not close it, check recently enabled Mods or skins first, then EA App / Steam sign-in prompts and the launch diagnostics.'],
    [/^(.+)：皮肤资源路径包含链接或非普通文件，已停止资源读写。$/u,"$1: skin resource path contains a link or non-regular file. Resource access was stopped."],
    [/^EA App 未能启动，请打开并登录 EA App 后重试。（(.+)）$/u,"EA App could not start. Open EA App, sign in, and try again. ($1)"],
    [new RegExp("^(.+)：缺少游戏资源，可选择原版资源补齐或让 Steam 恢复后继续安装$","u"),"$1: missing game resource. Restore it from original resources or through Steam, then continue installation."],
    [new RegExp("^(.+)：游戏资源不完整，可选择完整原版资源修复后继续安装$","u"),"$1: incomplete game resource. Restore it from complete original resources, then continue installation."],
    [new RegExp("^(.+)：游戏资源被多个目录共享，安装前会生成独立副本，避免改动其他目录$","u"),"$1: resource shared by multiple folders. An independent copy will be created before installation to protect the other folders."],
    [new RegExp("^(.+)：游戏资源不可写，安装前将尝试恢复可写状态$","u"),"$1: resource is not writable. TFX will try to restore write access before installation."],
    [new RegExp("^正在修复 (.+)$","u"),"Repairing $1"],
    [new RegExp("^(.+) 已修复并校验$","u"),"$1 repaired and verified"],
    [new RegExp("^修复 (.+) 需要约 (.+) MB 可用空间，请先释放游戏所在磁盘的空间。$","u"),"Repairing $1 requires about $2 MB of free space. Free up space on the game drive first."],
    ...(catalog.skinSwitchPatterns || []),
    ...(catalog.clientSwitchPatterns || []),
    [/^皮肤层级元数据无效：(.+)$/u,'Invalid skin resolution metadata: $1'],
    [/^皮肤层级元数据存在重叠：(.+)$/u,'Overlapping skin resolution metadata: $1'],
    [/^皮肤层级检查暂不可用：(.+)$/u,'Skin resolution check unavailable: $1'],
    [/^正在保存经 Steam 校验的原版皮肤 (\d+\/\d+)$/u,'Saving Steam-verified original skin resources $1'],
    [/^DDS 备份皮肤名称无效：(.+)$/u,'Invalid skin filename in the DDS backup: $1'],
    [/^无法确认旧皮肤的皮肤区域：(.+)。请先恢复旧备份；元数据错误：(.+)$/u,'The resource location for the previous skin could not be confirmed: $1. Restore its backup first. Metadata error: $2'],
    [/^皮肤包包含不支持的文件：(.+)$/u,'The skin package contains an unsupported file: $1'],
    [/^皮肤包文件数量超过 (\d+)$/u,'The skin package contains more than $1 files'],
    [/^皮肤兼容性设置恢复失败且撤销未通过校验，原文件备份已保留：(.+)$/u,'Skin compatibility settings could not be restored or rolled back. The original file backup is retained: $1'],
    [/^(\d+) 个 DDS 皮肤文件已安装，已清理 (\d+) 处旧皮肤残留，备份已保存$/u,'$1 DDS skin files installed; $2 remnants of the previous skin removed. Backups saved.'],
    [/^换肤清理：已恢复 (\d+) 处旧皮肤残留，替换 (\d+) 份旧安装记录。$/u,'Skin replacement cleanup: $1 old skin slots restored; $2 earlier installation records superseded.'],
    [/^(.+)：没有匹配到受支持的皮肤名称与尺寸$/u,'No supported skin filename and dimensions matched for $1.'],
    [/^(.+)：不支持的皮肤尺寸目录$/u,'Unsupported skin resolution folder for $1.'],
    [/^缺少或无法读取 (.+)，请在开始游戏页面检查或重新安装北极星客户端。$/u,'Missing or unreadable $1. Check or reinstall Northstar on the Play page.'],
    [/^缺少或无法读取 (.+)，请验证游戏文件。$/u,'Missing or unreadable $1. Verify the game files.'],
    [/^游戏启动进程提前退出（退出码 (.+)）。请检查 EA App \/ Steam 的登录或授权提示、北极星文件是否完整，再重试。$/u,'The game launch process exited early (code $1). Check EA App / Steam login or authorization dialogs and Northstar files, then try again.'],
    [/^游戏启动进程提前退出（(.+)）。请检查 EA App \/ Steam 的登录或授权提示、北极星文件是否完整，再重试。$/u,'The game launch process exited early ($1). Check EA App / Steam login or authorization dialogs and Northstar files, then try again.'],
    [/^(\d+) 个皮肤文件 · (.+)$/u, '$1 skin files · $2'],[/^(\d+) 个资源 · (.+)$/u, '$1 resources · $2'],[/^(\d+) 份记录$/u,'$1 records'],[/^(\d+) 条记录$/u,'$1 records'],
    [/^(.+) · (\d+) 帧(.*)$/u,'$1 · $2 frames$3'],[/^已导入 (.+)，完成格式与资源检查。$/u,'Imported $1. Format and resources inspected.'],
    [/^(.+) · (\d+) 个皮肤文件 · (.+)$/u,'$1 · $2 skin files · $3'],
    [/^(.+) · (\d+|—) 个资源 · 已恢复$/u,'$1 · $2 resources · Restored'],[/^(.+) · (\d+|—) 个资源 · 已安装$/u,'$1 · $2 resources · Installed'],[/^(.+) · (\d+|—) 个资源 · 待恢复$/u,'$1 · $2 resources · Awaiting restore'],[/^(.+) · (\d+|—) 个资源 · 需检查$/u,'$1 · $2 resources · Needs review'],
    [/^校验 (.+)$/u,'Verifying $1'],[/^打包 (.+)$/u,'Packing $1'],[/^(\d+) 个 VTF \/ 材质 \/ 模型资源校验通过$/u,'$1 VTF / material / model resources validated'],[/^(\d+) 个 VTF 皮肤资源已安装，原归档保持完整$/u,'$1 VTF skin resources installed. Original archives preserved.'],
    [/^校验皮肤 (\d+\/\d+)$/u,'Verifying skin $1'],[/^校验通过，(\d+) 个皮肤文件可安装$/u,'Validated. $1 skin files ready to install.'],[/^备份 (\d+\/\d+)$/u,'Backing up $1'],[/^写入并验证 (\d+\/\d+)$/u,'Writing and verifying $1'],[/^恢复并验证 (\d+\/\d+)$/u,'Restoring and verifying $1'],[/^(\d+) 个 DDS 皮肤文件已安装，备份已保存$/u,'$1 DDS skin files installed. Backups saved.'],
    [/^(.+) 不是有效的 DDS 文件$/u,'$1 is not a valid DDS file'],[/^(.+) 的尺寸 (.+) 不受支持$/u,'Unsupported dimensions $2 in $1'],[/^(.+) 的 DX10 标头不完整$/u,'Incomplete DX10 header in $1'],[/^(.+) 使用了不支持的 DX10 格式、数组或资源类型$/u,'Unsupported DX10 format, array or resource type in $1'],[/^(.+) 的压缩格式 (.+) 不受支持$/u,'Unsupported compression format $2 in $1'],[/^(.+) 的皮肤数据不完整$/u,'Incomplete skin data in $1'],[/^(.+) 使用了不支持的立方体或体积皮肤$/u,'Unsupported cubemap or volume skin in $1'],[/^(.+) 的皮肤名称不符合原安装工具的规则$/u,'$1 has a skin filename that does not match the installer rules'],[/^(.+) 的格式或数据长度与游戏皮肤不匹配$/u,'The format or data length of $1 does not match the game skin'],[/^(.+) 与包中另一个皮肤文件覆盖同一区域$/u,'$1 overlaps another skin in the package'],[/^(.+) 不存在、尺寸不匹配或不可写$/u,'$1 is missing, has a different size or is not writable'],[/^(.+) 不是有效的 VTF 7.x 皮肤$/u,'$1 is not a valid VTF 7.x skin'],
    [/^当前主题：(.+)$/u,'Current theme: $1'],[/^正在预览 (.+) · 保存后保留$/u,'Previewing $1 · Save to keep'],[/^(.+)，浅色主题$/u,'$1, light theme'],[/^(.+)，深色主题$/u,'$1, dark theme'],
    [/^恢复「(.+)」安装前的皮肤？\n对应资源将回到这份备份记录的原始状态。$/u,'Restore skin files from before “$1”?\nThe corresponding resources will return to the state saved in this backup.'],
    [/^恢复「(.+)」安装前的 VTF 资源？\n请先退出游戏；有多次安装时先恢复较新的记录。$/u,'Restore VTF resources from before “$1”?\nClose the game first. If there are multiple installations, restore the newest record first.']
  ];
  function translated(value, locale = current) {
    if (typeof value !== 'string') return value;
    locale=normalize(locale);
    const dictionary=extraLocales.get(locale);
    if(dictionary&&Object.prototype.hasOwnProperty.call(dictionary,value))return dictionary[value];
    if(locale==='en-US'){
      if(englishKeys.has(value))return value;
      if(localizedReverse.has(value))return localizedReverse.get(value);
    }
    const leading = value.match(/^\s*/u)[0], trailing = value.match(/\s*$/u)[0];
    const trimmed = value.trim();
    if (!trimmed) return value;
    const stamp=trimmed.match(/^(\[\d{1,2}:\d{2}:\d{2}\]\s)(.+)$/u);
    if(stamp)return leading+stamp[1]+translated(stamp[2],locale)+trailing;
    const pivot=englishSource(trimmed);
    if(locale!=='zh-CN'&&locale!=='en-US')return leading+localizeEnglish(translated(pivot,'en-US').trim(),locale)+trailing;
    if(locale==='en-US'&&pivot!==trimmed&&englishKeys.has(pivot))return leading+pivot+trailing;
    const recovery = /^换肤未完成，请恢复跨格式皮肤备份；恢复编号：([a-f0-9-]{36})。(.+)$/u.exec(trimmed);
    if (locale === 'en-US' && recovery) return leading + 'Skin switch incomplete. Restore the skin switch backup. Recovery ID: ' + recovery[1] + '. ' + translated(recovery[2],locale) + trailing;
    let source = reverse.get(pivot) || pivot;
    if(/^皮肤启动前检查未完成：/u.test(source))return leading+translated('皮肤启动保护未完成',locale)+': '+translated(source.slice('皮肤启动前检查未完成：'.length),locale)+trailing;
    for (const [pattern,replacement] of legacySkinCopy) if (pattern.test(source)) { source=source.replace(pattern,replacement);break; }
    if(/\r|\n/u.test(source) && !patterns.some(([pattern])=>pattern.test(source))) return value.split(/(\r\n|\n|\r)/u).map(line=>/^\r?\n$|^\r$/u.test(line)?line:translated(line,locale)).join('');
    let output = fold.translateText ? fold.translateText(source,locale) : source;
    if (locale === 'en-US') {
      output = forward.get(source) || output;
      if (output === source) for (const [pattern,replacement] of patterns) {
        if (!pattern.test(source)) continue;
        output = source.replace(pattern,replacement);
        // Theme names are product labels, not user text.
        if (/^(Current theme:|Previewing )/u.test(output) || /, (light|dark) theme$/u.test(output)) {
          const theme=/^(?:当前主题：|正在预览 )(.+?)(?: · 保存后保留)?$|^(.+)，(?:浅色|深色)主题$/u.exec(source);
          const name=theme?.[1]||theme?.[2];
          if(name)output=output.replace(name,translated(name,locale));
        }
        break;
      }
      if(output===source && /^\d+ 服务器 - \d+ 玩家$/u.test(source)) output=source.replace(/^(\d+) 服务器 - (\d+) 玩家$/u,'$1 servers - $2 players');
      if(output===source && /^\(.+\)$/u.test(source)) {const inside=source.slice(1,-1),text=translated(inside,locale);if(text!==inside) output='('+text+')';}
      if(output===source && /^common VPK 不完整或不兼容：/u.test(source)) output='Incomplete or incompatible common VPK: '+translated(source.slice('common VPK 不完整或不兼容：'.length),locale);
    }
    return leading + output + trailing;
  }
  function t(key, parameters = {}) {
    const pair=catalog.messages?.[key];
    let value=pair ? current==='zh-CN'?pair[0]:current==='en-US'?pair[1]:localizeEnglish(pair[1],current) : fold.translate(key);
    for (const [name,input] of Object.entries(parameters)) value = value.replaceAll('{'+name+'}',String(input));
    return value;
  }
  function replaceText(node) {
    if (!node.parentElement || node.parentElement.closest(ignored)) return;
    // Proper game and product titles stay identical in both languages.
    if (node.parentElement.matches('.fold-hero h1,.fold-brand strong,.settings-author-wordmark')) return;
    const previous = sources.get(node);
    const value = node.nodeValue;
    const source = previous && (value === previous.output || value === previous.source) ? previous.source : value;
    const output = source.includes('%%') ? source.replace(/%%([^%]+)%%/g,(_match,key)=>t(key)) : translated(source);
    sources.set(node,{source,output});
    if (value !== output) node.nodeValue = output;
  }
  function apply(root = document.body) {
    if (!root) return;
    observer.disconnect();
    try {
      if (root.nodeType === Node.TEXT_NODE) replaceText(root);
      else {
        const walker = document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) replaceText(walker.currentNode);
        const elements = root.nodeType === Node.ELEMENT_NODE ? [root,...root.querySelectorAll('*')] : [];
        for(const element of elements) {
          if(element.closest(ignored)) continue;
          if(element.dataset.i18n) {
            const text=t(element.dataset.i18n);
            if(element.textContent!==text) element.textContent=text;
          }
          let record = attributeSources.get(element);
          if(!record) {record={};attributeSources.set(element,record);}
          for(const name of attributes) {
            const key=element.getAttribute('data-i18n-'+name);
            if(key) {const value=t(key);if(element.getAttribute(name)!==value) element.setAttribute(name,value);continue;}
            const value=element.getAttribute(name); if(value === null) continue;
            const old=record[name];
            const source=old && (value===old.output || value===old.source) ? old.source : value;
            const output=source.includes('%%') ? source.replace(/%%([^%]+)%%/g,(_match,key)=>t(key)) : translated(source);
            record[name]={source,output}; if(value!==output) element.setAttribute(name,output);
          }
        }
      }
      document.documentElement.lang=current;
      document.title=current==='en-US'?'TFX Launcher':'TFX Launcher';
      const path=document.getElementById('settingsGamePath');
      if(path && typeof settings==='object' && !settings.gamepath) path.textContent=translated('尚未选择游戏目录');
    } finally {observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});}
  }
  const observer=new MutationObserver(records => {
    for(const record of records) {
      if(record.type==='childList') for(const node of record.addedNodes) changedRoots.add(node);
      else changedRoots.add(record.target);
    }
    if(pending) return;
    pending=requestAnimationFrame(()=>{
      pending=0;
      const roots=[...changedRoots];changedRoots.clear();
      for(const root of roots) if(root.isConnected) apply(root);
    });
  });
  function preview(value) {
    const next=normalize(value), changed=next!==current;
    current=next;
    if(fold.setUiLanguage) fold.setUiLanguage(current);
    apply();
    if(changed) window.dispatchEvent(new CustomEvent('vyra-language-changed',{detail:{locale:current}}));
    return current;
  }
  function load() {
    const saved=typeof settings==='object'?settings.uiLanguage:fold.loadSettings().data.uiLanguage;
    return preview(saved);
  }
  window.I18n=Object.freeze({normalize,t,text:translated,apply,preview,commit:preview,load,cancel:load,get current(){return current;},get locale(){return current;}});
  preview(current);
  window.addEventListener('DOMContentLoaded',()=>apply());
  ipcRenderer.on('changed-settings',(_event,value)=>{if(value && Object.prototype.hasOwnProperty.call(value,'uiLanguage') && (typeof settings!=='object' || value.uiLanguage!==settings.uiLanguage)) preview(value.uiLanguage);});
})();
