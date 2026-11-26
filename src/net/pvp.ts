import Peer, { type DataConnection } from 'peerjs';
import { ROSTER } from '../data/roster';
import { ALL_CARDS } from '../data/cards';

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
export type PvpMode = 'classic1' | 'gacha1' | 'classic2' | 'gacha2';
export const PVP_MODES: Record<PvpMode, { name: string; tag: boolean; gacha: boolean; blurb: string }> = {
  classic1: { name: 'PvP Classic', tag: false, gacha: false, blurb: '1v1. Pick a job, the fight plays out.' },
  gacha1: { name: 'PvP Gacha', tag: false, gacha: true, blurb: '1v1. Draft a card every 20 s. 2–3 minute matches.' },
  classic2: { name: 'Tag Team Classic', tag: true, gacha: false, blurb: '2v2. Pick two jobs, all four on the field.' },
  gacha2: { name: 'Gacha Tag Team', tag: true, gacha: true, blurb: '2v2 with a card draft every 20 s.' },
};

/** Both sides must run the same rules: roster and card list must match. */
const sig = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
export const PROTOCOL = `jw2-${sig(ROSTER.map((d) => `${d.id}${d.hp}${d.atk}`).join() + ALL_CARDS.map((c) => c.id).join())}`;

export type Msg =
  | { t: 'hello'; v: string; mmr: number; mode: PvpMode }
  | { t: 'picks'; ids: string[] }
  | { t: 'start'; seed: number }
  | { t: 'card'; team: number; pick: number; id: string }
  | { t: 'result'; winner: number; hash: string }
  | { t: 'rematch' }
  | { t: 'bye' };

const PREFIX = 'jobwars-2f7c';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QM_SLOTS = 5;

export class PvpSession {
  oppMmr = 1000;
  private handlers = new Set<(m: Msg) => void>();
  private inbox: Msg[] = [];
  closed = false;
  onClose: (() => void) | null = null;

  private constructor(private peers: Peer[], readonly conn: DataConnection, readonly host: boolean, readonly mode: PvpMode) {
    conn.on('data', (d) => {
      const m = d as Msg;
      this.inbox.push(m);
      for (const h of [...this.handlers]) h(m);
    });
    conn.on('close', () => this.lost());
    conn.on('error', () => this.lost());
  }

  private lost() {
    if (this.closed) return;
    this.closed = true;
    this.onClose?.();
  }

  send(m: Msg) {
    if (!this.closed) this.conn.send(m);
  }

  /** Wait for the next message matching `ok` (including ones that already arrived). */
  wait<T extends Msg>(ok: (m: Msg) => m is T, timeoutMs = 0): Promise<T> {
    const i = this.inbox.findIndex(ok);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0] as T);
    return new Promise((res, rej) => {
      let timer = 0;
      const h = (m: Msg) => {
        if (!ok(m)) return;
        this.inbox.splice(this.inbox.indexOf(m), 1);
        this.handlers.delete(h);
        clearTimeout(timer);
        res(m);
      };
      this.handlers.add(h);
      if (timeoutMs) timer = window.setTimeout(() => (this.handlers.delete(h), rej(new Error('timeout'))), timeoutMs);
    });
  }

  close() {
    this.send({ t: 'bye' });
    this.closed = true;
    setTimeout(() => {
      try { this.conn.close(); } catch {}
      for (const p of this.peers) try { p.destroy(); } catch {}
    }, 200);
  }

  /** after connecting: swap versions and ratings */
  private async handshake(mmr: number) {
    this.send({ t: 'hello', v: PROTOCOL, mmr, mode: this.mode });
    const h = await this.wait((m): m is Extract<Msg, { t: 'hello' }> => m.t === 'hello', 8000);
    if (h.v !== PROTOCOL) throw new Error('The other player is on a different version of the game. Both refresh the page and try again.');
    if (h.mode !== this.mode) throw new Error('The other player picked a different mode.');
    this.oppMmr = h.mmr;
    return this;
  }

  // ---------------- connecting ----------------

  static newCode() {
    return Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  }

  /** Host a lobby: resolves with the code at once; `ready` resolves when someone joins. */
  static async createLobby(mode: PvpMode, mmr: number, signal: AbortSignal): Promise<{ code: string; ready: Promise<PvpSession> }> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = PvpSession.newCode();
      const peer = await openPeer(`${PREFIX}-lobby-${code}`).catch(() => null);
      if (!peer) continue;
      const ready = waitIncoming(peer, signal)
        .then((conn) => new PvpSession([peer], conn, true, mode).handshake(mmr))
        .catch((error: unknown) => {
          peer.destroy();
          throw error;
        });
      return { code, ready };
    }
    throw new Error("Couldn't reach the matchmaking service. Check your connection and try again.");
  }

  static async joinLobby(code: string, mode: PvpMode, mmr: number): Promise<PvpSession> {
    const normalized = code.trim().toUpperCase();
    const me = await openPeer().catch(() => {
      throw new Error("Couldn't reach matchmaking. Check your connection and try again.");
    });
    try {
      const conn = await dial(me, `${PREFIX}-lobby-${normalized}`, 12000).catch((error: unknown) => {
        if ((error as { type?: string })?.type === 'peer-unavailable') {
          throw new Error(`Couldn't reach lobby ${normalized}. Ask your friend to keep the lobby open or create a fresh code.`);
        }
        if (error instanceof Error && error.message === 'timeout') {
          throw new Error(`Connection timed out joining ${normalized}. Try a fresh lobby. If both players are on different networks, try the same Wi-Fi or another connection.`);
        }
        throw new Error(`Connection to lobby ${normalized} was interrupted. Try joining again.`);
      });
      return await new PvpSession([me], conn, false, mode).handshake(mmr);
    } catch (error) {
      me.destroy();
      throw error;
    }
  }

  /**
   * Quick match: look for someone waiting in your rank tier, else wait in a free slot.
   * `status` reports progress; after ~20 s it widens to every tier.
   */
  static async quickMatch(mode: PvpMode, mmr: number, tier: number, signal: AbortSignal, status: (s: string) => void): Promise<PvpSession> {
    const me = await openPeer();
    const started = Date.now();
    try {
      for (let loop = 0; !signal.aborted; loop++) {
        const wide = Date.now() - started > 20000;
        const tiers = wide ? [tier, tier - 1, tier + 1, tier - 2, tier + 2].filter((t) => t >= 0 && t <= 6) : [tier];
        status(wide ? 'Searching all ranks…' : 'Searching your rank…');
        // 1. someone already waiting?
        for (const t of tiers) for (let s = 0; s < QM_SLOTS && !signal.aborted; s++) {
          const conn = await dial(me, `${PREFIX}-qm-${mode}-t${t}-s${s}`, 1800).catch(() => null);
          if (conn) {
            try {
              return await new PvpSession([me], conn, false, mode).handshake(mmr);
            } catch {
              try { conn.close(); } catch {}
            }
          }
        }
        // 2. nobody: wait in a free slot for a while, then look again
        for (let s = 0; s < QM_SLOTS && !signal.aborted; s++) {
          const host = await openPeer(`${PREFIX}-qm-${mode}-t${tier}-s${s}`).catch(() => null);
          if (!host) continue;
          status('Waiting for an opponent…');
          const conn = await waitIncoming(host, signal, 12000 + Math.random() * 6000).catch(() => null);
          if (conn) {
            try {
              return await new PvpSession([me, host], conn, true, mode).handshake(mmr);
            } catch {
              try { conn.close(); } catch {}
            }
          }
          host.destroy();
          break;
        }
      }
      throw new Error('cancelled');
    } catch (e) {
      me.destroy();
      throw e;
    }
  }
}

// ---------------- PeerJS helpers ----------------

function openPeer(id?: string): Promise<Peer> {
  return new Promise((res, rej) => {
    const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const clean = () => {
      clearTimeout(t);
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
    const t = setTimeout(() => fail(new Error('timeout')), 9000);
    p.on('open', opened);
    p.on('error', fail);
  });
}

/** Open the data channel, keeping signaling and channel failures distinct. */
function dial(me: Peer, id: string, timeoutMs: number): Promise<DataConnection> {
  return new Promise((res, rej) => {
    const conn = me.connect(id, { reliable: true });
    if (!conn) return rej(new Error('disconnected'));
    const clean = () => {
      clearTimeout(t);
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
    const t = setTimeout(() => fail(new Error('timeout')), timeoutMs);
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
    const incoming = (conn: DataConnection) => conn.once('open', () => {
      done();
      res(conn);
    });
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort);
    peer.on('disconnected', disconnected);
    peer.on('connection', incoming);
    if (timeoutMs) t = setTimeout(() => {
      done();
      rej(new Error('timeout'));
    }, timeoutMs);
  });
}
