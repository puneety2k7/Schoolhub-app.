/* Keep original Uniform/Curriculum forms; persist records and attachments on server. */
(()=>{
'use strict';
const active=()=>!!window.schoolHubPhase12?.isProduction?.(),keys={uniform:'uniformCategories',curriculum:'curriculumEntries'},ready={},busy={};let classes=[];
window.schoolHubServerPersistence.register(Object.values(keys));
const request=(kind,path='',options)=>schoolHubTransport.server.request('/api/v1/resource-catalogs/'+kind+path,options);
const priorCan=window.can;window.can=function(tab,action='view'){
 if(!active()||!keys[tab])return priorCan.apply(this,arguments);
 const user=window.__schoolHubPhase7?.getState?.().serverUser;
 return !!user&&(user.role==='Super Admin'||(user.permissions||[]).includes(tab+':'+({add:'create',edit:'update'}[action]||action)));
};
function paint(kind){if(kind==='uniform')renderUniformCategories();else renderCurriculumEntries();}
async function load(kind){ready[kind]=false;state[keys[kind]]=[];paint(kind);const data=await request(kind);state[keys[kind]]=(data.items||[]).map(r=>({...r.data,id:r.id,version:r.version}));if(kind==='curriculum')classes=data.classes||[];ready[kind]=true;paint(kind);}
function replace(name,fn){const old=window[name];window[name]=function(){return active()?fn.apply(this,arguments):old.apply(this,arguments)};}
async function saveResource(kind){
 if(!ready[kind])return alert('Wait for the records to finish loading.');if(busy[kind])return;
 const uniform=kind==='uniform',prefix=uniform?'unf':'cur',id=$(prefix+'Id').value,old=state[keys[kind]].find(r=>r.id===id);
 if(id&&!old)return alert('Refresh the list before editing.');
 const image=uniform?__unfPendingImage:__curPendingImage,document=uniform?__unfPendingDoc:__curPendingDoc,documentName=uniform?__unfPendingDocName:__curPendingDocName;
 const data={description:$(prefix+'Description').value,image:image===null?(old?.image||''):image,document:document===null?(old?.document||''):document,documentName:document===null?(old?.documentName||''):(document?documentName||'':'')};
 if(uniform)data.name=$('unfName').value.trim();else{data.class=$('curClass').value;data.subjects=$('curSubjects').value.trim();}
 busy[kind]=true;try{
  await request(kind,id?'/'+encodeURIComponent(id):'',{method:id?'PATCH':'POST',body:id?{data,version:old.version}:data,mutation:true});
  if(uniform){__unfPendingImage=null;__unfPendingDoc=null;__unfPendingDocName=null;}else{__curPendingImage=null;__curPendingDoc=null;__curPendingDocName=null;}
  closeModal();await load(kind);
 }catch(e){alert(e.message);}finally{busy[kind]=false;}
}
async function remove(kind,id){
 if(!ready[kind]||busy[kind])return;const row=state[keys[kind]].find(r=>r.id===id);if(!row)return;
 if(!confirm('Delete "'+(row.name||row.class)+'" and its attachments from the active list?'))return;
 busy[kind]=true;try{await request(kind,'/'+encodeURIComponent(id)+'/remove',{method:'POST',body:{version:row.version},mutation:true});await load(kind);}catch(e){alert(e.message);}finally{busy[kind]=false;}
}
replace('saveUniform',()=>saveResource('uniform'));replace('saveCurriculum',()=>saveResource('curriculum'));
replace('deleteUniform',id=>remove('uniform',id));replace('deleteCurriculum',id=>remove('curriculum',id));
function fillClasses(selected=''){$('curClass').innerHTML=classes.map(c=>'<option '+(c.name===selected?'selected':'')+'>'+esc(c.name)+'</option>').join('');}
replace('openAddCurriculum',function(){if(!ready.curriculum)return alert('Wait for Curriculum to finish loading.');if(!classes.length)return alert('Add at least one active school class first.');__curPendingImage=null;__curPendingDoc=null;__curPendingDocName=null;openModal('Add Curriculum',curriculumModalBody({}));fillClasses();});
replace('openEditCurriculum',function(id){const row=state.curriculumEntries.find(r=>r.id===id);if(!row)return;__curPendingImage=null;__curPendingDoc=null;__curPendingDocName=null;openModal('Edit Curriculum',curriculumModalBody(row));fillClasses(row.class);});
const priorShow=window.showTab;window.showTab=function(tab){const result=priorShow.apply(this,arguments);if(active()&&keys[tab]){$(tab)?.querySelectorAll('.phase7-local-only').forEach(x=>x.remove());load(tab).catch(e=>{const host=$(keys[tab]);if(host)host.textContent=e.message;});}return result;};
window.schoolHubResourceServer=Object.freeze({handles:tab=>!!keys[tab],load});
if(active())for(const key of Object.values(keys))state[key]=[];
})();
