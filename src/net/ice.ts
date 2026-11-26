const direct: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let request: Promise<RTCConfiguration> | undefined;
let refreshAt = 0;

export function pvpIceConfig(): Promise<RTCConfiguration> {
  if (!import.meta.env.PROD) return Promise.resolve(direct);
  if (request && Date.now() < refreshAt) return request;
  refreshAt = Date.now() + 30_000;
  request = fetch('/api/turn', { method: 'POST', signal: AbortSignal.timeout(5000) })
    .then(async (response) => {
      if (response.status === 204) {
        refreshAt = Date.now() + 10 * 60_000;
        return direct;
      }
      if (!response.ok) return direct;
      const { iceServers } = await response.json() as RTCConfiguration;
      if (!Array.isArray(iceServers) || !iceServers.length) return direct;
      refreshAt = Date.now() + 10 * 60_000;
      return { iceServers };
    })
    .catch(() => direct);
  return request;
}
