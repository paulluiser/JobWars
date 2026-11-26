/**
 * Recorded sound-effect player (public/sfx, built by `npm run sfx`). Loads the manifest, decodes
 * every clip in the background once audio is unlocked, and plays them with slight pitch/volume
 * variation so repeats don't sound copy-pasted. `play` returns false when a clip isn't ready,
 * so the caller can fall back to its procedural sound.
 */
const BASE = `${import.meta.env.BASE_URL}sfx/`;

export interface PlayOpts {
  vol?: number;
  rate?: number;
  /** ± random pitch spread (default 0.06) */
  vary?: number;
  delay?: number;
}

export class Samples {
  private buffers = new Map<string, AudioBuffer>();
  private keys = new Set<string>();
  private out: GainNode;
  /** last time each key played, to thin out machine-gun repeats */
  private last = new Map<string, number>();

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(dest);
    void this.load();
  }

  private async load() {
    try {
      const res = await fetch(`${BASE}manifest.json`);
      if (!res.ok) return;
      const m = (await res.json()) as { keys: string[] };
      m.keys.forEach((k) => this.keys.add(k));
      // most-used combat sounds first, then the rest
      const first = m.keys.filter((k) => /^(punch|whoosh|swoosh|kick|sword|cloth|bone)/.test(k));
      for (const k of [...first, ...m.keys.filter((k) => !first.includes(k))]) await this.decode(k);
    } catch {}
  }

  private async decode(k: string) {
    if (this.buffers.has(k)) return;
    try {
      const r = await fetch(`${BASE}${k}.mp3`);
      if (r.ok) this.buffers.set(k, await this.ctx.decodeAudioData(await r.arrayBuffer()));
    } catch {}
  }

  has(k: string) {
    return this.buffers.has(k);
  }

  /** Play one clip; a list picks one at random. */
  play(k: string | readonly string[], o: PlayOpts = {}): boolean {
    const key = typeof k === 'string' ? k : k[Math.floor(Math.random() * k.length)];
    if (!key) return false;
    const buf = this.buffers.get(key);
    if (!buf) {
      if (this.keys.has(key)) void this.decode(key);
      return false;
    }
    const now = this.ctx.currentTime;
    // the same clip twice within 40 ms just doubles the volume: skip it
    if ((this.last.get(key) ?? -1) > now - 0.04) return true;
    this.last.set(key, now);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const vary = o.vary ?? 0.06;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * vary);
    const g = this.ctx.createGain();
    g.gain.value = (o.vol ?? 1) * (1 + (Math.random() * 2 - 1) * 0.08);
    src.connect(g).connect(this.out);
    src.start(now + (o.delay ?? 0));
    return true;
  }

  /** Play several layers together; true if at least one played. */
  layers(keys: readonly string[], o: PlayOpts = {}): boolean {
    let any = false;
    keys.forEach((k, i) => {
      any = this.play(k, { ...o, delay: (o.delay ?? 0) + i * 0.02 }) || any;
    });
    return any;
  }

  get ready() {
    return this.buffers.size > 0;
  }
}
