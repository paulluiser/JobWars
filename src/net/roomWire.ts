import type { ArenaId } from '../data/arenas';
import type { Pick } from '../modes/gacha';
import type { Team } from '../sim/types';
import type { PvpMode } from './pvpModes';

export const ROOM_WIRE_VERSION = 1;
export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{5}$/;
export type Phase = 'waiting' | 'picks' | 'draft' | 'fight' | 'result' | 'closed';
export interface Checkpoint {
  tick: number;
  hash: string;
}
export interface Outcome extends Checkpoint {
  winner: Team | -1;
}
export interface RoomView {
  match: number;
  mode: PvpMode;
  team: Team;
  phase: Phase;
  at: number;
  tick: number;
  boundary: number;
  pick: number;
  seed: number;
  arena: ArenaId;
  mine: string[];
  lineups: [string[], string[]] | null;
  ready: [boolean, boolean];
  present: [boolean, boolean];
  rematch: [boolean, boolean];
  rivalMmr: number;
  log: Pick[];
  rerolls: number;
  chosen: boolean;
  reported: number | null;
  result: Outcome | null;
  repair: Checkpoint | null;
}
export type RoomAction =
  | { t: 'lock'; match: number; ids: string[] }
  | { t: 'reroll'; match: number; pick: number; reroll: number }
  | { t: 'card'; match: number; pick: number; reroll: number; id: string }
  | { t: 'report'; match: number; tick: number; hash: string; winner?: Team | -1 }
  | { t: 'rematch'; match: number }
  | { t: 'leave'; match: number };

export type RoomPacket =
  | { t: 'state'; code: string; token?: string; now: number; room: RoomView }
  | { t: 'pong'; sent: number; now: number }
  | { t: 'match'; code: string; token: string }
  | { t: 'error'; message: string };
