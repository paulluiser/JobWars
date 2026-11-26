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
