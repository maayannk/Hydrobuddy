// Renders each buddy's SVG to media/mascots/<id>.png for the desktop popup,
// which can't draw SVG. Run after changing src/webview/mascots.ts:
//   npm run compile && npm run render:mascots
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { MASCOTS } = require('../out/webview/mascots.js');

const outDir = path.join(__dirname, '..', 'media', 'mascots');
fs.mkdirSync(outDir, { recursive: true });
for (const m of MASCOTS) {
  const svg = m.svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" ');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 360 } }).render().asPng();
  fs.writeFileSync(path.join(outDir, `${m.id}.png`), png);
  console.log(`media/mascots/${m.id}.png`);
}
