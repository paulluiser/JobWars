import { ARENA_H, ARENA_W, DT } from './constants';
import type { Kit } from './kits';
import type { Sim } from './sim';
import type { Fighter, Hazard, StatusKind } from './types';
import { datan2, dcos, dhypot, dsin } from './dmath';

/**
 * M4 kits: the 24 jobs after the first six. Same rules as kits.ts (actives can be dodged,
 * specials can't; skills never miss and can't be blocked). Text + numbers: src/data/roster.ts.
 */

const gap = (sim: Sim, f: Fighter, foe: Fighter) => sim.dist(f, foe) - foe.def.radius;
const pct = (f: Fighter, p: number) => f.maxHp * p;
const angleTo = (f: Fighter, foe: { x: number; y: number }) => datan2(foe.y - f.y, foe.x - f.x);
const near = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) => dhypot(a.x - b.x, a.y - b.y) <= r;
const inReach = (sim: Sim, f: Fighter, foe: Fighter | undefined, k = 1) => !!foe && gap(sim, f, foe) <= f.def.range * k;
const within = (sim: Sim, f: Fighter, foe: Fighter | undefined, d: number) => !!foe && sim.dist(f, foe) <= d;
const mine = (sim: Sim, f: Fighter, kind: Hazard['kind']) => sim.hazards.filter((h) => h.owner === f.idx && h.kind === kind);
const clampArena = (x: number, y: number, m = 40) => ({ x: Math.max(m, Math.min(ARENA_W - m, x)), y: Math.max(m, Math.min(ARENA_H - m, y)) });
/** run `fn` n times, `gapS` apart, as long as both fighters are alive */
const volley = (sim: Sim, f: Fighter, n: number, gapS: number, fn: (t: Fighter, i: number) => void, delay = 0) => {
  for (let i = 0; i < n; i++)
    sim.after(delay + i * gapS, () => {
      const t = sim.foeOf(f);
      if (t && sim.alive(f)) fn(t, i);
    });
};

// ------------------------------------------------------------------ Farmer
const farmer: Kit = {
  tick(sim, f) {
    f.kit.seed = (f.kit.seed ?? 0) + DT;
    if (f.kit.seed >= 8) {
      f.kit.seed = 0;
      const crops = mine(sim, f, 'crop');
      if (crops.length >= 4) crops[0].dead = true;
      sim.spawnHazard({ kind: 'crop', owner: f.idx, x: f.x, y: f.y, vx: 0, vy: 0, r: 26, life: 60 });
    }
  },
  hazardTick(sim, h) {
    if (h.kind !== 'crop') return;
    const owner = sim.fighters[h.owner];
    const ripe = h.age >= 6;
    h.data.ripe = ripe ? 1 : 0;
    if (ripe && sim.alive(owner) && near(owner, h, h.r + owner.def.radius)) {
      h.dead = true;
      sim.emit({ type: 'hazard', action: 'trigger', id: h.id, kind: h.kind, x: h.x, y: h.y });
      sim.heal(owner, pct(owner, 0.06));
      return;
    }
    if (!ripe) for (const e of sim.enemiesOf(owner)) if (near(e, h, h.r + e.def.radius)) {
      h.dead = true; // trampled
      sim.note(e, 'TRAMPLED', 0xc9b28d);
    }
  },
  active: {
    castTime: 0.35,
    canCast: (sim, f, foe) => inReach(sim, f, foe, 1.2),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('slashx', f.idx, foe.idx, f.x, f.y, angleTo(f, foe), 0.3, 0xd9e6a0);
      sim.skillHit(f, foe, 1.4, { dodgeable: true, statuses: [{ kind: 'slow', duration: 2, value: 0.3 }] });
      for (const c of mine(sim, f, 'crop')) if (c.age >= 6 && near(f, c, 220)) {
        c.dead = true;
        sim.heal(f, pct(f, 0.06));
      }
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      for (const c of mine(sim, f, 'crop')) c.age = Math.max(c.age, 6);
      sim.heal(f, pct(f, 0.15));
      volley(sim, f, 6, 0.25, (t) => {
        sim.fx('drop', f.idx, t.idx, t.x, t.y, 0, 0.35, 0xf08a24, 'pumpkin');
        sim.after(0.35, () => {
          if (sim.alive(t)) {
            sim.skillHit(f, t, 0.8, { knock: 160, canCrit: false });
            sim.stagger(t, 0.3);
          }
        });
      }, 0.2);
    },
  },
};

// ------------------------------------------------------------------ Builder
const builder: Kit = {
  skillTakenMul: () => 0.75,
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 360) && mine(sim, f, 'wall').length < 2,
    cast(sim, f, foe) {
      if (!foe) return;
      const p = clampArena((f.x + foe.x) / 2, (f.y + foe.y) / 2, 50);
      sim.spawnHazard({ kind: 'wall', owner: f.idx, x: p.x, y: p.y, vx: 0, vy: 0, r: 34, life: 5, solid: true, data: { hp: pct(f, 0.3) } });
    },
  },
  onSolidHit(sim, h, f, speed) {
    if (f.team === sim.fighters[h.owner].team) return;
    if (speed > 300) {
      sim.applyStun(f, 0.8);
      sim.note(f, 'BONK!', 0xffd23f);
    }
  },
  special: {
    castTime: 0.6,
    cast(sim, f, foe) {
      if (!foe) return;
      for (const h of sim.hazards) h.dead = true;
      sim.fx('drop', f.idx, foe.idx, foe.x, foe.y, angleTo(f, foe), 0.3, 0x5a5a64, 'wreckingBall');
      sim.after(0.3, () => {
        const t = sim.foeOf(f);
        if (!t) return;
        sim.skillHit(f, t, 3.5, { knock: 750, statuses: [{ kind: 'armorBreak', duration: 5, value: 0.4 }] });
      });
    },
  },
};

// ------------------------------------------------------------------ Miner
const miner: Kit = {
  atkMul: (sim, f) => 1 + 0.05 * Math.min(5, f.kit.gems ?? 0) * ((f.kit.gemT ?? 0) > sim.t ? 1 : 0),
  hidden: (_sim, f) => f.state === 'cast' && f.casting === 'active' && f.stateT < 1.0,
  noSwing: (_sim, f) => f.state === 'cast',
  onLanded(sim, a) {
    if (sim.rng.chance(0.2)) {
      const p = clampArena(a.x + sim.rng.range(-80, 80), a.y + sim.rng.range(-80, 80));
      sim.spawnHazard({ kind: 'gem', owner: a.idx, x: p.x, y: p.y, vx: 0, vy: 0, r: 18, life: 10 });
    }
  },
  hazardTick(sim, h) {
    if (h.kind !== 'gem') return;
    const o = sim.fighters[h.owner];
    if (sim.alive(o) && near(o, h, h.r + o.def.radius)) {
      h.dead = true;
      sim.emit({ type: 'hazard', action: 'trigger', id: h.id, kind: h.kind, x: h.x, y: h.y });
      o.kit.gems = (o.kit.gemT ?? 0) > sim.t ? Math.min(5, (o.kit.gems ?? 0) + 1) : 1;
      o.kit.gemT = sim.t + 15;
      sim.note(o, `GEM ×${o.kit.gems}`, 0x7fe3ff);
    }
  },
  active: {
    castTime: 1.25,
    canCast: (sim, f, foe) => within(sim, f, foe, 520),
    cast(sim, f) {
      sim.fx('burst', f.idx, f.idx, f.x, f.y, 0, 0.4, 0x8a7560, 'dust');
      f.kit.popped = 0;
    },
  },
  castTick(sim, f, foe) {
    if (f.casting !== 'active' || f.kit.popped || f.stateT < 1.0 || !foe) return;
    f.kit.popped = 1;
    const p = clampArena(foe.x, foe.y + foe.def.radius + f.def.radius);
    f.x = p.x;
    f.y = p.y;
    f.px = f.x;
    f.py = f.y;
    sim.fx('burst', f.idx, foe.idx, f.x, f.y, 0, 0.4, 0x8a7560, 'dust');
    sim.skillHit(f, foe, 1.6, { dodgeable: true, knock: 260, dir: { x: 0, y: -1 }, stun: 0.75 });
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      volley(sim, f, 6, 0.3, (t) => {
        sim.fx('drop', f.idx, t.idx, t.x + sim.rng.range(-30, 30), t.y, 0, 0.3, 0x8a7560, 'boulder');
        sim.after(0.3, () => sim.alive(t) && sim.skillHit(f, t, 0.7, { knock: 80, canCrit: false }));
      });
      volley(sim, f, 1, 0, (t) => {
        sim.fx('drop', f.idx, t.idx, t.x, t.y, 0, 0.4, 0x5c4a3a, 'boulder');
        sim.after(0.4, () => sim.alive(t) && sim.skillHit(f, t, 0.6, { stun: 1.5, canCrit: false }));
      }, 2.0);
    },
  },
};

// ------------------------------------------------------------------ Welder
const welder: Kit = {
  rhythmMul: (sim, f) => ((f.kit.hotUntil ?? 0) > sim.t ? 1.15 : (f.kit.coolUntil ?? 0) > sim.t ? 0.8 : 1),
  onLanded(sim, a, b) {
    const hot = (a.kit.hotUntil ?? 0) > sim.t;
    if (hot) sim.applyStatus(b, { kind: 'burn', duration: 3 }, a.idx);
    else addHeat(sim, a, 10);
  },
  active: {
    castTime: 0.5,
    canCast: (sim, f, foe) => inReach(sim, f, foe, 1.2),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('cone', f.idx, foe.idx, f.x, f.y, angleTo(f, foe), 0.4);
      volley(sim, f, 3, 0.12, (t) => {
        if (inReach(sim, f, t, 1.4)) sim.skillHit(f, t, 0.5, { dodgeable: true, canCrit: false, knock: 60, statuses: [{ kind: 'burn', duration: 3 }] });
      });
      addHeat(sim, f, 30);
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.applyStatus(foe, { kind: 'root', duration: 2 }, f.idx);
      sim.fx('burst', f.idx, foe.idx, foe.x, foe.y, 0, 0.5, 0xff9a3c, 'fire');
      sim.after(0.4, () => {
        const t = sim.foeOf(f);
        if (t) sim.skillHit(f, t, 3, { knock: 120 });
        sim.applyStatus(f, { kind: 'shield', duration: 6, value: pct(f, 0.2) }, f.idx);
      });
    },
  },
};
function addHeat(sim: Sim, f: Fighter, n: number) {
  if ((f.kit.hotUntil ?? 0) > sim.t) return;
  f.kit.heat = (f.kit.heat ?? 0) + n;
  if (f.kit.heat >= 100) {
    f.kit.heat = 0;
    f.kit.hotUntil = sim.t + 4;
    f.kit.coolUntil = sim.t + 6;
    sim.note(f, 'OVERHEAT!', 0xff6a3a);
  }
}

// ------------------------------------------------------------------ Plumber
const plumber: Kit = {
  tick(sim, f) {
    f.kit.pipeT = (f.kit.pipeT ?? 0) + DT;
    if (f.kit.pipeT >= 12) {
      f.kit.pipeT = 0;
      const pipes = mine(sim, f, 'pipe');
      if (pipes.length >= 3) pipes[0].dead = true;
      sim.spawnHazard({ kind: 'pipe', owner: f.idx, x: f.x, y: f.y, vx: 0, vy: 0, r: 24, life: 999 });
    }
  },
  hazardTick(sim, h) {
    if (h.kind !== 'pipe' || h.age < 1) return;
    const o = sim.fighters[h.owner];
    if (!sim.alive(o) || (o.kit.warpT ?? 0) > sim.t || !near(o, h, h.r + o.def.radius * 0.6)) return;
    const others = mine(sim, o, 'pipe').filter((p) => p !== h && !p.dead);
    if (!others.length) return;
    const to = others[Math.floor(sim.rng.next() * others.length)];
    o.kit.warpT = sim.t + 1.5;
    sim.emit({ type: 'hazard', action: 'trigger', id: h.id, kind: h.kind, x: h.x, y: h.y });
    o.x = to.x;
    o.y = to.y;
    o.px = o.x;
    o.py = o.y;
    sim.emit({ type: 'hazard', action: 'trigger', id: to.id, kind: to.kind, x: to.x, y: to.y });
  },
  active: {
    castTime: 0.35,
    canCast: (sim, f, foe) => within(sim, f, foe, 300),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.2, 0xd62828);
      if (sim.skillHit(f, foe, 1, { dodgeable: true, knock: 0, statuses: [{ kind: 'silence', duration: 1.5 }] })) {
        const a = angleTo(foe, f);
        foe.vx = dcos(a) * 420;
        foe.vy = dsin(a) * 420;
      }
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('shockwave', f.idx, foe.idx, f.x, f.y, 0, 0.6, 0x6fc3ff);
      sim.fx('splash', f.idx, foe.idx, foe.x, foe.y);
      sim.dispel(foe);
      sim.skillHit(f, foe, 2.5, { knock: 800, statuses: [{ kind: 'wet', duration: 5 }] });
    },
  },
};

// ------------------------------------------------------------------ Mechanic
const mechanic: Kit = {
  atkMul: (sim, f) => ((f.kit.mechUntil ?? 0) > sim.t ? 2 : 1),
  onBlock: (sim, f) => scrap(sim, f),
  onParryOrDodge: (sim, f) => scrap(sim, f),
  onDamaged(sim, f) {
    if (sim.rng.chance(0.25)) scrap(sim, f);
  },
  active: {
    castTime: 0.5,
    canCast: (sim, f) => mine(sim, f, 'turret').length === 0,
    cast(sim, f) {
      sim.spawnHazard({ kind: 'turret', owner: f.idx, x: f.x, y: f.y, vx: 0, vy: 0, r: 24, life: 8 });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'turret') return;
    h.data.cd = (h.data.cd ?? 0.4) - DT;
    if (h.data.cd > 0) return;
    h.data.cd = 0.5;
    const o = sim.fighters[h.owner];
    const t = sim.foeOf(o);
    if (!t || !sim.alive(o) || !near(h, t, 380)) return;
    sim.fx('shot', o.idx, t.idx, h.x, h.y - 30, 0, 0.12, 0xffd23f);
    if (sim.skillHit(o, t, 0.4, { canCrit: false, knock: 40 })) {
      const s = sim.status(t, 'slow');
      sim.applyStatus(t, { kind: 'slow', duration: 3, value: Math.min(0.3, (s?.value ?? 0) + 0.05) }, o.idx);
    }
  },
  special: {
    castTime: 0.6,
    cast(sim, f) {
      f.kit.mechUntil = sim.t + 6;
      sim.applyStatus(f, { kind: 'fortify', duration: 6 }, f.idx);
      sim.applyStatus(f, { kind: 'superArmor', duration: 6 }, f.idx);
      sim.fx('burst', f.idx, f.idx, f.x, f.y, 0, 0.6, 0x9aa3ad);
    },
  },
};
function scrap(sim: Sim, f: Fighter) {
  f.kit.scrap = (f.kit.scrap ?? 0) + 1;
  if (f.kit.scrap >= 4) {
    f.kit.scrap = 0;
    const allies = sim.alliesOf(f);
    const low = allies.reduce((m, a) => (a.hp / a.maxHp < m.hp / m.maxHp ? a : m), f);
    sim.note(low, 'REPAIRED', 0x9aa3ad);
    sim.heal(low, pct(low, 0.06));
  }
}

// ------------------------------------------------------------------ Engineer
const engineer: Kit = {
  markBonus: 1.25,
  onLanded(sim, a, b) {
    a.kit.measure = (a.kit.measure ?? 0) + 1;
    if (a.kit.measure >= 3) {
      a.kit.measure = 0;
      sim.applyStatus(b, { kind: 'mark', duration: 4 }, a.idx);
    }
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 420),
    cast(sim, f, foe) {
      if (!foe) return;
      // the beam lands where the foe IS now; the bounce decides if it's still there in 0.8 s
      const spot = { x: foe.x, y: foe.y };
      sim.spawnHazard({ kind: 'beam', owner: f.idx, x: spot.x, y: spot.y, vx: 0, vy: 0, r: 60, life: 0.8 });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'beam' || h.age + DT < h.life) return;
    const o = sim.fighters[h.owner];
    sim.fx('drop', o.idx, o.idx, h.x, h.y, 0, 0.01, 0x9aa3ad, 'dust');
    for (const e of sim.enemiesOf(o)) if (near(e, h, h.r + e.def.radius * 0.5)) {
      sim.skillHit(o, e, 1.8, { stun: 1, knock: 100, dir: { x: 0, y: 1 } });
      sim.applyStatus(e, { kind: 'mark', duration: 4 }, o.idx);
    }
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.applyStatus(foe, { kind: 'root', duration: 2 }, f.idx);
      sim.fx('burst', f.idx, foe.idx, foe.x, foe.y, 0, 2, 0x3a86ff);
      sim.after(2, () => {
        const t = sim.foeOf(f);
        if (!t) return;
        sim.fx('explosion', f.idx, t.idx, t.x, t.y, 0, 0.6, 0x3a86ff);
        sim.skillHit(f, t, 3.5, { pierce: 0.5, knock: 400 });
      });
    },
  },
};

// ------------------------------------------------------------------ Pilot
const pilot: Kit = {
  tick(sim, f) {
    f.kit.calm = (f.kit.calm ?? 0) + DT;
    if (f.kit.calm >= 7 && !sim.has(f, 'airborne')) sim.applyStatus(f, { kind: 'airborne', duration: 99 }, f.idx);
  },
  onDamaged(_sim, f) {
    f.kit.calm = 0;
  },
  active: {
    castTime: 0.5,
    canCast: (sim, f, foe) => within(sim, f, foe, 460),
    cast(sim, f) {
      volley(sim, f, 3, 0.15, (t) => {
        sim.fx('shot', f.idx, t.idx, t.x, t.y, 0, 0.18, 0xffb347, 'fire');
        sim.skillHit(f, t, 0.8, { dodgeable: true, knock: 90, statuses: [{ kind: 'blind', duration: 2 }] });
      });
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      const dir = foe.x > ARENA_W / 2 ? -1 : 1;
      sim.fx('truck', f.idx, foe.idx, foe.x, foe.y - 220, dir > 0 ? 0 : Math.PI, 1.2, 0x7b4a2a);
      volley(sim, f, 5, 0.22, (t) => {
        sim.fx('explosion', f.idx, t.idx, t.x + sim.rng.range(-25, 25), t.y, 0, 0.4, 0xff8a2a, 'fire');
        sim.skillHit(f, t, 1, { knock: 140, canCrit: false, statuses: [{ kind: 'burn', duration: 3 }] });
      }, 0.3);
    },
  },
};

// ------------------------------------------------------------------ Merchant
const merchant: Kit = {
  onLanded: (sim, a) => earn(sim, a),
  onDamaged: (sim, f) => earn(sim, f),
  active: {
    castTime: 0.35,
    canCast: (sim, f, foe) => inReach(sim, f, foe, 1.5),
    cast(sim, f, foe) {
      if (!foe) return;
      const heads = sim.rng.chance(0.5);
      sim.note(f, heads ? 'HEADS!' : 'TAILS', 0xffd23f);
      sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.2, 0xffd23f, 'coins');
      if (heads) sim.skillHit(f, foe, 2, { dodgeable: true });
      else if (sim.skillHit(f, foe, 1, { dodgeable: true })) {
        const buff = foe.statuses.find((s) => ['spicy', 'hearty', 'light', 'shield', 'haste', 'empower', 'fortify'].includes(s.kind));
        if (buff) {
          foe.statuses = foe.statuses.filter((s) => s !== buff);
          f.statuses.push({ ...buff, sourceIdx: f.idx });
          sim.note(f, 'STOLEN!', 0xffd23f);
        }
      }
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      const gold = Math.max(10, f.kit.gold ?? 0);
      f.kit.gold = 0;
      sim.fx('burst', f.idx, foe.idx, foe.x, foe.y, 0, 1, 0xffd23f, 'coins');
      sim.skillHit(f, foe, 0.2 * gold, { knock: 300 });
      sim.heal(f, pct(f, 0.2));
    },
  },
};
function earn(sim: Sim, f: Fighter) {
  f.kit.gold = (f.kit.gold ?? 0) + 1;
  f.kit.bank = (f.kit.bank ?? 0) + 1;
  if (f.kit.bank < 10 || !sim.alive(f)) return;
  f.kit.bank = 0;
  const roll = sim.rng.next();
  const foe = sim.foeOf(f);
  if (roll < 0.34) {
    sim.note(f, 'BOUGHT: POTION', 0x6dff9a);
    sim.fx('burst', f.idx, f.idx, f.x, f.y, 0, 0.6, 0x6dff9a, 'potion');
    sim.heal(f, pct(f, 0.08));
  } else if (roll < 0.67 && foe) {
    sim.note(f, 'BOUGHT: BOMB', 0xff8a2a);
    sim.fx('bomb', f.idx, foe.idx, foe.x, foe.y);
    sim.skillHit(f, foe, 1.2, { knock: 200, canCrit: false });
  } else {
    sim.note(f, 'BOUGHT: WHETSTONE', 0xd8e0ea);
    sim.applyStatus(f, { kind: 'empower', duration: 6, value: 0.15 }, f.idx);
  }
}

// ------------------------------------------------------------------ Waiter
const waiter: Kit = {
  evasionBonus: () => 0.1,
  onParryOrDodge(_sim, f) {
    f.kit.crit = 1;
  },
  forceCrit(_sim, f) {
    if (!f.kit.crit) return false;
    f.kit.crit = 0;
    return true;
  },
  active: {
    castTime: 0.3,
    canCast: (sim, f, foe) => within(sim, f, foe, 480),
    cast(sim, f, foe) {
      if (!foe) return;
      const a = angleTo(f, foe);
      sim.spawnHazard({ kind: 'tray', owner: f.idx, x: f.x, y: f.y, vx: dcos(a) * 700, vy: dsin(a) * 700, r: 20, life: 2.5, data: { bounces: 3, hits: 3 } });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'tray') return;
    if (h.x < h.r || h.x > ARENA_W - h.r) { h.vx = -h.vx; h.x = Math.max(h.r, Math.min(ARENA_W - h.r, h.x)); h.data.bounces--; }
    if (h.y < h.r || h.y > ARENA_H - h.r) { h.vy = -h.vy; h.y = Math.max(h.r, Math.min(ARENA_H - h.r, h.y)); h.data.bounces--; }
    if (h.data.bounces < 0 || h.data.hits <= 0) { h.dead = true; return; }
    const o = sim.fighters[h.owner];
    if ((h.data.cool ?? 0) > h.age) return;
    for (const e of sim.enemiesOf(o)) if (near(e, h, h.r + e.def.radius)) {
      h.data.cool = h.age + 0.3;
      h.data.hits--;
      sim.skillHit(o, e, 0.9, { dodgeable: true, knock: 150, statuses: [{ kind: 'slow', duration: 2, value: 0.2 }] });
      // ricochet off the target toward its other side
      h.vx = -h.vx;
      h.vy = -h.vy;
    }
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      volley(sim, f, 10, 0.14, (t, i) => {
        sim.fx('shot', f.idx, t.idx, t.x, t.y, 0, 0.15, 0xffffff, i === 9 ? 'potion' : 'tray');
        sim.skillHit(f, t, 0.5, { knock: 50, canCrit: false, statuses: i === 9 ? [{ kind: 'burn', duration: 4 }] : [] });
      }, 0.1);
    },
  },
};

// ------------------------------------------------------------------ Cleaner
const cleaner: Kit = {
  tick(sim, f) {
    f.kit.tidy = (f.kit.tidy ?? 0) + DT;
    if (f.kit.tidy >= 6) {
      f.kit.tidy = 0;
      const d = f.statuses.find((s) => ['poison', 'burn', 'bleed', 'slow', 'wet', 'blind', 'root', 'silence', 'disarm', 'weaken', 'armorBreak', 'confuse', 'charm', 'glitch', 'mark'].includes(s.kind));
      if (d) {
        f.statuses = f.statuses.filter((s) => s !== d);
        sim.emit({ type: 'cleanse', b: f.idx });
      }
    }
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 300),
    cast(sim, f) {
      sim.spawnHazard({ kind: 'zone', owner: f.idx, x: f.x, y: f.y, vx: 0, vy: 0, r: 110, life: 5, data: { type: 0 } });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'zone') return;
    zoneTick(sim, h);
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      sim.cleanse(f);
      if (!foe) return;
      sim.fx('stream', f.idx, foe.idx, f.x, f.y, angleTo(f, foe), 0.4);
      sim.dispel(foe);
      sim.applyStatus(foe, { kind: 'poison', duration: 6, stacks: 5 }, f.idx);
      sim.skillHit(f, foe, 0.6, { knock: 120, canCrit: false });
    },
  },
};

/** Floor zones: 0 wet floor (Cleaner), 1 acid (Scientist), 2–4 paint red/blue/yellow (Artist). */
function zoneTick(sim: Sim, h: Hazard) {
  const o = sim.fighters[h.owner];
  h.data.tick = (h.data.tick ?? 0) - DT;
  const pulse = h.data.tick <= 0;
  if (pulse) h.data.tick = 0.5;
  for (const e of sim.enemiesOf(o)) {
    if (!near(e, h, h.r)) continue;
    switch (h.data.type) {
      case 0:
        sim.applyStatus(e, { kind: 'slow', duration: 0.6, value: 0.3 }, o.idx);
        if (pulse && sim.rng.chance(0.25)) {
          sim.note(e, 'SLIP!', 0x6fc3ff);
          sim.applyStun(e, 0.5);
        }
        break;
      case 1:
        sim.applyStatus(e, { kind: 'armorBreak', duration: 0.6, value: 0.2 }, o.idx);
        if (pulse && (h.data.p = (h.data.p ?? 0) + 1) % 2 === 0) sim.applyStatus(e, { kind: 'poison', duration: 4 }, o.idx);
        break;
      default:
        if (!pulse) break;
        sim.skillHit(o, e, 0.3, { canCrit: false, knock: 30 });
        if (h.data.type === 2) sim.applyStatus(e, { kind: 'burn', duration: 2 }, o.idx);
        if (h.data.type === 3) sim.applyStatus(e, { kind: 'slow', duration: 1, value: 0.2 }, o.idx);
        if (h.data.type === 4) sim.stagger(e, 0.2);
    }
  }
}

// ------------------------------------------------------------------ Tailor
const tailor: Kit = {
  onLanded: (sim, a, b) => thread(sim, a, b, 1),
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 420),
    cast(sim, f) {
      volley(sim, f, 5, 0.08, (t) => {
        sim.fx('shot', f.idx, t.idx, t.x, t.y, 0, 0.12, 0xdfe6ee, 'needle');
        if (sim.skillHit(f, t, 0.4, { dodgeable: true, canCrit: false, knock: 30, statuses: [{ kind: 'bleed', duration: 3 }] })) thread(sim, f, t, 1);
      });
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.applyStatus(foe, { kind: 'root', duration: 2.5 }, f.idx);
      sim.applyStatus(foe, { kind: 'silence', duration: 3 }, f.idx);
      sim.fx('slashx', f.idx, foe.idx, foe.x, foe.y, 0, 0.6, 0xffca3a);
      sim.after(0.6, () => {
        const t = sim.foeOf(f);
        if (t) sim.skillHit(f, t, 3, { knock: 260 });
      });
    },
  },
};
function thread(sim: Sim, a: Fighter, b: Fighter, n: number) {
  b.kit.thread = (b.kit.thread ?? 0) + n;
  if (b.kit.thread >= 5) {
    b.kit.thread = 0;
    sim.note(b, 'TIED UP', 0xffca3a);
    sim.applyStatus(b, { kind: 'root', duration: 1 }, a.idx);
  }
}

// ------------------------------------------------------------------ Barber
const barber: Kit = {
  critBonus: (sim, f) => ((f.kit.comboT ?? 0) > sim.t ? 0.05 * Math.min(6, f.kit.combo ?? 0) : 0),
  onLanded(sim, a) {
    a.kit.combo = (a.kit.comboT ?? 0) > sim.t ? (a.kit.combo ?? 0) + 1 : 1;
    a.kit.comboT = sim.t + 2;
  },
  onCrit(sim, a, b) {
    sim.applyStatus(b, { kind: 'bleed', duration: 3 }, a.idx);
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => inReach(sim, f, foe, 1.3),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('stream', f.idx, foe.idx, f.x, f.y, angleTo(f, foe), 0.4);
      foe.statuses = foe.statuses.filter((s) => s.kind !== 'shield');
      sim.skillHit(f, foe, 1, { dodgeable: true, knock: 520 });
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      volley(sim, f, 8, 0.12, (t, i) => {
        sim.fx('slashx', f.idx, t.idx, t.x, t.y, i * 0.8, 0.15, 0xffffff);
        sim.skillHit(f, t, 0.5, { knock: 30, canCrit: false });
        if (i === 7) {
          sim.note(t, 'BAD HAIR DAY', 0xe63946);
          sim.applyStatus(t, { kind: 'weaken', duration: 5, value: 0.3 }, f.idx);
          sim.applyStatus(t, { kind: 'silence', duration: 2 }, f.idx);
        }
      });
    },
  },
};

// ------------------------------------------------------------------ Doctor
const doctor: Kit = {
  healMul: 1.2,
  strikeBonus: (_sim, a, b) => (b.kit.diagnosedBy === a.idx + 1 ? 1.15 : 1),
  onLanded(sim, a, b) {
    if (b.kit.diagnosedBy !== a.idx + 1) {
      b.kit.diagnosedBy = a.idx + 1;
      sim.note(b, 'DIAGNOSED', 0x4ea8de);
    }
  },
  active: {
    castTime: 0.35,
    canCast: (sim, f, foe) => inReach(sim, f, foe, 1.2),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.22, 0x9fd8ff, 'needle');
      if (sim.skillHit(f, foe, 0.8, { dodgeable: true, knock: 60 })) sim.applyStatus(foe, { kind: 'sleep', duration: 1.5 }, f.idx);
    },
  },
  special: {
    castTime: 0.6,
    cast(sim, f) {
      const low = sim.alliesOf(f).reduce((m, a) => (a.hp / a.maxHp < m.hp / m.maxHp ? a : m), f);
      sim.applyStatus(low, { kind: 'invuln', duration: 1.5 }, f.idx);
      sim.fx('heartbeat', low.idx, low.idx, low.x, low.y, 0, 1);
      sim.heal(low, pct(low, 0.35) / 1.2);
      sim.cleanse(low);
    },
  },
};

// ------------------------------------------------------------------ Scientist
const HYPO: StatusKind[] = ['poison', 'slow', 'weaken'];
const scientist: Kit = {
  atkMul: (sim, f) => ((f.kit.hydeUntil ?? 0) > sim.t ? 1.6 : 1),
  lifesteal: (sim, f) => ((f.kit.hydeUntil ?? 0) > sim.t ? 0.3 : 0),
  onLanded(sim, a, b) {
    const k = Math.floor(sim.rng.next() * 3);
    const confirmed = a.kit.lastHypo === k + 1;
    a.kit.lastHypo = k + 1;
    const dur = confirmed ? 6 : 3;
    if (confirmed) sim.note(b, 'CONFIRMED!', 0x80ffdb);
    sim.applyStatus(b, { kind: HYPO[k], duration: dur, value: HYPO[k] === 'slow' ? 0.2 : 0.15 }, a.idx);
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 420),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('drop', f.idx, foe.idx, foe.x, foe.y, 0, 0.3, 0x80ff9a, 'flask');
      sim.spawnHazard({ kind: 'zone', owner: f.idx, x: foe.x, y: foe.y, vx: 0, vy: 0, r: 90, life: 4, data: { type: 1 } });
    },
  },
  hazardTick(sim, h) {
    if (h.kind === 'zone') zoneTick(sim, h);
  },
  special: {
    castTime: 0.7,
    cast(sim, f) {
      f.kit.hydeUntil = sim.t + 7;
      sim.applyStatus(f, { kind: 'empower', duration: 7, value: 0.001 }, f.idx); // shows the buff chip
      sim.fx('burst', f.idx, f.idx, f.x, f.y, 0, 0.8, 0x80ff9a);
      sim.note(f, 'TRANSFORMED!', 0x80ff9a);
    },
  },
};

// ------------------------------------------------------------------ Teacher
const teacher: Kit = {
  skillTakenMul(_sim, f, from) {
    // learns each opponent's skills: 10% less per time hit by them, max 30%
    const key = `learn${from.idx}`;
    const n = f.kit[key] ?? 0;
    f.kit[key] = Math.min(3, n + 1);
    return 1 - 0.1 * n;
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 420),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.2, 0xffffff);
      sim.skillHit(f, foe, 1.2, { dodgeable: true, knock: 120, statuses: [{ kind: 'confuse', duration: 2 }] });
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('drop', f.idx, foe.idx, foe.x, foe.y, 0, 0.3, 0x2a9d8f);
      sim.applyStatus(foe, { kind: 'root', duration: 3 }, f.idx);
      sim.applyStatus(foe, { kind: 'silence', duration: 3 }, f.idx);
      foe.activeCd = foe.def.active.cooldown;
      sim.note(foe, 'DETENTION', 0x2a9d8f);
    },
  },
};

// ------------------------------------------------------------------ Programmer
const programmer: Kit = {
  tick(_sim, f) {
    // remember HP for the rewind (sampled every 0.25 s, keep 2 s)
    f.kit.histT = (f.kit.histT ?? 0) + DT;
    if (f.kit.histT >= 0.25) {
      f.kit.histT = 0;
      for (let i = 7; i > 0; i--) f.kit[`h${i}`] = f.kit[`h${i - 1}`] ?? f.hp;
      f.kit.h0 = f.hp;
    }
  },
  onDamaged(sim, f, dmg) {
    if (dmg <= f.maxHp * 0.1 || (f.kit.undoT ?? -99) > sim.t - 30 || f.hp <= 0) return;
    f.kit.undoT = sim.t;
    const back = f.kit.h7 ?? f.maxHp;
    if (back > f.hp) {
      sim.fx('rewind', f.idx, f.idx, f.x, f.y, 0, 0.6, 0x4cc9f0);
      sim.note(f, 'CTRL+Z', 0x4cc9f0);
      f.hp = Math.min(f.maxHp, back);
    }
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 420),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.25, 0x4cc9f0);
      if (sim.skillHit(f, foe, 1, { dodgeable: true, knock: 80 })) {
        foe.activeCd += 2;
        sim.applyStatus(foe, { kind: 'glitch', duration: 3 }, f.idx);
      }
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('burst', f.idx, foe.idx, foe.x, foe.y, 0, 0.6, 0x3a86ff);
      sim.note(foe, 'BLUE SCREEN', 0x3a86ff);
      sim.dispel(foe);
      sim.applyStun(foe, 2.5);
      sim.applyStatus(f, { kind: 'haste', duration: 5 }, f.idx);
    },
  },
};

// ------------------------------------------------------------------ Accountant
const accountant: Kit = {
  onDamaged(_sim, f, dmg) {
    f.kit.debt = (f.kit.debt ?? 0) + dmg * 0.15;
  },
  tick(sim, f) {
    f.kit.payT = (f.kit.payT ?? 0) + DT;
    if (f.kit.payT < 6) return;
    f.kit.payT = 0;
    const foe = sim.foeOf(f);
    const owed = (f.kit.debt ?? 0) * 1.5;
    if (!foe || owed < 1) return;
    f.kit.debt = 0;
    sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.2, 0x43aa8b, 'coins');
    sim.note(foe, 'INTEREST DUE', 0x43aa8b);
    sim.trueDamage(f, foe, owed);
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 420),
    cast(sim, f, foe) {
      if (!foe) return;
      const buffs = foe.statuses.filter((s) => ['spicy', 'hearty', 'light', 'shield', 'haste', 'empower', 'fortify', 'lifeSupport'].includes(s.kind));
      foe.statuses = foe.statuses.filter((s) => !buffs.includes(s));
      if (buffs.length) sim.note(foe, `TAXED ×${buffs.length}`, 0x43aa8b);
      sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.2, 0x43aa8b);
      sim.skillHit(f, foe, 1 + 0.6 * buffs.length, { dodgeable: true });
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      const amount = (foe.maxHp - foe.hp) * 0.25 + (f.kit.debt ?? 0) * 2;
      f.kit.debt = 0;
      sim.fx('explosion', f.idx, foe.idx, foe.x, foe.y, 0, 0.6, 0x43aa8b);
      sim.trueDamage(f, foe, amount);
    },
  },
};

// ------------------------------------------------------------------ Lawyer
const lawyer: Kit = {
  tick(sim, f) {
    if ((f.kit.objT ?? 0) <= sim.t && !f.kit.objReady) f.kit.objReady = 1;
  },
  negateSkill(sim, f, from) {
    if (!f.kit.objReady) return false;
    f.kit.objReady = 0;
    f.kit.objT = sim.t + 12;
    sim.note(f, 'OBJECTION!', 0xe9c46a);
    sim.applyStatus(from, { kind: 'silence', duration: 1 }, f.idx);
    return true;
  },
  onEnemyCast(sim, f, caster) {
    if ((f.kit.contemptUntil ?? 0) > sim.t && f.kit.contemptOn === caster.idx + 1) {
      f.kit.contemptUntil = 0;
      sim.note(caster, 'CONTEMPT!', 0xe9c46a);
      sim.skillHit(f, caster, 2, { knock: 200 });
    }
  },
  active: {
    castTime: 0.35,
    canCast: (sim, f, foe) => inReach(sim, f, foe, 1.3),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('slashx', f.idx, foe.idx, foe.x, foe.y, datan2(foe.y - f.y, foe.x - f.x), 0, 0xe9c46a);
      sim.fx('drop', f.idx, foe.idx, foe.x, foe.y, 0, 0.02, 0x8a5a2b, 'gavel');
      if (sim.skillHit(f, foe, 1.3, { dodgeable: true })) {
        f.kit.contemptUntil = sim.t + 4;
        f.kit.contemptOn = foe.idx + 1;
        sim.note(foe, 'ON TRIAL', 0xe9c46a);
      }
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      const debuffs = foe.statuses.filter((s) => ['poison', 'burn', 'bleed', 'slow', 'wet', 'blind', 'root', 'silence', 'disarm', 'weaken', 'armorBreak', 'confuse', 'glitch', 'mark'].includes(s.kind)).length;
      sim.fx('drop', f.idx, foe.idx, foe.x, foe.y, 0, 0.3, 0x8a5a33, 'gavel');
      sim.after(0.3, () => {
        const t = sim.foeOf(f);
        if (t) sim.skillHit(f, t, 2 + 0.5 * debuffs, { stun: 1.5, knock: 200 });
      });
    },
  },
};

// ------------------------------------------------------------------ Police
const police: Kit = {
  blockBonus: 0.1,
  parryMul: 2,
  active: {
    castTime: 0.35,
    canCast: (sim, f, foe) => within(sim, f, foe, 320),
    cast(sim, f, foe) {
      if (!foe) return;
      sim.fx('shot', f.idx, foe.idx, foe.x, foe.y, 0, 0.2, 0xc0c7d0);
      if (sim.skillHit(f, foe, 0.6, { dodgeable: true, knock: 0 })) {
        sim.applyStatus(foe, { kind: 'root', duration: 1.5 }, f.idx);
        sim.applyStatus(foe, { kind: 'disarm', duration: 2 }, f.idx);
      }
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      sim.applyStatus(f, { kind: 'shield', duration: 6, value: pct(f, 0.2) }, f.idx);
      volley(sim, f, 3, 0.3, (t, i) => {
        sim.fx('ram', f.idx, t.idx, t.x, t.y, i % 2 ? 0 : Math.PI, 0.3);
        sim.skillHit(f, t, 0.8, { knock: 160, canCrit: false, stun: i === 2 ? 2 : 0 });
      }, 0.2);
    },
  },
};

// ------------------------------------------------------------------ Soldier
const soldier: Kit = {
  defMul: (_sim, f) => (f.hp / f.maxHp < 0.5 ? 1.2 : 1),
  noSwing: (sim, f) => (f.kit.reloadUntil ?? 0) > sim.t,
  strikeBonus(sim, a) {
    a.kit.shots = (a.kit.shots ?? 0) + 1;
    if (a.kit.shots >= 6) {
      a.kit.shots = 0;
      a.kit.reloadUntil = sim.t + 1.2;
      sim.note(a, 'RELOADING', 0xcfd8b0);
    }
    return 1;
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 420),
    cast(sim, f, foe) {
      if (!foe) return;
      const a = angleTo(f, foe);
      sim.spawnHazard({ kind: 'grenade', owner: f.idx, x: f.x, y: f.y, vx: dcos(a) * sim.dist(f, foe) / 0.6, vy: dsin(a) * sim.dist(f, foe) / 0.6, r: 90, life: 0.6 });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'grenade' || h.age + DT < h.life) return;
    const o = sim.fighters[h.owner];
    sim.fx('explosion', o.idx, o.idx, h.x, h.y, 0, 0.5, 0xff8a2a, 'fire');
    for (const e of sim.enemiesOf(o)) if (near(e, h, h.r + e.def.radius)) {
      const d = dhypot(e.x - h.x, e.y - h.y) || 1;
      sim.skillHit(o, e, 1.7, { knock: 520, dir: { x: (e.x - h.x) / d, y: (e.y - h.y) / d }, statuses: [{ kind: 'bleed', duration: 3 }] });
    }
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      f.kit.shots = 0;
      f.kit.reloadUntil = 0;
      sim.applyStatus(f, { kind: 'superArmor', duration: 4 }, f.idx);
      volley(sim, f, 12, 0.33, (t) => {
        sim.fx('shot', f.idx, t.idx, t.x, t.y, 0, 0.1, 0xfff1a8);
        sim.skillHit(f, t, 0.45, { knock: 60, canCrit: false });
      }, 0.1);
    },
  },
};

// ------------------------------------------------------------------ Artist
const PAINT: StatusKind[] = ['burn', 'slow', 'burn'];
const artist: Kit = {
  onLanded(sim, a, b) {
    const c = (a.kit.color ?? 0) % 3;
    a.kit.color = c + 1;
    if (c === 0) sim.applyStatus(b, { kind: PAINT[0], duration: 2 }, a.idx);
    if (c === 1) sim.applyStatus(b, { kind: 'slow', duration: 2, value: 0.2 }, a.idx);
    if (c === 2) sim.stagger(b, 0.2);
    b.kit[`paint${c}`] = sim.t + 5;
    if ([0, 1, 2].every((i) => (b.kit[`paint${i}`] ?? 0) > sim.t)) {
      for (const i of [0, 1, 2]) b.kit[`paint${i}`] = 0;
      sim.note(b, 'MASTERPIECE!', 0xffd23f);
      sim.fx('burst', a.idx, b.idx, b.x, b.y, 0, 0.6, 0xe63946);
      sim.skillHit(a, b, 1.5, { knock: 220 });
    }
    // Living Canvas: the painted clone repeats each connecting swing at half power
    if ((a.kit.cloneUntil ?? 0) > sim.t && !a.kit.echoing) {
      a.kit.echoing = 1;
      sim.after(0.2, () => {
        a.kit.echoing = 0;
        const t = sim.foeOf(a);
        if (t) {
          sim.fx('clone', a.idx, t.idx, a.x, a.y, 0, 0.3, 0xe63946);
          sim.skillHit(a, t, 0.5, { canCrit: false, knock: 60 });
        }
      });
    }
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 300),
    cast(sim, f) {
      const c = (f.kit.color ?? 0) % 3;
      sim.spawnHazard({ kind: 'zone', owner: f.idx, x: f.x, y: f.y, vx: 0, vy: 0, r: 100, life: 4, data: { type: 2 + c } });
    },
  },
  hazardTick(sim, h) {
    if (h.kind === 'zone') zoneTick(sim, h);
  },
  special: {
    castTime: 0.6,
    cast(sim, f) {
      f.kit.cloneUntil = sim.t + 8;
      sim.fx('clone', f.idx, f.idx, f.x, f.y, 0, 8, 0xe63946);
      sim.note(f, 'LIVING CANVAS', 0xe63946);
    },
  },
};

// ------------------------------------------------------------------ Musician
const BEAT = 0.5;
const onBeat = (sim: Sim) => {
  const ph = sim.t % BEAT;
  return ph < 0.12 || ph > BEAT - 0.12;
};
const musician: Kit = {
  strikeBonus: (sim) => (onBeat(sim) ? 1.3 : 1),
  tick(sim, f) {
    const beat = Math.floor(sim.t / BEAT);
    if (beat === f.kit.lastBeat) return;
    f.kit.lastBeat = beat;
    if (beat % 8 === 0) {
      for (const a of sim.alliesOf(f)) sim.heal(a, pct(a, 0.04));
      sim.fx('shockwave', f.idx, f.idx, f.x, f.y, 0, 0.3, 0x6dff9a);
    }
    if ((f.kit.encoreUntil ?? 0) > sim.t) {
      const t = sim.foeOf(f);
      if (t) {
        sim.fx('shot', f.idx, t.idx, t.x, t.y, 0, 0.12, 0xef233c);
        sim.skillHit(f, t, 0.4, { knock: 40, canCrit: false });
      }
    }
  },
  active: {
    castTime: 0.4,
    canCast: (sim, f, foe) => within(sim, f, foe, 260),
    cast(sim, f, foe) {
      sim.fx('shockwave', f.idx, f.idx, f.x, f.y, 0, 0.5, 0xef233c);
      if (foe && within(sim, f, foe, 280)) sim.skillHit(f, foe, 1.5, { dodgeable: true, knock: 480, statuses: [{ kind: 'silence', duration: 1 }] });
    },
  },
  special: {
    castTime: 0.5,
    cast(sim, f, foe) {
      if (!foe) return;
      sim.applyStatus(foe, { kind: 'charm', duration: 2 }, f.idx);
      f.kit.encoreUntil = sim.t + 6;
      sim.note(f, 'ENCORE!', 0xef233c);
    },
  },
};

// ------------------------------------------------------------------ Athlete
const athlete: Kit = {
  rhythmMul: (sim, f) => 1 + 0.05 * ((f.kit.warmT ?? 0) > sim.t ? Math.min(6, f.kit.warm ?? 0) : 0),
  onLanded(sim, a) {
    a.kit.warm = (a.kit.warmT ?? 0) > sim.t ? (a.kit.warm ?? 0) + 1 : 1;
    a.kit.warmT = sim.t + 3;
  },
  active: {
    castTime: 0.3,
    canCast: (sim, f, foe) => within(sim, f, foe, 480),
    cast(sim, f, foe) {
      if (!foe) return;
      const a = angleTo(f, foe);
      sim.spawnHazard({ kind: 'ball', owner: f.idx, x: f.x, y: f.y, vx: dcos(a) * 820, vy: dsin(a) * 820, r: 16, life: 2.5, data: { bounces: 2, hits: 2 } });
    },
  },
  hazardTick(sim, h) {
    if (h.kind !== 'ball') return;
    if (h.x < h.r || h.x > ARENA_W - h.r) { h.vx = -h.vx; h.x = Math.max(h.r, Math.min(ARENA_W - h.r, h.x)); h.data.bounces--; }
    if (h.y < h.r || h.y > ARENA_H - h.r) { h.vy = -h.vy; h.y = Math.max(h.r, Math.min(ARENA_H - h.r, h.y)); h.data.bounces--; }
    if (h.data.bounces < 0 || h.data.hits <= 0) { h.dead = true; return; }
    const o = sim.fighters[h.owner];
    if ((h.data.cool ?? 0) > h.age) return;
    for (const e of sim.enemiesOf(o)) if (near(e, h, h.r + e.def.radius)) {
      h.data.cool = h.age + 0.3;
      h.data.hits--;
      const d = dhypot(h.vx, h.vy) || 1;
      sim.skillHit(o, e, 1.3, { dodgeable: true, knock: 560, dir: { x: h.vx / d, y: h.vy / d } });
      h.vx = -h.vx;
      h.vy = -h.vy;
    }
  },
  special: {
    castTime: 0.5,
    cast(sim, f) {
      volley(sim, f, 3, 0.45, (t, i) => {
        sim.fx('shot', f.idx, t.idx, t.x, t.y, 0, 0.18, 0xffffff, 'ball');
        sim.skillHit(f, t, i === 2 ? 1.5 * 1.5 : 1.5, { knock: 300, canCrit: false, dir: { x: 0, y: -1 } });
        sim.stagger(t, 0.4);
      }, 0.1);
    },
  },
};

export const KITS2: Record<string, Kit> = {
  farmer, builder, miner, welder, plumber, mechanic, engineer, pilot, merchant, waiter, cleaner, tailor,
  barber, doctor, scientist, teacher, programmer, accountant, lawyer, police, soldier, artist, musician, athlete,
};
