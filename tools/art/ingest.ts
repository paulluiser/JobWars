// Inbox → art/raw: accepts whatever ChatGPT gave you, with any file names.
//   art/inbox/<Any Job Name>/<any files>.png|jpg|webp   (also a sprite sheet with 3 pieces)
//   art/inbox/Arena/<any>.png
// - Folder names are matched to jobs loosely ("Fisherman", "Cook", "fire fighter").
// - Files are recognised by name if they say master/body/weapon/bust/icon/sheet, otherwise by shape:
//   wide = sprite sheet (full character | body without arm | arm + tool), tall = cutscene bust.
// - Sprite sheets are cut into master/body/weapon by finding the three separate figures.
import sharp from 'sharp';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ARENA_NAMES, DEFAULT_ARENA } from '../../src/data/arenas';
import { bbox, borderTransparency, load, removeBackground, type Img, type Rig } from './process';
import { jobIdFor } from './jobs';

const IMAGE = /\.(png|jpe?g|webp)$/i;
const arenaSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PARTS = ['master', 'body', 'weapon', 'bust', 'icon', 'sheet'] as const;
type Part = (typeof PARTS)[number];

const toPng = (img: Img, path: string) => sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } }).png().toFile(path);

function transparentCopy(img: Img): Img {
  const c = { data: Buffer.from(img.data), width: img.width, height: img.height };
  if (borderTransparency(c) < 0.6) removeBackground(c);
  return c;
}

/** Connected groups of visible pixels → the three largest figures (small bits like a fishing line join the nearest one). */
export function findFigures(img: Img, count = 3) {
  const { width: w, height: h, data } = img;
  const label = new Int32Array(w * h).fill(-1);
  const comps: { area: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  const stack: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== -1 || data[p * 4 + 3] < 40) continue;
    const id = comps.length;
    const c = { area: 0, x0: w, y0: h, x1: 0, y1: 0 };
    label[p] = id;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop()!;
      const x = q % w, y = (q - x) / w;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (label[n] === -1 && data[n * 4 + 3] >= 40) {
          label[n] = id;
          stack.push(n);
        }
      }
    }
    comps.push(c);
  }
  const order = comps.map((_, i) => i).sort((a, b) => comps[b].area - comps[a].area);
  const anchors = order.slice(0, count).sort((a, b) => comps[a].x0 - comps[b].x0);
  if (anchors.length < count || comps[anchors[anchors.length - 1]].area < comps[order[0]].area * 0.05) return null;
  // every other component joins the anchor whose horizontal span is nearest
  const owner = new Int32Array(comps.length);
  comps.forEach((c, i) => {
    const cx = (c.x0 + c.x1) / 2;
    let best = anchors[0], bd = Infinity;
    for (const a of anchors) {
      const A = comps[a];
      const d = cx < A.x0 ? A.x0 - cx : cx > A.x1 ? cx - A.x1 : 0;
      if (d < bd) { bd = d; best = a; }
    }
    owner[i] = best;
  });
  return anchors.map((a) => {
    const members = comps.map((_, i) => i).filter((i) => owner[i] === a);
    const box = { x0: w, y0: h, x1: 0, y1: 0, area: 0 };
    for (const i of members) {
      const c = comps[i];
      box.x0 = Math.min(box.x0, c.x0); box.y0 = Math.min(box.y0, c.y0);
      box.x1 = Math.max(box.x1, c.x1); box.y1 = Math.max(box.y1, c.y1);
      box.area += c.area;
    }
    // cut out only this figure's pixels (neighbours' bits inside the box stay transparent)
    const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
    const out = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const p = (y + box.y0) * w + (x + box.x0);
      // skip other figures' pixels; keep this figure's and soft anti-aliased edges (alpha < 40)
      if (label[p] !== -1 && owner[label[p]] !== a) continue;
      data.copy(out, (y * bw + x) * 4, p * 4, p * 4 + 4);
    }
    return { img: { data: out, width: bw, height: bh } as Img, area: box.area, aspect: bh / bw };
  });
}

/** Cut a 3-piece sprite sheet into master / body / weapon. Order on the sheet doesn't matter. */
export async function sliceSheet(path: string) {
  const img = transparentCopy(await load(path));
  const figs = findFigures(img, 3);
  if (!figs) return null;
  // The prompt asks for LEFT full character | MIDDLE body | RIGHT arm + tool, and ChatGPT follows it.
  // Shape alone is unreliable (a calculator or tray makes the arm piece wide), so trust the order,
  // and only swap the first two if the "full" one is clearly smaller than the "body".
  let [master, body, weapon] = figs; // findFigures returns them left → right
  if (master.area < body.area * 0.9) [master, body] = [body, master];
  return { master: master.img, body: body.img, weapon: weapon.img };
}

/**
 * Rig from master vs body: the pixels that vanished are the arm + tool. Where that region meets
 * the body is the shoulder; its far end gives the arm + tool length. Returns null if unsure.
 */
export async function autoRig(masterPath: string, bodyPath: string, height = 132): Promise<Rig | null> {
  const m = transparentCopy(await load(masterPath));
  const b = transparentCopy(await load(bodyPath));
  const mb = bbox(m, 128), bb = bbox(b, 128);
  if (!mb || !bb) return null;
  const solid = (img: Img, x: number, y: number) => x >= 0 && y >= 0 && x < img.width && y < img.height && img.data[(y * img.width + x) * 4 + 3] >= 128;

  // align the body onto the master: feet on feet, then search scale and horizontal offset so the
  // body sits inside the master's silhouette (body ⊂ master). Coarse grid on every 4th pixel.
  let best: { s: number; ox: number; oy: number; err: number } | null = null;
  const bodyPts: [number, number][] = [];
  for (let y = bb.y; y < bb.y + bb.h; y += 4) for (let x = bb.x; x < bb.x + bb.w; x += 4) if (solid(b, x, y)) bodyPts.push([x, y]);
  const masterPts: [number, number][] = [];
  for (let y = mb.y; y < mb.y + mb.h; y += 4) for (let x = mb.x; x < mb.x + mb.w; x += 4) if (solid(m, x, y)) masterPts.push([x, y]);
  // body pixels outside the master are bad; master pixels the body doesn't cover are expected
  // only for the arm + tool, so they count a little (stops a shrunken body from "fitting")
  const errFor = (s: number, ox: number, oy: number) => {
    let out = 0, uncovered = 0;
    for (const [x, y] of bodyPts) if (!solid(m, Math.round(x * s + ox), Math.round(y * s + oy))) out++;
    for (const [x, y] of masterPts) if (!solid(b, Math.round((x - ox) / s), Math.round((y - oy) / s))) uncovered++;
    return out / Math.max(1, bodyPts.length) + 0.35 * (uncovered / Math.max(1, masterPts.length));
  };
  for (let s = 0.7; s <= 1.45; s += 0.03) {
    const oy = mb.y + mb.h - (bb.y + bb.h) * s;
    const baseX = mb.x - bb.x * s;
    for (let dx = -200; dx <= 200; dx += 8) {
      const e = errFor(s, baseX + dx, oy);
      if (!best || e < best.err) best = { s, ox: baseX + dx, oy, err: e };
    }
  }
  if (best) {
    // refine around the best guess
    const c = best;
    for (let s = c.s - 0.03; s <= c.s + 0.03; s += 0.005) for (let dx = -8; dx <= 8; dx += 1) {
      const oy = mb.y + mb.h - (bb.y + bb.h) * s;
      const ox = c.ox + dx + (c.s - s) * bb.x;
      const e = errFor(s, ox, oy);
      if (e < best.err) best = { s, ox, oy, err: e };
    }
  }
  if (!best || best.err > 0.25) return null;
  const { s, ox, oy } = best;
  const bodyAt = (x: number, y: number) => solid(b, Math.round((x - ox) / s), Math.round((y - oy) / s));

  // missing region = in master, not in body (with a 2px tolerance against edge noise)
  const missing: [number, number][] = [];
  for (let y = mb.y; y < mb.y + mb.h; y += 2) for (let x = mb.x; x < mb.x + mb.w; x += 2) {
    if (!solid(m, x, y)) continue;
    if (bodyAt(x, y) || bodyAt(x + 2, y) || bodyAt(x - 2, y) || bodyAt(x, y + 2) || bodyAt(x, y - 2)) continue;
    missing.push([x, y]);
  }
  if (missing.length < 200) return null;
  // shoulder = where the missing arm meets the body. A raised arm can also touch the head or hat,
  // so use the contact points nearest the torso (body centre, about half-way up).
  const bodyH0 = bb.h * s;
  const tx = (bb.x + bb.w / 2) * s + ox, ty = (bb.y + bb.h) * s + oy - bodyH0 * 0.5;
  const contact = missing.filter(([x, y]) => bodyAt(x + 5, y) || bodyAt(x - 5, y) || bodyAt(x, y + 5) || bodyAt(x, y - 5));
  if (contact.length < 10) return null;
  contact.sort((p, q) => Math.hypot(p[0] - tx, p[1] - ty) - Math.hypot(q[0] - tx, q[1] - ty));
  const near = contact.slice(0, Math.max(10, Math.round(contact.length * 0.25)));
  let sx = 0, sy = 0;
  for (const [x, y] of near) { sx += x; sy += y; }
  sx /= near.length; sy /= near.length;
  let reach = 0;
  for (const [x, y] of missing) reach = Math.max(reach, Math.hypot(x - sx, y - sy));

  // to puppet units: body spans `height`, feet bottom-centre is the origin
  const bodyH = bb.h * s;
  const k = height / bodyH;
  const cx = (bb.x + bb.w / 2) * s + ox;
  const feet = (bb.y + bb.h) * s + oy;
  return {
    height,
    shoulder: { x: Math.round((sx - cx) * k), y: Math.round((sy - feet) * k) },
    weaponLength: Math.round(reach * k),
    weaponAngle: 0,
  };
}

async function classify(path: string, name: string): Promise<Part | null> {
  // whole words only ("Farmer" must not read as "arm")
  const lower = name.toLowerCase().replace(/\.[a-z]+$/, '');
  const word = (w: string) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(lower);
  for (const p of PARTS) if (word(p)) return p;
  if (word('arm') || word('tool') || word('weapon')) return 'weapon';
  if (word('portrait') || word('cutscene')) return 'bust';
  if (word('head') || word('face') || word('avatar')) return 'icon';
  const meta = await sharp(path).metadata();
  const r = (meta.width ?? 1) / (meta.height ?? 1);
  if (r >= 1.25) return 'sheet';
  if (r <= 0.92) return 'bust';
  return null; // square and unnamed: ambiguous
}

export interface IngestReport { lines: string[]; warnings: string[] }

/** Copy/slice everything in the inbox into art/raw/<id>/ with canonical names. */
export async function ingest(inbox: string, raw: string): Promise<IngestReport> {
  const rep: IngestReport = { lines: [], warnings: [] };
  if (!existsSync(inbox)) return rep;
  for (const d of readdirSync(inbox, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(inbox, d.name);
    const files = readdirSync(dir).filter((f) => IMAGE.test(f) && !f.startsWith('.'));
    if (!files.length) continue;
    if (/^(ui|menu|title|landing)[ _-]?(assets?|art|images?)?$/i.test(d.name) && !/^(ui|icons|emblems|ui sheet|menu)$/i.test(d.name)) {
      // a mixed folder: the emblem sheet (has transparency, ~5:4, or named so) and the posters (by shape)
      for (const f of files) {
        const m = await sharp(join(dir, f)).metadata();
        const ratio = (m.width ?? 1) / (m.height ?? 1);
        if (/emblem|sheet|icons?/i.test(f) || (m.hasAlpha && ratio > 1.05 && ratio < 1.5)) {
          mkdirSync(join(raw, 'ui'), { recursive: true });
          await sharp(join(dir, f)).png().toFile(join(raw, 'ui', 'sheet.png'));
          rep.lines.push(`${d.name}/${f} → UI emblem sheet`);
        } else {
          const kind = ratio >= 1 ? 'landscape' : 'portrait';
          mkdirSync(join(raw, 'poster'), { recursive: true });
          await sharp(join(dir, f)).png().toFile(join(raw, 'poster', `${kind}.png`));
          rep.lines.push(`${d.name}/${f} → poster (${kind})`);
        }
      }
      continue;
    }
    if (/^(poster|posters|key ?art|landing|title)$/i.test(d.name)) {
      // landscape and portrait key art, told apart by shape
      mkdirSync(join(raw, 'poster'), { recursive: true });
      for (const f of files) {
        const m = await sharp(join(dir, f)).metadata();
        const kind = (m.width ?? 1) >= (m.height ?? 1) ? 'landscape' : 'portrait';
        await sharp(join(dir, f)).png().toFile(join(raw, 'poster', `${kind}.png`));
        rep.lines.push(`${d.name}/${f} → poster (${kind})`);
      }
      continue;
    }
    if (/^(ui|icons|emblems|ui sheet|menu)$/i.test(d.name)) {
      mkdirSync(join(raw, 'ui'), { recursive: true });
      await sharp(join(dir, files[0])).png().toFile(join(raw, 'ui', 'sheet.png'));
      rep.lines.push(`${d.name}/${files[0]} → UI emblem sheet`);
      continue;
    }
    if (/^(cards?|buffs?|perks?)$|card sheet|buff icons/i.test(d.name)) {
      mkdirSync(join(raw, 'cards'), { recursive: true });
      const f = files[0];
      await sharp(join(dir, f)).png().toFile(join(raw, 'cards', 'sheet.png'));
      rep.lines.push(`${d.name}/${f} → card sheet`);
      continue;
    }
    if (/^props?$|prop sheet|items|effects/i.test(d.name)) {
      mkdirSync(join(raw, 'props'), { recursive: true });
      const f = files[0];
      await sharp(join(dir, f)).png().toFile(join(raw, 'props', 'sheet.png'));
      rep.lines.push(`${d.name}/${f} → props sheet`);
      continue;
    }
    if (/arena|stage|map|court/i.test(d.name)) {
      mkdirSync(join(raw, 'arena'), { recursive: true });
      const folderId = arenaSlug(/^arena\s*-\s*(.+)$/i.exec(d.name)?.[1] ?? '');
      const named = new Map<string, string>();
      if (!folderId) {
        for (const file of files) {
          const stem = `-${arenaSlug(file.replace(IMAGE, ''))}-`;
          const id = Object.keys(ARENA_NAMES).find((id) => stem.includes(`-${id}-`));
          if (!id) continue;
          if (named.has(id)) rep.warnings.push(`${d.name}/${file}: another image already matched arena ${id}`);
          else named.set(id, file);
        }
      }
      if (!named.size) {
        named.set(folderId || DEFAULT_ARENA, files[0]);
        if (files.length > 1) rep.warnings.push(`${d.name}: several images, used "${files[0]}" as the arena`);
      }
      for (const [id, file] of named) {
        await sharp(join(dir, file)).png().toFile(join(raw, 'arena', `${id}.png`));
        rep.lines.push(`${d.name}/${file} → arena/${id}.png`);
      }
      continue;
    }
    const id = jobIdFor(d.name);
    if (!id) {
      rep.warnings.push(`${d.name}: couldn't tell which job this folder is; rename it to the job name (e.g. "Electrician")`);
      continue;
    }
    const out = join(raw, id);
    mkdirSync(out, { recursive: true });
    for (const f of files) {
      const src = join(dir, f);
      const part = await classify(src, f);
      if (!part) {
        rep.warnings.push(`${d.name}/${f}: square image with no hint in its name; rename it to master/body/weapon/icon`);
        continue;
      }
      if (part === 'sheet') {
        const pieces = await sliceSheet(src);
        if (!pieces) {
          rep.warnings.push(`${d.name}/${f}: couldn't find 3 separate figures on the sheet; regenerate with more space between them`);
          continue;
        }
        for (const [p, img] of Object.entries(pieces)) await toPng(img, join(out, `${p}.png`));
        rep.lines.push(`${d.name}/${f} → ${id}: sheet cut into master, body, weapon`);
        continue;
      }
      const dst = join(out, `${part}.png`);
      if (extname(f).toLowerCase() === '.png') copyFileSync(src, dst);
      else await sharp(src).png().toFile(dst);
      rep.lines.push(`${d.name}/${f} → ${id}: ${part}`);
    }
  }
  return rep;
}
