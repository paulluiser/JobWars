const relayUrls = new Set([
  'turn:turn.cloudflare.com:3478?transport=udp',
  'turns:turn.cloudflare.com:443?transport=tcp',
]);
const headers = { 'Cache-Control': 'no-store' };

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
    if (request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403, headers });

    const { TURN_KEY_ID, TURN_KEY_API_TOKEN } = process.env;
    if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) return new Response(null, { status: 204, headers });

    try {
      const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(TURN_KEY_ID)}/credentials/generate-ice-servers`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 1800 }),
        signal: AbortSignal.timeout(4000),
      });
      if (!upstream.ok) return new Response(null, { status: 502, headers });

      const { iceServers } = await upstream.json() as RTCConfiguration;
      const relay = iceServers?.find(({ username, credential }) => username && credential);
      if (!relay) return new Response(null, { status: 502, headers });
      const urls = [relay.urls].flat().filter((url) => relayUrls.has(url));
      if (!urls.length) return new Response(null, { status: 502, headers });
      return Response.json({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls, username: relay.username, credential: relay.credential }],
      }, { headers });
    } catch {
      return new Response(null, { status: 502, headers });
    }
  },
};
