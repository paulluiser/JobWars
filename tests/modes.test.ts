import { describe, expect, it } from 'vitest';
import { ROSTER, byId } from '../src/data/roster';
import { Sim } from '../src/sim/sim';
import { champion, createTournament, decide, nextMatch, report, roundName, simulate } from '../src/modes/tournament';

const def = (id: string) => byId(id)!;
const run = (sim: Sim) => {
  while (!sim.over) sim.step();
  return sim;
};

describe('tag team (2v2, all four on the field)', () => {
  it('is deterministic for a seed', () => {
    const teams = () => [[def('chef'), def('nurse')], [def('miner'), def('pilot')]] as [any[], any[]];
    const a = run(new Sim(teams(), 77)), b = run(new Sim(teams(), 77));
    expect(a.t).toBe(b.t);
    expect(a.winner).toBe(b.winner);
    expect(a.fighters.map((f) => f.hp)).toEqual(b.fighters.map((f) => f.hp));
  });

  it('every job can fight in a pair without errors, and a team wins only when both foes are down', () => {
    for (let i = 0; i < ROSTER.length; i++) {
      const t = [ROSTER[i], ROSTER[(i + 7) % ROSTER.length], ROSTER[(i + 13) % ROSTER.length], ROSTER[(i + 22) % ROSTER.length]];
      const sim = run(new Sim([[t[0], t[1]], [t[2], t[3]]], 500 + i));
      if (sim.winner === 0 || sim.winner === 1) {
        const losers = sim.fighters.filter((f) => f.team !== sim.winner);
        if (sim.t < 99) expect(losers.every((f) => f.state === 'ko'), `${t.map((d) => d.id)}`).toBe(true);
      }
    }
  }, 30000);

  it('allies never hit each other with swings', () => {
    const sim = new Sim([[def('soldier'), def('builder')], [def('nurse'), def('teacher')]], 3);
    const allyHits: string[] = [];
    while (!sim.over) for (const e of sim.step()) if (e.type === 'hit' && sim.fighters[e.a].team === sim.fighters[e.b].team && !e.skill) allyHits.push(`${e.a}->${e.b}`);
    expect(allyHits).toEqual([]);
  });
});

describe('tournament', () => {
  const ids = ROSTER.slice(0, 8).map((d) => [d.id]);

  it('draws a bracket with seeded matches and round names', () => {
    const t = createTournament(ids, 'duel', 9);
    expect(t.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
    expect(roundName(t, 0)).toBe('Quarter-finals');
    expect(roundName(t, 2)).toBe('Final');
    expect(new Set(t.rounds.flat().map((m) => m.seed)).size).toBe(7);
    expect(() => createTournament(ids.slice(0, 6), 'duel', 1)).toThrow();
  });

  it('plays out to one champion, winners moving up the bracket', () => {
    const t = createTournament(ids, 'duel', 4);
    for (let n = nextMatch(t); n; n = nextMatch(t)) report(t, n.r, n.i, decide(simulate(n.m, def)));
    const c = champion(t)!;
    expect(ids.map((e) => e[0])).toContain(c[0]);
    const final = t.rounds[2][0];
    expect([final.a![0], final.b![0]]).toContain(c[0]);
    for (const m of t.rounds.flat()) expect(m.winner).not.toBeNull();
  });

  it('a skipped match ends exactly like the watched one (same seed)', () => {
    const t = createTournament(ids, 'duel', 11);
    const m = t.rounds[0][1];
    const skipped = simulate(m, def);
    const watched = run(new Sim([m.a!.map(def), m.b!.map(def)], m.seed));
    expect(watched.winner).toBe(skipped.winner);
    expect(watched.t).toBe(skipped.t);
  });

  it('tag-team brackets fight in pairs', () => {
    const pairs = ROSTER.slice(0, 8).map((d, i, a) => (i % 2 ? null : [d.id, a[i + 1].id])).filter(Boolean) as string[][];
    const t = createTournament(pairs, 'tag', 5);
    const sim = simulate(t.rounds[0][0], def);
    expect(sim.fighters.length).toBe(4);
    for (let n = nextMatch(t); n; n = nextMatch(t)) report(t, n.r, n.i, decide(simulate(n.m, def)));
    expect(champion(t)!.length).toBe(2);
  });

  it('a draw still produces a winner', () => {
    const sim = new Sim([[def('chef')], [def('chef')]], 1);
    sim.over = true;
    sim.winner = -1;
    expect([0, 1]).toContain(decide(sim));
  });

  it('reporting twice keeps the first result', () => {
    const t = createTournament(ids, 'duel', 2);
    report(t, 0, 0, 0);
    report(t, 0, 0, 1);
    expect(t.rounds[0][0].winner).toBe(0);
    expect(t.rounds[1][0].a).toEqual(t.rounds[0][0].a);
  });
});
