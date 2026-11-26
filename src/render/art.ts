import { Assets, type Texture } from 'pixi.js';
import { DEFAULT_ARENA } from '../data/arenas';

/**
 * Real art (from the pipeline in tools/art) with graceful fallback: anything missing
 * keeps using the code-drawn placeholder. public/art/manifest.json is written by `npm run art`.
 */
export interface Rig {
  height: number;
  shoulder: { x: number; y: number };
  weaponLength: number;
  weaponAngle: number;
  /** where the shoulder is on the arm + tool image, as fractions (default: bottom centre 0.5, 1) */
  pivot?: { x: number; y: number };
}
/** the sleeve at the shoulder end of the arm piece: its colour and width (texture px) */
export interface ArmBase { color: number; width: number }
export interface CharArt {
  body?: Texture;
  weapon?: Texture;
  armBase?: ArmBase;
  bustUrl?: string;
  iconUrl?: string;
  rig: Rig;
}
export interface Floor { x: number; y: number; w: number; h: number }
export interface ArenaArt { name: string; texture: Texture; floor: Floor }

interface Manifest {
  version: number;
  stamp?: number;
  characters: Record<string, { body?: string; weapon?: string; bust?: string; icon?: string; rig: Rig }>;
  arenas: Record<string, { src: string; floor: Floor }>;
  props?: Record<string, string>;
  /** gacha card icons and card effect sprites (art/PROMPTS_CARDS.md) */
  cards?: Record<string, string>;
  /** title screen key art (art/PROMPTS_UI.md) */
  poster?: { landscape?: string; portrait?: string };
  /** menu emblems: mode-*, rank-*, district-*, trophy, star, lock, loader-badge */
  ui?: Record<string, string>;
}

const BASE = `${import.meta.env.BASE_URL}art/`;
const chars = new Map<string, CharArt>();
const arenas = new Map<string, ArenaArt>();
const props = new Map<string, Texture>();
const cardUrls = new Map<string, string>();
const uiUrls = new Map<string, string>();
let posters: { landscape?: string; portrait?: string } = {};

/** loading progress for the boot screen: called with 0…1 as art arrives */
let progressCb: ((p: number) => void) | null = null;
let total = 0, done = 0;
export function onArtProgress(cb: (p: number) => void) {
  progressCb = cb;
}
function track<T>(p: Promise<T>): Promise<T> {
  total++;
  return p.finally(() => {
    done++;
    progressCb?.(done / total);
  });
}
/** warm the browser cache for a DOM image (poster, card icons) */
const preload = (url: string) => track(new Promise<void>((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = url; }));

export async function loadArt(): Promise<void> {
  chars.clear();
  arenas.clear();
  props.clear();
  cardUrls.clear();
  let m: Manifest;
  try {
    const res = await fetch(`${BASE}manifest.json?t=${Date.now()}`);
    if (!res.ok) return;
    m = await res.json();
  } catch {
    return;
  }
  const v = `?v=${m.stamp ?? 0}`;
  for (const [id, src] of Object.entries(m.cards ?? {})) cardUrls.set(id, BASE + src + v);
  for (const [id, src] of Object.entries(m.ui ?? {})) uiUrls.set(id, BASE + src + v);
  posters = Object.fromEntries(Object.entries(m.poster ?? {}).map(([k, src]) => [k, BASE + src + v]));
  // the title screen's poster and the draft's card icons should be ready the moment they show
  const warm = [...Object.values(posters), ...[...cardUrls.values()].slice(0, 90)].filter(Boolean) as string[];
  void Promise.all(warm.map(preload));
  await Promise.all(
    Object.entries(m.characters ?? {}).map(async ([id, c]) => {
      const art: CharArt = { rig: c.rig, bustUrl: c.bust && BASE + c.bust + v, iconUrl: c.icon && BASE + c.icon + v };
      if (c.body && c.weapon) {
        try {
          [art.body, art.weapon] = await Promise.all([track(Assets.load<Texture>(BASE + c.body + v)), track(Assets.load<Texture>(BASE + c.weapon + v))]);
          art.armBase = sampleArmBase(art.weapon, c.rig.pivot ?? { x: 0.5, y: 1 });
        } catch (e) {
          console.warn(`art: couldn't load ${id} sprites, using the placeholder`, e);
        }
      }
      chars.set(id, art);
    }),
  );
  await Promise.all(
    Object.entries(m.props ?? {}).map(async ([name, src]) => {
      try {
        props.set(name, await track(Assets.load<Texture>(BASE + src + v)));
      } catch {}
    }),
  );
  // card effect sprites (fx-*) from the card sheet play in the arena like props
  await Promise.all(
    Object.entries(m.cards ?? {}).filter(([id]) => id.startsWith('fx-')).map(async ([id, src]) => {
      try {
        props.set(id, await track(Assets.load<Texture>(BASE + src + v)));
      } catch {}
    }),
  );
  await Promise.all(Object.entries(m.arenas ?? {}).map(async ([name, a]) => {
    try {
      const texture = await track(Assets.load<Texture>(BASE + a.src + v));
      arenas.set(name, { name, texture, floor: a.floor });
    } catch (e) {
      console.warn(`art: couldn't load arena ${name}`, e);
    }
  }));
}

/**
 * Read the arm piece's pixels just above its pivot to find the sleeve: the cap drawn over the
 * shoulder joint takes its colour and width, so the arm reads as attached at any angle.
 */
function sampleArmBase(tex: Texture, pivot: { x: number; y: number }): ArmBase | undefined {
  try {
    const src = (tex.source as unknown as { resource: CanvasImageSource }).resource;
    const w = tex.source.pixelWidth, h = tex.source.pixelHeight;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const a = (x: number, y: number) => px[(y * w + x) * 4 + 3];
    const cx = Math.round(pivot.x * w);
    for (let y = Math.min(h - 1, Math.round(pivot.y * h) - 2); y > h * (pivot.y - 0.2); y--) {
      // the opaque run on this row closest to the pivot
      let best: [number, number] | null = null;
      for (let x = 0; x < w; x++) {
        if (a(x, y) < 200) continue;
        let x1 = x;
        while (x1 + 1 < w && a(x1 + 1, y) >= 200) x1++;
        const d = cx < x ? x - cx : cx > x1 ? cx - x1 : 0;
        if (!best || d < (cx < best[0] ? best[0] - cx : cx > best[1] ? cx - best[1] : 0)) best = [x, x1];
        x = x1;
      }
      if (!best || best[1] - best[0] < w * 0.12) continue;
      // average the sleeve colour a few rows up, skipping the dark outline
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = Math.max(0, y - Math.round(h * 0.05)); yy <= y; yy++)
        for (let x = best[0]; x <= best[1]; x++) {
          const i = (yy * w + x) * 4;
          if (px[i + 3] < 200 || px[i] + px[i + 1] + px[i + 2] < 150) continue;
          r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
        }
      if (!n) continue;
      return { color: (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n), width: best[1] - best[0] + 1 };
    }
  } catch (e) {
    console.warn('art: could not sample the arm sleeve', e);
  }
  return undefined;
}

export const charArt = (id: string) => chars.get(id);
/** painted icon for a gacha card (or a card effect sprite), if the art pipeline produced one */
export const cardArtUrl = (id: string) => cardUrls.get(id);
/** a menu emblem (mode-pvp, rank-ceo, district-3, …) if the UI sheet has been generated */
export const uiArtUrl = (id: string) => uiUrls.get(id);
/** the key-art poster for a layout (falls back to the other shape) */
export const posterUrl = (portrait: boolean) => (portrait ? posters.portrait ?? posters.landscape : posters.landscape ?? posters.portrait);
export const hasSprites = (id: string) => !!(chars.get(id)?.body && chars.get(id)?.weapon);
export const arenaArt = (id: string = DEFAULT_ARENA) => arenas.get(id);
export const arenaIds = () => [...arenas.keys()].sort();
/** a painted prop from the props sheet (wall, truck, fire, …), if the pipeline produced one */
export const propTex = (name: string | undefined) => (name ? props.get(name) : undefined);

/** Live rig tuning (rig page). */
export function setRig(id: string, rig: Rig) {
  const a = chars.get(id);
  if (a) a.rig = rig;
}
export function setFloor(id: string, floor: Floor) {
  const arena = arenas.get(id);
  if (arena) arena.floor = floor;
}
