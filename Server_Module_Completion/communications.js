/* Server adapter for the existing Notice Board service and screens. */
(()=>{
'use strict';
const active=()=>!!window.schoolHubPhase12?.isProduction?.();
const request=(path,options)=>window.schoolHubTransport.server.request('/api/v1/communications'+path,options);
const prior=window.schoolHubData,priorCan=window.can;
window.schoolHubServerPersistence.register(['notices']);
let loaded=false;
window.can=function(tab,action='view'){
 if(!active()||tab!=='notices')return priorCan.apply(this,arguments);
 const user=window.__schoolHubPhase7?.getState?.().serverUser;
 return !!user&&(user.role==='Super Admin'||(user.permissions||[]).includes(tab+':'+({add:'create',edit:'update'}[action]||action)));
};
async function load(){
 if(!active())return;
 if(window.schoolHubStandardWorkspaces)return window.schoolHubStandardWorkspaces.load('notices');loaded=false;state.notices=[];if($('noticeRows'))renderNotices();
 try{const result=await request('');state.notices=result.items||[];loaded=true;if($('noticeRows'))renderNotices();}
 catch(error){if($('noticeRows'))$('noticeRows').innerHTML='<tr><td colspan="6">'+esc(error.message)+'</td></tr>';throw error;}
}
function record(id){const item=state.notices.find(x=>String(x.id)===String(id));if(!loaded||!item)throw Error('Refresh the notice list before changing this record.');return item;}
const notices={
 ...prior.notices,
 async create(input){if(!active())return prior.notices.create(input);const result=await request('',{method:'POST',body:input,mutation:true});await load();return result;},
 async update(id,input){if(!active())return prior.notices.update(id,input);const item=record(id),result=await request('/'+encodeURIComponent(id),{method:'PATCH',body:{...input,version:item.version},mutation:true});await load();return result;},
 async remove(id){if(!active())return prior.notices.remove(id);const item=record(id);await request('/'+encodeURIComponent(id)+'/archive',{method:'POST',body:{version:item.version},mutation:true});await load();return item;}
};
window.schoolHubData=Object.freeze({...prior,notices:Object.freeze(notices)});
const priorShow=window.showTab;
window.showTab=function(tab){
 const result=priorShow.apply(this,arguments);
 if(active()&&tab==='notices'){$(tab)?.querySelectorAll('.phase7-local-only').forEach(x=>x.remove());load().catch(()=>{});}
 return result;
};
window.schoolHubCommunications=Object.freeze({handles:tab=>tab==='notices',load});
if(active())state.notices=[];
})();
