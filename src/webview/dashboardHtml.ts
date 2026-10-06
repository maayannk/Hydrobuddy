import { getMascot, MASCOTS, RANDOM_MASCOT } from './mascots';
import { BASE_CSS, csp, getNonce, safeJson } from './util';

export interface DashboardViewState {
  enabled: boolean;
  status: 'running' | 'due' | 'stopped';
  count: number;
  goal: number;
  intervalMinutes: number;
  snoozeMinutes: number;
  /** Epoch ms of next reminder, if counting down. */
  nextAt?: number;
  lastDrankAt?: number;
  /** VS Code windows sharing this reminder. */
  windows: number;
  week: Array<{ date: string; count: number }>;
  /** Last 28 days, oldest first, for the hydration graph. */
  month: Array<{ date: string; count: number }>;
  /** Consecutive days the goal was met. */
  streak: number;
  /** Selected mascot id or "random". */
  mascot: string;
}

/**
 * The dashboard HTML is static; all data arrives through postMessage so the
 * panel can be updated without reloading (and without losing focus/scroll).
 */
export function renderDashboardHtml(cspSource: string): string {
  const nonce = getNonce();
  const buddies = MASCOTS.map((m) => ({ id: m.id, name: m.name, theme: m.theme, line: m.lines[0], svg: m.svg }));
  const pickerCards = MASCOTS.map(
    (m) => `<button class="pick" data-mascot="${m.id}" title="${m.description}">
      ${m.svg}<span class="pick-name">${m.name}</span><span class="pick-theme muted">${m.theme}</span></button>`,
  ).join('');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp(cspSource, nonce)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hydrate Buddy</title>
<style nonce="${nonce}">
  ${BASE_CSS}
  .wrap { max-width: 760px; margin: 0 auto; display: grid; gap: 16px; }
  header { display: flex; align-items: center; gap: 16px; }
  #hero .buddy { width: 76px; height: 89px; flex: none; animation: bob 2.4s ease-in-out infinite; }
  h1 { margin: 0; font-size: 1.55em; }
  h2 { margin: 0 0 12px; font-size: .78em; text-transform: uppercase; letter-spacing: .08em; color: var(--vscode-descriptionForeground); font-weight: 600; }
  .card {
    padding: 16px; border-radius: 12px;
    background: var(--vscode-sideBar-background, var(--accent-soft));
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
  }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .tile .k { font-size: .75em; text-transform: uppercase; letter-spacing: .07em; color: var(--vscode-descriptionForeground); }
  .tile .v { font-size: 1.9em; font-weight: 700; line-height: 1.15; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .tile .s { font-size: .82em; color: var(--vscode-descriptionForeground); margin-top: 2px; min-height: 1.2em; }
  .of { font-size: .5em; color: var(--vscode-descriptionForeground); font-weight: 400; }
  .bar { height: 6px; border-radius: 3px; background: var(--accent-soft); overflow: hidden; margin-top: 8px; }
  .bar > div { height: 100%; background: var(--accent); width: 0; transition: width .4s; }

  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: .5em; margin-left: 8px; vertical-align: middle; font-weight: 600; }
  .pill.on { background: rgba(46,160,67,.2); color: #2ea043; }
  .pill.off { background: rgba(160,160,160,.2); }
  .pill.due { background: rgba(240,140,47,.2); color: #e0822b; }
  .sync { display: inline-block; margin-top: 6px; font-size: .8em; padding: 2px 10px; border-radius: 999px; background: var(--accent-soft); }

  .term { padding: 0; overflow: hidden; }
  .term-bar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.2)); }
  .term-bar i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .term-bar .t { margin-left: 8px; font-size: .8em; color: var(--vscode-descriptionForeground); }
  .term pre {
    margin: 0; padding: 12px 16px; font-size: .9em; line-height: 1.6; white-space: pre-wrap;
    background: var(--vscode-terminal-background, var(--vscode-editor-background));
    color: var(--vscode-terminal-foreground, var(--vscode-foreground));
  }
  .c-prompt { color: #2ea043; } .c-key { color: var(--vscode-descriptionForeground); }
  .c-ok { color: #3fb950; } .c-warn { color: #e0822b; } .c-acc { color: var(--accent); }
  .cursor { display: inline-block; width: 8px; height: 1.05em; vertical-align: text-bottom; background: currentColor; animation: caret 1s steps(1) infinite; }

  .graph-wrap { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
  .graph { display: grid; grid-template-rows: repeat(7, 14px); grid-auto-flow: column; grid-auto-columns: 14px; gap: 4px; }
  .cell { border-radius: 3px; background: rgba(128,128,128,.16); }
  .cell.blank { background: transparent; }
  .cell.l1 { background: rgba(47,140,240,.3); } .cell.l2 { background: rgba(47,140,240,.5); }
  .cell.l3 { background: rgba(47,140,240,.75); } .cell.l4 { background: #2f8cf0; }
  .cell.today { outline: 1.5px solid var(--vscode-focusBorder); outline-offset: 1px; }
  .legend { display: flex; gap: 4px; align-items: center; font-size: .75em; }
  .legend .cell { width: 12px; height: 12px; }

  .picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .pick {
    display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px;
    border-radius: 10px; background: transparent; border: 1.5px solid var(--vscode-widget-border, rgba(128,128,128,.25));
    color: inherit; transition: transform .15s, border-color .15s;
  }
  .pick:hover { transform: translateY(-2px); border-color: var(--accent); background: var(--accent-soft); }
  .pick.selected { border-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--accent); }
  .pick .buddy { width: 52px; height: 61px; }
  .pick .buddy .eyes, .pick .buddy .arm-right { animation-play-state: paused; }
  .pick:hover .buddy .eyes, .pick:hover .buddy .arm-right, .pick.selected .buddy .arm-right { animation-play-state: running; }
  .pick-name { font-weight: 600; font-size: .9em; }
  .pick-theme { font-size: .72em; }
  .dice { font-size: 38px; line-height: 61px; height: 61px; }
  .quote { margin-top: 12px; font-style: italic; }

  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .row { display: flex; align-items: center; gap: 8px; }
  input[type=number] {
    width: 64px; padding: 5px 6px; border-radius: 6px; font: inherit;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
  }
  kbd {
    font-family: var(--vscode-editor-font-family, monospace); font-size: .78em;
    padding: 1px 5px; border-radius: 4px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.4));
  }
  .note { font-size: .82em; }
  .spacer { flex: 1; }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes caret { 50% { opacity: 0; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div id="hero"></div>
    <div>
      <h1>Hydrate Buddy <span id="pill" class="pill"></span></h1>
      <div class="muted" id="subtitle">Stay hydrated, ship better code.</div>
      <div class="sync muted" id="sync" hidden></div>
    </div>
  </header>

  <section class="tiles">
    <div class="card tile">
      <div class="k">Today</div>
      <div class="v"><span id="count">0</span><span class="of"> / <span id="goal">8</span></span></div>
      <div class="bar"><div id="barFill"></div></div>
    </div>
    <div class="card tile">
      <div class="k">Next reminder</div>
      <div class="v" id="countdown">--:--</div>
      <div class="s" id="nextClock"></div>
    </div>
    <div class="card tile">
      <div class="k">Goal streak</div>
      <div class="v" id="streak">0</div>
      <div class="s" id="streakNote"></div>
    </div>
    <div class="card tile">
      <div class="k">Since last sip</div>
      <div class="v" id="since">—</div>
      <div class="s" id="sinceClock"></div>
    </div>
  </section>

  <section class="card term">
    <div class="term-bar"><i></i><i></i><i></i><span class="t mono">~/hydration — zsh</span></div>
    <pre class="mono" id="term"></pre>
  </section>

  <section class="card">
    <h2>Hydration graph · last 4 weeks</h2>
    <div class="graph-wrap">
      <div class="graph" id="graph"></div>
      <div class="legend muted">less <span class="cell"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span><span class="cell l4"></span> more</div>
    </div>
  </section>

  <section class="card">
    <h2>Choose your buddy</h2>
    <div class="picker" id="picker">
      ${pickerCards}
      <button class="pick" data-mascot="${RANDOM_MASCOT}" title="A different buddy for every reminder">
        <span class="dice">🎲</span><span class="pick-name">Surprise me</span><span class="pick-theme muted">Random</span>
      </button>
    </div>
    <div class="quote muted" id="quote"></div>
  </section>

  <section class="actions">
    <button class="primary" data-action="drank">🥤 I Drank Water</button>
    <button data-action="remindNow">💧 Remind Me Now</button>
    <button data-action="toggle" id="toggleBtn">Pause</button>
    <span class="row muted"><label for="interval">every</label><input type="number" id="interval" min="1" max="480"><span>min</span></span>
    <span class="spacer"></span>
    <button data-action="openSettings">⚙️ Settings</button>
    <button data-action="reset">Reset Today</button>
  </section>
  <p class="muted note">
    Tip: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → “Hydrate Buddy” for every command.
    All data stays on this machine. No accounts, no tracking, no telemetry.
  </p>
</div>

<script nonce="${nonce}">
  (function () {
    const vscode = acquireVsCodeApi();
    const BUDDIES = ${safeJson(buddies)};
    const DEFAULT_SVG = ${safeJson(getMascot('drip').svg)};
    let state = null;
    let heroFor = null;
    const $ = (id) => document.getElementById(id);
    const pad = (n) => String(n).padStart(2, '0');
    const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // The three window "traffic lights" (inline style attributes are blocked by the CSP).
    const dotColors = ['#ff5f56', '#ffbd2e', '#27c93f'];
    document.querySelectorAll('.term-bar i').forEach((dot, i) => { dot.style.background = dotColors[i]; });

    function fmt(ms) {
      const t = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
      return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
    }
    function ago(ms) {
      const m = Math.floor(ms / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return m + 'm';
      return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
    }

    function span(cls, text) {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.textContent = text;
      return s;
    }

    function renderTerm() {
      const pre = $('term');
      pre.textContent = '';
      const line = (...parts) => { parts.forEach((p) => pre.append(p)); pre.append(document.createTextNode(String.fromCharCode(10))); };
      const pct = Math.min(100, Math.round((state.count / state.goal) * 100));
      const filled = Math.min(10, Math.round(pct / 10));
      let next;
      if (!state.enabled || state.status === 'stopped') next = span('c-warn', 'paused');
      else if (state.status === 'due') next = span('c-warn', 'NOW — time for a sip');
      else next = span('c-acc', fmt(state.nextAt - Date.now()) + '  (at ' + clock(state.nextAt) + ')');

      line(span('c-prompt', '➜ '), span('c-acc', '~/hydration '), document.createTextNode('hydrate status'));
      line(span('c-key', '  today     '), span(pct >= 100 ? 'c-ok' : 'c-acc', '█'.repeat(filled)), span('c-key', '░'.repeat(10 - filled)), document.createTextNode('  ' + state.count + '/' + state.goal + ' (' + pct + '%)'));
      line(span('c-key', '  next      '), next);
      line(span('c-key', '  interval  '), document.createTextNode('every ' + state.intervalMinutes + ' min · snooze ' + state.snoozeMinutes + ' min'));
      line(span('c-key', '  streak    '), document.createTextNode(state.streak + (state.streak === 1 ? ' day' : ' days') + (state.streak > 0 ? ' 🔥' : '')));
      line(span('c-key', '  sync      '), span('c-ok', '✔ '), document.createTextNode(state.windows + (state.windows === 1 ? ' window' : ' windows')));
      line(span('c-key', '  privacy   '), span('c-ok', '✔ '), document.createTextNode('local only, 0 network calls'));
      pre.append(span('c-prompt', '➜ '), span('c-acc', '~/hydration '), span('cursor', ''));
    }

    function renderLive() {
      if (!state) return;
      const el = $('countdown');
      if (!state.enabled || state.status === 'stopped') el.textContent = 'Paused';
      else if (state.status === 'due') el.textContent = 'Now! 💧';
      else if (state.nextAt) el.textContent = fmt(state.nextAt - Date.now());
      $('since').textContent = state.lastDrankAt ? ago(Date.now() - state.lastDrankAt) : '—';
      renderTerm();
    }

    function renderGraph() {
      const g = $('graph');
      g.textContent = '';
      const first = state.month[0].date.split('-').map(Number);
      const offset = (new Date(first[0], first[1] - 1, first[2]).getDay() + 6) % 7; // Monday first
      for (let i = 0; i < offset; i++) {
        const blank = document.createElement('div');
        blank.className = 'cell blank';
        g.appendChild(blank);
      }
      state.month.forEach((d, i) => {
        const r = d.count / state.goal;
        const level = d.count === 0 ? 0 : r < 0.34 ? 1 : r < 0.67 ? 2 : r < 1 ? 3 : 4;
        const cell = document.createElement('div');
        cell.className = 'cell' + (level ? ' l' + level : '') + (i === state.month.length - 1 ? ' today' : '');
        cell.title = d.date + ' · ' + d.count + ' water break' + (d.count === 1 ? '' : 's');
        g.appendChild(cell);
      });
    }

    function renderPicker() {
      document.querySelectorAll('.pick').forEach((b) => b.classList.toggle('selected', b.getAttribute('data-mascot') === state.mascot));
      const buddy = BUDDIES.find((b) => b.id === state.mascot);
      $('quote').textContent = buddy
        ? buddy.name + ' says: “' + buddy.line + '”'
        : '🎲 A different buddy shows up for every reminder.';
      if (heroFor !== state.mascot) {
        heroFor = state.mascot;
        $('hero').innerHTML = buddy ? buddy.svg : DEFAULT_SVG;
      }
    }

    function render() {
      $('count').textContent = state.count;
      $('goal').textContent = state.goal;
      $('barFill').style.width = Math.min(100, (state.count / state.goal) * 100) + '%';

      const pill = $('pill');
      if (!state.enabled) { pill.textContent = 'paused'; pill.className = 'pill off'; }
      else if (state.status === 'due') { pill.textContent = 'water time'; pill.className = 'pill due'; }
      else { pill.textContent = 'active'; pill.className = 'pill on'; }

      const sync = $('sync');
      sync.hidden = !(state.windows > 1);
      sync.textContent = '🔗 Synced across ' + state.windows + ' windows: same timer, one reminder';

      $('nextClock').textContent = state.enabled && state.status === 'running' && state.nextAt ? 'at ' + clock(state.nextAt) : '';
      $('streak').textContent = state.streak + (state.streak > 0 ? ' 🔥' : '');
      $('streakNote').textContent = state.streak === 1 ? 'day hitting your goal' : 'days hitting your goal';
      $('sinceClock').textContent = state.lastDrankAt ? 'at ' + clock(state.lastDrankAt) : 'no sips yet today';
      $('subtitle').textContent = state.count >= state.goal
        ? 'Goal reached today. Great job! 🎉'
        : (state.goal - state.count) + ' more water break' + (state.goal - state.count === 1 ? '' : 's') + ' to hit today’s goal.';
      $('toggleBtn').textContent = state.enabled ? '⏸ Pause' : '▶ Resume';
      if (document.activeElement !== $('interval')) $('interval').value = state.intervalMinutes;

      renderGraph();
      renderPicker();
      renderLive();
    }

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'state') { state = e.data.state; render(); }
    });

    document.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => vscode.postMessage({ type: btn.getAttribute('data-action') }));
    });
    document.querySelectorAll('button[data-mascot]').forEach((btn) => {
      btn.addEventListener('click', () => vscode.postMessage({ type: 'setMascot', id: btn.getAttribute('data-mascot') }));
    });

    $('interval').addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (Number.isFinite(v) && v >= 1 && v <= 480) vscode.postMessage({ type: 'setInterval', minutes: v });
    });

    setInterval(renderLive, 1000);
    vscode.postMessage({ type: 'ready' });
  })();
</script>
</body>
</html>`;
}
