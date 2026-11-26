import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROSTER } from '../src/data/roster';
import { ARENA_NAMES, DEFAULT_ARENA, homeArena, resolveArena, storyArena } from '../src/data/arenas';
import { LEVELS } from '../src/modes/story';

describe('arena selection and calibration', () => {
  it('assigns the six districts and returns to the Job Fair for the Story finale', () => {
    expect(LEVELS.filter((level) => level.id.endsWith('-1')).map(storyArena)).toEqual([
      'downtown', 'construction', 'hospital', 'city-hall', 'farm-harbour', 'theatre',
    ]);
    expect(storyArena(LEVELS.at(-1)!)).toBe(DEFAULT_ARENA);
  });

  it('chooses a fighter’s home from the match seed, with explicit and legacy overrides', () => {
    const jobs = ['chef', 'nurse', 'builder', 'musician'];
    for (const job of ROSTER) expect(homeArena(job.id), job.id).not.toBe(DEFAULT_ARENA);
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
    const choices = seeds.map((seed) => resolveArena('auto', jobs, seed));
    expect(choices).toEqual(seeds.map((seed) => resolveArena('auto', jobs, seed)));
    expect(new Set(choices)).toEqual(new Set(['downtown', 'hospital', 'construction', 'theatre']));
    expect(resolveArena('theatre', jobs, 7)).toBe('theatre');
    expect(resolveArena(undefined, jobs, 7)).toBe(DEFAULT_ARENA);
    expect(resolveArena('auto', [], 7)).toBe(DEFAULT_ARENA);
  });

  it('ships all seven paintings with the same floor calibration as the source rigs', () => {
    const rigs = JSON.parse(readFileSync('art/rig.json', 'utf8'));
    const manifest = JSON.parse(readFileSync('public/art/manifest.json', 'utf8'));
    expect(Object.keys(manifest.arenas).sort()).toEqual(Object.keys(ARENA_NAMES).sort());
    for (const [id, arena] of Object.entries<{ src: string; floor: { x: number; y: number; w: number; h: number } }>(manifest.arenas)) {
      expect(existsSync('public/art/' + arena.src)).toBe(true);
      expect(arena.floor).toEqual(rigs.arenas[id].floor);
      const { x, y, w, h } = arena.floor;
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x + w).toBeLessThan(1);
      expect(y + h).toBeLessThan(1);
    }
  });
});
