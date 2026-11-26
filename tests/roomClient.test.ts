import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room } from '../src/net/roomState';
import type { RoomPacket, RoomView } from '../src/net/roomWire';

class TestSocket extends EventTarget {
  static OPEN = 1;
  static sockets: TestSocket[] = [];
  readyState = TestSocket.OPEN;
  sent: { t: string }[] = [];
  onclose?: (event: { code: number }) => void;

  constructor(readonly url: URL) {
    super();
    TestSocket.sockets.push(this);
  }

  send(raw: string) { this.sent.push(JSON.parse(raw)); }

  snapshot(room: RoomView) {
    const packet: RoomPacket = { t: 'state', code: 'KC77N', token: 'blue', now: 1000, room };
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(packet) }));
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

describe('room reconnect', () => {
  beforeEach(() => {
    TestSocket.sockets = [];
    vi.useFakeTimers();
    vi.stubEnv('VITE_PVP_ROOM_URL', 'https://pvp.example.test');
    vi.stubGlobal('WebSocket', TestSocket);
    vi.stubGlobal('document', new EventTarget());
    vi.stubGlobal('sessionStorage', { setItem() {}, removeItem() {} });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([false, true])('drops the superseded lock on reconnect when the server lock is %s', async (accepted) => {
    const { RoomClient } = await import('../src/net/roomClient');
    const now = 1000;
    const room = new Room('classic1', now);
    room.sit(1000, now, 'blue', 'Tía Luz');
    room.sit(1000, now, 'red', 'Rival');
    const open = RoomClient.open({ mode: 'classic1', mmr: 1000, displayName: 'Tía Luz' }, new AbortController().signal, () => {});
    const first = TestSocket.sockets[0];
    expect(first.url.searchParams.get('name')).toBe('Tía Luz');
    first.snapshot(room.view(0));
    const client = await open;

    const lock = { t: 'lock', match: 1, ids: ['chef'] } as const;
    client.send({ ...lock, ids: [...lock.ids] });
    if (accepted) room.act(0, { ...lock, ids: [...lock.ids] }, now);
    first.close();
    client.unlock();
    await vi.advanceTimersByTimeAsync(400);
    const resumed = TestSocket.sockets[1];
    expect(resumed.url.searchParams.has('name')).toBe(false);
    resumed.snapshot(room.view(0));
    await vi.advanceTimersByTimeAsync(0);
    expect(resumed.sent.map((action) => action.t)).toEqual(accepted ? ['ping', 'unlock'] : ['ping']);
    client.close(false);
  });
});
