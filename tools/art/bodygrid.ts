// Every body with a rig-unit grid (feet at 0,0; x right, y up as negative), the current shoulder
// in magenta: read the real shoulder off it.   npx tsx tools/art/bodygrid.ts out.png
import sharp, { type OverlayOptions } from 'sharp';
import { readFileSync } from 'node:fs';
const out = process.argv[2] ?? 'bodygrid.png';
const m = JSON.parse(readFileSync('public/art/manifest.json', 'utf8'));
const ids = Object.keys(m.characters).filter((id) => m.characters[id].body);
const S = 2.4, CW = 300, CH = 360, COLS = 6;
const cells: OverlayOptions[] = [];
for (const [i, id] of ids.entries()) {
  const c = m.characters[id];
  const meta = await sharp(`public/art/${c.body}`).metadata();
  const bh = Math.round(c.rig.height * S), bw = Math.round((meta.width! / meta.height!) * bh);
  const cx = (i % COLS) * CW + CW / 2, fy = Math.floor(i / COLS) * CH + CH - 14;
  let grid = '';
  for (let y = 0; y <= 140; y += 10) grid += `<line x1="0" x2="${CW}" y1="${fy - y * S - Math.floor(i / COLS) * CH}" y2="${fy - y * S - Math.floor(i / COLS) * CH}" stroke="${y % 50 ? '#7a8090' : '#c0c6d0'}" stroke-width="1"/>`;
  for (let x = -60; x <= 60; x += 10) grid += `<line y1="0" y2="${CH}" x1="${CW / 2 + x * S}" x2="${CW / 2 + x * S}" stroke="${x % 50 ? '#7a8090' : '#c0c6d0'}" stroke-width="1"/>`;
  cells.push({ input: Buffer.from(`<svg width="${CW}" height="${CH}">${grid}</svg>`), left: (i % COLS) * CW, top: Math.floor(i / COLS) * CH });
  cells.push({ input: await sharp(`public/art/${c.body}`).resize(bw, bh).png().toBuffer(), left: Math.round(cx - bw / 2), top: Math.round(fy - bh) });
  const sx = cx + c.rig.shoulder.x * S, sy = fy + c.rig.shoulder.y * S;
  cells.push({ input: Buffer.from(`<svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#ff00ff"/></svg>`), left: Math.round(sx - 6), top: Math.round(sy - 6) });
  cells.push({ input: Buffer.from(`<svg width="200" height="26"><text x="4" y="20" font-size="19" font-family="sans-serif" fill="#fff" font-weight="bold">${id}</text></svg>`), left: (i % COLS) * CW, top: Math.floor(i / COLS) * CH });
}
await sharp({ create: { width: CW * COLS, height: CH * Math.ceil(ids.length / COLS), channels: 4, background: '#4a505e' } }).composite(cells).png().toFile(out);
console.log(`wrote ${out}`);
