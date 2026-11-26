import { DurableObject } from 'cloudflare:workers';
import { PVP_MODES, type PvpMode } from '../src/net/pvpModes';
import { Room, type RoomState } from '../src/net/roomState';
import { ROOM_CODE, ROOM_WIRE_VERSION, type RoomAction, type RoomPacket } from '../src/net/roomWire';
import { ROOM_RULES } from '../src/net/roomVersion';
import type { Team } from '../src/sim/types';

interface Env {
  ROOMS: DurableObjectNamespace<PvpRoom>;
  QUEUE: DurableObjectNamespace<PvpQueue>;
  WEB_ORIGINS: string;
  PVP_LIMIT: RateLimit;
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codeFor = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (n) => alphabet[n & 31]).join('');
const validMode = (mode: string): mode is PvpMode => Object.hasOwn(PVP_MODES, mode);
const tokenFrom = (request: Request) => request.headers.get('sec-websocket-protocol')?.split(',').map((item) => item.trim()).find((item) => item.startsWith('seat.'))?.slice(5);
const send = (ws: WebSocket, packet: RoomPacket) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(packet));
};
const openSocket = (ctx: DurableObjectState, attachment: unknown) => {
  const { 0: client, 1: server } = new WebSocketPair();
  ctx.acceptWebSocket(server);
  server.serializeAttachment(attachment);
  return {
    server,
    response: new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'jobwars' } }),
  };
};

async function createRoom(env: Env, action: 'create' | 'pair', params: URLSearchParams, request?: Request) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = codeFor();
    const response = await env.ROOMS.getByName(code).fetch(`https://room/${action}/${code}?${params}`, request);
    if (response.status !== 409) return response;
  }
  return new Response('Could not reserve a room. Try again.', { status: 503 });
}

interface RoomSocket { team: Team; code: string }

export class PvpRoom extends DurableObject<Env> {
  private room?: Room;
  private scheduled: number | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = ctx.storage.kv.get<RoomState>('room');
      if (saved) this.room = Room.restore(saved);
      this.scheduled = await ctx.storage.getAlarm();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const [, action, code] = url.pathname.split('/');
    const now = Date.now();
    const mmr = Number(url.searchParams.get('mmr'));
    if (action === 'create' || action === 'pair') {
      if (this.room) return new Response(null, { status: 409 });
      const mode = url.searchParams.get('mode') ?? '';
      if (!validMode(mode)) return new Response('Unknown mode.', { status: 400 });
      const room = this.room = new Room(mode, now);
      room.sit(mmr, now);
      if (action === 'pair') {
        room.sit(Number(url.searchParams.get('rival')), now);
        await this.save();
        return Response.json({ code, tokens: room.seats.map((seat) => seat!.token) });
      }
      const socket = openSocket(this.ctx, { team: 0, code } satisfies RoomSocket);
      await this.save();
      this.broadcast(socket.server);
      return socket.response;
    }

    const room = this.room;
    if (!room || room.phase === 'closed') return new Response('Lobby is no longer available.', { status: 404 });
    if (room.elapse(now)) await this.changed();
    if (this.room !== room) return new Response('Lobby is no longer available.', { status: 404 });
    const token = tokenFrom(request);
    let team: number | null;
    if (token) {
      team = room.seats.findIndex((seat) => seat?.token === token);
      if (team < 0) return new Response('Invalid reconnect token.', { status: 403 });
    } else {
      team = room.sit(mmr, now);
      if (team === null) return new Response('This lobby is full.', { status: 409 });
      await this.save();
    }
    const prior = this.ctx.getWebSockets().find((ws) => this.attachment(ws).team === team && ws.readyState === WebSocket.OPEN);
    if (prior) prior.close(4001, 'Replaced by a newer connection');
    const socket = openSocket(this.ctx, { team: team as Team, code } satisfies RoomSocket);
    this.broadcast(socket.server);
    return socket.response;
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 512 || !this.room) return;
    let action: { t?: string; sent?: number };
    try { action = JSON.parse(raw); } catch { return; }
    if (!action || typeof action.t !== 'string') return;
    if (action.t === 'ping' && Number.isFinite(action.sent)) {
      send(ws, { t: 'pong', sent: action.sent!, now: Date.now() });
      return;
    }
    const room = this.room;
    const team = this.attachment(ws).team;
    if (room.elapse(Date.now())) await this.changed();
    if (this.room !== room) return;
    // A delayed packet from a replaced socket cannot act for the current seat.
    if (ws.readyState !== WebSocket.OPEN) return;
    if (room.act(team, action as RoomAction, Date.now())) await this.changed();
  }

  webSocketClose(ws: WebSocket) {
    ws.close();
    this.broadcast();
  }

  async alarm() {
    this.scheduled = null;
    if (this.room?.elapse(Date.now())) await this.changed();
    else if (this.room) await this.schedule();
  }

  private attachment(ws: WebSocket) { return ws.deserializeAttachment() as RoomSocket; }

  private broadcast(fresh?: WebSocket) {
    const room = this.room;
    if (!room) return;
    const sockets = this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
    const present: [boolean, boolean] = [false, false];
    for (const ws of sockets) present[this.attachment(ws).team] = true;
    const now = Date.now();
    for (const ws of sockets) {
      const { team, code } = this.attachment(ws);
      send(ws, { t: 'state', code, token: fresh === ws ? room.seats[team]?.token : undefined, now, room: room.view(team, present) });
    }
  }

  private async changed() {
    if (this.room?.phase === 'closed') {
      this.broadcast();
      this.room = undefined;
      this.scheduled = null;
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'Lobby closed');
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.save();
    this.broadcast();
  }

  private async save() {
    this.ctx.storage.kv.put('room', { ...this.room! });
    await this.schedule();
  }

  private async schedule() {
    const at = this.room!.alarmAt;
    if (at === this.scheduled) return;
    this.scheduled = at;
    await this.ctx.storage.setAlarm(at);
  }
}

interface QueueSocket { mode: PvpMode; tier: number; mmr: number; since: number; pairing?: boolean }

export class PvpQueue extends DurableObject<Env> {
  async fetch(request: Request) {
    const params = new URL(request.url).searchParams;
    const mode = params.get('mode') as PvpMode;
    const { response } = openSocket(this.ctx, {
      mode, tier: Number(params.get('tier')), mmr: Number(params.get('mmr')), since: Date.now(),
    } satisfies QueueSocket);
    await this.ctx.blockConcurrencyWhile(() => this.pair());
    return response;
  }

  async alarm() { await this.ctx.blockConcurrencyWhile(() => this.pair()); }
  webSocketClose(ws: WebSocket) { ws.close(); }

  private async pair() {
    const waiting = this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN)
      .map((ws) => ({ ws, data: ws.deserializeAttachment() as QueueSocket }))
      .filter(({ data }) => !data.pairing).sort((a, b) => a.data.since - b.data.since);
    const now = Date.now();
    while (waiting.length > 1) {
      const host = waiting.shift()!;
      const index = waiting.findIndex(({ data }) => data.tier === host.data.tier ||
        (now - Math.min(host.data.since, data.since) >= 20_000 && Math.abs(host.data.tier - data.tier) <= 2));
      if (index < 0) {
        const widenAt = host.data.since + 20_000;
        const alarm = await this.ctx.storage.getAlarm();
        if (widenAt > now && (!alarm || alarm > widenAt)) await this.ctx.storage.setAlarm(widenAt);
        continue;
      }
      const guest = waiting.splice(index, 1)[0];
      for (const { ws, data } of [host, guest]) ws.serializeAttachment({ ...data, pairing: true });
      try {
        const response = await createRoom(this.env, 'pair', new URLSearchParams({
          mode: host.data.mode, mmr: String(host.data.mmr), rival: String(guest.data.mmr),
        }));
        if (!response.ok) throw new Error('Could not create a match.');
        const { code, tokens } = await response.json<{ code: string; tokens: [string, string] }>();
        [host, guest].forEach(({ ws }, index) => {
          send(ws, { t: 'match', code, token: tokens[index] });
          ws.close();
        });
      } catch {
        for (const { ws } of [host, guest]) {
          send(ws, { t: 'error', message: 'Could not create a match. Try again.' });
          ws.close(1011, 'Match unavailable');
        }
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, rules: ROOM_RULES });
    const origin = request.headers.get('origin') ?? '';
    if (!env.WEB_ORIGINS.split(',').map((item) => item.trim()).includes(origin)) return new Response('Origin is not allowed.', { status: 403 });
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required.', { status: 426 });
    if (url.searchParams.get('v') !== String(ROOM_WIRE_VERSION) || url.searchParams.get('rules') !== ROOM_RULES) {
      return new Response('Game version differs. Refresh and try again.', { status: 409 });
    }
    const [, route, code, extra] = url.pathname.split('/');
    const mode = url.searchParams.get('mode') ?? '';
    const mmr = Number(url.searchParams.get('mmr'));
    if (!Number.isSafeInteger(mmr) || mmr < 0 || mmr > 100_000 || extra) return new Response('Invalid lobby request.', { status: 400 });
    if ((route === 'create' || route === 'quick') && !validMode(mode)) return new Response('Unknown mode.', { status: 400 });
    const { success } = await env.PVP_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') ?? 'local' });
    if (!success) return new Response('Too many lobby attempts.', { status: 429 });
    if (route === 'create' && !code) return createRoom(env, 'create', url.searchParams, request);
    if (route === 'quick' && !code) {
      const tier = Number(url.searchParams.get('tier'));
      if (!Number.isInteger(tier) || tier < 0 || tier > 6) return new Response('Invalid rank tier.', { status: 400 });
      return env.QUEUE.getByName(mode).fetch(request);
    }
    if (route === 'room' && ROOM_CODE.test(code ?? '')) {
      return env.ROOMS.getByName(code).fetch(`https://room/join/${code}?${url.searchParams}`, request);
    }
    return new Response('Not found.', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
