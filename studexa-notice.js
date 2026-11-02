/* Studexa notification — place <script src="studexa-notice.js" defer></script> in your existing HTML. */
(function () {
  'use strict';
  function mount() {
    if (document.getElementById('studexa-announcement-host')) return;
    try { if (sessionStorage.getItem('studexaNoticeDismissed') === '1') return; } catch (e) {}
    const host = document.createElement('div');
    host.id = 'studexa-announcement-host';
    host.style.cssText = 'position:fixed;z-index:2147483000;bottom:0;right:0;pointer-events:none';
    document.body.appendChild(host);
    const root = host.attachShadow({mode:'open'});
    root.innerHTML = `<style>
  :root { color-scheme: light; }
  .studexa-notice { font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; box-sizing: border-box; }
  .studexa-notice * { box-sizing: border-box; }
  .studexa-notice { position:fixed; bottom:22px; right:22px; width:min(390px,calc(100vw - 30px)); z-index:2147483000; background:#fffdf7; border:2px solid #f5a524; border-radius:16px; color:#33240e; box-shadow:0 14px 45px rgba(79,48,8,.18); animation:studexa-pulse 3.4s ease-in-out infinite; overflow:hidden; }
  @keyframes studexa-pulse { 0%,100% {box-shadow:0 12px 38px rgba(79,48,8,.17),0 0 0 0 rgba(245,165,36,.17);border-color:#ed9e19} 50%{box-shadow:0 12px 38px rgba(79,48,8,.18),0 0 0 7px rgba(245,165,36,.07);border-color:#ffd267} }
  .studexa-notice__header { display:flex;align-items:flex-start;gap:11px;padding:17px 44px 8px 16px;background:linear-gradient(135deg,#fff4d2 0%,#fffdf7 80%); }
  .studexa-notice__icon { display:grid;place-items:center;flex-shrink:0;width:29px;height:29px;background:#fbbf24;color:#4b2d00;border-radius:50%;font-size:20px;font-weight:850;line-height:1; }
  .studexa-notice__title { margin:0;font-size:15px;font-weight:750;letter-spacing:-.015em; }
  .studexa-notice__date { margin:3px 0 0;font-size:12px;color:#886119;font-weight:600; }
  .studexa-notice__close { position:absolute;right:12px;top:11px;border:0;border-radius:8px;background:transparent;color:#624b24;width:30px;height:30px;cursor:pointer;font-size:22px;line-height:1; }
  .studexa-notice__close:hover { background:#ffe5aa; }
  .studexa-notice__content { padding:6px 16px 16px; }
  .studexa-notice__summary { margin:0;font-size:13px;line-height:1.6; }
  .studexa-notice__summary strong { font-weight:750; }
  .studexa-notice__toggle { display:flex;align-items:center;gap:7px;margin-top:12px;padding:8px 11px;background:#fff0c4;border:1px solid #edc46b;border-radius:9px;color:#714707;font-size:12px;font-weight:700;cursor:pointer; }
  .studexa-notice__toggle:hover {background:#ffe5a0;}
  .studexa-notice__chevron {display:inline-block;transition:transform .22s ease;}
  .studexa-notice[data-expanded="true"] .studexa-notice__chevron {transform:rotate(180deg);}
  .studexa-notice__details { margin-top:13px;border-top:1px solid #f3d9a7;padding-top:13px;font-size:12.5px;line-height:1.55;max-height:min(45vh,360px);overflow-y:auto; }
  .studexa-notice__details[hidden] {display:none;}
  .studexa-notice__details h3 {font-size:13px;margin:0 0 6px;}
  .studexa-notice__details p {margin:0 0 11px;}
  .studexa-notice__details ul {padding-left:19px;margin:4px 0 11px;}
  .studexa-notice__details li {margin-bottom:6px;}
  .studexa-notice__footnote {color:#795f35;}
  @media(max-width:480px) {.studexa-notice {right:15px;bottom:15px;} }
  @media(prefers-reduced-motion:reduce) {.studexa-notice {animation:none;} .studexa-notice__chevron {transition:none;} }
</style><aside class="studexa-notice" id="studexaNotice" aria-label="Important OneHome service announcement" data-expanded="false">
  <div class="studexa-notice__header">
    <span class="studexa-notice__icon" aria-hidden="true">!</span>
    <div>
      <h2 class="studexa-notice__title">Important OneHome Update</h2>
      <p class="studexa-notice__date">Changes begin 6 November 2026</p>
    </div>
    <button class="studexa-notice__close" type="button" aria-label="Dismiss announcement" title="Close" id="studexaClose">&times;</button>
  </div>
  <div class="studexa-notice__content">
    <p class="studexa-notice__summary">As of <strong>6 November</strong>, <strong>OneHome</strong> will move to a separate branch under the leadership of OneLearn called <strong>Studexa Learning</strong>. This is a major upgrade. Sadly, <strong>OneStudy will be discontinued</strong>, with the new platform focusing on <strong>Studexa Maths</strong> and <strong>Studexa Reading</strong>.</p>
    <button class="studexa-notice__toggle" type="button" id="studexaToggle" aria-expanded="false" aria-controls="studexaDetails"> <span id="studexaToggleLabel">View more information</span> <span class="studexa-notice__chevron" aria-hidden="true">⌄</span></button>
    <section class="studexa-notice__details" id="studexaDetails" hidden>
      <h3>What is changing?</h3>
      <p>OneHome is moving in full to <strong>Studexa Learning</strong>, an independent branch of OneLearn that will remain linked with the wider OneLearn family.</p>
      <ul>
        <li><strong>OneMaths → Studexa Maths:</strong> Maths learning continues under its new name.</li>
        <li><strong>OneReader → Studexa Reading:</strong> Reading continues under its new name, with more choice in how students read.</li>
        <li><strong>OneStudy:</strong> This service is being discontinued and will not be part of Studexa Learning.</li>
        <li><strong>Study Buddy:</strong> This feature was already removed and will not return as part of the transition.</li>
      </ul>
      <h3>What about existing subscriptions?</h3>
      <p><strong>Existing subscriptions will carry over</strong> as part of the move to Studexa. The transition is a reorganisation of the learning services, rather than the end of Maths and Reading.</p>
      <h3>Why are we doing this?</h3>
      <p>Studexa will give Maths and Reading a clearer identity and room to grow, while OneLearn continues to focus on its wider education products, including OneEducation and OnePrimary.</p>
      <p class="studexa-notice__footnote">More information about individual account changes and migration steps will be shared through official OneLearn and Studexa updates.</p>
    </section>
  </div>
</aside>`;
    const notice = root.getElementById('studexaNotice');
    notice.style.pointerEvents = 'auto';
    const close = root.getElementById('studexaClose');
    const toggle = root.getElementById('studexaToggle');
    const details = root.getElementById('studexaDetails');
    const label = root.getElementById('studexaToggleLabel');
    close.addEventListener('click', () => {
      try { sessionStorage.setItem('studexaNoticeDismissed', '1'); } catch (e) {}
      host.remove();
    });
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      notice.dataset.expanded = String(expanded);
      details.hidden = !expanded;
      label.textContent = expanded ? 'View less information' : 'View more information';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
