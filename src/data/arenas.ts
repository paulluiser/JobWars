import type { Level } from '../modes/story';
import { Rng } from '../sim/rng';

export const ARENA_NAMES = {
  market: 'Job Fair Arena',
  downtown: 'Downtown Plaza',
  construction: 'Construction Site',
  hospital: 'Hospital Courtyard',
  'city-hall': 'City Hall & Campus',
  'farm-harbour': 'Farm & Harbour',
  theatre: 'Grand Theatre',
} as const;

export type ArenaId = keyof typeof ARENA_NAMES;
export type ArenaChoice = ArenaId | 'auto';
export const DEFAULT_ARENA: ArenaId = 'market';

export function isArenaId(id: string): id is ArenaId {
  return Object.hasOwn(ARENA_NAMES, id);
}

const districts = ['downtown', 'construction', 'hospital', 'city-hall', 'farm-harbour', 'theatre'] as const;
const homeJobs = [
  ['courier', 'waiter', 'cleaner', 'merchant', 'police', 'chef'],
  ['builder', 'welder', 'electrician', 'engineer', 'plumber'],
  ['nurse', 'doctor', 'scientist', 'programmer', 'mechanic'],
  ['teacher', 'accountant', 'lawyer', 'athlete'],
  ['farmer', 'fisher', 'miner', 'pilot', 'soldier', 'firefighter'],
  ['tailor', 'barber', 'artist', 'musician'],
];

export function homeArena(job: string): ArenaId {
  return districts[homeJobs.findIndex((jobs) => jobs.includes(job))] ?? DEFAULT_ARENA;
}

export function storyArena(level: Pick<Level, 'id' | 'chapter'>): ArenaId {
  return level.id === '6-4' ? DEFAULT_ARENA : districts[level.chapter - 1] ?? DEFAULT_ARENA;
}

export function resolveArena(choice: ArenaChoice | undefined, jobs: readonly string[], seed: number): ArenaId {
  if (choice !== 'auto') return choice ?? DEFAULT_ARENA;
  if (!jobs.length) return DEFAULT_ARENA;
  // A separate RNG keeps the visual choice from consuming any combat rolls.
  return homeArena(jobs[Math.floor(new Rng(seed).next() * jobs.length)]);
}
