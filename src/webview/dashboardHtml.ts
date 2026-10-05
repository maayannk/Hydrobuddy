import { BASE_CSS, MASCOT_SVG, csp, getNonce } from './util';

export interface DashboardViewState {
  enabled: boolean;
  status: 'running' | 'due' | 'stopped';
  count: number;
  goal: number;
  intervalMinutes: number;
  /** Epoch ms of next reminder, if counting down. */
  nextAt?: number;
  lastDrankAt?: number;
  week: Array<{ date: string; count: number }>;
}

/**
 * The dashboard HTML is static; all data arrives through postMessage so the
 * panel can be updated without reloading (and without losing focus/scroll).
 */
export function renderDashboardHtml(cspSource: string): string {
  const nonce = getNonce();
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp(cspSource, nonce)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hydrate Buddy</title>
<style nonce="${nonce}">
  ${BASE_CSS}
  .wrap { max-width: 560px; margin: 0 auto; display: grid; gap: 16px; }
  header { display: flex; align-items: center; gap: 14px; }
  header .buddy { width: 64px; height: 75px; flex: none; }
  h1 { margin: 0; font-size: 1.5em; }
  .card {
    padding: 16px; border-radius: 12px;
    background: var(--vscode-sideBar-background, var(--accent-soft));
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
  }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .big { font-size: 2.2em; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .label { text-transform: uppercase; letter-spacing: .06em; font-size: .78em; }
  .glasses { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; font-size: 1.3em; }
  .glasses .off { opacity: .22; filter: grayscale(1); }
  .bar { height: 8px; border-radius: 4px; background: var(--accent-soft); overflow: hidden; margin-top: 10px; }
  .bar > div { height: 100%; background: var(--accent); width: 0; transition: width .4s; }
  .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; align-items: end; height: 110px; }
  .day { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
  .day .col { width: 100%; max-width: 28px; border-radius: 6px 6px 2px 2px; background: var(--accent); min-height: 3px; opacity: .85; }
  .day.today .col { opacity: 1; box-shadow: 0 0 0 2px var(--vscode-focusBorder); }
  .day small { font-size: .75em; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: .8em; margin-left: 6px; vertical-align: middle; }
  .pill.on { background: rgba(46,160,67,.2); color: #2ea043; }
  .pill.off { background: rgba(160,160,160,.2); }
  .pill.due { background: rgba(240,140,47,.2); color: #e0822b; }
  .of { font-size: .5em; }
  .spaced { margin-bottom: 10px; }
  .note { font-size: .85em; }
  .row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  input[type=number] {
    width: 70px; padding: 5px 6px; border-radius: 6px; font: inherit;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    ${MASCOT_SVG}
    <div>
      <h1>Hydrate Buddy <span id="pill" class="pill"></span></h1>
      <div class="muted" id="lastDrank">Stay hydrated, code better.</div>
    </div>
  </header>

  <section class="stats">
    <div class="card">
      <div class="label muted">Today</div>
      <div class="big"><span id="count">0</span><span class="muted of"> / <span id="goal">8</span></span></div>
      <div class="bar"><div id="barFill"></div></div>
      <div class="glasses" id="glasses" aria-hidden="true"></div>
    </div>
    <div class="card">
      <div class="label muted">Next reminder</div>
      <div class="big" id="countdown">--:--</div>
      <div class="row muted">
        <label for="interval">Every</label>
        <input type="number" id="interval" min="1" max="480">
        <span>min</span>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="label muted spaced">Last 7 days</div>
    <div class="week" id="week"></div>
  </section>

  <section class="actions">
    <button class="primary" data-action="drank">🥤 I Drank Water</button>
    <button data-action="remindNow">💧 Remind Me Now</button>
    <button data-action="toggle" id="toggleBtn">Pause</button>
    <button data-action="openSettings">⚙️ Settings</button>
    <button data-action="reset">Reset Today</button>
  </section>
  <p class="muted note">All data stays on this machine. No accounts, no tracking, no telemetry.</p>
</div>

<script nonce="${nonce}">
  (function () {
    const vscode = acquireVsCodeApi();
    let state = null;
    const $ = (id) => document.getElementById(id);
    const pad = (n) => String(n).padStart(2, '0');

    function fmt(ms) {
      const t = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
      return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
    }

    function renderCountdown() {
      if (!state) return;
      const el = $('countdown');
      if (!state.enabled || state.status === 'stopped') el.textContent = 'Paused';
      else if (state.status === 'due') el.textContent = 'Now! 💧';
      else if (state.nextAt) el.textContent = fmt(state.nextAt - Date.now());
    }

    function render() {
      $('count').textContent = state.count;
      $('goal').textContent = state.goal;
      $('barFill').style.width = Math.min(100, (state.count / state.goal) * 100) + '%';

      const g = $('glasses');
      g.textContent = '';
      const n = Math.max(state.goal, state.count);
      for (let i = 0; i < n; i++) {
        const span = document.createElement('span');
        span.textContent = '🥛';
        if (i >= state.count) span.className = 'off';
        g.appendChild(span);
      }

      const pill = $('pill');
      if (!state.enabled) { pill.textContent = 'paused'; pill.className = 'pill off'; }
      else if (state.status === 'due') { pill.textContent = 'water time'; pill.className = 'pill due'; }
      else { pill.textContent = 'active'; pill.className = 'pill on'; }
      $('toggleBtn').textContent = state.enabled ? '⏸ Pause' : '▶ Resume';

      if (document.activeElement !== $('interval')) $('interval').value = state.intervalMinutes;

      $('lastDrank').textContent = state.lastDrankAt
        ? 'Last sip at ' + new Date(state.lastDrankAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : (state.count >= state.goal ? 'Goal reached — great job! 🎉' : 'Stay hydrated, code better.');

      const week = $('week');
      week.textContent = '';
      const max = Math.max(state.goal, ...state.week.map((d) => d.count), 1);
      state.week.forEach((d, i) => {
        const day = document.createElement('div');
        day.className = 'day' + (i === state.week.length - 1 ? ' today' : '');
        day.title = d.date + ': ' + d.count;
        const num = document.createElement('small'); num.textContent = d.count;
        const col = document.createElement('div'); col.className = 'col';
        col.style.height = Math.max(3, (d.count / max) * 80) + 'px';
        const lbl = document.createElement('small'); lbl.className = 'muted';
        const parts = d.date.split('-').map(Number);
        lbl.textContent = new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString([], { weekday: 'short' });
        day.append(num, col, lbl);
        week.appendChild(day);
      });
      renderCountdown();
    }

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'state') { state = e.data.state; render(); }
    });

    document.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => vscode.postMessage({ type: btn.getAttribute('data-action') }));
    });

    $('interval').addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v) && v >= 1 && v <= 480) vscode.postMessage({ type: 'setInterval', minutes: v });
    });

    setInterval(renderCountdown, 1000);
    vscode.postMessage({ type: 'ready' });
  })();
</script>
</body>
</html>`;
}
