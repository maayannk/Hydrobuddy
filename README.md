# 💧 Hydrate Buddy

Long coding sessions make it easy to forget to drink water. Hydrate Buddy is a small VS Code extension that reminds you. Every so often (45 minutes by default), a little droplet character pops up beside your editor and says:

> 💧 **It's water time! Take a sip.**

Click **I Drank Water** and the buddy leaves. The timer then restarts and the buddy comes back after the next interval.

## Features

- **Animated droplet buddy.** It opens in a small panel beside your editor and doesn't take keyboard focus, so you can keep typing.
- **Three buttons:**
  - **🥤 I Drank Water** adds one to today's count and restarts the timer.
  - **⏰ Snooze** brings the reminder back after a few minutes (5 by default).
  - **Dismiss** skips this reminder and restarts the full interval.
- **Status bar countdown.** The status bar shows `💧 32:15` until the next break and `💧 Water time!` when a reminder is waiting. Click it to open the dashboard.
- **Dashboard.** Shows today's count, progress toward your daily goal, the next reminder, and the last 7 days. You can also change the interval and pause or resume reminders from here.
- **Pause and resume** at any time.
- **Private.** Everything is stored locally in VS Code. There's no backend, no account, no tracking, and no telemetry.
- **Follows your VS Code theme** (light or dark) and respects *reduced motion*.

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type **Hydrate Buddy**:

| Command | What it does |
| --- | --- |
| `Hydrate Buddy: Show Dashboard` | Opens the stats dashboard |
| `Hydrate Buddy: Remind Me Now` | Shows the reminder immediately |
| `Hydrate Buddy: I Drank Water` | Logs a water break and restarts the timer |
| `Hydrate Buddy: Snooze Reminder` | Snoozes the current reminder |
| `Hydrate Buddy: Enable / Disable Reminders` | Pauses or resumes reminders |
| `Hydrate Buddy: Set Reminder Interval` | Asks for a new interval in minutes |
| `Hydrate Buddy: Reset Today's Count` | Sets today's count back to 0 |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `hydrateBuddy.enabled` | `true` | Turn reminders on or off |
| `hydrateBuddy.intervalMinutes` | `45` | Minutes between reminders (1–480) |
| `hydrateBuddy.snoozeMinutes` | `5` | Minutes to wait when you press Snooze (1–120) |
| `hydrateBuddy.dailyGoal` | `8` | Water breaks you aim for each day |
| `hydrateBuddy.reminderStyle` | `mascot` | `mascot` (animated buddy) or `notification` (plain VS Code notification) |
| `hydrateBuddy.showStatusBar` | `true` | Show the countdown in the status bar |

Changes take effect right away. Changing the interval restarts the countdown.

## Running from source

Requirements: [Node.js](https://nodejs.org) 18+ and VS Code 1.85+.

```bash
npm install
```

Then open this folder in VS Code and press **F5** (**Run Extension**). A new *Extension Development Host* window opens with Hydrate Buddy running. The countdown appears in the status bar right away. To see the buddy without waiting, run **Hydrate Buddy: Remind Me Now**.

Tip: set `hydrateBuddy.intervalMinutes` to `1` while you're trying it out.

## Tests

```bash
npm run test:unit   # fast unit tests for the timer and stats logic (plain Node)
npm test            # full suite inside a real VS Code instance (downloads VS Code the first time)
```

## Packaging (.vsix)

```bash
npm run package
```

This creates `hydrate-buddy-1.0.0.vsix`. To install it, open the **Extensions** view, click **⋯**, choose **Install from VSIX…**, and pick the file. You can also run:

```bash
code --install-extension hydrate-buddy-1.0.0.vsix
```

To publish a new version to the Marketplace: `npx vsce login <publisher-id>` once, then `npm run publish`.

## How it works

```
src/
├── extension.ts       activate/deactivate, command registration
├── controller.ts      wires timer, stats, status bar and panels together
├── scheduler.ts       pure timer logic (no vscode import, unit-tested)
├── stats.ts           pure daily stats + midnight rollover (unit-tested)
├── config.ts          typed, clamped settings
├── statusBar.ts       status bar countdown
├── mascotPanel.ts     the droplet reminder webview
├── dashboardPanel.ts  the dashboard webview
└── webview/           HTML/CSS/SVG for the webviews (strict CSP with nonces)
```

- The timer uses a single 1-second ticker that checks a deadline based on the system clock. It doesn't rely on one long `setTimeout`, so reminders still fire correctly after your laptop wakes from sleep. The same tick updates the status bar countdown.
- The ticker is cleared when you pause reminders and when the extension deactivates.
- Closing the buddy's tab with **×** counts as **Dismiss**, so the timer never gets stuck.
- Today's count resets automatically at local midnight. Older days are kept for 30 days in VS Code's `globalState`.

## License

MIT
