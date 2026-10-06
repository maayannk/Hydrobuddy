# 💧 Hydrate Buddy: water reminders for developers

**You ship code for hours and forget to drink water.** Hydrate Buddy fixes that with a small animated mascot that pops up beside your editor when it's time for a sip. It doesn't take your keyboard focus, and it waits until you answer.

> 🦸 Captain Hydro: *"With great code comes great thirst."*

## Why developers like it

- **Doesn't interrupt you.** The buddy opens in a side panel without taking focus, so you can finish your line of code first.
- **Keyboard first.** Press <kbd>Enter</kbd> for "I drank water", <kbd>S</kbd> to snooze and <kbd>Esc</kbd> to dismiss.
- **Reaches you outside VS Code.** If you're in a browser, chat or a meeting when it's water time, a small popup appears on top of whatever you're using. Click **I Drank Water** there and it's logged.
- **Works across all your windows.** With five VS Code windows open, you still get one timer and one reminder. Answer it in any window and it clears everywhere.
- **Private.** No account, no backend, no telemetry. Everything stays on your machine.
- **Lightweight.** No runtime dependencies. One small timer per window.

## Pick your buddy 🎭

Choose who reminds you: run **Hydrate Buddy: Choose Your Buddy** from the Command Palette, or click one in the dashboard.

| Buddy | Style | Says things like… |
| --- | --- | --- |
| 💧 **Drip** | Classic | "Hydration check! Time for a sip." |
| 🦸 **Captain Hydro** | Superhero | "Every hero needs a refill. Sip up!" |
| 🐾 **Splashy** | Pocket monster | "Splashy used HYDRATE! It is super effective!" |
| 🐉 **Ember** | Fantasy dragon | "Water is coming. Take a sip." |
| 🦆 **Quackers** | Rubber duck | "Explain your bug to me… right after a sip of water." |
| 🤖 **Bit** | Robot | "BEEP BOOP. Coolant level low. Refill required." |
| 🐱 **Mochi** | Dev cat | "I sat on your keyboard so you would take a water break." |
| 🎲 **Surprise me** | Random | A different buddy every time |

Every reminder also includes a code-style one-liner, like `while (coding) { sip(); }`.

## Dashboard

Open it with **Hydrate Buddy: Show Dashboard**, or click the `💧 23:11` countdown in the status bar. It shows:

- **Stat tiles:** today's progress, the next reminder (countdown and clock time), your goal streak 🔥, and time since your last sip.
- **`hydrate status`:** a terminal-style summary of the same numbers.
- **Hydration graph:** a GitHub-style grid of your last 4 weeks.
- **Buddy picker** and quick controls: change the interval, pause or resume, and reset today's count.

## Commands

| Command | What it does |
| --- | --- |
| `Hydrate Buddy: Show Dashboard` | Opens the dashboard |
| `Hydrate Buddy: Choose Your Buddy` | Picks your mascot |
| `Hydrate Buddy: Remind Me Now` | Shows the reminder right away |
| `Hydrate Buddy: I Drank Water` | Logs a water break and restarts the timer |
| `Hydrate Buddy: Snooze Reminder` | Snoozes the current reminder |
| `Hydrate Buddy: Enable / Disable Reminders` | Pauses or resumes reminders |
| `Hydrate Buddy: Set Reminder Interval` | Changes how often you're reminded |
| `Hydrate Buddy: Reset Today's Count` | Sets today's count back to 0 |

You can bind any of these to a keyboard shortcut. For example, map `hydrateBuddy.logWater` to log a sip without touching the mouse.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `hydrateBuddy.enabled` | `true` | Turn reminders on or off |
| `hydrateBuddy.intervalMinutes` | `45` | Minutes between reminders (1–480) |
| `hydrateBuddy.snoozeMinutes` | `5` | Minutes to wait when you snooze (1–120) |
| `hydrateBuddy.dailyGoal` | `8` | Water breaks you aim for each day |
| `hydrateBuddy.mascot` | `drip` | `drip`, `hero`, `splashy`, `ember`, `duck`, `robot`, `cat` or `random` |
| `hydrateBuddy.desktopPopup` | `whenAway` | `whenAway`: also pop up on your desktop when no VS Code window is focused. `always`: pop up on the desktop every time. `never`: remind only inside VS Code |
| `hydrateBuddy.reminderStyle` | `mascot` | `mascot` (animated buddy) or `notification` (plain VS Code notification) |
| `hydrateBuddy.showStatusBar` | `true` | Show the countdown in the status bar |

## FAQ

**Will it steal focus while I'm typing?**
No. The buddy opens beside your editor without taking focus. It shakes to get your attention, but your cursor stays where it was.

**I have several VS Code windows open. Will I get several popups?**
No. All windows share one timer, and the reminder appears only in the window you're using. Answering it anywhere clears it everywhere, and the next reminder is counted from that answer.

**I'm not in VS Code when the reminder fires. Will I miss it?**
No. When no VS Code window is focused, the reminder also appears as a small popup on top of the app you're using, with the same buttons. On Windows it doesn't take your keyboard focus, so you won't answer it by accident while typing. Set `hydrateBuddy.desktopPopup` to `never` to turn it off.

**Where is my data stored?**
In `~/.hydrate-buddy` on your machine. Nothing is ever sent anywhere.

**Are these official Marvel, Pokémon or Game of Thrones characters?**
No. All the buddies are original characters made for Hydrate Buddy, inspired by those genres.

## Contributing

Bug reports and ideas are welcome. To build and test from source, see `CONTRIBUTING.md` in the source code.

## License

MIT
