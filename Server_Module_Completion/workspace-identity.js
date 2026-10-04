/* Screen identity only: reuse branding nodes, navigation labels and action handlers. */
(()=>{
'use strict';
const content=document.querySelector('#app>.content'),bar=document.querySelector('#app>.topbar');if(!content||!bar)return;
const copy=document.getElementById('brandName')?.closest('.brand-copy'),space=bar.querySelector('.frame-brand-space');
if(copy&&space){space.replaceWith(copy);copy.classList.add('frame-school-identity');copy.removeAttribute('aria-hidden')}
function syncSchoolName(){const name=typeof state!=='undefined'?state.settings?.school:null,node=document.getElementById('brandName');if(node&&name!=null){if(node.textContent!==String(name))node.textContent=String(name);node.title=String(name)}}
// Some legacy branding refreshes update only the logo. Keep the name bound to the same settings source.
const existingBranding=window.branding;if(typeof existingBranding==='function')window.branding=function(){const result=existingBranding.apply(this,arguments);syncSchoolName();return result};
const schoolLogo=document.getElementById('brandLogo');if(schoolLogo)new MutationObserver(syncSchoolName).observe(schoolLogo,{attributes:true,attributeFilter:['src','class','style']});syncSchoolName();
const descriptions={dashboard:'View school activity, summaries and important updates.',students:'Manage student profiles, enrolment and academic information.',teachers:'Manage teaching and non-teaching staff.',classes:'Manage classes, sections and class-teacher assignments.',attendance:'Mark and manage student attendance.',timetable:'Manage class schedules, teaching periods and room allocations.',homework:'Create and manage homework for your classes.',teacherlog:'Record what was taught in each class and period.',exams:'Manage assessments, marks, report cards and student skill evaluations.',fees:'Track dues, collections and receipts across the school.',leave:'Manage student and staff leave applications and approvals.',notices:'Create and manage school notices and announcements.',calendar:'View school events, holidays and important dates.',documents:'Manage school documents, policies, forms and shared resources.',certificates:'Manage student certificates and school forms.',uniform:'Manage school uniform categories and guidelines.',curriculum:'Manage class-wise subjects and curriculum.',rules:'Manage school rules, policies and regulations.',transport:'Manage routes, vehicles, drivers and student assignments.',reports:'View and print school reports.',auditlog:'Review recorded activity and audit events.',users:'Manage user accounts, roles and access.',settings:'Manage school configuration and system settings.',portal:'View your school information and available services.'};
const aliases={dashboard:['School Dashboard','Welcome back!','Dashboard'],calendar:['School Calendar & Holidays'],documents:['School Documents'],uniform:['School Uniform'],curriculum:['Class-wise Curriculum'],auditlog:['Server Audit Log'],settings:['Settings','Admin Settings'],exams:['Exams, Marks & Report Cards'],timetable:['Timetable']};
const normalized=x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
function navigation(key){const nav=[...document.querySelectorAll('#mainNav [data-tab]')].find(x=>x.dataset.tab===key);let group=nav?.previousElementSibling;while(group&&!group.classList.contains('group'))group=group.previousElementSibling;return{title:key==='settings'?'Settings':nav?.dataset.title||nav?.querySelector('.nav-label')?.textContent||key,category:key==='settings'?'ADMIN CONSOLE':group?.textContent?.trim()||'SYSTEM'}}
function normalize(section){
 const key=section.id,meta=navigation(key),titles=new Set([meta.title,...aliases[key]||[]].map(normalized));
 let header=section.querySelector('.workspace-identity');
 if(!header){
  const heading=(key==='dashboard'?section.querySelector('.dash-intro h1'):null)||[...section.querySelectorAll('h1,h2')].find(h=>!h.closest('.record-drawer,.hw-drawer,.modal,.uia1-pane')&&titles.has(normalized(h.textContent)));
  header=heading?.closest('.hw-title,.section-title,.dash-intro,.uia1-top');
  if(header&&!section.contains(header))header=null;
  if(!header){header=document.createElement('div');const label=document.createElement('div');if(heading)label.append(heading);else{const h=document.createElement('h2');h.textContent=meta.title;label.append(h)}header.append(label)}
  header.classList.add('workspace-identity');
  // Keep actions inside their original workspace, with the same nodes and handlers.
  section.prepend(header);
 }
 if(section.firstElementChild!==header)section.prepend(header);
 let heading=header.querySelector('h1,h2');if(!heading){heading=document.createElement('h2');heading.textContent=meta.title;header.prepend(heading)}
 let label=heading.parentElement;if(label===header){label=document.createElement('div');header.insertBefore(label,heading);label.append(heading)}label.classList.add('workspace-identity-copy');
 // Preserve original headings (and IDs) for existing renderers/print builders.
 if(!heading.dataset.identityOriginal)heading.dataset.identityOriginal=heading.textContent;
 heading.classList.add('workspace-identity-title');if(heading.textContent!==meta.title)heading.textContent=meta.title;
 let category=label.querySelector('.workspace-category');if(!category){category=[...label.children].find(x=>x!==heading&&normalized(x.textContent)===normalized(meta.category));if(!category){category=document.createElement('div');label.prepend(category)}category.classList.add('workspace-category')}category.textContent=meta.category;
 let description=label.querySelector('.workspace-description');if(!description){description=[...label.children].find(x=>x!==heading&&x!==category&&x.matches('p,.muted,.record-drawer-subtitle'));if(!description){description=document.createElement('p');description.textContent=descriptions[key]||'Manage '+meta.title.toLowerCase()+'.';label.append(description)}description.classList.add('workspace-description')}
 if(key==='settings')description.textContent=descriptions.settings;
 for(const other of section.querySelectorAll('h1,h2'))if(other!==heading&&!other.closest('.record-drawer,.hw-drawer,.modal,.uia1-pane')&&titles.has(normalized(other.textContent)))other.classList.add('workspace-duplicate-title');
}
let queued=false;const observer=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(refresh)}});
function refresh(){queued=false;observer.disconnect();try{syncSchoolName();const active=content.querySelector(':scope>.section.active');if(active)normalize(active)}finally{observer.observe(content,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}}
window.schoolHubWorkspaceIdentity=Object.freeze({refresh});refresh();
})();
