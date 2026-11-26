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
      const ready = waitIncoming(peer, signal).then((conn) => new PvpSession([peer], conn, true, mode).handshake(mmr));
      return { code, ready };
    }
    throw new Error("Couldn't reach the matchmaking service. Check your connection and try again.");
  }

  static async joinLobby(code: string, mode: PvpMode, mmr: number): Promise<PvpSession> {
    const me = await openPeer();
    const conn = await dial(me, `${PREFIX}-lobby-${code.trim().toUpperCase()}`, 8000).catch(() => null);
    if (!conn) {
      me.destroy();
      throw new Error(`No lobby with code ${code.toUpperCase()}. Check the code (it's case-insensitive) and that your friend is still waiting.`);
    }
    return new PvpSession([me], conn, false, mode).handshake(mmr);
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
    const t = setTimeout(() => (p.destroy(), rej(new Error('timeout'))), 9000);
    p.on('open', () => (clearTimeout(t), res(p)));
    p.on('error', (e) => (clearTimeout(t), p.destroy(), rej(e)));
  });
}

/** connect to a peer id; rejects if nobody's there */
function dial(me: Peer, id: string, timeoutMs: number): Promise<DataConnection> {
  return new Promise((res, rej) => {
    const conn = me.connect(id, { reliable: true });
    const fail = (e?: unknown) => {
      clearTimeout(t);
      me.off('error', onErr);
      try { conn.close(); } catch {}
      rej(e ?? new Error('unavailable'));
    };
    const onErr = (e: { type?: string }) => e?.type === 'peer-unavailable' && fail(e);
    const t = setTimeout(() => fail(), timeoutMs);
    me.on('error', onErr);
    conn.on('open', () => {
      clearTimeout(t);
      me.off('error', onErr);
      res(conn);
    });
  });
}

function waitIncoming(peer: Peer, signal: AbortSignal, timeoutMs = 0): Promise<DataConnection> {
  return new Promise((res, rej) => {
    let t = 0;
    const done = () => {
      clearTimeout(t);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => (done(), peer.destroy(), rej(new Error('cancelled')));
    signal.addEventListener('abort', abort);
    if (timeoutMs) t = window.setTimeout(() => (done(), rej(new Error('timeout'))), timeoutMs);
    peer.on('connection', (conn) => conn.on('open', () => (done(), res(conn))));
  });
}
