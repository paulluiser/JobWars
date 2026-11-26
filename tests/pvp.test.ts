import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { peers } = vi.hoisted(() => ({ peers: [] as any[] }));
vi.mock('peerjs', () => ({
  default: class extends EventEmitter {
    id: string;
    destroyed = false;
    connection = Object.assign(new EventEmitter(), { close: vi.fn(), send: vi.fn() });
    connect = vi.fn(() => this.connection);
    destroy = vi.fn(() => { this.destroyed = true; });
    constructor(id = 'guest') {
      super();
      this.id = id;
      this.on('error', () => {}); // PeerJS uses an emitter that allows unhandled error events.
      peers.push(this);
      queueMicrotask(() => this.emit('open', id));
    }
  },
}));

import { PvpSession, PROTOCOL } from '../src/net/pvp';

describe('PvP lobby connection errors', () => {
  beforeEach(() => {
    peers.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('distinguishes an unavailable code from a WebRTC timeout', async () => {
    const join = PvpSession.joinLobby(' kc77n ', 'classic1', 1000);
    const rejected = expect(join).rejects.toThrow(/connection timed out/i);
    await vi.advanceTimersByTimeAsync(12000);
    await rejected;
    expect(peers[0].destroy).toHaveBeenCalledTimes(1);
  });

  it('tells the guest when signaling cannot reach the lobby code', async () => {
    const join = PvpSession.joinLobby(' kc77n ', 'classic1', 1000);
    const rejected = expect(join).rejects.toThrow(/couldn.t reach lobby KC77N/i);
    await vi.advanceTimersByTimeAsync(0);
    expect(peers[0].connect).toHaveBeenCalledWith(expect.stringContaining('-lobby-KC77N'), expect.anything());
    peers[0].emit('error', { type: 'peer-unavailable' });
    await rejected;
    expect(peers[0].destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps a matched guest open if another peer lookup fails', async () => {
    const join = PvpSession.joinLobby('KC77N', 'classic1', 1000);
    await vi.advanceTimersByTimeAsync(0);
    const guest = peers[0];
    guest.connection.emit('open');
    await vi.advanceTimersByTimeAsync(0);
    guest.connection.emit('data', { t: 'hello', v: PROTOCOL, mmr: 1000, mode: 'classic1' });
    await join;
    guest.emit('error', { type: 'peer-unavailable' });
    expect(guest.destroyed).toBe(false);
  });

  it('ends a waiting lobby when its signaling connection drops', async () => {
    const lobby = await PvpSession.createLobby('classic1', 1000, new AbortController().signal);
    const rejected = expect(lobby.ready).rejects.toThrow(/lobby.*disconnected/i);
    peers[0].emit('disconnected');
    await rejected;
    expect(peers[0].destroy).toHaveBeenCalledTimes(1);
  });
});
