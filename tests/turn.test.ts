import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import turn from '../api/turn';

const origin = 'https://jobwars.vercel.app';
const request = (source = origin) => new Request(origin + '/api/turn', {
  method: 'POST',
  headers: { origin: source },
});
const relay = {
  urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
  username: 'temporary-user',
  credential: 'temporary-password',
};

describe('PvP TURN credentials', () => {
  beforeEach(() => {
    vi.stubEnv('TURN_KEY_ID', 'key-id');
    vi.stubEnv('TURN_KEY_API_TOKEN', 'server-only-token');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects cross-origin requests and disables minting without configuration', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await turn.fetch(request('https://example.com'))).status).toBe(403);
    vi.stubEnv('TURN_KEY_API_TOKEN', '');
    expect((await turn.fetch(request())).status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns short-lived browser credentials and retains both UDP and TLS relay paths', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      iceServers: [{ ...relay, urls: [...relay.urls, 'turn:turn.cloudflare.com:80?transport=tcp'] }],
      internal: 'omit',
    }));
    vi.stubGlobal('fetch', fetch);
    const response = await turn.fetch(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/key-id/credentials/generate-ice-servers'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer server-only-token' }),
      body: JSON.stringify({ ttl: 1800 }),
    }));
    expect(await response.json()).toEqual({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, relay],
    });
  });

  it('coalesces concurrent browser requests and reuses the returned configuration', async () => {
    vi.stubEnv('PROD', true);
    const fetch = vi.fn().mockResolvedValue(Response.json({ iceServers: [relay] }));
    vi.stubGlobal('fetch', fetch);
    const { pvpIceConfig } = await import('../src/net/ice');
    const [host, guest] = await Promise.all([pvpIceConfig(), pvpIceConfig()]);
    expect(host).toEqual({ iceServers: [relay] });
    expect(guest).toBe(host);
    expect(await pvpIceConfig()).toBe(host);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
