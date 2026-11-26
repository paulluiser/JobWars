import { ALL_CARDS, CARD_BY_ID, GACHA, oddsFor, type Card, type Rarity } from '../data/cards';
import { Rng } from '../sim/rng';
import { Sim, type SimOpts } from '../sim/sim';
import type { FighterDef, Team } from '../sim/types';
import { GACHA_BALANCE } from '../data/gachaBalance';

/**
 * The Gacha draft: before the fight each side picks 1 of 3 cards, then the fight pauses every
 * 20 s for another pick. Offers are generated from (seed, team, pick, reroll), so both players'
 * machines in online PvP produce identical offers without sending them; only the choices travel.
 */

const mix = (...n: number[]) => n.reduce((h, x) => (Math.imul(h ^ (x + 0x9e3779b9), 0x85ebca6b) ^ (h >>> 13)) >>> 0, 2166136261);

/** cards a team may be offered: general ones, plus exclusives for its jobs and classes */
export function poolFor(jobs: FighterDef[]): Card[] {
  const ids = new Set(jobs.map((d) => d.id));
  const roles = new Set(jobs.map((d) => d.role));
  return ALL_CARDS.filter((c) => (!c.job && !c.role) || (c.job && ids.has(c.job)) || (c.role && roles.has(c.role)));
}

/** The `offers` cards for a team's pick #`pick` (0 = pre-fight), after `reroll` rerolls. */
export function offersFor(seed: number, team: Team, pick: number, reroll: number, jobs: FighterDef[], owned: readonly string[]): Card[] {
  const rng = new Rng(mix(seed, team, pick, reroll));
  const pool = poolFor(jobs).filter((c) => !owned.includes(c.id));
  const odds = oddsFor(pick);
  const out: Card[] = [];
  for (let i = 0; i < GACHA.offers && pool.length; i++) {
    const roll = rng.next();
    let want: Rarity = roll < odds[0] ? 'common' : roll < odds[0] + odds[1] ? 'rare' : 'epic';
    let opts = pool.filter((c) => c.rarity === want && !out.includes(c));
    // nothing left at that rarity: step to the nearest one that has cards
    for (const alt of ['rare', 'epic', 'common'] as Rarity[]) {
      if (opts.length) break;
      want = alt;
      opts = pool.filter((c) => c.rarity === alt && !out.includes(c));
    }
    if (!opts.length) break;
    const w = opts.map((c) => (c.job || c.role ? GACHA.exclusiveWeight : 1));
    let r = rng.next() * w.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < opts.length - 1 && (r -= w[k]) > 0) k++;
    out.push(opts[k]);
  }
  return out;
}

/** The CPU picks at random (as the design asks), but reproducibly from the seed. */
export function cpuPick(seed: number, team: Team, pick: number, offers: Card[]): Card {
  return offers[Math.floor(new Rng(mix(seed, team, pick, 77)).next() * offers.length)];
}

export const gachaOpts = (cards: [string[], string[]]): SimOpts => ({
  cards,
  hpMul: GACHA.hpMul,
  timeLimit: GACHA.timeLimit,
  surgeEvery: GACHA.surgeEvery,
  overtimeAt: GACHA.overtimeAt,
  balance: GACHA_BALANCE,
});

/** One recorded choice; a match's whole draft is a list of these (replays and share links use it). */
export interface Pick { team: Team; pick: number; id: string }

/**
 * Run a whole Gacha match without rendering: `choose` makes every pick (CPU, tests, balancing).
 * Returns the finished sim and the draft log.
 */
export function runGacha(teams: [FighterDef[], FighterDef[]], seed: number, choose: (team: Team, pick: number, offers: Card[]) => Card = (t, p, o) => cpuPick(seed, t, p, o)) {
  const log: Pick[] = [];
  const owned: [string[], string[]] = [[], []];
  const pickFor = (team: Team, pick: number) => {
    const offers = offersFor(seed, team, pick, 0, teams[team], owned[team]);
    if (!offers.length) return null;
    const c = choose(team, pick, offers);
    owned[team].push(c.id);
    log.push({ team, pick, id: c.id });
    return c.id;
  };
  pickFor(0, 0);
  pickFor(1, 0);
  const sim = new Sim(teams, seed, gachaOpts([[...owned[0]], [...owned[1]]]));
  while (!sim.over) {
    sim.step();
    if (sim.paused) {
      for (const team of [0, 1] as Team[]) {
        const id = pickFor(team, sim.surges);
        if (id) sim.addCard(team, id);
      }
      sim.resume();
    }
  }
  return { sim, log };
}

/** Re-run a match from its draft log (KO replay, share links): picks are applied at the same pauses. */
export function replayGacha(teams: [FighterDef[], FighterDef[]], seed: number, log: Pick[], stopAt = Infinity) {
  const pre = (team: Team) => log.filter((p) => p.team === team && p.pick === 0).map((p) => p.id);
  const sim = new Sim(teams, seed, gachaOpts([pre(0), pre(1)]));
  while (!sim.over && sim.tick < stopAt) {
    sim.step();
    if (sim.paused) {
      for (const p of log) if (p.pick === sim.surges) sim.addCard(p.team, p.id);
      sim.resume();
    }
  }
  return sim;
}

export const cardName = (id: string) => CARD_BY_ID.get(id)?.name ?? id;
