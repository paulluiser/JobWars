import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { ROSTER, byId } from '../src/data/roster';
import { ARENA_H, ARENA_W, TIME_LIMIT } from '../src/sim/constants';
import type { FighterDef, SimEvent } from '../src/sim/types';

function run(seed: number, a: FighterDef = byId('electrician')!, b: FighterDef = byId('fisher')!) {
  const sim = new Sim([[a], [b]], seed);
  const log: SimEvent[] = [];
  while (!sim.over) log.push(...sim.step());
  return { sim, log };
}

const pairs = () => ROSTER.flatMap((a, i) => ROSTER.map((b, j) => [i, j, a, b] as const)).filter(([i, j]) => i !== j);

describe('sim', () => {
  it('is deterministic: same seed, same fight (timers, hazards and specials included)', () => {
    const a = run(42);
    const b = run(42);
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log));
    expect(a.sim.winner).toBe(b.sim.winner);
  });

  it('different seeds give different fights', () => {
    expect(JSON.stringify(run(1).log)).not.toBe(JSON.stringify(run(2).log));
  });

  it('every matchup ends within the time limit', { timeout: 60000 }, () => {
    for (const [i, j, a, b] of pairs()) {
      const { sim } = run(100 + i * 7 + j, a, b);
      expect(sim.over).toBe(true);
      expect(sim.t).toBeLessThanOrEqual(TIME_LIMIT + 0.05);
    }
  });

  it('shows the whole combat vocabulary across a batch of fights', { timeout: 60000 }, () => {
    const seen = new Set<string>();
    for (const [i, j, a, b] of pairs()) for (const e of run(900 + i * 7 + j, a, b).log) seen.add(e.type);
    for (const t of ['hit', 'miss', 'dodge', 'blocked', 'parry', 'chargeRelease', 'interrupt', 'bounce', 'bump', 'dot', 'heal', 'skill', 'specialReady', 'hazard', 'ko']) {
      expect(seen, `missing ${t}`).toContain(t);
    }
  });

  it("every character's active skill and special fire", () => {
    const actives = new Set<string>();
    const specials = new Set<string>();
    for (let s = 0; s < 2; s++)
      for (const [, , a, b] of pairs())
        for (const e of run(300 + s, a, b).log)
          if (e.type === 'skill') (e.kind === 'active' ? actives : specials).add(e.name);
    for (const d of ROSTER) {
      expect(actives, d.name).toContain(d.active.name);
      expect(specials, d.name).toContain(d.special.name);
    }
  }, 60000);

  it('specials fire only from a full rage bar, which then empties', { timeout: 60000 }, () => {
    let repeats = 0;
    for (const [i, j, a, b] of pairs()) {
      const sim = new Sim([[a], [b]], 50 + i * 7 + j);
      const count = [0, 0];
      const ready = [false, false];
      while (!sim.over) {
        for (const e of sim.step()) {
          if (e.type === 'specialReady') ready[e.a] = true;
          if (e.type === 'skill' && e.kind === 'special') {
            count[e.a]++;
            expect(ready[e.a]).toBe(true); // only from a full bar
            ready[e.a] = false;
            expect(sim.fighters[e.a].rage).toBeLessThan(100); // and the bar empties
          }
        }
      }
      if (Math.max(...count) > 1) repeats++;
    }
    expect(repeats).toBeGreaterThan(0); // long fights see a second special
  });

  it('Fireproof: the Firefighter never burns', () => {
    for (let s = 0; s < 20; s++) {
      const sim = new Sim([[byId('chef')!], [byId('firefighter')!]], s);
      while (!sim.over) {
        sim.step();
        expect(sim.fighters[1].statuses.some((x) => x.kind === 'burn')).toBe(false);
      }
    }
  });

  it('fighters never stop moving and never leave the arena', () => {
    const sim = new Sim([[byId('courier')!], [byId('firefighter')!]], 7);
    while (!sim.over) {
      sim.step();
      for (const f of sim.fighters) {
        if (f.state === 'ko') continue;
        expect(Math.hypot(f.vx, f.vy)).toBeGreaterThan(20);
        expect(f.x).toBeGreaterThanOrEqual(f.def.radius - 0.01);
        expect(f.x).toBeLessThanOrEqual(ARENA_W - f.def.radius + 0.01);
        expect(f.y).toBeGreaterThanOrEqual(f.def.radius - 0.01);
        expect(f.y).toBeLessThanOrEqual(ARENA_H - f.def.radius + 0.01);
      }
    }
  });

  it('swings continuously whether or not the foe is in reach', () => {
    const { log } = run(3);
    const swings = log.filter((e) => e.type === 'swing');
    expect(swings.some((e) => e.type === 'swing' && !e.inReach)).toBe(true);
    expect(swings.some((e) => e.type === 'swing' && e.inReach)).toBe(true);
  });

  it('a block takes less damage than a clean hit', () => {
    let hit = 0, nh = 0, blk = 0, nb = 0;
    for (let s = 0; s < 30; s++)
      for (const e of run(s, byId('courier')!, byId('firefighter')!).log) {
        if (e.type === 'hit' && !e.heavy && !e.crit && !e.skill) { hit += e.dmg; nh++; }
        if (e.type === 'blocked') { blk += e.dmg; nb++; }
      }
    expect(blk / nb).toBeLessThan((hit / nh) * 0.5);
  });

  it('every character has simple and detailed text for all three skills', () => {
    for (const d of ROSTER) {
      for (const s of [d.passive, d.active, d.special]) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.simple.length).toBeGreaterThan(10);
        expect(s.detailed, `${d.name} · ${s.name}: detailed mode needs numbers`).toMatch(/\d/);
        expect(s.simple, `${d.name} · ${s.name}: simple mode should be one short line`).not.toMatch(/\d+%/);
      }
    }
  });
});
