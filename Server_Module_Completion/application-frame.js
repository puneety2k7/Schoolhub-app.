/* Reparent existing shell controls without duplicating settings or event handlers. */
(()=>{
'use strict';
const app=document.getElementById('app'),content=app?.querySelector(':scope > .content'),bar=content?.querySelector(':scope > .topbar');
if(!app||!content||!bar||document.getElementById('applicationFooter'))return;
const heading=bar.querySelector('.title-block');if(heading){heading.classList.add('frame-workspace-heading');content.prepend(heading)}
const left=bar.querySelector('.topbar-left'),menu=left.querySelector('.hamburger-btn');
menu.setAttribute('aria-label','Toggle navigation');menu.onclick=()=>matchMedia('(max-width:700px)').matches?toggleMobileDrawer():toggleSidebarCollapse();
const logo=document.getElementById('brandLogo'),wrap=document.createElement('div');wrap.className='frame-logo';wrap.setAttribute('aria-label','School logo');wrap.innerHTML='<svg role="img" aria-label="School" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 9 9-6 9 6M5 8v13h14V8M9 21v-6h6v6M9 10h1m4 0h1M2 21h20"/></svg>';if(logo)wrap.append(logo);left.append(wrap);
const space=document.createElement('span');space.className='frame-brand-space';space.setAttribute('aria-hidden','true');left.append(space);
const search=document.getElementById('globalSearch'),searchBox=document.createElement('div');searchBox.className='frame-search';searchBox.append(search);search.setAttribute('aria-label','Global search');bar.insertBefore(searchBox,bar.querySelector('.top-actions'));app.prepend(bar);
const footer=document.createElement('footer');footer.id='applicationFooter';footer.className='no-print';footer.textContent='© School Management System';app.append(footer);
const sync=()=>document.body.classList.toggle('application-framed',app.style.display!=='none'&&!app.hidden);
new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['style','hidden']});sync();
if(logo){const update=()=>wrap.classList.toggle('has-logo',!!logo.getAttribute('src')&&logo.complete&&logo.naturalWidth>0&&logo.style.display!=='none');logo.addEventListener('load',update);logo.addEventListener('error',()=>wrap.classList.remove('has-logo'));new MutationObserver(update).observe(logo,{attributes:true,attributeFilter:['src','style']});update()}
})();

