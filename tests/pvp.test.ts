import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { peers, registrationErrors } = vi.hoisted(() => ({ peers: [] as any[], registrationErrors: [] as string[] }));
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
      queueMicrotask(() => {
        const type = registrationErrors.shift();
        if (type) this.emit('error', { type });
        else this.emit('open', id);
      });
    }
  },
}));

import { PvpSession, PROTOCOL, type Msg } from '../src/net/pvp';

describe('PvP lobby connection errors', () => {
  beforeEach(() => {
    peers.length = 0;
    registrationErrors.length = 0;
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

  it('ignores invalid picks so they cannot corrupt a match', async () => {
    const join = PvpSession.joinLobby('KC77N', 'classic1', 1000);
    await vi.advanceTimersByTimeAsync(0);
    const guest = peers[0];
    guest.connection.emit('open');
    await vi.advanceTimersByTimeAsync(0);
    guest.connection.emit('data', { t: 'hello', v: PROTOCOL, mmr: 1000, mode: 'classic1' });
    const session = await join;
    guest.connection.emit('data', { t: 'picks', ids: ['unknown-job'] });
    guest.connection.emit('data', { t: 'picks', ids: ['chef'] });
    const pick = await session.wait((m): m is Extract<Msg, { t: 'picks' }> => m.t === 'picks');
    expect(pick.ids).toEqual(['chef']);
  });

  it('ends a waiting lobby when its signaling connection drops', async () => {
    const lobby = await PvpSession.createLobby('classic1', 1000, new AbortController().signal);
    const rejected = expect(lobby.ready).rejects.toThrow(/lobby.*disconnected/i);
    peers[0].emit('disconnected');
    await rejected;
    expect(peers[0].destroy).toHaveBeenCalledTimes(1);
  });
  it('cancels an in-flight join and closes the signaling peer immediately', async () => {
    const controller = new AbortController();
    const join = PvpSession.joinLobby('KC77N', 'classic1', 1000, controller.signal);
    const result = join.catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(peers[0].destroy).toHaveBeenCalledTimes(1);
    expect(await result).toBe('cancelled');
  });

  it('claims a Quick Match room before sending any lookup requests', async () => {
    const controller = new AbortController();
    const match = PvpSession.quickMatch('classic1', 1000, 2, controller.signal, vi.fn());
    const result = match.catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(0);
    expect(peers).toHaveLength(1);
    expect(peers[0].id).toContain('-qm-classic1-t2-');
    expect(peers[0].connect).not.toHaveBeenCalled();
    controller.abort();
    expect(await result).toBe('cancelled');
  });

  it('retries a lobby ID collision and stops on a service outage', async () => {
    const signal = new AbortController().signal;
    registrationErrors.push('unavailable-id', 'network');
    await expect(PvpSession.createLobby('classic1', 1000, signal)).rejects.toThrow(/matchmaking/i);
    expect(peers).toHaveLength(2);
  });

  it('allows a slow connection to an occupied Quick Match slot', async () => {
    registrationErrors.push('unavailable-id');
    const match = PvpSession.quickMatch('classic1', 1000, 2, new AbortController().signal, vi.fn());
    await vi.advanceTimersByTimeAsync(2500);
    expect(peers).toHaveLength(2);
    const guest = peers[1];
    expect(guest.id).toMatch(/-guest-[0-9a-f-]+$/);
    expect(guest.connect).toHaveBeenCalledTimes(1);
    expect(guest.connection.close).not.toHaveBeenCalled();
    guest.connection.emit('open');
    await vi.advanceTimersByTimeAsync(0);
    guest.connection.emit('data', { t: 'hello', v: PROTOCOL, mmr: 1000, mode: 'classic1' });
    const session = await match;
    const onClose = vi.fn();
    session.onClose = onClose;
    guest.connection.emit('data', { t: 'bye' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(guest.destroy).toHaveBeenCalledTimes(1);
  });

});
