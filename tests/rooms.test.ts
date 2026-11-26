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

  it('keeps normalized names in seat order across restore and fills unnamed seats', () => {
    const room = new Room('royaleClassic', now);
    expect(room.sit(1000, now, 'host', '  Tía  Luz  ')).toBe(0);
    expect(room.sit(1000, now, 'guest', '勇者')).toBe(1);
    expect(room.sit(1000, now, 'legacy')).toBe(2);
    const restored = Room.restore(JSON.parse(JSON.stringify(room)));
    expect(restored.view(1, [false, true, false, false, false]).playerNames)
      .toEqual(['Tía Luz', '勇者', 'Player 3', 'Player 4', 'Player 5']);
  });

  it.each(['', '   ', 'a\nb', 'bad\u202e', 'invisible\u034f', 'x'.repeat(25)])('rejects invalid display name %j', (name) => {
    const room = new Room('classic1', now);
    expect(room.sit(1000, now, 'host', name)).toBeNull();
    expect(room.sit(1000, now, 'replacement')).toBe(0);
  });

  it('cancels a duel lock before the other player locks and accepts a replacement', () => {
    const room = new Room('classic1', now);
    room.sit(1000, now, 'blue');
    room.sit(1000, now, 'red');
    expect(room.act(0, { t: 'lock', ids: ['chef'], match: 1 }, now)).toBe(true);
    expect(room.act(0, { t: 'unlock', match: 1 }, now)).toBe(true);
    expect(room.view(0)).toMatchObject({ phase: 'picks', mine: [], ready: [false, false] });
    expect(room.act(1, { t: 'lock', ids: ['nurse'], match: 1 }, now)).toBe(true);
    expect(room.view(0).lineups).toBeNull();
    expect(room.act(0, { t: 'lock', ids: ['builder'], match: 1 }, now)).toBe(true);
    expect(room.view(0).lineups).toEqual([['builder'], ['nurse']]);
    expect(room.act(0, { t: 'unlock', match: 1 }, now)).toBe(false);
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

  it('restores accepted rerolls during a draft and resets the allowance at the next draft', () => {
    const room = locked('gacha1');
    room.seed = 21;
    for (const reroll of [1, 2]) {
      expect(room.act(1, { t: 'reroll', reroll, pick: 0, match: 1 }, now)).toBe(true);
    }
    const restored = Room.restore(JSON.parse(JSON.stringify(room)));
    expect(restored.view(1).rerolls).toBe(2);
    expect(restored.act(1, { t: 'reroll', reroll: 3, pick: 0, match: 1 }, now)).toBe(false);
    const jobs = [byId('nurse')!];
    const initial = offersFor(room.seed, 1, 0, 0, jobs, [])[0].id;
    const discarded = offersFor(room.seed, 1, 0, 1, jobs, [])[0].id;
    const current = offersFor(room.seed, 1, 0, 2, jobs, [])[0].id;
    expect(restored.act(1, { t: 'card', id: initial, reroll: 0, pick: 0, match: 1 }, now)).toBe(false);
    expect(restored.act(1, { t: 'card', id: discarded, reroll: 2, pick: 0, match: 1 }, now)).toBe(false);
    expect(restored.act(1, { t: 'card', id: current, reroll: 2, pick: 0, match: 1 }, now)).toBe(true);
    restored.elapse(restored.alarmAt);
    restored.elapse(restored.alarmAt);
    expect(restored.view(1)).toMatchObject({ phase: 'draft', pick: 1, rerolls: 0 });
    expect(restored.act(1, { t: 'reroll', reroll: 1, pick: 1, match: 1 }, restored.at - 1)).toBe(true);
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
    const room = locked('gacha1', 'builder');
    room.seed = 18;
    for (let phase = 0; phase < 18 && room.phase !== 'result'; phase++) {
      room.elapse(room.alarmAt);
    }
    expect(room.phase).toBe('result');
    expect(room.pick).toBeLessThan(8);
    expect(room.result?.tick).toBeLessThan(room.boundary);
    expect(room.result?.winner).toBe(0);
  });

});

const royaleJobs = ['chef', 'nurse', 'builder', 'firefighter', 'electrician'];
const royaleLobby = (mode: 'royaleClassic' | 'royaleGacha' = 'royaleClassic', count = 5) => {
  const room = new Room(mode, now);
  for (let i = 0; i < count; i++) room.sit(1000, now, 'token-' + i);
  return room;
};

describe('invite-only battle royale rooms', () => {
  it('blocks the host from starting until a player who cancels has locked again', () => {
    const room = royaleLobby('royaleClassic', 3);
    const present = [true, true, true, false, false];
    for (const team of [0, 1, 2] as const) room.act(team, { t: 'lock', ids: [royaleJobs[team]], match: 1 }, now);
    expect(room.act(2, { t: 'unlock', match: 1 }, now)).toBe(true);
    expect(room.act(0, { t: 'start', match: 1 }, now, present)).toBe(false);
    expect(room.act(2, { t: 'lock', ids: ['electrician'], match: 1 }, now)).toBe(true);
    expect(room.act(0, { t: 'start', match: 1 }, now, present)).toBe(true);
    expect(room.view(0).lineups?.[2]).toEqual(['electrician']);
    expect(room.act(2, { t: 'unlock', match: 1 }, now)).toBe(false);
  });

  const start = { t: 'start', match: 1 } as const;

  it('starts only when the host asks and at least three occupied seats are connected and locked', () => {
    const room = royaleLobby('royaleClassic', 2);
    const lock = (team: 0 | 1 | 2) => room.act(team, { t: 'lock', ids: [royaleJobs[team]], match: 1 }, now);
    expect(lock(0)).toBe(true);
    expect(lock(1)).toBe(true);
    expect(room.act(0, start, now, [true, true])).toBe(false);
    expect(room.sit(1000, now, 'third')).toBe(2);
    expect(room.act(0, start, now, [true, true, true])).toBe(false);
    expect(lock(2)).toBe(true);
    expect(room.view(0).phase).toBe('waiting');
    expect(room.view(0).lineups).toBeNull();
    expect(room.view(0).occupied).toEqual([true, true, true, false, false]);
    expect(room.act(1, start, now, [true, true, true])).toBe(false);
    expect(room.act(0, start, now, [true, true, false])).toBe(false);
    expect(room.act(0, start, now, [true, true, true])).toBe(true);
    expect(room.view(0).lineups).toEqual([['chef'], ['nurse'], ['builder'], [], []]);
    expect(room.sit(1000, now, 'late')).toBeNull();
  });

  it('retains reconnect seats, clears a departing guest lock, and closes when the host leaves the lobby', () => {
    const room = royaleLobby();
    expect(room.sit(1000, now, 'overflow')).toBeNull();
    room.act(1, { t: 'lock', ids: ['nurse'], match: 1 }, now);
    const restored = Room.restore(JSON.parse(JSON.stringify(room)));
    expect(restored.seats[1]?.token).toBe('token-1');
    expect(restored.view(1).mine).toEqual(['nurse']);
    expect(restored.act(1, { t: 'leave', match: 1 }, now)).toBe(true);
    expect(restored.sit(1000, now, 'replacement')).toBe(1);
    expect(restored.view(1).mine).toEqual([]);
    expect(restored.act(0, { t: 'leave', match: 1 }, now)).toBe(true);
    expect(restored.phase).toBe('closed');
  });

  it('keeps a combat seat and verifies a reported result through the simulation', () => {
    const room = royaleLobby();
    const seats = [0, 1, 2, 3, 4] as const;
    for (const team of seats) {
      expect(room.act(team, { t: 'lock', ids: [royaleJobs[team]], match: 1 }, now)).toBe(true);
    }
    expect(room.act(0, start, now, seats.map(() => true))).toBe(true);
    room.seed = 2;
    const view = room.view(0);
    const sim = roomSimulation(view);
    stepRoom(sim, [], view.boundary);
    const wrongWinner = sim.winner === 4 ? 3 : 4;
    const time = view.at + Math.ceil(sim.tick * 1000 / 60);
    room.act(4, { t: 'leave', match: 1 }, time);
    expect(room.phase).toBe('fight');
    expect(room.seats[4]?.token).toBe('token-4');
    for (const team of [0, 1] as const) {
      room.act(team, { t: 'report', tick: sim.tick, hash: 'forged', winner: wrongWinner, match: 1 }, time);
    }
    if (room.phase === 'fight') room.elapse(room.alarmAt);
    expect(room.result).toEqual({ tick: sim.tick, hash: roomCheckpoint(sim), winner: sim.winner });
  });

  it('returns to the lobby when the remaining three players already voted to rematch', () => {
    const room = royaleLobby('royaleClassic', 4);
    const seats = [0, 1, 2, 3] as const;
    for (const team of seats) room.act(team, { t: 'lock', ids: [royaleJobs[team]], match: 1 }, now);
    room.act(0, start, now, seats.map(() => true));
    room.elapse(room.alarmAt);
    expect(room.phase).toBe('result');
    for (const team of [0, 1, 3] as const) room.act(team, { t: 'rematch', match: 1 }, room.at);
    expect(room.phase).toBe('result');
    expect(room.act(2, { t: 'leave', match: 1 }, room.at)).toBe(true);
    expect(room.view(0)).toMatchObject({
      phase: 'waiting', match: 2, occupied: [true, true, false, true, false],
      ready: [false, false, false, false, false],
    });
    expect(room.sit(1000, now, 'new guest')).toBe(2);
  });

  it('closes if the host leaves the result and keeps rematches gated to at least three seats', () => {
    const room = royaleLobby('royaleClassic', 3);
    const seats = [0, 1, 2] as const;
    for (const team of seats) room.act(team, { t: 'lock', ids: [royaleJobs[team]], match: 1 }, now);
    room.act(0, start, now, seats.map(() => true));
    room.elapse(room.alarmAt);
    expect(room.phase).toBe('result');
    room.act(0, { t: 'rematch', match: 1 }, room.at);
    room.act(1, { t: 'rematch', match: 1 }, room.at);
    room.act(2, { t: 'leave', match: 1 }, room.at);
    expect(room.view(0)).toMatchObject({ phase: 'result', match: 1, occupied: [true, true, false, false, false] });
    expect(room.act(0, { t: 'leave', match: 1 }, room.at)).toBe(true);
    expect(room.phase).toBe('closed');
  });

  it('applies Gacha surge cards exclusively for surviving seats and restores deterministic replay', () => {
    const room = royaleLobby('royaleGacha');
    const seats = [0, 2, 3, 4] as const;
    room.act(1, { t: 'leave', match: 1 }, now);
    for (const team of seats) {
      expect(room.act(team, { t: 'lock', ids: [royaleJobs[team]], match: 1 }, now)).toBe(true);
    }
    expect(room.act(0, start, now, [true, false, true, true, true])).toBe(true);
    room.seed = 2;
    expect(room.view(0).eligible).toEqual([...seats]);
    const offers = seats.map((team) => offersFor(room.seed, team, 0, 0, [byId(royaleJobs[team])!], []));
    expect(new Set(offers.map((cards) => cards[0].rarity)).size).toBe(1);
    room.elapse(room.alarmAt);
    expect(room.log.map(({ team }) => team)).toEqual([...seats]);
    let sawElimination = false;
    while (room.phase === 'fight') {
      const view = room.view(0);
      const live = roomSimulation(view);
      stepRoom(live, view.log, view.boundary);
      room.elapse(room.alarmAt);
      const draft = room.view(0);
      if (draft.phase !== 'draft') break;
      const survivors = live.fighters.filter((fighter) => fighter.hp > 0).map((fighter) => fighter.team);
      expect(draft.eligible).toEqual(survivors);
      expect(draft.rerolls).toBe(0);
      const eliminated = seats.find((team) => !survivors.includes(team));
      if (eliminated !== undefined) {
        sawElimination = true;
        expect(room.act(eliminated, { t: 'reroll', pick: draft.pick, reroll: 1, match: 1 }, draft.at - 1)).toBe(false);
      }
      const restored = Room.restore(JSON.parse(JSON.stringify(room)));
      restored.elapse(restored.alarmAt);
      room.elapse(room.alarmAt);
      const next = room.view(0);
      const target = next.tick + 10;
      stepRoom(live, next.log, target);
      const replay = roomSimulation(restored.view(0));
      stepRoom(replay, restored.log, target);
      expect(next.log.filter(({ pick }) => pick === draft.pick).map(({ team }) => team)).toEqual(survivors);
      expect(roomCheckpoint(live)).toBe(roomCheckpoint(replay));
    }
    expect(sawElimination).toBe(true);
  });
});
