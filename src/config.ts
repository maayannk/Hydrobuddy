import * as vscode from 'vscode';

export const SECTION = 'hydrateBuddy';

export type ReminderStyle = 'mascot' | 'notification';

export interface HydrateConfig {
  enabled: boolean;
  intervalMinutes: number;
  snoozeMinutes: number;
  dailyGoal: number;
  reminderStyle: ReminderStyle;
  showStatusBar: boolean;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
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
  };
}

export async function updateSetting(key: keyof HydrateConfig, value: unknown): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);
}
