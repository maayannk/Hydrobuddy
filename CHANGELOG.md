# Changelog

## 1.3.1

- Fixed: choosing a buddy could fail with "hydrateBuddy.mascot is not a registered configuration" in a window that was updated without a reload. Your choice is now saved in Hydrate Buddy's own shared state, so it works right away and applies to every window. The setting is still updated whenever possible.

## 1.3.0

- **Choose your buddy:** 7 original mascots. Drip (classic), Captain Hydro (superhero), Splashy (pocket monster), Ember (fantasy dragon), Quackers (rubber duck), Bit (robot) and Mochi (dev cat). There's also a "Surprise me" option.
- Each buddy has its own lines, and every reminder includes a code-style one-liner.
- New command: **Hydrate Buddy: Choose Your Buddy**. There's also a buddy picker on the dashboard.
- Keyboard shortcuts on the reminder: Enter (drank), S (snooze) and Esc (dismiss).
- Redesigned dashboard: stat tiles (today, next reminder, goal streak, time since last sip), a terminal-style `hydrate status` panel and a 4-week hydration graph.
- The reminder now shows progress dots for your daily goal.

## 1.2.0

- **Answering in one window now closes the buddy in every window.** The other windows briefly show "✅ Logged in another window · Next sip at 3:45 PM" before closing.
- The next reminder is always counted from the **first** answer. Late clicks in other windows are ignored and don't count as extra drinks.
- The shared state now lives in `~/.hydrate-buddy`, so windows stay in sync across VS Code profiles and VS Code-based editors.
- Windows still running an older version are asked to reload.
- The timer restarts automatically if reminders are on but nothing is scheduled.
- New UI: a "Synced across N windows" badge on the buddy and the dashboard, the clock time of the next reminder, and synced-window info in the status bar tooltip.

## 1.1.0

- **Works across multiple VS Code windows.** All windows now share one countdown, so every window shows the same time.
- The reminder appears in **one window only**: the one you're using. If you switch windows while it's waiting, it moves with you.
- Acknowledging the reminder in any window (I Drank Water, Snooze, or Dismiss) clears it in every window and restarts the shared timer.
- Water breaks are counted once, even with several windows open.
- The buddy now **shakes** when it appears, and again every few seconds until you respond.
- Settings now apply to every window. They can no longer be set separately per workspace.

## 1.0.0

- First release.
- Animated droplet buddy reminder with **I Drank Water**, **Snooze**, and **Dismiss** buttons.
- Status bar countdown to the next water break.
- Dashboard with today's count, daily goal progress, next reminder, and a 7-day history.
- Settings for interval, snooze length, daily goal, reminder style, and status bar visibility.
- All data stored locally in VS Code's global state. No telemetry.
