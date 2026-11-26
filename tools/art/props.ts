// Grid sheets (one ChatGPT image each) → named sprites:
//  - props: 6 × 5 grid, art/PROMPTS_PROPS.md → public/art/props/
//  - cards: 10 × 9 grid, art/PROMPTS_CARDS.md → public/art/cards/ (82 card icons + 8 card effects)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { borderTransparency, load, removeBackground, type Img } from './process';

/** Grid order, left → right, top → bottom (matches the prompt's numbering 1–30). */
export const PROP_NAMES = [
  'wall', 'turret', 'trap', 'pipe', 'sprout', 'pumpkin',
  'hook', 'tray', 'ball', 'grenade', 'beam', 'gem',
  'truck', 'plane', 'fish', 'wreckingBall', 'boulder', 'gavel',
  'dish', 'coins', 'potion', 'parcelBomb', 'needle', 'flask',
  'fire', 'water', 'lightning', 'dust', 'wetSign', 'acid',
] as const;
export const sliceProps = (sheetPath: string, outDir: string, size = 256) => sliceGrid(sheetPath, outDir, PROP_NAMES, 6, 5, 'props', size);

/**
 * Cut a cols × rows sheet into named sprites (names in grid order, left → right, top → bottom):
 * every blob of pixels belongs to the cell its centre falls in, so a sprite that spills over a
 * cell edge stays whole. Returns { name: "<folder>/<name>.webp" } for the manifest.
 */
export async function sliceGrid(sheetPath: string, outDir: string, names: readonly string[], COLS: number, ROWS: number, folder: string, size = 256, opts: { defringe?: (cell: number) => 'icon' | 'glow' } = {}) {
  const img: Img = await load(sheetPath);
  if (borderTransparency(img) < 0.6) removeBackground(img);
  const { width: w, height: h, data } = img;
  const cw = w / COLS, ch = h / ROWS;
  if (opts.defringe) defringe(img, (x, y) => opts.defringe!(Math.min(ROWS - 1, Math.floor(y / ch)) * COLS + Math.min(COLS - 1, Math.floor(x / cw))));
  const label = new Int32Array(w * h).fill(-1);
  const cellOf: number[] = [];
  const blobN: number[] = [], blobX: number[] = [], blobY: number[] = [], blobBox: [number, number, number, number][] = [];
  const stack: number[] = [];
  let id = 0;
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== -1 || data[p * 4 + 3] < 30) continue;
    let sx = 0, sy = 0, n = 0, bx0 = w, by0 = h, bx1 = 0, by1 = 0;
    label[p] = id;
    stack.push(p);
    const members: number[] = [];
    while (stack.length) {
      const q = stack.pop()!;
      members.push(q);
      const x = q % w, y = (q - x) / w;
      sx += x; sy += y; n++;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      for (const nb of [q - 1, q + 1, q - w, q + w]) {
        if (nb < 0 || nb >= w * h || label[nb] !== -1 || data[nb * 4 + 3] < 30) continue;
        if ((nb === q - 1 && x === 0) || (nb === q + 1 && x === w - 1)) continue;
        label[nb] = id;
        stack.push(nb);
      }
    }
    const col = Math.min(COLS - 1, Math.floor(sx / n / cw)), row = Math.min(ROWS - 1, Math.floor(sy / n / ch));
    cellOf[id] = row * COLS + col;
    blobN[id] = n; blobX[id] = sx / n; blobY[id] = sy / n; blobBox[id] = [bx0, by0, bx1, by1];
    id++;
  }
  // a tiny fragment hugging a cell's edge is spill from the neighbouring icon, not part of this one
  const biggest: number[] = [];
  for (let b = 0; b < id; b++) biggest[cellOf[b]] = Math.max(biggest[cellOf[b]] ?? 0, blobN[b]);
  for (let b = 0; b < id; b++) {
    const c = cellOf[b], cx = (c % COLS) * cw, cy = Math.floor(c / COLS) * ch;
    const [x0, y0, x1, y1] = blobBox[b];
    const edge = Math.min(x0 - cx, cx + cw - x1, y0 - cy, cy + ch - y1) / Math.min(cw, ch);
    if (blobN[b] < biggest[c] * 0.1 && edge < 0.05) cellOf[b] = -1;
  }
  mkdirSync(outDir, { recursive: true });
  const out: Record<string, string> = {};
  for (let c = 0; c < COLS * ROWS; c++) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let p = 0; p < w * h; p++) {
      if (label[p] === -1 || cellOf[label[p]] !== c) continue;
      const x = p % w, y = (p - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) continue;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const buf = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const p = (y + y0) * w + (x + x0);
      // keep this cell's pixels and soft unlabeled edges; drop neighbours that spill in
      if (label[p] !== -1 && cellOf[label[p]] !== c) continue;
      data.copy(buf, (y * bw + x) * 4, p * 4, p * 4 + 4);
    }
    const name = names[c];
    if (!name) continue;
    await sharp(buf, { raw: { width: bw, height: bh, channels: 4 } })
      .resize(size, size, { fit: 'inside' }).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(join(outDir, `${name}.webp`));
    out[name] = `${folder}/${name}.webp`;
  }
  return out;
}

/**
 * Clean the halo an image generator leaves around cut-out sprites: faint semi-transparent pixels
 * (often tinted red or rainbow) are dropped, and the remaining soft edge pixels take their colour
 * from the nearest solid pixel, so the anti-aliasing stays but the tint goes. Glow sprites keep
 * their soft falloff (only the very faintest pixels go).
 */
function defringe(img: Img, kindAt: (x: number, y: number) => 'icon' | 'glow') {
  const { width: w, height: h, data } = img;
  const src = Buffer.from(data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const a = src[i + 3];
    if (a === 0 || a >= 250) continue;
    const glow = kindAt(x, y) === 'glow';
    if (a < (glow ? 18 : 70)) {
      data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
      continue;
    }
    if (glow) continue;
    // nearest solid neighbour within 3 px gives the edge its true colour
    let best = -1, bd = 99;
    for (let r = 1; r <= 3 && best < 0; r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (ny * w + nx) * 4;
        if (src[j + 3] < 250) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = j; }
      }
    if (best >= 0) {
      data[i] = src[best];
      data[i + 1] = src[best + 1];
      data[i + 2] = src[best + 2];
    }
  }
}
