import { DT } from './constants';
import type { Sim } from './sim';
import type { Fighter, Hazard, StatusKind } from './types';
import { KITS2 } from './kits2';
import { datan2, dcos, dhypot, dsin } from './dmath';

/**
 * Character kits: the behaviour behind each job's passive, active skill and special.
 * The player-facing text (simple + detailed) lives with the stats in src/data/roster.ts;
 * keep the numbers there in sync with the numbers here.
 *
 * Skill rules (all kits): skills never miss and can't be blocked. Actives can be
 * dodged (target's evasion). Specials can't be dodged and freeze time for a cutscene.
 */
export interface Kit {
  init?(sim: Sim, f: Fighter): void;
  /** passive logic every tick */
  tick?(sim: Sim, f: Fighter): void;
  /** damage multiplier for a swing that is about to connect */
  strikeBonus?(sim: Sim, a: Fighter, b: Fighter, heavy: boolean): number;
  /** a swing connected (clean hit or blocked) */
  onLanded?(sim: Sim, a: Fighter, b: Fighter, blocked: boolean): void;
  onDamaged?(sim: Sim, f: Fighter, dmg: number): void;
  onBump?(sim: Sim, f: Fighter, other: Fighter, force: number): void;
  critBonus?(sim: Sim, f: Fighter): number;
  speedMul?(sim: Sim, f: Fighter): number;
  immune?: StatusKind[];
  atkMul?(sim: Sim, f: Fighter): number;
  defMul?(sim: Sim, f: Fighter): number;
  rhythmMul?(sim: Sim, f: Fighter): number;
  evasionBonus?(sim: Sim, f: Fighter): number;
  blockBonus?: number;
  parryMul?: number;
  /** guaranteed crit on the next swing (Waiter) */
  forceCrit?(sim: Sim, f: Fighter): boolean;
  /** damage multiplier this attacker gets against a marked target */
  markBonus?: number;
  healMul?: number;
  /** share of damage dealt that heals the attacker */
  lifesteal?(sim: Sim, f: Fighter): number;
  damageTakenMul?(sim: Sim, f: Fighter): number;
  /** multiplier on skill damage this fighter takes from `from` (Teacher) */
  skillTakenMul?(sim: Sim, f: Fighter, from: Fighter): number;
  /** return true to cancel an incoming skill hit (Lawyer's Objection) */
  negateSkill?(sim: Sim, f: Fighter, from: Fighter): boolean;
  onEnemyCast?(sim: Sim, f: Fighter, caster: Fighter): void;
  onParryOrDodge?(sim: Sim, f: Fighter): void;
  onBlock?(sim: Sim, f: Fighter): void;
  /** burrowed / out of play: can't be hit, doesn't collide */
  hidden?(sim: Sim, f: Fighter): boolean;
  /** skip swinging this tick (reloading, burrowed…) */
  noSwing?(sim: Sim, f: Fighter): boolean;
  /** a fighter bounced off one of this kit's solid hazards */
  onSolidHit?(sim: Sim, h: Hazard, f: Fighter, speed: number): void;
  /** a swing (not a skill) of this fighter crit */
  onCrit?(sim: Sim, a: Fighter, b: Fighter): void;
  ignoresWetSlow?: boolean;
  statusesChanged?(sim: Sim, f: Fighter): void;
  hazardTick?(sim: Sim, h: Hazard): void;
  /** runs every tick while the fighter is in its 'cast' state */
  castTick?(sim: Sim, f: Fighter, foe?: Fighter): void;
  active: { castTime: number; canCast(sim: Sim, f: Fighter, foe?: Fighter): boolean; cast(sim: Sim, f: Fighter, foe?: Fighter): void };
  special: { castTime: number; cast(sim: Sim, f: Fighter, foe?: Fighter): void };
}

const gap = (sim: Sim, f: Fighter, foe: Fighter) => sim.dist(f, foe) - foe.def.radius;
const pct = (f: Fighter, p: number) => f.maxHp * p;
const angleTo = (f: Fighter, foe: Fighter) => datan2(foe.y - f.y, foe.x - f.x);

// ---------------------------------------------------------------- Chef
const CHEF_BUFFS: StatusKind[] = ['spicy', 'hearty', 'light'];
const chef: Kit = {
  onLanded(sim, a) {
    a.kit.ingredients = (a.kit.ingredients ?? 0) + 1;
    if (a.kit.ingredients >= 4) {
      a.kit.ingredients = 0;
      const buff = CHEF_BUFFS[Math.floor(sim.rng.next() * 3)];
      sim.fx('feast', a.idx, a.idx, a.x, a.y);
      sim.heal(a, pct(a, 0.06));
      sim.applyStatus(a, { kind: buff, duration: 6 }, a.idx);
    }
  },
  active: {
    castTime: 0.35,
    canCast: (sim, f, foe) => !!foe && gap(sim, f, foe) <= f.def.range * 1.25,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('cone', f.idx, foe.idx, f.x, f.y, angleTo(f, foe), 0.4);
      sim.skillHit(f, foe, 1.25, { dodgeable: true, knock: 260, statuses: [{ kind: 'burn', duration: 2.5 }] });
    },
  },
  special: {
    castTime: 0.6,
    cast(sim, f) {
      sim.fx('feast', f.idx, f.idx, f.x, f.y, 0, 1);
      sim.heal(f, pct(f, 0.2));
      sim.cleanse(f);
      for (const b of CHEF_BUFFS) sim.applyStatus(f, { kind: b, duration: 8 }, f.idx);
    },
  },
};

// ---------------------------------------------------------------- Firefighter
const firefighter: Kit = {
  immune: ['burn'],
  ignoresWetSlow: true,
  active: {
    castTime: 1.5,
    canCast: (sim, f, foe) => !!foe && gap(sim, f, foe) <= 330,
    cast(_sim, f) {
      f.kit.hoseTicks = 0;
      f.statuses = f.statuses.filter((s) => s.kind !== 'burn');
    },
  },
  castTick(sim, f, foe) {
    if (f.casting !== 'active') return;
    const n = Math.floor(f.stateT / 0.25);
    if (n <= (f.kit.hoseTicks ?? 0) || n > 6) return;
    f.kit.hoseTicks = n;
    if (!foe) return;
    sim.fx('stream', f.idx, foe.idx, f.x, f.y, angleTo(f, foe), 0.25);
    if (gap(sim, f, foe) <= 380) {
      sim.skillHit(f, foe, 0.36, { canCrit: false, knock: 170, statuses: [{ kind: 'wet', duration: 4 }] });
    }
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      foe.statuses = foe.statuses.filter((s) => s.kind !== 'wet'); // flash-boils the water off first
      sim.fx('explosion', f.idx, foe.idx, foe.x, foe.y, 0, 0.6);
      sim.skillHit(f, foe, 3.0, { knock: 700, statuses: [{ kind: 'burn', duration: 4 }] });
    },
  },
};

// ---------------------------------------------------------------- Electrician
const electrician: Kit = {
  strikeBonus(_sim, a) {
    a.kit.armed = ((a.kit.landed ?? 0) + 1) % 4 === 0 ? 1 : 0;
    return a.kit.armed ? 1.6 : 1;
  },
  onLanded(sim, a, b) {
    a.kit.landed = (a.kit.landed ?? 0) + 1;
    if (!a.kit.armed) return;
    a.kit.armed = 0;
    sim.fx('zap', a.idx, b.idx, b.x, b.y);
    sim.note(b, 'SHOCK', 0xfff27a);
    if (sim.has(b, 'wet')) sim.applyStun(b, 1);
    else sim.stagger(b, 0.25);
  },
  active: {
    castTime: 0.3,
    canCast: (sim, f) => sim.hazards.filter((h) => h.owner === f.idx && h.kind === 'trap').length < 2,
    cast(sim, f) {
      sim.spawnHazard({ kind: 'trap', owner: f.idx, x: f.x, y: f.y, vx: 0, vy: 0, r: 44, life: 9 });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'trap' || h.age < 0.6) return;
    const owner = sim.fighters[h.owner];
    for (const e of sim.enemiesOf(owner)) {
      if (dhypot(e.x - h.x, e.y - h.y) > h.r + e.def.radius) continue;
      h.dead = true;
      sim.emit({ type: 'hazard', action: 'trigger', id: h.id, kind: h.kind, x: h.x, y: h.y });
      sim.fx('zap', owner.idx, e.idx, e.x, e.y);
      const d = dhypot(e.x - h.x, e.y - h.y) || 1;
      sim.skillHit(owner, e, 2.05, { canCrit: false, knock: 200, dir: { x: (e.x - h.x) / d, y: (e.y - h.y) / d }, stun: sim.has(e, 'wet') ? 2 : 1 });
      return;
    }
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('blackout', f.idx, foe.idx, foe.x, foe.y, 0, 4);
      sim.applyStatus(foe, { kind: 'blind', duration: 4 }, f.idx);
      for (let i = 0; i < 5; i++) {
        sim.after(0.4 + i * 0.6, () => {
          const t = sim.foeOf(f);
          if (!t || !sim.alive(f)) return;
          sim.fx('bolt', f.idx, t.idx, t.x, t.y);
          sim.skillHit(f, t, 0.9, { knock: 120, canCrit: false });
          if (sim.has(t, 'wet')) sim.applyStun(t, 0.6);
          else sim.stagger(t, 0.25);
        });
      }
    },
  },
};

// ---------------------------------------------------------------- Nurse
const nurse: Kit = {
  tick(sim, f) {
    f.kit.triage = (f.kit.triage ?? 0) + DT;
    if (f.kit.triage >= 6) {
      f.kit.triage -= 6;
      const allies = sim.alliesOf(f);
      const low = allies.reduce((m, a) => (a.hp / a.maxHp < m.hp / m.maxHp ? a : m), f);
      sim.heal(low, pct(low, low === f ? 0.02 : 0.03));
    }
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => !!foe && gap(sim, f, foe) <= f.def.range * 1.1,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('zap', f.idx, foe.idx, foe.x, foe.y);
      sim.skillHit(f, foe, 1.65, { dodgeable: true, stun: 0.9, knock: 160 });
      sim.heal(f, pct(f, 0.065));
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      sim.fx('heartbeat', f.idx, f.idx, f.x, f.y, 0, 5);
      sim.applyStatus(f, { kind: 'lifeSupport', duration: 5 }, f.idx);
      sim.after(5, () => {
        if (!sim.alive(f)) return;
        sim.fx('heartbeat', f.idx, f.idx, f.x, f.y, 0, 0.6);
        sim.heal(f, pct(f, 0.2));
      });
    },
  },
};

// ---------------------------------------------------------------- Courier
const courier: Kit = {
  tick(_sim, f) {
    const sp = dhypot(f.vx, f.vy);
    if (sp >= f.def.speed * 0.9 && (f.state === 'move' || f.state === 'windup' || f.state === 'recover')) {
      f.kit.momT = (f.kit.momT ?? 0) + DT;
      if (f.kit.momT >= 0.5) {
        f.kit.momT -= 0.5;
        f.kit.momentum = Math.min(8, (f.kit.momentum ?? 0) + 1);
      }
    }
  },
  strikeBonus: (_sim, a) => 1 + 0.1 * (a.kit.momentum ?? 0),
  onLanded(_sim, a) {
    a.kit.momentum = 0;
  },
  speedMul: (_sim, f) => (f.state === 'cast' && f.casting === 'active' ? 2.6 : 1),
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => !!foe && sim.dist(f, foe) < 430,
    cast(sim, f, foe) {
      if (!foe) return;
      const a = angleTo(f, foe);
      f.vx = dcos(a) * 950;
      f.vy = dsin(a) * 950;
      f.kit.rammed = 0;
      sim.fx('ram', f.idx, foe.idx, f.x, f.y, a, 0.4);
    },
  },
  castTick(sim, f, foe) {
    if (f.casting !== 'active' || f.kit.rammed || !foe) return;
    if (sim.dist(f, foe) > f.def.radius + foe.def.radius + 14) return;
    f.kit.rammed = 1;
    const mult = 1 + 0.1 * (f.kit.momentum ?? 0);
    f.kit.momentum = 0;
    sim.skillHit(f, foe, 1.25 * mult, { dodgeable: true, knock: 480 });
  },
  special: {
    castTime: 0.4,
    cast(sim, f) {
      for (let i = 0; i < 3; i++) {
        sim.after(0.15 + i * 0.55, () => {
          const t = sim.foeOf(f);
          if (!t || !sim.alive(f)) return;
          const dir = i % 2 === 0 ? 1 : -1;
          sim.fx('truck', f.idx, t.idx, t.x, t.y, dir > 0 ? 0 : Math.PI, 0.45);
          sim.skillHit(f, t, 1.5, { knock: 600, dir: { x: dir, y: 0 }, canCrit: false });
        });
      }
      sim.after(1.85, () => {
        const t = sim.foeOf(f);
        if (!t || !sim.alive(f)) return;
        sim.fx('bomb', f.idx, t.idx, t.x, t.y);
        sim.skillHit(f, t, 0.6, { stun: 1, knock: 150, canCrit: false });
      });
    },
  },
};

// ---------------------------------------------------------------- Fisher
const fisher: Kit = {
  tick(_sim, f) {
    f.kit.calm = (f.kit.calm ?? 0) + DT;
  },
  onDamaged(_sim, f) {
    f.kit.calm = 0;
  },
  critBonus: (_sim, f) => Math.min(0.4, 0.04 * Math.floor(f.kit.calm ?? 0)),
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => !!foe && sim.dist(f, foe) > 170 && sim.dist(f, foe) < 470,
    cast(sim, f, foe) {
      if (!foe) return;
      const a = angleTo(f, foe);
      sim.spawnHazard({ kind: 'hook', owner: f.idx, x: f.x, y: f.y, vx: dcos(a) * 1000, vy: dsin(a) * 1000, r: 22, life: 0.55 });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'hook') return;
    const owner = sim.fighters[h.owner];
    const foe = sim.foeOf(owner);
    if (!foe || !sim.alive(owner)) {
      h.dead = true;
      return;
    }
    if (dhypot(foe.x - h.x, foe.y - h.y) > h.r + foe.def.radius) return;
    h.dead = true;
    sim.emit({ type: 'hazard', action: 'trigger', id: h.id, kind: h.kind, x: h.x, y: h.y });
    if (sim.skillHit(owner, foe, 1.2, { dodgeable: true, knock: 0 })) {
      const a = datan2(owner.y - foe.y, owner.x - foe.x);
      foe.vx = dcos(a) * 700;
      foe.vy = dsin(a) * 700;
      sim.fx('pull', owner.idx, foe.idx, foe.x, foe.y, a, 0.4);
      sim.applyStun(foe, 0.35);
    }
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('fish', f.idx, foe.idx, foe.x, foe.y, 0, 0.6);
      sim.after(0.6, () => {
        const t = sim.foeOf(f);
        if (!t || !sim.alive(f)) return;
        sim.fx('splash', f.idx, t.idx, t.x, t.y);
        sim.skillHit(f, t, 3.4, { knock: 260, stun: 1, statuses: [{ kind: 'wet', duration: 4 }] });
      });
    },
  },
};

const NONE: Kit = {
  active: { castTime: 0, canCast: () => false, cast: () => {} },
  special: { castTime: 0, cast: () => {} },
};

export const KITS: Record<string, Kit> = { chef, firefighter, electrician, nurse, courier, fisher, ...KITS2 };

export function kitOf(f: Fighter): Kit {
  return KITS[f.def.id] ?? NONE;
}
