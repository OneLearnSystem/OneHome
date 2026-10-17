import {esc,link} from './shared.mjs';
export const uiIcon=(id)=>`<img class="ui-icon" src="ui-${id}.svg" alt="">`;
export function brand(product='OneHome'){return `<span class="ui-brand"><span class="brand-symbol brand-${product.toLowerCase()}" aria-hidden="true"></span><span>One<b>${product.slice(3)}</b></span></span>`}
export function shell({product,student,admin=false,person,school,view,nav,content,demoBar='',rail='side',settings='comfort'}){
 const button=([id,label])=>`<button data-view="${id}" class="ui-nav-link ${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${label}</button>`;
 const main=nav.slice(0,5),extra=nav.slice(5);
 return demoBar+`<div class="ui-app"><header class="ui-header"><a class="ui-brand-link" href="${esc(link(product))}" aria-label="${product} home">${brand(product)}</a><button class="ui-mobile quiet" id="menu" aria-label="Open navigation">${uiIcon('menu')}</button><nav class="ui-nav" id="${rail}" aria-label="Main navigation">${main.map(button).join('')}${extra.length?'<details class="ui-more"><summary>More</summary><div>'+extra.map(button).join('')+'</div></details>':''}</nav><div class="ui-header-actions">${product!=='OneHome'?`<a class="ui-back" href="${esc(link('OneHome'))}">${uiIcon('home')}<span>Back to OneHome</span></a>`:''}<details class="ui-account"><summary><span class="ui-avatar">${esc((person||'Account').slice(0,2).toUpperCase())}</span><span class="ui-person">${esc(person)}</span></summary><div><b>${esc(school)}</b><small>${student?'Student':admin?'School administrator':'Teacher'}</small><button class="quiet" data-view="${settings}">Accessibility & settings</button><button class="quiet" id="refresh">Refresh</button><button class="quiet" id="logout">Sign out</button></div></details></div></header><main class="ui-content" id="main">${content}</main><footer class="ui-footer">${product} · Part of OneLearn<span>${esc(school)}</span></footer></div>`;
}
export function appCards(){return `<div class="ui-app-cards">${[['OneReader','Read books and answer questions.'],['OneMaths','Maths homework and independent practice.'],['OneStudy','History, Geography, French and German.']].map(([p,c])=>`<a class="ui-app-card" href="${esc(link(p))}"><span class="brand-symbol brand-${p.toLowerCase()}" aria-hidden="true"></span><h2>${p}</h2><p>${c}</p><span class="ui-text-link">Open website ${uiIcon('arrow')}</span></a>`).join('')}</div>`}
export const shopItems=all=>all.filter(r=>r.category==='theme'||r.category==='decoration'&&!['reward-18','reward-19','reward-29'].includes(r.id));
export function shopGrid(all,w,mode='legacy'){
 return `<div class="ui-reward-grid">${shopItems(all).map(r=>{const own=w?.owned?.includes(r.id),on=w?.equipped?.[r.category]===r.id;return `<article class="card ui-reward"><div class="ui-reward-preview" style="background:${esc(r.gradient||r.colour||'#edf4ff')}">${uiIcon(r.category==='theme'?'theme':'award')}<span>${r.category==='theme'?'Workspace theme':'Profile collection'}</span></div><h3>${esc(r.name)}</h3><p>${r.cost} ${r.service==='reader'?'Star':'Power'} Points</p><small>${r.category==='theme'?'A subtle background across your learning apps.':'A collectible badge displayed on your profile.'}</small><button class="secondary space" ${on?'disabled':''} ${mode==='study'?`data-reward="${r.id}" data-owned="${!!own}"`:`data-${own?'equip':'buy'}="${r.id}"`}>${on?'In use':own?'Use reward':'Buy reward'}</button></article>`}).join('')}</div>`;
}
export function applyUITheme(w,all){
 document.querySelector('#os-shared-corner')?.remove();
 const theme=all.find(r=>r.id===w?.equipped?.theme&&r.category==='theme');
 document.body.style.background='';document.body.style.backgroundColor='';
 document.body.style.setProperty('--ui-tint',theme?.colour||'#f9fbff');
 document.body.removeAttribute('data-universal-theme');
 const badge=shopItems(all).find(r=>r.id===w?.equipped?.decoration);
 document.querySelector('.ui-profile-badge')?.remove();
 if(badge){const el=document.createElement('span');el.className='ui-profile-badge';el.textContent=badge.name;document.querySelector('.ui-account>div')?.prepend(el)}
}
export function cleanUI(){
 imageify();
 document.querySelectorAll('[data-view="wardrobe"],[data-view="buddy"],[data-view="advent"],[data-care],#quickJoke,#tellJoke,#m9Joke,#readerJoke,#sneakyHint,#petHelp').forEach(e=>e.remove());
 document.querySelectorAll('form#settingsForm input[name="buddy"],form#settingsForm input[name="advent"]').forEach(e=>{e.checked=false;e.closest('.row')?.setAttribute('hidden','')});
}


function imageify(){
 const kinds={'☆':'award','★':'award','→':'arrow','←':'arrow','☰':'menu','⚙':'settings','⌂':'home','✓':'award'};
 document.querySelectorAll('button,summary').forEach(el=>{
  const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];while(walk.nextNode())if(/[☆★→←☰⚙⌂✓]/.test(walk.currentNode.textContent))nodes.push(walk.currentNode);
  for(const n of nodes){const frag=document.createDocumentFragment();for(const part of n.textContent.split(/([☆★→←☰⚙⌂✓])/)){if(kinds[part]){const img=document.createElement('img');img.src='ui-'+kinds[part]+'.svg';img.alt='';img.className='ui-inline-icon';frag.append(img)}else frag.append(document.createTextNode(part))}n.replaceWith(frag)}
 });
}
