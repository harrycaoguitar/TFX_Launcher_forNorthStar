/* One intake, content detection and automatic installation. */
(() => {
  'use strict';
  function init(){
    const $=id=>document.getElementById('skinImport'+id),area=$('Area');if(!area)return;
    const entry={busy:false,name:'',format:null,phase:'empty',error:'',package:null,percent:0,estimated:true};
    const t=(key,values)=>I18n.t('skinImport.'+key,values);
    const controller=kind=>kind==='dds'?window.Fold?.DDS:window.VTF;
    const profileRoot=()=>typeof settings==='undefined'?'':settings.modProfileServer==='global'?(settings.globalGamepath||''):(settings.gamepath||'');
    const profileRootBusy=()=>{if(typeof settings==='undefined')return true;const server=settings.modProfileServer,version=server==='official'?'vanilla':'northstar',region=server==='global'?'global':'cn';return window.VyraLaunchAvailability?.canLaunch(window.VyraGameProcesses?.snapshot,settings,version,region)!==true;};
    const basename=value=>String(value||'').replace(/[\\/]+$/u,'').split(/[\\/]/u).at(-1).replace(/[\u0000-\u001f\u007f]/gu,'').slice(0,240);
    const formatName=kind=>kind==='mod'?'Northstar Mod':kind==='icepick'?'Icepick Mod':String(kind||'').toUpperCase();
    let timer=null,observer;
    function busy(){return entry.busy||window.Fold?.DDS.state.busy||window.VTF?.state.busy||window.SkinRecovery?.busy||window.DDSOriginal?.busy||window.Icepick?.busy;}
    function resetPanels(){
      for(const kind of ['dds','vtf']){
        window.SkinFeedback?.clear(kind);
        controller(kind)?.adoptImport?.({ok:true,package:null,original:null,skinRepair:null,conflictPreview:null});
      }
    }
    function startTicker(){
      clearInterval(timer);timer=setInterval(()=>{
        if(!entry.busy){clearInterval(timer);timer=null;return;}
        if(entry.format==='mod'||['pending','picking'].includes(entry.phase)){
          const limit=entry.phase==='installing'?91:12;
          if(entry.percent<limit){entry.percent=Math.min(limit,entry.percent+.35);entry.estimated=true;render();}
        }
      },650);
    }
    function stopTicker(){clearInterval(timer);timer=null;}
    function mirrorProgress(kind){
      if(entry.format!==kind)return;
      if(entry.phase==='waiting'&&document.getElementById(kind+'Progress')?.dataset.feedbackState==='pending')entry.phase='installing';
      if(entry.phase!=='installing')return;
      const text=document.getElementById(kind+'ProgressValue')?.textContent||'';
      const number=Number.parseFloat(text.replace(/[^\d.]/g,''));
      if(Number.isFinite(number)){entry.percent=Math.max(entry.percent,Math.min(99,number));entry.estimated=text.includes('≈');render();}
    }
    function render(){
      area.dataset.importState=entry.phase;area.setAttribute('aria-busy',String(Boolean(busy())));
      const dropStatus=document.getElementById('modUnifiedStatus');if(dropStatus&&entry.busy)dropStatus.textContent=entry.name?(entry.phase==='installing'?'正在安装：'+entry.name:'正在识别：'+entry.name):'正在导入…';
      for(const id of ['Select','Folder','Clear','Retry'])if($(id))$(id).disabled=Boolean(busy());
      for(const node of document.querySelectorAll('[data-skin-format]'))node.disabled=Boolean(busy());
      $('Receipt').hidden=entry.phase==='empty';
      $('Name').textContent=entry.name||t(entry.phase==='picking'?'picking':'empty');$('Name').title=entry.name;
      $('Format').hidden=!entry.format;$('Format').textContent=formatName(entry.format);
      const key=entry.phase==='picking'?'picking':entry.phase==='pending'?'received':entry.phase==='installing'?'installing':entry.phase==='complete'?'installed':entry.phase==='waiting'?'needsAction':entry.phase==='cancelled'?'cancelled':entry.phase==='failed'?'failed':'empty';
      const status=entry.error?I18n.text(entry.error):t(key);$('Status').textContent=status;
      for(const kind of ['dds','vtf']){
        const label=document.getElementById(kind+'Status');
        if(label&&entry.format===kind)label.textContent=status;
        else if(label&&!controller(kind)?.state.package)label.textContent=t('automaticHint');
      }
      $('Progress').hidden=['empty','picking'].includes(entry.phase);
      const percent=Math.round(entry.percent),amount=(entry.estimated?'≈ ':'')+percent+'%';
      $('ProgressValue').textContent=amount;$('ProgressBar').style.width=percent+'%';
      $('Progress').querySelector('[data-i18n="skinImport.progress"]').textContent=t('progress');$('ProgressTrack').setAttribute('aria-label',t('progress'));
      $('ProgressTrack').setAttribute('aria-valuenow',String(percent));$('ProgressTrack').setAttribute('aria-valuetext',amount);
      $('Retry').hidden=entry.phase!=='waiting'||!entry.package;
      if(document.getElementById('skinModWorkspace')){
        document.getElementById('skinModStatus').textContent=entry.format==='mod'?status:t('modEmpty');
        document.getElementById('skinModName').textContent=entry.format==='mod'?entry.name:'';
        document.getElementById('skinModCount').textContent=entry.format==='mod'?String(entry.package?.modCount||0):'—';
        document.getElementById('skinModFiles').textContent=entry.format==='mod'?String(entry.package?.count||0):'—';
      }
      document.getElementById('skinIcepickStatus').textContent=entry.format==='icepick'?status:t('icepickBlank');
      document.getElementById('skinIcepickName').textContent=entry.format==='icepick'?entry.name:'';
      for(const node of document.querySelectorAll('[data-unified-install-hint]'))node.textContent=t('automaticHint');
    }
    function installationResult(kind,result){
      if(kind!==entry.format||!entry.package)return result;
      const wasComplete=entry.phase==='complete';
      if(!result||result.confirmationRequired||result.waiting){entry.phase='waiting';entry.estimated=true;entry.error=result?.error||'';}
      else if(result.cancelled){entry.phase='cancelled';entry.error='';}
      else if(result.ok){entry.phase='complete';entry.percent=100;entry.estimated=false;entry.error='';if(!wasComplete)window.dispatchEvent(new CustomEvent('tfx-install-complete',{detail:{format:kind}}));}
      else{entry.phase='failed';entry.error=result.error||t('failed');}
      render();return result;
    }
    async function installCurrent(){
      if(!entry.package)return null;
      if(!profileRoot())return installationResult(entry.format,{waiting:true,error:t('chooseGame')});
      if(profileRootBusy())return installationResult(entry.format,{waiting:true,error:t('closeGame')});
      if(entry.format!=='mod'&&controller(entry.format)?.state.pending?.length)return installationResult(entry.format,{waiting:true,error:t('restoreFirst')});
      entry.phase='installing';entry.error='';entry.percent=Math.max(0,Math.min(entry.percent,99));render();
      let result;
      if(entry.format==='mod'){
        result=await ipcRenderer.invoke('skin-import-install',{id:entry.package.id});
        if(result?.ok&&!result.cancelled&&!result.waiting&&!result.confirmationRequired){
          new Toast({scheme:'success',variant:'skin-complete',key:'skin-install-complete',title:t('modComplete'),description:t('modCompleteHint'),timeout:5000});
          ipcRenderer.send('gui-getmods');
        }
      }else result=await controller(entry.format)?.install();
      return installationResult(entry.format,result);
    }
    async function importSource(channel,input={},name=''){
      if(busy())return {ok:false,busy:true,error:t('busy')};
      Object.assign(entry,{busy:true,name:basename(name||input.path),format:null,phase:channel==='skin-import-select'?'picking':'pending',error:'',package:null,percent:0,estimated:true});
      resetPanels();render();startTicker();
      try{
        const result=await ipcRenderer.invoke(channel,input);
        if(result.cancelled){entry.phase='empty';entry.name='';return result;}
        if(!result.ok)throw Error(result.error||t('failed'));
        if(!['dds','vtf','mod','icepick'].includes(result.format)||!result.state?.package?.id)throw Error(t('failed'));
        Object.assign(entry,{name:basename(result.sourceName||result.state.package.name||entry.name),format:result.format,package:result.state.package,percent:0});
        window.Fold?.setSkinFormat(result.format);
        window.Fold?.navigate('skins');
        if(result.format==='icepick'&&result.installed){entry.phase='complete';entry.percent=100;entry.estimated=false;new Toast({scheme:'success',title:I18n.t('icepick.autoInstalled'),description:I18n.current.startsWith('zh')?'已单独安装到 Icepick 管理目录。':'Installed separately in the Icepick manager.',timeout:5000});window.dispatchEvent(new CustomEvent('tfx-install-complete',{detail:{format:'icepick'}}));window.Icepick?.refresh();}
        else if(result.format!=='mod'){
          controller(result.format)?.adoptImport?.(result.state);
          window.SkinFeedback?.importResult(result.format,result.state);
        }
        render();if(!(result.format==='icepick'&&result.installed))result.installation=await installCurrent();return result;
      }catch(error){
        entry.phase='failed';entry.error=error.message;entry.package=null;resetPanels();return {ok:false,error:error.message};
      }finally{entry.busy=false;stopTicker();render();}
    }
    function inspect(source,name){return importSource('skin-import-inspect',{path:source},name);}
    function select(kind='file'){return importSource('skin-import-select',{kind});}
    async function clear(){
      if(busy())return {ok:false,busy:true,error:t('busy')};
      entry.busy=true;resetPanels();render();
      try{
        const result=await ipcRenderer.invoke('skin-import-clear');if(!result.ok)throw Error(result.error);
        Object.assign(entry,{name:'',format:null,phase:'empty',error:'',package:null,percent:0,estimated:true});return result;
      }catch(error){entry.phase='failed';entry.error=error.message;return {ok:false,error:error.message};}
      finally{entry.busy=false;stopTicker();render();}
    }
    async function retry(){
      if(busy()||!entry.package)return;
      entry.busy=true;startTicker();
      try{return await installCurrent();}catch(error){return installationResult(entry.format,{ok:false,error:error.message});}
      finally{entry.busy=false;stopTicker();render();}
    }
    $('Select').addEventListener('click',()=>select());$('Folder').addEventListener('click',()=>select('folder'));$('Clear').addEventListener('click',clear);$('Retry').addEventListener('click',retry);
    document.addEventListener('dragover',event=>{
      if(!['mods','skins'].includes(Fold.view)||document.getElementById('browser')?.classList.contains('shown'))return;
      event.preventDefault();event.stopImmediatePropagation();document.getElementById('dragUI')?.classList.remove('shown');if(!busy()){if(Fold.view==='skins')area.classList.add('dragging');document.getElementById('modUnifiedImport')?.classList.add('dragging');}
    },true);
    document.addEventListener('dragleave',event=>{if(!event.relatedTarget){area.classList.remove('dragging');document.getElementById('modUnifiedImport')?.classList.remove('dragging');}},true);
    document.addEventListener('drop',event=>{
      if(!['mods','skins'].includes(Fold.view)||document.getElementById('browser')?.classList.contains('shown'))return;
      const files=event.dataTransfer?.files;if(!files?.length)return;
      event.preventDefault();event.stopImmediatePropagation();document.getElementById('dragUI')?.classList.remove('shown');area.classList.remove('dragging');document.getElementById('modUnifiedImport')?.classList.remove('dragging');if(busy())return;
      void (async()=>{let installed=0,failed=0,showInstaller=false;for(const file of files){const result=await inspect(fold.getDroppedFilePath(file),file.name);if(result?.ok&&(result.installed||result.installation?.ok))installed++;else{failed++;showInstaller=true;}}if(showInstaller)Fold.navigate('skins');const status=document.getElementById('modUnifiedStatus');if(status)status.textContent=I18n.current.startsWith('zh')?`本次完成 ${installed} 个，失败 ${failed} 个`:`Finished ${installed}; failed ${failed}`;})();
    },true);
    ipcRenderer.on('skin-import-progress',(_event,value)=>{
      if(!value||entry.format!=='mod'||!entry.busy||entry.phase!=='installing')return;
      if(Number.isFinite(value.percent)){const next=Math.min(99,Math.max(0,value.percent));entry.estimated=Boolean(value.estimate||next<entry.percent);entry.percent=Math.max(entry.percent,next);render();}
    });
    observer=new MutationObserver(()=>{mirrorProgress('dds');mirrorProgress('vtf');});
    for(const kind of ['dds','vtf']){const node=document.getElementById(kind+'Progress');if(node)observer.observe(node,{subtree:true,childList:true,characterData:true});}
    window.addEventListener('vyra-language-changed',render);
    window.addEventListener('beforeunload',()=>{stopTicker();observer.disconnect();},{once:true});
    window.SkinImport=Object.freeze({select,inspect,clear,render,installationResult,get busy(){return Boolean(busy());},get format(){return entry.format;},get state(){return {...entry};}});render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
