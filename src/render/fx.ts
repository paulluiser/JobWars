import { Container, Graphics, Sprite, Text, Texture, type Renderer } from 'pixi.js';
import { DEPTH } from './depth';
import { propTex } from './art';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  grav: number;
  drag: number;
  s0: number;
  s1: number;
  a0: number;
  stretch: number;
  spin: number;
}

interface Timed {
  obj: Container;
  life: number;
  max: number;
  update: (p: number, obj: any, dt: number) => void;
}

export const FONT = '"Lilita One", "Arial Black", system-ui, sans-serif';

/** Particles, slash trails, rings, afterimages, floating text. All render-only. */
export class Fx {
  private particles: Particle[] = [];
  private pool: Sprite[] = [];
  private timed: Timed[] = [];
  private circle: Texture;
  private square: Texture;
  constructor(renderer: Renderer, readonly under: Container, readonly over: Container) {
    this.circle = renderer.generateTexture(new Graphics().circle(16, 16, 16).fill(0xffffff));
    this.square = renderer.generateTexture(new Graphics().rect(0, 0, 16, 16).fill(0xffffff));
  }

  private spawn(opts: {
    x: number; y: number; vx: number; vy: number; life: number; color: number;
    size: number; endSize?: number; grav?: number; drag?: number; alpha?: number;
    add?: boolean; stretch?: number; square?: boolean; layer?: 'under' | 'over'; spin?: number;
  }) {
    const s = this.pool.pop() ?? new Sprite();
    s.texture = opts.square ? this.square : this.circle;
    s.anchor.set(0.5);
    s.tint = opts.color;
    s.blendMode = opts.add ? 'add' : 'normal';
    s.position.set(opts.x, opts.y);
    s.rotation = 0;
    s.alpha = opts.alpha ?? 1;
    (opts.layer === 'under' ? this.under : this.over).addChild(s);
    this.particles.push({
      s, vx: opts.vx, vy: opts.vy, life: opts.life, max: opts.life,
      grav: opts.grav ?? 0, drag: opts.drag ?? 2, s0: opts.size / 32, s1: (opts.endSize ?? 0) / 32,
      a0: opts.alpha ?? 1, stretch: opts.stretch ?? 0, spin: opts.spin ?? 0,
    });
  }

  sparks(x: number, y: number, dx: number, dy: number, n: number, color: number, speed = 700) {
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * 1.6;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.18 + Math.random() * 0.2, color, size: 7 + Math.random() * 5, endSize: 1, drag: 6, grav: 900, add: true, stretch: 0.012 });
    }
  }

  burstRing(x: number, y: number, n: number, color: number, speed = 400, size = 10) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sp = speed * (0.6 + Math.random() * 0.6);
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, life: 0.3 + Math.random() * 0.2, color, size, endSize: 0, drag: 5, add: true });
    }
  }

  dust(x: number, y: number, n: number, dirx = 0, diry = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.spawn({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 8, vx: Math.cos(a) * sp + dirx * 200, vy: Math.sin(a) * sp * 0.4 + diry * 100 - 20, life: 0.4 + Math.random() * 0.35, color: 0xcbb89a, size: 14 + Math.random() * 10, endSize: 34, drag: 4, alpha: 0.55, layer: 'under' });
    }
  }

  shards(x: number, y: number, color: number, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 250 + Math.random() * 450;
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, life: 0.5 + Math.random() * 0.3, color, size: 9 + Math.random() * 7, endSize: 4, drag: 2.5, grav: 1400, square: true, spin: (Math.random() - 0.5) * 30 });
    }
  }

  bubble(x: number, y: number, color: number) {
    this.spawn({ x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 50, life: 0.7 + Math.random() * 0.4, color, size: 6 + Math.random() * 6, endSize: 10, drag: 1, alpha: 0.85 });
  }

  drip(x: number, y: number) {
    this.spawn({ x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 20, vy: 40 + Math.random() * 40, life: 0.5, color: 0x6fc3ff, size: 7, endSize: 4, grav: 600, drag: 1, alpha: 0.9 });
  }

  sparkle(x: number, y: number, color: number) {
    this.spawn({ x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 30, vx: 0, vy: -60 - Math.random() * 40, life: 0.6, color, size: 9, endSize: 0, drag: 1, add: true, square: true, spin: 6 });
  }

  ember(x: number, y: number) {
    this.spawn({ x: x + (Math.random() - 0.5) * 44, y, vx: (Math.random() - 0.5) * 50, vy: -90 - Math.random() * 90, life: 0.5 + Math.random() * 0.4, color: Math.random() < 0.5 ? 0xff9a3c : 0xffd25a, size: 6 + Math.random() * 4, endSize: 0, drag: 1.5, add: true });
  }

  /** Expanding ellipse ring (shockwave). */
  ring(x: number, y: number, color: number, radius: number, dur: number, width = 6, flat = 0.55) {
    const g = new Graphics();
    g.position.set(x, y);
    g.blendMode = 'add';
    this.over.addChild(g);
    this.timed.push({
      obj: g, life: dur, max: dur,
      update: (p, o: Graphics) => {
        const e = 1 - Math.pow(1 - p, 3);
        o.clear().ellipse(0, 0, radius * (0.2 + 0.8 * e), radius * flat * (0.2 + 0.8 * e)).stroke({ width: width * (1 - p) + 1, color, alpha: 1 - p });
      },
    });
  }

  /** Weapon slash arc in front of the attacker. */
  slash(x: number, y: number, face: number, radius: number, color: number, heavy: boolean, strength = 1) {
    const g = new Graphics();
    g.position.set(x, y);
    g.blendMode = 'add';
    this.over.addChild(g);
    const sweep = heavy ? 1.5 : 1.15;
    const dur = heavy ? 0.22 : 0.14;
    const dir = Math.cos(face) >= 0 ? 1 : -1;
    this.timed.push({
      obj: g, life: dur, max: dur,
      update: (p, o: Graphics) => {
        o.clear();
        const start = face - sweep * dir;
        const end = face + sweep * dir * (0.3 + 0.7 * Math.min(1, p * 3));
        const r = radius * (1 + p * 0.15);
        const a0 = Math.min(start, end), a1 = Math.max(start, end);
        for (let i = 0; i < 3; i++) {
          o.arc(0, 0, r - i * (heavy ? 9 : 6), a0, a1).stroke({ width: (heavy ? 16 : 10) - i * 4, color: i === 0 ? color : 0xffffff, alpha: (1 - p) * (i === 0 ? 0.7 : 0.9) * strength });
        }
        o.scale.set(1, 0.65);
      },
    });
  }

  /** Full-arena tinted flash (impact frame). */
  afterimage(draw: (g: Graphics) => void, x: number, y: number, color: number, flip: number) {
    const g = new Graphics();
    draw(g);
    g.tint = color;
    g.alpha = 0.45;
    g.position.set(x, y);
    g.scale.x = flip;
    this.under.addChild(g);
    this.timed.push({ obj: g, life: 0.22, max: 0.22, update: (p, o) => { o.alpha = 0.45 * (1 - p); } });
  }

  /** Floating combat text with pop + arc toss. */
  text(x: number, y: number, str: string, opts: { color: number; size: number; stroke?: number; dur?: number; toss?: boolean; weight?: number }) {
    const t = new Text({
      text: str,
      style: {
        fontFamily: FONT,
        fontSize: opts.size,
        fill: opts.color,
        stroke: { color: opts.stroke ?? 0x1d140d, width: Math.max(4, opts.size * 0.16), join: 'round' },
        letterSpacing: 1,
      },
      resolution: 2,
    });
    t.anchor.set(0.5);
    t.position.set(x + (Math.random() - 0.5) * 30, y);
    this.over.addChild(t);
    const dur = opts.dur ?? 0.85;
    let vx = opts.toss === false ? 0 : (Math.random() - 0.5) * 140;
    let vy = opts.toss === false ? -40 : -300;
    this.timed.push({
      obj: t, life: dur, max: dur,
      update: (p, o: Text, dt) => {
        vy += (opts.toss === false ? 0 : 750) * dt;
        o.x += vx * dt;
        o.y += vy * dt;
        const pop = p < 0.12 ? 1.5 - (p / 0.12) * 0.5 : 1;
        o.scale.set(pop, pop / DEPTH.k);
        o.alpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      },
    });
  }

  // ---------------- skill visuals ----------------

  private timedGfx(dur: number, layer: Container, update: (p: number, g: Graphics, dt: number) => void, add = false) {
    const g = new Graphics();
    if (add) g.blendMode = 'add';
    layer.addChild(g);
    this.timed.push({ obj: g, life: dur, max: dur, update });
    return g;
  }

  /** Wok fire: a fan of flames in the facing direction. */
  cone(x: number, y: number, angle: number) {
    this.propPop('fire', x + Math.cos(angle) * 60, y + Math.sin(angle) * 30, 110, 0.45, { flip: Math.cos(angle) >= 0 ? 1 : -1 });
    for (let i = 0; i < 34; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9;
      const sp = 380 + Math.random() * 420;
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 40, life: 0.35 + Math.random() * 0.25, color: Math.random() < 0.5 ? 0xff7a1a : 0xffd25a, size: 16 + Math.random() * 12, endSize: 4, drag: 3, add: true });
    }
  }

  /** Hose: a jet of droplets from a to b. */
  stream(x0: number, y0: number, x1: number, y1: number) {
    this.propPop('water', x1, y1, 80, 0.35);
    const a = Math.atan2(y1 - y0, x1 - x0);
    const d = Math.hypot(x1 - x0, y1 - y0);
    for (let i = 0; i < 14; i++) {
      const sp = d * 3 * (0.8 + Math.random() * 0.4);
      const j = (Math.random() - 0.5) * 0.18;
      this.spawn({ x: x0, y: y0, vx: Math.cos(a + j) * sp, vy: Math.sin(a + j) * sp, life: 0.3, color: Math.random() < 0.5 ? 0x7fd0ff : 0xe6f7ff, size: 10 + Math.random() * 6, endSize: 5, drag: 1.5, alpha: 0.9 });
    }
    for (let i = 0; i < 6; i++) this.drip(x1, y1);
  }

  private jagged(x0: number, y0: number, x1: number, y1: number, segs: number, amp: number) {
    const pts: number[] = [x0, y0];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const nx = -(y1 - y0), ny = x1 - x0;
      const l = Math.hypot(nx, ny) || 1;
      const o = (Math.random() - 0.5) * amp;
      pts.push(x0 + (x1 - x0) * t + (nx / l) * o, y0 + (y1 - y0) * t + (ny / l) * o);
    }
    pts.push(x1, y1);
    return pts;
  }

  /** Electric arc between two points. */
  zap(x0: number, y0: number, x1: number, y1: number) {
    this.propPop('lightning', x1, y1, 70, 0.3);
    const pts = this.jagged(x0, y0, x1, y1, 9, 40);
    this.timedGfx(0.18, this.over, (p, g) => {
      g.clear().poly(pts, false).stroke({ width: 10 * (1 - p) + 2, color: 0xfff27a, alpha: 1 - p });
      g.poly(pts, false).stroke({ width: 3, color: 0xffffff, alpha: 1 - p });
    }, true);
    this.burstRing(x1, y1, 10, 0xfff27a, 380, 8);
  }

  /** Lightning from the sky. */
  bolt(x: number, y: number) {
    this.propPop('lightning', x, y - 50, 150, 0.35);
    const pts = this.jagged(x + (Math.random() - 0.5) * 120, y - 700, x, y, 12, 70);
    this.timedGfx(0.25, this.over, (p, g) => {
      g.clear().poly(pts, false).stroke({ width: 18 * (1 - p) + 3, color: 0xbfe0ff, alpha: 1 - p });
      g.poly(pts, false).stroke({ width: 5, color: 0xffffff, alpha: 1 - p });
    }, true);
    this.ring(x, y + 40, 0xbfe0ff, 120, 0.35, 8);
    this.sparks(x, y, 0, 1, 14, 0xfff27a, 500);
  }

  /** Delivery truck sweeping across the arena at height y. */
  truck(arenaW: number, y: number, dir: number, dur: number) {
    const c = new Container();
    const tex = propTex('truck');
    if (tex) {
      const sp = new Sprite(tex);
      sp.anchor.set(0.5, 0.9);
      sp.scale.set(230 / tex.width, 230 / tex.width / DEPTH.k);
      c.addChild(sp);
    }
    const g = new Graphics();
    if (tex) g.visible = false;
    const W = 220, H = 96;
    g.roundRect(-W / 2, -H, W * 0.68, H, 10).fill(0xf08a24).stroke({ width: 5, color: 0x2a1d14 });
    g.roundRect(-W / 2 + W * 0.7, -H * 0.8, W * 0.3, H * 0.8, 12).fill(0xd06f12).stroke({ width: 5, color: 0x2a1d14 });
    g.roundRect(-W / 2 + W * 0.74, -H * 0.72, W * 0.2, H * 0.3, 6).fill(0xbfe8ff).stroke({ width: 3, color: 0x2a1d14 });
    g.roundRect(-W / 2 + 20, -H * 0.7, W * 0.4, H * 0.32, 4).fill(0xffffff);
    g.circle(-W / 2 + 40, 0, 18).circle(W / 2 - 40, 0, 18).fill(0x2a1d14);
    g.circle(-W / 2 + 40, 0, 7).circle(W / 2 - 40, 0, 7).fill(0x9aa3ad);
    c.addChild(g);
    c.scale.set(dir, 1 / DEPTH.k);
    c.position.set(dir > 0 ? -260 : arenaW + 260, y + 30);
    this.over.addChild(c);
    const x0 = c.x, x1 = dir > 0 ? arenaW + 260 : -260;
    this.timed.push({
      obj: c, life: dur, max: dur,
      update: (p, o: Container) => {
        o.x = x0 + (x1 - x0) * p;
        o.y = y + 30 + Math.sin(p * 40) * 2;
        if (Math.random() < 0.5) this.dust(o.x - dir * 100, y + 34, 1, -dir, 0);
      },
    });
  }

  /** Shadow under the target, then (via splash) the fish leaps. */
  fishShadow(x: number, y: number, dur: number) {
    this.timedGfx(dur, this.under, (p, g) => {
      g.clear().ellipse(x, y, 30 + 90 * p, 12 + 34 * p).fill({ color: 0x0b2a3a, alpha: 0.25 + 0.45 * p });
    });
  }

  splash(x: number, y: number) {
    const c = new Container();
    const fishTex = propTex('fish');
    if (fishTex) {
      const sp = new Sprite(fishTex);
      sp.anchor.set(0.5);
      sp.scale.set(190 / fishTex.width);
      c.addChild(sp);
    }
    this.propPop('water', x, y - 30, 170, 0.6, { layer: 'over' });
    const g = new Graphics();
    if (fishTex) g.visible = false;
    g.ellipse(0, 0, 90, 42).fill(0x4f7fa0).stroke({ width: 6, color: 0x2a1d14 });
    g.poly([80, 0, 140, -40, 140, 40]).fill(0x3f6a88).stroke({ width: 6, color: 0x2a1d14 });
    g.ellipse(-10, 14, 70, 18).fill(0xc9dce8);
    g.circle(-54, -10, 9).fill(0xffffff).stroke({ width: 3, color: 0x2a1d14 });
    g.circle(-56, -10, 4).fill(0x2a1d14);
    g.moveTo(-88, 8).quadraticCurveTo(-74, 18, -62, 10).stroke({ width: 4, color: 0x2a1d14 });
    c.addChild(g);
    this.over.addChild(c);
    this.timed.push({
      obj: c, life: 0.8, max: 0.8,
      update: (p, o: Container) => {
        o.position.set(x, y - Math.sin(p * Math.PI) * 220);
        o.scale.set(1, 1 / DEPTH.k);
        o.rotation = -0.9 + p * 1.8;
        o.alpha = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
      },
    });
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 300 + Math.random() * 500;
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.3, color: Math.random() < 0.5 ? 0x7fd0ff : 0xe6f7ff, size: 10 + Math.random() * 8, endSize: 4, grav: 1400, drag: 1 });
    }
    this.ring(x, y, 0x7fd0ff, 170, 0.5, 10);
  }

  /** Arena-wide darkness for the Blackout special. */
  darkness(x0: number, y0: number, w: number, h: number, dur: number) {
    this.timedGfx(dur, this.over, (p, g) => {
      const a = p < 0.08 ? p / 0.08 : p > 0.9 ? (1 - p) / 0.1 : 1;
      g.clear().rect(x0, y0, w, h).fill({ color: 0x05060c, alpha: 0.72 * a });
    });
  }

  explosion(x: number, y: number, color = 0xff8a2a, scale = 1) {
    this.propPop('fire', x, y, 170 * scale, 0.5, { rise: 30 });
    this.ring(x, y, color, 220 * scale, 0.45, 14);
    this.ring(x, y, 0xffffff, 140 * scale, 0.3, 8);
    for (let i = 0; i < 40 * scale; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 250 + Math.random() * 600;
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 120, life: 0.4 + Math.random() * 0.4, color: Math.random() < 0.5 ? color : 0xffd25a, size: 18 + Math.random() * 16, endSize: 2, drag: 3, add: true });
    }
    this.dust(x, y + 30, 10);
  }

  /** Chef eats: plate pop + golden sparkles. */
  feast(x: number, y: number, big: boolean) {
    if (this.propPop('dish', x, y - 30, big ? 90 : 64, big ? 1.1 : 0.8, { rise: 30 })) {
      for (let i = 0; i < (big ? 30 : 14); i++) this.sparkle(x, y + 60, i % 2 ? 0xffd23f : 0x6dff9a);
      return;
    }
    this.timedGfx(big ? 1 : 0.7, this.over, (p, g) => {
      const k = p < 0.2 ? p / 0.2 : 1;
      // a dish pops up above the head, bobbing, then fades
      const yy = y - 26 - p * 30 + Math.sin(p * Math.PI * 4) * 3;
      g.clear().ellipse(x, yy, 34 * k, 12 * k).fill({ color: 0xffffff, alpha: 1 - p }).stroke({ width: 3, color: 0x2a1d14, alpha: 1 - p });
      g.circle(x, yy - 8, 14 * k).fill({ color: 0xff9a3c, alpha: 1 - p });
      g.circle(x - 6 * k, yy - 13, 4 * k).fill({ color: 0x6dbf4a, alpha: 1 - p });
    });
    for (let i = 0; i < (big ? 30 : 14); i++) this.sparkle(x, y + 60, i % 2 ? 0xffd23f : 0x6dff9a);
  }

  heartbeat(x: number, y: number) {
    this.ring(x, y, 0x6dff9a, 120, 0.5, 8, 1);
    this.ring(x, y, 0xffffff, 80, 0.35, 5, 1);
    // ECG blip drawn across the chest
    this.timedGfx(0.6, this.over, (p, g) => {
      const w = 90, pts = [-w, 0, -30, 0, -18, -26, -6, 30, 6, -46, 18, 0, w, 0];
      g.clear().poly(pts.map((v, i) => (i % 2 ? y + v : x + v)), false).stroke({ width: 5, color: 0x6dff9a, alpha: 1 - p });
    }, true);
  }

  /** Ram / pull: speed streaks along an angle. */
  streaks(x: number, y: number, angle: number, color: number) {
    for (let i = 0; i < 12; i++) {
      const a = angle + Math.PI + (Math.random() - 0.5) * 0.5;
      const sp = 500 + Math.random() * 400;
      this.spawn({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.25, color, size: 8, endSize: 2, drag: 2, add: true, stretch: 0.02 });
    }
  }

  // ---------------- painted props (from the props sheet) ----------------

  /** A painted prop that pops in, holds and fades. Returns false when there's no art (caller draws a fallback). */
  propPop(name: string | undefined, x: number, y: number, size: number, dur: number, opts: { rise?: number; spin?: number; flip?: number; layer?: 'over' | 'under'; additive?: boolean } = {}) {
    const tex = propTex(name);
    if (!tex) return false;
    const sp = new Sprite(tex);
    sp.anchor.set(0.5);
    const k = size / Math.max(tex.width, tex.height);
    if (opts.additive) sp.blendMode = 'add';
    (opts.layer === 'under' ? this.under : this.over).addChild(sp);
    this.timed.push({
      obj: sp, life: dur, max: dur,
      update: (p, o: Sprite) => {
        const pop = p < 0.15 ? 0.6 + (p / 0.15) * 0.55 : p < 0.25 ? 1.15 - ((p - 0.15) / 0.1) * 0.15 : 1;
        o.scale.set(k * pop * (opts.flip ?? 1), (k * pop) / DEPTH.k);
        o.position.set(x, y - (opts.rise ?? 0) * p);
        o.rotation = (opts.spin ?? 0) * p;
        o.alpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      },
    });
    return true;
  }

  // ---------------- M4 generic cues ----------------

  /** Projectile tracer from (x0,y0) to (x1,y1): a bright streak that travels, then a pop. */
  tracer(x0: number, y0: number, x1: number, y1: number, color: number, dur = 0.15, prop?: string) {
    const tex = propTex(prop);
    if (tex) {
      // the painted object itself flies along the path, spinning, with a short trail
      const sp = new Sprite(tex);
      sp.anchor.set(0.5);
      const k = 34 / Math.max(tex.width, tex.height);
      this.over.addChild(sp);
      const fly = Math.max(0.12, dur * 1.3);
      this.timed.push({ obj: sp, life: fly, max: fly, update: (p, o: Sprite) => {
        o.position.set(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 18);
        o.scale.set(k, k / DEPTH.k);
        o.rotation = p * 9;
      } });
      this.timedGfx(fly, this.over, (p, g) => {
        const t = p, tx = x0 + (x1 - x0) * Math.max(0, t - 0.25), ty = y0 + (y1 - y0) * Math.max(0, t - 0.25);
        g.clear().moveTo(tx, ty).lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t).stroke({ width: 4, color, alpha: 0.6 });
      }, true);
      this.timed.push({ obj: new Container(), life: fly, max: fly, update: (p) => { if (p > 0.97) this.burstRing(x1, y1, 6, color, 260, 7); } });
      return;
    }
    this.timedGfx(dur + 0.08, this.over, (p, g) => {
      const t = Math.min(1, p * 1.4);
      const hx = x0 + (x1 - x0) * t, hy = y0 + (y1 - y0) * t;
      const tx = x0 + (x1 - x0) * Math.max(0, t - 0.35), ty = y0 + (y1 - y0) * Math.max(0, t - 0.35);
      g.clear().moveTo(tx, ty).lineTo(hx, hy).stroke({ width: 7, color, alpha: 0.9 * (1 - p * 0.5) });
      g.moveTo(tx, ty).lineTo(hx, hy).stroke({ width: 2.5, color: 0xffffff, alpha: 1 - p * 0.5 });
      g.circle(hx, hy, 7).fill({ color: 0xffffff, alpha: 1 - p * 0.3 });
    }, true);
    this.burstRing(x1, y1, 6, color, 260, 7);
  }

  /** Something falls from the sky onto (x,y): shadow grows, object drops, dust on landing. */
  dropObj(x: number, y: number, color: number, dur: number, prop?: string) {
    const fall = Math.max(0.05, dur);
    this.timedGfx(fall, this.under, (p, g) => {
      g.clear().ellipse(x, y, 16 + 30 * p, 6 + 12 * p).fill({ color: 0x000000, alpha: 0.2 + 0.3 * p });
    });
    const tex = propTex(prop);
    if (tex) {
      const sp = new Sprite(tex);
      sp.anchor.set(0.5, 0.85);
      const k = (prop === 'wreckingBall' || prop === 'boulder' ? 96 : 66) / Math.max(tex.width, tex.height);
      this.over.addChild(sp);
      this.timed.push({ obj: sp, life: fall + 0.25, max: fall + 0.25, update: (q, o: Sprite) => {
        const p = Math.min(1, (q * (fall + 0.25)) / fall);
        o.position.set(x, y - (420 * (1 - p * p)) / DEPTH.k);
        const sq = p >= 1 ? 1 + Math.sin(((q * (fall + 0.25) - fall) / 0.25) * Math.PI) * 0.15 : 1;
        o.scale.set(k * sq, (k / sq) / DEPTH.k);
        o.alpha = q > 0.85 ? 1 - (q - 0.85) / 0.15 : 1;
      } });
    } else {
      this.timedGfx(fall, this.over, (p, g) => {
        const yy = y - 420 * (1 - p * p) - 30;
        g.clear().circle(x, yy, 26).fill(color).stroke({ width: 4, color: 0x2a1d14 });
        g.circle(x - 8, yy - 8, 7).fill({ color: 0xffffff, alpha: 0.35 });
      });
    }
    const land = () => {
      this.dust(x, y, 8);
      this.ring(x, y, 0xffffff, 90, 0.3, 6);
      this.propPop('dust', x, y - 20, 90, 0.5, { rise: 20 });
    };
    this.timed.push({ obj: new Container(), life: fall, max: fall, update: (p) => { if (p > 0.97) land(); } });
  }

  shockwave(x: number, y: number, color: number) {
    this.ring(x, y, color, 280, 0.5, 14);
    this.ring(x, y, 0xffffff, 200, 0.35, 6);
    this.burstRing(x, y - 40, 16, color, 520, 9);
  }

  burstAt(x: number, y: number, color: number, n = 24) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 420;
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.5 + Math.random() * 0.3, color, size: 10 + Math.random() * 10, endSize: 2, grav: 700, drag: 2, square: Math.random() < 0.5, spin: 10 });
    }
    this.ring(x, y, color, 110, 0.35, 7);
  }

  /** Crossed slash marks over a target (scythe, shears, snips). */
  crossSlash(x: number, y: number, angle: number, color: number) {
    this.timedGfx(0.25, this.over, (p, g) => {
      g.clear();
      for (const k of [-1, 1]) {
        const a = angle + k * 0.8;
        const l = 70 * Math.min(1, p * 3);
        g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l).lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
          .stroke({ width: 9 * (1 - p) + 2, color, alpha: 1 - p });
      }
    }, true);
  }

  /** Programmer's undo: a clock-face sweep counter-clockwise. */
  rewind(x: number, y: number, color: number) {
    this.timedGfx(0.6, this.over, (p, g) => {
      g.clear().circle(x, y, 46).stroke({ width: 4, color, alpha: 1 - p });
      g.arc(x, y, 46, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * p, true).stroke({ width: 10, color: 0xffffff, alpha: 0.8 * (1 - p) });
    }, true);
  }

  /** Airstrike plane silhouette crossing over (x, y). */
  plane(arenaW: number, y: number, dir: number, dur: number, color: number) {
    const tex = propTex('plane');
    if (tex) {
      const sp = new Sprite(tex);
      sp.anchor.set(0.5);
      const k = 200 / tex.width;
      this.over.addChild(sp);
      const x0 = dir > 0 ? -200 : arenaW + 200, x1 = dir > 0 ? arenaW + 200 : -200;
      this.timed.push({ obj: sp, life: dur, max: dur, update: (p, o: Sprite) => {
        o.position.set(x0 + (x1 - x0) * p, y + Math.sin(p * 12) * 6);
        o.scale.set(k * dir, k / DEPTH.k);
      } });
      return;
    }
    const g = new Graphics();
    g.poly([-90, 0, 70, -10, 100, 0, 70, 10]).fill(color).stroke({ width: 4, color: 0x2a1d14 });
    g.poly([-10, -6, 20, -70, 40, -70, 30, -6]).fill(color).stroke({ width: 4, color: 0x2a1d14 });
    g.poly([-10, 6, 20, 70, 40, 70, 30, 6]).fill(color).stroke({ width: 4, color: 0x2a1d14 });
    g.poly([-90, 0, -70, -30, -60, -30, -70, 0]).fill(color).stroke({ width: 3, color: 0x2a1d14 });
    g.scale.set(dir, 1);
    this.over.addChild(g);
    const x0 = dir > 0 ? -200 : arenaW + 200, x1 = dir > 0 ? arenaW + 200 : -200;
    this.timed.push({ obj: g, life: dur, max: dur, update: (p, o: Graphics) => { o.position.set(x0 + (x1 - x0) * p, y); } });
  }

  /** victory confetti over the arena in the winners' colour, gold and white */
  confetti(color: number) {
    const cols = [color, 0xffd23f, 0xffffff, color, 0x6dff9a];
    for (let i = 0; i < 120; i++) {
      this.spawn({
        x: -40 + Math.random() * 600, y: -260 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 160, vy: 80 + Math.random() * 220,
        life: 2.2 + Math.random() * 1.4, color: cols[i % cols.length],
        size: 9 + Math.random() * 7, endSize: 8, grav: 260, drag: 1.2, square: true, spin: (Math.random() - 0.5) * 14,
      });
    }
  }

  // ---------------- cast indicators ----------------

  /**
   * Skill nameplate: a dark pill in the caster's colour that pops above its head and follows it,
   * so you can always tell who cast what. Specials get a gold, bigger plate.
   */
  castPlate(at: () => { x: number; y: number }, name: string, color: number, special: boolean, tag: string) {
    const c = new Container();
    const label = new Text({
      text: name.toUpperCase(),
      style: { fontFamily: FONT, fontSize: special ? 40 : 30, fill: 0xffffff, letterSpacing: 1.5 },
      resolution: 2,
    });
    label.anchor.set(0.5);
    const kicker = new Text({ text: tag, style: { fontFamily: FONT, fontSize: 15, fill: special ? 0x2a1d14 : color, letterSpacing: 2 }, resolution: 2 });
    kicker.anchor.set(0.5);
    const w = label.width + 36, h = label.height + 14;
    const bg = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0x1d140d, alpha: 0.92 }).stroke({ width: 4, color: special ? 0xffd23f : color })
      .roundRect(-w / 2 + 6, -h / 2 + 5, w - 12, 6, 3).fill({ color: 0xffffff, alpha: 0.12 });
    const tab = new Graphics().roundRect(-kicker.width / 2 - 10, -h / 2 - 17, kicker.width + 20, 20, 8).fill(special ? 0xffd23f : 0x1d140d).stroke({ width: 3, color: special ? 0x1d140d : color });
    kicker.position.set(0, -h / 2 - 7);
    c.addChild(bg, label, tab, kicker);
    this.over.addChild(c);
    const dur = special ? 1.6 : 1.25;
    this.timed.push({ obj: c, life: dur, max: dur, update: (p, o: Container) => {
      const a = at();
      const pop = p < 0.1 ? 0.4 + (p / 0.1) * 0.75 : p < 0.18 ? 1.15 - ((p - 0.1) / 0.08) * 0.15 : 1;
      o.position.set(a.x, a.y - 30 - p * 24);
      o.scale.set(pop, pop / DEPTH.k);
      o.alpha = p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1;
    } });
  }

  /** Lock-on reticle that follows the skill's target for a moment. */
  reticle(at: () => { x: number; y: number }, color: number, dur = 0.7) {
    this.timedGfx(dur, this.under, (p, g) => {
      const a = at();
      const r = 70 - 26 * Math.min(1, p * 4);
      const al = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      g.clear();
      g.circle(a.x, a.y, r).stroke({ width: 10, color: 0xffffff, alpha: 0.55 * al });
      g.circle(a.x, a.y, r).stroke({ width: 5, color, alpha: 0.95 * al });
      for (let i = 0; i < 4; i++) {
        const ang = i * (Math.PI / 2) + p * 2.5;
        const cx = Math.cos(ang), cy = Math.sin(ang);
        g.moveTo(a.x + cx * (r + 4), a.y + cy * (r + 4)).lineTo(a.x + cx * (r + 22), a.y + cy * (r + 22)).stroke({ width: 11, color: 0xffffff, alpha: 0.6 * al });
        g.moveTo(a.x + cx * (r + 4), a.y + cy * (r + 4)).lineTo(a.x + cx * (r + 22), a.y + cy * (r + 22)).stroke({ width: 6, color, alpha: al });
      }
      g.circle(a.x, a.y, r * 0.35).fill({ color, alpha: 0.25 * al });
    });
  }

  /** A quick ground line from caster to target: who is aiming at whom. */
  telegraph(from: () => { x: number; y: number }, to: () => { x: number; y: number }, color: number, dur = 0.4) {
    this.timedGfx(dur, this.under, (p, g) => {
      const a = from(), b = to();
      const al = (1 - p) * 0.8;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      g.clear();
      // dashes marching toward the target
      for (let d = ((p * 160) % 32); d < len - 30; d += 32)
        g.moveTo(a.x + ux * d, a.y + uy * d).lineTo(a.x + ux * (d + 16), a.y + uy * (d + 16)).stroke({ width: 11, color: 0xffffff, alpha: al * 0.5 }).moveTo(a.x + ux * d, a.y + uy * d).lineTo(a.x + ux * (d + 16), a.y + uy * (d + 16)).stroke({ width: 6, color, alpha: al });
      const hx = b.x - ux * 30, hy = b.y - uy * 30;
      g.poly([hx + ux * 22, hy + uy * 22, hx - uy * 14, hy + ux * 14, hx + uy * 14, hy - ux * 14]).fill({ color, alpha: al });
    });
  }

  /** Flash of rays behind the caster at the moment it fires a skill. */
  castBurst(x: number, y: number, color: number, special: boolean) {
    const n = special ? 14 : 9;
    this.timedGfx(special ? 0.5 : 0.35, this.over, (p, g) => {
      g.clear();
      const r0 = 20 + 60 * p, r1 = (special ? 130 : 95) * (0.5 + p * 0.7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + p * 0.6;
        const w = 0.09;
        g.poly([x + Math.cos(a - w) * r0, y + Math.sin(a - w) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, x + Math.cos(a + w) * r0, y + Math.sin(a + w) * r0])
          .fill({ color, alpha: 0.75 * (1 - p) });
      }
      g.circle(x, y, 26 * (1 - p)).fill({ color: 0xffffff, alpha: 0.8 * (1 - p) });
    }, true);
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.removeFromParent();
        this.pool.push(p.s);
        this.particles.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy = p.vy * dr + p.grav * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const sc = p.s0 + (p.s1 - p.s0) * k;
      if (p.stretch) {
        const sp = Math.hypot(p.vx, p.vy);
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.scale.set(sc * (1 + sp * p.stretch), sc * 0.6);
      } else {
        p.s.scale.set(sc);
        p.s.rotation += p.spin * dt;
      }
      p.s.alpha = p.a0 * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    }
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const t = this.timed[i];
      t.life -= dt;
      if (t.life <= 0) {
        t.obj.destroy();
        this.timed.splice(i, 1);
        continue;
      }
      t.update(1 - t.life / t.max, t.obj, dt);
    }
  }

  clear() {
    for (const p of this.particles) p.s.removeFromParent();
    this.particles = [];
    for (const t of this.timed) t.obj.destroy();
    this.timed = [];
  }
}
