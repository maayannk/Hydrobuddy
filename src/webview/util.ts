import * as crypto from 'crypto';

export function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/** JSON that is safe to embed inside a <script> tag. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function csp(cspSource: string, nonce: string): string {
  return [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
}

/** Base CSS that follows the active VS Code theme. */
export const BASE_CSS = `
  :root { --accent: #2f8cf0; --accent-soft: rgba(47,140,240,.14); }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 16px;
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
    color: var(--vscode-foreground); background: var(--vscode-editor-background);
  }
  button {
    font: inherit; cursor: pointer; border-radius: 8px; padding: 7px 14px;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
  }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button:focus-visible { outline: 2px solid var(--vscode-focusBorder); outline-offset: 2px; }
  .muted { color: var(--vscode-descriptionForeground); }

  .buddy .eyes { animation: blink 4s infinite; transform-box: fill-box; transform-origin: center; }
  .buddy .arm-right { animation: wave 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 100%; }
  .mono { font-family: var(--vscode-editor-font-family, monospace); }
  @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
  @keyframes wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-22deg); } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
