/**
 * Procedural music on the Web Audio clock (no files): a 16-step sequencer with a short
 * look-ahead scheduler. Four moods share one A-minor progression (Am – F – C – G):
 *   menu   soft pad + plucked arpeggio
 *   fight  drums, driving bass, pad stabs
 *   tense  fight + 16th hats, lead arpeggio, more drive (someone is low or time is short)
 *   off    silence
 * Plus one-shot jingles for the intro, a win and a draw.
 */
export type Mood = 'off' | 'menu' | 'fight' | 'tense';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// chord roots and triads, one bar each (A3 = 57)
const PROG = [
  { root: 45, chord: [57, 60, 64] }, // Am
  { root: 41, chord: [53, 57, 60] }, // F
  { root: 48, chord: [55, 60, 64] }, // C
  { root: 43, chord: [55, 59, 62] }, // G
];

export class Music {
  private out: GainNode;
  private mood: Mood = 'off';
  private step = 0;
  private nextT = 0;
  private timer = 0;
  private bpm = 124;

  constructor(private ctx: AudioContext, dest: AudioNode, private noise: AudioBuffer) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.32;
    this.out.connect(dest);
  }

  setMood(m: Mood) {
    if (m === this.mood) return;
    const was = this.mood;
    this.mood = m;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(m === 'off' ? 0 : m === 'menu' ? 0.24 : 0.32, t, 0.25);
    if (m === 'off') {
      clearInterval(this.timer);
      this.timer = 0;
      return;
    }
    this.bpm = m === 'tense' ? 138 : m === 'fight' ? 124 : 96;
    if (!this.timer || was === 'off') {
      clearInterval(this.timer);
      this.step = 0;
      this.nextT = t + 0.05;
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
  }

  get current() {
    return this.mood;
  }

  private schedule() {
    const stepDur = 60 / this.bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextT, stepDur);
      this.nextT += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(s: number, t: number, sd: number) {
    const bar = PROG[Math.floor(s / 16) % 4];
    const i = s % 16;
    const m = this.mood;
    if (m === 'menu') {
      if (i === 0) for (const n of bar.chord) this.pad(midi(n), t, sd * 16, 0.05);
      if (i % 2 === 0) this.pluck(midi(bar.chord[(i / 2) % 3] + (i >= 8 ? 12 : 0)), t, 0.06);
      if (i === 0) this.bass(midi(bar.root), t, sd * 6, 0.12);
      return;
    }
    const tense = m === 'tense';
    // drums
    if (i % 4 === 0) this.kick(t);
    if (i === 4 || i === 12) this.snare(t);
    if (tense ? true : i % 2 === 0) this.hat(t, i % 4 === 2 ? 0.07 : 0.04);
    if (!tense && i === 14 && Math.floor(s / 16) % 2 === 1) this.snare(t, 0.5);
    // driving bass on 8ths, octave jump on the off-beat
    if (i % 2 === 0) this.bass(midi(bar.root + (i % 4 === 2 ? 12 : 0)), t, sd * 1.8, 0.16);
    // pad stabs
    if (i === 0 || i === 10) for (const n of bar.chord) this.stab(midi(n), t, sd * 2.5, 0.035);
    // lead arpeggio when it's tense
    if (tense) {
      const seq = [0, 1, 2, 1, 2, 0, 1, 2];
      this.pluck(midi(bar.chord[seq[i % 8]] + 12), t, 0.05, 'square');
    }
  }

  // ---- instruments ----
  private env(g: GainNode, t: number, vol: number, a: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private kick(t: number) {
    const o = this.osc('sine', 150, t, 0.3);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = this.ctx.createGain();
    this.env(g, t, 0.9, 0.002, 0.26);
    o.connect(g).connect(this.out);
  }

  private noiseHit(t: number, dur: number, type: BiquadFilterType, f: number, vol: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bf = this.ctx.createBiquadFilter();
    bf.type = type;
    bf.frequency.value = f;
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.002, dur);
    src.connect(bf).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private snare(t: number, vol = 1) {
    this.noiseHit(t, 0.16, 'bandpass', 1900, 0.45 * vol);
    const o = this.osc('triangle', 210, t, 0.12);
    const g = this.ctx.createGain();
    this.env(g, t, 0.25 * vol, 0.002, 0.1);
    o.connect(g).connect(this.out);
  }

  private hat(t: number, vol: number) {
    this.noiseHit(t, 0.035, 'highpass', 8000, vol);
  }

  private bass(f: number, t: number, dur: number, vol: number) {
    const o = this.osc('sawtooth', f, t, dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.005, dur);
    o.connect(lp).connect(g).connect(this.out);
  }

  private stab(f: number, t: number, dur: number, vol: number) {
    for (const det of [-6, 6]) {
      const o = this.osc('sawtooth', f, t, dur);
      o.detune.value = det;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      const g = this.ctx.createGain();
      this.env(g, t, vol, 0.01, dur);
      o.connect(lp).connect(g).connect(this.out);
    }
  }

  private pad(f: number, t: number, dur: number, vol: number) {
    const o = this.osc('triangle', f, t, dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
  }

  private pluck(f: number, t: number, vol: number, type: OscillatorType = 'triangle') {
    const o = this.osc(type, f, t, 0.25);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    const g = this.ctx.createGain();
    this.env(g, t, vol, 0.003, 0.22);
    o.connect(lp).connect(g).connect(this.out);
  }

  /** One-shot jingles, played over (and instead of) the loop. */
  jingle(kind: 'intro' | 'win' | 'draw') {
    const t = this.ctx.currentTime + 0.02;
    const notes =
      kind === 'intro' ? [[57, 0], [64, 0.12], [69, 0.24], [76, 0.42]] :
      kind === 'win' ? [[60, 0], [64, 0.11], [67, 0.22], [72, 0.33], [67, 0.5], [72, 0.62], [76, 0.74], [79, 0.86]] :
      [[64, 0], [62, 0.2], [60, 0.4], [57, 0.65]];
    for (const [n, d] of notes) {
      this.pluck(midi(n), t + d, 0.14, 'square');
      this.pluck(midi(n + 12), t + d, 0.06);
    }
    const end = notes[notes.length - 1][1];
    if (kind === 'win') for (const n of [60, 64, 67, 72]) this.pad(midi(n), t + end, 1.4, 0.07);
    if (kind === 'intro') { this.kick(t + end); this.snare(t + end); }
  }
}
