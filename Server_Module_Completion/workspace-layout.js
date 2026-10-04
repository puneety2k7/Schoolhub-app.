(function(){'use strict';
const core=window.schoolHubLayoutCore;
if(!core)return;
const pageKeys={students:'students',teachers:'staff',classes:'classes',attendance:'attendance',timetable:'timetable',homework:'homework',teacherlog:'teacher-work-log',exams:'exams-results',fees:'fees-payments',leave:'leave-requests',notices:'notices',calendar:'calendar-holidays',documents:'documents',certificates:'certificates',uniform:'uniform',curriculum:'curriculum',rules:'rules-regulations',transport:'transport',assets:'assets',idcards:'idcards'};
const tabKeys=['MAIN','GRID_1','GRID_2','GRID_3'];
const typeLabels={metric:'Summary',chart:'Chart',filters:'Filters',table:'Table',calendar:'Calendar',schedule:'Schedule',cards:'Cards'};
const states=new Map(),editors=new WeakMap();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const request=(path,options)=>window.schoolHubTransport.server.request('/api/v1/workspace-layouts'+path,options);
const clone=value=>JSON.parse(JSON.stringify(value));
const field=(model,key)=>model.fields.find(item=>item.fieldKey===key);
const label=(model,key)=>field(model,key)?.label||key||'';
const format=value=>value==null||value===''?'—':core.text(value);
const option=(value,text,current)=>'<option value="'+esc(value)+'" '+(value===current?'selected':'')+'>'+esc(text)+'</option>';
const fieldOptions=(model,source,current='',filter)=>'<option value="">Select field</option>'+model.fields.filter(item=>item.tabKey===source&&(!filter||filter(item))).map(item=>option(item.fieldKey,item.label,current)).join('');
const multiOptions=(model,source,selected=[])=>model.fields.filter(item=>item.tabKey===source).map(item=>'<option value="'+esc(item.fieldKey)+'" '+(selected.includes(item.fieldKey)?'selected':'')+'>'+esc(item.label)+'</option>').join('');
const widthClass=value=>'ul-width-'+(value||'half');
const isVisible=section=>section.classList.contains('active')||getComputedStyle(section).display!=='none';

function tabCandidates(section){
 return[...section.querySelectorAll('.tabs,.tt-tabs,.hw-tabs,.ew-tabs,.uw-tabs,[role="tablist"]')].filter(group=>group.closest('.section')===section&&!group.closest('.modal,.record-drawer,.hw-drawer,.uia1-pane')&&group.id!=='studentProfileTabs'&&group.querySelector(':scope > button'));
}
function nativeTabGroup(section){
 const score=group=>{let depth=0,node=group;while(node.parentElement&&node.parentElement!==section){depth++;node=node.parentElement}return 200-depth*25+group.querySelectorAll(':scope > button').length*40+(group.id?30:0)+(group.classList.contains('uw-tabs')?0:20)-(group.dataset.shSupersededTabs?500:0)};
 return tabCandidates(section).sort((a,b)=>score(b)-score(a))[0]||null;
}

function contentAnchor(section,group){let node=group;while(node.parentElement&&node.parentElement!==section)node=node.parentElement;return node}
function contentNodes(state){
 const children=[...state.section.children],anchor=contentAnchor(state.section,state.group),nodes=[];let after=false;
 for(const child of children){if(child===anchor){after=true;continue}if(after&&child!==state.host&&child!==state.section.querySelector(':scope > .workspace-identity'))nodes.push(child)}
 return nodes;
}
function restoreWorkspaceContent(state){for(const node of state.hiddenNodes||[]){node.hidden=false;delete node.dataset.shDashboardHidden}state.hiddenNodes=[]}
function hideWorkspaceContent(state){restoreWorkspaceContent(state);state.hiddenNodes=contentNodes(state);for(const node of state.hiddenNodes){node.hidden=true;node.dataset.shDashboardHidden='true'}}
function reconcileWorkspaceShell(state){
 for(const group of tabCandidates(state.section)){
  if(group===state.group){group.hidden=false;group.classList.remove('sh-superseded-tabs');delete group.dataset.shSupersededTabs;continue}
  if(group.parentElement===state.section||group.classList.contains('uw-tabs')){group.hidden=true;group.classList.add('sh-superseded-tabs');group.dataset.shSupersededTabs='true'}
 }
 const pane=[...state.section.querySelectorAll('.uw-grid-pane')].find(item=>item.closest('.section')===state.section&&!item.closest('.modal,.record-drawer,.hw-drawer,.uia1-pane'));
 if(pane&&pane.previousElementSibling!==state.host)state.host.after(pane);
}
function markSelected(state,button){
 state.group.querySelectorAll(':scope > button').forEach(item=>{const selected=item===button;item.classList.toggle('active',selected);item.setAttribute('aria-selected',String(selected))});
}
function genericTabLabel(value){return /^(main( tab)?|grid( tab)?\s*[1-4])$/i.test(String(value||'').trim())}
function roleLabel(role){return{MAIN:'Main Tab',GRID_1:'Grid Tab 1',GRID_2:'Grid Tab 2',GRID_3:'Grid Tab 3'}[role]}
function showReserved(state,button){
 state.selectedRole=button?.dataset.shWorkspaceRole||state.selectedRole;
 hideWorkspaceContent(state);state.loaded=false;state.dashboardHasContent=false;
 state.host.hidden=false;state.host.innerHTML='<div class="ul-empty-state"><div class="ul-empty-icon">▦</div><h3>'+esc(button.textContent)+'</h3><p>This view is reserved. Configure its sections and fields in Workspace Manager.</p></div>';
 markSelected(state,button);
}
function configureTabMode(state,requestedMode){
 let mode=requestedMode==='firstView'?'firstView':'fieldComponents';
 state.group.querySelectorAll(':scope > [data-sh-generated-role]').forEach(button=>button.remove());
 const natives=[...state.group.querySelectorAll(':scope > button')].filter(button=>button!==state.dashboardButton&&!button.dataset.shGeneratedRole);
 for(const button of natives){
  if(!button.dataset.shOriginalLabel)button.dataset.shOriginalLabel=button.textContent.trim();
  button.hidden=false;delete button.dataset.shDashboardSource;delete button.dataset.shExtraNative;delete button.dataset.shWorkspaceRole;
 }
 let available=[...natives],source=null;
 if(mode==='firstView'&&available.length){source=available.shift();source.hidden=true;source.dataset.shDashboardSource='true'}
 if(mode==='firstView'&&!source)mode='fieldComponents';
 const roles=['MAIN','GRID_1','GRID_2','GRID_3'],roleButtons=[];
 roles.forEach((role,index)=>{
  let button=available[index];
  if(!button){
   button=document.createElement('button');button.type='button';button.dataset.shGeneratedRole='true';state.group.appendChild(button);
  }
  button.hidden=false;button.dataset.shWorkspaceRole=role;button.title=genericTabLabel(button.dataset.shOriginalLabel)?'':button.dataset.shOriginalLabel;button.textContent=roleLabel(role);roleButtons.push(button);
 });
 available.slice(4).forEach(button=>{button.hidden=true;button.dataset.shExtraNative='true'});
 state.group.prepend(state.dashboardButton);
 for(const button of roleButtons)state.group.appendChild(button);
 state.dashboardSource=source;state.roleButtons=roleButtons;state.tabMode=mode;
}
async function showAssignedContent(state,role,button){
 if(!state.model)try{state.model=await getModel(state.key)}catch(error){return false}
 const assignment=state.model?.layout?.tabContent?.[role]||{mode:'fields'};if(assignment.mode==='fields'||(role.startsWith('GRID_')&&assignment.mode==='form'))return false;
 hideWorkspaceContent(state);state.host.hidden=false;state.loaded=false;state.dashboardHasContent=false;markSelected(state,button);
 state.host.innerHTML='<div class="ul-loading">Loading '+esc(assignment.templateName)+'...</div>';
 const catalog=window.schoolHubTemplateCatalog;
 state.host.innerHTML=catalog?.renderTab?catalog.renderTab(assignment):'<div class="ul-error"><b>Template renderer is unavailable.</b><span>The assignment is preserved. Reload SchoolHub or restore Sections &amp; Fields in Workspace Manager.</span></div>';
 return true;
}
async function showOperations(state,button){
 const role=button?.dataset.shWorkspaceRole;if(!role)return;
 state.selectedRole=role;restoreWorkspaceContent(state);state.host.hidden=true;markSelected(state,button);
 if(await showAssignedContent(state,role,button))return;
 const managedPane=[...state.section.querySelectorAll('.uw-grid-pane')].find(item=>item.closest('.section')===state.section&&!item.closest('.modal,.record-drawer,.hw-drawer,.uia1-pane'));
 if(managedPane&&window.schoolHubUniversalWorkspaces?.show){
  Promise.resolve(window.schoolHubUniversalWorkspaces.show(state.id,role)).catch(error=>console.error('Workspace tab could not be loaded.',error));
  return;
 }
 if(state.id==='students'&&typeof window.showStudentWorkspaceTab==='function'){
  Promise.resolve(window.showStudentWorkspaceTab(role)).catch(error=>console.error('Student workspace tab could not be loaded.',error));
  return;
 }
 if(button.dataset.shGeneratedRole)return showReserved(state,button);
}
async function showDashboard(state,load=true){
 state.selectedRole='DASHBOARD';restoreWorkspaceContent(state);
 if(state.tabMode==='firstView'&&state.dashboardSource&&!state.dashboardSource.classList.contains('active')){
  state.selectingNativeMain=true;try{state.dashboardSource.click()}finally{state.selectingNativeMain=false}
 }
 if(!state.dashboardButton.isConnected){schedule();return}
 if(state.tabMode==='fieldComponents')hideWorkspaceContent(state);
 markSelected(state,state.dashboardButton);
 state.host.hidden=state.loaded&&!state.dashboardHasContent;
 if(load&&isVisible(state.section))await renderRuntime(state);
}

function ensureWorkspace(section,id,key){
 let state=states.get(id),selectedRole=state?.selectedRole||'DASHBOARD';
 if(state&&state.group.isConnected&&state.host.isConnected&&state.dashboardButton.isConnected){
  reconcileWorkspaceShell(state);
  if(state.selectedRole==='DASHBOARD'){if(state.tabMode==='fieldComponents')hideWorkspaceContent(state);if(isVisible(section)&&!state.loaded)renderRuntime(state)}
  return;
 }
 let group=nativeTabGroup(section);
 if(!group){
  group=document.createElement('div');group.className='tabs no-print sh-grid-tabs sh-workspace-tabs';group.setAttribute('role','tablist');group.setAttribute('aria-label','Workspace views');
  const source=document.createElement('button');source.type='button';source.textContent='Main Tab';group.appendChild(source);
  const identity=section.querySelector(':scope > .workspace-identity');identity?.after(group)||section.prepend(group);
 }else group.classList.add('sh-grid-tabs','sh-workspace-tabs');
 let dashboardButton=group.querySelector(':scope > [data-sh-dashboard-tab]');
 if(!dashboardButton){dashboardButton=document.createElement('button');dashboardButton.type='button';dashboardButton.dataset.shDashboardTab='true';dashboardButton.textContent='Dashboard';dashboardButton.setAttribute('role','tab');group.prepend(dashboardButton)}
 let host=section.querySelector(':scope > .sh-workspace-dashboard');
 if(!host){host=document.createElement('div');host.className='sh-workspace-dashboard';host.hidden=true;contentAnchor(section,group).after(host)}
 state={id,key,section,group,dashboardButton,host,model:null,loaded:false,loading:null,dashboardHasContent:false,rows:new Map(),filters:{},hiddenNodes:[],tabMode:'fieldComponents',dashboardSource:null,roleButtons:[],selectedRole};
 states.set(id,state);configureTabMode(state,'fieldComponents');reconcileWorkspaceShell(state);
 dashboardButton.addEventListener('click',event=>{event.preventDefault();showDashboard(states.get(id))});
 if(!group.dataset.shDashboardBound){group.dataset.shDashboardBound='true';group.addEventListener('click',event=>{const current=states.get(id),button=event.target.closest('button');if(current&&button&&button!==current.dashboardButton&&button!==current.dashboardSource&&!current.selectingNativeMain)showOperations(current,button)},true)}
 if(selectedRole==='DASHBOARD')showDashboard(state,false);else{const selected=state.roleButtons.find(button=>button.dataset.shWorkspaceRole===selectedRole)||state.roleButtons[0];state.selectedRole=selected?.dataset.shWorkspaceRole||'MAIN';restoreWorkspaceContent(state);state.host.hidden=true;if(selected)markSelected(state,selected)}
 if(isVisible(section))renderRuntime(state);
}

/* This module is the legacy Dashboard/tab owner. It must not touch a workspace owned (or not yet decided) by the
   Universal Workspace Runtime: one workspace has exactly one frontend owner. */
const legacyOwned=id=>{const mode=window.schoolHubRuntimeMode?.modeOf(id);return!mode||mode==='legacy'};
function ensureAll(){for(const [id,key] of Object.entries(pageKeys)){const section=document.getElementById(id);if(section&&legacyOwned(id))ensureWorkspace(section,id,key)}}
async function getModel(key){return request('/'+encodeURIComponent(key))}
async function getRows(state,sourceTab){
 if(state.rows.has(sourceTab))return state.rows.get(sourceTab);
 const data=await request('/'+encodeURIComponent(state.key)+'/records/'+encodeURIComponent(sourceTab));
 const rows=data.items||[];state.rows.set(sourceTab,rows);return rows;
}
function sourceRows(state,component,rows){const filtered=core.applyFilters(rows,state.filters[component.sourceTab]||{});return ['metric','chart'].includes(component.type)?filtered:filtered.filter(row=>core.matches(row,component.conditions||[]))}

function numberText(value,component){
 if(value==null)return '—';
 const options=component.format==='currency'?{style:'currency',currency:component.currency||'INR',maximumFractionDigits:0}:{maximumFractionDigits:2};
 return new Intl.NumberFormat(undefined,options).format(value)+(component.format==='percent'?'%':'');
}
const iconSvg=name=>({records:'<path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/>',money:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><circle cx="8" cy="14" r="1"/>',wallet:'<path d="M4 6h15v13H4zM4 9h17v7h-5a3 3 0 010-6h5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',percent:'<path d="M19 5L5 19M7 7h.01M17 17h.01"/>',people:'<path d="M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a4 4 0 100-8 4 4 0 000 8zM22 20v-2a4 4 0 00-3-3.87"/>',warning:'<path d="M12 3L2 21h20L12 3zM12 9v5M12 18h.01"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',table:'<path d="M3 4h18v16H3zM3 9h18M9 4v16"/>',chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'}[name]||'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>');
function metricHtml(component,rows){
 const value=core.aggregate(rows,component),number=numberText(value,component);
 return '<div class="ul-metric-shell"><div class="ul-metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'+iconSvg(component.icon||'chart')+'</svg></div><div><div class="ul-metric-label">'+esc(component.title)+'</div><div class="ul-metric-value">'+esc(number)+'</div><div class="ul-caption">'+esc(component.description||((component.aggregation||'count')+(component.valueField?' · '+label({fields:[]},component.valueField):' · records')))+'</div></div></div>';
}
function chartValues(component,rows){
 const groups=new Map();
 for(const row of rows){const name=format(row.values[component.groupField]);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(row)}
 return [...groups].map(([name,items])=>({name,value:Number(core.aggregate(items,component)||0)})).sort((a,b)=>component.visualization==='line'||component.visualization==='area'?String(a.name).localeCompare(String(b.name)):b.value-a.value).slice(0,component.limit||12);
}
function chartLegend(values,total,showPercentages){
 return '<div class="ul-chart-legend">'+values.map((item,index)=>'<div><i style="--legend:'+index+'"></i><span>'+esc(item.name)+'</span><b>'+esc(new Intl.NumberFormat().format(item.value))+(showPercentages&&total?' <small>'+Math.round(item.value/total*1000)/10+'%</small>':'')+'</b></div>').join('')+'</div>';
}
function chartHtml(component,rows,model){
 const values=chartValues(component,rows),type=component.visualization||'bar',max=Math.max(1,...values.map(item=>Math.abs(item.value))),total=values.reduce((sum,item)=>sum+Math.max(0,item.value),0);
 if(!values.length)return '<div class="ul-empty">No records are available for this chart.</div>';
 if(type==='pie'||type==='donut'){
  let cursor=0;const stops=values.map((item,index)=>{const start=cursor;cursor+=total?item.value/total*100:0;return 'var(--ul-c'+(index%8)+') '+start+'% '+cursor+'%'}).join(',');
  return '<div class="ul-pie-layout"><div class="ul-pie '+(type==='donut'?'donut':'')+'" style="background:conic-gradient('+stops+')">'+(type==='donut'?'<div><b>'+esc(new Intl.NumberFormat().format(total))+'</b><span>Records</span></div>':'')+'</div>'+(component.showLegend===false?'':chartLegend(values,total,component.showPercentages))+'</div>';
 }
 if(type==='line'||type==='area'){
  const w=720,h=210,p=28,points=values.map((item,index)=>{const x=values.length===1?w/2:p+index*(w-p*2)/(values.length-1),y=h-p-(item.value/max)*(h-p*2);return{x,y,item}}),line=points.map(point=>point.x.toFixed(1)+','+point.y.toFixed(1)).join(' '),area=p+','+(h-p)+' '+line+' '+(w-p)+','+(h-p);
  return '<div class="ul-line-wrap"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(component.title)+'">'+(type==='area'?'<polygon points="'+area+'" class="ul-area-fill"/>':'')+'<polyline points="'+line+'" class="ul-line-stroke"/>'+points.map(point=>'<circle cx="'+point.x+'" cy="'+point.y+'" r="4"><title>'+esc(point.item.name+': '+point.item.value)+'</title></circle>').join('')+'</svg><div class="ul-line-labels">'+values.map(item=>'<span>'+esc(item.name)+'</span>').join('')+'</div></div>';
 }
 return '<div class="ul-chart" aria-label="'+esc(component.title)+'">'+values.map((item,index)=>'<div class="ul-chart-row"><span title="'+esc(item.name)+'">'+esc(item.name)+'</span><div><i style="width:'+Math.max(2,Math.round(Math.abs(item.value)/max*100))+'%;--bar-index:'+index+'"></i></div><b>'+esc(new Intl.NumberFormat().format(item.value))+(component.showPercentages&&total?' <small>'+Math.round(item.value/total*100)+'%</small>':'')+'</b></div>').join('')+'</div>'+(component.showLegend?'<div class="ul-caption">Grouped by '+esc(label(model,component.groupField))+'</div>':'');
}
function filterControl(component,key,rows,model,state){
 const current=state.filters[component.sourceTab]?.[key]||'',meta=field(model,key),values=[...new Set(rows.map(row=>row.values[key]).filter(value=>value!==null&&value!==undefined&&value!==''))].sort((a,b)=>String(a).localeCompare(String(b))).slice(0,200);
 if(meta&&(['date','dateTime'].includes(meta.fieldType)))return '<label><span>'+esc(meta.label)+'</span><input type="date" data-ul-filter-tab="'+esc(component.sourceTab)+'" data-ul-filter-field="'+esc(key)+'" value="'+esc(current)+'"></label>';
 if(values.length&&values.length<=60)return '<label><span>'+esc(label(model,key))+'</span><select data-ul-filter-tab="'+esc(component.sourceTab)+'" data-ul-filter-field="'+esc(key)+'"><option value="">All '+esc(label(model,key))+'</option>'+values.map(value=>option(String(value),String(value),String(current))).join('')+'</select></label>';
 return '<label><span>'+esc(label(model,key))+'</span><input data-ul-filter-tab="'+esc(component.sourceTab)+'" data-ul-filter-field="'+esc(key)+'" value="'+esc(current)+'" placeholder="All"></label>';
}
function filtersHtml(component,rows,model,state){return component.fields.map(key=>filterControl(component,key,rows,model,state)).join('')}
function tableHtml(component,rows,model){
 if(!rows.length)return '<div class="ul-empty">No records match the current dashboard filters.</div>';
 const limit=component.limit||10;
 return '<div class="ul-table-wrap"><table><thead><tr>'+component.fields.map(key=>'<th>'+esc(label(model,key))+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(0,limit).map(row=>'<tr>'+component.fields.map(key=>'<td>'+esc(format(row.values[key]))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="ul-caption">Showing '+Math.min(limit,rows.length)+' of '+rows.length+' authorized records.</div>';
}
function cardsHtml(component,rows,model){
 if(!rows.length)return '<div class="ul-empty">No records match the current dashboard filters.</div>';
 const detailFields=component.fields.filter(key=>key!==component.titleField),limit=component.limit||24;
 return '<div class="ul-record-cards">'+rows.slice(0,limit).map(row=>'<article>'+(component.imageField&&row.values[component.imageField]?'<img src="'+esc(row.values[component.imageField])+'" alt="">':'')+'<h4>'+esc(format(row.values[component.titleField]))+'</h4>'+detailFields.map(key=>'<p><span>'+esc(label(model,key))+'</span><b>'+esc(format(row.values[key]))+'</b></p>').join('')+'</article>').join('')+'</div>';
}
function calendarHtml(component,rows){
 const dated=rows.map(row=>({row,date:String(row.values[component.startField]||'').slice(0,10)})).filter(item=>item.date).sort((a,b)=>a.date.localeCompare(b.date));
 if(!dated.length)return '<div class="ul-empty">No dated records are available.</div>';
 return '<div class="ul-agenda">'+dated.slice(0,component.limit||40).map(item=>'<div><time>'+esc(item.date)+'</time><span><b>'+esc(format(item.row.values[component.titleField]))+'</b>'+(component.endField&&item.row.values[component.endField]?'<small>Ends '+esc(String(item.row.values[component.endField]).slice(0,10))+'</small>':'')+'</span></div>').join('')+'</div>';
}
function scheduleHtml(component,rows){
 const groups=new Map();for(const row of rows){const group=format(row.values[component.groupField]);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row)}
 if(!groups.size)return '<div class="ul-empty">No schedule records are available.</div>';
 return '<div class="ul-schedule">'+[...groups].slice(0,20).map(([group,items])=>'<section><h4>'+esc(group)+'</h4>'+items.slice(0,20).map(row=>'<div><time>'+esc(format(row.values[component.slotField]))+'</time><span>'+esc(format(row.values[component.titleField]))+'</span></div>').join('')+'</section>').join('')+'</div>';
}
function componentBody(component,rows,model,state){
 if(component.type==='metric')return metricHtml(component,rows);
 if(component.type==='chart')return chartHtml(component,rows,model);
 if(component.type==='table')return tableHtml(component,rows,model);
 if(component.type==='calendar')return calendarHtml(component,rows);
 if(component.type==='schedule')return scheduleHtml(component,rows);
 return cardsHtml(component,rows,model);
}
async function renderComponents(host,model,layout,state){
 if(!layout.enabled||!layout.components.some(component=>component.visible)){host.innerHTML='<div class="ul-empty-state"><div class="ul-empty-icon">▦</div><h3>Dashboard has not been configured</h3><p>Add components from Workspace Manager → Layout. No dashboard information is generated until an administrator saves a component.</p></div>';return}
 const components=layout.components.filter(component=>component.visible),sources=[...new Set(components.map(component=>component.sourceTab))],results=await Promise.all(sources.map(async source=>[source,await getRows(state,source)])),rowsBySource=new Map(results),filters=components.filter(component=>component.type==='filters'),visuals=components.filter(component=>component.type!=='filters');
 const filterHtml=filters.length?'<div class="ul-dashboard-filterbar">'+filters.map(component=>filtersHtml(component,rowsBySource.get(component.sourceTab)||[],model,state)).join('')+'<button type="button" class="btn small" data-ul-clear-filters>Clear filters</button></div>':'';
 host.innerHTML=filterHtml+'<div class="ul-dashboard-grid '+(layout.density==='compact'?'compact':'')+'">'+visuals.map(component=>{const rows=sourceRows(state,component,rowsBySource.get(component.sourceTab)||[]);return '<article class="ul-component '+widthClass(component.width)+' ul-palette-'+esc(component.palette||'blue')+' ul-type-'+esc(component.type)+'" data-ul-component="'+esc(component.id)+'"><header><div><span>'+esc(typeLabels[component.type])+'</span><h3>'+esc(component.title)+'</h3></div><small>'+esc(model.tabs?.[component.sourceTab]||component.sourceTab)+'</small></header><div class="ul-component-body">'+componentBody(component,rows,model,state)+'</div></article>'}).join('')+'</div>';
 host.querySelectorAll('[data-ul-filter-field]').forEach(control=>control.addEventListener('change',event=>{const element=event.currentTarget,tab=element.dataset.ulFilterTab;state.filters[tab]=state.filters[tab]||{};state.filters[tab][element.dataset.ulFilterField]=element.value;renderComponents(host,model,layout,state)}));
 host.querySelectorAll('input[data-ul-filter-field]').forEach(control=>control.addEventListener('input',event=>{if(event.currentTarget.type==='date')return;const element=event.currentTarget,tab=element.dataset.ulFilterTab,fieldKey=element.dataset.ulFilterField,value=element.value;clearTimeout(state.filterTimer);state.filterTimer=setTimeout(()=>{state.filters[tab]=state.filters[tab]||{};state.filters[tab][fieldKey]=value;renderComponents(host,model,layout,state)},250)}));
 host.querySelector('[data-ul-clear-filters]')?.addEventListener('click',()=>{state.filters={};renderComponents(host,model,layout,state)});
}
async function renderRuntime(state){
 if(state.loading)return state.loading;
 state.loading=(async()=>{
  state.host.innerHTML='<div class="ul-loading">Loading dashboard…</div>';
  try{
   state.model=await getModel(state.key);
   configureTabMode(state,'fieldComponents');reconcileWorkspaceShell(state);
   if(!state.dashboardButton.isConnected){schedule();return}
   if(state.selectedRole!=='DASHBOARD'){
    const selected=state.roleButtons.find(button=>button.dataset.shWorkspaceRole===state.selectedRole)||state.roleButtons[0];
    if(selected){state.selectedRole=selected.dataset.shWorkspaceRole;if(await showAssignedContent(state,state.selectedRole,selected))return;markSelected(state,selected)}
    restoreWorkspaceContent(state);state.host.hidden=true;state.loaded=false;return;
   }
   if(state.tabMode==='firstView'&&state.dashboardSource&&!state.dashboardSource.classList.contains('active')){state.selectingNativeMain=true;try{state.dashboardSource.click()}finally{state.selectingNativeMain=false}}
   if(!state.dashboardButton.isConnected){schedule();return}
   if(state.tabMode==='fieldComponents')hideWorkspaceContent(state);else restoreWorkspaceContent(state);
   markSelected(state,state.dashboardButton);
   const effectiveLayout=state.model.layout;
   state.host.hidden=false;state.dashboardHasContent=true;
   state.host.innerHTML='<div class="ul-dashboard-head"><div><span>WORKSPACE DASHBOARD</span><h2>'+esc(state.model.name)+'</h2><p>Configured in Workspace Manager from authorized workspace fields.</p></div>'+(state.model.canManage?'<button type="button" class="btn" data-ul-open-manager>Configure in Workspace Manager</button>':'')+'</div><div class="ul-runtime"></div>';
   state.host.querySelector('[data-ul-open-manager]')?.addEventListener('click',()=>window.schoolHubWorkspaceDashboard.openManager(state.model.workspaceId));
   await renderComponents(state.host.querySelector('.ul-runtime'),state.model,effectiveLayout,state);
   state.loaded=true;
  }catch(error){state.host.innerHTML='<div class="ul-error"><b>Dashboard could not be loaded.</b><span>'+esc(error.message||error)+'</span></div>'}
 })();
 try{return await state.loading}finally{state.loading=null}
}
function openManager(workspaceId){
 const api=window.schoolHubWM2;
 if(api?.openWorkspace){api.openWorkspace(workspaceId).then?.(()=>api.setTab?.('layout'));return}
 alert('Open Administration → Workspace Manager → Layout to configure this dashboard.');
}


function mappingFields(component,model){
 const numeric=item=>['integer','decimal','currency'].includes(item.fieldType),date=item=>['date','dateTime'].includes(item.fieldType),image=item=>item.fieldType==='image';
 let html='';
 if(['metric','chart'].includes(component.type))html+='<label class="field"><span>Measure</span><select data-edit="aggregation">'+['count','distinct','sum','average','min','max','ratio'].map(value=>option(value,value[0].toUpperCase()+value.slice(1),component.aggregation||'count')).join('')+'</select></label>';
 if((component.type==='metric'||component.type==='chart')&&(component.aggregation||'count')!=='count')html+='<label class="field"><span>'+(component.aggregation==='ratio'?'Numerator field':'Measure field')+'</span><select data-edit="valueField">'+fieldOptions(model,component.sourceTab,component.valueField,['sum','average','min','max','ratio'].includes(component.aggregation)?numeric:null)+'</select></label>';if(component.aggregation==='ratio')html+='<label class="field"><span>Denominator field</span><select data-edit="secondaryValueField">'+fieldOptions(model,component.sourceTab,component.secondaryValueField,numeric)+'</select></label>';
 if(component.type==='metric')html+='<label class="field"><span>Icon</span><select data-edit="icon">'+['records','money','wallet','clock','percent','people','warning','calendar','table','chart'].map(value=>option(value,value[0].toUpperCase()+value.slice(1),component.icon||'chart')).join('')+'</select></label><label class="field"><span>Number format</span><select data-edit="format">'+option('number','Number',component.format||'number')+option('currency','Currency',component.format||'number')+option('percent','Percentage',component.format||'number')+'</select></label>';
 if(component.type==='chart')html+='<label class="field"><span>Visualization</span><select data-edit="visualization">'+[['bar','Bar'],['horizontalBar','Horizontal bar'],['stackedBar','Stacked bar'],['line','Line'],['area','Area'],['pie','Pie'],['donut','Donut']].map(x=>option(x[0],x[1],component.visualization||'bar')).join('')+'</select></label><label class="field"><span>Group by</span><select data-edit="groupField">'+fieldOptions(model,component.sourceTab,component.groupField)+'</select></label><label class="field"><span>Legend</span><select data-edit="showLegend">'+option('true','Show',String(component.showLegend!==false))+option('false','Hide',String(component.showLegend!==false))+'</select></label><label class="field"><span>Percentages</span><select data-edit="showPercentages">'+option('true','Show',String(component.showPercentages===true))+option('false','Hide',String(component.showPercentages===true))+'</select></label>';
 if(['filters','table','cards'].includes(component.type))html+='<label class="field span2"><span>'+(component.type==='filters'?'Filter fields':'Displayed fields')+'</span><select multiple size="7" data-edit="fields">'+multiOptions(model,component.sourceTab,component.fields)+'</select><small>Only fields belonging to the selected source tab are available.</small></label>';
 if(['calendar','schedule','cards'].includes(component.type))html+='<label class="field"><span>Title field</span><select data-edit="titleField">'+fieldOptions(model,component.sourceTab,component.titleField)+'</select></label>';
 if(component.type==='calendar')html+='<label class="field"><span>Start date</span><select data-edit="startField">'+fieldOptions(model,component.sourceTab,component.startField,date)+'</select></label><label class="field"><span>End date</span><select data-edit="endField">'+fieldOptions(model,component.sourceTab,component.endField,date)+'</select></label>';
 if(component.type==='schedule')html+='<label class="field"><span>Group field</span><select data-edit="groupField">'+fieldOptions(model,component.sourceTab,component.groupField)+'</select></label><label class="field"><span>Time / slot field</span><select data-edit="slotField">'+fieldOptions(model,component.sourceTab,component.slotField)+'</select></label>';
 if(component.type==='cards')html+='<label class="field"><span>Image field</span><select data-edit="imageField">'+fieldOptions(model,component.sourceTab,component.imageField,image)+'</select></label>';
 if(['table','cards','calendar'].includes(component.type))html+='<label class="field"><span>Maximum records</span><input type="number" min="1" max="100" data-edit-number="limit" value="'+esc(component.limit||10)+'"></label>';
 return html;
}
function conditionsEditor(component,model){
 const rows=(component.conditions||[]).map((condition,index)=>'<div class="ul-condition-row"><select data-condition-index="'+index+'" data-condition-key="field">'+fieldOptions(model,component.sourceTab,condition.field)+'</select><select data-condition-index="'+index+'" data-condition-key="operator">'+[['eq','Equals'],['ne','Does not equal'],['contains','Contains'],['notEmpty','Is not empty']].map(x=>option(x[0],x[1],condition.operator)).join('')+'</select><input data-condition-index="'+index+'" data-condition-key="value" value="'+esc(condition.value||'')+'" '+(condition.operator==='notEmpty'?'disabled':'')+' placeholder="Value"><button type="button" class="btn small danger" data-remove-condition="'+index+'">Remove</button></div>').join('');
 return '<div class="field span2 ul-conditions"><span>Rules</span>'+(rows||'<small>No rule. This component uses all records allowed by the Dashboard filters.</small>')+'<button type="button" class="btn small" data-add-condition>+ Add rule</button></div>';
}
function roleOptions(model,selected=[]){return (model.roles||[]).map(role=>'<option value="'+esc(role)+'" '+(selected.includes(role)?'selected':'')+'>'+esc(role)+'</option>').join('')}
function componentDefaults(type){
 const common={id:'component_'+Date.now().toString(36),type,title:typeLabels[type],sourceTab:'MAIN',fields:[],visible:true,width:type==='metric'?'quarter':type==='filters'?'full':'half',palette:'blue'};
 if(['metric','chart'].includes(type))common.aggregation='count';
 if(type==='metric'){common.icon='chart';common.format='number'}
 if(type==='chart'){common.visualization='bar';common.showLegend=true;common.showPercentages=false}
 return common;
}
function renderEditor(host){
 const state=editors.get(host),model=state.model,layout=state.layout;layout.dashboardSource='fieldComponents';
 const selected=layout.components.find(component=>component.id===state.selectedId)||layout.components[0];state.selectedId=selected?.id||null;
 const list=layout.components.map((component,index)=>'<button draggable="true" type="button" class="'+(component.id===state.selectedId?'selected':'')+'" data-select-component="'+esc(component.id)+'" data-component-index="'+index+'"><span class="ul-list-icon ul-palette-'+esc(component.palette||'blue')+'">'+esc(index+1)+'</span><span class="ul-list-copy"><b>'+esc(component.title)+'</b><small>'+esc(typeLabels[component.type])+' · '+esc(model.tabs?.[component.sourceTab]||component.sourceTab)+'</small></span><span class="ul-drag">⋮⋮</span></button>').join('');
 const properties=selected?'<div class="ul-property-head"><div><span>SELECTED COMPONENT</span><h3>'+esc(selected.title)+'</h3><small>'+esc(typeLabels[selected.type])+'</small></div><button class="btn small danger" data-remove>Delete</button></div><div class="form-grid ul-property-grid"><label class="field span2"><span>Component title</span><input data-edit="title" value="'+esc(selected.title)+'"></label><label class="field span2"><span>Supporting text</span><input data-edit="description" value="'+esc(selected.description||'')+'" placeholder="Explain what this component shows"></label><label class="field"><span>Source tab</span><select data-edit="sourceTab">'+tabKeys.map(key=>option(key,model.tabs?.[key]||roleLabel(key),selected.sourceTab)).join('')+'</select></label><label class="field"><span>Width</span><select data-edit="width">'+option('quarter','Quarter',selected.width)+option('third','One third',selected.width)+option('half','Half',selected.width)+option('full','Full',selected.width)+'</select></label><label class="field"><span>Colour palette</span><select data-edit="palette">'+['blue','green','orange','purple','red','paymentStatus','school'].map(value=>option(value,value[0].toUpperCase()+value.slice(1),selected.palette||'blue')).join('')+'</select></label><label class="field"><span>Visibility</span><select data-edit="visible">'+option('true','Visible',String(selected.visible))+option('false','Hidden',String(selected.visible))+'</select></label>'+mappingFields(selected,model)+conditionsEditor(selected,model)+(model.roles?.length?'<label class="field span2"><span>Visible to roles</span><select multiple size="5" data-edit="roleNames">'+roleOptions(model,selected.roleNames||[])+'</select><small>Leave empty to use the workspace permissions for every authorized role.</small></label>':'')+'</div><div class="ul-property-actions"><button class="btn small" data-move="-1">Move up</button><button class="btn small" data-move="1">Move down</button></div>':'<div class="ul-editor-empty large"><div class="ul-empty-icon">▦</div><h3>No dashboard components</h3><p>Add a component from the left. The live workspace Dashboard stays empty until you save.</p></div>';
 host.innerHTML='<div class="ul-editor"><div class="ul-editor-toolbar"><div class="ul-toolbar-source"><span>Dashboard source</span><b>Configured components</b><em>'+layout.components.length+' component'+(layout.components.length===1?'':'s')+'</em></div><label>Density <select data-layout-density>'+option('comfortable','Comfortable',layout.density)+option('compact','Compact',layout.density)+'</select></label><label>Preview as role <select data-preview-role>'+option('','Current: '+(model.currentRole||'Administrator'),state.previewRole||'')+(model.roles||[]).map(role=>option(role,role,state.previewRole||'')).join('')+'</select></label><button type="button" class="btn primary" data-save-layout>Save dashboard</button></div><div class="ul-builder"><aside class="ul-builder-list"><div><h3>Dashboard components</h3><p>Order controls the dashboard. Drag or use Move up/down.</p></div><div class="ul-component-list">'+(list||'<div class="ul-editor-empty">No components yet.</div>')+'</div><div class="ul-add-row"><select data-new-type>'+Object.entries(typeLabels).map(([value,text])=>option(value,text,'')).join('')+'</select><button type="button" class="btn primary" data-add-component>+ Add component</button></div></aside><main class="ul-builder-canvas"><div class="ul-preview-head"><div><span>LIVE WORKSPACE PREVIEW</span><h3>'+esc(model.name)+' dashboard</h3></div><small>Authorized records · '+esc(state.previewRole||model.currentRole||'current role')+'</small></div><div class="ul-admin-preview"></div></main><aside class="ul-builder-properties">'+properties+'</aside></div></div>';
 host.querySelector('[data-layout-density]').onchange=event=>{layout.density=event.target.value;previewEditor(host)};
 host.querySelector('[data-preview-role]').onchange=event=>{state.previewRole=event.target.value;previewEditor(host)};
 host.querySelector('[data-add-component]').onclick=()=>{const component=componentDefaults(host.querySelector('[data-new-type]').value);layout.components.push(component);state.selectedId=component.id;renderEditor(host)};
 host.querySelector('[data-save-layout]').onclick=()=>saveEditor(host);
 host.querySelectorAll('[data-select-component]').forEach(button=>{button.onclick=()=>{state.selectedId=button.dataset.selectComponent;renderEditor(host)};button.ondragstart=event=>event.dataTransfer.setData('text/plain',button.dataset.componentIndex);button.ondragover=event=>event.preventDefault();button.ondrop=event=>{event.preventDefault();const from=Number(event.dataTransfer.getData('text/plain')),to=Number(button.dataset.componentIndex);if(Number.isInteger(from)&&from!==to){const item=layout.components.splice(from,1)[0];layout.components.splice(to,0,item);renderEditor(host)}}});
 if(selected){
  host.querySelectorAll('[data-edit]').forEach(control=>control.onchange=()=>{const key=control.dataset.edit;if(control.multiple)selected[key]=[...control.selectedOptions].map(option=>option.value);else if(['visible','showLegend','showPercentages'].includes(key))selected[key]=control.value==='true';else selected[key]=control.value;if(key==='sourceTab'){selected.fields=[];for(const property of ['valueField','secondaryValueField','titleField','startField','endField','groupField','slotField','imageField'])delete selected[property]}renderEditor(host)});
  host.querySelectorAll('[data-edit-number]').forEach(control=>control.onchange=()=>{selected[control.dataset.editNumber]=Math.max(1,Math.min(100,Number(control.value)||10));renderEditor(host)});
  host.querySelector('[data-add-condition]').onclick=()=>{const first=model.fields.find(item=>item.tabKey===selected.sourceTab);if(!first)return;selected.conditions=selected.conditions||[];selected.conditions.push({field:first.fieldKey,operator:'eq',value:''});renderEditor(host)};
  host.querySelectorAll('[data-condition-index]').forEach(control=>control.onchange=()=>{const rule=selected.conditions?.[Number(control.dataset.conditionIndex)];if(!rule)return;rule[control.dataset.conditionKey]=control.value;if(control.dataset.conditionKey==='operator'&&control.value==='notEmpty')rule.value='';renderEditor(host)});
  host.querySelectorAll('[data-remove-condition]').forEach(button=>button.onclick=()=>{selected.conditions.splice(Number(button.dataset.removeCondition),1);renderEditor(host)});
  host.querySelector('[data-remove]').onclick=()=>{layout.components=layout.components.filter(component=>component.id!==selected.id);state.selectedId=layout.components[0]?.id||null;renderEditor(host)};
  host.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{const index=layout.components.indexOf(selected),next=index+Number(button.dataset.move);if(next<0||next>=layout.components.length)return;layout.components.splice(index,1);layout.components.splice(next,0,selected);renderEditor(host)});
 }
 previewEditor(host);
}
async function previewEditor(host){
 const state=editors.get(host),preview=host.querySelector('.ul-admin-preview');if(!preview)return;
 try{
  const layout=clone(state.layout);
  if(state.previewRole)layout.components=layout.components.filter(component=>!component.roleNames?.length||component.roleNames.includes(state.previewRole));
  await renderComponents(preview,state.model,layout,state);
 }catch(error){preview.innerHTML='<div class="ul-error">'+esc(error.message||error)+'</div>'}
}
async function saveEditor(host){
 const state=editors.get(host),button=host.querySelector('[data-save-layout]');button.disabled=true;button.textContent='Saving…';
 try{const result=await request('/'+encodeURIComponent(state.model.workspaceKey),{method:'PUT',body:{version:state.model.workspaceVersion,layout:state.layout},mutation:true});state.model.workspaceVersion=result.workspaceVersion;state.layout=clone(result.layout);window.showToast?.('Workspace dashboard saved.');for(const runtimeState of states.values())if(runtimeState.key===state.model.workspaceKey){runtimeState.loaded=false;runtimeState.rows.clear();if(runtimeState.dashboardButton.classList.contains('active'))renderRuntime(runtimeState)}renderEditor(host)}
 catch(error){alert(error.message||error);button.disabled=false;button.textContent='Save dashboard'}
}
async function mountAdminEditor(host,workspaceKey){
 if(!host)return;host.innerHTML='<div class="ul-loading">Loading dashboard editor…</div>';
 try{const model=await getModel(workspaceKey),state={model,layout:clone(model.layout),selectedId:model.layout.components[0]?.id||null,rows:new Map(),filters:{},key:workspaceKey};editors.set(host,state);renderEditor(host)}
 catch(error){host.innerHTML='<div class="ul-error"><b>Dashboard editor could not be loaded.</b><span>'+esc(error.message||error)+'</span></div>'}
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;ensureAll()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureAll);else ensureAll();
function refresh(){for(const state of states.values()){state.loaded=false;state.model=null;state.rows.clear()}ensureAll();for(const state of states.values())if(isVisible(state.section))renderRuntime(state)}
/* Shared dashboard renderer for the Universal Workspace Runtime: renders the configured dashboard into a host
   element it does not own the surrounding shell of. Data still comes through the permission-checked endpoints. */
async function mountDashboard(host,workspaceKey){
 if(!host)return;const state={key:workspaceKey,rows:new Map(),filters:{},host};
 host.innerHTML='<div class="ul-loading">Loading dashboard…</div>';
 try{
  const model=await getModel(workspaceKey);state.model=model;
  host.innerHTML='<div class="ul-dashboard-head"><div><span>WORKSPACE DASHBOARD</span><h2>'+esc(model.name)+'</h2><p>Configured in Workspace Manager from authorized workspace fields.</p></div>'+(model.canManage?'<button type="button" class="btn" data-ul-open-manager>Configure in Workspace Manager</button>':'')+'</div><div class="ul-runtime"></div>';
  host.querySelector('[data-ul-open-manager]')?.addEventListener('click',()=>openManager(model.workspaceId));
  await renderComponents(host.querySelector('.ul-runtime'),model,model.layout,state);
 }catch(error){host.innerHTML='<div class="ul-error"><b>Dashboard could not be loaded.</b><span>'+esc(error.message||error)+'</span></div>'}
}
window.schoolHubRuntimeMode?.onChange(schedule);
window.schoolHubWorkspaceDashboard=Object.freeze({mountAdminEditor,openManager,refresh,mountDashboard});
})();
