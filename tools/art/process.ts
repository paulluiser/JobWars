// Art pipeline: art/raw/<id>/*.png (straight from ChatGPT) → public/art/ + manifest.json
//   npm run art                      process art/raw into public/art
//   npm run art -- --raw X --out Y   custom folders (used by tests)
import sharp, { type Sharp } from 'sharp';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Rig {
  /** body height in puppet units (the placeholder chibi is ~130) */
  height: number;
  /** shoulder pivot in puppet units relative to the feet (x forward, y up = negative) */
  shoulder: { x: number; y: number };
  /** drawn length of the arm+tool piece in puppet units */
  weaponLength: number;
  /** extra rest angle for the arm (radians) */
  weaponAngle: number;
  /** where the shoulder is on the arm + tool image, as fractions (default: bottom centre) */
  pivot?: { x: number; y: number };
}

export const DEFAULT_RIG: Rig = { height: 132, shoulder: { x: 10, y: -58 }, weaponLength: 100, weaponAngle: 0 };
export const DEFAULT_FLOOR = { x: 0.16, y: 0.26, w: 0.68, h: 0.6 };

export interface Img { data: Buffer; width: number; height: number }

const TARGET = {
  body: { height: 512 },
  weapon: { height: 768 },
  bust: { height: 1200 },
  icon: { size: 256 },
  arena: { size: 1024 },
};

export async function load(path: string): Promise<Img> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const idx = (img: Img, x: number, y: number) => (y * img.width + x) * 4;

/** Share of border pixels that are already transparent. */
export function borderTransparency(img: Img) {
  let t = 0, n = 0;
  const check = (x: number, y: number) => {
    n++;
    if (img.data[idx(img, x, y) + 3] < 32) t++;
  };
  for (let x = 0; x < img.width; x += 2) { check(x, 0); check(x, img.height - 1); }
  for (let y = 0; y < img.height; y += 2) { check(0, y); check(img.width - 1, y); }
  return t / n;
}

/**
 * Remove a flat or checkerboard background: find the 1–2 dominant border colours,
 * flood-fill from the edges through pixels close to them, then soften the cut edge.
 */
export function removeBackground(img: Img, tol = 30): number {
  const { width: w, height: h, data } = img;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const sample = (x: number, y: number) => {
    const i = idx(img, x, y);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  };
  let total = 0;
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); total += 2; }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); total += 2; }
  const bg = [...buckets.values()].sort((a, b) => b.n - a.n).filter((e, i) => i === 0 || e.n / total > 0.12).slice(0, 2)
    .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
  const dist = (i: number) => Math.min(...bg.map(([r, g, b]) => Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b)));

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (dist(p * 4) <= tol) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  let removed = 0;
  const cleared = new Uint8Array(w * h);
  while (stack.length) {
    const p = stack.pop()!;
    data[p * 4 + 3] = 0;
    cleared[p] = 1;
    removed++;
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // soften: opaque pixels touching the cleared area and still close-ish to the bg get partial alpha
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (cleared[p]) continue;
      if (!(cleared[p - 1] || cleared[p + 1] || cleared[p - w] || cleared[p + w])) continue;
      const d = dist(p * 4);
      if (d < tol * 2) data[p * 4 + 3] = Math.min(data[p * 4 + 3], Math.round(255 * ((d - tol) / tol)));
    }
  }
  return removed / (w * h);
}

/** Bounding box of visible pixels. */
export function bbox(img: Img, alphaMin = 12) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[idx(img, x, y) + 3] >= alphaMin) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** grid order of the UI emblem sheet (art/PROMPTS_UI.md) */
export const UI_NAMES = [
  'mode-pvp', 'mode-story', 'mode-cpu', 'trophy', 'loader-badge',
  'rank-intern', 'rank-associate', 'rank-specialist', 'rank-manager', 'rank-director',
  'rank-executive', 'rank-ceo', 'district-1', 'district-2', 'district-3',
  'district-4', 'district-5', 'district-6', 'star', 'lock',
];

const toSharp = (img: Img) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } });
// WebP keeps the alpha edge crisp at a fraction of PNG's size (busts went from ~400 KB to ~60 KB)
const pngOut = (s: Sharp) => s.webp({ quality: 86, alphaQuality: 90, effort: 6, smartSubsample: true });
const EXT = 'webp';

export interface ProcessReport {
  files: { src: string; out: string; bgRemoved: number; size: [number, number]; warnings: string[] }[];
  warnings: string[];
}

interface Manifest {
  version: 1;
  stamp: number;
  characters: Record<string, { body?: string; weapon?: string; bust?: string; icon?: string; rig: Rig }>;
  arenas: Record<string, { src: string; floor: typeof DEFAULT_FLOOR }>;
  props: Record<string, string>;
  cards?: Record<string, string>;
  poster?: { landscape?: string; portrait?: string };
  ui?: Record<string, string>;
}

async function clean(path: string, warnings: string[], allowBottom = false) {
  const img = await load(path);
  let bgRemoved = 0;
  if (borderTransparency(img) < 0.6) {
    bgRemoved = removeBackground(img);
    if (bgRemoved < 0.05) warnings.push('background is not transparent and could not be removed: regenerate with a transparent or plain background');
  }
  const box = bbox(img);
  if (!box) throw new Error(`${path}: image is empty after background removal`);
  for (const [edge, hit] of [['left', box.x === 0], ['top', box.y === 0], ['right', box.x + box.w === img.width], ['bottom', box.y + box.h === img.height]] as const)
    if (hit && !(allowBottom && edge === 'bottom')) warnings.push(`touches the ${edge} edge: may be cropped`);
  return { img, box, bgRemoved };
}

export async function processArt(opts: { raw: string; out: string; rigPath?: string; knownIds?: string[] }): Promise<ProcessReport> {
  const report: ProcessReport = { files: [], warnings: [] };
  const rigs: Record<string, Partial<Rig>> = opts.rigPath && existsSync(opts.rigPath) ? JSON.parse(readFileSync(opts.rigPath, 'utf8')) : {};
  const manifest: Manifest = { version: 1, stamp: Date.now(), characters: {}, arenas: {}, props: {} };
  mkdirSync(opts.out, { recursive: true });
  // the output folder is fully owned by this script: drop art for ids that are no longer in raw
  const rawIds = existsSync(opts.raw) ? new Set(readdirSync(opts.raw, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) : new Set<string>();
  for (const d of readdirSync(opts.out, { withFileTypes: true })) if (d.isDirectory() && !rawIds.has(d.name)) rmSync(join(opts.out, d.name), { recursive: true });
  if (!existsSync(opts.raw)) {
    report.warnings.push(`no raw folder at ${opts.raw}`);
    writeFileSync(join(opts.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return report;
  }

  for (const id of readdirSync(opts.raw, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const dir = join(opts.raw, id);
    const outDir = join(opts.out, id);
    mkdirSync(outDir, { recursive: true });
    // drop outputs from older runs (e.g. PNGs from before the switch to WebP)
    for (const f of readdirSync(outDir)) if (!f.endsWith(`.${EXT}`)) rmSync(join(outDir, f));

    if (id === 'poster') {
      // key art: landscape 1920 wide, portrait 1080 wide (title screen, menu, link previews)
      manifest.poster = {};
      for (const kind of ['landscape', 'portrait'] as const) {
        const src = join(dir, `${kind}.png`);
        if (!existsSync(src)) continue;
        const out = join(outDir, `${kind}.${EXT}`);
        await sharp(src).resize({ width: kind === 'landscape' ? 1920 : 1080, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(out);
        manifest.poster[kind] = `poster/${kind}.${EXT}`;
        report.files.push({ src, out, bgRemoved: 0, size: [0, 0], warnings: [] });
      }
      continue;
    }

    if (id === 'ui') {
      // one 5 × 4 sheet → menu mode emblems, rank insignia, district emblems (art/PROMPTS_UI.md)
      const sheet = readdirSync(dir).find((f) => f.endsWith('.png'));
      if (sheet) {
        const { sliceGrid } = await import('./props');
        manifest.ui = await sliceGrid(join(dir, sheet), outDir, UI_NAMES, 5, 4, 'ui', 192, { defringe: () => 'icon' });
        const n = Object.keys(manifest.ui).length;
        report.files.push({ src: join(dir, sheet), out: `${outDir}/ (${n} UI emblems)`, bgRemoved: 0, size: [192, 192], warnings: n < UI_NAMES.length ? [`only ${n} of ${UI_NAMES.length} emblems found`] : [] });
      }
      continue;
    }

    if (id === 'cards') {
      // one 10 × 9 sheet → 82 card icons + 8 card effects (art/PROMPTS_CARDS.md)
      const sheet = readdirSync(dir).find((f) => f.endsWith('.png'));
      if (sheet) {
        const { sliceGrid } = await import('./props');
        const { CARD_ART_NAMES } = await import('./cardnames');
        manifest.cards = await sliceGrid(join(dir, sheet), outDir, CARD_ART_NAMES, 10, 9, 'cards', 192, {
          defringe: (cell) => (CARD_ART_NAMES[cell]?.startsWith('fx-') ? 'glow' : 'icon'),
        });
        const n = Object.keys(manifest.cards).length;
        report.files.push({ src: join(dir, sheet), out: `${outDir}/ (${n} card images)`, bgRemoved: 0, size: [192, 192], warnings: n < CARD_ART_NAMES.length ? [`only ${n} of ${CARD_ART_NAMES.length} card images found`] : [] });
      }
      continue;
    }

    if (id === 'props') {
      // one 6 × 5 sheet → 30 named prop sprites
      const sheet = readdirSync(dir).find((f) => f.endsWith('.png'));
      if (sheet) {
        const { sliceProps } = await import('./props');
        manifest.props = await sliceProps(join(dir, sheet), outDir);
        report.files.push({ src: join(dir, sheet), out: `${outDir}/ (${Object.keys(manifest.props).length} props)`, bgRemoved: 0, size: [256, 256], warnings: Object.keys(manifest.props).length < 30 ? [`only ${Object.keys(manifest.props).length} of 30 props found`] : [] });
      }
      continue;
    }

    if (id === 'arena') {
      for (const f of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
        const name = f.replace(/\.png$/, '');
        const outF = `${name}.${EXT}`;
        const warnings: string[] = [];
        const img = await load(join(dir, f));
        await pngOut(toSharp(img).resize(TARGET.arena.size, TARGET.arena.size, { fit: 'cover' })).toFile(join(outDir, outF));
        const r = (rigs as any).arenas?.[name];
        manifest.arenas[name] = { src: `arena/${outF}`, floor: { ...DEFAULT_FLOOR, ...(r?.floor ?? {}) } };
        report.files.push({ src: join(dir, f), out: join(outDir, outF), bgRemoved: 0, size: [TARGET.arena.size, TARGET.arena.size], warnings });
      }
      continue;
    }

    if (opts.knownIds && !opts.knownIds.includes(id)) report.warnings.push(`art/raw/${id}: not a roster id (${opts.knownIds.join(', ')})`);
    const has = (f: string) => existsSync(join(dir, `${f}.png`));
    // rig: hand-tuned values in art/rig.json win; otherwise measure it from master vs body
    let rig: Rig = { ...DEFAULT_RIG, ...(rigs[id] ?? {}) } as Rig;
    if (!rigs[id] && has('master') && has('body')) {
      const { autoRig } = await import('./ingest');
      const auto = await autoRig(join(dir, 'master.png'), join(dir, 'body.png'));
      if (auto) {
        rig = auto;
        report.warnings.push(`${id}: auto-rigged (shoulder ${auto.shoulder.x},${auto.shoulder.y}, arm+tool ${auto.weaponLength}); fine-tune on /rig.html if needed`);
      } else report.warnings.push(`${id}: couldn't auto-rig from master vs body; using defaults, align it on /rig.html`);
    }
    const entry: Manifest['characters'][string] = { rig };

    for (const part of ['body', 'weapon', 'bust'] as const) {
      if (!has(part)) continue;
      const warnings: string[] = [];
      // busts are meant to be cut off at the bottom; body/weapon end exactly at the feet/shoulder
      const { img, box, bgRemoved } = await clean(join(dir, `${part}.png`), warnings, part !== 'body' ? true : false);
      if (part === 'weapon' && box.w > box.h * 0.8) warnings.push('weapon is wider than it is tall: it should be drawn vertical (shoulder at the bottom, tool pointing up)');
      if (part === 'body' && box.h < box.w * 0.9) warnings.push('body is wider than it is tall: is the front arm/tool still in the picture?');
      const pad = Math.round(Math.max(box.w, box.h) * 0.02);
      // sharp always runs extend after resize, so pad first into a buffer, then resize
      const padded = await toSharp(img).extract({ left: box.x, top: box.y, width: box.w, height: box.h })
        .extend({ top: pad, bottom: part === 'body' || part === 'weapon' ? 0 : pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer();
      const H = TARGET[part].height;
      const outPath = join(outDir, `${part}.${EXT}`);
      const buf = await pngOut(sharp(padded).resize({ height: H })).toBuffer({ resolveWithObject: true });
      writeFileSync(outPath, buf.data);
      entry[part] = `${id}/${part}.${EXT}`;
      report.files.push({ src: join(dir, `${part}.png`), out: outPath, bgRemoved, size: [buf.info.width, buf.info.height], warnings });
    }

    // icon: provided, or cropped from the top of the bust
    const iconOut = join(outDir, `icon.${EXT}`);
    if (has('icon')) {
      const warnings: string[] = [];
      const { img, box, bgRemoved } = await clean(join(dir, 'icon.png'), warnings);
      await pngOut(toSharp(img).extract({ left: box.x, top: box.y, width: box.w, height: box.h })
        .resize(TARGET.icon.size, TARGET.icon.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })).toFile(iconOut);
      entry.icon = `${id}/icon.${EXT}`;
      report.files.push({ src: join(dir, 'icon.png'), out: iconOut, bgRemoved, size: [TARGET.icon.size, TARGET.icon.size], warnings });
    } else if (entry.bust) {
      const bust = sharp(join(outDir, `bust.${EXT}`));
      const meta = await bust.metadata();
      const side = Math.round(Math.min(meta.width!, meta.height! * 0.55));
      await pngOut(sharp(join(outDir, `bust.${EXT}`)).extract({ left: Math.round((meta.width! - side) / 2), top: Math.round(meta.height! * 0.02), width: side, height: side })
        .resize(TARGET.icon.size, TARGET.icon.size)).toFile(iconOut);
      entry.icon = `${id}/icon.${EXT}`;
      report.files.push({ src: '(cropped from bust)', out: iconOut, bgRemoved: 0, size: [TARGET.icon.size, TARGET.icon.size], warnings: [] });
    }

    if (!entry.body !== !entry.weapon) report.warnings.push(`${id}: needs BOTH body.png and weapon.png to replace the placeholder puppet`);
    manifest.characters[id] = entry;
  }

  writeFileSync(join(opts.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return report;
}
