import { ROOM_RULES } from './roomVersion';
import { ROOM_WIRE_VERSION, type RoomAction, type RoomPacket, type RoomView } from './roomWire';
import type { PvpMode } from './pvpModes';

export const roomService = import.meta.env.VITE_PVP_ROOM_URL?.trim();
const STORAGE_KEY = 'jobwars-pvp-room';
const cancelled = () => new Error('cancelled');
type Destination = { mode: PvpMode; mmr: number; code?: string; token?: string; tier?: number };
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function savedRoom(): Destination | null {
  try {
    const item = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Destination | null;
    return item?.code && item.token ? item : null;
  } catch { return null; }
}

function storeSeat(destination: Destination) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(destination)); } catch {}
}

export function clearSavedRoom() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}

function endpoint(path: string, destination: Destination) {
  const url = new URL(path, roomService);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.search = new URLSearchParams({
    mode: destination.mode, mmr: String(destination.mmr), v: String(ROOM_WIRE_VERSION), rules: ROOM_RULES,
    ...(destination.tier === undefined ? {} : { tier: String(destination.tier) }),
  }).toString();
  return url;
}

function connect(
  path: string, destination: Destination, signal: AbortSignal, onOpen?: () => void,
): Promise<{ ws: WebSocket; initial: Extract<RoomPacket, { t: 'state' | 'match' }> }> {
  if (signal.aborted) return Promise.reject(cancelled());
  const ws = new WebSocket(endpoint(path, destination), destination.token ? ['jobwars', 'seat.' + destination.token] : 'jobwars');
  return new Promise((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      ws.removeEventListener('open', opened);
      ws.removeEventListener('close', closed);
      ws.removeEventListener('error', closed);
      ws.removeEventListener('message', message);
      signal.removeEventListener('abort', abort);
    };
    const fail = (error: Error) => {
      clean();
      ws.close();
      reject(error);
    };
    const abort = () => fail(cancelled());
    const message = (event: MessageEvent<string>) => {
      const packet = JSON.parse(event.data) as RoomPacket;
      if (packet.t === 'error') return fail(new Error(packet.message));
      if (packet.t !== 'state' && packet.t !== 'match') return;
      clean();
      resolve({ ws, initial: packet });
    };
    const closed = () => fail(new Error(path === '/quick' ? 'Matchmaking disconnected.' :
      'Could not enter the lobby. Check the code and mode, and refresh both browsers.'));
    const opened = () => onOpen?.();
    // Queue waits for a rival, not HTTP or WebSocket setup.
    const timer = setTimeout(() => fail(new Error('Connection timed out. Try again.')), path === '/quick' ? 180_000 : 12_000);
    ws.addEventListener('open', opened);
    ws.addEventListener('close', closed);
    ws.addEventListener('error', closed);
    ws.addEventListener('message', message);
    signal.addEventListener('abort', abort);
  });
}

export class RoomClient {
  view: RoomView;
  code: string;
  onState: (room: RoomView) => void = () => {};
  onStatus: (message: string) => void = () => {};
  private offset: number;
  private ws: WebSocket;
  private ended = false;
  private reconnecting = false;
  private pending = new Map<string, RoomAction>();
  private life = new AbortController();
  private visibility = () => {
    if (!document.hidden) this.ping();
  };

  private constructor(private destination: Destination, ws: WebSocket, initial: Extract<RoomPacket, { t: 'state' }>) {
    this.view = initial.room;
    this.code = initial.code;
    this.offset = initial.now - performance.now();
    this.ws = ws;
    this.accept(initial);
    this.bind(ws);
    document.addEventListener('visibilitychange', this.visibility);
  }

  static async open(destination: Destination, signal: AbortSignal, status: (message: string) => void): Promise<RoomClient> {
    let target = destination;
    if (destination.tier !== undefined) {
      const { initial, ws } = await connect('/quick', destination, signal, () => status('Waiting for an opponent…'));
      ws.close();
      if (initial.t !== 'match') throw new Error('Invalid matchmaking response.');
      target = { mode: destination.mode, mmr: destination.mmr, code: initial.code, token: initial.token };
      storeSeat(target);
      status('Match found. Connecting…');
    }
    const { ws, initial } = await connect(target.code ? '/room/' + target.code : '/create', target, signal);
    if (initial.t === 'state') return new RoomClient(target, ws, initial);
    ws.close();
    throw new Error('Invalid room response.');
  }

  clock() { return performance.now() + this.offset; }

  private ping() {
    this.sendRaw({ t: 'ping', sent: performance.now() });
  }

  private bind(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (event) => {
      if (this.ws !== ws || this.ended) return;
      const packet = JSON.parse(event.data) as RoomPacket;
      if (packet.t === 'pong') {
        this.offset = packet.now - (packet.sent + performance.now()) / 2;
      } else if (packet.t === 'state') {
        this.accept(packet);
        this.onState(this.view);
      } else if (packet.t === 'error') this.onStatus(packet.message);
    };
    ws.onclose = (event) => {
      if (this.ws !== ws || this.ended || this.view.phase === 'closed') return;
      if (event.code === 4001) {
        clearSavedRoom();
        this.close(false);
        this.onStatus('This lobby was opened in another connection.');
        return;
      }
      void this.reconnect();
    };
    this.ping();
  }

  private accept(packet: Extract<RoomPacket, { t: 'state' }>) {
    const room = this.view = packet.room;
    this.destination = { mode: room.mode, mmr: this.destination.mmr, code: packet.code, token: packet.token ?? this.destination.token };
    if (room.phase === 'closed') clearSavedRoom();
    else storeSeat(this.destination);
    for (const [key, action] of this.pending) {
      if (action.match !== room.match || room.phase === 'closed' ||
        (action.t === 'lock' && (room.ready[room.team] || room.phase !== 'picks')) ||
        (action.t === 'card' && (room.chosen || room.pick !== action.pick || room.phase !== 'draft')) ||
        (action.t === 'reroll' && (room.rerolls >= action.reroll || room.pick !== action.pick || room.phase !== 'draft')) ||
        (action.t === 'report' && (room.phase === 'result' || room.reported === action.tick || action.tick < room.tick)) ||
        (action.t === 'rematch' && room.rematch[room.team])) this.pending.delete(key);
    }
  }

  send(action: RoomAction) {
    if (this.ended) return;
    this.pending.set(action.t, action);
    this.sendRaw(action);
  }

  private sendRaw(packet: object) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(packet));
  }

  private async reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.onStatus('Connection lost. Reconnecting…');
    for (const delay of [400, 1000, 2500, 5000]) {
      await sleep(delay);
      if (this.ended) return;
      try {
        const { ws, initial } = await connect('/room/' + this.code, this.destination, this.life.signal);
        if (initial.t !== 'state' || this.ended) { ws.close(); return; }
        this.offset = initial.now - performance.now();
        this.accept(initial);
        this.bind(ws);
        this.reconnecting = false;
        this.onStatus('');
        this.onState(this.view);
        for (const action of this.pending.values()) this.sendRaw(action);
        return;
      } catch { /* retry using the same seat */ }
    }
    this.reconnecting = false;
    if (!this.ended) this.onStatus('Could not reconnect. Open Player vs Player to resume this lobby.');
  }

  close(leave = true) {
    if (this.ended) return;
    if (leave) {
      this.sendRaw({ t: 'leave', match: this.view.match });
      clearSavedRoom();
    }
    this.ended = true;
    this.life.abort();
    this.ws.close();
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
