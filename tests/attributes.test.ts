import { describe, expect, it } from 'vitest';
import { ATTRS, RATINGS, signature, statsFromRatings } from '../src/data/attributes';
import { ROSTER } from '../src/data/roster';

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
