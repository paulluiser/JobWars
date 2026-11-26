import { expect, it, vi } from 'vitest';
import { ROSTER } from '../src/data/roster';
import { Game } from '../src/game';
import { FighterView, ROYALE_FIGHTER_SCALE } from '../src/render/fighterView';
import type { Fx } from '../src/render/fx';
import { Juice } from '../src/render/juice';
import { Sim } from '../src/sim/sim';
import type { SimEvent } from '../src/sim/types';

function battle() {
  const sim = new Sim([[ROSTER[0]], [ROSTER[1]]], 42, { timeLimit: 9.5 });
  const sfx = {
    update: vi.fn(), charge: vi.fn(), mood: vi.fn(), tick: vi.fn(), heartbeat: vi.fn(), special: vi.fn(), bell: vi.fn(), skill: vi.fn(), jingle: vi.fn(),
  };
  const hud = { update: vi.fn(), skillFired: vi.fn(), callout: vi.fn() };
  const castPlate = vi.fn();
  const cutscene = { play: vi.fn() };
  const intro = { stop: vi.fn() };
  const telegraph = vi.fn();
  const reticle = vi.fn();
  const point = () => ({ x: 100, y: 100 });
  const game = Object.assign(Object.create(Game.prototype), {
    sim, sfx, hud, cutscene, intro,
    juice: new Juice(),
    scene: { render: vi.fn(), fx: { castBurst: vi.fn(), castPlate, ring: vi.fn(), telegraph, reticle }, views: [{ point }, { point }] },
    reportMatch: vi.fn(),
    speed: 1, acc: 0, started: true, introT: 0, cutT: 0, endT: -1, lastTick: -1, heartT: 0,
    specialCasts: {}, cutMode: 'short', spec: {},
  }) as {
    frame(dt: number): void;
    handle(events: SimEvent[]): void;
    started: boolean;
    introT: number;
    juice: Juice;
    roomLink?: object;
    roomRun?: object;
    drafting?: boolean;
  };
  return { game, sim, sfx, hud, castPlate, cutscene, telegraph, reticle, intro };
}

it('keeps combat countdown, heartbeat and charge quiet during a draft and resumes them with the clock', () => {
  const { game, sim, sfx } = battle();
  const fighter = sim.fighters[0];
  fighter.hp = fighter.maxHp * 0.2;
  fighter.state = 'charge';
  fighter.stateT = 0.25;
  fighter.stateDur = 1;
  sim.paused = true;
  game.drafting = true;

  game.frame(0.02);
  expect(sfx.mood).toHaveBeenLastCalledWith('off');
  expect(sfx.tick).not.toHaveBeenCalled();
  expect(sfx.heartbeat).not.toHaveBeenCalled();
  expect(sfx.charge).toHaveBeenCalledWith(0, null);

  sim.resume();
  game.drafting = false;
  game.frame(0.02);
  game.frame(0.02);
  expect(sfx.mood).toHaveBeenLastCalledWith('tense');
  expect(sfx.tick).toHaveBeenCalledExactlyOnceWith(false);
  expect(sfx.heartbeat).toHaveBeenCalledTimes(1);
  expect(sfx.charge).toHaveBeenCalledWith(0, expect.any(Number));
});

it('keeps combat audio quiet during a room restart countdown', () => {
  const { game, sim, sfx } = battle();
  sim.fighters[0].hp *= 0.1;
  game.roomLink = { view: { phase: 'fight', at: 9000 }, clock: () => 8000 };
  game.roomRun = { fightBuilt: true };

  game.frame(0.02);
  expect(sfx.mood).toHaveBeenLastCalledWith('off');
  expect(sfx.tick).not.toHaveBeenCalled();
  expect(sfx.heartbeat).not.toHaveBeenCalled();
});

it('rings the fight bell only when a room resumes after reconnecting to a draft', () => {
  const { game, sfx, intro } = battle();
  const view = { phase: 'draft', at: 0, log: [], tick: 0, boundary: 100 };
  game.roomLink = { view, clock: () => 8000 };
  game.roomRun = { fightBuilt: true };
  game.introT = 2.3;

  game.frame(0.02);
  expect(intro.stop).toHaveBeenCalledTimes(1);
  expect(sfx.bell).not.toHaveBeenCalled();

  view.phase = 'fight';
  view.at = 8000;
  game.frame(0.02);
  expect(sfx.bell).toHaveBeenCalledTimes(1);
});

it('shows a local special move highlight when the cutscene ends', () => {
  const { game, sim, sfx, castPlate, cutscene } = battle();
  const { special } = sim.fighters[0].def;
  game.handle([{ type: 'skill', a: 0, kind: 'special', name: special.name }]);
  expect(cutscene.play).toHaveBeenCalledTimes(1);
  expect(castPlate).not.toHaveBeenCalled();

  game.frame(1);
  expect(cutscene.play).toHaveBeenCalledTimes(1);
  expect(sfx.special).toHaveBeenCalledTimes(1);
  expect(castPlate).toHaveBeenCalledTimes(1);
});

it('shows a synchronized PvP move name with extra effects disabled', () => {
  const { game, sim, castPlate, telegraph, reticle } = battle();
  game.roomLink = {};
  game.juice.enabled = false;
  sim.fighters[0].targetIdx = 1;

  game.handle([{ type: 'skill', a: 0, kind: 'active', name: sim.fighters[0].def.active.name }]);

  expect(castPlate).toHaveBeenCalledTimes(1);
  expect(telegraph).not.toHaveBeenCalled();
  expect(reticle).not.toHaveBeenCalled();
});

it('suppresses a result jingle after leaving the fight', () => {
  vi.useFakeTimers();
  try {
    const { game, sfx } = battle();
    game.handle([{ type: 'end', reason: 'time', winner: -1 }]);
    game.started = false;
    vi.advanceTimersByTime(900);
    expect(sfx.jingle).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it('keeps compact Royale sprites visible through repeated 100ms rendering frames', () => {
  const sim = new Sim([[ROSTER[7]], [ROSTER[1]], [ROSTER[3]]], 42, { royale: true });
  const view = new FighterView(sim.fighters[0], {} as Fx, new Juice(), ROYALE_FIGHTER_SCALE);
  view.update(1, 1 / 60, 0);
  const width = view.root.width;
  view.squash(6, -5);
  for (let i = 0; i < 15; i++) {
    view.update(1, 0.1, 0);
    expect(view.root.width).toBeGreaterThan(width * 0.55);
    expect(view.root.width).toBeLessThan(width * 1.8);
  }
  view.root.destroy({ children: true });
});
