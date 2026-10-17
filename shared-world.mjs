import {esc,link} from './shared.mjs?v=11.1';
export const companionEmoji={guinea:'🐹',pigeon:'🐦',hedgehog:'🦔',rabbit:'🐇',duck:'🦆',turtle:'🐢',otter:'🦦',chick:'🐥'};
const animalArt=r=>['guinea','pigeon'].includes(r.animal)?`<img src="companion-${r.animal}.svg" alt="${esc(r.name)}" style="width:100%;height:100%;object-fit:contain">`:companionEmoji[r.animal]||'🐾';
export function roomHTML(w={},rewards=[],name=w.name||'Your buddy'){
 const h=rewards.find(r=>r.id===w.equipped?.home),pet=rewards.find(r=>r.id===w.equipped?.companion);
 return `<div class="os-room" data-free="${!h}" style="--room-x:${h?.room%2?100:0}%;--room-y:${h?.room>=2?100:0}%"><span class="os-room-label">${esc(h?.name||'Your cosy corner')}</span><img class="os-room-buddy" src="buddies.svg#${esc(w.buddy||'fox')}" alt="${esc(name)}">${Object.values(w.equipped||{}).map(id=>rewards.find(r=>r.id===id)).filter(r=>r?.image).map(r=>`<img class="os-room-buddy" src="${esc(r.image)}" alt="${esc(r.name)}">`).join('')}${pet?`<span class="os-companion" role="img" aria-label="${esc(pet.name)}">${animalArt(pet)}</span>`:''}</div>`;
}
export function rewardArt(r,w,rewards){
 if(r.category==='home')return roomHTML({...w,equipped:{...w?.equipped,home:r.id}},rewards);
 if(r.category==='companion')return `<div class="os-pet-preview" role="img" aria-label="${esc(r.name)}">${animalArt(r)}</div>`;
 return `<div class="os-theme-preview" style="background:${r.gradient||r.colour}"><span>A space for you</span></div>`;
}
export function applyShared(w,rewards,name,showBuddy=true){
 document.querySelector('#os-shared-corner')?.remove();
 const theme=rewards.find(r=>r.id===w?.equipped?.theme);
 document.body.toggleAttribute('data-universal-theme',!!theme?.universal);
 if(theme?.universal){document.body.style.setProperty('--os-background',theme.gradient||theme.colour);document.body.style.background=theme.gradient||theme.colour}
 else{document.body.style.removeProperty('--os-background');document.body.style.backgroundImage=''}
 if(!w||!showBuddy)return;
 const box=document.createElement('div');box.id='os-shared-corner';
 box.innerHTML=`<button class="os-corner-toggle" aria-label="Open ${esc(name)}’s home">⌂ ${esc(name)}’s corner</button><dialog class="os-corner-dialog"><form method="dialog"><button class="os-close">Close</button></form><h2>${esc(name)}’s corner</h2>${roomHTML(w,rewards,name)}<p>Your home and companion travel with you across OneHome.</p><a href="${esc(link('OneStudy'))}">Visit OneStudy →</a></dialog>`;
 document.body.append(box);box.querySelector('button').onclick=()=>box.querySelector('dialog').showModal();
}
