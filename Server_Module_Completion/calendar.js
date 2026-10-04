/* Preserve the enhanced Calendar service, including computed holiday defaults. */
(()=>{
'use strict';
const active=()=>!!window.schoolHubPhase12?.isProduction?.(),prior=window.schoolHubData,priorCan=window.can;
window.schoolHubServerPersistence.register(['calendarEvents','calendarHidden','calendarOverrides']);
const call=(path,options)=>window.schoolHubTransport.server.request('/api/v1/calendar-events'+path,options);
let rows=[],loaded=false;
window.can=function(tab,action='view'){
 if(!active()||tab!=='calendar')return priorCan.apply(this,arguments);
 const user=window.__schoolHubPhase7?.getState?.().serverUser;
 return !!user&&(user.role==='Super Admin'||(user.permissions||[]).includes('calendar:'+({add:'create',edit:'update'}[action]||action)));
};
function hydrate(items){
 rows=items;
 state.calendarEvents=items.filter(x=>!x.hidden&&!x.id.startsWith('pre-')).map(x=>({...x.data,id:x.id,noticeId:x.noticeId,version:x.version,source:'user'}));
 state.calendarHidden=items.filter(x=>x.hidden&&x.id.startsWith('pre-')).map(x=>x.id);
 state.calendarOverrides=Object.fromEntries(items.filter(x=>x.id.startsWith('pre-')).map(x=>[x.id,{...x.data,noticeId:x.noticeId,version:x.version}]));
}
async function load(){
 if(!active())return;
 if(window.schoolHubCalendarWorkspace)return window.schoolHubCalendarWorkspace.load();
 loaded=false;hydrate([]);
 const result=await call('');hydrate(result.items||[]);loaded=true;
 if($('calMonth'))renderCal();
}
function version(id){if(!loaded)throw Error('Wait for Calendar to finish loading.');return rows.find(x=>x.id===id)?.version||0;}
async function mutate(path,body,method='POST'){
 const result=await call(path,{method,body,mutation:true});await load();return result;
}
const calendar={...prior.calendar,
 async create(input){if(!active())return prior.calendar.create(input);return mutate('',input);},
 async update(id,input){if(!active())return prior.calendar.update(id,input);return mutate('/'+encodeURIComponent(id),{event:input,version:version(id)},'PATCH');},
 async remove(id){if(!active())return prior.calendar.remove(id);return mutate('/'+encodeURIComponent(id)+'/remove',{version:version(id)});},
 async restore(id){if(!active())return prior.calendar.restore(id);await mutate('/'+encodeURIComponent(id)+'/restore',{version:version(id)});return this.getById(id);},
 async createLinkedNotice(id,input){if(!active())return prior.calendar.createLinkedNotice(id,input);const result=await mutate('/'+encodeURIComponent(id)+'/notice',{notice:input,version:version(id)});await window.schoolHubCommunications.load();return result;}
};
window.schoolHubData=Object.freeze({...prior,calendar:Object.freeze(calendar)});
const priorShow=window.showTab;
window.showTab=function(tab){
 const result=priorShow.apply(this,arguments);
 if(active()&&tab==='calendar'){
  $(tab)?.querySelectorAll('.phase7-local-only').forEach(x=>x.remove());
  load().catch(error=>{if($('calendarGrid'))$('calendarGrid').textContent=error.message;});
 }
 return result;
};
window.schoolHubCalendarServer=Object.freeze({handles:tab=>tab==='calendar',load});
if(active())hydrate([]);
})();
