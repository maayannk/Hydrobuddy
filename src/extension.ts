import * as vscode from 'vscode';
import { HydrateBuddy, HydrateSnapshot } from './controller';

export interface HydrateBuddyApi {
  snapshot(): HydrateSnapshot;
}

let buddy: HydrateBuddy | undefined;

export function activate(context: vscode.ExtensionContext): HydrateBuddyApi {
  const log = vscode.window.createOutputChannel('Hydrate Buddy');
  context.subscriptions.push(log);

  const instance = new HydrateBuddy(context, log);
  buddy = instance;
  context.subscriptions.push(instance);

  const register = (id: string, fn: (...args: any[]) => unknown): void => {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async (...args: any[]) => {
        try {
          await fn(...args);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.appendLine(`[${new Date().toISOString()}] Command ${id} failed: ${message}`);
          void vscode.window.showErrorMessage(`Hydrate Buddy: ${message}`);
        }
      }),
    );
  };

  register('hydrateBuddy.showDashboard', () => instance.showDashboard());
  register('hydrateBuddy.remindNow', () => instance.remindNow());
  register('hydrateBuddy.logWater', () => instance.logDrink());
  register('hydrateBuddy.snooze', () => instance.snooze());
  register('hydrateBuddy.toggle', () => instance.toggle());
  register('hydrateBuddy.setInterval', () => instance.promptForInterval());
  // Accepts an optional { confirm: false } argument (used by tests / keybindings).
  register('hydrateBuddy.resetToday', (opts?: { confirm?: boolean }) => instance.resetToday(opts?.confirm !== false));

  log.appendLine(`[${new Date().toISOString()}] Hydrate Buddy activated.`);
  return { snapshot: () => instance.snapshot() };
}

export function deactivate(): void {
  // Everything is in context.subscriptions; this just guarantees timers stop promptly.
  buddy?.dispose();
  buddy = undefined;
}
