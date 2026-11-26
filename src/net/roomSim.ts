import { byId } from '../data/roster';
import { GACHA } from '../data/cards';
import { gachaOpts, type Pick } from '../modes/gacha';
import { DT, TICK_RATE, TIME_LIMIT } from '../sim/constants';
import { Sim } from '../sim/sim';
import type { SimEvent } from '../sim/types';
import { PVP_MODES, type PvpMode } from './pvpModes';

function ticksAt(times: number[]): number[] {
  let elapsed = 0, tick = 0;
  return times.map((time) => {
    while (elapsed < time) {
      elapsed += DT;
      tick++;
    }
    return tick;
  });
}

export const SURGE_TICKS = ticksAt(
  Array.from({ length: Math.ceil(GACHA.timeLimit / GACHA.surgeEvery) - 1 }, (_, i) => (i + 1) * GACHA.surgeEvery),
);
const [classicEnd, gachaEnd] = ticksAt([TIME_LIMIT, GACHA.timeLimit]);
export const roomBoundary = (mode: PvpMode, pick: number) =>
  PVP_MODES[mode].gacha ? SURGE_TICKS[pick] ?? gachaEnd : classicEnd;

export function targetTick(segment: { tick: number; at: number; boundary: number }, now: number) {
  return Math.min(segment.boundary, segment.tick + Math.max(0, Math.floor((now - segment.at) * TICK_RATE / 1000 + 1e-8)));
}

export function roomSimulation(match: { seed: number; mode: PvpMode; lineups: [string[], string[]] | null; log: Pick[] }) {
  if (!match.lineups) throw new Error('Both teams must lock before combat.');
  const jobs = (index: 0 | 1) => match.lineups![index].map((id) => byId(id)!);
  const cards = (index: 0 | 1) => match.log.filter((p) => p.pick === 0 && p.team === index).map((p) => p.id);
  const opts = PVP_MODES[match.mode].gacha ? gachaOpts([cards(0), cards(1)]) : {};
  return new Sim([jobs(0), jobs(1)], match.seed, opts);
}

const traces = new WeakMap<Sim, number>();
const zeroTrace = 0x811c9dc5;

export function roomCheckpoint(sim: Sim) {
  return sim.checkpoint() + ((traces.get(sim) ?? zeroTrace) >>> 0).toString(16).padStart(8, '0');
}

function recordEvents(sim: Sim, events: SimEvent[]) {
  const data = JSON.stringify([sim.tick, events]);
  let hash = traces.get(sim) ?? zeroTrace;
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 0x01000193);
  traces.set(sim, hash);
}

/** Advance exactly to the requested tick, stopping at any draft without both confirmed picks. */
export function stepRoom(sim: Sim, log: readonly Pick[], target: number, present?: (events: SimEvent[]) => void) {
  while (!sim.over) {
    if (sim.paused) {
      const cards = log.filter((p) => p.pick === sim.surges);
      if (cards.length !== 2) return;
      for (const card of cards) {
        const events = sim.addCard(card.team, card.id);
        if (events.length) {
          recordEvents(sim, events);
          present?.(events);
        }
      }
      sim.resume();
    }
    // Sim announces a surge before consuming the next tick.
    const atSurge = sim.surgeEvery && sim.tick === SURGE_TICKS[sim.surges];
    if (sim.tick >= target && !atSurge) return;
    const events = sim.step();
    if (events.length) {
      recordEvents(sim, events);
      present?.(events);
    }
  }
}
