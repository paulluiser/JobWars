import { ColorMatrixFilter, Container, Graphics, Sprite } from 'pixi.js';
import { charArt, hasSprites } from './art';
import { DEPTH } from './depth';
import type { Fighter } from '../sim/types';
import type { Fx } from './fx';
import type { Juice } from './juice';

const INK = 0x2a1d14;
export const TEAM_COLORS = [0x3f9cff, 0xff5a46, 0x48c78e, 0xb68cff, 0xffc84c] as const;
/** On-screen size multiplier for fighters (sim radius stays the same). */
export const VIS = 1.15;
export const ROYALE_FIGHTER_SCALE = 0.78;

/** arm poses (radians from straight up, + = forward) and where the arm passes behind the body */
const REST = 1.5, WIND = -0.5, STRIKE = 2.25, BEHIND = 0.7;

/** a job's signature colour, readable on the arena (white coats use their accent) */
export function castColor(d: { color: number; accent: number }) {
  const l = (((d.color >> 16) & 255) * 0.3 + ((d.color >> 8) & 255) * 0.59 + (d.color & 255) * 0.11) / 255;
  return l > 0.82 || l < 0.16 ? d.accent : d.color;
}

/** tool length from the hand pivot for the code-drawn tools (see drawTool) */
const TOOL_TIP: Record<string, number> = {
  chef: 64, firefighter: 84, electrician: 90, nurse: 46, courier: 64, fisher: 116,
  farmer: 84, builder: 88, miner: 80, welder: 84, plumber: 76, mechanic: 76, engineer: 100, pilot: 46, merchant: 76, waiter: 40,
  cleaner: 100, tailor: 70, barber: 70, doctor: 82, scientist: 64, teacher: 100, programmer: 52, accountant: 62, lawyer: 78,
  police: 70, soldier: 78, artist: 96, musician: 80, athlete: 84,
};

/** colour of the tool-tip glow while casting the active skill */
const CAST_GLOW: Record<string, number> = { chef: 0xff8a2a, firefighter: 0x7fd0ff, electrician: 0xfff27a, nurse: 0xfff27a, courier: 0xffc04a, fisher: 0xbfe8ff };

const HAIR: Record<string, number> = {
  chef: 0x3b2a20, firefighter: 0x2e221a, electrician: 0x1f1a17, nurse: 0x6b3e26, courier: 0x1b1410, fisher: 0x7a5230,
};

/** Job hats: the #1 silhouette cue (chef toque, fire helmet, hard hat, nurse cap, cap, bucket hat). */
function drawHat(g: Graphics, id: string, accent: number) {
  switch (id) {
    case 'chef':
      g.circle(-14, -122, 13).circle(0, -128, 15).circle(14, -122, 13).fill(0xfffdf6).stroke({ width: 3, color: INK });
      g.roundRect(-22, -118, 44, 18, 5).fill(0xfffdf6).stroke({ width: 3, color: INK });
      g.roundRect(-24, -104, 48, 9, 3).fill(0xf1ece0).stroke({ width: 3, color: INK });
      break;
    case 'firefighter':
      g.moveTo(-33, -88).arc(0, -90, 33, Math.PI, Math.PI * 2).closePath().fill(0xc9302a).stroke({ width: 3, color: INK });
      g.ellipse(0, -88, 44, 8).fill(0x9e221d).stroke({ width: 3, color: INK });
      g.poly([4, -118, 20, -118, 20, -102, 12, -96, 4, -102]).fill(0xf2c230).stroke({ width: 2, color: INK });
      break;
    case 'electrician':
      g.moveTo(-32, -90).arc(0, -92, 32, Math.PI, Math.PI * 2).closePath().fill(0xf5c518).stroke({ width: 3, color: INK });
      g.roundRect(-40, -93, 80, 8, 4).fill(0xe0ad0c).stroke({ width: 3, color: INK });
      g.poly([6, -120, -2, -106, 6, -106, 2, -96, 14, -110, 6, -110, 10, -120]).fill(INK);
      break;
    case 'nurse':
      g.poly([-22, -100, -18, -118, 18, -118, 22, -100]).fill(0xffffff).stroke({ width: 3, color: INK });
      g.rect(-3, -116, 6, 13).fill(accent).rect(-7, -112, 14, 6).fill(accent);
      break;
    case 'courier':
      g.moveTo(-31, -90).arc(0, -92, 31, Math.PI, Math.PI * 2).closePath().fill(0xf08a24).stroke({ width: 3, color: INK });
      g.roundRect(14, -96, 30, 9, 4).fill(0xd06f12).stroke({ width: 3, color: INK });
      g.roundRect(-10, -116, 20, 9, 2).fill(0xffffff).stroke({ width: 2, color: INK });
      break;
    case 'fisher':
      g.moveTo(-26, -96).quadraticCurveTo(0, -128, 26, -96).closePath().fill(0xe9c46a).stroke({ width: 3, color: INK });
      g.ellipse(0, -94, 42, 9).fill(0xd9ad45).stroke({ width: 3, color: INK });
      g.circle(16, -108, 3.5).fill(0x3f7d5a).stroke({ width: 1.5, color: INK });
      break;
    default: {
      const [style, col] = HATS[id] ?? ['none', accent];
      genericHat(g, style, col);
    }
  }
}

type HatStyle = 'hardhat' | 'cap' | 'wide' | 'helmet' | 'beanie' | 'beret' | 'band' | 'visor' | 'goggles' | 'phones' | 'peaked' | 'mask' | 'lamp' | 'mirror' | 'none';
const HATS: Record<string, [HatStyle, number]> = {
  farmer: ['wide', 0xe3c16f], builder: ['hardhat', 0xf5f5f0], miner: ['lamp', 0x4a4f57], welder: ['mask', 0x3c4650],
  plumber: ['beanie', 0x264653], mechanic: ['goggles', 0x5b7083], engineer: ['hardhat', 0x3a86ff], pilot: ['goggles', 0x7b4a2a],
  merchant: ['visor', 0x2d6a4f], waiter: ['none', 0], cleaner: ['band', 0x4361ee], tailor: ['none', 0], barber: ['none', 0],
  doctor: ['mirror', 0xc0c7d0], scientist: ['goggles', 0x80ffdb], teacher: ['none', 0], programmer: ['phones', 0x4cc9f0],
  accountant: ['visor', 0x43aa8b], lawyer: ['none', 0], police: ['peaked', 0x14213d], soldier: ['helmet', 0x283618],
  artist: ['beret', 0xe63946], musician: ['none', 0], athlete: ['band', 0x219ebc],
};

function genericHat(g: Graphics, style: HatStyle, c: number) {
  switch (style) {
    case 'hardhat':
      g.moveTo(-32, -90).arc(0, -92, 32, Math.PI, Math.PI * 2).closePath().fill(c).stroke({ width: 3, color: INK });
      g.roundRect(-40, -93, 80, 8, 4).fill(c).stroke({ width: 3, color: INK });
      break;
    case 'helmet':
    case 'lamp':
      g.moveTo(-33, -86).arc(0, -88, 33, Math.PI, Math.PI * 2).closePath().fill(c).stroke({ width: 3, color: INK });
      if (style === 'lamp') g.circle(12, -108, 8).fill(0xffd23f).stroke({ width: 2.5, color: INK });
      break;
    case 'cap':
    case 'peaked':
      g.moveTo(-31, -90).arc(0, -92, 31, Math.PI, Math.PI * 2).closePath().fill(c).stroke({ width: 3, color: INK });
      g.roundRect(10, -96, 34, 9, 4).fill(c).stroke({ width: 3, color: INK });
      if (style === 'peaked') g.circle(0, -108, 5).fill(0xfca311).stroke({ width: 2, color: INK });
      break;
    case 'wide':
      g.moveTo(-24, -98).quadraticCurveTo(0, -126, 24, -98).closePath().fill(c).stroke({ width: 3, color: INK });
      g.ellipse(0, -96, 50, 10).fill(c).stroke({ width: 3, color: INK });
      break;
    case 'beanie':
      g.moveTo(-31, -86).arc(0, -90, 31, Math.PI, Math.PI * 2).closePath().fill(c).stroke({ width: 3, color: INK });
      g.roundRect(-32, -94, 64, 10, 4).fill(c).stroke({ width: 3, color: INK });
      break;
    case 'beret':
      g.ellipse(4, -108, 34, 12).fill(c).stroke({ width: 3, color: INK });
      g.circle(4, -120, 4).fill(c).stroke({ width: 2, color: INK });
      break;
    case 'band':
      g.roundRect(-31, -100, 62, 9, 3).fill(c).stroke({ width: 2.5, color: INK });
      break;
    case 'visor':
      g.roundRect(-30, -102, 60, 7, 3).fill(c).stroke({ width: 2.5, color: INK });
      g.roundRect(8, -100, 32, 8, 4).fill(c).stroke({ width: 2.5, color: INK });
      break;
    case 'goggles':
      g.roundRect(-30, -104, 60, 6, 3).fill(0x4a3426);
      g.circle(-6, -102, 9).circle(14, -102, 9).fill(c).stroke({ width: 3, color: INK });
      break;
    case 'phones':
      g.arc(0, -84, 34, Math.PI * 1.05, Math.PI * 1.95).stroke({ width: 5, color: INK });
      g.roundRect(-38, -92, 10, 20, 4).fill(c).stroke({ width: 2.5, color: INK });
      break;
    case 'mask':
      g.roundRect(-26, -128, 52, 26, 6).fill(c).stroke({ width: 3, color: INK });
      g.roundRect(-14, -122, 28, 8, 3).fill(0x2a3a4a);
      break;
    case 'mirror':
      g.roundRect(-30, -102, 60, 6, 3).fill(0x4a4a50);
      g.circle(-4, -106, 10).fill(c).stroke({ width: 3, color: INK });
      break;
  }
}

/** Job tools, drawn pointing up from the hand pivot (0,0). */
function drawTool(g: Graphics, id: string) {
  switch (id) {
    case 'chef': // cleaver
      g.roundRect(-3.5, -20, 7, 24, 2).fill(0x5b3a22).stroke({ width: 2.5, color: INK });
      g.poly([-4, -20, 22, -20, 24, -66, -4, -66]).fill(0xdfe6ee).stroke({ width: 3, color: INK });
      g.circle(14, -58, 3).fill(INK);
      g.moveTo(22, -24).lineTo(23, -62).stroke({ width: 2, color: 0xffffff });
      break;
    case 'firefighter': // axe
      g.roundRect(-4, -78, 8, 82, 3).fill(0xb98a52).stroke({ width: 2.5, color: INK });
      g.poly([4, -76, 30, -86, 34, -58, 4, -62]).fill(0xd63b2a).stroke({ width: 3, color: INK });
      g.poly([-4, -76, -14, -70, -4, -64]).fill(0x9aa3ad).stroke({ width: 2.5, color: INK });
      break;
    case 'electrician': // insulated voltage rod
      g.roundRect(-5, -26, 10, 30, 4).fill(0xf5c518).stroke({ width: 2.5, color: INK });
      g.rect(-5, -18, 10, 4).fill(INK);
      g.roundRect(-2.5, -76, 5, 52, 2).fill(0xc2ccd6).stroke({ width: 2, color: INK });
      g.poly([0, -92, -8, -76, 8, -76]).fill(0xfff27a).stroke({ width: 2, color: INK });
      break;
    case 'nurse': // defibrillator paddle
      g.roundRect(-5, -22, 10, 26, 4).fill(0xf2f2f2).stroke({ width: 2.5, color: INK });
      g.roundRect(-16, -48, 32, 28, 8).fill(0xffffff).stroke({ width: 3, color: INK });
      g.roundRect(-12, -46, 24, 6, 3).fill(0xec6f95);
      g.moveTo(0, 4).bezierCurveTo(-20, 20, -30, 0, -26, -16).stroke({ width: 3, color: 0x555555 });
      break;
    case 'courier': // parcel on a strap
      g.moveTo(0, 0).lineTo(0, -30).stroke({ width: 4, color: 0x4a3426 });
      g.roundRect(-20, -66, 40, 36, 4).fill(0xc8935a).stroke({ width: 3, color: INK });
      g.rect(-3, -66, 6, 36).fill(0xe9d8a6);
      g.roundRect(4, -58, 12, 8, 2).fill(0xffffff).stroke({ width: 1.5, color: INK });
      break;
    case 'fisher': // long rod with line and hook
      g.roundRect(-3.5, -14, 7, 18, 3).fill(0x5b3a22).stroke({ width: 2.5, color: INK });
      g.moveTo(0, -14).lineTo(2, -118).stroke({ width: 5, color: INK });
      g.moveTo(0, -14).lineTo(2, -118).stroke({ width: 2.5, color: 0xd9b26a });
      g.circle(-6, -12, 6).fill(0x9aa3ad).stroke({ width: 2, color: INK });
      g.moveTo(2, -118).lineTo(16, -72).stroke({ width: 1.2, color: 0xffffff });
      g.circle(16, -70, 3).stroke({ width: 2, color: 0x9aa3ad });
      break;
    default:
      genericTool(g, id);
  }
}

/** Placeholder tools for the M4 jobs (real art replaces these). Pointing up from the hand at (0,0). */
function genericTool(g: Graphics, id: string) {
  const handle = (len: number, col = 0x8a5a33) => g.roundRect(-4, -len, 8, len + 4, 3).fill(col).stroke({ width: 2.5, color: INK });
  switch (id) {
    case 'farmer': handle(84); g.moveTo(0, -84).quadraticCurveTo(40, -96, 48, -64).lineTo(36, -70).quadraticCurveTo(30, -84, 0, -78).closePath().fill(0xdfe6ee).stroke({ width: 3, color: INK }); break;
    case 'builder': handle(70); g.roundRect(-24, -92, 48, 26, 6).fill(0x6c757d).stroke({ width: 3, color: INK }); break;
    case 'miner': handle(72); g.moveTo(-34, -66).quadraticCurveTo(0, -92, 34, -66).lineTo(30, -62).quadraticCurveTo(0, -82, -30, -62).closePath().fill(0x9aa3ad).stroke({ width: 3, color: INK }); break;
    case 'welder': handle(26, 0x3c4650); g.roundRect(-6, -60, 12, 34, 4).fill(0xc0c7d0).stroke({ width: 2.5, color: INK }); g.poly([0, -84, -8, -60, 8, -60]).fill(0xff9a3c); break;
    case 'plumber': case 'mechanic':
      handle(56, id === 'plumber' ? 0xd62828 : 0x6c757d);
      g.roundRect(-14, -76, 28, 22, 5).fill(0x9aa3ad).stroke({ width: 3, color: INK });
      g.rect(-6, -76, 12, 10).fill(0x5b6470); break;
    case 'engineer': g.roundRect(-4, -100, 8, 104, 2).fill(0xf2f2f2).stroke({ width: 2, color: INK }); for (let y = -96; y < 0; y += 16) g.rect(-4, y, 8, 8).fill(0xd62828); break;
    case 'pilot': case 'soldier':
      g.roundRect(-6, -14, 12, 18, 3).fill(0x4a3426).stroke({ width: 2.5, color: INK });
      g.roundRect(-8, id === 'soldier' ? -78 : -46, 16, id === 'soldier' ? 66 : 34, 4).fill(id === 'soldier' ? 0x3d4a2a : 0xf08a24).stroke({ width: 3, color: INK }); break;
    case 'merchant': g.roundRect(-24, -76, 48, 60, 4).fill(0x8a5a33).stroke({ width: 3, color: INK }); for (let y = -66; y < -20; y += 12) { g.moveTo(-20, y).lineTo(20, y).stroke({ width: 1.5, color: INK }); g.circle(-6 + (y % 3) * 4, y, 4).fill(0xf4d35e); } break;
    case 'waiter': g.ellipse(0, -40, 30, 8).fill(0xdfe6ee).stroke({ width: 3, color: INK }); break;
    case 'cleaner': handle(86, 0xc9a66b); g.roundRect(-16, -100, 32, 18, 6).fill(0xe8e2d0).stroke({ width: 3, color: INK }); break;
    case 'tailor': case 'barber':
      g.poly([-3, 0, -14, -70, -6, -72, 3, -6]).fill(0xdfe6ee).stroke({ width: 2.5, color: INK });
      g.poly([3, 0, 14, -70, 6, -72, -3, -6]).fill(0xdfe6ee).stroke({ width: 2.5, color: INK });
      g.circle(-7, 4, 6).circle(7, 4, 6).stroke({ width: 3, color: id === 'tailor' ? 0xffca3a : 0xe63946 }); break;
    case 'doctor': g.roundRect(-7, -60, 14, 50, 4).fill(0xe6f2ff).stroke({ width: 2.5, color: INK }); g.moveTo(0, -60).lineTo(0, -82).stroke({ width: 3, color: 0x9aa3ad }); g.rect(-10, -12, 20, 6).fill(0x4ea8de); break;
    case 'scientist': handle(30); g.circle(0, -46, 18).fill(0x80ff9a).stroke({ width: 3, color: INK }); g.rect(-5, -70, 10, 10).fill(0xdfe6ee).stroke({ width: 2, color: INK }); break;
    case 'teacher': g.roundRect(-3, -100, 6, 104, 2).fill(0x8a5a33).stroke({ width: 2, color: INK }); g.rect(-3, -100, 6, 8).fill(0xffffff); break;
    case 'programmer': g.roundRect(-26, -52, 52, 34, 4).fill(0x2b2d42).stroke({ width: 3, color: INK }); g.rect(-21, -48, 42, 24).fill(0x4cc9f0); break;
    case 'accountant': g.roundRect(-18, -62, 36, 48, 5).fill(0x43aa8b).stroke({ width: 3, color: INK }); g.rect(-13, -57, 26, 10).fill(0xd8f3dc); break;
    case 'lawyer': handle(56); g.roundRect(-20, -78, 40, 22, 5).fill(0x8a5a33).stroke({ width: 3, color: INK }); break;
    case 'police': g.roundRect(-5, -70, 10, 74, 4).fill(0x1d1d1d).stroke({ width: 2.5, color: INK }); break;
    case 'artist': handle(64, 0xc9a66b); g.poly([-7, -64, 7, -64, 4, -88, 0, -96, -4, -88]).fill(0xe63946).stroke({ width: 2.5, color: INK }); break;
    case 'musician': g.roundRect(-3, -80, 6, 60, 2).fill(0x5b3a22).stroke({ width: 2, color: INK }); g.ellipse(0, -18, 18, 22).fill(0xef233c).stroke({ width: 3, color: INK }); break;
    case 'athlete': g.moveTo(-3, 0).lineTo(-8, -84).lineTo(8, -84).lineTo(3, 0).closePath().fill(0xc9a66b).stroke({ width: 2.5, color: INK }); break;
    default: g.roundRect(-4, -60, 8, 64, 3).fill(0x9aa3ad).stroke({ width: 2.5, color: INK });
  }
}

function ease(t: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

/**
 * Placeholder chibi puppet built from shapes (until the AI-generated part sprites land). Same rig layout the real
 * AI-generated part sprites will use later: feet pivot, body, head, weapon arm.
 */
export class FighterView {
  readonly root = new Container();
  private shadow = new Graphics();
  private ring = new Graphics();
  private guardArc = new Graphics();
  private glow = new Graphics();
  /** flat rune ring on the floor while casting */
  private castRing = new Graphics();
  private puppet = new Container();
  private parts: { g: Graphics | Sprite; tint: number }[] = [];
  /** true when the job has real body + weapon art (sprite rig) instead of the shape puppet */
  readonly sprites: boolean;
  private armRest = 0;
  /** distance from the shoulder pivot to the tool tip, in arm-local units */
  private tipLen = 60;
  /** puppet-local body height (feet → top of hat) */
  private bodyH = 128;
  /** glow that rides on the tool tip (charge, casting, the Electrician's live rod) */
  private tipGlow = new Graphics();
  private whiteFilter: ColorMatrixFilter | null = null;
  private arm = new Container();
  /** shoulder cap under the arm joint (sprite rig) so the arm never looks detached */
  private cap = new Graphics();
  private armBehind = false;
  private shield = new Graphics();
  private stars = new Graphics();
  private eyes = new Graphics();

  private sx = 1; private sy = 1; private vsx = 0; private vsy = 0;
  private armAngle = 0.6;
  private walkT = 0;
  private flashT = 0;
  private jitterT = 0;
  private fxT = 0;
  private afterT = 0;
  private shieldT = 0;
  private shieldParry = false;
  private dodgeT = 0;
  private koT = 0;
  private time = 0;
  private dir = 1;

  readonly visualSize: number;

  constructor(readonly f: Fighter, private fx: Fx, private juice: Juice, scale = 1) {
    const d = f.def;
    const s = this.visualSize = (d.radius / 32) * VIS * scale;
    this.root.addChild(this.shadow, this.castRing, this.ring, this.guardArc, this.glow, this.puppet, this.stars);
    this.castRing.scale.y = 0.34;
    this.castRing.blendMode = 'add';
    this.shadow.ellipse(0, 0, 40 * s, 13 * s).fill({ color: 0x000000, alpha: 0.28 });
    this.glow.blendMode = 'add';

    this.sprites = hasSprites(d.id);
    if (this.sprites) this.buildSpriteRig();
    else this.buildShapePuppet();
    this.tipGlow.blendMode = 'add';
    this.tipGlow.position.set(0, -this.tipLen);
    this.arm.addChild(this.tipGlow);
    this.puppet.scale.set(s);
    this.ring.ellipse(0, 0, 44 * s, 15 * s).stroke({ width: 4, color: TEAM_COLORS[f.team], alpha: 0.9 });
    this.dir = Math.cos(f.face) >= 0 ? 1 : -1;
  }

  /**
   * Sprite rig from the art pipeline: body (feet at the bottom centre) + arm-and-tool piece
   * (shoulder at the bottom centre, pointing up) rotating around the shoulder. Sizes and the
   * shoulder position come from art/rig.json, tuned on /rig.html.
   */
  private buildSpriteRig() {
    const art = charArt(this.f.def.id)!;
    const rig = art.rig;
    const body = new Sprite(art.body!);
    body.anchor.set(0.5, 1);
    body.scale.set(rig.height / art.body!.height);
    const weapon = new Sprite(art.weapon!);
    const pv = rig.pivot ?? { x: 0.5, y: 1 };
    weapon.anchor.set(pv.x, pv.y);
    weapon.scale.set(rig.weaponLength / art.weapon!.height);
    this.parts.push({ g: body, tint: 0xffffff }, { g: weapon, tint: 0xffffff });
    this.arm.addChild(weapon);
    this.arm.position.set(rig.shoulder.x, rig.shoulder.y);
    this.armRest = rig.weaponAngle;
    // the tool tip is the top of the image, measured from the pivot
    this.tipLen = rig.weaponLength * (rig.pivot?.y ?? 1) * 0.96;
    this.bodyH = rig.height;
    // shoulder cap in the sleeve's own colour, under the arm: fills the joint at every angle
    const base = art.armBase;
    const k = rig.weaponLength / art.weapon!.height;
    const r = Math.max(7, Math.min(16, ((base?.width ?? art.weapon!.width * 0.3) * k) / 2 + 1.5));
    this.cap.ellipse(0, 0, r, r * 0.95).fill(base?.color ?? 0xd8c8b0);
    this.cap.position.set(rig.shoulder.x, rig.shoulder.y);
    this.parts.push({ g: this.cap as unknown as Graphics, tint: 0xffffff });
    this.puppet.addChild(body, this.shield, this.cap, this.arm);
    this.whiteFilter = new ColorMatrixFilter();
    this.whiteFilter.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  }

  private buildShapePuppet() {
    const d = this.f.def;
    const part = (tint: number, draw: (g: Graphics) => void) => {
      const g = new Graphics();
      draw(g);
      g.tint = tint;
      this.parts.push({ g, tint });
      return g;
    };
    const legs = part(d.accent, (g) => {
      g.roundRect(-15, -20, 13, 20, 5).fill(0xffffff).stroke({ width: 3, color: INK });
      g.roundRect(3, -20, 13, 20, 5).fill(0xffffff).stroke({ width: 3, color: INK });
    });
    const body = part(d.color, (g) => {
      g.roundRect(-22, -54, 44, 40, 14).fill(0xffffff).stroke({ width: 3, color: INK });
      g.rect(-22, -24, 44, 5).fill({ color: 0x000000, alpha: 0.18 });
    });
    const head = part(d.skin, (g) => g.circle(0, -84, 31).fill(0xffffff).stroke({ width: 3, color: INK }));
    const hair = part(HAIR[d.id] ?? 0x3b2a20, (g) => {
      g.moveTo(-31, -82).arc(0, -84, 31, Math.PI * 0.95, Math.PI * 2.05).lineTo(26, -78).lineTo(10, -92).lineTo(-6, -80).closePath().fill(0xffffff);
    });
    const hat = part(0xffffff, (g) => drawHat(g, d.id, d.accent));
    this.eyes.ellipse(10, -80, 4, 6).fill(INK).ellipse(23, -80, 4, 6).fill(INK);
    this.eyes.circle(11, -82, 1.6).fill(0xffffff).circle(24, -82, 1.6).fill(0xffffff);
    const blush = new Graphics().ellipse(4, -70, 6, 3).fill({ color: 0xff7a7a, alpha: 0.45 }).ellipse(28, -70, 5, 3).fill({ color: 0xff7a7a, alpha: 0.45 });
    const collar = part(d.accent, (g) => g.poly([-12, -54, 0, -42, 12, -54]).fill(0xffffff).stroke({ width: 2.5, color: INK }));

    // weapon arm: the job's tool, drawn pointing up from the shoulder pivot
    const weapon = part(0xffffff, (g) => drawTool(g, d.id));
    const hand = part(d.skin, (g) => g.circle(0, 0, 7).fill(0xffffff).stroke({ width: 2.5, color: INK }));
    this.arm.addChild(weapon, hand);
    this.arm.position.set(16, -40);
    this.tipLen = TOOL_TIP[d.id] ?? 60;
    this.bodyH = 128;

    this.puppet.addChild(legs, body, collar, head, hair, this.eyes, blush, hat, this.shield, this.arm);
  }

  /**
   * Where a body part is right now, in world (arena) coordinates, following the live pose:
   * the swinging tool, the flip, squash and the arena's depth squash. Effects spawn from here.
   */
  point(kind: 'tip' | 'hand' | 'shoulder' | 'head' | 'chest' | 'feet') {
    const parent = this.root.parent;
    if (!parent) return { x: this.f.x, y: this.f.y };
    let g;
    switch (kind) {
      case 'tip': g = this.arm.toGlobal({ x: 0, y: -this.tipLen }); break;
      case 'hand': g = this.arm.toGlobal({ x: 0, y: -this.tipLen * (this.sprites ? 0.4 : 0.05) }); break;
      case 'shoulder': g = this.arm.toGlobal({ x: 0, y: 0 }); break;
      case 'head': g = this.puppet.toGlobal({ x: 0, y: -this.bodyH * 0.95 }); break;
      case 'chest': g = this.puppet.toGlobal({ x: 0, y: -this.bodyH * 0.45 }); break;
      default: g = this.root.toGlobal({ x: 0, y: 0 });
    }
    return parent.toLocal(g);
  }

  /** Silhouette used for dodge afterimages. */
  silhouette = (g: Graphics) => {
    const s = this.visualSize;
    g.circle(0, -84 * s, 31 * s).fill(0xffffff).roundRect(-22 * s, -54 * s, 44 * s, 54 * s, 14 * s).fill(0xffffff);
  };

  hitFlash() {
    if (!this.juice.enabled) return;
    this.flashT = 0.14;
    this.jitterT = 0.12;
  }

  squash(x: number, y: number) {
    if (!this.juice.enabled) return;
    this.vsx += x;
    this.vsy += y;
  }

  /** Ball-style squash against a wall: flatten along the bounce normal. */
  wallSquash(nx: number, ny: number, speed: number) {
    const k = Math.min(9, speed / 45);
    if (nx) this.squash(-k, k * 0.8);
    if (ny) this.squash(k * 0.8, -k);
  }

  shieldPop(parry: boolean) {
    this.shieldT = parry ? 0.35 : 0.28;
    this.shieldParry = parry;
  }

  /** victory: hop and wave the tool overhead until the next fight */
  celebrate() {
    this.celebrateT = 0.0001;
  }
  private celebrateT = 0;

  dodged() {
    this.dodgeT = 0.22;
  }

  update(alpha: number, dt: number, simDt: number) {
    const f = this.f;
    const juice = this.juice;
    this.time += dt;
    if (this.dodgeT > 0) this.dodgeT -= dt;
    const x = f.px + (f.x - f.px) * alpha;
    const y = f.py + (f.y - f.py) * alpha;
    let ox = 0;
    if (this.jitterT > 0) {
      this.jitterT -= dt;
      if (juice.hitstop > 0) ox = (Math.random() - 0.5) * 9;
    }
    this.root.position.set(x + ox, y);
    this.root.scale.set(1, 1 / DEPTH.k); // stand upright on the foreshortened floor
    this.root.zIndex = y;

    const st = f.state;
    const p = f.stateDur > 0 ? f.stateT / f.stateDur : 0;
    if (st !== 'stun' && st !== 'stagger' && st !== 'ko') this.dir = Math.cos(f.face) >= 0 ? 1 : -1;

    // ---- arm pose ----
    // arm angle from straight up (+ = forward). Chibi heads are big, so the tool is held out in
    // front (1.5), wound up behind the head (-0.5, drawn behind the body) and swung forward and
    // down (2.25). It never sweeps across the face or through the legs. Previewed offline with
    // tools/art/armsheet.ts.
    let arm = REST + Math.sin(this.time * 3) * 0.05;
    let tsx = 1, tsy = 1, lean = 0, lift = 0;
    switch (st) {
      case 'windup':
        arm = REST + (WIND - REST) * ease(p);
        tsx = 1.05; tsy = 0.93; lean = -0.1 * ease(p);
        break;
      case 'recover':
        if (f.stateT < 0.07) arm = WIND + (STRIKE - WIND) * (f.stateT / 0.07);
        else arm = STRIKE - (STRIKE - REST) * ease((f.stateT - 0.07) / Math.max(0.05, f.stateDur - 0.07));
        lean = 0.12 * (1 - p);
        break;
      case 'charge':
        arm = WIND - 0.1 + Math.sin(this.time * 60) * 0.06 * p;
        tsx = 1.08 + 0.04 * p; tsy = 0.9 - 0.04 * p; lean = -0.14;
        break;
      case 'stagger':
        arm = 0.9; lean = -0.18;
        break;
      case 'cast':
        arm = f.casting === 'special' ? WIND + 0.1 + Math.sin(this.time * 30) * 0.08 : 1.3 + Math.sin(this.time * 40) * 0.1;
        tsx = 1.06; tsy = 0.94; lean = 0.12;
        break;
      case 'stun':
        arm = 2.0; lean = Math.sin(this.time * 6) * 0.12;
        break;
    }
    // bouncy hop gait: fighters are always travelling
    if (st !== 'stun' && st !== 'charge') {
      const spd = Math.hypot(f.vx, f.vy);
      this.walkT += dt * (6 + spd * 0.025);
      const h = Math.abs(Math.sin(this.walkT));
      lift = h * 9;
      if (st === 'move') {
        tsy = 1 + h * 0.06;
        tsx = 2 - tsy;
      }
    }
    if (this.shieldT > 0) arm = 1.2;
    if (this.celebrateT > 0 && st !== 'ko') {
      this.celebrateT += dt;
      const c = this.celebrateT;
      arm = -0.3 + Math.sin(c * 9) * 0.35;
      const hop = Math.abs(Math.sin(c * 5.5));
      lift = hop * 26;
      tsy = 1 + hop * 0.12;
      tsx = 2 - tsy;
      lean = Math.sin(c * 5.5) * 0.08;
    }
    if (this.dodgeT > 0) { lean = 0.3; tsx = 1.15; tsy = 0.88; }
    const armK = st === 'recover' && f.stateT < 0.07 ? 1 : Math.min(1, dt * 22);
    this.armAngle += (arm - this.armAngle) * armK;
    this.arm.rotation = this.armAngle + this.armRest;
    // raised back over the head, the arm goes behind the body (like a real far-side wind-up)
    const behind = this.sprites && this.armAngle < BEHIND;
    if (behind !== this.armBehind) {
      this.armBehind = behind;
      this.cap.visible = !behind;
      this.puppet.setChildIndex(this.arm, behind ? 0 : this.puppet.children.length - 1);
    }

    // ---- squash & stretch spring ----
    if (!juice.enabled) { tsx = 1; tsy = 1; this.vsx = this.vsy = 0; }
    // The spring stays stable even when a busy frame takes much longer than 1/60s.
    const steps = Math.max(1, Math.ceil(dt * 60));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.vsx += ((tsx - this.sx) * 520 - this.vsx * 20) * step;
      this.vsy += ((tsy - this.sy) * 520 - this.vsy * 20) * step;
      this.sx += this.vsx * step;
      this.sy += this.vsy * step;
    }
    const s = this.visualSize;

    // ---- KO ----
    if (st === 'ko') {
      this.koT = Math.min(1, this.koT + dt * 3.5);
      this.puppet.rotation = -1.45 * this.dir * ease(this.koT);
      this.puppet.position.y = -8 * Math.sin(this.koT * Math.PI);
      this.puppet.scale.set(s * this.dir, s);
      this.ring.alpha = this.guardArc.alpha = 0.25;
      this.stars.clear();
      this.glow.clear();
      this.castRing.clear();
      this.applyTint(0x9a8f88);
      this.puppet.alpha = 0.92;
      return;
    }
    this.koT = 0;
    this.puppet.scale.set(s * this.sx * this.dir, s * this.sy);
    const knockLean = Math.max(-0.3, Math.min(0.3, f.vx * 0.0003));
    this.puppet.rotation = lean * this.dir + knockLean;
    this.puppet.position.y = -lift;

    // ---- flash ----
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.applyTint(this.flashT > 0.08 ? 0xffffff : 0xff6a5a, true);
    } else {
      this.applyTint(-1);
    }

    // ---- block shield pop ----
    this.shield.clear();
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      const g = f.guard / 100;
      const col = this.shieldParry ? 0x6ff0ff : g > 0.5 ? 0x8fd3ff : g > 0.25 ? 0xffd25a : 0xff5a46;
      const k = Math.min(1, this.shieldT / 0.12);
      this.shield.roundRect(26, -80, 18, 66, 9).fill({ color: col, alpha: 0.35 * k }).stroke({ width: 4, color: col, alpha: k });
      if (this.shieldParry) this.shield.roundRect(20, -88, 30, 82, 14).stroke({ width: 3, color: 0xffffff, alpha: k });
    }

    // ---- guard ring under feet ----
    this.guardArc.clear();
    if (f.guard < 99.5) {
      const g = f.guard / 100;
      const col = g > 0.5 ? 0x8fd3ff : g > 0.25 ? 0xffd25a : 0xff5a46;
      const a0 = -Math.PI / 2 - Math.PI * g;
      this.guardArc.arc(0, 0, 50 * s, a0, a0 + Math.PI * 2 * g).stroke({ width: 5, color: col, alpha: 0.95 });
      this.guardArc.scale.y = 0.34;
    }

    // ---- tool-tip glow: charging, casting, and the Electrician's always-live rod ----
    this.tipGlow.clear();
    const pulse2 = 0.5 + 0.5 * Math.sin(this.time * 22);
    if (st === 'charge') {
      const c = Math.min(1, p);
      this.tipGlow.circle(0, 0, 10 + 16 * c * pulse2).fill({ color: f.def.color === 0xf4f1ea ? 0xffd25a : f.def.color, alpha: 0.35 + 0.4 * c });
      this.tipGlow.circle(0, 0, 5 + 6 * c).fill({ color: 0xffffff, alpha: 0.6 + 0.4 * c });
    } else if (st === 'cast') {
      const col = f.casting === 'special' ? 0xffffff : CAST_GLOW[f.def.id] ?? 0xffffff;
      this.tipGlow.circle(0, 0, 16 + 10 * pulse2).fill({ color: col, alpha: 0.55 });
      this.tipGlow.circle(0, 0, 7).fill({ color: 0xffffff, alpha: 0.9 });
    } else if (f.def.id === 'electrician' && juice.enabled && Math.random() < 0.35) {
      this.tipGlow.circle((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 4 + Math.random() * 5).fill({ color: 0xfff27a, alpha: 0.8 });
    }

    // ---- charge glow ----
    this.glow.clear();
    if (st === 'charge') {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * (14 + 30 * p));
      this.glow.circle(0, -55 * s, (42 + 26 * p) * s).fill({ color: f.def.color, alpha: 0.18 + 0.3 * p * pulse });
      this.glow.circle(0, -55 * s, (24 + 14 * p) * s).fill({ color: 0xfff2c4, alpha: 0.12 + 0.35 * p });
      if (juice.enabled && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        const r = 80 * s;
        this.fx.burstRing(x + Math.cos(a) * r, y - 55 * s + Math.sin(a) * r * 0.6, 1, f.def.color, -260, 7);
      }
    }

    // ---- cast circle: a rotating rune ring under the feet for the whole cast ----
    this.castRing.clear();
    if (st === 'cast') {
      const col = f.casting === 'special' ? 0xffd23f : castColor(f.def);
      const r = (f.casting === 'special' ? 66 : 54) * s;
      const rot = this.time * (f.casting === 'special' ? 5 : 3.5);
      const grow = Math.min(1, p * 5);
      this.castRing.circle(0, 0, r * grow).fill({ color: col, alpha: 0.16 });
      this.castRing.circle(0, 0, r * grow).stroke({ width: 4, color: col, alpha: 0.9 });
      this.castRing.circle(0, 0, r * 0.72 * grow).stroke({ width: 2.5, color: col, alpha: 0.7 });
      for (let i = 0; i < 8; i++) {
        const a = rot + (i * Math.PI) / 4;
        this.castRing.moveTo(Math.cos(a) * r * 0.74 * grow, Math.sin(a) * r * 0.74 * grow)
          .lineTo(Math.cos(a + 0.22) * r * 0.98 * grow, Math.sin(a + 0.22) * r * 0.98 * grow)
          .stroke({ width: 4, color: 0xffffff, alpha: 0.85 });
      }
    }

    // ---- life support aura ----
    if (f.statuses.some((x) => x.kind === 'lifeSupport')) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
      this.glow.circle(0, -55 * s, (50 + 8 * pulse) * s).stroke({ width: 4, color: 0x6dff9a, alpha: 0.5 + 0.4 * pulse });
    }

    // ---- stun stars ----
    this.stars.clear();
    if (st === 'stun') {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        this.stars.star(Math.cos(a) * 30 * s, -130 * s + Math.sin(a) * 9 * s, 5, 9, 4).fill(0xffe066).stroke({ width: 2, color: INK });
      }
    }

    // ---- status particles & dash afterimages (sim-time paced) ----
    if (juice.enabled && simDt > 0) {
      this.fxT -= simDt;
      if (this.fxT <= 0) {
        this.fxT = 0.07;
        for (const sx of f.statuses) {
          if (sx.kind === 'poison') this.fx.bubble(x, y - 60 * s, 0x86e04a);
          if (sx.kind === 'burn') this.fx.ember(x, y - 40 * s);
          if (sx.kind === 'wet' && Math.random() < 0.6) this.fx.drip(x, y - 70 * s);
          if (sx.kind === 'blind' && Math.random() < 0.5) this.fx.bubble(x, y - 115 * s, 0x2a2440);
          if (sx.kind === 'spicy' && Math.random() < 0.4) this.fx.sparkle(x, y - 50 * s, 0xff6a3a);
          if (sx.kind === 'hearty' && Math.random() < 0.4) this.fx.sparkle(x, y - 50 * s, 0xffd23f);
          if (sx.kind === 'light' && Math.random() < 0.4) this.fx.sparkle(x, y - 50 * s, 0xbfe8ff);
          if (sx.kind === 'lifeSupport' && Math.random() < 0.5) this.fx.sparkle(x, y - 60 * s, 0x6dff9a);
        }
      }
      if (this.dodgeT > 0) {
        this.afterT -= simDt;
        if (this.afterT <= 0) {
          this.afterT = 0.03;
          this.fx.afterimage(this.silhouette, x, y, f.def.color, this.dir);
        }
      }
    }
  }

  private lastTint = -2;
  private applyTint(t: number, force = false) {
    if (!force && t === this.lastTint) return;
    this.lastTint = t;
    if (this.sprites) {
      // tint can only darken a texture, so the white flash on sprites is a colour-matrix filter
      this.puppet.filters = t === 0xffffff && this.whiteFilter ? [this.whiteFilter] : [];
      for (const p of this.parts) p.g.tint = t === -1 || t === 0xffffff ? p.tint : t;
      return;
    }
    for (const p of this.parts) p.g.tint = t === -1 ? p.tint : t;
  }
}
