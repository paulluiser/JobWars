import { expect, it } from 'vitest';
import { ROSTER } from '../src/data/roster';

it('gives every job a unique personal display name', () => {
  const names = ROSTER.map((fighter) => {
    expect(fighter.displayName, fighter.id).toEqual(expect.stringMatching(/\S/));
    expect(fighter.displayName, fighter.id).not.toBe(fighter.name);
    return fighter.displayName.toLowerCase();
  });
  expect(new Set(names).size).toBe(ROSTER.length);
});

it('gives every special a distinct positive charge time', () => {
  const times = ROSTER.map((fighter) => fighter.special.cooldown);
  expect(Math.min(...times)).toBeGreaterThan(0);
  expect(new Set(times).size).toBe(ROSTER.length);
});
