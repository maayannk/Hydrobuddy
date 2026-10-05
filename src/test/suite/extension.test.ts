import * as assert from 'assert';
import * as vscode from 'vscode';
import type { HydrateBuddyApi } from '../../extension';

const EXTENSION_ID = 'hydrate-buddy.hydrate-buddy';

async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

suite('Hydrate Buddy extension', () => {
  let api: HydrateBuddyApi;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension<HydrateBuddyApi>(EXTENSION_ID);
    assert.ok(ext, 'extension should be installed');
    api = await ext.activate();
    await vscode.commands.executeCommand('hydrateBuddy.resetToday', { confirm: false });
  });

  suiteTeardown(async () => {
    const cfg = vscode.workspace.getConfiguration('hydrateBuddy');
    await cfg.update('enabled', undefined, vscode.ConfigurationTarget.Global);
    await cfg.update('intervalMinutes', undefined, vscode.ConfigurationTarget.Global);
    await cfg.update('reminderStyle', undefined, vscode.ConfigurationTarget.Global);
  });

  test('registers all commands', async () => {
    const all = await vscode.commands.getCommands(true);
    for (const id of [
      'hydrateBuddy.showDashboard',
      'hydrateBuddy.remindNow',
      'hydrateBuddy.logWater',
      'hydrateBuddy.snooze',
      'hydrateBuddy.toggle',
      'hydrateBuddy.setInterval',
      'hydrateBuddy.resetToday',
    ]) {
      assert.ok(all.includes(id), `missing command ${id}`);
    }
  });

  test('starts running with the default 45 minute interval', () => {
    const s = api.snapshot();
    assert.strictEqual(s.enabled, true);
    assert.strictEqual(s.status, 'running');
    assert.strictEqual(s.intervalMinutes, 45);
    assert.ok(s.remainingMs !== undefined && s.remainingMs <= 45 * 60_000);
  });

  test('remindNow shows the mascot, and drinking hides it and restarts the timer', async () => {
    await vscode.commands.executeCommand('hydrateBuddy.remindNow');
    let s = api.snapshot();
    assert.strictEqual(s.status, 'due');
    assert.strictEqual(s.reminderVisible, true);

    const before = s.count;
    await vscode.commands.executeCommand('hydrateBuddy.logWater');
    s = api.snapshot();
    assert.strictEqual(s.count, before + 1);
    assert.strictEqual(s.status, 'running');
    assert.strictEqual(s.reminderVisible, false);
  });

  test('snooze hides the reminder and schedules a short countdown', async () => {
    await vscode.commands.executeCommand('hydrateBuddy.remindNow');
    await vscode.commands.executeCommand('hydrateBuddy.snooze');
    const s = api.snapshot();
    assert.strictEqual(s.status, 'running');
    assert.strictEqual(s.reminderVisible, false);
    assert.ok(s.remainingMs !== undefined && s.remainingMs <= 5 * 60_000);
  });

  test('changing the interval setting restarts the countdown', async () => {
    await vscode.workspace.getConfiguration('hydrateBuddy').update('intervalMinutes', 10, vscode.ConfigurationTarget.Global);
    await waitFor(() => api.snapshot().intervalMinutes === 10);
    const s = api.snapshot();
    assert.ok(s.remainingMs !== undefined && s.remainingMs <= 10 * 60_000);
  });

  test('toggle disables and re-enables reminders', async () => {
    await vscode.commands.executeCommand('hydrateBuddy.toggle');
    await waitFor(() => !api.snapshot().enabled);
    assert.strictEqual(api.snapshot().status, 'stopped');

    await vscode.commands.executeCommand('hydrateBuddy.toggle');
    await waitFor(() => api.snapshot().enabled);
    assert.strictEqual(api.snapshot().status, 'running');
  });

  test('resetToday sets the count back to zero', async () => {
    await vscode.commands.executeCommand('hydrateBuddy.logWater');
    await vscode.commands.executeCommand('hydrateBuddy.resetToday', { confirm: false });
    assert.strictEqual(api.snapshot().count, 0);
  });

  test('dashboard opens without errors', async () => {
    await vscode.commands.executeCommand('hydrateBuddy.showDashboard');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
