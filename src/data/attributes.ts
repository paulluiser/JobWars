import type { FighterDef } from '../sim/types';

/**
 * Each job's attribute profile, rated 1–10, in this order:
 *   HP, Attack, Defense, Attack speed, Move speed, Reach, Accuracy, Evasion, Block, Crit, Weight
 * Profiles are deliberately distinct (tests/attributes.test.ts keeps every pair ≥ 9 points apart),
 * so no two jobs play alike even before their skills. The ratings become real stats in
 * `statsFromRatings`; ATK/HP are then nudged by the auto-balancer (src/data/balance.ts).
 */
export const ATTRS = ['HP', 'Attack', 'Defense', 'Attack speed', 'Move speed', 'Reach', 'Accuracy', 'Evasion', 'Block', 'Crit', 'Weight'] as const;
export type Ratings = [number, number, number, number, number, number, number, number, number, number, number];

export const RATINGS: Record<string, Ratings> = {
  chef: [6, 7, 5, 6, 5, 5, 6, 4, 5, 5, 6],
  firefighter: [9, 6, 8, 3, 3, 5, 4, 2, 7, 3, 9],
  electrician: [4, 8, 3, 7, 7, 6, 7, 5, 2, 6, 4],
  nurse: [7, 4, 5, 6, 5, 5, 7, 5, 6, 3, 5],
  courier: [3, 5, 2, 9, 10, 4, 7, 8, 2, 7, 3],
  fisher: [4, 6, 3, 3, 4, 10, 9, 4, 3, 6, 4],
  farmer: [7, 7, 5, 3, 5, 8, 6, 3, 4, 3, 6],
  builder: [10, 5, 9, 2, 2, 5, 4, 1, 8, 2, 10],
  miner: [7, 8, 7, 4, 4, 5, 5, 3, 5, 4, 8],
  welder: [5, 7, 6, 8, 5, 3, 6, 3, 4, 6, 6],
  plumber: [8, 6, 6, 5, 6, 6, 5, 5, 4, 3, 8],
  mechanic: [7, 5, 9, 6, 3, 6, 6, 3, 5, 3, 7],
  engineer: [5, 9, 4, 3, 5, 7, 8, 3, 3, 4, 5],
  pilot: [3, 7, 2, 6, 8, 8, 8, 7, 2, 6, 3],
  merchant: [6, 5, 5, 5, 5, 5, 7, 5, 6, 8, 6],
  waiter: [4, 6, 3, 8, 8, 4, 8, 10, 3, 6, 3],
  cleaner: [5, 4, 4, 5, 7, 8, 6, 6, 5, 3, 4],
  tailor: [3, 7, 2, 10, 7, 4, 8, 7, 2, 8, 2],
  barber: [3, 6, 2, 9, 8, 3, 9, 7, 3, 10, 3],
  doctor: [7, 5, 6, 4, 4, 5, 9, 3, 6, 4, 5],
  scientist: [4, 8, 3, 4, 5, 6, 4, 5, 3, 8, 4],
  teacher: [6, 5, 6, 3, 4, 9, 7, 2, 7, 3, 5],
  programmer: [4, 6, 3, 9, 3, 5, 7, 4, 3, 5, 3],
  accountant: [5, 6, 4, 5, 6, 6, 10, 3, 5, 4, 4],
  lawyer: [5, 6, 5, 5, 5, 6, 7, 4, 8, 4, 5],
  police: [8, 5, 7, 4, 5, 5, 6, 3, 10, 3, 8],
  soldier: [6, 8, 6, 6, 5, 9, 7, 3, 4, 5, 6],
  artist: [4, 6, 3, 6, 6, 8, 6, 6, 3, 6, 3],
  musician: [5, 5, 3, 8, 7, 4, 6, 7, 3, 3, 4],
  athlete: [6, 6, 4, 7, 9, 5, 6, 7, 3, 5, 5],
};

const lerp = (r: number, lo: number, hi: number) => lo + ((hi - lo) * (r - 1)) / 9;

/** Ratings → the stats the sim uses. */
export function statsFromRatings(r: Ratings): Partial<FighterDef> {
  const [hp, atk, def, aspd, move, reach, acc, eva, block, crit, weight] = r;
  // swing cycle: 1.35 s at rating 1 … 0.62 s at rating 10, split wind-up 30% / recover 30% / cooldown 40%
  const cycle = lerp(aspd, 1.35, 0.62);
  const w = lerp(weight, 0.78, 1.45);
  return {
    hp: Math.round(lerp(hp, 1050, 2150) / 10) * 10,
    atk: Math.round(lerp(atk, 82, 150)),
    def: Math.round(lerp(def, 6, 42)),
    windup: +(cycle * 0.3).toFixed(3),
    recover: +(cycle * 0.3).toFixed(3),
    attackCooldown: +(cycle * 0.4).toFixed(3),
    speed: Math.round(lerp(move, 250, 440)),
    range: Math.round(lerp(reach, 118, 200)),
    accuracy: +lerp(acc, 0.76, 0.96).toFixed(3),
    evasion: +lerp(eva, 0.02, 0.22).toFixed(3),
    blockChance: +lerp(block, 0.08, 0.36).toFixed(3),
    critChance: +lerp(crit, 0.04, 0.22).toFixed(3),
    weight: +w.toFixed(2),
    // bigger, heavier bodies: wider hitbox, more likely to wind up big charged blows
    radius: Math.round(lerp(weight, 27, 38)),
    chargeChance: +(0.06 + 0.012 * weight).toFixed(3),
    chargeMult: +(2.0 + 0.05 * weight).toFixed(2),
  };
}

/** Strongest and weakest attribute relative to the whole roster (shown on the select card). */
export function signature(id: string): { best: string; worst: string } {
  const all = Object.values(RATINGS);
  const z = ATTRS.map((_, k) => {
    const vals = all.map((v) => v[k]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
    return (RATINGS[id][k] - mean) / sd;
  });
  const best = z.indexOf(Math.max(...z)), worst = z.indexOf(Math.min(...z));
  return { best: ATTRS[best], worst: ATTRS[worst] };
}
