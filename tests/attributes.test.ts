import { describe, expect, it } from 'vitest';
import { ATTRS, RATINGS, signature, statsFromRatings } from '../src/data/attributes';
import { ROSTER } from '../src/data/roster';
import { gachaOpts } from '../src/modes/gacha';
import { Sim } from '../src/sim/sim';
import type { FighterDef } from '../src/sim/types';

describe('attribute profiles', () => {
  it('every job has a profile with 11 ratings from 1 to 10', () => {
    for (const d of ROSTER) {
      const r = RATINGS[d.id];
      expect(r, d.id).toBeDefined();
      expect(r.length).toBe(ATTRS.length);
      for (const v of r) expect(v >= 1 && v <= 10, `${d.id} ${v}`).toBe(true);
    }
  });

  it('no two jobs are alike: every pair differs by at least 9 rating points', () => {
    const ids = Object.keys(RATINGS);
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const d = RATINGS[ids[i]].reduce((s, v, k) => s + Math.abs(v - RATINGS[ids[j]][k]), 0);
        expect(d, `${ids[i]} vs ${ids[j]}`).toBeGreaterThanOrEqual(9);
      }
  });

  it('every attribute has a spread, and its champion is the only one at the top', () => {
    for (const k of [3, 4, 5, 6, 7, 8, 9]) { // attack speed … crit: one clear best each
      const vals = Object.values(RATINGS).map((r) => r[k]);
      const max = Math.max(...vals);
      expect(Math.max(...vals) - Math.min(...vals), ATTRS[k]).toBeGreaterThanOrEqual(6);
      expect(vals.filter((v) => v === max).length, `${ATTRS[k]} has a single champion`).toBe(1);
    }
  });

  it('ratings map to sensible stats in both directions', () => {
    const lo = statsFromRatings([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const hi = statsFromRatings([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(hi.hp!).toBeGreaterThan(lo.hp!);
    expect(hi.speed!).toBeGreaterThan(lo.speed!);
    expect(hi.range!).toBeGreaterThan(lo.range!);
    // faster attack speed = shorter swing cycle
    expect(hi.windup! + hi.recover! + hi.attackCooldown!).toBeLessThan(lo.windup! + lo.recover! + lo.attackCooldown!);
  });

  it('each job gets a distinct strength and weakness', () => {
    for (const d of ROSTER) {
      const s = signature(d.id);
      expect(s.best).not.toBe(s.worst);
    }
  });
});

describe('combat roles', () => {
  const forRoles = (role: FighterDef['role'], ...others: FighterDef['role'][]) =>
    ROSTER.filter((d) => d.role === role || others.includes(d.role));

  const ranged = forRoles('Marksman', 'Support', 'Mage');
  const medium = forRoles('Fighter', 'Controller');
  const short = forRoles('Assassin', 'Tank');
  const assassins = forRoles('Assassin');
  const tanks = forRoles('Tank');
  const cycle = (d: FighterDef) => d.windup + d.recover + d.attackCooldown;
  const mean = (jobs: FighterDef[], stat: 'atk' | 'hp' | 'def') =>
    jobs.reduce((total, d) => total + d[stat], 0) / jobs.length;

  it('gives ranged roles more reach than Fighters and Controllers, with Tanks and Assassins closest in', () => {
    expect(Math.min(...ranged.map((d) => d.range))).toBeGreaterThan(Math.max(...medium.map((d) => d.range)));
    expect(Math.min(...medium.map((d) => d.range))).toBeGreaterThan(Math.max(...short.map((d) => d.range)));
  });

  it.each(['Classic', 'Gacha', 'Gacha Royale'] as const)('preserves the lower attack of ranged roles in %s', (mode) => {
    const opts = mode === 'Classic' ? {} : gachaOpts([]);
    const royale = mode === 'Gacha Royale';
    const stats = (jobs: FighterDef[]) =>
      jobs.map((job) => new Sim([[job], [ROSTER[0]], ...(royale ? [[ROSTER[1]]] : [])], 42, { ...opts, royale }).fighters[0].def);
    const mediumAttack = mean(stats(medium), 'atk');
    for (const role of ['Marksman', 'Support', 'Mage'] as const) {
      expect(mean(stats(forRoles(role)), 'atk'), role).toBeLessThan(mediumAttack * 0.93);
    }
  });

  it('gives Assassins the quickest attacks and movement', () => {
    const others = ROSTER.filter((d) => d.role !== 'Assassin');
    expect(Math.max(...assassins.map(cycle))).toBeLessThan(Math.min(...others.map(cycle)));
    expect(Math.min(...assassins.map((d) => d.speed))).toBeGreaterThan(Math.max(...others.map((d) => d.speed)));
  });

  it('gives Tanks tougher armor and more health', () => {
    const others = ROSTER.filter((d) => d.role !== 'Tank');
    expect(mean(tanks, 'hp')).toBeGreaterThan(mean(others, 'hp') * 1.25);
    expect(mean(tanks, 'def')).toBeGreaterThan(mean(others, 'def') * 1.65);
  });
});

describe('skill power', () => {
  it.each(['Classic', 'Gacha Tag'] as const)('scales separately from basic attacks in %s', (mode) => {
    const [base, opponent, partner] = ROSTER;
    const hit = (attacker: FighterDef) => {
      const tag = mode === 'Gacha Tag';
      const sim = new Sim(tag ? [[attacker, partner], [opponent, partner]] : [[attacker], [opponent]], 42,
        tag ? gachaOpts([['glass-cannon'], []]) : {});
      const source = sim.fighters[0];
      const target = sim.fighters[tag ? 2 : 1];
      const before = target.hp;
      sim.skillHit(source, target, 1, { canCrit: false });
      return before - target.hp;
    };
    const baseline = hit({ ...base, atk: 150, skillAtk: undefined });
    expect(baseline).toBeGreaterThan(0);
    expect(hit({ ...base, atk: 95, skillAtk: 150 })).toBe(baseline);
  });
});
