/**
 * PvP matchmaking rating (MMR): Elo, starting at 1000. Both players send their rating when a
 * match begins, so both machines compute the same change. Placement (first 10 matches) moves
 * faster. Ranks are job titles, from Intern to CEO.
 *
 * Note: PvP is peer-to-peer with no server, so the rating lives in this browser (localStorage).
 * It's honest-play matchmaking, not an anti-cheat ladder.
 */
export interface Profile {
  mmr: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number;
  history: { at: number; mode: string; result: 'W' | 'L' | 'D'; delta: number; opp: number }[];
}

export const RANKS = [
  { name: 'Intern', min: 0, color: '#9a8f7a' },
  { name: 'Associate', min: 900, color: '#8fbf7a' },
  { name: 'Specialist', min: 1050, color: '#4c8dff' },
  { name: 'Manager', min: 1200, color: '#a35cff' },
  { name: 'Director', min: 1350, color: '#e8892a' },
  { name: 'Executive', min: 1500, color: '#d9452b' },
  { name: 'CEO', min: 1700, color: '#ffd23f' },
] as const;

export const rankOf = (mmr: number) => [...RANKS].reverse().find((r) => mmr >= r.min)!;
/** quick-match bracket: one per rank, so players meet their own level first */
export const tierOf = (mmr: number) => RANKS.indexOf(rankOf(mmr));

const KEY = 'pvpProfile';

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (p && typeof p.mmr === 'number') return p;
  } catch {}
  return { mmr: 1000, wins: 0, losses: 0, draws: 0, peak: 1000, history: [] };
}

function save(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

/** Elo expected score of a against b */
export const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

/** rating change for `me` after a result (1 win, 0.5 draw, 0 loss) against `opp` */
export function delta(me: number, opp: number, score: number, games: number) {
  const k = games < 10 ? 48 : me >= 1500 ? 24 : 32;
  return Math.round(k * (score - expected(me, opp)));
}

/** Record a finished PvP match; returns the change. */
export function recordResult(opp: number, score: 0 | 0.5 | 1, mode: string): number {
  const p = loadProfile();
  const games = p.wins + p.losses + p.draws;
  const d = delta(p.mmr, opp, score, games);
  p.mmr = Math.max(0, p.mmr + d);
  p.peak = Math.max(p.peak, p.mmr);
  if (score === 1) p.wins++;
  else if (score === 0) p.losses++;
  else p.draws++;
  p.history.unshift({ at: Date.now(), mode, result: score === 1 ? 'W' : score === 0 ? 'L' : 'D', delta: d, opp });
  p.history = p.history.slice(0, 30);
  save(p);
  return d;
}
