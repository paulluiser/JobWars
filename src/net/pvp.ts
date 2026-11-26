import Peer, { type DataConnection } from 'peerjs';
import { byId } from '../data/roster';
import { CARD_BY_ID, GACHA } from '../data/cards';
import { pvpIceConfig } from './ice';
import { PVP_MODES, type PvpMode } from './pvpModes';
import { ROOM_RULES } from './roomVersion';
import { normalizeDisplayName } from './roomWire';
export { PVP_MODES, type PvpMode } from './pvpModes';

/**
 * Online PvP over WebRTC (PeerJS, using its free public broker for the handshake only).
 * A fight is fully determined by its seed, the fighters and the card picks, so peers only send
 * those few messages; each machine simulates the fight itself (the sim's maths is
 * engine-independent, see sim/dmath.ts). A result hash at the end catches any desync.
 *
 *  - Lobby: the host gets a 5-letter code; the guest types it in.
 *  - Quick match: a handful of shared "waiting room" ids per mode and rank tier. Join one that
 *    has someone waiting, or claim a free one and wait. Widens to all tiers after a while.
 */
export const PROTOCOL = `jw3-${ROOM_RULES}`;

export type Msg =
  | { t: 'hello'; v: string; mmr: number; mode: PvpMode; displayName?: string }
  | { t: 'picks'; ids: string[] }
  | { t: 'unlock' }
  | { t: 'start'; seed: number; lineups: [string[], string[]] }
  | { t: 'card'; team: number; pick: number; reroll: number; id: string }
  | { t: 'result'; winner: number; hash: string }
  | { t: 'rematch' }
  | { t: 'bye' };

function validMessage(value: unknown, mode: PvpMode): value is Msg {
  if (!value || typeof value !== 'object' || !('t' in value)) return false;
  const m = value as Msg;
  const validLineup = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length === (PVP_MODES[mode].tag ? 2 : 1)
    && new Set(ids).size === ids.length && ids.every((id) => typeof id === 'string' && !!byId(id));
  switch (m.t) {
    case 'hello':
      return typeof m.v === 'string' && Number.isSafeInteger(m.mmr)
        && typeof m.mode === 'string' && Object.hasOwn(PVP_MODES, m.mode);
    case 'picks':
      return validLineup(m.ids);
    case 'start':
      return Number.isSafeInteger(m.seed) && Array.isArray(m.lineups) && m.lineups.length === 2 && m.lineups.every(validLineup);
    case 'card':
      return PVP_MODES[mode].gacha && (m.team === 0 || m.team === 1) && Number.isSafeInteger(m.pick) && m.pick >= 0
        && Number.isSafeInteger(m.reroll) && m.reroll >= 0 && m.reroll <= GACHA.rerolls && CARD_BY_ID.has(m.id);
    case 'result':
      return (m.winner === -1 || m.winner === 0 || m.winner === 1)
        && typeof m.hash === 'string' && m.hash.length <= 128;
    case 'unlock':
    case 'bye':
    case 'rematch':
      return true;
    default:
      return false;
  }
}

const PREFIX = 'jobwars-2f7c';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QM_SLOTS = 5;
const CONNECT_TIMEOUT = 12000;
const cancelled = () => new Error('cancelled');
const matchmakingUnavailable = () => new Error("Couldn't reach the matchmaking service. Check your connection and try again.");
const peerErrorType = (error: unknown) => (error as { type?: string } | null)?.type;

export class PvpSession {
  oppMmr = 1000;
  playerName = '';
  oppName = '';
  private handlers = new Set<(m: Msg) => void>();
  private inbox: Msg[] = [];
  private established = false;
  closed = false;
  onClose: (() => void) | null = null;

  private constructor(private peers: Peer[], readonly conn: DataConnection, readonly host: boolean, private matchMode: PvpMode) {
    conn.on('data', (m) => {
      if (this.closed || !validMessage(m, this.mode)) return;
      if (m.t === 'bye') return this.lost();
      if (m.t === 'rematch') {
        // The ordered channel has already delivered the previous round's pick messages.
        this.inbox = this.inbox.filter((pending) => pending.t !== 'picks' && pending.t !== 'unlock' && pending.t !== 'start');
      }
      if (this.inbox.length === 64) this.inbox.shift();
      this.inbox.push(m);
      for (const h of [...this.handlers]) h(m);
    });
    conn.on('close', () => this.lost());
    conn.on('error', () => this.lost());
  }

  get mode() { return this.matchMode; }
  get playerNames(): [string, string] { return this.host ? [this.playerName, this.oppName] : [this.oppName, this.playerName]; }

  private lost() {
    if (this.closed) return;
    this.closed = true;
    if (this.established) this.release();
    this.onClose?.();
  }

  send(m: Msg) {
    if (!this.closed) this.conn.send(m);
  }

  /** Wait for the next message matching `ok` (including ones that already arrived). */
  wait<T extends Msg>(ok: (m: Msg) => m is T, timeoutMs = 0, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(cancelled());
    const i = this.inbox.findIndex(ok);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0] as T);
    return new Promise((res, rej) => {
      let timer = 0;
      const clean = () => {
        this.handlers.delete(h);
        signal?.removeEventListener('abort', abort);
        clearTimeout(timer);
      };
      const abort = () => {
        clean();
        rej(cancelled());
      };
      const h = (m: Msg) => {
        if (!ok(m)) return;
        this.inbox.splice(this.inbox.indexOf(m), 1);
        clean();
        res(m);
      };
      this.handlers.add(h);
      signal?.addEventListener('abort', abort);
      if (timeoutMs) timer = window.setTimeout(() => {
        clean();
        rej(new Error('timeout'));
      }, timeoutMs);
    });
  }

  close() {
    if (this.closed) return;
    this.send({ t: 'bye' });
    this.closed = true;
    setTimeout(() => this.release(), 200);
  }

  private release() {
    this.conn.close();
    for (const peer of this.peers) peer.destroy();
  }

  /** after connecting: swap versions and ratings */
  private async handshake(mmr: number, signal: AbortSignal, displayName?: string, invite = false) {
    const followHost = invite && !this.host;
    this.playerName = normalizeDisplayName(displayName) ?? (this.host ? 'Player 1' : 'Player 2');
    const hello = () => this.send({ t: 'hello', v: PROTOCOL, mmr, mode: this.mode, displayName: this.playerName });
    if (!followHost) hello();
    const h = await this.wait((m): m is Extract<Msg, { t: 'hello' }> => m.t === 'hello', 8000, signal);
    if (h.v !== PROTOCOL) throw new Error('The other player is on a different version of the game. Both refresh the page and try again.');
    if (!invite && h.mode !== this.mode) throw new Error('The other player picked a different mode.');
    if (followHost) {
      this.matchMode = h.mode;
      hello();
    }
    this.oppMmr = h.mmr;
    this.oppName = normalizeDisplayName(h.displayName) ?? (this.host ? 'Player 2' : 'Player 1');
    if (this.closed) throw new Error("The other player disconnected.");
    this.established = true;
    return this;
  }

  // ---------------- connecting ----------------

  static newCode() {
    return Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  }

  /** Host a lobby: resolves with the code at once; `ready` resolves when someone joins. */
  static async createLobby(mode: PvpMode, mmr: number, signal: AbortSignal, displayName?: string): Promise<{ code: string; ready: Promise<PvpSession> }> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = PvpSession.newCode();
      const peer = await claimPeer(`${PREFIX}-lobby-${code}`, signal);
      if (!peer) continue;
      const ready = waitIncoming(peer, signal)
        .then((conn) => new PvpSession([peer], conn, true, mode).handshake(mmr, signal, displayName, true))
        .catch((error: unknown) => {
          peer.destroy();
          throw error;
        });
      return { code, ready };
    }
    throw new Error("Couldn't reserve a lobby code. Try creating a lobby again.");
  }

  static async joinLobby(code: string, mode: PvpMode, mmr: number, signal = new AbortController().signal, displayName?: string): Promise<PvpSession> {
    const normalized = code.trim().toUpperCase();
    const me = await openPeer(guestId(), signal).catch(() => {
      throw signal.aborted ? cancelled() : matchmakingUnavailable();
    });
    try {
      const conn = await dial(me, `${PREFIX}-lobby-${normalized}`, signal).catch((error: unknown) => {
        if (signal.aborted) throw cancelled();
        if (peerErrorType(error) === 'peer-unavailable') {
          throw new Error(`Couldn't reach lobby ${normalized}. Ask your friend to keep the lobby open or create a fresh code.`);
        }
        if (error instanceof Error && error.message === 'timeout') {
          throw new Error(`Connection timed out joining ${normalized}. The game connection did not open. Try again.`);
        }
        throw new Error(`Connection to lobby ${normalized} was interrupted. Try joining again.`);
      });
      return await new PvpSession([me], conn, false, mode).handshake(mmr, signal, displayName, true);
    } catch (error) {
      me.destroy();
      throw error;
    }
  }

  /**
   * Quick match: look for someone waiting in your rank tier, else wait in a free slot.
   * `status` reports progress; after ~20 s it widens to nearby tiers.
   */
  static async quickMatch(mode: PvpMode, mmr: number, tier: number, signal: AbortSignal, status: (s: string) => void, displayName?: string): Promise<PvpSession> {
    const started = Date.now();
    const nearby = [tier - 1, tier + 1, tier - 2, tier + 2].filter((t) => t >= 0 && t <= 6);
    let nextNearby = 0;
    let guest: Peer | undefined;
    let matched = false;
    const trySlot = async (id: string) => {
      guest ??= await openPeer(guestId(), signal).catch(() => {
        throw signal.aborted ? cancelled() : matchmakingUnavailable();
      });
      const conn = await dial(guest, id, signal).catch(() => null);
      if (!conn) return null;
      try {
        const session = await new PvpSession([guest], conn, false, mode).handshake(mmr, signal, displayName);
        matched = true;
        return session;
      } catch {
        conn.close();
        return null;
      }
    };
    try {
      while (!signal.aborted) {
        const wide = Date.now() - started > 20000;
        status(wide ? 'Searching nearby ranks…' : 'Searching your rank…');
        if (wide && nearby.length) {
          // Rotate the nearby rank so each pass sends at most one extra lookup.
          const tierToCheck = nearby[nextNearby++ % nearby.length];
          const session = await trySlot(`${PREFIX}-qm-${mode}-t${tierToCheck}-s0`);
          if (session) return session;
        }
        for (let slot = 0; slot < QM_SLOTS && !signal.aborted; slot++) {
          const id = `${PREFIX}-qm-${mode}-t${tier}-s${slot}`;
          const host = await claimPeer(id, signal);
          if (!host) {
            const session = await trySlot(id);
            if (session) return session;
            continue;
          }
          status('Waiting for an opponent…');
          try {
            const conn = await waitIncoming(host, signal, 20000);
            return await new PvpSession([host], conn, true, mode).handshake(mmr, signal, displayName);
          } catch (error) {
            host.destroy();
            if (signal.aborted || (error instanceof Error && error.message.includes('disconnected'))) throw error;
          }
          break;
        }
        if (!signal.aborted) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      throw cancelled();
    } finally {
      if (!matched) guest?.destroy();
    }
  }
}

// ---------------- PeerJS helpers ----------------

const guestId = () => `${PREFIX}-guest-${crypto.randomUUID()}`;

async function claimPeer(id: string, signal: AbortSignal): Promise<Peer | null> {
  try {
    return await openPeer(id, signal);
  } catch (error) {
    if (signal.aborted) throw cancelled();
    if (peerErrorType(error) === 'unavailable-id') return null;
    throw matchmakingUnavailable();
  }
}

async function openPeer(id: string, signal: AbortSignal): Promise<Peer> {
  if (signal.aborted) throw cancelled();
  const config = await pvpIceConfig();
  if (signal.aborted) throw cancelled();
  return new Promise((res, rej) => {
    const p = new Peer(id, { debug: 0, config });
    const clean = () => {
      clearTimeout(t);
      signal.removeEventListener('abort', abort);
      p.off('open', opened);
      p.off('error', fail);
    };
    const opened = () => {
      clean();
      res(p);
    };
    const fail = (error: unknown) => {
      clean();
      p.destroy();
      rej(error);
    };
    const abort = () => fail(cancelled());
    const t = setTimeout(() => fail(new Error('timeout')), 9000);
    signal.addEventListener('abort', abort);
    p.on('open', opened);
    p.on('error', fail);
  });
}

/** Open the data channel, keeping signaling and channel failures distinct. */
function dial(me: Peer, id: string, signal: AbortSignal): Promise<DataConnection> {
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((res, rej) => {
    const conn = me.connect(id, { reliable: true });
    if (!conn) return rej(new Error('disconnected'));
    const clean = () => {
      clearTimeout(t);
      signal.removeEventListener('abort', abort);
      me.off('error', onErr);
      me.off('disconnected', disconnected);
      conn.off('open', opened);
      conn.off('close', disconnected);
      conn.off('error', fail);
    };
    const fail = (error: unknown) => {
      clean();
      try { conn.close(); } catch {}
      rej(error);
    };
    const disconnected = () => fail(new Error('disconnected'));
    const onErr = (error: { type?: string }) => {
      if (error?.type === 'peer-unavailable' || error?.type === 'network') fail(error);
    };
    const opened = () => {
      clean();
      res(conn);
    };
    const abort = () => fail(cancelled());
    const t = setTimeout(() => fail(new Error('timeout')), CONNECT_TIMEOUT);
    signal.addEventListener('abort', abort);
    me.on('error', onErr);
    me.on('disconnected', disconnected);
    conn.on('close', disconnected);
    conn.on('error', fail);
    conn.on('open', opened);
  });
}

function waitIncoming(peer: Peer, signal: AbortSignal, timeoutMs = 0): Promise<DataConnection> {
  return new Promise((res, rej) => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(t);
      signal.removeEventListener('abort', abort);
      peer.off('disconnected', disconnected);
      peer.off('connection', incoming);
    };
    const abort = () => {
      done();
      rej(new Error('cancelled'));
    };
    const disconnected = () => {
      done();
      rej(new Error('Your lobby disconnected from matchmaking. Create a new lobby and share the new code.'));
    };
    let connectionReceived = false;
    const expire = () => {
      done();
      rej(new Error('timeout'));
    };
    const incoming = (conn: DataConnection) => {
      if (timeoutMs && !connectionReceived) {
        connectionReceived = true;
        clearTimeout(t);
        t = setTimeout(expire, CONNECT_TIMEOUT);
      }
      conn.once('open', () => {
        done();
        res(conn);
      });
    };
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort);
    peer.on('disconnected', disconnected);
    peer.on('connection', incoming);
    if (timeoutMs) t = setTimeout(expire, timeoutMs);
  });
}
