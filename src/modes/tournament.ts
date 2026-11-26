import { Sim } from '../sim/sim';
import type { FighterDef } from '../sim/types';

/**
 * Knockout bracket. Every match has its own seed, fixed when the bracket is drawn, so
 * a skipped match (simulated instantly) ends exactly like the one you'd have watched.
 */
export type Format = 'duel' | 'tag';

/** One side of a match: a single job (duel) or a pair (tag). Ids only, so it serialises. */
export type Entry = string[];

export interface Match {
  a: Entry | null;
  b: Entry | null;
  /** 0 = a won, 1 = b won */
  winner: 0 | 1 | null;
  seed: number;
  /** how it ended, for the bracket card */
  note?: string;
}

export interface Tournament {
  format: Format;
  seed: number;
  rounds: Match[][];
}

export const SIZES = [4, 8, 16] as const;

const mix = (s: number, i: number) => ((Math.imul(s ^ (i * 0x9e3779b1), 0x85ebca6b) >>> 0) % 99999) + 1;

export function createTournament(entries: Entry[], format: Format, seed: number): Tournament {
  const n = entries.length;
  if (![4, 8, 16].includes(n)) throw new Error(`a bracket needs 4, 8 or 16 entries, got ${n}`);
  const rounds: Match[][] = [];
  let k = 0;
  for (let size = n / 2; size >= 1; size /= 2) {
    const r: Match[] = [];
    for (let i = 0; i < size; i++) r.push({ a: null, b: null, winner: null, seed: mix(seed, k++) });
    rounds.push(r);
  }
  rounds[0].forEach((m, i) => {
    m.a = entries[i * 2];
    m.b = entries[i * 2 + 1];
  });
  return { format, seed, rounds };
}

export const roundName = (t: Tournament, r: number) => {
  const left = t.rounds.length - r;
  return left === 1 ? 'Final' : left === 2 ? 'Semi-finals' : left === 3 ? 'Quarter-finals' : `Round of ${t.rounds[r].length * 2}`;
};

/** The next match to play, in bracket order. */
export function nextMatch(t: Tournament): { r: number; i: number; m: Match } | null {
  for (let r = 0; r < t.rounds.length; r++)
    for (let i = 0; i < t.rounds[r].length; i++) {
      const m = t.rounds[r][i];
      if (m.winner === null && m.a && m.b) return { r, i, m };
    }
  return null;
}

export function champion(t: Tournament): Entry | null {
  const f = t.rounds[t.rounds.length - 1][0];
  return f.winner === null ? null : f.winner === 0 ? f.a : f.b;
}

/** Record a result and move the winner into its slot in the next round. */
export function report(t: Tournament, r: number, i: number, winner: 0 | 1, note?: string) {
  const m = t.rounds[r][i];
  if (m.winner !== null) return;
  m.winner = winner;
  m.note = note;
  const next = t.rounds[r + 1]?.[i >> 1];
  if (next) next[i % 2 === 0 ? 'a' : 'b'] = winner === 0 ? m.a : m.b;
}

/**
 * A knockout needs a winner: a draw (time-out with equal HP, or a double K.O.) goes to the
 * side with more HP left in total, then to the coin the match seed flips.
 */
export function decide(sim: Sim): 0 | 1 {
  if (sim.winner === 0 || sim.winner === 1) return sim.winner;
  const hp = (team: number) => sim.fighters.filter((f) => f.team === team).reduce((s, f) => s + f.hp / f.maxHp, 0);
  const a = hp(0), b = hp(1);
  if (a !== b) return a > b ? 0 : 1;
  return (sim.seed & 1) as 0 | 1;
}

export function describe(sim: Sim) {
  if (sim.winner === -1) return 'draw · decided on HP';
  return sim.t >= 99 ? 'on time' : `K.O. ${sim.t.toFixed(0)}s`;
}

/** Simulate a match instantly (same seed, same result as watching it). */
export function simulate(m: Match, byId: (id: string) => FighterDef): Sim {
  const sim = new Sim([m.a!.map(byId), m.b!.map(byId)], m.seed);
  while (!sim.over) sim.step();
  return sim;
}
