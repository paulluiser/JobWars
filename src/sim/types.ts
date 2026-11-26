import type { Aug } from '../data/cards';
export type Team = 0 | 1;
export type BattleSide = Team | 2 | 3 | 4;

export type FighterState =
  | 'move' // bouncing, between swings
  | 'windup' // swing anticipation
  | 'recover' // after a swing
  | 'charge' // charging a heavy blow (can be held until the foe is in reach)
  | 'cast' // using a skill (active or special); kits may run per-tick logic while casting
  | 'stagger' // short, from parry / interrupt / flinch
  | 'stun' // hard CC
  | 'ko';

export type Role = 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support' | 'Controller';

export type StatusKind =
  // debuffs
  | 'poison' | 'burn' | 'bleed' | 'slow' | 'wet' | 'blind'
  | 'root' | 'silence' | 'disarm' | 'weaken' | 'armorBreak' | 'sleep' | 'confuse' | 'charm' | 'glitch' | 'mark'
  // buffs
  | 'spicy' | 'hearty' | 'light' | 'lifeSupport'
  | 'shield' | 'haste' | 'empower' | 'fortify' | 'superArmor' | 'invuln' | 'airborne';

export const DEBUFFS: StatusKind[] = ['poison', 'burn', 'bleed', 'slow', 'wet', 'blind', 'root', 'silence', 'disarm', 'weaken', 'armorBreak', 'sleep', 'confuse', 'charm', 'glitch', 'mark'];
export const BUFFS: StatusKind[] = ['spicy', 'hearty', 'light', 'lifeSupport', 'shield', 'haste', 'empower', 'fortify', 'superArmor', 'invuln', 'airborne'];
/** crowd control that super armor ignores */
export const CC: StatusKind[] = ['root', 'sleep', 'confuse', 'charm', 'silence', 'disarm'];

export interface Status {
  kind: StatusKind;
  remaining: number;
  stacks: number;
  tickTimer: number;
  value: number; // slow amount etc.
  sourceIdx: number;
}

export interface StatusApply {
  kind: StatusKind;
  duration: number;
  chance?: number;
  stacks?: number;
  value?: number;
}

export interface SkillText {
  name: string;
  /** one line a kid would understand */
  simple: string;
  /** numbers and rules */
  detailed: string;
}

export interface FighterDef {
  id: string;
  displayName: string;
  /** job name, e.g. "Chef" */
  name: string;
  /** small print on the ID badge, e.g. "Kitchen dept." */
  title: string;
  role: Role;
  /** which real jobs this character covers */
  mergedFrom: string;
  quirk: string;
  color: number;
  accent: number;
  skin: number;
  hp: number;
  atk: number;
  /** Skill power, when a job's kit is balanced separately from its swings. */
  skillAtk?: number;
  def: number;
  /** cruise speed of the bouncing ball, px/s */
  speed: number;
  /** weapon reach from own centre to the foe's edge */
  range: number;
  radius: number;
  /** swing rhythm: windup → strike → recover → cooldown, repeating forever */
  windup: number;
  recover: number;
  attackCooldown: number;
  /** attack table (all 0..1) */
  accuracy: number;
  evasion: number;
  blockChance: number;
  /** share of blocks that are perfect blocks (parries) */
  parryShare: number;
  critChance: number;
  /** chance each swing cycle to charge a heavy blow instead */
  chargeChance: number;
  chargeTime: number;
  chargeMult: number;
  /** knockback resistance multiplier (1 = normal, higher = heavier) */
  weight: number;
  onHit?: StatusApply;
  onCharge?: StatusApply;
  passive: SkillText;
  active: SkillText & { cooldown: number };
  special: SkillText & { quote: string };
}

export interface FighterStats {
  damageDealt: number;
  healing: number;
  swings: number;
  hits: number;
  crits: number;
  misses: number;
  blocks: number;
  parries: number;
  guardBreaks: number;
  charges: number;
  interrupts: number;
  dodges: number;
  actives: number;
  specials: number;
}

export interface Fighter {
  idx: number;
  team: BattleSide;
  def: FighterDef;
  x: number;
  y: number;
  px: number;
  py: number;
  /** ball velocity: cruise speed in a bouncing direction, plus knockback on top */
  vx: number;
  vy: number;
  face: number;
  hp: number;
  maxHp: number;
  guard: number;
  guardRegenDelay: number;
  state: FighterState;
  stateT: number;
  stateDur: number;
  attackCd: number;
  activeCd: number;
  /** ready when the rage bar is full; casting it empties the bar (specials repeat) */
  special: 'locked' | 'ready';
  /** 0–100: fills by dealing and taking damage, and slowly over time (RAGE in constants.ts) */
  rage: number;
  /** gacha cards this fighter's team holds, and the merged augment profile they give */
  cards: string[];
  aug: Aug;
  /** per-fight card state: once-only saves used, counters, timers */
  augS: Record<string, number>;
  /** the job's stats before cards (cards are re-applied on top when one is added mid-fight) */
  baseDef: FighterDef;
  /** what the current 'cast' state is doing */
  casting: 'active' | 'special' | null;
  /** free-form per-character counters for passives (ingredients, momentum, …) */
  kit: Record<string, number>;
  statuses: Status[];
  ccHistory: number[];
  targetIdx: number;
  stats: FighterStats;
}

/** Things on the floor or in the air that kits spawn (traps, hooks, …). */
export interface Hazard {
  id: number;
  kind: 'trap' | 'hook' | 'crop' | 'wall' | 'gem' | 'pipe' | 'turret' | 'beam' | 'tray' | 'zone' | 'grenade' | 'ball';
  /** free-form state (crop ripeness, wall HP, zone type, bounces left, …) */
  data: Record<string, number>;
  /** solid hazards (walls) bounce fighters off */
  solid?: boolean;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  age: number;
  dead: boolean;
}

/** Purely visual cues kits ask the renderer to play. */
export type FxKind =
  | 'cone' | 'stream' | 'zap' | 'bolt' | 'truck' | 'fish' | 'splash' | 'ram'
  | 'blackout' | 'feast' | 'explosion' | 'pull' | 'heartbeat' | 'bomb'
  // generic cues used by the M4 kits (colour in `color`)
  | 'shot' | 'drop' | 'shockwave' | 'burst' | 'slashx' | 'rewind' | 'clone';

export type SimEvent =
  | { type: 'windup'; a: number }
  | { type: 'swing'; a: number; heavy: boolean; inReach: boolean }
  | { type: 'hit'; a: number; b: number; dmg: number; crit: boolean; heavy: boolean; skill: boolean; x: number; y: number; dx: number; dy: number }
  | { type: 'miss'; a: number; b: number; x: number; y: number }
  | { type: 'blocked'; a: number; b: number; dmg: number; x: number; y: number }
  | { type: 'parry'; a: number; b: number; x: number; y: number }
  | { type: 'guardBreak'; a: number; b: number; x: number; y: number }
  | { type: 'dodge'; a: number; b: number; dx: number; dy: number }
  | { type: 'interrupt'; a: number; b: number }
  | { type: 'chargeStart'; a: number }
  | { type: 'chargeRelease'; a: number }
  | { type: 'bounce'; a: number; nx: number; ny: number; speed: number; x: number; y: number }
  | { type: 'bump'; a: number; b: number; x: number; y: number; force: number }
  | { type: 'wallSlam'; b: number; dmg: number; x: number; y: number; nx: number; ny: number }
  | { type: 'status'; b: number; kind: StatusKind | 'stun'; stacks: number }
  | { type: 'dot'; b: number; kind: StatusKind; dmg: number }
  | { type: 'heal'; b: number; amount: number }
  | { type: 'cleanse'; b: number }
  | { type: 'note'; b: number; text: string; color: number }
  | { type: 'skill'; a: number; kind: 'active' | 'special'; name: string }
  | { type: 'specialReady'; a: number }
  /** gacha: the fight pauses for a card pick (n = pick number, 1-based) */
  | { type: 'surge'; n: number }
  /** a card was added to a team (draft or surge) */
  | { type: 'card'; team: BattleSide; id: string }
  /** a card effect went off: Golden Parachute, Phoenix, Chain Reaction, Lightning Rod, … */
  | { type: 'proc'; a: number; card: string; b?: number }
  /** gacha overtime begins: damage ramps up, healing halves */
  | { type: 'overtime' }
  | { type: 'fx'; fx: FxKind; a: number; b: number; x: number; y: number; angle: number; dur: number; color?: number; prop?: string }
  | { type: 'hazard'; action: 'spawn' | 'trigger' | 'expire'; id: number; kind: Hazard['kind']; x: number; y: number }
  | { type: 'shieldHit'; b: number; absorbed: number }
  | { type: 'ko'; b: number }
  | { type: 'end'; winner: BattleSide | -1; reason: 'ko' | 'time' };
