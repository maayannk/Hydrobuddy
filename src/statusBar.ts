import * as vscode from 'vscode';
import { Status } from './sharedState';
import { formatCountdown } from './stats';

export interface StatusBarInfo {
  visible: boolean;
  enabled: boolean;
  status: Status;
  remainingMs: number | undefined;
  count: number;
  goal: number;
  /** VS Code windows sharing this reminder. */
  windows: number;
  nextAt: number | null;
}

export class StatusBarController implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem('hydrateBuddy.status', vscode.StatusBarAlignment.Right, 100);

  constructor() {
    this.item.name = 'Hydrate Buddy';
  }

  update(info: StatusBarInfo): void {
    if (!info.visible) {
      this.item.hide();
      return;
    }
    const today = `Today: ${info.count}/${info.goal} water breaks`;
    const sync = info.windows > 1 ? `\n🔗 Synced across ${info.windows} windows` : '';

    if (!info.enabled || info.status === 'stopped') {
      this.item.text = '$(debug-pause) 💧 Paused';
      this.item.tooltip = `Hydrate Buddy reminders are paused.\n${today}${sync}\nClick to open the dashboard.`;
      this.item.command = 'hydrateBuddy.showDashboard';
      this.item.backgroundColor = undefined;
    } else if (info.status === 'due') {
      this.item.text = '💧 Water time!';
      this.item.tooltip = `Time for a sip!\n${today}${sync}\nClick to show the reminder here.`;
      this.item.command = 'hydrateBuddy.remindNow';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      const left = formatCountdown(info.remainingMs ?? 0);
      const at = info.nextAt !== null
        ? ` (at ${new Date(info.nextAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
        : '';
      this.item.text = `💧 ${left}`;
      this.item.tooltip = `Next water break in ${left}${at}\n${today}${sync}\nClick to open the dashboard.`;
      this.item.command = 'hydrateBuddy.showDashboard';
      this.item.backgroundColor = undefined;
    }
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
