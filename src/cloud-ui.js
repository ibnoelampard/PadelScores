import { parseBackup, serializeBackup, MAX_BACKUP_BYTES } from './backup.js';
import { STORAGE_KEY } from './storage.js';
import { cloudText } from './cloud-messages.js';
export function createCloudUI({cloud,i18n,signIn,signOut,onImport}) {
 const t=key=>cloudText(i18n.getLanguage(),key);
 let connected=true;let loginError=false;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const btn=(label,action)=>{const b=node('button',t(label),'secondary-btn');b.type='button';b.addEventListener('click',action);return b;};
 const download=state=>{
   const url=URL.createObjectURL(new Blob([serializeBackup(state)],{type:'application/json'}));
   const a=node('a');a.href=url;a.download=`padelscore-${new Date().toISOString().replaceAll(':','-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 function legacy(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?parseBackup(raw):null;}catch{return null;}}
 const hasLegacy=()=>legacy()?.session.status!=='empty' && Boolean(legacy());
 function importState(value){
  if(!canEdit())return;
  if(cloud.state.session.status!=='empty'&&!confirm(t('importConfirm')))return;
  onImport(value);
 }
 function canEdit(){return ['ready','saving'].includes(cloud.status)&&!cloud.recovery;}
 function loginView(){
   const panel=node('section',null,'panel auth-panel');panel.append(node('h2',t('title')),node('p',t('intro'),'subtle'));
   if(cloud.status==='loading')panel.append(node('p',t('loading')));
   else if(cloud.user){panel.append(node('p',t('error'),'error'),node('p',t('schemaHint'),'subtle'),btn('retry',()=>cloud.retry()),btn('logout',signOut));}
   else {
    const login=btn('login',async()=>{login.disabled=true;try{await signIn();}catch{loginError=true;login.disabled=false;panel.append(node('p',t('signinError'),'error'));}});login.className='primary-btn';panel.append(login);
    if(loginError)panel.append(node('p',t('signinError'),'error'));
   }
   if(hasLegacy())panel.append(node('p',t('legacyNote'),'subtle'),btn('legacyExport',()=>download(legacy())));
   panel.append(node('p',t('backupHint'),'subtle'));return panel;
 }
 function toolbar(){
  const bar=node('section',null,'cloud-bar');bar.id='cloud-bar';bar.setAttribute('aria-label','Account');
  const label=cloud.dirty&&cloud.status==='ready'?'pending':cloud.status;
  const status=node('p',t(label),'cloud-status');status.setAttribute('role','status');
  bar.append(node('div',cloud.user?.email||'','cloud-account'),status);
  if(cloud.localWarning)bar.append(node('p',t('localWarning'),'error'));
  if(!connected)bar.append(node('p',t('connection'),'subtle'));
  const actions=node('div',null,'cloud-actions');
  actions.append(btn('export',()=>download(cloud.state)));
  if(cloud.recovery){
   bar.append(node('p',t('recovery'),'subtle'));actions.append(btn('restore',()=>cloud.restoreRecovery()),btn('recoveryExport',()=>download(cloud.recovery.state)),btn('reload',()=>{if(confirm(t('discard')))void cloud.discardAndReload();}));
  }else if(cloud.status==='conflict')actions.append(btn('reload',()=>{if(confirm(t('discard')))void cloud.discardAndReload();}));
  else if(cloud.status==='error')actions.append(btn('retry',()=>cloud.retry()));
  if(canEdit()){
   const file=node('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
   file.addEventListener('change',async()=>{const f=file.files?.[0];const accountId=cloud.user?.id;if(!f)return;try{if(f.size>MAX_BACKUP_BYTES)throw new Error();const parsed=parseBackup(await f.text());if(cloud.user?.id===accountId)importState(parsed);}catch{alert(t('invalid'));}finally{file.value='';}});
   actions.append(btn('import',()=>file.click()),file);
   if(hasLegacy())actions.append(btn('legacy',()=>importState(legacy())));
  }
  actions.append(btn('logout',async()=>{if(cloud.dirty||cloud.recovery){alert(t('busyLogout'));return;}await signOut();}));bar.append(actions);return bar;
 }
 function update(){
  const bar=document.getElementById('cloud-bar');if(bar)bar.replaceWith(toolbar());
  document.querySelectorAll('#app input:not([type=file]), #app select, #app button').forEach(control=>{
   if(control.closest('.cloud-bar') || control.closest('.auth-panel') || control.classList.contains('icon-btn'))return;
   // Preserve existing feature-specific disabled states when unlocking.
   if(!canEdit()){if(!control.disabled){control.dataset.cloudDisabled='true';control.disabled=true;}}
   else if(control.dataset.cloudDisabled){control.disabled=false;delete control.dataset.cloudDisabled;}
  });
 }
 return {loginView,toolbar,update,canEdit,download,t,setConnection(value){connected=value;update();}};
}
