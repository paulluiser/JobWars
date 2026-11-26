import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_BY_ID, CARDS, CLASS_CARDS, JOB_CARDS, augOf } from '../src/data/cards';
import { ROSTER, byId } from '../src/data/roster';
import { offersFor, poolFor, replayGacha, runGacha } from '../src/modes/gacha';
import { LEVELS, STARTERS, judge } from '../src/modes/story';
import { delta, expected, rankOf } from '../src/modes/mmr';
import { CARD_ART_NAMES } from '../tools/art/cardnames';
import { Sim } from '../src/sim/sim';
import { SURGE_TICKS } from '../src/net/roomSim';

const def = (id: string) => byId(id)!;

describe('cards', () => {
  it('45 general cards, 15 of each rarity, plus a class card per role and a job card per job', () => {
    expect(CARDS.length).toBe(45);
    for (const r of ['common', 'rare', 'epic']) expect(CARDS.filter((c) => c.rarity === r).length).toBe(15);
    expect(new Set(CLASS_CARDS.map((c) => c.role))).toEqual(new Set(ROSTER.map((d) => d.role)));
    expect(new Set(JOB_CARDS.map((c) => c.job))).toEqual(new Set(ROSTER.map((d) => d.id)));
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(ALL_CARDS.length);
  });

  it('every card changes something, and stacking caps hold', () => {
    for (const c of ALL_CARDS) expect(Object.keys(c.aug).length, c.id).toBeGreaterThan(0);
    const all = augOf(ALL_CARDS.map((c) => c.id));
    expect(all.encore).toBeLessThanOrEqual(0.7);
    expect(all.cdMul).toBeGreaterThanOrEqual(0.4);
    expect(all.eva).toBeLessThanOrEqual(0.2);
  });

  it('exclusive cards are only offered to teams with that job or class', () => {
    const pool = poolFor([def('chef')]);
    expect(pool.some((c) => c.id === 'secret-recipe')).toBe(true);
    expect(pool.some((c) => c.id === 'brawlers-blood')).toBe(true); // Chef is a Fighter
    expect(pool.some((c) => c.job && c.job !== 'chef')).toBe(false);
    expect(pool.some((c) => c.role && c.role !== 'Fighter')).toBe(false);
  });

  it('offers are deterministic, distinct and never repeat owned cards', () => {
    const team = [def('nurse')];
    const a = offersFor(5, 0, 2, 0, team, ['hard-hat']);
    expect(a.map((c) => c.id)).toEqual(offersFor(5, 0, 2, 0, team, ['hard-hat']).map((c) => c.id));
    expect(new Set(a.map((c) => c.id)).size).toBe(a.length);
    expect(a.some((c) => c.id === 'hard-hat')).toBe(false);
    expect(offersFor(5, 0, 2, 1, team, []).map((c) => c.id)).not.toEqual(offersFor(5, 0, 2, 0, team, []).map((c) => c.id)); // a reroll changes them
  });

  it('uses a single shared rarity throughout each draft round', () => {
    const jobs = [[def('nurse')], [def('miner'), def('chef')]];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      for (let pick = 0; pick < 9; pick++) {
        const batches = ([0, 1] as const).flatMap((team) =>
          [0, 1, 2].map((reroll) => offersFor(seed, team, pick, reroll, jobs[team], ['hard-hat'])),
        );
        const rarity = batches[0][0].rarity;
        expect(batches.every((batch) => batch.length === 3 && batch.every((card) => card.rarity === rarity))).toBe(true);
        seen.add(rarity);
        for (const i of [1, 2, 4, 5]) {
          expect(batches[i].every((card) => !batches[i - 1].includes(card))).toBe(true);
        }
      }
    }
    expect([...seen].sort()).toEqual(['common', 'epic', 'rare']);
  });

  it('the art sheet covers every card plus the effects', () => {
    expect(CARD_ART_NAMES.slice(0, ALL_CARDS.length)).toEqual(ALL_CARDS.map((c) => c.id));
    expect(CARD_ART_NAMES.length).toBeLessThanOrEqual(90);
  });
});

describe('gacha matches', () => {
  it('pause for a pick every 15 s and replay identically from their draft log', { timeout: 30000 }, () => {
    for (let s = 0; s < 4; s++) {
      const teams: [any[], any[]] = s % 2 ? [[def('miner'), def('nurse')], [def('pilot'), def('chef')]] : [[def('lawyer')], [def('athlete')]];
      const { sim, log } = runGacha(teams, 300 + s);
      const picksEach = log.filter((p) => p.team === 0).length;
      // Combat can end on a surge tick before the following step opens the draft.
      expect(picksEach).toBe(1 + SURGE_TICKS.filter((tick) => tick < sim.tick).length);
      for (let pick = 0; pick < picksEach; pick++) {
        expect(new Set(log.filter((p) => p.pick === pick).map((p) => CARD_BY_ID.get(p.id)?.rarity)).size).toBe(1);
      }
      const again = replayGacha(teams, 300 + s, log);
      expect(again.tick).toBe(sim.tick);
      expect(again.winner).toBe(sim.winner);
      expect(again.fighters.map((f) => f.hp)).toEqual(sim.fighters.map((f) => f.hp));
    }
  });

  it('offers cards to the fifth side and keeps a knocked-out side out of live drafts', () => {
    const teams = ROSTER.slice(0, 5).map((fighter) => [fighter]);
    const start = offersFor(42, 4, 0, 0, teams[4], []).map((card) => card.id);
    expect(start).toHaveLength(3);
    expect(offersFor(42, 4, 0, 0, teams[4], []).map((card) => card.id)).toEqual(start);
    const sim = new Sim(teams, 42, { royale: true, surgeEvery: 0.01 });
    const [first, , , , last] = sim.fighters;
    sim.damage(first, first.maxHp * 2, last.idx);
    sim.step();
    expect(sim.step()).toContainEqual({ type: 'surge', n: 1 });
    expect(sim.livingSides()).toEqual([1, 2, 3, 4]);
    expect(sim.addCard(0, start[0])).toEqual([]);
    expect(sim.addCard(4, start[0])).toContainEqual({ type: 'card', team: 4, id: start[0] });
    expect(last.cards).toEqual([start[0]]);
  });

  it('cards change the fight (a Golden Parachute saves a knockout once)', () => {
    const sim = new Sim([[def('chef')], [def('builder')]], 1, { cards: [['golden-parachute'], []] });
    const chef = sim.fighters[0];
    sim.damage(chef, chef.maxHp * 2, 1);
    expect(chef.hp).toBe(1);
    expect(sim.alive(chef)).toBe(true);
    sim.fighters[0].statuses = [];
    sim.damage(chef, chef.maxHp * 2, 1);
    expect(sim.alive(chef)).toBe(false);
  });
});

describe('story', () => {
  it('recruits every non-starter job exactly once, and its card references exist', () => {
    const unlocks = LEVELS.flatMap((l) => l.unlocks);
    expect(new Set(unlocks).size).toBe(unlocks.length);
    expect(new Set([...STARTERS, ...unlocks])).toEqual(new Set(ROSTER.map((d) => d.id)));
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const l of LEVELS) for (const id of [...(l.opts?.enemyCards ?? []), ...(l.opts?.myCards ?? [])]) expect(ALL_CARDS.some((c) => c.id === id), `${l.id}: ${id}`).toBe(true);
    for (const l of LEVELS) for (const id of [...l.enemies, ...l.intro.map((x) => x.who), ...l.win.map((x) => x.who)]) if (id !== 'you') expect(byId(id), `${l.id}: ${id}`).toBeDefined();
  });

  it('levels are judged by their rule', () => {
    const lvl = LEVELS.find((l) => l.rule === 'survive')!;
    const sim = new Sim([[def('chef')], [def('welder'), def('electrician')]], 3, { timeLimit: 1 });
    while (!sim.over) sim.step();
    expect(judge(lvl, sim).won).toBe(sim.fighters[0].state !== 'ko');
  });
});

describe('mmr', () => {
  it('Elo: equal ratings swap equal points; upsets pay more', () => {
    expect(expected(1000, 1000)).toBeCloseTo(0.5);
    expect(delta(1000, 1000, 1, 20)).toBe(-delta(1000, 1000, 0, 20));
    expect(delta(1000, 1400, 1, 20)).toBeGreaterThan(delta(1400, 1000, 1, 20));
    expect(rankOf(1000).name).toBe('Associate');
    expect(rankOf(1750).name).toBe('CEO');
  });
});
