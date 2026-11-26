import { expect, it, vi } from 'vitest';
import { ROSTER } from '../src/data/roster';
import { Sim } from '../src/sim/sim';

function fight(surgeEvery = 0, timeLimit = 120) {
  return new Sim([[ROSTER[0]], [ROSTER[1]]], 42, { surgeEvery, timeLimit });
}

it('counts down using combat time and resumes at the next draft after a pick', () => {
  const sim = fight(15);
  expect(sim.nextDraftIn).toBe(15);
  sim.t = 14.2;
  expect(sim.nextDraftIn).toBeCloseTo(0.8);
  sim.t = 15;
  expect(sim.step()).toContainEqual({ type: 'surge', n: 1 });
  expect(sim.nextDraftIn).toBeNull();
  sim.resume();
  expect(sim.nextDraftIn).toBe(15);
});

it('hides the countdown when the match ends before another draft', () => {
  expect(fight().nextDraftIn).toBeNull();
  expect(fight(15, 15).nextDraftIn).toBeNull();
  const sim = fight(15);
  sim.over = true;
  expect(sim.nextDraftIn).toBeNull();
});

it('attributes an elimination to the actual lethal damage source', () => {
  const sim = fight();
  const [attacker, victim] = sim.fighters;
  const emit = vi.spyOn(sim, 'emit');
  sim.damage(victim, victim.maxHp * 2, attacker.idx);
  expect(emit).toHaveBeenCalledWith({ type: 'ko', b: victim.idx, by: attacker.idx });
});

it('leaves environmental and self-inflicted eliminations unattributed', () => {
  for (const source of [-1, 0]) {
    const sim = fight();
    const [victim] = sim.fighters;
    const emit = vi.spyOn(sim, 'emit');
    sim.damage(victim, victim.maxHp * 2, source);
    expect(emit).toHaveBeenCalledWith({ type: 'ko', b: victim.idx });
  }
});
