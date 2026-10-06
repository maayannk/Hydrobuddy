import * as vscode from 'vscode';
import { isMascotChoice } from './webview/mascots';

export const SECTION = 'hydrateBuddy';

export type ReminderStyle = 'mascot' | 'notification';
export type DesktopPopupMode = 'whenAway' | 'always' | 'never';

export interface HydrateConfig {
  enabled: boolean;
  intervalMinutes: number;
  snoozeMinutes: number;
  dailyGoal: number;
  reminderStyle: ReminderStyle;
  showStatusBar: boolean;
  /** Mascot id, or "random". */
  mascot: string;
  desktopPopup: DesktopPopupMode;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function desktopMode(v: unknown): DesktopPopupMode {
  // Tests set this so they never pop windows up on the developer's screen.
  if (process.env.HYDRATE_BUDDY_NO_DESKTOP_POPUP) {
    return 'never';
  }
  return v === 'always' || v === 'never' ? v : 'whenAway';
}

export function readConfig(): HydrateConfig {
  const c = vscode.workspace.getConfiguration(SECTION);
  const style = c.get<string>('reminderStyle');
  return {
    enabled: c.get<boolean>('enabled', true),
    intervalMinutes: clamp(c.get('intervalMinutes'), 1, 480, 45),
    snoozeMinutes: clamp(c.get('snoozeMinutes'), 1, 120, 5),
    dailyGoal: Math.round(clamp(c.get('dailyGoal'), 1, 50, 8)),
    reminderStyle: style === 'notification' ? 'notification' : 'mascot',
    showStatusBar: c.get<boolean>('showStatusBar', true),
    mascot: isMascotChoice(c.get('mascot')) ? (c.get('mascot') as string) : 'drip',
    desktopPopup: desktopMode(c.get('desktopPopup')),
  };
}

export async function updateSetting(key: keyof HydrateConfig, value: unknown): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);
}
