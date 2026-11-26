import { ALL_CARDS, CARD_BY_ID, GACHA, oddsFor, type Card, type Rarity } from '../data/cards';
import { Rng } from '../sim/rng';
import { Sim, type SimOpts } from '../sim/sim';
import type { FighterDef, Team } from '../sim/types';
import { GACHA_BALANCE } from '../data/gachaBalance';

/**
 * The Gacha draft: before the fight each side picks 1 of 3 cards, then the fight pauses every
 * 15 s for another pick. Each round rolls one rarity shared by both teams. Online PvP
 * generates the choices deterministically, so only the picks travel.
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
  const [common, rare] = oddsFor(pick);
  const roll = new Rng(mix(seed, pick, 99)).next();
  const rarity: Rarity = roll < common ? 'common' : roll < common + rare ? 'rare' : 'epic';
  const pool = poolFor(jobs).filter((c) => c.rarity === rarity && !owned.includes(c.id));
  let previous: Card[] = [];
  for (let attempt = 0; attempt <= reroll; attempt++) {
    const rng = new Rng(mix(seed, team, pick, attempt));
    const fresh = pool.filter((c) => !previous.includes(c));
    const opts = fresh.length >= GACHA.offers ? fresh : pool.slice();
    const offers: Card[] = [];
    while (offers.length < GACHA.offers && opts.length) {
      const weights = opts.map((c) => (c.job || c.role ? GACHA.exclusiveWeight : 1));
      let roll = rng.next() * weights.reduce((sum, weight) => sum + weight, 0);
      let index = 0;
      while (index < opts.length - 1 && (roll -= weights[index]) >= 0) index++;
      offers.push(opts.splice(index, 1)[0]);
    }
    previous = offers;
  }
  return previous;
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
