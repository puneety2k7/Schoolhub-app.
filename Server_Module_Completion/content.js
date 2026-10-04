/* Preserve existing Documents and Rules screens while using server records. */
(()=>{
'use strict';
const active=()=>!!window.schoolHubPhase12?.isProduction?.(),tabs=['documents','rules'],records={},ready={},busy={};
const call=(kind,path='',options)=>window.schoolHubTransport.server.request('/api/v1/school-content/'+kind+path,options);
window.schoolHubServerPersistence.register(['documents','content']);
const priorCan=window.can;
window.can=function(tab,action='view'){
 if(!active()||!tabs.includes(tab))return priorCan.apply(this,arguments);
 const user=window.__schoolHubPhase7?.getState?.().serverUser;
 return !!user&&(user.role==='Super Admin'||(user.permissions||[]).includes(tab+':'+({add:'create',edit:'update'}[action]||action)));
};
function paint(kind){if(kind==='documents')renderDocuments();else renderContent();}
function hydrate(kind,items){records[kind]=items;if(kind==='documents')state.documents=items.map(x=>({...x.data,id:x.id,version:x.version}));else state.content={...state.content,rules:items[0]?.data.html||''};}
async function load(kind){
 if(kind==='documents'&&window.schoolHubDocumentWorkspace)return window.schoolHubDocumentWorkspace.load();
 ready[kind]=false;hydrate(kind,[]);paint(kind);
 const data=await call(kind);hydrate(kind,data.items||[]);ready[kind]=true;paint(kind);
}
async function run(kind,work){if(busy[kind])return false;busy[kind]=true;try{await work();await load(kind);return true;}catch(e){alert(e.message);return false;}finally{busy[kind]=false;}}
function replace(name,fn){const old=window[name];window[name]=function(){return active()?fn.apply(this,arguments):old.apply(this,arguments)};}
replace('addDocument',async function(){
 if(!can('documents','add'))return alert('You do not have permission to add documents.');
 const name=prompt('Document name:','New Circular');if(!name)return;
 await run('documents',()=>call('documents','',{method:'POST',body:{name,cat:'Circular',aud:'All',date:today},mutation:true}));
});
replace('saveDocumentEdit',async function(){
 const item=state.documents.find(x=>x.id===$('docEditId').value);if(!ready.documents||!item)return alert('Refresh the document list first.');
 const data={name:$('docEditName').value.trim(),cat:$('docEditCat').value.trim(),aud:$('docEditAud').value.trim(),date:today};if(!data.name)return alert('Enter a document name.');
 if(await run('documents',()=>call('documents','/'+encodeURIComponent(item.id),{method:'PATCH',body:{data,version:item.version},mutation:true})))closeModal();
});
replace('deleteDocument',async function(id){
 const item=state.documents.find(x=>x.id===id);if(!ready.documents||!item)return alert('Refresh the document list first.');
 if(!confirm('Delete document "'+item.name+'"? This cannot be undone.'))return;
 await run('documents',()=>call('documents','/'+encodeURIComponent(id)+'/remove',{method:'POST',body:{version:item.version},mutation:true}));
});
const oldEdit=window.editContent;
window.editContent=function(kind){
 if(!active()||kind!=='rules')return oldEdit.apply(this,arguments);
 if(!ready.rules)return alert('Wait for Rules to finish loading.');
 oldEdit.apply(this,arguments);
 const button=$('genericModal').querySelector('button.btn.primary');if(button)button.onclick=saveRules;
};
async function saveRules(){
 const item=records.rules?.[0],data={html:$('contentEditor').value};
 if(await run('rules',()=>item?call('rules','/'+encodeURIComponent(item.id),{method:'PATCH',body:{data,version:item.version},mutation:true}):call('rules','',{method:'POST',body:data,mutation:true})))closeModal();
}
const priorShow=window.showTab;
window.showTab=function(tab){
 const result=priorShow.apply(this,arguments);
 if(active()&&tabs.includes(tab)){
  $(tab)?.querySelectorAll('.phase7-local-only').forEach(x=>x.remove());
  load(tab).catch(error=>{const host=tab==='rules'?$('rulesContent'):$('docRows');if(host)host.textContent=error.message;});
 }
 return result;
};
window.schoolHubContentServer=Object.freeze({handles:tab=>tabs.includes(tab),load,saveRules});
if(active()){hydrate('documents',[]);hydrate('rules',[]);}
})();
