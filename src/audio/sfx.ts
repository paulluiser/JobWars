import { Music, type Mood } from './music';
import { Samples } from './samples';
import { EVENT_SFX as E, HAZARD_SFX, JOB_SFX, STATUS_SFX } from './sfxmap';

/**
 * Game audio on one master bus (Mute silences everything):
 *  - recorded sound effects (samples.ts, mapped in sfxmap.ts): every job, skill, event, status
 *    and hazard has its own cue, from Meta's Oculus Audio Pack 01 (CC BY 4.0);
 *  - procedural Web Audio for what the pack lacks (fire, explosions, thunder, zaps, the charge
 *    hum, heartbeat) and as the fallback whenever a recording isn't loaded;
 *  - procedural music (music.ts).
 */
export class Sfx {
  music: Music | null = null;
  /** recorded sound effects */
  rec: Samples | null = null;
  private moodWanted: Mood = 'off';
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private hums = new Map<number, { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode }>();
  muted = false;
  private combo = 0;
  private comboT = 0;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.music = new Music(this.ctx, this.master, this.noise);
    this.music.setMood(this.moodWanted);
    this.rec = new Samples(this.ctx, this.master);
  }

  /** Background music mood (remembered until audio is unlocked by the first click). */
  mood(m: Mood) {
    this.moodWanted = m;
    this.music?.setMood(m);
  }

  jingle(kind: 'intro' | 'win' | 'draw' | 'champion') {
    if (!this.ok) return;
    const key = { intro: E.intro, win: E.win, draw: E.draw, champion: E.champion }[kind];
    if (this.rec?.play(key, { vary: 0 })) return;
    this.music?.jingle(kind === 'champion' ? 'win' : kind);
  }

  /** a recorded cue if it's loaded; returns whether it played */
  private r(k: string | readonly string[], vol = 1, rate = 1) {
    return !!this.rec?.play(k, { vol, rate });
  }

  /** hazard appearing / going off: each kind has its own sound */
  hazard(kind: string, action: 'spawn' | 'trigger' | 'expire') {
    if (!this.ok || action === 'expire') return;
    const h = HAZARD_SFX[kind]?.[action];
    if (h?.length) this.r(h, action === 'spawn' ? 0.8 : 0.9);
    else if (kind === 'trap' && action === 'spawn') this.trapSet();
  }

  replay() {
    if (this.ok) this.r(E.replay);
  }

  firstBlood() {
    if (this.ok) this.r(E.firstBlood, 0.7);
  }

  chargeStart() {
    if (this.ok) this.r(E.chargeStart, 0.6);
  }

  share() {
    if (this.ok) this.r(E.share);
  }

  /** UI click / hover tick */
  ui(kind: 'click' | 'tab' | 'go' = 'click') {
    if (!this.ok) return;
    if (this.r(kind === 'go' ? E.uiGo : kind === 'tab' ? E.uiTab : E.uiClick, 0.7)) return;
    if (kind === 'go') {
      this.tone(523, 530, 0.08, 'square', 0.1);
      this.tone(784, 790, 0.14, 'square', 0.1, 0.002, 0.07);
      return;
    }
    this.tone(kind === 'tab' ? 900 : 1400, kind === 'tab' ? 700 : 1100, 0.05, 'triangle', 0.08);
  }

  /** last-ten-seconds clock tick */
  tick(urgent: boolean) {
    if (!this.ok) return;
    if (this.r(urgent ? E.tickUrgent : E.tick, 0.8)) return;
    this.tone(urgent ? 1500 : 1100, urgent ? 1450 : 1080, 0.06, 'square', 0.07);
  }

  cleanse() {
    if (!this.ok) return;
    if (this.r(E.cleanse)) return;
    for (let i = 0; i < 4; i++) this.tone(1046 * (1 + i * 0.25), 1100 * (1 + i * 0.25), 0.18, 'sine', 0.08, 0.002, i * 0.04);
  }

  absorb() {
    if (!this.ok) return;
    if (this.r(E.absorb, 0.8)) return;
    this.tone(600, 1200, 0.12, 'sine', 0.12);
    this.burst(0.08, 'highpass', 5000, 3000, 1, 0.12);
  }

  /** a fighter in Tag Team goes down but the fight goes on */
  down() {
    if (!this.ok) return;
    this.r(E.down);
    this.tone(220, 70, 0.6, 'sawtooth', 0.18);
    this.burst(0.5, 'lowpass', 1200, 80, 0.6, 0.5);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.value = m ? 0 : 0.55;
  }

  /** Called every frame so rapid hits climb in pitch. */
  update(dt: number) {
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
  }

  private get ok() {
    return !!this.ctx && !this.muted;
  }
  private rnd(v = 0.08) {
    return 1 + (Math.random() * 2 - 1) * v;
  }

  private tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, attack = 0.002, delay = 0) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, filter: BiquadFilterType, f0: number, f1: number, q: number, vol: number, delay = 0) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = this.rnd(0.2);
    const bf = c.createBiquadFilter();
    bf.type = filter;
    bf.Q.value = q;
    bf.frequency.setValueAtTime(f0, t);
    bf.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bf).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** a swing: the job's own whoosh family and pitch; heavy blows use the big swooshes */
  whoosh(heavy: boolean, vol = 1, job?: string) {
    if (!this.ok) return;
    const j = job ? JOB_SFX[job] : undefined;
    if (this.r(heavy ? E.heavySwing : j?.swing ?? E.miss, (heavy ? 0.9 : 0.6) * vol, (j?.rate ?? 1) * (heavy ? 0.85 : 1))) return;
    const p = this.rnd();
    this.burst(heavy ? 0.28 : 0.16, 'bandpass', 600 * p, (heavy ? 2600 : 3800) * p, 1.2, (heavy ? 0.5 : 0.26) * vol);
  }

  miss() {
    if (!this.ok) return;
    if (this.r(E.miss, 0.45, 1.3)) return;
    this.burst(0.12, 'bandpass', 2600 * this.rnd(), 900, 2, 0.16);
  }

  /** Soft rubbery thud on wall bounces, louder and lower the harder the impact. */
  bounce(speed: number) {
    if (!this.ok) return;
    const k = Math.min(1, speed / 600);
    const p = this.rnd(0.12);
    this.tone((190 - 70 * k) * p, 70, 0.09 + 0.06 * k, 'sine', 0.08 + 0.2 * k);
    if (k > 0.5) this.burst(0.06, 'lowpass', 800, 200, 0.7, 0.12 * k);
  }

  bump(force: number) {
    if (!this.ok) return;
    // only real collisions rustle; partners brushing past each other in Tag Team stay quiet
    if (force > 260) this.r(E.bump, Math.min(1, 0.3 + force / 900));
    const k = Math.min(1, force / 700);
    const p = this.rnd(0.1);
    this.tone(260 * p, 90, 0.1, 'triangle', 0.12 + 0.2 * k);
    this.tone(130 * p, 60, 0.14, 'sine', 0.2 + 0.3 * k);
  }

  /**
   * A landed hit: the impact (punch / heavy / crit / skill), plus the attacker's tool material
   * on top, so a Builder's hit rings like an anvil and a Waiter's cracks like a plate.
   */
  hit(heavy: boolean, crit: boolean, job?: string, skill = false) {
    if (!this.ok) return;
    this.combo = Math.min(8, this.combo + 1);
    this.comboT = 1.2;
    const p = this.rnd() * (1 + this.combo * 0.025);
    const impact = crit ? E.crit : heavy ? E.punchHeavy : skill ? E.skillHit : E.punch;
    if (this.r(impact, heavy || crit ? 1 : 0.85, 1 + this.combo * 0.02)) {
      const mat = job ? JOB_SFX[job]?.hit : undefined;
      if (mat?.length) this.r(mat, heavy ? 0.75 : 0.55);
      if (heavy) this.tone(60, 30, 0.45, 'sine', 0.6, 0.005, 0.02); // sub thump under heavy blows
      if (crit) this.tone(1600 * p, 700, 0.12, 'sawtooth', 0.08, 0.002, 0.01);
      return;
    }
    // body thump
    this.tone((heavy ? 120 : 170) * p, 45, heavy ? 0.3 : 0.16, 'sine', heavy ? 0.9 : 0.7);
    // material crack
    this.burst(heavy ? 0.16 : 0.08, 'highpass', 1800 * p, 900, 0.7, heavy ? 0.6 : 0.45);
    this.tone(420 * p, 160, 0.07, 'square', 0.12);
    if (crit) {
      this.tone(1600 * p, 700, 0.14, 'sawtooth', 0.14, 0.002, 0.01);
      this.burst(0.25, 'bandpass', 5000, 2500, 3, 0.25, 0.01);
    }
    if (heavy) this.tone(60, 30, 0.45, 'sine', 0.8, 0.005, 0.02);
  }

  block() {
    if (!this.ok) return;
    if (this.r(E.block, 0.8)) return;
    const p = this.rnd();
    this.tone(820 * p, 760 * p, 0.18, 'triangle', 0.3);
    this.tone(1230 * p, 1100 * p, 0.12, 'square', 0.08);
    this.burst(0.07, 'highpass', 3000, 2000, 0.8, 0.3);
  }

  parry() {
    if (!this.ok) return;
    this.rec?.layers(E.parry, { vol: 0.9 });
    const p = this.rnd(0.03);
    this.tone(1320 * p, 1300 * p, 0.7, 'sine', 0.35);
    this.tone(1980 * p, 1960 * p, 0.55, 'sine', 0.2);
    this.tone(2640 * p, 2600 * p, 0.35, 'triangle', 0.1);
    this.burst(0.06, 'highpass', 4000, 3000, 1, 0.35);
  }

  guardBreak() {
    if (!this.ok) return;
    this.r(E.guardBreak, 0.9);
    this.burst(0.35, 'lowpass', 2500, 200, 1, 0.8);
    this.tone(90, 35, 0.5, 'sawtooth', 0.35);
    this.tone(700, 200, 0.2, 'square', 0.15);
  }

  dash() {
    if (!this.ok) return;
    if (this.r(E.dodge, 0.8)) return;
    this.burst(0.18, 'bandpass', 1200 * this.rnd(), 300, 1.5, 0.35);
  }

  wallSlam() {
    if (!this.ok) return;
    this.r(E.wallSlam, 0.8);
    this.tone(70, 30, 0.4, 'sine', 0.9);
    this.burst(0.3, 'lowpass', 900, 120, 0.7, 0.7);
  }

  dot(kind: string) {
    if (!this.ok) return;
    if (kind === 'poison') this.tone(300 * this.rnd(), 520, 0.08, 'sine', 0.1);
    else this.burst(0.09, 'bandpass', 2400 * this.rnd(), 1200, 2, 0.12);
  }

  /** a status effect landing: each kind has its own cue */
  status(kind?: string) {
    if (!this.ok) return;
    const k = kind ? STATUS_SFX[kind] : undefined;
    if (k?.length && this.r(k, 0.75)) return;
    if (kind === 'burn') return this.fire();
    this.tone(500, 900, 0.12, 'triangle', 0.12);
  }

  stun() {
    if (!this.ok) return;
    if (this.r(E.stun, 0.8)) return;
    this.tone(1800, 1700, 0.08, 'sine', 0.12);
    this.tone(2200, 2100, 0.08, 'sine', 0.1, 0.002, 0.09);
    this.tone(1900, 1800, 0.08, 'sine', 0.1, 0.002, 0.18);
  }

  interrupt() {
    if (!this.ok) return;
    if (this.r(E.interrupt, 0.8)) return;
    this.tone(500, 120, 0.22, 'sawtooth', 0.22);
  }

  heartbeat() {
    if (!this.ok) return;
    this.tone(60, 40, 0.12, 'sine', 0.5);
    this.tone(55, 38, 0.14, 'sine', 0.38, 0.003, 0.16);
  }

  ko() {
    if (!this.ok) return;
    this.r(E.ko);
    this.tone(110, 28, 1.2, 'sine', 1);
    this.burst(1.0, 'lowpass', 1800, 60, 0.6, 0.8);
    this.tone(880, 220, 0.8, 'triangle', 0.18, 0.01, 0.05);
  }

  /** Active skill cast: a bright chime plus the job's own signature sound. */
  skill(id = '') {
    if (!this.ok) return;
    const j = JOB_SFX[id];
    if (j && this.rec?.layers(j.active, { vol: 0.9 })) return;
    const p = this.rnd(0.04);
    this.tone(660 * p, 680 * p, 0.12, 'triangle', 0.14);
    this.tone(990 * p, 1010 * p, 0.16, 'triangle', 0.12, 0.002, 0.07);
    this.signature(id);
  }

  /** One recognisable sound per job, layered on the cast chime. */
  private signature(id: string) {
    const T = (f: number, e: number, d: number, ty: OscillatorType, v: number, dl = 0) => this.tone(f, e, d, ty, v, 0.002, dl);
    const N = (d: number, ty: BiquadFilterType, f0: number, f1: number, q: number, v: number, dl = 0) => this.burst(d, ty, f0, f1, q, v, dl);
    switch (id) {
      case 'chef': N(0.5, 'highpass', 3000, 5000, 0.7, 0.3); N(0.3, 'lowpass', 900, 300, 0.8, 0.3, 0.05); break; // sizzle + whoomp
      case 'firefighter': N(0.6, 'bandpass', 1200, 2600, 0.8, 0.4); break; // hose
      case 'electrician': T(60, 60, 0.4, 'sawtooth', 0.18); N(0.3, 'highpass', 4000, 7000, 1, 0.2); break; // hum + crackle
      case 'nurse': T(900, 900, 0.1, 'square', 0.1); T(900, 900, 0.1, 'square', 0.1, 0.15); T(80, 40, 0.3, 'sine', 0.5, 0.3); break; // charge beeps + thump
      case 'courier': T(370, 360, 0.3, 'square', 0.1); T(466, 456, 0.3, 'square', 0.08); break; // horn
      case 'fisher': for (let i = 0; i < 6; i++) T(2400, 2200, 0.03, 'square', 0.06, i * 0.04); break; // reel click
      case 'farmer': N(0.25, 'bandpass', 800, 4000, 2, 0.35); break; // scythe swish
      case 'builder': for (let i = 0; i < 3; i++) { T(140, 90, 0.12, 'square', 0.18, i * 0.09); N(0.06, 'lowpass', 1200, 400, 1, 0.2, i * 0.09); } break; // bricks
      case 'miner': T(2200, 2100, 0.08, 'triangle', 0.15); N(0.4, 'lowpass', 700, 120, 0.7, 0.4, 0.06); break; // pick clink + rumble
      case 'welder': N(0.5, 'highpass', 6000, 8000, 2, 0.25); T(3200, 2800, 0.4, 'sawtooth', 0.03); break; // arc buzz
      case 'plumber': T(300, 900, 0.12, 'sine', 0.3); T(500, 160, 0.1, 'sine', 0.25, 0.14); break; // plunger pop
      case 'mechanic': for (let i = 0; i < 5; i++) T(1500, 1300, 0.025, 'square', 0.08, i * 0.045); break; // ratchet
      case 'engineer': T(180, 160, 0.5, 'sawtooth', 0.06); T(240, 190, 0.5, 'triangle', 0.08, 0.1); break; // steel creak
      case 'pilot': for (let i = 0; i < 6; i++) T(110, 105, 0.05, 'sawtooth', 0.1, i * 0.05); break; // prop engine
      case 'merchant': for (let i = 0; i < 3; i++) T(2600 + i * 300, 2500, 0.12, 'sine', 0.1, i * 0.06); break; // coins
      case 'waiter': T(1800, 1750, 0.5, 'sine', 0.15); T(2700, 2650, 0.4, 'sine', 0.08); break; // tray ding
      case 'cleaner': T(1700, 2300, 0.12, 'sine', 0.1); N(0.3, 'bandpass', 900, 600, 1, 0.2); break; // squeak + splash
      case 'tailor': for (let i = 0; i < 3; i++) N(0.07, 'highpass', 5000, 7000, 2, 0.2, i * 0.06); break; // needle zips
      case 'barber': N(0.04, 'highpass', 6000, 6000, 3, 0.3); N(0.04, 'highpass', 6000, 6000, 3, 0.3, 0.09); N(0.5, 'bandpass', 1500, 1500, 0.6, 0.2, 0.15); break; // snip snip + dryer
      case 'doctor': N(0.25, 'highpass', 7000, 5000, 1, 0.2); break; // syringe hiss
      case 'scientist': for (let i = 0; i < 5; i++) T(400 + Math.random() * 600, 900, 0.06, 'sine', 0.12, i * 0.05); break; // bubbling
      case 'teacher': T(2000, 2000, 0.06, 'square', 0.05); N(0.2, 'bandpass', 3500, 3000, 4, 0.15); T(1318, 1318, 0.5, 'sine', 0.12, 0.1); break; // chalk + bell
      case 'programmer': for (let i = 0; i < 7; i++) N(0.02, 'highpass', 3000, 3000, 1, 0.18, i * 0.035); break; // keyboard clacks
      case 'accountant': T(1200, 1200, 0.05, 'square', 0.1); T(1600, 1600, 0.25, 'sine', 0.12, 0.08); break; // register ka-ching
      case 'lawyer': T(180, 90, 0.08, 'square', 0.25); N(0.06, 'lowpass', 1500, 500, 1, 0.35); T(180, 90, 0.08, 'square', 0.25, 0.14); break; // gavel knocks
      case 'police': T(1400, 1800, 0.18, 'square', 0.06); T(1800, 1400, 0.18, 'square', 0.06, 0.18); break; // siren blip
      case 'soldier': T(2600, 2600, 0.03, 'square', 0.12); N(0.1, 'highpass', 4000, 2000, 1, 0.2, 0.05); break; // pin pull
      case 'artist': N(0.3, 'bandpass', 2000, 900, 1.5, 0.25); break; // brush swish
      case 'musician': for (const f of [110, 165, 220, 277]) T(f, f * 0.99, 0.6, 'sawtooth', 0.06); break; // power chord
      case 'athlete': T(2800, 2700, 0.25, 'square', 0.06); T(110, 60, 0.12, 'sine', 0.4, 0.15); break; // whistle + kick
    }
  }

  /** Special cutscene stinger: rising whoosh + impact chord. */
  /** special move: the stinger plus the job's own special sound */
  special(id = '') {
    if (!this.ok) return;
    const j = JOB_SFX[id];
    if (this.r(E.special, 0.8)) {
      if (j) this.rec?.layers(j.special, { vol: 0.95, delay: 0.25 });
      this.burst(0.5, 'bandpass', 300, 4000, 1.5, 0.3);
      return;
    }
    this.burst(0.5, 'bandpass', 300, 4000, 1.5, 0.45);
    this.tone(110, 220, 0.5, 'sawtooth', 0.18);
    this.tone(220, 440, 0.5, 'square', 0.08);
    this.tone(523, 523, 0.9, 'triangle', 0.18, 0.01, 0.35);
    this.tone(659, 659, 0.9, 'triangle', 0.15, 0.01, 0.35);
    this.tone(784, 784, 0.9, 'triangle', 0.13, 0.01, 0.35);
  }

  specialReady() {
    if (!this.ok) return;
    if (this.r(E.specialReady, 0.8)) return;
    this.tone(880, 1760, 0.25, 'sine', 0.18);
  }

  zap() {
    if (!this.ok) return;
    this.burst(0.18, 'highpass', 3000, 6000, 1, 0.35);
    this.tone(120, 60, 0.18, 'sawtooth', 0.22);
    this.tone(2400 * this.rnd(), 1200, 0.1, 'square', 0.08);
  }

  thunder() {
    if (!this.ok) return;
    this.burst(0.8, 'lowpass', 1600, 80, 0.7, 0.8);
    this.tone(70, 30, 0.6, 'sine', 0.7);
    this.zap();
  }

  water() {
    if (!this.ok) return;
    this.burst(0.25, 'bandpass', 900 * this.rnd(), 2200, 1.2, 0.3);
  }

  fire() {
    if (!this.ok) return;
    this.burst(0.45, 'lowpass', 1400, 300, 0.8, 0.5);
    this.tone(90, 50, 0.4, 'sawtooth', 0.12);
  }

  explosion() {
    if (!this.ok) return;
    this.r(E.ko, 0.55);
    this.tone(80, 25, 0.9, 'sine', 1);
    this.burst(0.9, 'lowpass', 2400, 60, 0.6, 0.9);
  }

  horn() {
    if (!this.ok) return;
    this.tone(370, 360, 0.35, 'square', 0.12);
    this.tone(466, 456, 0.35, 'square', 0.1);
    this.burst(0.4, 'lowpass', 600, 200, 0.7, 0.4);
  }

  splash() {
    if (!this.ok) return;
    this.burst(0.6, 'bandpass', 700, 2500, 0.8, 0.7);
    this.tone(140, 60, 0.4, 'sine', 0.6);
  }

  heal() {
    if (!this.ok) return;
    if (this.r(E.heal, 0.7)) return;
    const p = this.rnd(0.03);
    this.tone(784 * p, 790 * p, 0.25, 'sine', 0.12);
    this.tone(1175 * p, 1180 * p, 0.3, 'sine', 0.1, 0.002, 0.08);
  }

  trapSet() {
    if (!this.ok) return;
    this.tone(300, 300, 0.06, 'square', 0.12);
    this.tone(600, 600, 0.06, 'square', 0.1, 0.002, 0.08);
  }

  bell() {
    if (!this.ok) return;
    if (this.r(E.fight)) return;
    this.tone(660, 650, 0.9, 'sine', 0.3);
    this.tone(990, 980, 0.7, 'sine', 0.16);
  }

  /** Rising hum while a fighter charges; progress null stops it. */
  charge(idx: number, progress: number | null) {
    if (!this.ctx) return;
    const h = this.hums.get(idx);
    if (progress === null || this.muted) {
      if (h) {
        const t = this.ctx.currentTime;
        h.gain.gain.cancelScheduledValues(t);
        h.gain.gain.setTargetAtTime(0, t, 0.02);
        h.osc.stop(t + 0.15);
        h.osc2.stop(t + 0.15);
        this.hums.delete(idx);
      }
      return;
    }
    if (!h) {
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc2.type = 'sine';
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      gain.gain.value = 0;
      osc.connect(lp);
      osc2.connect(lp);
      lp.connect(gain).connect(this.master);
      osc.start();
      osc2.start();
      this.hums.set(idx, { osc, osc2, gain });
      return;
    }
    const t = this.ctx.currentTime;
    h.osc.frequency.setTargetAtTime(110 + progress * 330, t, 0.03);
    h.osc2.frequency.setTargetAtTime(220 + progress * 660 + Math.sin(t * 40) * 8, t, 0.03);
    h.gain.gain.setTargetAtTime(0.05 + progress * 0.13, t, 0.03);
  }

  stopAll() {
    for (const k of [...this.hums.keys()]) this.charge(k, null);
  }
}
