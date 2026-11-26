import type { ArenaId } from '../data/arenas';
import type { Pick } from '../modes/gacha';
import type { BattleSide } from '../sim/types';
import type { PvpMode } from './pvpModes';

export const ROOM_WIRE_VERSION = 1;
export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{5}$/;
export const MAX_DISPLAY_NAME_LENGTH = 24;

export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u.test(value)) return null;
  const name = value.normalize('NFC').trim().replace(/\p{Zs}+/gu, ' ');
  return name && Array.from(name).length <= MAX_DISPLAY_NAME_LENGTH ? name : null;
}

export type Phase = 'waiting' | 'picks' | 'draft' | 'fight' | 'result' | 'closed';
export interface Checkpoint {
  tick: number;
  hash: string;
}
export interface Outcome extends Checkpoint {
  winner: BattleSide | -1;
}
export interface RoomView {
  match: number;
  mode: PvpMode;
  team: BattleSide;
  phase: Phase;
  at: number;
  tick: number;
  boundary: number;
  pick: number;
  seed: number;
  arena: ArenaId;
  mine: string[];
  lineups: string[][] | null;
  ready: boolean[];
  playerNames: string[];
  present: boolean[];
  rematch: boolean[];
  occupied?: boolean[];
  eligible?: BattleSide[];
  rivalMmr: number;
  log: Pick[];
  rerolls: number;
  chosen: boolean;
  reported: number | null;
  result: Outcome | null;
  repair: Checkpoint | null;
}
export type RoomAction =
  | { t: 'start'; match: number }
  | { t: 'lock'; match: number; ids: string[] }
  | { t: 'unlock'; match: number }
  | { t: 'reroll'; match: number; pick: number; reroll: number }
  | { t: 'card'; match: number; pick: number; reroll: number; id: string }
  | { t: 'report'; match: number; tick: number; hash: string; winner?: BattleSide | -1 }
  | { t: 'rematch'; match: number }
  | { t: 'leave'; match: number };

export type RoomPacket =
  | { t: 'state'; code: string; token?: string; now: number; room: RoomView }
  | { t: 'pong'; sent: number; now: number }
  | { t: 'match'; code: string; token: string }
  | { t: 'error'; message: string };
