import * as vscode from 'vscode';
import { HydrateConfig, readConfig, SECTION, updateSetting } from './config';
import { DashboardMessage, DashboardPanel } from './dashboardPanel';
import { MascotAction, MascotPanel } from './mascotPanel';
import { Clock, ReminderScheduler, SchedulerState, systemClock } from './scheduler';
import { dayKey, HydrationStats, lastNDays, normalizeStats, recordDrink, resetToday } from './stats';
import { StatusBarController } from './statusBar';
import { DashboardViewState } from './webview/dashboardHtml';

export const STATS_KEY = 'hydrateBuddy.stats';
const MINUTE = 60_000;

/** Read-only snapshot, also exposed to tests through the extension API. */
export interface HydrateSnapshot {
  enabled: boolean;
  status: SchedulerState;
  intervalMinutes: number;
  remainingMs: number | undefined;
  count: number;
  goal: number;
  reminderVisible: boolean;
}

export class HydrateBuddy implements vscode.Disposable {
  private config: HydrateConfig;
  private stats: HydrationStats;
  private readonly scheduler: ReminderScheduler;
  private readonly statusBar = new StatusBarController();
  private readonly mascot: MascotPanel;
  private readonly dashboard: DashboardPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private notificationOpen = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: vscode.OutputChannel,
    private readonly clock: Clock = systemClock,
  ) {
    this.config = readConfig();
    this.stats = normalizeStats(context.globalState.get(STATS_KEY), new Date(clock.now()));

    this.scheduler = new ReminderScheduler(
      this.config.intervalMinutes * MINUTE,
      {
        onDue: () => this.presentReminder(),
        onTick: () => this.onTick(),
        onError: (err) => this.logError('scheduler callback', err),
      },
      clock,
    );
    this.mascot = new MascotPanel(context.extensionUri, (a) => this.onMascotAction(a));
    this.dashboard = new DashboardPanel(context.extensionUri, () => this.dashboardState(), (m) => this.onDashboardMessage(m));

    this.disposables.push(
      this.statusBar,
      this.mascot,
      this.dashboard,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(SECTION)) {
          this.applyConfig(readConfig());
        }
      }),
    );

    if (this.config.enabled) {
      this.scheduler.start();
    }
    this.render();
  }

  // ---------------------------------------------------------------- public API

  snapshot(): HydrateSnapshot {
    return {
      enabled: this.config.enabled,
      status: this.scheduler.getState(),
      intervalMinutes: this.config.intervalMinutes,
      remainingMs: this.scheduler.getRemainingMs(),
      count: this.stats.count,
      goal: this.config.dailyGoal,
      reminderVisible: this.mascot.isVisible() || this.notificationOpen,
    };
  }

  showDashboard(): void {
    this.dashboard.show();
  }

  /** Show the reminder right away (also re-opens it if it's already due). */
  remindNow(): void {
    if (this.config.enabled) {
      this.scheduler.triggerNow();
    } else {
      this.presentReminder();
    }
  }

  logDrink(): void {
    const before = this.stats.count;
    this.stats = recordDrink(this.stats, this.now());
    this.saveStats();
    this.mascot.hide();
    if (this.config.enabled) {
      this.scheduler.restart();
    }
    const goal = this.config.dailyGoal;
    const msg = before < goal && this.stats.count >= goal
      ? `🎉 Daily goal reached: ${this.stats.count}/${goal}! Great job.`
      : `💧 Nice! ${this.stats.count}/${goal} water breaks today.`;
    vscode.window.setStatusBarMessage(msg, 4000);
    this.render();
  }

  snooze(): void {
    this.mascot.hide();
    if (this.config.enabled) {
      this.scheduler.snooze(this.config.snoozeMinutes * MINUTE);
      vscode.window.setStatusBarMessage(`⏰ Snoozed for ${this.config.snoozeMinutes} min`, 3000);
    }
    this.render();
  }

  dismiss(): void {
    this.mascot.hide();
    if (this.config.enabled) {
      this.scheduler.restart();
    }
    this.render();
  }

  async toggle(): Promise<void> {
    await updateSetting('enabled', !this.config.enabled);
    // onDidChangeConfiguration applies the change; apply eagerly too in case the event is delayed.
    this.applyConfig(readConfig());
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
    this.applyConfig(readConfig());
  }

  async resetToday(confirm = true): Promise<void> {
    if (confirm) {
      const choice = await vscode.window.showWarningMessage("Reset today's water-break count to 0?", 'Reset');
      if (choice !== 'Reset') {
        return;
      }
    }
    this.stats = resetToday(this.stats, this.now());
    this.saveStats();
    this.render();
  }

  dispose(): void {
    this.scheduler.dispose();
    for (const d of this.disposables.splice(0)) {
      try {
        d.dispose();
      } catch (err) {
        this.logError('dispose', err);
      }
    }
  }

  // ------------------------------------------------------------------ internals

  private now(): Date {
    return new Date(this.clock.now());
  }

  private applyConfig(next: HydrateConfig): void {
    const prev = this.config;
    this.config = next;

    if (prev.enabled !== next.enabled) {
      if (next.enabled) {
        this.scheduler.setIntervalMs(next.intervalMinutes * MINUTE);
        this.scheduler.start();
      } else {
        this.scheduler.stop();
        this.mascot.hide();
      }
    } else if (prev.intervalMinutes !== next.intervalMinutes) {
      // Restarts the countdown with the new interval if currently running.
      this.scheduler.setIntervalMs(next.intervalMinutes * MINUTE);
    }
    this.render();
  }

  private presentReminder(): void {
    this.render();
    if (this.config.reminderStyle === 'mascot') {
      this.mascot.show({
        count: this.stats.count,
        goal: this.config.dailyGoal,
        snoozeMinutes: this.config.snoozeMinutes,
      });
      return;
    }

    if (this.notificationOpen) {
      return;
    }
    this.notificationOpen = true;
    const snoozeLabel = `Snooze ${this.config.snoozeMinutes} min`;
    vscode.window
      .showInformationMessage("💧 It's water time! Take a sip.", 'I Drank Water', snoozeLabel, 'Dismiss')
      .then(
        (choice) => {
          this.notificationOpen = false;
          // Ignore a stale notification if the reminder was already handled elsewhere.
          if (this.scheduler.getState() !== 'due' && this.config.enabled) {
            return;
          }
          if (choice === 'I Drank Water') {
            this.logDrink();
          } else if (choice === snoozeLabel) {
            this.snooze();
          } else {
            this.dismiss();
          }
        },
        (err) => {
          this.notificationOpen = false;
          this.logError('notification', err);
        },
      );
  }

  private onMascotAction(action: MascotAction): void {
    try {
      if (action === 'drank') {
        this.logDrink();
      } else if (action === 'snooze') {
        this.snooze();
      } else if (this.scheduler.getState() === 'due' || !this.config.enabled) {
        // Only a dismiss of an active reminder restarts the timer.
        this.dismiss();
      }
    } catch (err) {
      this.logError(`mascot action "${action}"`, err);
    }
  }

  private onDashboardMessage(msg: DashboardMessage): void {
    const run = async (): Promise<void> => {
      switch (msg.type) {
        case 'drank': return this.logDrink();
        case 'remindNow': return this.remindNow();
        case 'toggle': return this.toggle();
        case 'reset': return this.resetToday(true);
        case 'setInterval': return this.setIntervalMinutes(msg.minutes);
        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${this.context.extension.id}`);
          return;
      }
    };
    run().catch((err) => this.logError(`dashboard "${msg.type}"`, err, true));
  }

  private onTick(): void {
    // Roll the daily counter over at local midnight.
    if (this.stats.date !== dayKey(this.now())) {
      this.stats = normalizeStats(this.stats, this.now());
      this.saveStats();
      this.dashboard.refresh();
    }
    this.renderStatusBar();
  }

  private render(): void {
    this.renderStatusBar();
    this.dashboard.refresh();
  }

  private renderStatusBar(): void {
    this.statusBar.update({
      visible: this.config.showStatusBar,
      enabled: this.config.enabled,
      status: this.scheduler.getState(),
      remainingMs: this.scheduler.getRemainingMs(),
      count: this.stats.count,
      goal: this.config.dailyGoal,
    });
  }

  private dashboardState(): DashboardViewState {
    return {
      enabled: this.config.enabled,
      status: this.scheduler.getState(),
      count: this.stats.count,
      goal: this.config.dailyGoal,
      intervalMinutes: this.config.intervalMinutes,
      nextAt: this.scheduler.getNextAt(),
      lastDrankAt: this.stats.lastDrankAt,
      week: lastNDays(this.stats, this.now(), 7),
    };
  }

  private saveStats(): void {
    this.context.globalState.update(STATS_KEY, this.stats).then(undefined, (err) => this.logError('saving stats', err));
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
