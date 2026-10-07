(function(){'use strict';
const id=value=>document.getElementById(value),escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const request=(path,options)=>window.schoolHubTransport.server.request(path,options),serverMode=()=>window.schoolHubTransport?.getMode?.()!=='Local';
const fallback=()=>({gridTabs:false,version:1,canManage:false});
let model=null,pending=null;
async function load(refresh=false){
 if(!serverMode())return fallback();
 if(model&&!refresh)return model;
 if(pending&&!refresh)return pending;
 pending=request('/api/v1/experimental-features').then(value=>(model=value)).finally(()=>{pending=null});
 return pending;
}
async function gridTabsEnabled(){try{return(await load()).gridTabs===true}catch(_){return false}}
function paint(){
 const host=id('experimentalFeatureSettings');if(!host||!model)return;
 host.innerHTML='<div class="section-title"><div><h2>Experimental Features</h2><div class="muted">Optional features stay off until the System Administrator enables them for this school.</div></div><span class="badge">Experimental</span></div><div class="experimental-warning"><b>Grid tabs are experimental.</b><span>When disabled, SchoolHub uses the established workspace screens. Existing Grid configuration, permissions, and records remain stored and are not deleted.</span></div><label class="experimental-toggle"><input id="experimentalGridTabs" type="checkbox" '+(model.gridTabs?'checked':'')+'><span><b>Enable Grid tabs</b><small>Add Main and Grid 1–3 workspace navigation, dashboards, and configured Grid actions.</small></span></label><div class="quick"><button class="btn primary" id="experimentalFeaturesSave">Save Experimental Settings</button><span class="muted" id="experimentalFeaturesStatus"></span></div>';
 id('experimentalFeaturesSave').onclick=save;
}
async function save(){
 const button=id('experimentalFeaturesSave'),status=id('experimentalFeaturesStatus'),gridTabs=!!id('experimentalGridTabs')?.checked;
 button.disabled=true;status.textContent='Saving...';
 try{
  model=await request('/api/v1/experimental-features',{method:'PATCH',body:{gridTabs,version:model.version},mutation:true});
  status.textContent='Saved. Reloading SchoolHub to apply the selected workspace experience...';
  setTimeout(()=>window.location.reload(),600);
 }catch(error){button.disabled=false;status.textContent=error.message||'The experimental settings could not be saved.'}
}
async function renderSettings(){
 if(!serverMode())return;
 let host=id('experimentalFeatureSettings');
 if(!host){host=document.createElement('div');host.id='experimentalFeatureSettings';host.className='card experimental-settings';(id('uia1Pane-phases')||id('settings'))?.appendChild(host)}
 if(!host)return;
 host.innerHTML='<h2>Loading Experimental Features...</h2>';
 try{await load(true);if(!model.canManage){host.remove();return}paint()}catch(error){host.innerHTML='<h2>Experimental Features</h2><div class="notice">'+escape(error.message||'Experimental settings could not be loaded.')+'</div>'}
}
const previous=window.showTab;
if(typeof previous==='function')window.showTab=function(tab){const result=previous.apply(this,arguments);if(tab==='settings')setTimeout(renderSettings,0);return result};
document.addEventListener('DOMContentLoaded',()=>{if(id('settings')?.classList.contains('active'))renderSettings()});
window.schoolHubExperimentalFeatures=Object.freeze({load,gridTabsEnabled,renderSettings,getConfiguration:()=>model});
})();
