import * as vscode from 'vscode';
import { MascotViewState, renderMascotHtml } from './webview/mascotHtml';

export type MascotAction = 'drank' | 'snooze' | 'dismiss';
const ACTIONS: ReadonlySet<string> = new Set<MascotAction>(['drank', 'snooze', 'dismiss']);

/**
 * The little droplet buddy. Opens in a small panel beside the editor without
 * stealing keyboard focus, and goes away once the user responds.
 */
export class MascotPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onAction: (action: MascotAction) => void,
  ) {}

  isVisible(): boolean {
    return this.panel !== undefined;
  }

  show(state: MascotViewState): void {
    if (this.panel) {
      this.panel.webview.html = renderMascotHtml(this.panel.webview.cspSource, state);
      this.panel.reveal(undefined, true);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'hydrateBuddy.mascot',
      'Water time!',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, localResourceRoots: [] },
    );
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'droplet.svg');
    panel.webview.html = renderMascotHtml(panel.webview.cspSource, state);
    this.panel = panel;

    panel.webview.onDidReceiveMessage((msg: unknown) => {
      const type = (msg as { type?: unknown } | undefined)?.type;
      if (typeof type === 'string' && ACTIONS.has(type)) {
        this.hide();
        this.onAction(type as MascotAction);
      }
    });

    // Closing the tab with the "x" counts as a dismiss so the timer never gets stuck.
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
        this.onAction('dismiss');
      }
    });
  }

  hide(): void {
    const panel = this.panel;
    this.panel = undefined;
    panel?.dispose();
  }

  /**
   * The reminder was answered in another window: show a short note in the buddy's
   * bubble, then close. Closing this way never counts as a dismiss.
   */
  closeWithNote(title: string, detail: string, delayMs = 1800): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    this.panel = undefined;
    void panel.webview.postMessage({ type: 'handled', title, detail });
    setTimeout(() => panel.dispose(), delayMs);
  }

  dispose(): void {
    this.hide();
  }
}
