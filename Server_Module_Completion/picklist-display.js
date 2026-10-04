(function(){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors={green:'#168a52',red:'#c83b46',amber:'#a56b00',blue:'#2563eb',purple:'#7c3aed',gray:'#64748b',teal:'#0f827c'};
function hex(color){return colors[color]||(/^#[0-9a-f]{6}$/i.test(color||'')?color:'#64748b')}
function inline(color){const c=hex(color),rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2],fg=l>.179?'#000000':'#ffffff';return 'background:'+c+'!important;color:'+fg+'!important;border-color:'+c+'!important'}
let cache=[],busy;
function row(key,value){return cache.find(x=>x.key===key&&x.value===value)}
function badge(values,value){const x=values?.find(x=>x.value===value);return '<span class="pl-badge" style="'+inline(x?.color)+'">'+esc(x?.label||value||'—')+'</span>'}
async function refresh(){if(!window.schoolHubPhase12?.isProduction()||!window.__schoolHubPhase7?.getState()?.serverUser)return;if(busy)return busy;busy=(async()=>{const r=await schoolHubTransport.server.request('/api/v1/picklist-display');cache=r.items||[];decorate()})();try{await busy}finally{busy=null}}
function decorate(){
 document.querySelectorAll('[data-picklist-key][data-picklist-value]').forEach(el=>{const x=row(el.dataset.picklistKey,el.dataset.picklistValue);if(x&&el.dataset.plColor!==x.color){el.style.cssText=inline(x.color);el.dataset.plColor=x.color}});
 // Compatibility for the existing Student status badge renderer.
 document.querySelectorAll('#students .badge').forEach(el=>{const code=el.dataset.plValue||el.textContent.trim(),x=row('studentStatus',code);if(x){el.dataset.plValue=code;const css=inline(x.color);if(el.style.cssText!==css)el.style.cssText=css;if(el.textContent!==x.label)el.textContent=x.label}});
}
const style=document.createElement('style');style.textContent='.pl-badge{display:inline-block;padding:4px 9px;border-radius:8px;font-size:12px;line-height:1.4;white-space:nowrap}';document.head.append(style);
let scheduled=false;new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate()})}}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-tab]'))refresh().catch(()=>{})});
window.schoolHubPicklistDisplay={colors,hex,inline,badge,refresh,row};
})();

