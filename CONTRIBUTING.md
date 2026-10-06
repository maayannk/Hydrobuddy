# Contributing to Hydrate Buddy

## Run from source

Requirements: Node.js 18+ and VS Code 1.85+.

```bash
npm install
```

Open this folder in VS Code and press **F5** (**Run Extension**). A new *Extension Development Host* window opens with the extension loaded. To see a reminder without waiting, run **Hydrate Buddy: Remind Me Now**.

## Tests

```bash
npm run test:unit   # fast unit tests (plain Node): timer rules, shared state, stats, mascots
npm test            # full suite inside a real VS Code instance (downloads VS Code the first time)
```

Integration tests use a temporary state folder (the `HYDRATE_BUDDY_STATE_DIR` environment variable), so they never touch your real reminders.

## Package and publish

```bash
npm run package     # builds hydrate-buddy-<version>.vsix
npm run publish     # after `npx vsce login <publisher-id>`
```

## How it works

```
src/
├── extension.ts       activate/deactivate, command registration
├── controller.ts      one per window: ticks every second, syncs UI with the shared state
├── sharedState.ts     pure rules for the shared reminder (due, claim, acknowledge…)
├── sharedStore.ts     ~/.hydrate-buddy/shared-state.json with a lock file
├── stats.ts           daily counts, midnight rollover, streaks
├── config.ts          typed, clamped settings
├── statusBar.ts       status bar countdown
├── mascotPanel.ts     the reminder webview
├── dashboardPanel.ts  the dashboard webview
└── webview/
    ├── mascots.ts     the buddies (inline SVG) and their lines
    ├── mascotHtml.ts  reminder UI
    └── dashboardHtml.ts
```

- **Multiple windows.** Every VS Code window runs its own copy of the extension. They share one JSON file. The first window to notice the deadline marks the reminder as due. Only the window you're using shows it, and an answer from any window clears it for all of them.
- **Webviews** use a strict Content Security Policy with nonces, so inline `style=""` attributes are blocked. Use classes, or set `element.style` from script.

## Adding a buddy

1. Add a `Mascot` to `src/webview/mascots.ts`. Use a 120×140 viewBox. Put the eyes in `<g class="eyes">` and the waving arm in `<g class="arm-right">`, and prefix gradient ids with the mascot id.
2. Add its id, label and description to `hydrateBuddy.mascot` in `package.json`.
3. Run `npm run test:unit`. A test checks that the two lists match.

Characters must be original. Don't add copyrighted or trademarked characters.
