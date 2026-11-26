import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { arenaArt, propTex, type ArenaArt } from './art';
import { DEFAULT_ARENA, type ArenaId } from '../data/arenas';
import { DEPTH } from './depth';
import { ARENA_H, ARENA_W } from '../sim/constants';
import type { Sim } from '../sim/sim';
import { FighterView } from './fighterView';
import { Fx } from './fx';
import type { Juice } from './juice';

export type Layout = 'landscape' | 'portrait';

/**
 * Logical canvas size and the screen rect the arena must fit into (HUD lives outside it).
 * Portrait is 1080 wide and as tall as the device allows (9:16 up to ~9:19.5 phones).
 */
export function layoutDims(layout: Layout, portraitH = 1920) {
  if (layout === 'landscape') return { w: 1920, h: 1080, arena: { x: 470, y: 125, w: 980, h: 850 } };
  const h = Math.round(portraitH);
  return { w: 1080, h, arena: { x: 30, y: 330, w: 1020, h: h - 330 - 270 } };
}

/** Portrait logical height for a viewport of this shape. */
export function portraitHeightFor(vw: number, vh: number) {
  return Math.max(1920, Math.min(2340, (1080 * vh) / Math.max(1, vw)));
}

const WALL_H = 110;

/** Pixi scene: square arena (a box the fighters bounce around in), y-sorted entities, camera. */
export class Scene {
  app!: Application;
  world = new Container();
  private floor = new Container();
  private arena?: ArenaArt;

  private entities = new Container();
  private overFx = new Container();
  private groundLayer!: Container;
  fx!: Fx;
  views: FighterView[] = [];
  layout: Layout = 'landscape';
  portraitH = 1920;
  private camX = ARENA_W / 2;
  private camY = ARENA_H / 2;
  private zoom = 1;
  focus: { x: number; y: number; zoomMul: number } | null = null;

  constructor(private juice: Juice) {}

  async init(parent: HTMLElement, layout: Layout, portraitH = 1920) {
    this.layout = layout;
    this.portraitH = portraitH;
    const L = layoutDims(layout, portraitH);
    this.app = new Application();
    await this.app.init({
      width: L.w,
      height: L.h,
      background: 0x1b2430,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: false,
    });
    this.app.canvas.id = 'game-canvas';
    parent.prepend(this.app.canvas);
    this.entities.sortableChildren = true;
    const groundFx = new Container();
    this.groundLayer = groundFx;
    this.world.addChild(this.floor, groundFx, this.entities, this.overFx);
    this.app.stage.addChild(this.world);
    this.fx = new Fx(this.app.renderer, groundFx, this.overFx);
    this.arena = arenaArt();
    this.drawArena();
    this.snapCamera();
  }

  get arenaId() {
    return this.arena?.name ?? DEFAULT_ARENA;
  }

  setArena(id: ArenaId) {
    const art = arenaArt(id) ?? arenaArt();
    if (art === this.arena) return;
    this.arena = art;
    this.drawArena();
    this.snapCamera();
  }

  setLayout(layout: Layout, portraitH = 1920) {
    if (layout === this.layout && (layout === 'landscape' || Math.round(portraitH) === Math.round(this.portraitH))) return;
    this.layout = layout;
    this.portraitH = portraitH;
    const L = layoutDims(layout, portraitH);
    this.app.renderer.resize(L.w, L.h);
    this.snapCamera();
  }

  /** Zoom + centre that fit the whole box into the layout's arena rect. */
  private fit() {
    const L = layoutDims(this.layout, this.portraitH);
    const art = this.arena;
    let worldW = ARENA_W + 90;
    let worldH = ARENA_H + WALL_H + 70;
    let cx = ARENA_W / 2;
    let cy = (-WALL_H - 10 + ARENA_H + 50) / 2;
    if (art) {
      // frame most of the painting (its walls and props), centred on the image
      const W = ARENA_W / art.floor.w, H = ARENA_H / art.floor.h;
      worldW = W * 0.94;
      worldH = H * 0.94;
      cx = -art.floor.x * W + W / 2;
      cy = -art.floor.y * H + H / 2;
    }
    const zoom = Math.min(L.arena.w / worldW, L.arena.h / (worldH * DEPTH.k));
    return { zoom, cx, cy, worldW, worldH, aw: L.arena.w, ah: L.arena.h, sx: L.arena.x + L.arena.w / 2, sy: L.arena.y + L.arena.h / 2 };
  }

  private snapCamera() {
    const f = this.fit();
    this.camX = f.cx;
    this.camY = f.cy;
    this.zoom = f.zoom;
  }

  /** Painted arena from the art pipeline when there is one, else the drawn placeholder. */
  private drawArena() {
    for (const c of this.floor.removeChildren()) c.destroy();
    const art = this.arena;
    // painted floor is wider than deep (3/4 view): squash the world instead of stretching the art
    DEPTH.k = art ? Math.max(0.55, Math.min(1, art.floor.h / art.floor.w)) : 1;
    if (art) {
      const pad = 1400;
      const bg = new Graphics().rect(-pad, -pad, ARENA_W + pad * 2, ARENA_H + pad * 2).fill(0x2c3a2a);
      // stretch the image so its floor rect (fractions of the image) lands exactly on the sim arena
      const sp = new Sprite(art.texture);
      sp.width = ARENA_W / art.floor.w;
      sp.height = ARENA_H / art.floor.h;
      sp.position.set(-art.floor.x * sp.width, -art.floor.y * sp.height);
      this.floor.addChild(bg, sp);
      return;
    }
    const g = new Graphics();
    const pad = 1400;
    g.rect(-pad, -pad, ARENA_W + pad * 2, ARENA_H + pad * 2).fill(0x2c3a2a);
    // grass speckles outside the box
    for (let i = 0; i < 900; i++) {
      const x = -pad + ((i * 7919) % (ARENA_W + pad * 2));
      const y = -pad + ((i * 104729) % (ARENA_H + pad * 2));
      if (x > -50 && x < ARENA_W + 50 && y > -WALL_H - 20 && y < ARENA_H + 50) continue;
      g.circle(x, y, 3 + (i % 5)).fill({ color: i % 2 ? 0x3d5236 : 0x24301f, alpha: 0.8 });
    }
    // back wall face (3/4 view depth)
    g.rect(-30, -WALL_H, ARENA_W + 60, WALL_H).fill(0x6b5a4a);
    for (let x = -30; x < ARENA_W + 30; x += 52) {
      for (let row = 0; row < 3; row++) {
        const off = row % 2 ? 26 : 0;
        g.rect(Math.max(-30, x + off - 24), -WALL_H + 6 + row * 34, 48, 30).fill({ color: (Math.round(x / 52) + row) % 2 ? 0x7d6a57 : 0x74624f });
      }
    }
    g.rect(-36, -WALL_H - 8, ARENA_W + 72, 12).fill(0x4d3f33);
    // floor: cobblestone tiles
    g.rect(0, 0, ARENA_W, ARENA_H).fill(0xc9b28d);
    const ts = 52;
    for (let y = 0; y < ARENA_H; y += ts) {
      for (let x = 0; x < ARENA_W; x += ts) {
        const h = ((x * 31 + y * 17) % 7) / 7;
        g.roundRect(x + 3, y + 3, Math.min(ts, ARENA_W - x) - 6, Math.min(ts, ARENA_H - y) - 6, 9).fill(h > 0.5 ? 0xd2bc98 : 0xc2a983);
      }
    }
    // centre emblem
    g.circle(ARENA_W / 2, ARENA_H / 2, 120).stroke({ width: 7, color: 0xa88f6a, alpha: 0.6 });
    g.circle(ARENA_W / 2, ARENA_H / 2, 88).stroke({ width: 3, color: 0xa88f6a, alpha: 0.5 });
    // side walls and front lip (the box)
    g.rect(-30, ARENA_H, ARENA_W + 60, 34).fill(0x5a4a3c);
    g.rect(-30, -4, 30, ARENA_H + 38).fill(0x5a4a3c);
    g.rect(ARENA_W, -4, 30, ARENA_H + 38).fill(0x5a4a3c);
    g.rect(-30, ARENA_H + 26, ARENA_W + 60, 8).fill({ color: 0x000000, alpha: 0.25 });
    // props outside the box
    const crate = (x: number, y: number) =>
      g.roundRect(x, y, 56, 50, 6).fill(0x9a6b3f).stroke({ width: 4, color: 0x2a1d14 }).moveTo(x + 4, y + 4).lineTo(x + 52, y + 46).stroke({ width: 3, color: 0x6e4a2a });
    const barrel = (x: number, y: number) => g.ellipse(x, y, 24, 30).fill(0x7c5330).stroke({ width: 4, color: 0x2a1d14 }).rect(x - 24, y - 8, 48, 6).fill(0x4a4a50);
    crate(-120, 30); crate(-112, 96); barrel(-70, ARENA_H - 60);
    crate(ARENA_W + 64, ARENA_H - 90); barrel(ARENA_W + 84, 80); barrel(ARENA_W + 134, 130);
    this.floor.addChild(g);
  }

  setFighters(sim: Sim) {
    for (const v of this.views) v.root.destroy({ children: true });
    this.views = sim.fighters.map((f) => new FighterView(f, this.fx, this.juice));
    for (const v of this.views) this.entities.addChild(v.root);
    this.fx.clear();
    for (const g of this.hazardViews.values()) g.destroy();
    this.hazardViews.clear();
    for (const sp of this.hazardProps.values()) sp.destroy();
    this.hazardProps.clear();
    this.focus = null;
    this.snapCamera();
  }

  private hazardViews = new Map<number, Graphics>();
  private hazardProps = new Map<number, Sprite>();

  /**
   * Painted body for a hazard (from the props sheet), standing on (x, y) at `size` px wide,
   * upright on the squashed floor. Returns false when there's no art, so the shape fallback draws.
   */
  private propFor(h: { id: number; kind: string }, name: string, x: number, y: number, size: number, layer: Container, o: { rot?: number; alpha?: number; anchorY?: number; scale?: number } = {}) {
    const tex = propTex(name);
    if (!tex) return false;
    let sp = this.hazardProps.get(h.id);
    if (!sp) {
      sp = new Sprite(tex);
      this.hazardProps.set(h.id, sp);
      layer.addChild(sp);
    }
    if (sp.texture !== tex) sp.texture = tex;
    sp.anchor.set(0.5, o.anchorY ?? 0.85);
    const k = (size / Math.max(tex.width, tex.height)) * (o.scale ?? 1);
    sp.scale.set(k, k / DEPTH.k);
    sp.position.set(x, y);
    sp.rotation = o.rot ?? 0;
    sp.alpha = o.alpha ?? 1;
    sp.zIndex = y + 1;
    return true;
  }
  private time = 0;

  /** Traps on the floor, hooks in flight (read straight from sim state each frame). */
  private drawHazards(sim: Sim) {
    const live = new Set<number>();
    for (const h of sim.hazards) {
      live.add(h.id);
      let g = this.hazardViews.get(h.id);
      if (!g) {
        g = new Graphics();
        this.hazardViews.set(h.id, g);
        const layer = ['trap', 'crop', 'gem', 'pipe', 'zone', 'beam'].includes(h.kind) ? this.groundLayer : ['wall', 'turret'].includes(h.kind) ? this.entities : this.overFx;
        layer.addChild(g);
      }
      g.clear();
      if (h.kind === 'trap') {
        // drop in with a bounce, charge up while arming, then crackle and blink while live
        const ARM = 0.6;
        const armed = h.age >= ARM;
        const pop = h.age < 0.25 ? 1 + Math.sin((h.age / 0.25) * Math.PI) * 0.35 : 1;
        const lift = h.age < 0.15 ? (1 - h.age / 0.15) * 40 : 0;
        const blink = armed && Math.sin(this.time * 14) > 0;
        const k = 1 / DEPTH.k; // keep the box upright on the squashed floor
        if (armed) {
          const pulse = (this.time * 1.6) % 1;
          g.ellipse(h.x, h.y, h.r * (0.6 + pulse * 0.6), h.r * 0.4 * (0.6 + pulse * 0.6) * k).stroke({ width: 3, color: 0xfff27a, alpha: 0.7 * (1 - pulse) });
        } else {
          g.arc(h.x, h.y, h.r * 0.8, -Math.PI / 2, -Math.PI / 2 + (h.age / ARM) * Math.PI * 2).stroke({ width: 4, color: 0xfff27a, alpha: 0.6 });
        }
        g.ellipse(h.x, h.y + 2, 20 * pop, 7 * pop * k).fill({ color: 0x000000, alpha: 0.25 });
        const bx = h.x, by = h.y - lift;
        if (this.propFor(h, 'trap', bx, by, 56 * pop, this.groundLayer, { alpha: h.life - h.age < 1.5 && Math.sin(this.time * 20) > 0 ? 0.5 : 1 })) {
          if (armed && Math.random() < 0.12) this.fx.sparkle(bx + (Math.random() - 0.5) * 30, by - 20 * k, 0xfff27a);
          continue;
        }
        g.roundRect(bx - 18 * pop, by - 24 * pop * k, 36 * pop, 26 * pop * k, 4).fill(0xf5c518).stroke({ width: 3, color: 0x2a1d14 });
        g.poly([bx - 4, by - 20 * k, bx - 10, by - 10 * k, bx - 2, by - 10 * k, bx - 6, by - 2 * k]).stroke({ width: 3, color: 0x2a1d14 });
        g.circle(bx + 10, by - 16 * k, 4).fill(blink ? 0xff3b30 : 0x6a1f1f);
        if (armed && this.fx && Math.random() < 0.12) this.fx.sparkle(bx + (Math.random() - 0.5) * 30, by - 20 * k, 0xfff27a);
        g.alpha = h.life - h.age < 1.5 && Math.sin(this.time * 20) > 0 ? 0.5 : 1;
      } else if (h.kind !== 'hook') {
        this.drawHazard(g, h, sim);
      } else if (h.kind === 'hook') {
        // line from the rod's real tip, sagging, to a spinning hook
        const tip = this.views[h.owner]?.point('tip') ?? { x: h.x, y: h.y };
        const hy = h.y - 50 / DEPTH.k;
        const mx = (tip.x + h.x) / 2, my = (tip.y + hy) / 2 + 30 * (1 - Math.min(1, h.age / 0.3));
        g.moveTo(tip.x, tip.y).quadraticCurveTo(mx, my, h.x, hy).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
        const a = this.time * 18;
        if (this.propFor(h, 'hook', h.x, hy, 40, this.overFx, { rot: Math.sin(this.time * 14) * 0.6, anchorY: 0.5 })) continue;
        g.circle(h.x, hy, 9).stroke({ width: 4, color: 0x9aa3ad });
        g.moveTo(h.x + Math.cos(a) * 9, hy + Math.sin(a) * 9).lineTo(h.x + Math.cos(a) * 16, hy + Math.sin(a) * 16).stroke({ width: 4, color: 0xdfe6ee });
      }
    }
    for (const [id, g] of this.hazardViews) {
      if (!live.has(id)) {
        g.destroy();
        this.hazardViews.delete(id);
      }
    }
    for (const [id, sp] of this.hazardProps) {
      if (!live.has(id)) {
        sp.destroy();
        this.hazardProps.delete(id);
      }
    }
  }

  /** M4 hazards: everything code-drawn and animated, upright on the squashed floor. */
  private drawHazard(g: Graphics, h: Sim['hazards'][number], sim: Sim) {
    const k = 1 / DEPTH.k;
    const t = this.time;
    const INK = 0x2a1d14;
    g.alpha = 1;
    switch (h.kind) {
      case 'crop': {
        const grow = Math.min(1, h.age / 6);
        if (grow < 1 ? this.propFor(h, 'sprout', h.x, h.y, 26 + 22 * grow, this.groundLayer, { rot: Math.sin(t * 3 + h.id) * 0.08 })
          : this.propFor(h, 'pumpkin', h.x, h.y, 58, this.groundLayer, { scale: 1 + Math.sin(t * 4 + h.id) * 0.04 })) break;
        g.ellipse(h.x, h.y, 22, 9).fill({ color: 0x6b4a2a, alpha: 0.8 });
        if (grow < 1) {
          const sway = Math.sin(t * 3 + h.id) * 3;
          g.moveTo(h.x, h.y).lineTo(h.x + sway, h.y - (10 + 18 * grow) * k).stroke({ width: 4, color: 0x5fa83a });
          g.ellipse(h.x + sway + 6, h.y - (8 + 18 * grow) * k, 7 * grow + 2, 4 * k).fill(0x7cc44a);
        } else {
          const bob = 1 + Math.sin(t * 4 + h.id) * 0.05;
          g.ellipse(h.x, h.y - 14 * k, 22 * bob, 18 * k * bob).fill(0xf08a24).stroke({ width: 3, color: INK });
          g.moveTo(h.x, h.y - 30 * k).lineTo(h.x + 4, h.y - 38 * k).stroke({ width: 4, color: 0x5fa83a });
        }
        break;
      }
      case 'wall': {
        const hp = h.data.hp ?? 1;
        g.ellipse(h.x, h.y, h.r + 6, (h.r + 6) * 0.4).fill({ color: 0x000000, alpha: 0.25 });
        const rise = Math.min(1, h.age / 0.2);
        if (this.propFor(h, 'wall', h.x, h.y + (1 - rise) * 30, 84, this.entities, { alpha: h.life - h.age < 1 && Math.sin(t * 20) > 0 ? 0.5 : rise })) break;
        const w = h.r * 2, H = 70 * k;
        g.ellipse(h.x, h.y, h.r + 6, (h.r + 6) * 0.4).fill({ color: 0x000000, alpha: 0.25 });
        g.rect(h.x - w / 2, h.y - H, w, H).fill(0xb5553a).stroke({ width: 4, color: INK });
        for (let row = 0; row < 4; row++) {
          const yy = h.y - H + (row + 1) * (H / 4);
          g.moveTo(h.x - w / 2, yy).lineTo(h.x + w / 2, yy).stroke({ width: 2, color: 0x7a3524 });
          const off = row % 2 ? 0 : w / 4;
          g.moveTo(h.x - w / 2 + off + w / 4, yy - H / 4).lineTo(h.x - w / 2 + off + w / 4, yy).stroke({ width: 2, color: 0x7a3524 });
        }
        if (h.age < 0.25) g.alpha = h.age / 0.25;
        if (h.life - h.age < 1 && Math.sin(t * 20) > 0) g.alpha = 0.5;
        void hp;
        break;
      }
      case 'gem': {
        const bob = Math.sin(t * 5 + h.id) * 4;
        g.ellipse(h.x, h.y, 12, 5).fill({ color: 0x000000, alpha: 0.25 });
        if (this.propFor(h, 'gem', h.x, h.y - 6 + bob, 38, this.groundLayer, { rot: Math.sin(t * 2 + h.id) * 0.15 })) {
          if (Math.random() < 0.08) this.fx.sparkle(h.x, h.y - 20 * k, 0xffffff);
          break;
        }
        g.poly([h.x, h.y - 30 * k + bob, h.x + 12, h.y - 18 * k + bob, h.x, h.y - 6 * k + bob, h.x - 12, h.y - 18 * k + bob]).fill(0x7fe3ff).stroke({ width: 3, color: INK });
        if (Math.random() < 0.08) this.fx.sparkle(h.x, h.y - 20 * k, 0xffffff);
        break;
      }
      case 'pipe': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + h.id);
        g.ellipse(h.x, h.y, 32 + 4 * pulse, 14 + 2 * pulse).stroke({ width: 2, color: 0x2a9d8f, alpha: 0.5 });
        if (this.propFor(h, 'pipe', h.x, h.y, 64, this.groundLayer, { anchorY: 0.6 })) break;
        g.ellipse(h.x, h.y, 26, 12).fill(0x264653).stroke({ width: 4, color: INK });
        g.ellipse(h.x, h.y, 17, 7).fill(0x0b1418);
        g.ellipse(h.x, h.y, 30 + 4 * pulse, 14 + 2 * pulse).stroke({ width: 2, color: 0x2a9d8f, alpha: 0.5 });
        break;
      }
      case 'turret': {
        const o = sim.fighters[h.owner];
        const tgt = sim.foeOf(o);
        const a = tgt ? Math.atan2(tgt.y - h.y, tgt.x - h.x) : 0;
        g.ellipse(h.x, h.y, 22, 9).fill({ color: 0x000000, alpha: 0.25 });
        // recoil just after each shot (shots every 0.5 s)
        const recoil = (h.data.cd ?? 0.5) > 0.42 ? 1 - ((h.data.cd ?? 0.5) - 0.42) / 0.08 : 1;
        const flipX = tgt && tgt.x < h.x ? -1 : 1;
        if (this.propFor(h, 'turret', h.x - flipX * (1 - recoil) * 4, h.y, 62, this.entities, { alpha: Math.min(1, h.age / 0.25) })) {
          const sp = this.hazardProps.get(h.id)!;
          sp.scale.x = Math.abs(sp.scale.x) * flipX;
          break;
        }
        g.rect(h.x - 4, h.y - 26 * k, 8, 26 * k).fill(0x5b7083).stroke({ width: 2, color: INK });
        g.circle(h.x, h.y - 30 * k, 14).fill(0x9aa3ad).stroke({ width: 3, color: INK });
        g.moveTo(h.x, h.y - 30 * k).lineTo(h.x + Math.cos(a) * 26, h.y - 30 * k + Math.sin(a) * 26 * DEPTH.k).stroke({ width: 7, color: INK });
        g.circle(h.x, h.y - 30 * k, 4).fill(Math.sin(t * 10) > 0 ? 0xff3b30 : 0x6a1f1f);
        if (h.age < 0.25) g.alpha = h.age / 0.25;
        break;
      }
      case 'beam': {
        // target warning that tightens until the beam lands
        const p = Math.min(1, h.age / h.life);
        g.ellipse(h.x, h.y, h.r * (1.4 - 0.4 * p), h.r * 0.45 * (1.4 - 0.4 * p)).stroke({ width: 4, color: 0xff3b30, alpha: 0.5 + 0.5 * p });
        g.ellipse(h.x, h.y, h.r * 0.95, h.r * 0.42).fill({ color: 0xff3b30, alpha: 0.12 + 0.2 * p });
        const by = h.y - 380 * (1 - p * p) * k - 40 * k;
        if (this.propFor(h, 'beam', h.x, by + 20 * k, 110, this.overFx, { rot: Math.sin(t * 6) * 0.05 })) break;
        g.rect(h.x - 46, by - 12, 92, 24).fill(0x9aa3ad).stroke({ width: 4, color: INK });
        g.rect(h.x - 46, by - 4, 92, 8).fill({ color: 0x5b6470 });
        break;
      }
      case 'zone': {
        const COLORS = [0x6fc3ff, 0x80ff9a, 0xe63946, 0x3a86ff, 0xffd23f];
        const col = COLORS[h.data.type ?? 0] ?? 0xffffff;
        const fade = Math.min(1, h.age / 0.2) * Math.min(1, (h.life - h.age) / 0.4);
        const wob = 1 + Math.sin(t * 4 + h.id) * 0.03;
        g.ellipse(h.x, h.y, h.r * wob, h.r * 0.45 * wob).fill({ color: col, alpha: 0.28 * fade }).stroke({ width: 3, color: col, alpha: 0.7 * fade });
        if (Math.random() < 0.15 * fade) {
          if (h.data.type === 1) this.fx.bubble(h.x + (Math.random() - 0.5) * h.r, h.y, col);
          else this.fx.sparkle(h.x + (Math.random() - 0.5) * h.r * 1.4, h.y + (Math.random() - 0.5) * h.r * 0.5, col);
        }
        if (h.data.type === 1 && this.propFor(h, 'acid', h.x, h.y, h.r * 2.1, this.groundLayer, { anchorY: 0.5, alpha: 0.85 * fade, scale: wob })) break;
        if (h.data.type === 0 && this.propFor(h, 'wetSign', h.x + h.r * 0.7, h.y, 46, this.groundLayer, { alpha: fade })) break;
        if (h.data.type === 0 && h.age < 5) {
          // little yellow caution sign
          g.poly([h.x + h.r * 0.7, h.y - 30 * k, h.x + h.r * 0.7 - 12, h.y, h.x + h.r * 0.7 + 12, h.y]).fill(0xffd60a).stroke({ width: 2, color: INK });
        }
        break;
      }
      case 'tray': {
        const a = t * 16;
        if (this.propFor(h, 'tray', h.x, h.y - 30 * k, 52, this.overFx, { anchorY: 0.5, rot: a * 0.3, scale: 0.6 + 0.4 * Math.abs(Math.cos(a)) })) break;
        g.ellipse(h.x, h.y - 30 * k, 20, 20 * Math.abs(Math.cos(a)) + 3).fill(0xdfe6ee).stroke({ width: 3, color: INK });
        break;
      }
      case 'ball': {
        const a = t * 20;
        if (this.propFor(h, 'ball', h.x, h.y - 24 * k, 38, this.overFx, { anchorY: 0.5, rot: a })) break;
        g.circle(h.x, h.y - 24 * k, h.r).fill(0xffffff).stroke({ width: 3, color: INK });
        g.moveTo(h.x + Math.cos(a) * h.r, h.y - 24 * k + Math.sin(a) * h.r).lineTo(h.x - Math.cos(a) * h.r, h.y - 24 * k - Math.sin(a) * h.r).stroke({ width: 2, color: 0xe63946 });
        break;
      }
      case 'grenade': {
        // lobbed arc
        const p = Math.min(1, h.age / h.life);
        const hy = h.y - Math.sin(p * Math.PI) * 120 * k - 20 * k;
        g.ellipse(h.x, h.y, 10, 4).fill({ color: 0x000000, alpha: 0.25 });
        if (this.propFor(h, 'grenade', h.x, hy, 36, this.overFx, { anchorY: 0.5, rot: p * 10 })) break;
        g.circle(h.x, hy, 10).fill(0x3d4a2a).stroke({ width: 3, color: INK });
        g.circle(h.x + 6, hy - 8, 3).fill(Math.sin(t * 30) > 0 ? 0xff3b30 : 0xffd23f);
        g.ellipse(h.x, h.y, 10, 4).fill({ color: 0x000000, alpha: 0.25 });
        break;
      }
    }
    if (h.kind === 'wall' || h.kind === 'turret') g.zIndex = h.y;
  }

  render(sim: Sim, alpha: number, dt: number, simDt: number) {
    this.time += dt;
    for (const v of this.views) v.update(alpha, dt, simDt);
    this.drawHazards(sim);
    this.fx.update(dt);

    // camera: the whole box is always in view; KO pushes in on the loser
    const fit = this.fit();
    let tx = fit.cx, ty = fit.cy, tz = fit.zoom;
    if (this.focus) {
      tx = this.focus.x;
      ty = this.focus.y;
      tz = fit.zoom * this.focus.zoomMul;
      // keep the painted arena filling the frame: never pan past its edges
      const hw = Math.max(0, fit.worldW / 2 - fit.aw / 2 / tz), hh = Math.max(0, fit.worldH / 2 - fit.ah / 2 / (tz * DEPTH.k));
      tx = Math.max(fit.cx - hw, Math.min(fit.cx + hw, tx));
      ty = Math.max(fit.cy - hh, Math.min(fit.cy + hh, ty));
    }
    const k = 1 - Math.exp(-dt * (this.focus ? 6 : 4));
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.zoom += (tz - this.zoom) * k;

    const j = this.juice;
    const z = this.zoom * (1 + j.punch);
    this.world.pivot.set(this.camX, this.camY);
    this.world.position.set(fit.sx + j.shakeX, fit.sy + j.shakeY);
    this.world.scale.set(z, z * DEPTH.k);
    this.world.rotation = j.shakeRot;
  }
}
