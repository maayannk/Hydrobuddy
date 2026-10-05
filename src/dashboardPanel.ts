import * as vscode from 'vscode';
import { DashboardViewState, renderDashboardHtml } from './webview/dashboardHtml';

export type DashboardMessage =
  | { type: 'drank' | 'remindNow' | 'toggle' | 'openSettings' | 'reset' }
  | { type: 'setInterval'; minutes: number };

const SIMPLE: ReadonlySet<string> = new Set(['drank', 'remindNow', 'toggle', 'openSettings', 'reset']);

function parseMessage(raw: unknown): DashboardMessage | 'ready' | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const msg = raw as { type?: unknown; minutes?: unknown };
  if (msg.type === 'ready') {
    return 'ready';
  }
  if (typeof msg.type === 'string' && SIMPLE.has(msg.type)) {
    return { type: msg.type } as DashboardMessage;
  }
  if (msg.type === 'setInterval' && typeof msg.minutes === 'number' && Number.isFinite(msg.minutes)) {
    return { type: 'setInterval', minutes: msg.minutes };
  }
  return undefined;
}

export class DashboardPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getState: () => DashboardViewState,
    private readonly onMessage: (msg: DashboardMessage) => void,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'hydrateBuddy.dashboard',
      'Hydrate Buddy',
      vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [] },
    );
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'droplet.svg');
    panel.webview.html = renderDashboardHtml(panel.webview.cspSource);
    this.panel = panel;

    panel.webview.onDidReceiveMessage((raw: unknown) => {
      const msg = parseMessage(raw);
      if (msg === 'ready') {
        this.refresh();
      } else if (msg) {
        this.onMessage(msg);
      }
    });
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
      }
    });
  }

  /** Push fresh state to the webview (no-op if closed or hidden). */
  refresh(): void {
    if (this.panel?.visible) {
      void this.panel.webview.postMessage({ type: 'state', state: this.getState() });
    }
  }

  dispose(): void {
    const panel = this.panel;
    this.panel = undefined;
    panel?.dispose();
  }
}
