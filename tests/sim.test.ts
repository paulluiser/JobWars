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

  it.each([3, 4, 5])('starts a %i-fighter free-for-all equally spaced around the arena', (size) => {
    const teams = ROSTER.slice(0, size).map((def) => [def]);
    const sim = new Sim(teams, 42, { royale: true });
    const gaps = sim.fighters.map((fighter, i) => sim.dist(fighter, sim.fighters[(i + 1) % size]));
    expect(sim.fighters.map((fighter) => fighter.team)).toEqual([...Array(size).keys()]);
    expect(Math.min(...gaps)).toBeGreaterThan(140);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.001);
  });

  it('keeps free-for-all starting positions evenly spaced when room seats are empty', () => {
    const [a, b, c] = ROSTER;
    const sim = new Sim([[a], [], [b], [c], []], 42, { royale: true });
    expect(sim.fighters.map(({ team }) => team)).toEqual([0, 2, 3]);
    const [first, second, third] = sim.fighters;
    expect(sim.dist(first, second)).toBeCloseTo(sim.dist(second, third));
    expect(sim.dist(first, second)).toBeCloseTo(sim.dist(third, first));
  });

  it('repeats a five-fighter free-for-all from the same seed', () => {
    const teams = ROSTER.slice(0, 5).map((def) => [def]);
    const first = new Sim(teams, 42, { royale: true });
    const second = new Sim(teams, 42, { royale: true });
    while (!first.over) expect(first.step()).toEqual(second.step());
    expect(first.checkpoint()).toBe(second.checkpoint());
  });

  it('continues after a knockout and awards the last surviving side the win', () => {
    const sim = new Sim(ROSTER.slice(0, 4).map((def) => [def]), 42, { royale: true });
    const [first, second, third, last] = sim.fighters;
    sim.damage(first, first.maxHp * 2, last.idx);
    sim.step();
    expect(sim.over).toBe(false);
    expect(sim.livingSides()).toEqual([1, 2, 3]);
    sim.damage(second, second.maxHp * 2, last.idx);
    sim.damage(third, third.maxHp * 2, last.idx);
    expect(sim.step()).toContainEqual({ type: 'end', winner: 3, reason: 'ko' });
  });

  it.each([[0.6, 4], [0.5, -1]])('uses health percentage at the free-for-all time limit', (lastHp, winner) => {
    const teams = [byId('firefighter')!, byId('nurse')!, byId('builder')!, byId('miner')!, byId('courier')!].map((def) => [def]);
    const sim = new Sim(teams, 42, { royale: true, timeLimit: 0.01, startHpPct: [0.5, 0.4, 0.4, 0.4, lastHp] });
    expect(sim.step()).toContainEqual({ type: 'end', winner, reason: 'time' });
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

  it('trades a longer cooldown for a stronger control cast', () => {
    const cast = (id: string) => {
      const caster = { ...byId(id)!, atk: 100, skillAtk: 100, critChance: 0 };
      const target = { ...byId('courier')!, def: 0, evasion: 0 };
      const sim = new Sim([[caster], [target]], 42);
      const [a, b] = sim.fighters;
      a.targetIdx = b.idx;
      a.activeCd = 0;
      sim.castActive(a);
      return { cooldown: a.activeCd, damage: b.maxHp - b.hp, control: b.statuses };
    };

    const yank = cast('plumber');
    const cuffs = cast('police');
    expect(cuffs.cooldown).toBeGreaterThanOrEqual(yank.cooldown * 2);
    expect(cuffs.damage).toBeGreaterThan(yank.damage);
    expect(yank.control).toContainEqual(expect.objectContaining({ kind: 'silence', remaining: 1 }));
    expect(cuffs.control).toContainEqual(expect.objectContaining({ kind: 'disarm', remaining: 2 }));
  });

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

  function swingSetup(heavy = false) {
    const def = { ...byId('chef')!, radius: 25, range: 90, speed: 300, windup: 0.25, chargeChance: heavy ? 1 : 0 };
    const sim = new Sim([[def], [def]], 3);
    const [a, b] = sim.fighters;
    Object.assign(a, { x: 120, y: 200, vx: 300, vy: 0, attackCd: 0, activeCd: 99 });
    Object.assign(b, { x: 260, y: 200, vx: -300, vy: 0, attackCd: 99, activeCd: 99 });
    return { sim, a, b };
  }

  it.each([
    { name: 'closing into reach', x: 260, y: 200, vx: -300, starts: true },
    { name: 'closing too far away', x: 400, y: 200, vx: -300, starts: false },
    { name: 'moving apart outside reach', x: 260, y: 200, vx: 450, starts: false },
    { name: 'moving together outside reach', x: 260, y: 200, vx: 300, starts: false },
    { name: 'passing too far to the side', x: 260, y: 330, vx: -300, starts: false },
  ])('checks reach before starting a basic swing when $name', ({ x, y, vx, starts }) => {
    const { sim, a, b } = swingSetup();
    Object.assign(b, { x, y, vx });
    expect(sim.step().some((event) => event.type === 'windup' && event.a === a.idx)).toBe(starts);
  });

  it('does not begin a charge just because its longer wind-up could reach a distant foe', () => {
    const { sim, b } = swingSetup(true);
    b.x = 400;
    expect(sim.step().some((e) => e.type === 'chargeStart')).toBe(false);
    b.x = 260;
    expect(sim.step()).toContainEqual({ type: 'chargeStart', a: 0 });
  });

  it('allows a swing to start in reach and rechecks reach at impact', () => {
    const { sim, a, b } = swingSetup();
    Object.assign(a, { vx: -300 });
    Object.assign(b, { x: 225, vx: 300 });
    expect(sim.step()).toContainEqual({ type: 'windup', a: 0 });
    const events: SimEvent[] = [];
    while (a.state === 'windup') events.push(...sim.step());
    expect(events).toContainEqual({ type: 'swing', a: 0, heavy: false, inReach: false });
    expect(b.hp).toBe(b.maxHp);
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
