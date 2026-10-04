/* Universal Workspace Runtime toggle (frontend ownership only).
 *
 * The backend decides, per operational workspace, whether the Universal Workspace Runtime ('universal')
 * or the legacy/native screens ('legacy') own the frontend. This module is the single place the frontend
 * asks. Exactly one owner is allowed per workspace: every legacy layer must wait for a known mode and
 * must leave a 'universal' workspace untouched. Permissions are NOT governed by this toggle.
 */
(function(){'use strict';
const PAGES={students:'students',teachers:'staff',classes:'classes',attendance:'attendance',timetable:'timetable',homework:'homework',teacherlog:'teacher-work-log',exams:'exams-results',fees:'fees-payments',leave:'leave-requests',notices:'notices',calendar:'calendar-holidays',documents:'documents',certificates:'certificates',uniform:'uniform',curriculum:'curriculum',rules:'rules-regulations',transport:'transport',assets:'assets',idcards:'idcards'};
const customPageId=key=>'custom-workspace-'+String(key).replace(/[^a-z0-9_-]/gi,'-');
const modes=new Map(),customs=new Map(),listeners=new Set();
let status='unknown',loading=null,failures=0,lastAttempt=0;
const server=()=>window.schoolHubTransport?.server;
const isAuthError=error=>['SESSION_EXPIRED','AUTHENTICATION_REQUIRED'].includes(error?.code)||/authentication/i.test(String(error?.message||''));
function notify(){for(const listener of [...listeners])try{listener()}catch(error){console.error('Runtime mode listener failed.',error)}}
function workspaceKeyOf(value){const text=String(value||'');return PAGES[text]||customs.get(text)||(modes.has(text)?text:null)}
function load(force=false){
 if(loading)return loading;
 if(status==='ready'&&!force)return Promise.resolve();
 if(!server()?.request)return Promise.resolve();
 lastAttempt=Date.now();
 loading=server().request('/api/v1/operational-workspaces').then(catalog=>{
  modes.clear();customs.clear();
  for(const item of catalog?.items||[]){
   modes.set(item.workspaceKey,{mode:item.runtimeMode==='universal'?'universal':'legacy',custom:item.system===false,item});
   if(item.system===false)customs.set(customPageId(item.workspaceKey),item.workspaceKey);
  }
  status='ready';failures=0;notify();
 }).catch(error=>{
  if(!isAuthError(error))failures++;
  // A signed-out browser is simply "not known yet"; a server that keeps failing falls back to the legacy owner.
  if(failures>=2){status='failed'}
  notify();
 }).finally(()=>{loading=null});
 return loading;
}
/** 'universal' | 'legacy' | 'unknown'. 'unknown' means the owner is not decided yet: render nothing. */
function modeOf(pageOrKey){
 const key=workspaceKeyOf(pageOrKey);
 if(status==='failed')return 'legacy';
 if(status!=='ready'){if(!loading&&Date.now()-lastAttempt>3000)load();return 'unknown'}
 const entry=key?modes.get(key):null;
 return entry?entry.mode:(key&&Object.values(PAGES).includes(key)?'legacy':'unknown');
}
const isUniversal=value=>modeOf(value)==='universal';
function customWorkspaces(){return [...customs.entries()].map(([pageId,key])=>({pageId,workspaceKey:key,item:modes.get(key)?.item})).filter(entry=>entry.item)}
function onChange(listener){listeners.add(listener);return()=>listeners.delete(listener)}
function reset(){modes.clear();customs.clear();status='unknown';failures=0;lastAttempt=0;notify()}
window.schoolHubRuntimeMode=Object.freeze({PAGES,customPageId,workspaceKeyOf,modeOf,isUniversal,isLegacy:value=>modeOf(value)==='legacy',load,onChange,customWorkspaces,reset});
/* The catalog needs a signed-in session. Follow the application shell: load when it appears, forget when it hides. */
function watchSession(){
 const app=document.getElementById('app');if(!app)return;
 let shown=getComputedStyle(app).display!=='none';
 new MutationObserver(()=>{const now=getComputedStyle(app).display!=='none';if(now===shown)return;shown=now;if(now)load(true);else reset()}).observe(app,{attributes:true,attributeFilter:['style','class']});
 if(shown)load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{load();watchSession()});else{load();watchSession()}
})();
