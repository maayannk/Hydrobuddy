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

/** The droplet character, shared by the reminder and the dashboard. */
export const MASCOT_SVG = `
<svg class="buddy" viewBox="0 0 120 140" role="img" aria-label="Droplet buddy">
  <defs>
    <linearGradient id="dropFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8fd8ff"/>
      <stop offset="100%" stop-color="#2f8cf0"/>
    </linearGradient>
  </defs>
  <g class="arm-left"><path d="M22 92 Q8 86 10 72" stroke="#2f8cf0" stroke-width="7" fill="none" stroke-linecap="round"/></g>
  <g class="arm-right"><path d="M98 92 Q114 84 110 68" stroke="#2f8cf0" stroke-width="7" fill="none" stroke-linecap="round"/></g>
  <path class="body" d="M60 6 C60 6 18 58 18 90 A42 42 0 0 0 102 90 C102 58 60 6 60 6 Z" fill="url(#dropFill)"/>
  <ellipse cx="42" cy="66" rx="7" ry="12" fill="#ffffff" opacity="0.45" transform="rotate(-20 42 66)"/>
  <g class="eyes">
    <ellipse cx="46" cy="92" rx="5" ry="7" fill="#1b2a41"/>
    <ellipse cx="74" cy="92" rx="5" ry="7" fill="#1b2a41"/>
    <circle cx="48" cy="89" r="1.8" fill="#fff"/>
    <circle cx="76" cy="89" r="1.8" fill="#fff"/>
  </g>
  <ellipse cx="36" cy="104" rx="6" ry="3.5" fill="#ff8fab" opacity="0.7"/>
  <ellipse cx="84" cy="104" rx="6" ry="3.5" fill="#ff8fab" opacity="0.7"/>
  <path d="M52 106 Q60 114 68 106" stroke="#1b2a41" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

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

  .buddy .eyes { animation: blink 4s infinite; transform-origin: 60px 92px; }
  .buddy .arm-right { animation: wave 1.2s ease-in-out infinite; transform-origin: 98px 92px; }
  @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
  @keyframes wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-22deg); } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
