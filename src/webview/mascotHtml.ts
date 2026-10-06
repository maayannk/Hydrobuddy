import { getMascot } from './mascots';
import { BASE_CSS, csp, getNonce, safeJson } from './util';

export interface MascotViewState {
  count: number;
  goal: number;
  snoozeMinutes: number;
  /** How many VS Code windows share this reminder. */
  windows: number;
  /** Which buddy to draw. */
  mascotId: string;
  /** Speech-bubble text. */
  line: string;
  /** Code-style one-liner under the bubble. */
  devLine: string;
}

export function renderMascotHtml(cspSource: string, state: MascotViewState): string {
  const nonce = getNonce();
  const mascot = getMascot(state.mascotId);
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
  .sync {
    display: inline-flex; align-items: center; gap: 6px; font-size: .85em;
    padding: 3px 10px; border-radius: 999px; background: var(--accent-soft);
  }
  .bubble.handled { background: rgba(46,160,67,.15); border-color: #2ea043; }
  .bubble.handled::after { border-bottom-color: #2ea043; }
  .actions.gone { visibility: hidden; }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .name { font-size: .8em; letter-spacing: .08em; text-transform: uppercase; margin-top: -8px; }
  .code {
    font-size: .85em; padding: 4px 10px; border-radius: 6px;
    background: var(--vscode-textCodeBlock-background, var(--accent-soft));
    color: var(--vscode-textPreformat-foreground, inherit);
  }
  .dots { display: flex; gap: 5px; justify-content: center; flex-wrap: wrap; }
  .dots span { width: 9px; height: 9px; border-radius: 50%; background: var(--accent-soft); border: 1px solid var(--accent); }
  .dots span.on { background: var(--accent); }
  kbd {
    font-family: var(--vscode-editor-font-family, monospace); font-size: .75em; opacity: .75;
    padding: 0 4px; margin-left: 6px; border-radius: 3px; border: 1px solid currentColor;
  }
  .sparkle { position: fixed; pointer-events: none; font-size: 22px; animation: rise .9s ease-out forwards; }
  .shaker.shake { animation: shake .7s cubic-bezier(.36,.07,.19,.97) both; }
  .bubble.shake { animation: pulse .7s ease-in-out both; }
  @keyframes shake {
    0%, 100% { transform: translateX(0) rotate(0); }
    10%, 50%, 90% { transform: translateX(-7px) rotate(-6deg); }
    30%, 70% { transform: translateX(7px) rotate(6deg); }
  }
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes popIn { from { opacity: 0; transform: scale(.6) translateY(30px); } to { opacity: 1; transform: none; } }
  @keyframes popOut { to { opacity: 0; transform: scale(.7) translateY(30px); } }
  @keyframes rise { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-80px); } }
</style>
</head>
<body>
  <main class="card" id="card">
    <div class="shaker" id="shaker">${mascot.svg}</div>
    <div class="name muted">${mascot.name}</div>
    <div class="bubble" id="bubble" role="alert"></div>
    <div class="code mono" id="devLine"></div>
    <div class="muted" id="progress"></div>
    <div class="dots" id="dots" aria-hidden="true"></div>
    <div class="sync muted" id="sync" hidden></div>
    <div class="actions" id="actions">
      <button class="primary" data-action="drank" autofocus>🥤 I Drank Water<kbd>Enter</kbd></button>
      <button data-action="snooze" id="snoozeBtn"></button>
      <button data-action="dismiss">Dismiss<kbd>Esc</kbd></button>
    </div>
  </main>
<script nonce="${nonce}">
  (function () {
    const vscode = acquireVsCodeApi();
    const state = ${safeJson(state)};
    document.getElementById('progress').textContent =
      'Today: ' + state.count + ' / ' + state.goal + ' water breaks';
    const snoozeBtn = document.getElementById('snoozeBtn');
    snoozeBtn.textContent = '⏰ Snooze ' + state.snoozeMinutes + ' min';
    const kbd = document.createElement('kbd');
    kbd.textContent = 'S';
    snoozeBtn.appendChild(kbd);
    document.getElementById('bubble').textContent = state.line;
    document.getElementById('devLine').textContent = state.devLine;
    const dots = document.getElementById('dots');
    for (let i = 0; i < Math.max(state.goal, state.count + 1); i++) {
      const d = document.createElement('span');
      if (i < state.count) d.className = 'on';
      dots.appendChild(d);
    }
    if (state.windows > 1) {
      const sync = document.getElementById('sync');
      sync.textContent = '🔗 Synced across ' + state.windows + ' windows';
      sync.title = 'Answer once and it clears in every window';
      sync.hidden = false;
    }

    let done = false;

    // Wiggle to catch the eye: right after popping in, then every few seconds until answered.
    function shake() {
      if (done) return;
      ['shaker', 'bubble'].forEach(function (id) {
        const el = document.getElementById(id);
        el.classList.remove('shake');
        void el.offsetWidth; // restart the animation
        el.classList.add('shake');
      });
    }
    setTimeout(shake, 450);
    const shakeTimer = setInterval(shake, 6000);

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
    function answer(action) {
      if (done) return;
      done = true;
      clearInterval(shakeTimer);
      if (action === 'drank') sparkle();
      document.getElementById('card').classList.add('leaving');
      setTimeout(function () { vscode.postMessage({ type: action }); }, action === 'drank' ? 600 : 250);
    }
    document.querySelectorAll('button[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () { answer(btn.getAttribute('data-action')); });
    });
    // Keyboard first, like the rest of VS Code.
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') answer('dismiss');
      else if (e.key === 's' || e.key === 'S') answer('snooze');
      else if (e.key === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) answer('drank');
    });

    // Answered in another window: say so briefly, then the panel closes itself.
    window.addEventListener('message', function (e) {
      const msg = e.data;
      if (!msg || msg.type !== 'handled' || done) return;
      done = true;
      clearInterval(shakeTimer);
      const bubble = document.getElementById('bubble');
      bubble.textContent = msg.title;
      bubble.classList.remove('shake');
      bubble.classList.add('handled');
      document.getElementById('progress').textContent = msg.detail;
      document.getElementById('sync').hidden = true;
      document.getElementById('devLine').hidden = true;
      document.getElementById('actions').classList.add('gone');
      setTimeout(function () { document.getElementById('card').classList.add('leaving'); }, 1300);
    });
  })();
</script>
</body>
</html>`;
}
