import { DEFAULT_ARENA, resolveArena, type ArenaId } from '../data/arenas';
import { GACHA } from '../data/cards';
import { byId } from '../data/roster';
import { cpuPick, offersFor, type Pick } from '../modes/gacha';
import { TICK_RATE } from '../sim/constants';
import type { BattleSide, Team } from '../sim/types';
import { PVP_MODES, type PvpMode } from './pvpModes';
import { roomBoundary, roomCheckpoint, roomSimulation, stepRoom, SURGE_TICKS, targetTick } from './roomSim';
import { normalizeDisplayName, type Checkpoint, type Outcome, type Phase, type RoomAction, type RoomView } from './roomWire';

interface Seat { token: string; mmr: number; displayName?: string }
type Report = Checkpoint & { winner?: BattleSide | -1 };
const ROOM_IDLE_MS = 5 * 60_000;
const other = (seat: Team): Team => seat === 0 ? 1 : 0;

export class Room {
  seats: (Seat | null)[];
  phase: Phase = 'waiting';
  match = 1;
  locked: (string[] | null)[];
  lineups: string[][] | null = null;
  arena: ArenaId = DEFAULT_ARENA;
  seed = 0;
  at = 0;
  tick = 0;
  pick = 0;
  expires: number;
  log: Pick[] = [];
  rerolls: number[];
  private eligible: BattleSide[] = [0, 1];
  private selections: (string | null)[];
  private reports: (Report | null)[];
  private verifyAt: number | null = null;
  rematch: boolean[];
  result: Outcome | null = null;
  repair: Checkpoint | null = null;

  constructor(readonly mode: PvpMode, now: number) {
    this.expires = now + ROOM_IDLE_MS;
    const count = this.rules.royale ? 5 : 2;
    this.seats = Array(count).fill(null);
    this.locked = Array(count).fill(null);
    this.rerolls = Array(count).fill(0);
    this.selections = Array(count).fill(null);
    this.reports = Array(count).fill(null);
    this.rematch = Array(count).fill(false);
  }

  static restore(state: RoomState) {
    return Object.assign(new Room(state.mode, 0), state);
  }

  private get rules() { return PVP_MODES[this.mode]; }

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

  sit(mmr: number, now: number, token: string = crypto.randomUUID(), displayName?: string): BattleSide | null {
    const seat = this.seats.findIndex((candidate) => !candidate);
    if (seat < 0 || this.phase !== 'waiting') return null;
    const name = displayName === undefined ? undefined : normalizeDisplayName(displayName);
    if (name === null) return null;
    this.seats[seat] = { mmr, token, displayName: name };
    if (this.rules.royale || seat === 1) this.expires = now + ROOM_IDLE_MS;
    if (!this.rules.royale && seat === 1) this.phase = 'picks';
    return seat as BattleSide;
  }

  view(team: BattleSide, present: boolean[] = this.seats.map(Boolean)): RoomView {
    const { match, mode, phase, at, tick, pick, seed, arena, lineups, log, rematch, result, repair, boundary } = this;
    return {
      match, mode, team, phase, at, tick, boundary, pick, seed, arena, lineups, log,
      mine: this.locked[team] ?? [], ready: this.locked.map(Boolean),
      playerNames: this.seats.map((seat, i) => seat?.displayName ?? `Player ${i + 1}`),
      present, rematch, rivalMmr: this.rules.royale ? 1000 : this.seats[other(team as Team)]?.mmr ?? 1000,
      ...(this.rules.royale ? { occupied: this.seats.map(Boolean) } : {}),
      ...(this.rules.royale && phase === 'draft' ? { eligible: this.eligible } : {}),
      chosen: this.selections[team] !== null, reported: this.reports[team]?.tick ?? null, rerolls: this.rerolls[team], result, repair,
    };
  }

  elapse(now: number): boolean {
    if (this.phase === 'closed' || now < this.alarmAt) return false;
    let changed = false;
    if (this.verifyAt !== null && now >= this.verifyAt) {
      this.verifyAt = null;
      changed = true;
      const tick = this.rules.royale
        ? targetTick(this, now)
        : this.reports.find((report) => report?.winner !== undefined)?.tick;
      if (tick !== undefined) {
        const sim = this.replay(tick);
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
      const canDraft = this.rules.gacha && this.pick < SURGE_TICKS.length;
      const [first, second] = this.reports;
      const agreedPause = !this.rules.royale && first?.tick === this.tick && second?.tick === this.tick &&
        first.winner === undefined && second.winner === undefined && first.hash === second.hash;
      const verified = !canDraft || !agreedPause ? this.replay(this.tick) : null;
      if (verified?.over || !canDraft) {
        this.finish({ tick: verified!.tick, hash: roomCheckpoint(verified!), winner: verified!.winner ?? -1 }, now);
      } else {
        this.pick++;
        this.rerolls.fill(0);
        if (this.rules.royale) this.eligible = verified!.livingSides();
        this.phase = 'draft';
        this.at = now + 12_000;
      }
    } else this.phase = 'closed';
    return true;
  }

  act(team: BattleSide, action: RoomAction, now: number, present: readonly boolean[] = []): boolean {
    if (action.match !== this.match || this.phase === 'closed' || !this.seats[team]) return false;
    switch (action.t) {
      case 'start':
        if (!this.rules.royale || this.phase !== 'waiting' || team !== 0 || !this.hasEnoughSeats() ||
          !this.seats.every((seat, i) => !seat || (this.locked[i] && present[i]))) return false;
        this.start(now);
        return true;
      case 'lock': {
        if (this.phase !== (this.rules.royale ? 'waiting' : 'picks') || this.locked[team]) return false;
        const need = this.rules.tag ? 2 : 1;
        if (!Array.isArray(action.ids) || action.ids.length !== need || new Set(action.ids).size !== need || !action.ids.every((id) => typeof id === 'string' && !!byId(id))) return false;
        this.locked[team] = action.ids;
        if (this.rules.royale) this.expires = now + ROOM_IDLE_MS;
        else if (this.locked.every(Boolean)) this.start(now);
        return true;
      }
      case 'unlock':
        if (this.phase !== (this.rules.royale ? 'waiting' : 'picks') || !this.locked[team]) return false;
        this.locked[team] = null;
        if (this.rules.royale) this.expires = now + ROOM_IDLE_MS;
        return true;
      case 'reroll':
        if (this.phase !== 'draft' || !this.eligible.includes(team) || action.pick !== this.pick || this.selections[team] || now >= this.at
          || action.reroll !== this.rerolls[team] + 1 || action.reroll > GACHA.rerolls) return false;
        this.rerolls[team] = action.reroll;
        return true;
      case 'card': {
        if (this.phase !== 'draft' || !this.eligible.includes(team) || action.pick !== this.pick || this.selections[team] || now >= this.at) return false;
        if (!Number.isInteger(action.reroll) || action.reroll < this.rerolls[team] || action.reroll > GACHA.rerolls) return false;
        if (!this.offers(team, action.reroll).some((card) => card.id === action.id)) return false;
        this.rerolls[team] = action.reroll;
        this.selections[team] = action.id;
        if (this.eligible.every((side) => this.selections[side])) this.finishDraft(now);
        return true;
      }
      case 'report':
        return this.report(team, action, now);
      case 'rematch':
        if (this.phase !== 'result' || this.rematch[team] || !this.hasEnoughSeats()) return false;
        this.rematch[team] = true;
        this.nextMatch(now);
        return true;
      case 'leave':
        if (!this.rules.royale) this.phase = 'closed';
        else if (this.phase === 'waiting' || this.phase === 'result') {
          if (team === 0) this.phase = 'closed';
          else {
            this.seats[team] = null;
            this.locked[team] = null;
            this.rematch[team] = false;
            this.expires = now + ROOM_IDLE_MS;
            if (this.phase === 'result') this.nextMatch(now);
          }
        }
        return true;
      default:
        return false;
    }
  }

  private hasEnoughSeats() {
    return this.seats.filter(Boolean).length >= (this.rules.royale ? 3 : 2);
  }

  private nextMatch(now: number) {
    if (!this.hasEnoughSeats() || !this.seats.every((seat, i) => !seat || this.rematch[i])) return;
    const { seats, mode, match } = this;
    const phase = this.rules.royale ? 'waiting' : 'picks';
    Object.assign(this, new Room(mode, now), { seats, match: match + 1, phase });
  }

  private start(now: number) {
    this.lineups = this.locked.map((lineup) => lineup ?? []);
    this.seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    this.arena = resolveArena('auto', this.lineups.flat(), this.seed);
    this.eligible = this.lineups.flatMap((lineup, i) => lineup.length ? [i as BattleSide] : []);
    this.phase = this.rules.gacha ? 'draft' : 'fight';
    this.at = now + (this.phase === 'draft' ? 25_000 : 2700);
  }

  private offers(team: BattleSide, reroll: number) {
    const lineup = this.lineups![team].map((id) => byId(id)!);
    return offersFor(this.seed, team, this.pick, reroll, lineup, this.log.filter((p) => p.team === team).map((p) => p.id));
  }

  private finishDraft(now: number) {
    const picked = this.eligible.map((team) => ({
      team,
      pick: this.pick,
      id: this.selections[team] ?? cpuPick(this.seed, team, this.pick, this.offers(team, this.rerolls[team])).id,
    }));
    this.log.push(...picked);
    this.selections.fill(null);
    this.reports.fill(null);
    this.verifyAt = null;
    this.phase = 'fight';
    this.at = now + (this.pick === 0 ? 2700 : 650);
  }

  private replay(tick: number) {
    const sim = roomSimulation(this);
    stepRoom(sim, this.log, tick);
    return sim;
  }

  private report(team: BattleSide, report: Report, now: number) {
    if (!this.lineups || (this.phase !== 'fight' && (this.rules.royale || this.phase !== 'draft'))) return false;
    const { tick, hash, winner } = report;
    const checkpoint = this.phase === 'fight' ? this.boundary : this.tick;
    if (!Number.isInteger(tick) || tick < this.tick || tick > checkpoint || typeof hash !== 'string' || hash.length > 32) return false;
    if (winner === undefined && tick !== checkpoint) return false;
    if (winner !== undefined && winner !== -1 && (!Number.isInteger(winner) || !this.lineups[winner]?.length)) return false;
    if (this.phase === 'fight' && tick > targetTick(this, now + 500)) return false;
    if (this.reports[team]) return false;
    this.reports[team] = { tick, hash, winner };
    if (this.rules.royale) {
      if (winner !== undefined) this.verifyAt ??= now + 1500;
      return true;
    }
    const rival = this.reports[other(team as Team)];
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
