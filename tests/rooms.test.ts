import { describe, expect, it } from 'vitest';
import { Room, type RoomState } from '../src/net/roomState';
import { roomCheckpoint, roomSimulation, stepRoom, targetTick } from '../src/net/roomSim';
import { byId } from '../src/data/roster';
import { offersFor } from '../src/modes/gacha';

const now = 10_000;
const locked = (mode: RoomState['mode'] = 'classic1', opponent = 'nurse') => {
  const room = new Room(mode, now);
  room.sit(1000, now, 'blue');
  room.sit(1000, now, 'red');
  room.act(0, { t: 'lock', ids: ['chef'], match: 1 }, now);
  room.act(1, { t: 'lock', ids: [opponent], match: 1 }, now);
  return room;
};

describe('authoritative room', () => {
  it('hides the lineup until both lock, and supports rematching within the same room', () => {
    const room = new Room('classic1', now);
    room.sit(1000, now, 'blue');
    room.sit(1050, now, 'red');
    room.act(0, { t: 'lock', ids: ['chef'], match: 1 }, now);
    expect(room.view(1).lineups).toBeNull();
    expect(room.view(1).mine).toEqual([]);
    expect(JSON.stringify(room.view(1))).not.toContain('blue');
    room.act(1, { t: 'lock', ids: ['nurse'], match: 1 }, now);
    expect(room.view(0).lineups).toEqual([['chef'], ['nurse']]);
    room.elapse(room.alarmAt);
    expect(room.phase).toBe('result');
    room.act(0, { t: 'rematch', match: 1 }, room.at);
    room.act(1, { t: 'rematch', match: 1 }, room.at);
    expect(room.match).toBe(2);
    expect(room.phase).toBe('picks');
    expect(room.seats[0]?.token).toBe('blue');
  });

  it('commits draft choices in seat order and replays through the same surge boundary', () => {
    const room = locked('gacha1');
    for (const team of [1, 0] as const) {
      const id = offersFor(room.seed, team, 0, 0, [byId(team ? 'nurse' : 'chef')!], [])[0].id;
      room.act(team, { t: 'card', id, reroll: 0, pick: 0, match: 1 }, now);
    }
    expect(room.log.map(p => p.team)).toEqual([0, 1]);
    const view = room.view(0);
    const tick = targetTick(view, room.alarmAt);
    const live = roomSimulation(view);
    stepRoom(live, view.log, tick);
    const restored = roomSimulation(view);
    stepRoom(restored, view.log, tick);
    expect(live.paused).toBe(true);
    expect(roomCheckpoint(restored)).toEqual(roomCheckpoint(live));
    room.elapse(room.alarmAt);
    expect(room.phase).toBe('draft');
    expect(room.pick).toBe(1);
  });

  it('replays a disputed result using the confirmed log', () => {
    const room = locked();
    const view = room.view(0);
    const sim = roomSimulation(view);
    stepRoom(sim, [], 7000);
    const t = view.at + sim.tick * 1000 / 60 + 100;
    room.act(0, { t: 'report', tick: sim.tick, hash: roomCheckpoint(sim), winner: sim.winner ?? -1, match: 1 }, t);
    room.act(1, { t: 'report', tick: sim.tick, hash: 'wrong', winner: sim.winner ?? -1, match: 1 }, t);
    expect(room.view(0).result).toEqual({ tick: sim.tick, hash: roomCheckpoint(sim), winner: sim.winner });
  });
  it('reconnects through confirmed drafts without replay-dependent events', () => {
    const room = locked('gacha1');
    room.elapse(room.alarmAt);
    const first = room.view(0);
    const live = roomSimulation(first);
    const events: string[] = [];
    stepRoom(live, first.log, first.boundary, (batch) => events.push(JSON.stringify(batch)));
    expect(live.paused).toBe(true);
    room.elapse(room.alarmAt);
    room.elapse(room.alarmAt);
    const next = room.view(0);
    const target = next.tick + 300;
    stepRoom(live, next.log, target, (batch) => events.push(JSON.stringify(batch)));
    const restored = roomSimulation(next);
    const replayed: string[] = [];
    stepRoom(restored, next.log, target, (batch) => replayed.push(JSON.stringify(batch)));
    expect(replayed).toEqual(events);
    expect(roomCheckpoint(restored)).toBe(roomCheckpoint(live));
  });

  it('settles a result when just one player is connected', () => {
    const room = locked();
    const view = room.view(0);
    const sim = roomSimulation(view);
    stepRoom(sim, [], view.boundary);
    const time = view.at + Math.ceil(sim.tick * 1000 / 60);
    room.act(0, { t: 'report', tick: sim.tick, hash: roomCheckpoint(sim), winner: sim.winner ?? -1, match: 1 }, time);
    room.elapse(room.alarmAt);
    expect(room.phase).toBe('result');
    expect(room.view(0).result?.hash).toBe(roomCheckpoint(sim));
  });

  it('detects a Gacha knockout at an unreported surge boundary', () => {
    const room = locked('gacha1', 'firefighter');
    room.seed = 21;
    for (let phase = 0; phase < 18 && room.phase !== 'result'; phase++) {
      room.elapse(room.alarmAt);
    }
    expect(room.phase).toBe('result');
    expect(room.pick).toBeLessThan(8);
    expect(room.result?.winner).not.toBeNull();
  });

});
