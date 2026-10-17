(() => {
 const app=document.getElementById('app'), entry=document.currentScript.dataset.entry||'home.mjs', version='11.1';
 let settled=false;
 const ready=()=>!!app.querySelector('.ui-header,#signin,.login');
 const show=message=>{
  if(ready())return;
  app.replaceChildren();
  const panel=document.createElement('main');panel.style.cssText='max-width:650px;margin:10vh auto;padding:32px;font-family:Arial,sans-serif;color:#17213d';
  const title=document.createElement('h1');title.textContent='We couldn’t finish opening this page';
  const p=document.createElement('p');p.textContent=message;p.style.lineHeight='1.7';
  const retry=document.createElement('button');retry.textContent='Try again';retry.onclick=()=>location.reload();
  const check=document.createElement('button');check.textContent='Check website files';check.style.marginLeft='12px';
  const result=document.createElement('p');result.setAttribute('role','status');
  check.onclick=async()=>{check.disabled=true;result.textContent='Checking the website files…';const list=['config.js',entry,'shared.mjs','refresh-ui.mjs','student-auth.mjs','shared-world.mjs','rewards.json',...(entry==='home.mjs'?['home-core.mjs','import-core.mjs','roster.mjs']:[])];const bad=[];await Promise.all(list.map(async name=>{try{const r=await fetch(name+'?v='+version,{cache:'reload',signal:AbortSignal.timeout(12000)});if(!r.ok)bad.push(name+' ('+r.status+')')}catch{bad.push(name+' (unreachable)')}}));result.textContent=bad.length?'Missing or unavailable: '+bad.sort().join(', ')+'. Upload the complete app folder, not just the update files.':'The main website files are reachable. Retry, or ask your administrator to check the school connection.';check.disabled=false};
  panel.append(title,p,retry,check,result);app.append(panel);
 };
 const timer=setTimeout(()=>show('The page is taking longer than expected. Check your connection, then try again. Your saved homework is not changed.'),20000);
 const observer=new MutationObserver(()=>{if(ready()){settled=true;clearTimeout(timer);observer.disconnect()}});
 observer.observe(app,{childList:true,subtree:true});
 if(!window.ONELEARN_CONFIG){clearTimeout(timer);show('The school configuration file (config.js) is missing or could not load. Upload it with the complete app files.');return}
 import('./'+entry+'?v='+version).then(()=>{if(ready()){settled=true;clearTimeout(timer);observer.disconnect()}}).catch(error=>{
  clearTimeout(timer);observer.disconnect();console.error('OneHome startup:',error);
  show('A website file could not load. This can happen after an incomplete upload. Use “Check website files” below to identify missing files, or upload the complete app package.');
 });
})();
