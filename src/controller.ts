import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { HydrateConfig, readConfig, SECTION, updateSetting } from './config';
import { DashboardMessage, DashboardPanel } from './dashboardPanel';
import { DesktopPopupHandle, showDesktopPopup } from './desktopPopup';
import { MascotAction, MascotPanel } from './mascotPanel';
import {
  Ack,
  acknowledge,
  activeWindowCount,
  chooseMascot as chooseMascotState,
  claim,
  ensureRunning,
  focused,
  heartbeat,
  HEARTBEAT_MS,
  markDueIfReached,
  PROTOCOL,
  release,
  resetTodayState,
  SharedState,
  Status,
  statusOf,
  stopped,
  triggerNow,
} from './sharedState';
import { SharedStore } from './sharedStore';
import { goalStreak, lastNDays, normalizeStats } from './stats';
import { StatusBarController } from './statusBar';
import { DashboardViewState } from './webview/dashboardHtml';
import { DEV_LINES, getMascot, isMascotChoice, Mascot, MASCOTS, pick, RANDOM_MASCOT, resolveMascot } from './webview/mascots';

/** Where 1.0.0 kept stats; migrated into the shared file on first run. */
const LEGACY_STATS_KEY = 'hydrateBuddy.stats';
const MINUTE = 60_000;
const TICK_MS = 1000;

/**
 * One folder in the user's home that every window shares, whatever VS Code profile
 * or VS Code-based editor it runs in (globalStorage differs between those).
 */
export function defaultStorageDir(): string {
  // Tests point this elsewhere so they never touch the user's real reminders.
  return process.env.HYDRATE_BUDDY_STATE_DIR || path.join(os.homedir(), '.hydrate-buddy');
}

/** 1.1.0 kept the shared file in globalStorage; carry it over once. */
function migrateFromGlobalStorage(oldDir: string, newDir: string): void {
  const oldFile = path.join(oldDir, 'shared-state.json');
  const newFile = path.join(newDir, 'shared-state.json');
  try {
    if (!fs.existsSync(newFile) && fs.existsSync(oldFile)) {
      fs.mkdirSync(newDir, { recursive: true });
      fs.copyFileSync(oldFile, newFile);
    }
  } catch {
    // start fresh
  }
}

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Read-only snapshot, also exposed to tests through the extension API. */
export interface HydrateSnapshot {
  windowId: string;
  enabled: boolean;
  status: Status;
  intervalMinutes: number;
  remainingMs: number | undefined;
  count: number;
  goal: number;
  owner: string | null;
  reminderVisible: boolean;
  windows: number;
  /** Chosen buddy id (or "random"). */
  mascot: string;
}

/**
 * One instance runs in every VS Code window. All instances share one state file,
 * so they show the same countdown, only one window shows the reminder (the one
 * you're using), and acknowledging it anywhere clears it everywhere.
 */
export class HydrateBuddy implements vscode.Disposable {
  readonly windowId = crypto.randomUUID();
  readonly ready: Promise<void>;

  private config: HydrateConfig;
  private state: SharedState;
  private readonly store: SharedStore;
  private readonly statusBar = new StatusBarController();
  private readonly mascot: MascotPanel;
  private readonly dashboard: DashboardPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timer: NodeJS.Timeout;
  private ticking = false;
  private disposed = false;
  /** The dueAt the visible mascot / notification belongs to. */
  private shownDueAt: number | null = null;
  private notifiedDueAt: number | null = null;
  private lastHeartbeat = 0;
  private randomPick: { dueAt: number | null; mascot: Mascot } | undefined;
  /** OS-level popup shown while you're in another app. */
  private desktop: { handle: DesktopPopupHandle; dueAt: number | null } | undefined;
  /** When this window last lost focus (0 = unknown / at startup). */
  private blurredAt = 0;
  private warnedOutdated = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: vscode.OutputChannel,
    storageDir?: string,
  ) {
    this.config = readConfig();
    if (!storageDir) {
      storageDir = defaultStorageDir();
      migrateFromGlobalStorage(context.globalStorageUri.fsPath, storageDir);
    }
    this.store = new SharedStore(storageDir);
    const firstRun = !this.store.exists();
    this.state = this.store.read();

    this.mascot = new MascotPanel(context.extensionUri, (a) => this.onMascotAction(a));
    this.dashboard = new DashboardPanel(context.extensionUri, () => this.dashboardState(), (m) => this.onDashboardMessage(m));

    this.disposables.push(
      this.statusBar,
      this.mascot,
      this.dashboard,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(SECTION)) {
          this.run('config change', async () => {
            await this.applyConfig(readConfig());
            // Picked in the Settings UI: share it with every window.
            if (e.affectsConfiguration(`${SECTION}.mascot`)) {
              const id = this.config.mascot;
              this.state = await this.store.update((st) => chooseMascotState(st, id));
              this.render();
            }
          });
        }
      }),
      vscode.window.onDidChangeWindowState((e) => {
        if (!e.focused) {
          this.blurredAt = Date.now();
        }
        if (e.focused) {
          this.run('window focus', () => this.onWindowFocused());
        }
      }),
    );

    this.ready = this.init(firstRun ? context.globalState.get(LEGACY_STATS_KEY) : undefined).catch((err) =>
      this.logError('startup', err),
    );
    this.timer = setInterval(() => this.run('tick', () => this.tick()), TICK_MS);
  }

  // ---------------------------------------------------------------- public API

  snapshot(): HydrateSnapshot {
    const s = this.store.read();
    return {
      windowId: this.windowId,
      enabled: this.config.enabled,
      status: statusOf(s),
      intervalMinutes: this.config.intervalMinutes,
      remainingMs: s.nextAt === null ? undefined : Math.max(0, s.nextAt - Date.now()),
      count: s.stats.count,
      goal: this.config.dailyGoal,
      owner: s.owner,
      reminderVisible: this.mascot.isVisible(),
      windows: Math.max(1, activeWindowCount(s, Date.now())),
      mascot: s.mascot !== null && isMascotChoice(s.mascot) ? s.mascot : this.config.mascot,
    };
  }

  showDashboard(): void {
    this.dashboard.show();
  }

  /** Show the reminder in this window right away (moves it here if another window has it). */
  async remindNow(): Promise<void> {
    const now = Date.now();
    this.state = await this.store.update((s) => triggerNow(s, now, this.windowId));
    this.shownDueAt = null; // force a fresh pop-in + shake
    this.notifiedDueAt = null;
    this.sync();
  }

  logDrink(): Promise<void> {
    return this.acknowledge('drank');
  }

  snooze(): Promise<void> {
    return this.acknowledge('snooze');
  }

  dismiss(): Promise<void> {
    return this.acknowledge('dismiss');
  }

  async toggle(): Promise<void> {
    await updateSetting('enabled', !this.config.enabled);
    await this.applyConfig(readConfig());
  }

  async promptForInterval(): Promise<void> {
    const value = await vscode.window.showInputBox({
      title: 'Hydrate Buddy',
      prompt: 'Remind me to drink water every N minutes',
      value: String(this.config.intervalMinutes),
      validateInput: (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 1 && n <= 480 ? undefined : 'Enter a number between 1 and 480';
      },
    });
    if (value !== undefined) {
      await this.setIntervalMinutes(Number(value));
    }
  }

  async setIntervalMinutes(minutes: number): Promise<void> {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) {
      throw new RangeError('Interval must be between 1 and 480 minutes');
    }
    await updateSetting('intervalMinutes', minutes);
    await this.applyConfig(readConfig());
  }

  async resetToday(confirm = true): Promise<void> {
    if (confirm) {
      const choice = await vscode.window.showWarningMessage("Reset today's water-break count to 0?", 'Reset');
      if (choice !== 'Reset') {
        return;
      }
    }
    const now = Date.now();
    this.state = await this.store.update((s) => resetTodayState(s, now));
    this.render();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    clearInterval(this.timer);
    this.closeDesktopPopup();
    // Hand the reminder back and leave the window list, so another open window takes over.
    void this.store.update((s) => release(s, this.windowId)).catch(() => undefined);
    for (const d of this.disposables.splice(0)) {
      try {
        d.dispose();
      } catch (err) {
        this.logError('dispose', err);
      }
    }
  }

  // ------------------------------------------------------------------ internals

  private intervalMs(): number {
    return this.config.intervalMinutes * MINUTE;
  }

  private async init(legacyStats: unknown): Promise<void> {
    const now = Date.now();
    const isFocused = vscode.window.state.focused;
    this.state = await this.store.update((s) => {
      let next = s;
      if (legacyStats) {
        next = { ...next, stats: normalizeStats(legacyStats, new Date(now)) };
      }
      next = this.config.enabled ? ensureRunning(next, now, this.intervalMs(), true) : stopped(next);
      next = heartbeat(next, this.windowId, now);
      return isFocused ? focused(next, this.windowId, now) : next;
    });
    this.lastHeartbeat = now;
    await this.tick();
  }

  /** Every second: pick up changes from other windows, fire when due, move the reminder to the active window. */
  private async tick(): Promise<void> {
    if (this.ticking || this.disposed) {
      return;
    }
    this.ticking = true;
    try {
      const now = Date.now();
      let s = this.store.read();
      if (now - this.lastHeartbeat >= HEARTBEAT_MS) {
        this.lastHeartbeat = now;
        s = await this.store.update((x) => heartbeat(x, this.windowId, now));
      }
      // Self-repair: reminders are on but nothing is scheduled (e.g. left that way by an older version).
      if (this.config.enabled && statusOf(s) === 'stopped') {
        s = await this.store.update((x) => (this.config.enabled ? ensureRunning(x, now, this.intervalMs()) : x));
      }
      if (this.config.enabled && s.dueAt === null && s.nextAt !== null && now >= s.nextAt) {
        s = await this.store.update((x) => markDueIfReached(x, now, this.preferredOwner(x)));
      }
      if (s.dueAt !== null && s.owner !== this.windowId && this.shouldClaim(s)) {
        s = await this.store.update((x) => claim(x, this.windowId));
      }
      this.state = s;
      this.sync();
      this.checkProtocol(s);
    } finally {
      this.ticking = false;
    }
  }

  /** A newer version is running in another window; this one can't follow its rules. */
  private checkProtocol(s: SharedState): void {
    if (s.protocol <= PROTOCOL || this.warnedOutdated) {
      return;
    }
    this.warnedOutdated = true;
    void vscode.window
      .showWarningMessage(
        'Hydrate Buddy was updated in another window. Reload this window so reminders stay in sync.',
        'Reload Window',
      )
      .then((choice) => {
        if (choice === 'Reload Window') {
          void vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
  }

  /** Who should show a reminder that is just becoming due. */
  private preferredOwner(s: SharedState): string {
    if (vscode.window.state.focused || !s.lastFocused) {
      return this.windowId;
    }
    return s.lastFocused.id;
  }

  /** The reminder follows the window you're using; an unowned reminder goes to the last-used window. */
  private shouldClaim(s: SharedState): boolean {
    if (vscode.window.state.focused) {
      return true;
    }
    return s.owner === null && (s.lastFocused === null || s.lastFocused.id === this.windowId);
  }

  private async onWindowFocused(): Promise<void> {
    const now = Date.now();
    this.state = await this.store.update((s) => claim(focused(s, this.windowId, now), this.windowId));
    this.sync();
  }

  private async applyConfig(next: HydrateConfig): Promise<void> {
    this.config = next;
    const now = Date.now();
    // Every window gets this event; ensureRunning/stopped are no-ops after the first one applies them.
    this.state = await this.store.update((s) => (next.enabled ? ensureRunning(s, now, this.intervalMs()) : stopped(s)));
    this.sync();
  }

  private async acknowledge(ack: Ack, expectDueAt?: number | null): Promise<void> {
    const now = Date.now();
    const before = this.store.read().stats.count;
    this.state = await this.store.update((s) =>
      acknowledge(s, ack, now, {
        intervalMs: this.intervalMs(),
        snoozeMs: this.config.snoozeMinutes * MINUTE,
        enabled: this.config.enabled,
        expectDueAt,
        by: this.windowId,
      }),
    );
    this.sync();

    const count = this.state.stats.count;
    const goal = this.config.dailyGoal;
    if (ack === 'drank' && count > before) {
      const msg = before < goal && count >= goal
        ? `🎉 Daily goal reached: ${count}/${goal}! Great job.`
        : `💧 Nice! ${count}/${goal} water breaks today.`;
      const next = this.state.nextAt !== null ? ` Next sip at ${clockTime(this.state.nextAt)}.` : '';
      vscode.window.setStatusBarMessage(msg + next, 5000);
    } else if (ack === 'snooze' && this.config.enabled && this.state.nextAt !== null) {
      vscode.window.setStatusBarMessage(`⏰ Snoozed until ${clockTime(this.state.nextAt)}`, 4000);
    }
  }

  /** Make this window's UI match the shared state. */
  private sync(): void {
    const s = this.state;
    const mine = s.dueAt !== null && s.owner === this.windowId;

    if (mine && this.config.reminderStyle === 'mascot') {
      if (!this.mascot.isVisible() || this.shownDueAt !== s.dueAt) {
        this.shownDueAt = s.dueAt;
        const buddy = this.buddyFor(s.dueAt);
        this.mascot.show({
          count: s.stats.count,
          goal: this.config.dailyGoal,
          snoozeMinutes: this.config.snoozeMinutes,
          windows: Math.max(1, activeWindowCount(s, Date.now())),
          mascotId: buddy.id,
          line: pick(buddy.lines),
          devLine: pick(DEV_LINES),
        });
      }
    } else {
      if (this.mascot.isVisible()) {
        const ack = s.lastAck;
        if (s.dueAt === null && ack && ack.by !== this.windowId && ack.dueAt === this.shownDueAt) {
          // Answered in another window: tell the user instead of vanishing silently.
          const title = ack.kind === 'drank' ? '✅ Logged in another window' : ack.kind === 'snooze' ? '⏰ Snoozed in another window' : '👋 Dismissed in another window';
          const detail = s.nextAt !== null ? `Next sip at ${clockTime(s.nextAt)} in every window` : 'Reminders are paused';
          this.mascot.closeWithNote(title, detail);
        } else {
          this.mascot.hide(); // moved to the window you're using
        }
      }
      if (mine && this.notifiedDueAt !== s.dueAt) {
        this.notifiedDueAt = s.dueAt;
        this.showNotification(s.dueAt);
      }
    }
    this.syncDesktopPopup(mine);
    this.render();
  }

  /**
   * While you're away from VS Code (no window focused), the window that owns the
   * reminder also puts it on your screen as an OS popup. Answering there works
   * like answering in VS Code; coming back to VS Code closes it.
   */
  private syncDesktopPopup(mine: boolean): void {
    const s = this.state;
    const mode = this.config.desktopPopup;
    const focused = vscode.window.state.focused;

    if (this.desktop && (!mine || this.desktop.dueAt !== s.dueAt || (mode === 'whenAway' && focused) || mode === 'never')) {
      this.closeDesktopPopup(); // answered elsewhere, moved, or you're back in VS Code
    }
    if (!mine || this.desktop || mode === 'never' || s.dueAt === null) {
      return;
    }
    // Wait a moment after losing focus: switching to another VS Code window moves
    // the reminder there instead (that window claims it within a second).
    if (mode === 'whenAway' && (focused || Date.now() - this.blurredAt < 2000)) {
      return;
    }

    const dueAt = s.dueAt;
    const buddy = this.buddyFor(dueAt);
    const handle = showDesktopPopup({
      title: 'Water time!',
      name: buddy.name,
      line: pick(buddy.lines).replace(/^💧\s*/u, ''),
      count: s.stats.count,
      goal: this.config.dailyGoal,
      progress: `Today: ${s.stats.count} / ${this.config.dailyGoal} water breaks`,
      snoozeLabel: `Snooze ${this.config.snoozeMinutes} min`,
      imagePath: vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mascots', `${buddy.id}.png`).fsPath,
      intervalMinutes: this.config.intervalMinutes,
    });
    if (!handle) {
      return;
    }
    const entry = { handle, dueAt };
    this.desktop = entry;
    handle.result.then(
      (answer) => {
        if (this.desktop === entry) {
          this.desktop = undefined;
        }
        if (answer) {
          // Same path as the in-editor buttons: logs once, clears every window.
          this.run('desktop popup', () => this.acknowledge(answer, dueAt));
        }
      },
      (err) => this.logError('desktop popup', err),
    );
  }

  private closeDesktopPopup(): void {
    const d = this.desktop;
    this.desktop = undefined;
    d?.handle.close();
  }

  /** The buddy for a given reminder; "Surprise me" keeps one pick per reminder. */
  /**
   * The chosen buddy. It lives in the shared state file (so every window agrees
   * instantly); the hydrateBuddy.mascot setting is the fallback.
   */
  private mascotChoice(): string {
    const chosen = this.state.mascot;
    return chosen !== null && isMascotChoice(chosen) ? chosen : this.config.mascot;
  }

  private buddyFor(dueAt: number | null): Mascot {
    if (this.mascotChoice() !== RANDOM_MASCOT) {
      return getMascot(this.mascotChoice());
    }
    if (!this.randomPick || this.randomPick.dueAt !== dueAt) {
      this.randomPick = { dueAt, mascot: resolveMascot(RANDOM_MASCOT) };
    }
    return this.randomPick.mascot;
  }

  async chooseMascot(): Promise<void> {
    type Item = vscode.QuickPickItem & { id: string };
    const items: Item[] = [
      ...MASCOTS.map((m) => ({
        id: m.id,
        label: `${m.id === this.mascotChoice() ? '$(check) ' : ''}${m.name}`,
        description: m.theme,
        detail: `${m.description}  “${m.lines[0]}”`,
      })),
      {
        id: RANDOM_MASCOT,
        label: `${this.mascotChoice() === RANDOM_MASCOT ? '$(check) ' : ''}🎲 Surprise me`,
        description: 'Random',
        detail: 'A different buddy for every reminder.',
      },
    ];
    const choice = await vscode.window.showQuickPick(items, {
      title: 'Hydrate Buddy: choose your buddy',
      placeHolder: 'Who should remind you to drink water?',
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (choice) {
      await this.setMascot(choice.id);
    }
  }

  async setMascot(id: string): Promise<void> {
    if (!isMascotChoice(id)) {
      throw new Error(`Unknown buddy "${id}"`);
    }
    this.state = await this.store.update((s) => chooseMascotState(s, id));
    this.randomPick = undefined;
    try {
      // Keep the Settings UI in step. This can fail in a window whose extension was
      // updated without a reload (the new setting isn't registered there yet), and
      // that's fine: the shared state above is what reminders use.
      await updateSetting('mascot', id);
    } catch (err) {
      this.log.appendLine(`[${new Date().toISOString()}] Buddy saved; settings not updated: ${err instanceof Error ? err.message : String(err)}`);
    }
    const name = id === RANDOM_MASCOT ? 'a surprise buddy' : getMascot(id).name;
    vscode.window.setStatusBarMessage(`💧 ${name} will remind you to drink water.`, 4000);
    this.render();
  }

  private showNotification(dueAt: number | null): void {
    const snoozeLabel = `Snooze ${this.config.snoozeMinutes} min`;
    const buddy = this.buddyFor(dueAt);
    vscode.window
      .showInformationMessage(`💧 ${buddy.name}: ${pick(buddy.lines)}`, 'I Drank Water', snoozeLabel, 'Dismiss')
      .then(
        (choice) => {
          const ack: Ack = choice === 'I Drank Water' ? 'drank' : choice === snoozeLabel ? 'snooze' : 'dismiss';
          // expectDueAt makes a late click a no-op if another window already handled this reminder.
          this.run('notification', () => this.acknowledge(ack, dueAt));
        },
        (err) => this.logError('notification', err),
      );
  }

  private onMascotAction(action: MascotAction): void {
    const dueAt = this.shownDueAt;
    this.run(`mascot action "${action}"`, () => this.acknowledge(action, dueAt));
  }

  private onDashboardMessage(msg: DashboardMessage): void {
    const handle = async (): Promise<void> => {
      switch (msg.type) {
        case 'drank': return this.logDrink();
        case 'remindNow': return this.remindNow();
        case 'toggle': return this.toggle();
        case 'reset': return this.resetToday(true);
        case 'setInterval': return this.setIntervalMinutes(msg.minutes);
        case 'setMascot': return this.setMascot(msg.id);
        case 'chooseMascot': return this.chooseMascot();
        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${this.context.extension.id}`);
          return;
      }
    };
    this.run(`dashboard "${msg.type}"`, handle, true);
  }

  private render(): void {
    const s = this.state;
    this.statusBar.update({
      windows: Math.max(1, activeWindowCount(s, Date.now())),
      nextAt: s.nextAt,
      visible: this.config.showStatusBar,
      enabled: this.config.enabled,
      status: statusOf(s),
      remainingMs: s.nextAt === null ? undefined : Math.max(0, s.nextAt - Date.now()),
      count: s.stats.count,
      goal: this.config.dailyGoal,
    });
    this.dashboard.refresh();
  }

  private dashboardState(): DashboardViewState {
    const s = this.state;
    return {
      enabled: this.config.enabled,
      status: statusOf(s),
      count: s.stats.count,
      goal: this.config.dailyGoal,
      intervalMinutes: this.config.intervalMinutes,
      nextAt: s.nextAt ?? undefined,
      lastDrankAt: s.stats.lastDrankAt,
      windows: Math.max(1, activeWindowCount(s, Date.now())),
      week: lastNDays(s.stats, new Date(), 7),
      month: lastNDays(s.stats, new Date(), 28),
      streak: goalStreak(s.stats, new Date(), this.config.dailyGoal),
      mascot: this.mascotChoice(),
      snoozeMinutes: this.config.snoozeMinutes,
    };
  }

  private run(where: string, fn: () => Promise<void> | void, notify = false): void {
    try {
      Promise.resolve(fn()).catch((err) => this.logError(where, err, notify));
    } catch (err) {
      this.logError(where, err, notify);
    }
  }

  private logError(where: string, err: unknown, notify = false): void {
    const message = err instanceof Error ? err.message : String(err);
    this.log.appendLine(`[${new Date().toISOString()}] Error in ${where}: ${message}`);
    if (err instanceof Error && err.stack) {
      this.log.appendLine(err.stack);
    }
    if (notify) {
      void vscode.window.showErrorMessage(`Hydrate Buddy: ${message}`);
    }
  }
}
