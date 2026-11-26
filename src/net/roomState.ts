import { DEFAULT_ARENA, resolveArena, type ArenaId } from '../data/arenas';
import { GACHA } from '../data/cards';
import { byId } from '../data/roster';
import { cpuPick, offersFor, type Pick } from '../modes/gacha';
import { TICK_RATE } from '../sim/constants';
import type { Team } from '../sim/types';
import { PVP_MODES, type PvpMode } from './pvpModes';
import { roomBoundary, roomCheckpoint, roomSimulation, stepRoom, SURGE_TICKS, targetTick } from './roomSim';
import type { Checkpoint, Outcome, Phase, RoomAction, RoomView } from './roomWire';

type Pair<T> = [T, T];
interface Seat { token: string; mmr: number }
type Report = Checkpoint & { winner?: Team | -1 };
const ROOM_IDLE_MS = 5 * 60_000;
const other = (seat: Team): Team => seat === 0 ? 1 : 0;

export class Room {
  seats: Pair<Seat | null> = [null, null];
  phase: Phase = 'waiting';
  match = 1;
  locked: Pair<string[] | null> = [null, null];
  lineups: Pair<string[]> | null = null;
  arena: ArenaId = DEFAULT_ARENA;
  seed = 0;
  at = 0;
  tick = 0;
  pick = 0;
  expires: number;
  log: Pick[] = [];
  rerolls: Pair<number> = [0, 0];
  private selections: Pair<string | null> = [null, null];
  private reports: Pair<Report | null> = [null, null];
  private verifyAt: number | null = null;
  rematch: Pair<boolean> = [false, false];
  result: Outcome | null = null;
  repair: Checkpoint | null = null;

  constructor(readonly mode: PvpMode, now: number) {
    this.expires = now + ROOM_IDLE_MS;
  }

  static restore(state: RoomState) {
    return Object.assign(new Room(state.mode, 0), state);
  }

  get boundary() { return roomBoundary(this.mode, this.pick); }
  get alarmAt() {
    return Math.min(this.phaseAlarmAt, this.verifyAt ?? Infinity);
  }

  private get phaseAlarmAt() {
    switch (this.phase) {
      case 'fight': return this.at + Math.ceil((this.boundary - this.tick) * 1000 / TICK_RATE) + 1000;
      case 'draft': return this.at;
      default: return this.expires;
    }
  }

  sit(mmr: number, now: number, token: string = crypto.randomUUID()): Team | null {
    const seat = this.seats.findIndex((candidate) => !candidate);
    if (seat < 0 || this.phase !== 'waiting') return null;
    this.seats[seat] = { mmr, token };
    if (seat === 1) {
      this.phase = 'picks';
      this.expires = now + ROOM_IDLE_MS;
    }
    return seat as Team;
  }

  view(team: Team, present: Pair<boolean> = [true, true]): RoomView {
    const { match, mode, phase, at, tick, pick, seed, arena, lineups, log, rematch, result, repair, boundary } = this;
    return {
      match, mode, team, phase, at, tick, boundary, pick, seed, arena, lineups, log,
      mine: this.locked[team] ?? [], ready: [!!this.locked[0], !!this.locked[1]],
      present, rematch, rivalMmr: this.seats[other(team)]?.mmr ?? 1000,
      chosen: this.selections[team] !== null, reported: this.reports[team]?.tick ?? null, rerolls: this.rerolls[team], result, repair,
    };
  }

  elapse(now: number): boolean {
    if (this.phase === 'closed' || now < this.alarmAt) return false;
    let changed = false;
    if (this.verifyAt !== null && now >= this.verifyAt) {
      this.verifyAt = null;
      changed = true;
      const result = this.reports.find((report) => report?.winner !== undefined);
      if (result) {
        const sim = this.replay(result.tick);
        if (sim.over) {
          this.finish({ tick: sim.tick, hash: roomCheckpoint(sim), winner: sim.winner ?? -1 }, now);
          return true;
        }
      }
    }
    if (now < this.phaseAlarmAt) return changed;
    if (this.phase === 'draft') this.finishDraft(now);
    else if (this.phase === 'fight') {
      this.tick = this.boundary;
      const canDraft = PVP_MODES[this.mode].gacha && this.pick < SURGE_TICKS.length;
      const [first, second] = this.reports;
      const agreedPause = first?.tick === this.tick && second?.tick === this.tick &&
        first.winner === undefined && second.winner === undefined && first.hash === second.hash;
      const verified = !canDraft || !agreedPause ? this.replay(this.tick) : null;
      if (verified?.over || !canDraft) {
        this.finish({ tick: verified!.tick, hash: roomCheckpoint(verified!), winner: verified!.winner ?? -1 }, now);
      } else {
        this.pick++;
        this.rerolls = [0, 0];
        this.phase = 'draft';
        this.at = now + 12_000;
      }
    } else this.phase = 'closed';
    return true;
  }

  act(team: Team, action: RoomAction, now: number): boolean {
    if (action.match !== this.match || this.phase === 'closed') return false;
    switch (action.t) {
      case 'lock': {
        if (this.phase !== 'picks' || this.locked[team]) return false;
        const need = PVP_MODES[this.mode].tag ? 2 : 1;
        if (!Array.isArray(action.ids) || action.ids.length !== need || new Set(action.ids).size !== need || !action.ids.every((id) => typeof id === 'string' && !!byId(id))) return false;
        this.locked[team] = action.ids;
        if (this.locked[0] && this.locked[1]) {
          this.lineups = [this.locked[0], this.locked[1]];
          this.seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
          this.arena = resolveArena('auto', this.lineups.flat(), this.seed);
          this.phase = PVP_MODES[this.mode].gacha ? 'draft' : 'fight';
          this.at = now + (this.phase === 'draft' ? 25_000 : 2700);
        }
        return true;
      }
      case 'reroll':
        if (this.phase !== 'draft' || action.pick !== this.pick || this.selections[team] || now >= this.at
          || action.reroll !== this.rerolls[team] + 1 || action.reroll > GACHA.rerolls) return false;
        this.rerolls[team] = action.reroll;
        return true;
      case 'card': {
        if (this.phase !== 'draft' || action.pick !== this.pick || this.selections[team] || now >= this.at) return false;
        if (!Number.isInteger(action.reroll) || action.reroll < this.rerolls[team] || action.reroll > GACHA.rerolls) return false;
        if (!this.offers(team, action.reroll).some((card) => card.id === action.id)) return false;
        this.rerolls[team] = action.reroll;
        this.selections[team] = action.id;
        if (this.selections.every(Boolean)) this.finishDraft(now);
        return true;
      }
      case 'report':
        return this.report(team, action, now);
      case 'rematch':
        if (this.phase !== 'result' || this.rematch[team]) return false;
        this.rematch[team] = true;
        if (this.rematch.every(Boolean)) {
          const { seats, mode, match } = this;
          Object.assign(this, new Room(mode, now), { seats, match: match + 1, phase: 'picks' });
        }
        return true;
      case 'leave':
        this.phase = 'closed';
        return true;
      default:
        return false;
    }
  }

  private offers(team: Team, reroll: number) {
    const lineup = this.lineups![team].map((id) => byId(id)!);
    return offersFor(this.seed, team, this.pick, reroll, lineup, this.log.filter((p) => p.team === team).map((p) => p.id));
  }

  private finishDraft(now: number) {
    const picked = ([0, 1] as const).map((team) => ({
      team,
      pick: this.pick,
      id: this.selections[team] ?? cpuPick(this.seed, team, this.pick, this.offers(team, this.rerolls[team])).id,
    }));
    this.log.push(...picked);
    this.selections = [null, null];
    this.reports = [null, null];
    this.verifyAt = null;
    this.phase = 'fight';
    this.at = now + (this.pick === 0 ? 2700 : 650);
  }

  private replay(tick: number) {
    const sim = roomSimulation(this);
    stepRoom(sim, this.log, tick);
    return sim;
  }

  private report(team: Team, report: Report, now: number) {
    if (!(this.phase === 'fight' || this.phase === 'draft') || !this.lineups) return false;
    const { tick, hash, winner } = report;
    const checkpoint = this.phase === 'fight' ? this.boundary : this.tick;
    if (!Number.isInteger(tick) || tick < this.tick || tick > checkpoint || typeof hash !== 'string' || hash.length > 32) return false;
    if (winner === undefined && tick !== checkpoint) return false;
    if (winner !== undefined && winner !== 0 && winner !== 1 && winner !== -1) return false;
    if (this.phase === 'fight' && tick > targetTick(this, now + 500)) return false;
    if (this.reports[team]) return false;
    this.reports[team] = { tick, hash, winner };
    const rival = this.reports[other(team)];
    if (!rival && winner !== undefined) this.verifyAt = now + 1500;
    if (rival) {
      if (hash === rival.hash && tick === rival.tick && winner === rival.winner) {
        if (winner !== undefined) this.finish({ tick, hash, winner }, now);
      } else {
        const sim = this.replay(checkpoint);
        if (sim.over) this.finish({ tick: sim.tick, hash: roomCheckpoint(sim), winner: sim.winner ?? -1 }, now);
        else this.repair = { tick: sim.tick, hash: roomCheckpoint(sim) };
      }
    }
    return true;
  }

  private finish(result: Outcome, now: number) {
    this.result = result;
    this.verifyAt = null;
    this.phase = 'result';
    this.at = now;
    this.tick = result.tick;
    this.expires = now + ROOM_IDLE_MS;
  }
}

export type RoomState = Omit<Room, 'sit' | 'view' | 'elapse' | 'act' | 'boundary' | 'alarmAt'>;
