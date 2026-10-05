import { BASE_CSS, MASCOT_SVG, csp, getNonce, safeJson } from './util';

export interface MascotViewState {
  count: number;
  goal: number;
  snoozeMinutes: number;
}

export function renderMascotHtml(cspSource: string, state: MascotViewState): string {
  const nonce = getNonce();
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp(cspSource, nonce)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Water time</title>
<style nonce="${nonce}">
  ${BASE_CSS}
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 14px;
    max-width: 320px; text-align: center;
    animation: popIn .45s cubic-bezier(.2,1.4,.4,1) both;
  }
  .card.leaving { animation: popOut .3s ease-in both; }
  .buddy { width: 120px; height: 140px; animation: bounce 1.6s ease-in-out infinite; }
  .bubble {
    position: relative; padding: 12px 16px; border-radius: 14px;
    background: var(--accent-soft); border: 1px solid var(--accent);
    font-size: 1.15em; font-weight: 600;
  }
  .bubble::after {
    content: ''; position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
    border: 9px solid transparent; border-top: 0; border-bottom-color: var(--accent);
  }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .sparkle { position: fixed; pointer-events: none; font-size: 22px; animation: rise .9s ease-out forwards; }
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes popIn { from { opacity: 0; transform: scale(.6) translateY(30px); } to { opacity: 1; transform: none; } }
  @keyframes popOut { to { opacity: 0; transform: scale(.7) translateY(30px); } }
  @keyframes rise { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-80px); } }
</style>
</head>
<body>
  <main class="card" id="card">
    ${MASCOT_SVG}
    <div class="bubble" role="alert">💧 It's water time! Take a sip.</div>
    <div class="muted" id="progress"></div>
    <div class="actions">
      <button class="primary" data-action="drank" autofocus>🥤 I Drank Water</button>
      <button data-action="snooze" id="snoozeBtn"></button>
      <button data-action="dismiss">Dismiss</button>
    </div>
  </main>
<script nonce="${nonce}">
  (function () {
    const vscode = acquireVsCodeApi();
    const state = ${safeJson(state)};
    document.getElementById('progress').textContent =
      'Today: ' + state.count + ' / ' + state.goal + ' water breaks';
    document.getElementById('snoozeBtn').textContent = '⏰ Snooze ' + state.snoozeMinutes + ' min';

    let done = false;
    function sparkle() {
      for (let i = 0; i < 6; i++) {
        const s = document.createElement('span');
        s.className = 'sparkle';
        s.textContent = i % 2 ? '💧' : '✨';
        s.style.left = (window.innerWidth / 2 - 60 + Math.random() * 120) + 'px';
        s.style.top = (window.innerHeight / 2 - 40 + Math.random() * 40) + 'px';
        document.body.appendChild(s);
      }
    }
    document.querySelectorAll('button[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (done) return;
        done = true;
        const action = btn.getAttribute('data-action');
        if (action === 'drank') sparkle();
        document.getElementById('card').classList.add('leaving');
        setTimeout(function () { vscode.postMessage({ type: action }); }, action === 'drank' ? 600 : 250);
      });
    });
  })();
</script>
</body>
</html>`;
}
