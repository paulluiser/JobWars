import { ARENA_H, ARENA_W, COMBAT, DT, RAGE, TAG_REACH, TAG_SCALE, TIME_LIMIT } from './constants';
import { augOf, CARD_BY_ID } from '../data/cards';
import { Rng } from './rng';
import { kitOf } from './kits';
import {
  DEBUFFS, BUFFS, CC,
  type BattleSide, type Fighter, type FighterDef, type FighterState, type FxKind, type Hazard, type SimEvent, type StatusApply, type StatusKind,
} from './types';
import { think } from '../ai/brain';
import { TAG_BALANCE } from '../data/tagBalance';
import { datan2, dcos, dexp, dhypot, dsin } from './dmath';

const C = COMBAT;

export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export interface SkillHitOpts {
  /** ignore this share of the target's DEF */
  pierce?: number;
  /** can the target's evasion roll avoid it? (actives: yes, specials: no) */
  dodgeable?: boolean;
  canCrit?: boolean;
  /** knockback impulse along the direction (default: away from the caster) */
  knock?: number;
  dir?: { x: number; y: number };
  stun?: number;
  statuses?: StatusApply[];
}


/**
 * A job's stats for 2v2: smaller (body × TAG_SCALE, reach × TAG_REACH, so four fit in the box), then the
 * 1v1 stats × its Tag Team balance multipliers.
 */
export function forTag(d: FighterDef): FighterDef {
  const b = TAG_BALANCE[d.id] ?? { atk: 1, hp: 1 };
  return {
    ...d,
    radius: d.radius * TAG_SCALE,
    range: Math.round(d.range * TAG_REACH),
    atk: Math.round(d.atk * b.atk),
    skillAtk: d.skillAtk === undefined ? undefined : Math.round(d.skillAtk * b.atk),
    hp: Math.round((d.hp * b.hp) / 10) * 10,
  };
}

/**
 * Deterministic combat simulation. Knows nothing about rendering.
 *
 * Fighters are balls: they bounce around the arena at a constant cruise speed and
 * never steer. They start swings when a foe is in or about to enter reach. Every
 * swing that reaches the foe is resolved on an attack table rolled from both fighters'
 * stats: dodge → miss → block (parry / guard break) → crit → hit.
 * On top of that each job has a kit (src/sim/kits.ts): a passive, an active skill on
 * a cooldown, and a special that fires whenever its rage bar fills (dealing and taking damage).
 */
/** Match options (Gacha and Story use these; a plain fight needs none). */
export interface SimOpts {
  /** Free-for-all with one fighter per side. */
  royale?: boolean;
  /** cards each team starts with */
  cards?: readonly (readonly string[])[];
  /** max HP multiplier for everyone (Gacha fights run longer) */
  hpMul?: number;
  /** per-team HP multipliers on top (Story bosses, handicaps) */
  teamHpMul?: readonly number[];
  /** seconds before the clock runs out */
  timeLimit?: number;
  /** pause for a card pick every this many seconds (0 = never) */
  surgeEvery?: number;
  /** from this second on, damage ramps up (+25% per 10 s) and healing drops to 40% */
  overtimeAt?: number;
  /** each team starts at this fraction of its max HP (Story: sudden death) */
  startHpPct?: readonly number[];
  /** per-job ATK/HP multipliers for this mode (Gacha has its own balance layer) */
  balance?: Record<string, { atk: number; hp: number }>;
}

export class Sim {
  readonly rng: Rng;
  readonly fighters: Fighter[] = [];
  hazards: Hazard[] = [];
  t = 0;
  tick = 0;
  over = false;
  winner: BattleSide | -1 | null = null;
  private events: SimEvent[] = [];
  private timers: { at: number; seq: number; fn: () => void }[] = [];
  private seq = 0;
  private hazardId = 0;
  readonly timeLimit: number;
  readonly surgeEvery: number;
  private nextSurge: number;
  /** waiting for card picks (a surge): step() does nothing until resume() */
  paused = false;
  surges = 0;
  overtime = false;

  /** Hash only deterministic gameplay state. Timer callbacks are recreated from the input log. */
  checkpoint(): string {
    const state = [
      this.tick, this.t, this.paused, this.surges, this.nextSurge, this.overtime,
      this.over, this.winner, this.rng.checkpoint(), this.seq, this.hazardId,
      this.timers.map(({ at, seq }) => [at, seq]), this.fighters, this.hazards,
    ];
    const data = JSON.stringify(state, (_key, value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    });
    let first = 0x811c9dc5, second = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      first = Math.imul(first ^ char, 0x01000193);
      second = Math.imul(second ^ char, 0x5bd1e995);
    }
    return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
  }

  constructor(teams: FighterDef[][], readonly seed: number, readonly opts: SimOpts = {}) {
    this.rng = new Rng(seed);
    this.timeLimit = opts.timeLimit ?? TIME_LIMIT;
    this.surgeEvery = opts.surgeEvery ?? 0;
    this.nextSurge = this.surgeEvery || Infinity;
    // Tag Team has its own balance layer on top of the 1v1 numbers
    if (!opts.royale && teams.some((t) => t.length > 1)) teams = teams.map((t) => t.map(forTag));
    const rotation = opts.royale ? this.rng.range(0, Math.PI * 2) : 0;
    const participants = teams.filter((defs) => defs.length).length;
    let spawnIndex = 0;
    teams.forEach((defs, team) => {
      if (!defs.length) return;
      const spawnAngle = rotation + (Math.PI * 2 * spawnIndex++) / participants;
      defs.forEach((def, i) => {
        const x = opts.royale
          ? ARENA_W * (0.5 + 0.3 * dcos(spawnAngle))
          : ARENA_W * (team === 0 ? 0.22 : 0.78) + this.rng.range(-30, 30);
        const y = opts.royale
          ? ARENA_H * (0.5 + 0.3 * dsin(spawnAngle))
          : ARENA_H * (defs.length === 1 ? 0.5 : 0.3 + i * 0.4) + this.rng.range(-60, 60);
        const f = this.makeFighter(def, team as BattleSide, x, y);
        if (opts.royale) f.face = spawnAngle - Math.PI;
        const a = this.rng.range(0, Math.PI * 2);
        f.vx = dcos(a) * def.speed;
        f.vy = dsin(a) * def.speed;
        this.fighters.push(f);
      });
    });
    for (const f of this.fighters) {
      f.cards = [...(opts.cards?.[f.team] ?? [])];
      this.applyCards(f, false);
      f.hp = Math.max(1, Math.round(f.maxHp * (opts.startHpPct?.[f.team] ?? 1)));
      if (f.aug.startShield) this.applyStatus(f, { kind: 'shield', duration: 999, value: f.maxHp * f.aug.startShield }, f.idx);
    }
    for (const f of this.fighters) kitOf(f).init?.(this, f);
  }

  // ---------- gacha cards ----------

  /**
   * (Re)build a fighter's stats from its job + cards: static changes (HP, reach, size, weight,
   * speed) go into its own copy of the def; everything else is read live from f.aug.
   * Mid-fight, current HP keeps its proportion of max HP.
   */
  private applyCards(f: Fighter, keepPct: boolean) {
    const a = (f.aug = augOf(f.cards));
    const b = f.baseDef;
    const bal = this.opts.balance?.[b.id];
    const atkMul = bal?.atk ?? 1;
    const hpMul = (this.opts.hpMul ?? 1) * (this.opts.teamHpMul?.[f.team] ?? 1) * a.hpMul * (bal?.hp ?? 1);
    const pct = f.maxHp > 0 ? f.hp / f.maxHp : 1;
    f.def = {
      ...b,
      atk: b.atk * atkMul,
      skillAtk: b.skillAtk === undefined ? undefined : b.skillAtk * atkMul,
      hp: Math.round((b.hp * hpMul) / 10) * 10,
      range: b.range * (1 + a.range),
      radius: b.radius * a.sizeMul,
      weight: b.weight * a.weightMul,
      speed: b.speed * (1 + a.speed),
    };
    f.maxHp = f.def.hp;
    if (keepPct) f.hp = Math.max(1, Math.round(f.maxHp * pct));
  }

  /** Give a team a card (draft or surge pick). */
  addCard(team: BattleSide, id: string) {
    if (!CARD_BY_ID.has(id) || (this.opts.royale && !this.livingSides().includes(team))) return [];
    const eventStart = this.events.length;
    for (const f of this.fighters) {
      if (f.team !== team) continue;
      f.cards.push(id);
      const wasKO = !this.alive(f);
      this.applyCards(f, true);
      if (wasKO) f.hp = 0;
      const a = CARD_BY_ID.get(id)!.aug;
      if (a.startShield && !wasKO) this.applyStatus(f, { kind: 'shield', duration: 999, value: f.maxHp * a.startShield }, f.idx);
    }
    this.emit({ type: 'card', team, id });
    return this.events.slice(eventStart);
  }

  /** Card picks are in: carry on fighting. */
  resume() {
    this.paused = false;
  }

  /** Quietly add or refresh a timed buff (no status event: used for frequent card procs). */
  private buffQuiet(f: Fighter, kind: StatusKind, dur: number) {
    const s = this.status(f, kind);
    if (s) s.remaining = Math.max(s.remaining, dur);
    else f.statuses.push({ kind, remaining: dur, stacks: 1, tickTimer: 0.5, value: 0.3, sourceIdx: f.idx });
  }

  private gainRage(f: Fighter, amount: number) {
    if (!this.alive(f) || f.special === 'ready' || (f.state === 'cast' && f.casting === 'special')) return;
    f.rage = Math.min(RAGE.max, f.rage + amount * f.aug.rageMul);
    if (f.rage >= RAGE.max) {
      f.special = 'ready';
      this.emit({ type: 'specialReady', a: f.idx });
    }
  }

  private makeFighter(def: FighterDef, team: BattleSide, x: number, y: number): Fighter {
    return {
      idx: this.fighters.length,
      team,
      def: { ...def },
      baseDef: def,
      rage: 0,
      cards: [],
      aug: augOf([]),
      augS: {},
      x, y, px: x, py: y,
      vx: 0, vy: 0,
      face: team === 0 ? 0 : Math.PI,
      hp: def.hp,
      maxHp: def.hp,
      guard: C.guardMax,
      guardRegenDelay: 0,
      state: 'move',
      stateT: 0,
      stateDur: 0,
      attackCd: this.rng.range(0.2, 0.7),
      activeCd: def.active.cooldown * this.rng.range(0.35, 0.6),
      special: 'locked',
      casting: null,
      kit: {},
      statuses: [],
      ccHistory: [],
      targetIdx: -1,
      stats: {
        damageDealt: 0, healing: 0, swings: 0, hits: 0, crits: 0, misses: 0, blocks: 0, parries: 0,
        guardBreaks: 0, charges: 0, interrupts: 0, dodges: 0, actives: 0, specials: 0,
      },
    };
  }

  emit(e: SimEvent) {
    this.events.push(e);
  }

  alive(f: Fighter) {
    return f.state !== 'ko';
  }

  livingSides(): BattleSide[] {
    return [...new Set(this.fighters.filter((f) => this.alive(f)).map((f) => f.team))];
  }

  enemiesOf(f: Fighter) {
    return this.fighters.filter((o) => o.team !== f.team && this.alive(o));
  }

  alliesOf(f: Fighter) {
    return this.fighters.filter((o) => o.team === f.team && this.alive(o));
  }

  foeOf(f: Fighter): Fighter | undefined {
    const b = this.fighters[f.targetIdx];
    return b && this.alive(b) ? b : undefined;
  }

  dist(a: Fighter, b: Fighter) {
    return dhypot(b.x - a.x, b.y - a.y);
  }

  /** Run `fn` after `delay` sim-seconds (deterministic order). */
  after(delay: number, fn: () => void) {
    this.timers.push({ at: this.t + delay, seq: this.seq++, fn });
  }

  fx(fx: FxKind, a: number, b: number, x: number, y: number, angle = 0, dur = 0, color?: number, prop?: string) {
    this.emit({ type: 'fx', fx, a, b, x, y, angle, dur, color, prop });
  }

  note(b: Fighter, text: string, color: number) {
    this.emit({ type: 'note', b: b.idx, text, color });
  }

  spawnHazard(h: Omit<Hazard, 'id' | 'age' | 'dead' | 'data'> & { data?: Record<string, number> }) {
    const hz: Hazard = { ...h, data: h.data ?? {}, id: ++this.hazardId, age: 0, dead: false };
    this.hazards.push(hz);
    this.emit({ type: 'hazard', action: 'spawn', id: hz.id, kind: hz.kind, x: hz.x, y: hz.y });
    return hz;
  }

  // ---------- stat modifiers (buffs / debuffs) ----------

  has(f: Fighter, kind: StatusKind) {
    return f.statuses.some((s) => s.kind === kind);
  }

  status(f: Fighter, kind: StatusKind) {
    return f.statuses.find((s) => s.kind === kind);
  }

  atkOf(f: Fighter, base = f.def.atk) {
    const a = f.aug;
    let m = (this.has(f, 'spicy') ? 1.2 : 1) * (1 + a.atk + (a.lowHpAtk && f.hp < f.maxHp * 0.5 ? a.lowHpAtk : 0) + Math.min(0.4, (f.augS.grudge ?? 0) * a.grudge));
    const w = this.status(f, 'weaken');
    if (w) m *= 1 - w.value;
    const e = this.status(f, 'empower');
    if (e) m *= 1 + e.value;
    return base * m * (kitOf(f).atkMul?.(this, f) ?? 1);
  }

  defOf(f: Fighter) {
    let d = (f.def.def * (1 + f.aug.def) + f.aug.defFlat) * (this.has(f, 'hearty') ? 1.2 : 1) + (this.has(f, 'hearty') ? 8 : 0);
    if (this.has(f, 'fortify')) d = d * 1.5 + 15;
    const ab = this.status(f, 'armorBreak');
    if (ab) d *= 1 - ab.value;
    return d * (kitOf(f).defMul?.(this, f) ?? 1);
  }

  /** swing rhythm multiplier (>1 = faster) */
  rhythmOf(f: Fighter) {
    let r = (this.has(f, 'light') ? 1.2 : 1) * (1 + f.aug.atkSpeed + this.flowOf(f));
    if (this.has(f, 'haste')) r *= 1.3;
    if (this.has(f, 'glitch')) r *= 0.7;
    return r * (kitOf(f).rhythmMul?.(this, f) ?? 1);
  }

  /** Flow State: a bonus while above 70% HP */
  private flowOf(f: Fighter) {
    return f.aug.flow && f.hp > f.maxHp * 0.7 ? f.aug.flow : 0;
  }

  accuracyOf(f: Fighter) {
    let a = f.def.accuracy + f.aug.acc;
    if (this.has(f, 'blind')) a *= 0.5;
    if (this.has(f, 'confuse')) a *= 0.7;
    return a;
  }

  evasionOf(f: Fighter) {
    return f.def.evasion + f.aug.eva + (kitOf(f).evasionBonus?.(this, f) ?? 0);
  }

  critOf(f: Fighter) {
    return f.def.critChance + f.aug.crit + (kitOf(f).critBonus?.(this, f) ?? 0);
  }

  /** untouchable right now (burrowed, invulnerable) */
  untargetable(f: Fighter) {
    return this.has(f, 'invuln') || !!kitOf(f).hidden?.(this, f);
  }

  /** CC-immune (Mech Suit, Last Stand) */
  armored(f: Fighter) {
    return this.has(f, 'superArmor');
  }

  // ---------- main step ----------

  /** Advance one fixed tick; returns the events produced. */
  step(): SimEvent[] {
    this.events = [];
    if (this.over || this.paused) return this.events;
    if (this.t >= this.nextSurge) {
      // gacha: everyone stops for a card pick; the game layer calls addCard() then resume()
      this.nextSurge += this.surgeEvery;
      this.paused = true;
      this.emit({ type: 'surge', n: ++this.surges });
      return this.events;
    }
    this.t += DT;
    this.tick++;
    if (!this.overtime && this.opts.overtimeAt && this.t >= this.opts.overtimeAt) {
      this.overtime = true;
      this.emit({ type: 'overtime' });
    }

    for (const f of this.fighters) {
      f.px = f.x;
      f.py = f.y;
    }
    this.runTimers();
    for (const f of this.fighters) {
      if (!this.alive(f)) continue;
      this.updateTimers(f);
      if (!this.alive(f)) continue;
      this.pickTarget(f);
      kitOf(f).tick?.(this, f);
      if (!this.alive(f)) continue;
      think(this, f);
      this.updateState(f);
    }
    for (const f of this.fighters) if (this.alive(f)) this.move(f);
    this.collide();
    this.collideSolids();
    this.updateHazards();
    this.checkEnd();
    return this.events;
  }

  private runTimers() {
    if (!this.timers.length) return;
    const due = this.timers.filter((t) => t.at <= this.t + 1e-9).sort((a, b) => a.at - b.at || a.seq - b.seq);
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.at > this.t + 1e-9);
    for (const t of due) if (!this.over) t.fn();
  }

  private updateHazards() {
    for (const h of this.hazards) {
      if (h.dead) continue;
      h.age += DT;
      h.x += h.vx * DT;
      h.y += h.vy * DT;
      kitOf(this.fighters[h.owner]).hazardTick?.(this, h);
      if (!h.dead && h.age >= h.life) {
        h.dead = true;
        this.emit({ type: 'hazard', action: 'expire', id: h.id, kind: h.kind, x: h.x, y: h.y });
      }
    }
    this.hazards = this.hazards.filter((h) => !h.dead);
  }

  private pickTarget(f: Fighter) {
    let best = -1;
    let bd = Infinity;
    for (const o of this.enemiesOf(f)) {
      const d = this.dist(f, o);
      if (d < bd) {
        bd = d;
        best = o.idx;
      }
    }
    f.targetIdx = best;
  }

  setState(f: Fighter, s: FighterState, dur = 0) {
    if (f.state === 'cast' && s !== 'cast') f.casting = null;
    f.state = s;
    f.stateT = 0;
    f.stateDur = dur;
  }

  /** Free to start the next swing or skill? */
  actionable(f: Fighter) {
    return f.state === 'move';
  }

  targetInReach(f: Fighter, slack = 1) {
    const b = this.foeOf(f);
    if (!b || this.untargetable(b)) return false;
    return this.dist(f, b) - b.def.radius <= f.def.range * slack;
  }

  canStartSwing(f: Fighter) {
    const b = this.foeOf(f);
    if (!b || this.untargetable(b)) return false;
    const dx = b.x - f.x, dy = b.y - f.y;
    const reach = f.def.range + b.def.radius;
    if (dhypot(dx, dy) <= reach) return true;

    const vx = b.vx - f.vx, vy = b.vy - f.vy;
    const approach = -(dx * vx + dy * vy);
    if (approach <= 0) return false;

    // Use the short swing wind-up even for charges, when the bounce path is still predictable.
    const windup = f.def.windup / this.rhythmOf(f);
    const closest = Math.min(windup, approach / (vx * vx + vy * vy));
    return dhypot(dx + vx * closest, dy + vy * closest) <= reach;
  }

  // ---------- actions ----------

  startAttack(f: Fighter) {
    if (!this.actionable(f)) return;
    this.setState(f, 'windup', f.def.windup / this.rhythmOf(f));
    this.emit({ type: 'windup', a: f.idx });
  }

  startCharge(f: Fighter) {
    if (!this.actionable(f)) return;
    this.setState(f, 'charge', f.def.chargeTime);
    f.stats.charges++;
    this.emit({ type: 'chargeStart', a: f.idx });
  }

  castActive(f: Fighter) {
    const kit = kitOf(f);
    if (!this.actionable(f) || f.activeCd > 0 || this.has(f, 'silence')) return;
    f.activeCd = f.def.active.cooldown * f.aug.cdMul;
    f.stats.actives++;
    if (f.aug.healOnCast) this.heal(f, f.maxHp * f.aug.healOnCast);
    if (f.aug.hasteOnCast) this.buffQuiet(f, 'haste', f.aug.hasteOnCast);
    this.setState(f, 'cast', kit.active.castTime);
    f.casting = 'active';
    this.emit({ type: 'skill', a: f.idx, kind: 'active', name: f.def.active.name });
    kit.active.cast(this, f, this.foeOf(f));
    for (const o of this.enemiesOf(f)) kitOf(o).onEnemyCast?.(this, o, f);
  }

  castSpecial(f: Fighter) {
    const kit = kitOf(f);
    if (f.special !== 'ready' || f.state === 'stun' || !this.alive(f) || this.has(f, 'silence')) return;
    f.special = 'locked';
    f.rage = RAGE.max * f.aug.encore;
    f.stats.specials++;
    this.setState(f, 'cast', kit.special.castTime);
    f.casting = 'special';
    this.emit({ type: 'skill', a: f.idx, kind: 'special', name: f.def.special.name });
    kit.special.cast(this, f, this.foeOf(f));
  }

  // ---------- per-tick ----------

  private updateTimers(f: Fighter) {
    f.attackCd = Math.max(0, f.attackCd - DT * this.rhythmOf(f));
    f.activeCd = Math.max(0, f.activeCd - DT);
    f.stateT += DT;
    if (f.guardRegenDelay > 0) f.guardRegenDelay -= DT;
    else f.guard = Math.min(C.guardMax, f.guard + C.guardRegen * f.aug.guardRegenMul * DT);
    this.gainRage(f, RAGE.passive * DT);
    this.cardTimers(f);
    if (!this.alive(f)) return;

    for (const s of f.statuses) {
      s.remaining -= DT;
      if (s.kind === 'poison' || s.kind === 'burn' || s.kind === 'bleed') {
        s.tickTimer -= DT;
        if (s.tickTimer <= 0) {
          s.tickTimer += 0.5;
          const pctPerSec = s.kind === 'poison' ? 0.015 * s.stacks : s.kind === 'bleed' ? 0.012 * s.stacks : 0.02;
          const dmg = Math.max(1, Math.round(f.maxHp * pctPerSec * 0.5 * f.aug.dotTakenMul));
          this.emit({ type: 'dot', b: f.idx, kind: s.kind, dmg });
          this.damage(f, dmg, s.sourceIdx);
          if (!this.alive(f)) return;
        }
      }
    }
    const before = f.statuses.length;
    f.statuses = f.statuses.filter((s) => s.remaining > 0);
    if (f.statuses.length !== before) kitOf(f).statusesChanged?.(this, f);
  }

  private updateState(f: Fighter) {
    switch (f.state) {
      case 'windup':
        if (f.stateT >= f.stateDur) {
          this.strike(f, false);
          if (f.state === 'windup') this.setState(f, 'recover', f.def.recover / this.rhythmOf(f));
          f.attackCd = f.def.attackCooldown;
        }
        break;
      case 'charge':
        // fully charged: hold the blow until the bounce brings the foe into reach (or it fizzles)
        if (f.stateT >= f.stateDur && (this.targetInReach(f, 1.1) || f.stateT >= f.stateDur + C.chargeHold)) {
          this.emit({ type: 'chargeRelease', a: f.idx });
          this.strike(f, true);
          if (f.state === 'charge') this.setState(f, 'recover', C.heavyRecover);
          f.attackCd = f.def.attackCooldown;
        }
        break;
      case 'cast':
        kitOf(f).castTick?.(this, f, this.foeOf(f));
        if (f.state === 'cast' && f.stateT >= f.stateDur) this.setState(f, 'move');
        break;
      case 'recover':
      case 'stagger':
      case 'stun':
        if (f.stateT >= f.stateDur) this.setState(f, 'move');
        break;
    }
  }

  /** Timed card effects: regeneration, Aegis shields, Lightning Rod strikes. */
  private cardTimers(f: Fighter) {
    const a = f.aug, S = f.augS;
    if (a.regen) {
      S.regenT = (S.regenT ?? 0) + DT;
      if (S.regenT >= 1) {
        S.regenT -= 1;
        this.heal(f, f.maxHp * a.regen);
      }
    }
    if (a.aegis) {
      S.aegisT = (S.aegisT ?? 0) + DT;
      if (S.aegisT >= 18) {
        S.aegisT = 0;
        this.applyStatus(f, { kind: 'shield', duration: 8, value: f.maxHp * a.aegis }, f.idx);
        this.emit({ type: 'proc', a: f.idx, card: 'aegis' });
      }
    }
    if (a.lightningRod) {
      S.rodT = (S.rodT ?? 0) + DT;
      const t = this.foeOf(f);
      if (S.rodT >= 7 && t && !this.untargetable(t)) {
        S.rodT = 0;
        this.fx('bolt', f.idx, t.idx, t.x, t.y);
        this.emit({ type: 'proc', a: f.idx, card: 'lightning-rod', b: t.idx });
        this.skillHit(f, t, a.lightningRod, { knock: 120 });
      }
    }
  }

  /** Cruise speed for the current state: fighters never stop, they only slow down. */
  private cruise(f: Fighter) {
    let mul = 1;
    const slow = f.statuses.find((x) => x.kind === 'slow');
    if (slow) mul *= 1 - slow.value;
    if (this.has(f, 'wet') && !kitOf(f).ignoresWetSlow) mul *= 0.85;
    if (this.has(f, 'light')) mul *= 1.2;
    if (this.has(f, 'haste')) mul *= 1.3;
    if (this.has(f, 'root')) mul *= 0.08;
    mul *= 1 + this.flowOf(f);
    const stateMul: Partial<Record<FighterState, number>> = {
      windup: 0.85, charge: 0.45, recover: 0.85, stagger: 0.5, stun: 0.2, cast: 0.6,
    };
    return f.def.speed * (stateMul[f.state] ?? 1) * mul * (kitOf(f).speedMul?.(this, f) ?? 1);
  }

  private move(f: Fighter) {
    // relax speed toward cruise speed, keeping the direction (knockback decays, slow-downs recover)
    let sp = dhypot(f.vx, f.vy);
    if (sp < 1) {
      const a = this.rng.range(0, Math.PI * 2);
      f.vx = dcos(a);
      f.vy = dsin(a);
      sp = 1;
    }
    const k = 1 - dexp(-C.speedRelax * DT);
    const ns = sp + (this.cruise(f) - sp) * k;
    f.vx = (f.vx / sp) * ns;
    f.vy = (f.vy / sp) * ns;

    // charm pulls toward the caster; confuse jerks the heading around
    const charm = this.status(f, 'charm');
    if (charm) {
      const c = this.fighters[charm.sourceIdx];
      const a = datan2(c.y - f.y, c.x - f.x);
      const v = dhypot(f.vx, f.vy);
      f.vx += (dcos(a) * v - f.vx) * 0.12;
      f.vy += (dsin(a) * v - f.vy) * 0.12;
    } else if (this.has(f, 'confuse') && this.rng.chance(0.05)) {
      const a = this.rng.range(0, Math.PI * 2), v = dhypot(f.vx, f.vy);
      f.vx = dcos(a) * v;
      f.vy = dsin(a) * v;
    }

    // the weapon tracks the target; slower while committed to a swing
    const tgt = this.foeOf(f);
    if (tgt && f.state !== 'stun' && f.state !== 'stagger') {
      const want = datan2(tgt.y - f.y, tgt.x - f.x);
      const turn = f.state === 'windup' || f.state === 'charge' || f.state === 'recover' ? 6 * DT : 14 * DT;
      const d = angleDiff(f.face, want);
      f.face += Math.max(-turn, Math.min(turn, d));
    }

    f.x += f.vx * DT;
    f.y += f.vy * DT;

    // walls: reflect like a ball, with a little random spin so paths never repeat
    const r = f.def.radius;
    let nx = 0;
    let ny = 0;
    if (f.x < r) { f.x = r; nx = 1; }
    if (f.x > ARENA_W - r) { f.x = ARENA_W - r; nx = -1; }
    if (f.y < r) { f.y = r; ny = 1; }
    if (f.y > ARENA_H - r) { f.y = ARENA_H - r; ny = -1; }
    if (nx || ny) {
      const impact = Math.abs(nx * f.vx + ny * f.vy);
      if (nx && f.vx * nx < 0) f.vx = -f.vx;
      if (ny && f.vy * ny < 0) f.vy = -f.vy;
      const j = this.rng.range(-C.bounceJitter, C.bounceJitter);
      const c = dcos(j), s = dsin(j);
      const vx = f.vx * c - f.vy * s;
      const vy = f.vx * s + f.vy * c;
      if ((!nx || vx * nx > 0) && (!ny || vy * ny > 0)) {
        f.vx = vx;
        f.vy = vy;
      }
      if (impact > C.wallSlamSpeed) {
        const dmg = Math.round(f.maxHp * 0.025 + impact * 0.035);
        this.emit({ type: 'wallSlam', b: f.idx, dmg, x: f.x - nx * r, y: f.y - ny * r, nx, ny });
        this.damage(f, dmg, -1);
        if (this.alive(f)) this.applyStun(f, C.wallSlamStun);
      } else if (impact > 60) {
        this.emit({ type: 'bounce', a: f.idx, nx, ny, speed: impact, x: f.x - nx * r, y: f.y - ny * r });
      }
      if (f.aug.hasteOnBounce && impact > 60) this.buffQuiet(f, 'haste', f.aug.hasteOnBounce);
    }
  }

  /** Fighters bounce off solid hazards (the Builder's walls); hard impacts stun. */
  private collideSolids() {
    for (const h of this.hazards) {
      if (!h.solid || h.dead) continue;
      for (const f of this.fighters) {
        if (!this.alive(f) || kitOf(f).hidden?.(this, f)) continue;
        const dx = f.x - h.x, dy = f.y - h.y;
        const d = dhypot(dx, dy) || 0.001;
        const min = h.r + f.def.radius;
        if (d >= min) continue;
        const nx = dx / d, ny = dy / d;
        f.x = h.x + nx * min;
        f.y = h.y + ny * min;
        const vn = f.vx * nx + f.vy * ny;
        if (vn < 0) {
          f.vx -= 2 * vn * nx;
          f.vy -= 2 * vn * ny;
          kitOf(this.fighters[h.owner]).onSolidHit?.(this, h, f, -vn);
        }
      }
    }
  }

  /** Ball-to-ball collisions: separate, then elastic bounce weighted by fighter weight. */
  private collide() {
    const fs = this.fighters.filter((f) => this.alive(f) && !kitOf(f).hidden?.(this, f));
    for (let i = 0; i < fs.length; i++) {
      for (let j = i + 1; j < fs.length; j++) {
        const a = fs[i], b = fs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = dhypot(dx, dy) || 0.001;
        const min = a.def.radius + b.def.radius;
        if (d >= min) continue;
        const nx = dx / d, ny = dy / d;
        const ma = a.def.weight, mb = b.def.weight;
        const push = min - d;
        a.x -= nx * push * (mb / (ma + mb));
        a.y -= ny * push * (mb / (ma + mb));
        b.x += nx * push * (ma / (ma + mb));
        b.y += ny * push * (ma / (ma + mb));
        for (const f of [a, b]) {
          const r = f.def.radius;
          f.x = Math.max(r, Math.min(ARENA_W - r, f.x));
          f.y = Math.max(r, Math.min(ARENA_H - r, f.y));
        }
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) continue; // already separating
        const imp = (-(1 + C.bumpRestitution) * rel) / (1 / ma + 1 / mb);
        a.vx -= (imp / ma) * nx;
        a.vy -= (imp / ma) * ny;
        b.vx += (imp / mb) * nx;
        b.vy += (imp / mb) * ny;
        this.emit({ type: 'bump', a: a.idx, b: b.idx, x: a.x + nx * a.def.radius, y: a.y + ny * a.def.radius, force: -rel });
        kitOf(a).onBump?.(this, a, b, -rel);
        kitOf(b).onBump?.(this, b, a, -rel);
      }
    }
  }

  // ---------- combat ----------

  private hitPoint(a: Fighter, b: Fighter) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = dhypot(dx, dy) || 0.001;
    const ux = dx / d, uy = dy / d;
    return { d, ux, uy, hx: b.x - ux * b.def.radius * 0.6, hy: b.y - uy * b.def.radius * 0.6 };
  }

  /** A swing lands: if the foe is in reach, roll the attack table. */
  private strike(a: Fighter, heavy: boolean) {
    a.stats.swings++;
    const b = this.foeOf(a);
    const inReach = !!b && this.targetInReach(a);
    this.emit({ type: 'swing', a: a.idx, heavy, inReach });
    if (!inReach || !b) return;

    const { d, ux, uy, hx, hy } = this.hitPoint(a, b);
    const helpless = b.state === 'stun' || b.state === 'stagger';
    const rng = this.rng;
    const kit = kitOf(a);

    // 0. airborne (Pilot): the swing can't reach; that uses the airborne state up
    if (this.has(b, 'airborne')) {
      b.statuses = b.statuses.filter((x) => x.kind !== 'airborne');
      this.note(b, 'TOO HIGH!', 0xbfe8ff);
      this.emit({ type: 'miss', a: a.idx, b: b.idx, x: hx, y: hy });
      return;
    }

    // 1. dodge: the foe hops aside (can't while helpless or planted in a charge)
    if (!helpless && b.state !== 'charge' && rng.chance(this.evasionOf(b))) {
      this.dodge(a, b, ux, uy);
      return;
    }

    // 2. miss: accuracy falls off toward the edge of reach
    const edge = Math.min(1, Math.max(0, (d - b.def.radius) / a.def.range));
    const hitChance = (helpless ? 1 : this.accuracyOf(a)) * (1 - C.edgeMissPenalty * edge * edge);
    if (!rng.chance(hitChance)) {
      a.stats.misses++;
      this.emit({ type: 'miss', a: a.idx, b: b.idx, x: hx, y: hy });
      return;
    }

    const bonus = kit.strikeBonus?.(this, a, b, heavy) ?? 1;
    let dmg = this.atkOf(a) * (heavy ? a.def.chargeMult : 1) * bonus * (100 / (100 + this.defOf(b))) * rng.range(0.92, 1.08);
    const crit = !!kit.forceCrit?.(this, a) || rng.chance(this.critOf(a));
    if (crit) dmg *= C.critMult + a.aug.critDmg;

    // 3. block: charge beats block (guard break); otherwise parry or guard
    const canBlock = !helpless && b.state !== 'charge';
    if (canBlock && rng.chance(b.def.blockChance + b.aug.block + (kitOf(b).blockBonus ?? 0))) {
      b.guardRegenDelay = C.guardRegenDelay;
      if (b.aug.counter) b.augS.counter = 1;
      if (heavy) {
        this.guardBreak(a, b, dmg * 0.5, crit, hx, hy, ux, uy);
        kit.onLanded?.(this, a, b, false);
        return;
      }
      if (rng.chance(b.def.parryShare * (kitOf(b).parryMul ?? 1))) {
        b.stats.parries++;
        kitOf(b).onParryOrDodge?.(this, b);
        b.guard = Math.min(C.guardMax, b.guard + 10);
        this.setState(a, 'stagger', C.parryStagger);
        a.vx -= ux * 260;
        a.vy -= uy * 260;
        this.emit({ type: 'parry', a: a.idx, b: b.idx, x: hx, y: hy });
        return;
      }
      b.guard -= C.guardPerBlock;
      if (b.guard <= 0) {
        this.guardBreak(a, b, dmg * C.blockChip, crit, hx, hy, ux, uy);
        kit.onLanded?.(this, a, b, false);
        return;
      }
      b.stats.blocks++;
      kitOf(b).onBlock?.(this, b);
      const chip = Math.max(1, Math.round(dmg * C.blockChip));
      this.emit({ type: 'blocked', a: a.idx, b: b.idx, dmg: chip, x: hx, y: hy });
      a.stats.damageDealt += chip;
      this.damage(b, chip, a.idx);
      b.vx += (ux * 140) / b.def.weight;
      b.vy += (uy * 140) / b.def.weight;
      kit.onLanded?.(this, a, b, true);
      return;
    }

    // 4. clean hit (cards: Counter Clerk's riposte, Combo Breaker's every-Nth blow)
    let combo = false;
    if (a.augS.counter) {
      dmg *= 1 + a.aug.counter;
      a.augS.counter = 0;
    }
    if (a.aug.comboEvery) {
      a.augS.combo = (a.augS.combo ?? 0) + 1;
      if (a.augS.combo % a.aug.comboEvery === 0) {
        dmg *= 1.6;
        combo = true;
        this.emit({ type: 'proc', a: a.idx, card: 'combo-breaker', b: b.idx });
      }
    }
    this.dealHit(a, b, Math.round(dmg), crit, heavy || combo, false, hx, hy, ux, uy, heavy || combo ? C.knockHeavy : C.knockBasic);
    if (!this.alive(b)) return;
    if (a.aug.poisonChance && rng.chance(a.aug.poisonChance)) this.applyStatus(b, { kind: 'poison', duration: 4, stacks: 1 }, a.idx);
    if (a.aug.chain && rng.chance(a.aug.chain)) {
      this.emit({ type: 'proc', a: a.idx, card: 'chain-reaction', b: b.idx });
      for (const e of this.enemiesOf(a)) {
        this.fx('zap', a.idx, e.idx, e.x, e.y);
        this.skillHit(a, e, 0.45, { canCrit: false, knock: 60 });
      }
      if (!this.alive(b)) return;
    }
    if (b.state === 'charge') {
      // attack beats charge
      a.stats.interrupts++;
      this.setState(b, 'stagger', C.interruptStagger);
      this.emit({ type: 'interrupt', a: a.idx, b: b.idx });
    } else if (b.state !== 'stun' && b.state !== 'cast' && !this.armored(b)) {
      // flinch cancels a light wind-up; heavy fighters (poise) swing through basic hits
      const poise = !heavy && b.def.weight >= C.poiseWeight && b.state === 'windup';
      if (!poise) this.setState(b, 'stagger', heavy ? C.heavyFlinch : C.flinch);
    }
    const apply = heavy ? a.def.onCharge : a.def.onHit;
    if (apply && rng.chance(apply.chance ?? 1)) this.applyStatus(b, apply, a.idx);
    kit.onLanded?.(this, a, b, false);
  }

  private dodge(a: Fighter, b: Fighter, ux: number, uy: number) {
    b.stats.dodges++;
    kitOf(b).onParryOrDodge?.(this, b);
    const side = this.rng.chance(0.5) ? 1 : -1;
    b.vx += -uy * side * C.dodgeHop;
    b.vy += ux * side * C.dodgeHop;
    this.emit({ type: 'dodge', a: a.idx, b: b.idx, dx: -uy * side, dy: ux * side });
  }

  /**
   * Skill damage used by kits. Skills never miss and can't be blocked; actives can be
   * dodged (evasion), specials can't.
   */
  skillHit(a: Fighter, b: Fighter, pct: number, opts: SkillHitOpts = {}): boolean {
    if (!this.alive(b) || !this.alive(a) || this.untargetable(b)) return false;
    const { ux, uy, hx, hy } = this.hitPoint(a, b);
    if (kitOf(b).negateSkill?.(this, b, a)) return false;
    const helpless = b.state === 'stun' || b.state === 'stagger';
    if (opts.dodgeable && !helpless && b.state !== 'charge' && this.rng.chance(this.evasionOf(b))) {
      this.dodge(a, b, ux, uy);
      return false;
    }
    const def = this.defOf(b) * (1 - (opts.pierce ?? 0));
    let dmg = this.atkOf(a, a.def.skillAtk) * pct * (100 / (100 + def)) * this.rng.range(0.95, 1.05) * (kitOf(b).skillTakenMul?.(this, b, a) ?? 1);
    const crit = opts.canCrit !== false && this.rng.chance(this.critOf(a));
    if (crit) dmg *= C.critMult + a.aug.critDmg;
    dmg *= 1 + a.aug.skillDmg;
    const dir = opts.dir ?? { x: ux, y: uy };
    this.dealHit(a, b, Math.round(dmg), crit, pct >= 2, true, hx, hy, dir.x, dir.y, opts.knock ?? 220);
    if (!this.alive(b)) return true;
    if (b.state === 'charge') {
      a.stats.interrupts++;
      this.setState(b, 'stagger', C.interruptStagger);
      this.emit({ type: 'interrupt', a: a.idx, b: b.idx });
    }
    for (const s of opts.statuses ?? []) this.applyStatus(b, s, a.idx);
    if (opts.stun) this.applyStun(b, opts.stun);
    return true;
  }

  private guardBreak(a: Fighter, b: Fighter, dmg: number, crit: boolean, x: number, y: number, ux: number, uy: number) {
    b.guard = 0;
    a.stats.guardBreaks++;
    this.emit({ type: 'guardBreak', a: a.idx, b: b.idx, x, y });
    this.dealHit(a, b, Math.round(dmg), crit, true, false, x, y, ux, uy, C.knockHeavy);
    if (this.alive(b)) {
      // guard break always stuns fully (not reduced by diminishing returns)
      this.setState(b, 'stun', C.guardBreakStun);
      this.emit({ type: 'status', b: b.idx, kind: 'stun', stacks: 1 });
    }
  }

  /** Overtime ramp: +25% damage for every 10 s past the overtime mark. */
  private otMul() {
    return this.overtime ? 1 + ((this.t - this.opts.overtimeAt!) / 10) * 0.25 : 1;
  }

  private dealHit(a: Fighter, b: Fighter, dmg: number, crit: boolean, heavy: boolean, skill: boolean, x: number, y: number, ux: number, uy: number, knock: number) {
    dmg = Math.round(dmg * this.otMul());
    if (this.has(b, 'sleep')) {
      // the hit that wakes a sleeper lands harder
      dmg = Math.round(dmg * 1.5);
      b.statuses = b.statuses.filter((s) => s.kind !== 'sleep');
      if (b.state === 'stun') this.setState(b, 'move');
      this.note(b, 'WAKE-UP CALL', 0xffffff);
    }
    if (this.has(b, 'mark')) dmg = Math.round(dmg * (kitOf(a).markBonus ?? 1));
    if (a.aug.executioner && b.hp < b.maxHp * 0.3) dmg = Math.round(dmg * (1 + a.aug.executioner));
    if (crit && !skill) kitOf(a).onCrit?.(this, a, b);
    a.stats.hits++;
    if (crit) a.stats.crits++;
    a.stats.damageDealt += dmg;
    this.emit({ type: 'hit', a: a.idx, b: b.idx, dmg, crit, heavy, skill, x, y, dx: ux, dy: uy });
    const kb = (knock * (crit ? 1.3 : 1)) / b.def.weight;
    if (!this.armored(b) && !this.has(b, 'root')) {
      b.vx += ux * kb;
      b.vy += uy * kb;
    }
    this.gainRage(a, (dmg / b.maxHp) * RAGE.dealt);
    if (b.aug.grudge) b.augS.grudge = (b.augS.grudge ?? 0) + 1;
    this.damage(b, dmg, a.idx);
    if (kitOf(a).lifesteal) this.heal(a, dmg * (kitOf(a).lifesteal!(this, a)));
    if (a.aug.lifesteal) this.heal(a, dmg * a.aug.lifesteal);
    if (crit && a.aug.healOnCrit) this.heal(a, a.maxHp * a.aug.healOnCrit);
    if (crit && a.aug.burnOnCrit && this.alive(b)) this.applyStatus(b, { kind: 'burn', duration: a.aug.burnOnCrit }, a.idx);
    // Spiky Uniform / Reflective Vest send part of it back
    const back = skill ? b.aug.reflectSkill : b.aug.thorns;
    if (back && a !== b && this.alive(a)) this.damage(a, Math.round(dmg * back), b.idx);
  }

  /** Damage that ignores DEF (Foreclosure, Debt). Still respects shields and invulnerability. */
  trueDamage(a: Fighter, b: Fighter, amount: number) {
    if (!this.alive(b) || this.untargetable(b)) return;
    const { ux, uy, hx, hy } = this.hitPoint(a, b);
    this.dealHit(a, b, Math.round(amount), false, amount > b.maxHp * 0.15, true, hx, hy, ux, uy, 200);
  }

  damage(f: Fighter, dmg: number, _src: number) {
    if (!this.alive(f)) return;
    if (this.has(f, 'invuln')) return;
    const sh = this.status(f, 'shield');
    if (sh && dmg > 0) {
      const take = Math.min(sh.value, dmg);
      sh.value -= take;
      dmg -= take;
      this.emit({ type: 'shieldHit', b: f.idx, absorbed: Math.round(take) });
      if (sh.value <= 0) f.statuses = f.statuses.filter((s) => s !== sh);
      if (dmg <= 0) return;
    }
    dmg *= kitOf(f).damageTakenMul?.(this, f) ?? 1;
    f.hp -= dmg;
    if (this.has(f, 'lifeSupport') && f.hp < 1) f.hp = 1;
    kitOf(f).onDamaged?.(this, f, dmg);
    this.gainRage(f, (dmg / f.maxHp) * RAGE.taken);
    if (f.hp <= 0 && this.saveFromKO(f)) return;
    if (f.hp > 0 && f.aug.secondWind && !f.augS.secondWind && f.hp <= f.maxHp * 0.25) {
      f.augS.secondWind = 1;
      this.emit({ type: 'proc', a: f.idx, card: 'second-wind' });
      this.heal(f, f.maxHp * f.aug.secondWind);
    }
    if (f.hp <= 0) {
      f.hp = 0;
      this.setState(f, 'ko');
      f.statuses = [];
      f.special = 'locked';
      f.rage = 0;
      this.emit({ type: 'ko', b: f.idx });
      return;
    }
  }

  /** Golden Parachute / Phoenix: a once-per-fight escape from a knockout. */
  private saveFromKO(f: Fighter) {
    if (f.aug.parachute && !f.augS.parachute) {
      f.augS.parachute = 1;
      f.hp = 1;
      this.applyStatus(f, { kind: 'invuln', duration: 2 }, f.idx);
      this.emit({ type: 'proc', a: f.idx, card: 'golden-parachute' });
      return true;
    }
    if (f.aug.phoenix && !f.augS.phoenix) {
      f.augS.phoenix = 1;
      f.hp = 1;
      this.applyStatus(f, { kind: 'invuln', duration: 1.5 }, f.idx);
      this.emit({ type: 'proc', a: f.idx, card: 'phoenix' });
      this.fx('explosion', f.idx, f.idx, f.x, f.y, 0, 0, 0xff8a2a, 'fire');
      for (const e of this.enemiesOf(f)) if (this.dist(f, e) < 170) this.skillHit(f, e, 0.8, { canCrit: false, knock: 320 });
      this.after(1.5, () => this.alive(f) && this.heal(f, f.maxHp * f.aug.phoenix));
      return true;
    }
    return false;
  }

  heal(f: Fighter, amount: number) {
    if (!this.alive(f)) return;
    const amt = Math.round(Math.min(amount * (this.has(f, 'burn') ? 0.7 : 1) * (kitOf(f).healMul ?? 1) * (this.overtime ? 0.4 : 1), f.maxHp - f.hp));
    if (amt <= 0) return;
    f.hp += amt;
    f.stats.healing += amt;
    this.emit({ type: 'heal', b: f.idx, amount: amt });
  }

  cleanse(f: Fighter) {
    const had = f.statuses.some((s) => DEBUFFS.includes(s.kind));
    f.statuses = f.statuses.filter((s) => !DEBUFFS.includes(s.kind));
    if (had) this.emit({ type: 'cleanse', b: f.idx });
  }

  dispel(f: Fighter) {
    f.statuses = f.statuses.filter((s) => !BUFFS.includes(s.kind));
  }

  applyStatus(b: Fighter, s: StatusApply, src: number) {
    if (!this.alive(b)) return;
    const kind: StatusKind = s.kind;
    if (kitOf(b).immune?.includes(kind) || (CC.includes(kind) && this.armored(b))) {
      this.note(b, 'IMMUNE', 0xffffff);
      return;
    }
    if (CC.includes(kind) && b.aug.ccMul !== 1) s = { ...s, duration: s.duration * b.aug.ccMul };
    if (kind === 'sleep') {
      // sleep = a stun that breaks on damage (no diminishing returns on the status itself)
      this.setState(b, 'stun', s.duration);
    }
    // elemental rules: wet puts out burn, burn can't take hold on a wet target
    if (kind === 'burn' && this.has(b, 'wet')) {
      this.note(b, 'FIZZLE', 0x9fd8ff);
      return;
    }
    if (kind === 'wet') b.statuses = b.statuses.filter((x) => x.kind !== 'burn');
    const existing = b.statuses.find((x) => x.kind === kind);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, s.duration);
      if (kind === 'poison') existing.stacks = Math.min(5, existing.stacks + (s.stacks ?? 1));
      if (kind === 'bleed') existing.stacks = Math.min(3, existing.stacks + (s.stacks ?? 1));
      if (kind === 'slow' || kind === 'weaken' || kind === 'armorBreak' || kind === 'empower') existing.value = Math.max(existing.value, s.value ?? 0.3);
      if (kind === 'shield') existing.value += s.value ?? 0;
    } else {
      b.statuses.push({ kind, remaining: s.duration, stacks: s.stacks ?? 1, tickTimer: 0.5, value: s.value ?? 0.3, sourceIdx: src });
    }
    const st = b.statuses.find((x) => x.kind === kind)!;
    this.emit({ type: 'status', b: b.idx, kind, stacks: st.stacks });
  }

  /** Hard CC with diminishing returns: 100% → 50% → 25% within the CC window. */
  applyStun(f: Fighter, dur: number) {
    if (!this.alive(f)) return;
    if (this.armored(f) || this.has(f, 'invuln')) {
      this.note(f, 'IMMUNE', 0xffffff);
      return;
    }
    f.ccHistory = f.ccHistory.filter((t) => this.t - t < C.ccWindow);
    const mult = [1, 0.5, 0.25][Math.min(2, f.ccHistory.length)] * f.aug.ccMul;
    f.ccHistory.push(this.t);
    this.setState(f, 'stun', dur * mult);
    this.emit({ type: 'status', b: f.idx, kind: 'stun', stacks: 1 });
  }

  /** Short interrupt that is not hard CC (no diminishing returns). */
  stagger(f: Fighter, dur: number) {
    if (!this.alive(f) || f.state === 'stun' || this.armored(f)) return;
    this.setState(f, 'stagger', dur);
  }

  private checkEnd() {
    if (this.over) return;
    const sides = this.livingSides();
    if (sides.length < 2) {
      this.over = true;
      this.winner = sides[0] ?? -1;
      this.emit({ type: 'end', winner: this.winner, reason: 'ko' });
      return;
    }
    if (this.t >= this.timeLimit) {
      let bestHp = -Infinity;
      let winner: BattleSide | -1 = -1;
      for (const side of sides) {
        const fighters = this.fighters.filter((f) => f.team === side);
        const hp = fighters.reduce((sum, f) => sum + f.hp / f.maxHp, 0) / fighters.length;
        if (hp > bestHp) {
          bestHp = hp;
          winner = side;
        } else if (hp === bestHp) winner = -1;
      }
      this.over = true;
      this.winner = winner;
      this.emit({ type: 'end', winner, reason: 'time' });
    }
  }
}
