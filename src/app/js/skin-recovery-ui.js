/* Local resources first; authenticated downloads and installation share a selection. */
(() => {
  'use strict';
  const states=new Map(),busy=new Set(),plans=new Map(),cancelled=new Set(),applying=new Set(),progressValues=new Map();
  const t=(key,values)=>I18n.t('skinRecovery.'+key,values),api=kind=>kind==='dds'?window.Fold?.DDS:window.VTF;
  const running=()=>{if(typeof settings==='undefined')return true;const server=settings.modProfileServer,version=server==='official'?'vanilla':'northstar',region=server==='global'?'global':'cn';return window.VyraLaunchAvailability?.canLaunch(window.VyraGameProcesses?.snapshot,settings,version,region)!==true;};
  const size=bytes=>{const n=Number(bytes)||0,gb=n>=1024**3;return new Intl.NumberFormat(I18n.current,{maximumFractionDigits:1}).format(n/(gb?1024**3:1024**2))+(gb?' GB':' MB');};
  function canStart(kind,value=states.get(kind)){
    return Boolean(value?.package&&value.game?.path&&!value.pending?.length&&value.skinRepair?.state!=='error'&&
      (value.game.ready||value.game.canRepair||value.game.canSteamRepair||value.original?.canSteamRepair)&&
      !value.game.issues?.some(issue=>issue.code==='unsafe'));
  }
  function needsRecovery(kind,value){return !value.game?.ready||(value.original&&value.original.state!=='ready')||value.skinRepair?.ready===false;}
  function button(id,key,callback){const node=document.createElement('button');node.id=id;node.type='button';node.className='fold-button compact';node.dataset.recoveryLabel=key;node.textContent=t(key);node.addEventListener('click',callback);return node;}
  function privacyNotice(location){
    const notice=document.createElement('aside');notice.className='skin-recovery-privacy';notice.dataset.recoveryPrivacy=location;
    for(const key of ['steamPrivacyTitle','steamPrivacyData','steamPrivacySession']){const node=document.createElement(key==='steamPrivacyTitle'?'h4':'p');node.dataset.recoveryLabel=key;node.textContent=t(key);notice.append(node);}return notice;
  }
  function setup(kind){
    let card=document.getElementById(kind+'ResourceRecovery');if(card)return card;
    card=document.createElement('section');card.id=kind+'ResourceRecovery';card.className='dds-original';card.setAttribute('data-i18n-ignore','');card.hidden=true;
    const heading=document.createElement('h4');heading.dataset.recoveryLabel='title';
    const detail=document.createElement('p');detail.className='dds-original-detail';detail.dataset.recoveryDetail='';
    const actions=document.createElement('div');actions.className='dds-original-actions';
    actions.append(button(kind+'ResourceSteam','autoInstall',()=>install(kind)),button(kind+'ResourceSource','source',()=>source(kind)),button(kind+'ResourceContinue','continue',()=>resume(kind)));
    const confirm=document.createElement('div');confirm.className='dds-original-confirm';confirm.hidden=true;
    const warning=document.createElement('p');warning.dataset.recoveryConfirm='';
    const budget=document.createElement('p');budget.dataset.recoveryBudget='';
    const files=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');summary.dataset.recoveryLabel='fileDetails';list.dataset.recoveryFiles='';files.append(summary,list);
    const guide=document.createElement('div');guide.className='skin-recovery-guide';const guideTitle=document.createElement('h4');guideTitle.dataset.recoveryLabel='guideTitle';const steps=document.createElement('ol');
    for(const key of ['guide1','guide2','guide3']){const node=document.createElement('li');node.dataset.recoveryLabel=key;steps.append(node);}guide.append(guideTitle,steps);
    const buttons=document.createElement('div');buttons.append(button(kind+'ResourceCancel','cancel',()=>{plans.delete(kind);confirm.hidden=true;window.SkinFeedback?.finish(kind,{ok:false,cancelled:true});}),button(kind+'ResourceConfirm','downloadInstall',()=>download(kind,true)));confirm.append(warning,budget,files,guide,privacyNotice('confirm'),buttons);
    const progress=document.createElement('div');progress.hidden=true;progress.dataset.recoveryProgress='';
    const qr=document.createElement('pre');qr.dataset.recoveryQr='';qr.className='skin-recovery-qr';qr.hidden=true;qr.setAttribute('aria-label',t('qr'));
    const auth=document.createElement('p');auth.dataset.recoveryAuth='';auth.className='dds-original-detail';auth.hidden=true;
    const status=document.createElement('p');status.dataset.recoveryStatus='';status.setAttribute('role','status');
    const meter=document.createElement('div');meter.className='skin-recovery-meter';meter.dataset.recoveryMeter='';meter.setAttribute('role','progressbar');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');const fill=document.createElement('span');meter.append(fill);
    const authPrivacy=privacyNotice('auth');authPrivacy.hidden=true;
    const stop=button(kind+'ResourceStop','stop',()=>cancel(kind));progress.append(status,meter,auth,qr,authPrivacy,stop);
    const message=document.createElement('p');message.className='dds-original-error';message.setAttribute('role','alert');message.dataset.recoveryMessage='';message.hidden=true;
    card.append(heading,detail,actions,confirm,progress,message);document.getElementById(kind+'FileList').before(card);return card;
  }
  function update(kind,value={}){
    const previous=states.get(kind),card=setup(kind);
    if(previous&&(previous.package?.id!==value.package?.id||previous.selectionRevision!==value.selectionRevision||previous.game?.path!==value.game?.path)){
      plans.delete(kind);card.querySelector('.dds-original-confirm').hidden=true;card.querySelector('[data-recovery-message]').hidden=true;
    }
    states.set(kind,value);const hasIssues=Boolean(value.package&&needsRecovery(kind,value)),locked=Boolean(value.busy||busy.size||running());
    card.hidden=!hasIssues&&!busy.has(kind)&&!plans.has(kind)&&card.querySelector('[data-recovery-message]').hidden;card.setAttribute('aria-busy',String(locked));
    card.querySelector('[data-recovery-detail]').textContent=value.skinRepair?.state==='error'?I18n.text(value.skinRepair.reason):t(value.game?.canRepair?'autoHint':'sourceHint');
    for(const node of card.querySelectorAll('button'))node.disabled=locked;
    document.getElementById(kind+'ResourceSteam').disabled=locked||!canStart(kind,value);
    document.getElementById(kind+'ResourceContinue').hidden=true;
    document.getElementById(kind+'ResourceStop').disabled=!busy.has(kind)||cancelled.has(kind)||applying.has(kind);
    for(const node of card.querySelectorAll('[data-recovery-label]'))node.textContent=t(node.dataset.recoveryLabel);
    card.querySelector('[data-recovery-qr]').setAttribute('aria-label',t('qr'));
    for(const suffix of ['SelectPackage','SelectFolder','ClearPackage','Refresh','Install']){
      const node=document.getElementById(kind+suffix);if(node&&busy.size)node.disabled=true;
    }
    if(!hasIssues&&!busy.has(kind)&&!plans.has(kind))card.querySelector('.dds-original-confirm').hidden=true;
    if(plans.has(kind))renderPlan(kind,plans.get(kind).plan);
    if(progressValues.has(kind)&&busy.has(kind))renderProgress(kind,progressValues.get(kind));
  }
  const identity=value=>({id:value.package.id,revision:value.selectionRevision,path:value.game.path});
  function stillSelected(kind,selected){const value=api(kind)?.state;return value?.package?.id===selected.id&&value.selectionRevision===selected.revision&&value.game?.path===selected.path;}
  function check(kind,selected){if(!stillSelected(kind,selected))throw Error(t('selectionChanged'));if(cancelled.has(kind))throw Error(t('cancelled'));}
  function updateAll(){for(const[kind,value]of states)update(kind,value);}
  async function perform(kind,work){
    const value=api(kind)?.state||states.get(kind);if(!value?.package||value.busy||busy.size||running())return null;
    window.SkinFeedback?.beginInstall(kind);
    const selected=identity(value);cancelled.delete(kind);busy.add(kind);updateAll();
    const card=setup(kind),message=card.querySelector('[data-recovery-message]');message.hidden=true;card.hidden=false;
    let completed=false;
    try{const result=await work(selected);completed=Boolean(result?.ok&&!result.cancelled&&!result.confirmationRequired&&stillSelected(kind,selected));if(result?.confirmationRequired)window.SkinFeedback?.waiting(kind);else if(result?.cancelled)window.SkinFeedback?.finish(kind,result);return result;}catch(error){message.textContent=I18n.text(error.message);message.hidden=false;card.hidden=false;const result={ok:false,cancelled:cancelled.has(kind),error:error.message};window.SkinFeedback?.finish(kind,result);return result;}
    finally{
      busy.delete(kind);applying.delete(kind);progressValues.delete(kind);card.querySelector('[data-recovery-progress]').hidden=true;
      const qr=card.querySelector('[data-recovery-qr]');qr.hidden=true;qr.textContent='';card.querySelector('[data-recovery-auth]').hidden=true;
      // finishInstallation has already applied or refreshed the active state.
      // The other format still needs a scan after cross-format cleanup. Failed,
      // cancelled and confirmation-only operations retain both recovery scans.
      const refreshKinds=completed?['dds','vtf'].filter(value=>value!==kind):['dds','vtf'];
      await Promise.all(refreshKinds.map(value=>api(value)?.refresh()));
      if(completed)api(kind)?.render?.();updateAll();
    }
  }
  async function directInstall(kind,selected){
    await api(kind).refresh();check(kind,selected);const value=api(kind).state;
    if(!(value.game.ready||value.game.canRepair)||(kind==='dds'&&!window.DDSOriginal.canInstall(value.package,value.original)))throw Error(t('notReady'));
    api(kind).clearError?.();const result=await api(kind).install({skipRecovery:true});if(!result?.ok)throw Error(result?.error||t('notReady'));return result;
  }
  function install(kind){const value=api(kind)?.state||states.get(kind);if(!canStart(kind,value))return null;return needsRecovery(kind,value)?download(kind):perform(kind,selected=>directInstall(kind,selected));}
  function resume(kind){return install(kind);}
  function source(kind){return perform(kind,async selected=>{
    const result=await ipcRenderer.invoke(kind+'-originals-select',{packageId:selected.id,selectionRevision:selected.revision,kind:'folder'});
    if(result.cancelled)return result;if(!result.ok)throw Error(result.error||t('notReady'));check(kind,selected);return directInstall(kind,selected);
  });}
  function renderPlan(kind,plan){
    const card=setup(kind);card.querySelector('[data-recovery-confirm]').textContent=t(plan.staged?'stagedConfirm':'confirm',{count:plan.count??plan.files?.length??0,size:size(plan.initialBytes??plan.totalBytes)});
    card.querySelector('[data-recovery-budget]').textContent=plan.staged?t('stagedBudget',{size:size(plan.maxTotalBytes??plan.stagedMaxBytes??plan.totalBytes),space:size(plan.requiredCacheBytes)}):t('budget',{space:size(plan.requiredCacheBytes)});
    const list=card.querySelector('[data-recovery-files]');list.replaceChildren();for(const file of plan.files||[]){const row=document.createElement('li');row.textContent=(typeof file==='string'?file:file.path)+' · '+size(file.size);list.append(row);}
  }
  async function execute(kind,selected){
    const card=setup(kind);plans.delete(kind);card.querySelector('.dds-original-confirm').hidden=true;card.querySelector('[data-recovery-progress]').hidden=false;
    renderProgress(kind,{phase:'checking'});
    const result=await ipcRenderer.invoke(kind+'-resource-download',{packageId:selected.id,selectionRevision:selected.revision,installAfterRepair:true});
    check(kind,selected);if(result.cancelled){cancelled.add(kind);throw Error(t('cancelled'));}if(!result.ok)throw Error(result.error||t('notReady'));
    if(result.installed){api(kind).clearError?.();await api(kind).finishInstallation?.(result);return result;}
    throw Error(t('notReady'));
  }
  function download(kind,confirmed=false){return perform(kind,async selected=>{
    const card=setup(kind);
    if(!confirmed){
      renderProgress(kind,{phase:'checking'});
      const result=await ipcRenderer.invoke(kind+'-resource-plan',{packageId:selected.id,selectionRevision:selected.revision,installAfterRepair:true});
      if(!result.ok)throw Error(result.error||t('notReady'));check(kind,selected);const plan=result.plan||result;
      if(plan.localRepair)return execute(kind,selected);
      plans.set(kind,{selected,plan});renderPlan(kind,plan);card.querySelector('.dds-original-confirm').hidden=false;
      document.getElementById(kind+'ResourceConfirm').focus();return {ok:true,confirmationRequired:true,plan};
    }
    const prepared=plans.get(kind);if(!prepared||!stillSelected(kind,prepared.selected))throw Error(t('selectionChanged'));
    return execute(kind,selected);
  });}
  async function cancel(kind){
    if(!busy.has(kind)||applying.has(kind))return null;document.getElementById(kind+'ResourceStop').disabled=true;
    const result=await ipcRenderer.invoke(kind+'-resource-cancel');if(result.cancelled)cancelled.add(kind);return result;
  }
  function renderProgress(kind,value){
    const card=setup(kind);card.hidden=false;card.querySelector('[data-recovery-progress]').hidden=false;
    const phase=value.phase||'checking',auth=phase==='auth',labels={checking:'checking',helper:'helper',auth:value.qrLines?.length?'qr':'authWaiting',authenticated:'authenticated',download:'downloading',verify:'verifying','stage-plan':'stagePlan',repair:'repairing',install:'installing',complete:'verified'};
    const percent=Number.isFinite(value.percent)?Math.max(0,Math.min(100,value.percent)):null;
    const label=t(labels[phase]||'checking');card.querySelector('[data-recovery-status]').textContent=label+(percent!==null?' · '+Math.round(percent)+'%':phase==='verify'&&value.count?' · '+value.index+'/'+value.count:'');
    const meter=card.querySelector('[data-recovery-meter]');meter.classList.toggle('indeterminate',percent===null);meter.setAttribute('aria-label',label);
    if(percent===null)meter.removeAttribute('aria-valuenow');else meter.setAttribute('aria-valuenow',String(percent));meter.firstChild.style.width=percent===null?'34%':percent+'%';
    const hint=card.querySelector('[data-recovery-auth]');hint.hidden=!auth;hint.textContent=t('authHint');
    card.querySelector('[data-recovery-privacy="auth"]').hidden=!auth;
    const qr=card.querySelector('[data-recovery-qr]');if(auth&&value.qrLines?.length){qr.textContent=value.qrLines.join('\n');qr.hidden=false;}else{qr.hidden=true;qr.textContent='';}
    if(value.canCancel===false){applying.add(kind);document.getElementById(kind+'ResourceStop').disabled=true;}
  }
  ipcRenderer.on('skin-resource-progress',(_event,value)=>{if(!['dds','vtf'].includes(value?.kind)||!busy.has(value.kind))return;window.SkinFeedback?.progress(value.kind,value);progressValues.set(value.kind,value);renderProgress(value.kind,value);});
  window.SkinRecovery=Object.freeze({update,source,resume,install,download,cancel,canStart,get busy(){return busy.size>0;}});
  window.addEventListener('vyra-language-changed',updateAll);
})();
