import { Sfx } from './audio/sfx';
import { ROSTER, byId } from './data/roster';
import { DEFAULT_ARENA, isArenaId, resolveArena, storyArena, type ArenaChoice } from './data/arenas';
import { ARENA_H, ARENA_W, DT } from './sim/constants';
import { Sim, type SimOpts } from './sim/sim';
import type { BattleSide, FighterDef, SimEvent, Team } from './sim/types';
import { CARD_BY_ID, GACHA, type Card } from './data/cards';
import { cpuPick, gachaOpts, offersFor, type Pick } from './modes/gacha';
import { DraftOverlay, buffPanelHtml } from './ui/cards';
import { renderHeroLibrary, renderLevel, renderMenu, renderPvp, renderPvpPick, renderRoyaleLobby, renderStoryMap, storyResultHtml, type HeroPreview, type PvpView } from './ui/menu';
import { PVP_MODES, PvpSession, type Msg, type PvpMode } from './net/pvp';
import { clearSavedRoom, RoomClient, roomService, savedRoom } from './net/roomClient';
import { roomCheckpoint, roomSimulation, stepRoom, SURGE_TICKS, targetTick } from './net/roomSim';
import { normalizeDisplayName, type RoomView } from './net/roomWire';
import { loadProfile, recordResult, tierOf } from './modes/mmr';
import { LEVELS, isOpen, judge, loadProgress, saveProgress, type Level } from './modes/story';
import { TEAM_COLORS, castColor } from './render/fighterView';
import { loadArt, posterUrl } from './render/art';
import { DEPTH } from './render/depth';
import { Juice } from './render/juice';
import { Scene, type Layout } from './render/scene';
import { Cutscene, CUTSCENE_DUR, type CutsceneMode } from './ui/cutscene';
import { Hud } from './ui/hud';
import { randomJobs, renderResults, renderSelect, setMode, type Mode, type SelectResult, type SelectState } from './ui/screens';
import { renderBracket } from './ui/bracket';
import { Intro, INTRO_DUR } from './ui/intro';
import { TitleScreen } from './ui/title';
import { champion, createTournament, decide, describe, nextMatch, report, roundName, simulate, type Entry, type Format, type Tournament } from './modes/tournament';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const TEAM_HEX = TEAM_COLORS.map(hex);
const HEIGHT = 55; // body-centre height above the feet, in world px

/** Who makes a side's choices (Gacha card picks): you, the CPU, or the other player online. */
export type Side = 'human' | 'cpu' | 'remote';

/** What kind of match is being played; everything mode-specific hangs off this. */
export interface MatchSpec {
  kind: 'cpu' | 'pvp' | 'story' | 'tourney';
  gacha: boolean;
  control: [Side, Side];
  arena?: ArenaChoice;
  names?: string[];
  localSide?: BattleSide;
  /** extra sim options (Story: boss HP, time limits, enemy's starting cards) */
  extra?: Partial<SimOpts>;
  /** cards a side starts with on top of its draft (Story) */
  startCards?: [string[], string[]];
  /** the draft and pacing recorded in a share link */
  sharedDraft?: { log: Pick[]; legacy: boolean };
  /** how many of the picks fight for Blue (default: half). Story handicaps are 1 vs 2. */
  blue?: number;
  /** the other player's picks (online PvP) */
  remote?: {
    pick(team: Team, pick: number, offers: (reroll: number) => Card[]): Promise<string>;
    send(team: Team, pick: number, reroll: number, id: string): void;
  };
  /** called once when the fight is decided (Story progress, PvP MMR) */
  onEnd?: (sim: Sim) => void;
  /** replaces the standard match report (Story's result card) */
  result?: () => string;
  /** results-screen buttons for this mode (defaults: Rematch / Replay / Share / Change) */
  resultActions?: string;
}

const ROOM_RESULTS = '<button class="primary" data-act="pvprematch">Rematch</button><button data-act="share">Share this fight</button><button data-act="pvpleave">Leave</button>';
const DISPLAY_NAME_KEY = 'pvpDisplayName';
const ROYALE_RESULTS = '<button class="primary" data-act="pvprematch">Rematch</button><button data-act="pvpleave">Leave</button>';
interface RoomRun {
  match: number;
  draft: number;
  report: string;
  repair: string;
  blocked: boolean;
  shownResult: boolean;
  fightBuilt: boolean;
  rematchPending?: boolean;
}

const CLASSIC: MatchSpec = { kind: 'cpu', gacha: false, control: ['cpu', 'cpu'] };

export class Game {
  juice = new Juice();
  scene = new Scene(this.juice);
  sfx = new Sfx();
  hud = new Hud();
  cutscene!: Cutscene;
  cutMode: CutsceneMode = 'full';
  sim!: Sim;
  seed = 1;
  speed = 1;
  paused = false;
  started = false;
  /** 1v1: [blue, red]; Tag Team: [blue, blue, red, red] */
  picks: FighterDef[] = [ROSTER[0], ROSTER[1]];
  mode: Mode = 'duel';
  tourney: Tournament | null = null;
  /** the bracket match being watched, if any */
  private match: { r: number; i: number; seed: number } | null = null;
  private tEntries: Entry[] = [];
  private select!: SelectState;
  private urlSeed: number | null = null;
  private acc = 0;
  private heartT = 0;
  private endT = -1;
  private cutT = 0;
  private pending: SimEvent[] = [];
  /** pre-fight VS splash: time is held while it plays */
  private introT = 0;
  private intro!: Intro;
  /** KO replay: the last seconds before the final blow, re-simulated from the seed */
  replaying = false;
  private replayed = false;
  private ko: { tick: number; victim: number; killer: number } | null = null;
  private lastTick = -1;
  private panel = document.querySelector('#panel') as HTMLElement;
  /** the current match's mode, controllers and hooks */
  spec: MatchSpec = CLASSIC;
  /** Gacha: every pick so far (replays and share links re-apply them) */
  draftLog: Pick[] = [];
  /** picks loaded from a share link: used instead of asking anyone */
  private drafting = false;
  draft!: DraftOverlay;
  title!: TitleScreen;
  private buffsEl!: HTMLElement;
  private ended = false;

  async init(stage: HTMLElement, layout: Layout, portraitH: number) {
    await loadArt(); // real art where the pipeline has produced it; placeholders everywhere else
    await this.scene.init(stage, layout, portraitH);
    this.cutscene = new Cutscene(stage);
    this.intro = new Intro(stage, () => this.skipIntro());
    this.draft = new DraftOverlay(stage);
    this.title = new TitleScreen(stage);
    const poster = posterUrl(document.body.classList.contains('portrait'));
    if (poster) document.documentElement.style.setProperty('--poster', `url('${poster}')`);
    this.buffsEl = document.createElement('div');
    this.buffsEl.id = 'buffs';
    stage.appendChild(this.buffsEl);
    const q = new URLSearchParams(location.search);
    // ?mode=tag&blue=chef,nurse&red=miner,pilot  (or ?blue=chef&red=nurse for 1v1)
    const list = (k: string) => (q.get(k) ?? '').split(',').map((id) => byId(id.trim())).filter((d): d is FighterDef => !!d);
    const blue = list('blue'), red = list('red');
    let mode: Mode = 'duel';
    let detailed = false;
    try {
      const m = localStorage.getItem('mode') as Mode | null;
      if (m === 'duel' || m === 'tag' || m === 'tourney') mode = m;
    } catch {}
    const qm = q.get('mode');
    if (qm === 'tag' || qm === 'duel' || qm === 'tourney') mode = qm;
    else if (blue.length > 1 || red.length > 1) mode = 'tag';
    else if (q.has('seed') && blue.length === 1 && red.length === 1) mode = 'duel';
    const per = mode === 'tag' ? 2 : 1;
    const rb = randomJobs(per * 2, []);
    this.picks = [...[...blue, ...rb.slice(0, per)].slice(0, per), ...[...red, ...rb.slice(per)].slice(0, per)];
    try {
      detailed = localStorage.getItem('detailMode') === 'detailed';
      const cm = localStorage.getItem('cutsceneMode') as CutsceneMode | null;
      if (cm && cm in CUTSCENE_DUR) this.cutMode = cm;
    } catch {}
    let cpuGacha = false;
    try { cpuGacha = localStorage.getItem('cpuGacha') === '1'; } catch {}
    this.select = { mode: 'duel', picks: this.picks, slot: 0, focus: this.picks[0], detailed, entrants: [], tSize: 8, tFormat: 'duel', gacha: cpuGacha, arena: 'auto' };
    setMode(this.select, mode);
    this.mode = mode;
    this.picks = this.select.picks;
    const s = q.get('seed');
    this.urlSeed = s ? Number(s) : null;
    // ?g=0.0.hard-hat,1.0.phoenix,…  = a Gacha match's whole draft (team.pick.card)
    const g = q.get('g');
    if (g) {
      const log = g.split(',').map((x) => x.split('.')).filter((x) => x.length === 3 && CARD_BY_ID.has(x[2])).map(([t, p, id]) => ({ team: Number(t) as Team, pick: Number(p), id }));
      this.spec = { kind: 'cpu', gacha: true, control: ['cpu', 'cpu'], sharedDraft: { log, legacy: q.get('gv') !== '2' } };
    }
    const arena = q.get('arena');
    if (arena !== null && isArenaId(arena)) this.spec = { ...this.spec, arena };
    this.newFight(this.urlSeed ?? this.randomSeed());
    // a shared link (?seed=…&blue=…&red=…) opens straight into that exact fight
    if (this.urlSeed !== null && blue.length && red.length && mode !== 'tourney') {
      this.start(this.urlSeed);
      this.urlSeed = null;
    } else this.showTitle();
    this.scene.app.ticker.add((t) => this.frame(Math.min(0.1, t.deltaMS / 1000)));
  }

  randomSeed() {
    return Math.floor(Math.random() * 99999) + 1;
  }

  newFight(seed: number, simulation?: Sim) {
    this.seed = seed;
    // team 0 = blue (left / top-left), team 1 = red; the picks are split down the middle
    const h = this.blueCount;
    this.sim = simulation ?? new Sim([this.picks.slice(0, h), this.picks.slice(h)], seed, this.simOpts());
    const royale = !!this.sim.opts.royale;
    this.ended = false;
    document.body.classList.toggle('tag', !royale && this.picks.length > 2);
    document.body.classList.toggle('royale', royale);
    document.body.classList.toggle('gacha', this.spec.gacha);
    this.hideBuffs();
    this.scene.setArena(resolveArena(this.spec.arena, this.sim.fighters.map((f) => f.def.id), seed));
    this.scene.setFighters(this.sim);
    this.hud.setup(this.sim, TEAM_HEX, this.spec.localSide, this.spec.kind === 'pvp' ? this.spec.names : undefined);
    this.acc = 0;
    this.endT = -1;
    this.cutT = 0;
    this.pending = [];
    this.cutscene?.stop();
    this.juice.hitstop = 0;
    this.juice.slowmoT = 0;
    this.juice.trauma = 0;
    this.juice.slowmoT = 0;
    this.sfx.stopAll();
    this.panel.classList.remove('show', 'wide');
    document.body.classList.remove('selecting', 'replaying');
    this.replaying = false;
    this.replayed = false;
    this.ko = null;
    this.lastTick = -1;
    this.heartT = 0;
    this.scene.focus = null;
    this.firstBlood = false;
    this.lastHitBy = {};
    this.specialCasts = {};
    if (this.started) {
      const h = this.blueCount;
      const label = this.spec.names ? `${this.spec.names[0]} vs ${this.spec.names[1]}`.toUpperCase()
        : this.match && this.tourney ? roundName(this.tourney, this.match.r).toUpperCase()
        : `${this.spec.gacha ? 'GACHA · ' : ''}${this.picks.length > 2 ? 'TAG TEAM' : `SEED ${seed}`}`;
      if (royale) this.hud.callout('BATTLE ROYALE');
      else this.intro.play(this.picks.slice(0, h), this.picks.slice(h), label);
      this.introT = INTRO_DUR;
      this.sfx.mood('off');
      this.sfx.jingle('intro');
    }
  }

  private firstBlood = false;
  /** specials cast per fighter this fight (repeats get a shorter cutscene) */
  private specialCasts: Record<number, number> = {};
  private champSounded: Tournament | null = null;
  skipIntro() {
    if (this.introT > 0) this.introT = 0.001;
  }

  /** the intro is over: ring the bell and let them go */
  private beginFight() {
    this.intro.stop();
    this.hud.callout('FIGHT!');
    this.sfx.bell();
    this.sfx.mood('fight');
  }

  /** A link that reopens this exact fight: same jobs, same sides, same seed. */
  shareUrl() {
    const h = this.blueCount;
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('mode', this.picks.length > 2 ? 'tag' : 'duel');
    u.searchParams.set('blue', this.picks.slice(0, h).map((d) => d.id).join(','));
    u.searchParams.set('red', this.picks.slice(h).map((d) => d.id).join(','));
    u.searchParams.set('seed', String(this.seed));
    if (this.scene.arenaId !== DEFAULT_ARENA) u.searchParams.set('arena', this.scene.arenaId);
    if (this.spec.gacha && this.draftLog.length) {
      u.searchParams.set('g', this.draftLog.map((p) => `${p.team}.${p.pick}.${p.id}`).join(','));
      if (!this.spec.sharedDraft?.legacy) u.searchParams.set('gv', '2');
    }
    return u.toString();
  }

  async share(btn?: HTMLElement | null) {
    if (this.sim.opts.royale) return;
    const url = this.shareUrl();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Job Wars', url });
      else await navigator.clipboard.writeText(url);
    } catch {
      prompt('Copy this link:', url);
      return;
    }
    if (btn) {
      btn.classList.remove('copied');
      void btn.offsetWidth;
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1600);
    }
  }

  // ---------------- KO replay ----------------
  /**
   * Re-run the fight from its seed up to ~3 s before the final blow (the sim is deterministic),
   * then play those seconds again in slow motion with the camera on the loser.
   */
  private startReplay() {
    const k = this.ko!;
    this.replayed = true; // once per fight, even if it's skipped
    const h = this.blueCount;
    const r = new Sim([this.picks.slice(0, h), this.picks.slice(h)], this.seed, this.simOpts());
    const from = Math.max(0, k.tick - 170);
    while (r.tick < from && !r.over) {
      r.step();
      if (r.paused) this.autoSurge(r);
    }
    this.sim = r;
    this.scene.setFighters(r);
    this.hud.setup(r, TEAM_HEX);
    this.replaying = true;
    this.acc = 0;
    this.endT = -1;
    this.juice.slowmoT = 0;
    this.juice.hitstop = 0;
    document.body.classList.add('replaying');
    this.sfx.replay();
    this.sfx.mood('off');
  }

  endReplay() {
    if (!this.replaying) return;
    // finish the re-run instantly so the results show the true final state
    while (!this.sim.over) {
      this.sim.step();
      if (this.sim.paused) this.autoSurge(this.sim);
    }
    this.replaying = false;
    document.body.classList.remove('replaying');
    this.scene.focus = null;
    this.juice.slowmoT = 0;
    this.cutT = 0;
    this.cutscene.stop();
    this.endT = 0.4;
  }

  /** Leave the current match (any screen change): close the draft, buff panel and timers. */
  private leaveMatch() {
    const hadFight = this.started || this.endT >= 0 || this.replaying;
    this.started = false;
    this.drafting = false;
    this.draft?.cancel();
    this.hideBuffs();
    this.paused = false;
    this.replaying = false;
    this.introT = 0;
    this.intro?.stop();
    this.cutT = 0;
    this.cutscene?.stop();
    this.pending = [];
    this.endT = -1;
    this.sfx.stopAll();
    this.juice.hitstop = 0;
    this.juice.slowmoT = 0;
    this.juice.trauma = 0;
    document.body.classList.remove('royale', 'replaying', 'drafting');
    if (hadFight) {
      this.sim = new Sim([[ROSTER[7]], [ROSTER[16]]], 1);
      this.scene.setArena(DEFAULT_ARENA);
      this.scene.setFighters(this.sim);
      this.hud.setup(this.sim, TEAM_HEX);
    }
  }

  showSelect() {
    this.leaveMatch();
    this.spec = { kind: 'cpu', gacha: this.select.gacha && this.select.mode !== 'tourney', control: this.select.gacha && this.select.mode !== 'tourney' ? ['human', 'cpu'] : ['cpu', 'cpu'] };
    this.started = false;
    this.match = null;
    this.introT = 0;
    this.intro?.stop();
    this.replaying = false;
    document.body.classList.remove('replaying');
    document.body.classList.add('selecting');
    this.sfx.stopAll();
    this.sfx.mood('menu');
    this.cutscene?.stop();
    renderSelect(this.panel, this.select, (r) => this.go(r), (m) => {
      this.mode = m;
      try { localStorage.setItem('mode', m); } catch {}
    });
  }

  private go(r: SelectResult) {
    if (r.mode === 'menu') return this.showMenu();
    if (r.mode === 'tourney') {
      const ids = r.entrants.map((d) => d.id);
      const entries: Entry[] = r.format === 'tag' ? ids.flatMap((_, i) => (i % 2 ? [] : [[ids[i], ids[i + 1]]])) : ids.map((id) => [id]);
      this.startTourney(entries, r.format);
      return;
    }
    this.tourney = null;
    this.picks = r.picks;
    this.spec = r.gacha
      ? { kind: 'cpu', gacha: true, control: ['human', 'cpu'], names: ['You', 'CPU'], arena: r.arena }
      : { ...CLASSIC, arena: r.arena };
    // a ?seed= link replays that exact fight once; after that every fight is fresh
    this.start(this.urlSeed ?? this.randomSeed());
    this.urlSeed = null;
  }

  // ---------------- title screen ----------------
  /** the landing poster; a tap unlocks audio and opens the main menu */
  showTitle() {
    this.leaveMatch();
    this.panel.classList.remove('show', 'wide');
    document.body.classList.add('selecting', 'titled');
    this.title.show(document.body.classList.contains('portrait'), () => {
      this.sfx.init();
      this.sfx.jingle('intro');
      document.body.classList.remove('titled');
      this.showMenu();
    });
  }

  // ---------------- main menu ----------------
  get cardDetails() { return this.select.detailed; }
  set cardDetails(detailed: boolean) { this.select.detailed = detailed; }

  showMenu() {
    this.leaveMatch();
    this.tourney = null;
    this.match = null;
    this.spec = CLASSIC;
    this.pvpEnd();
    document.body.classList.remove('replaying', 'pvp');
    document.body.classList.add('selecting');
    this.sfx.mood('menu');
    renderMenu(this.panel, loadProfile(), loadProgress(), (where) => {
      if (where === 'cpu') this.showSelect();
      else if (where === 'pvp') this.showPvp();
      else if (where === 'heroes') renderHeroLibrary(this.panel, this.select.detailed, () => {
        this.showMenu();
        this.panel.querySelector<HTMLButtonElement>('.m-heroes')?.focus();
      });
      else this.showStory();
    });
  }

  /** "Fighters" button / F key: back to the screen this match came from */
  backToSetup() {
    if (this.spec.kind === 'story' && this.level) return this.showLevel(this.level.id);
    if (this.spec.kind === 'pvp') return; // leave a PvP match from its results card
    if (this.tourney) return this.showBracket();
    this.showSelect();
  }

  // ---------------- PvP ----------------
  private pvp: { view: PvpView; abort: AbortController | null; session: PvpSession | null; picks: FighterDef[]; ready: boolean; oppReady: boolean; oppPicks: string[] | null; inMatch: boolean; preview: HeroPreview; pickListen?: AbortController } = {
    view: { mode: 'classic1', playerName: '', profile: loadProfile(), status: '', code: '', busy: false, error: '' },
    abort: null, session: null, picks: [], ready: false, oppReady: false, oppPicks: null, inMatch: false,
    preview: { skill: 'passive', detailed: false },
  };

  private roomLink: RoomClient | null = null;
  private roomRun: RoomRun | null = null;
  private roomRound = 0;

  get synchronizedPvp() { return !!this.roomLink; }

  showPvp(error = '') {
    this.leaveMatch();
    this.spec = CLASSIC;
    document.body.classList.add('selecting');
    document.body.classList.remove('pvp');
    this.sfx.mood('menu');
    const P = this.pvp;
    try { const m = localStorage.getItem('pvpMode') as PvpMode | null; if (m && m in PVP_MODES && !P.view.busy) P.view.mode = m; } catch {}
    try { P.view.playerName = localStorage.getItem(DISPLAY_NAME_KEY) ?? ''; } catch {}
    if (!roomService && PVP_MODES[P.view.mode].royale) P.view.mode = 'classic1';
    P.view.profile = loadProfile();
    if (error) P.view.error = error;
    const draw = () => renderPvp(this.panel, P.view, (a, v) => void this.pvpAct(a, v, draw), !!roomService);
    draw();
    if (!error && roomService && !P.view.busy && !this.roomLink && savedRoom()) void this.pvpAct('resume', undefined, draw);
  }

  private async pvpAct(a: string, v: string | undefined, draw: () => void) {
    const P = this.pvp, V = P.view;
    switch (a) {
      case 'playername': {
        V.playerName = v ?? '';
        const name = normalizeDisplayName(V.playerName);
        try {
          if (name) localStorage.setItem(DISPLAY_NAME_KEY, name);
          else localStorage.removeItem(DISPLAY_NAME_KEY);
        } catch {}
        return;
      }
      case 'back':
        this.pvpEnd();
        return this.showMenu();
      case 'mode':
        V.mode = v as PvpMode;
        try { localStorage.setItem('pvpMode', V.mode); } catch {}
        V.error = '';
        return draw();
      case 'cancel':
        this.pvpEnd();
        return draw();
      case 'copycode':
        try { await navigator.clipboard.writeText(V.code); } catch {}
        return;
      case 'quick':
      case 'host':
      case 'join':
      case 'resume': {
        if (V.busy || (a === 'quick' && PVP_MODES[V.mode].royale)) return;
        const displayName = normalizeDisplayName(V.playerName);
        if (a !== 'resume' && !displayName) {
          V.error = 'Enter a valid display name (1–24 characters).';
          draw();
          this.panel.querySelector<HTMLInputElement>('#playername')?.focus();
          return;
        }
        if (displayName) V.playerName = displayName;
        const code = (v ?? '').trim().toUpperCase();
        if (a === 'join' && !/^[A-Z0-9]{5}$/.test(code)) {
          V.error = 'Lobby codes are 5 characters.';
          return draw();
        }

        const attempt = new AbortController();
        P.abort = attempt;
        const active = () => P.abort === attempt && !attempt.signal.aborted;
        const status = (message: string) => {
          if (!active()) return;
          V.status = message;
          draw();
        };
        V.error = '';
        V.busy = true;
        const mmr = loadProfile().mmr;
        const mode = V.mode;
        try {
          if (roomService) {
            const destination = a === 'resume' ? savedRoom() : {
              mode, mmr, displayName: displayName ?? undefined,
              code: a === 'join' ? code : undefined,
              tier: a === 'quick' ? tierOf(mmr) : undefined,
            };
            if (!destination) throw new Error('No previous lobby to resume.');
            status(a === 'resume' ? 'Reconnecting to your lobby…' : 'Connecting…');
            const room = await RoomClient.open(destination, attempt.signal, status);
            if (!active()) return room.close();
            P.abort = null;
            V.status = '';
            this.roomLink = room;
            room.onState = (view) => this.applyRoom(view, draw);
            room.onStatus = (notice) => {
              if (this.roomLink !== room) return;
              if (notice) this.hud.callout(notice, '#ffb02e');
              if (room.view.phase === 'waiting') {
                V.status = notice;
                if (PVP_MODES[room.view.mode].royale) this.showRoyaleLobby(room, room.view);
                else {
                  V.status ||= 'Share the code. Waiting for your opponent…';
                  draw();
                }
              }
              if (notice.startsWith('Could not reconnect') || notice.startsWith('This lobby was opened')) {
                room.close(false);
                this.roomLink = null;
                this.roomRun = null;
                this.roomRound = 0;
                V.busy = false;
                V.code = '';
                V.status = '';
                this.showPvp(notice);
              }
            };
            this.applyRoom(room.view, draw);
            return;
          }
          let session: PvpSession;
          if (a === 'quick') {
            status('Connecting…');
            session = await PvpSession.quickMatch(mode, mmr, tierOf(mmr), attempt.signal, status, displayName ?? undefined);
          } else if (a === 'host') {
            status('Creating a lobby…');
            const lobby = await PvpSession.createLobby(mode, mmr, attempt.signal, displayName ?? undefined);
            if (active()) {
              V.code = lobby.code;
              status('Share the code. Waiting for your opponent…');
            }
            session = await lobby.ready;
          } else {
            status(`Joining ${code}…`);
            session = await PvpSession.joinLobby(code, mode, mmr, attempt.signal, displayName ?? undefined);
          }
          if (!active()) return session.close();
          P.abort = null;
          this.pvpConnected(session);
        } catch (error) {
          if (!active()) return;
          P.abort = null;
          V.busy = false;
          V.status = '';
          V.code = '';
          const message = (error as Error)?.message;
          V.error = message && !/^(timeout|unavailable)$/.test(message) ? message : "Couldn't connect. Check your internet connection and try again.";
          draw();
        }
        return;
      }
    }
  }

  private applyRoom(view: RoomView, drawLobby: () => void) {
    const room = this.roomLink;
    if (!room) return;
    const P = this.pvp;
    if (view.phase === 'closed') {
      room.close(false);
      this.roomLink = null;
      this.roomRun = null;
      this.roomRound = 0;
      P.view.busy = false;
      P.view.code = '';
      P.view.status = '';
      this.showPvp('The lobby closed.');
      return;
    }
    if (view.phase === 'waiting') {
      if (PVP_MODES[view.mode].royale) {
        if (this.roomRound !== view.match) {
          this.roomRound = view.match;
          this.roomRun = null;
          this.leaveMatch();
          P.picks = [];
          P.preview = { skill: 'passive', detailed: this.cardDetails };
        }
        this.showRoyaleLobby(room, view);
        return;
      }
      P.view.busy = true;
      P.view.code = room.code;
      P.view.status = 'Share the code. Waiting for your opponent…';
      drawLobby();
      return;
    }
    P.view.busy = false;
    P.view.code = '';
    P.view.status = '';
    if (this.roomRound !== view.match) {
      this.roomRound = view.match;
      this.roomRun = null;
      this.leaveMatch();
      P.picks = [];
      P.preview = { skill: 'passive', detailed: this.cardDetails };
      P.ready = false;
    }
    if (view.phase === 'picks') {
      const need = PVP_MODES[view.mode].tag ? 2 : 1;
      const rival = (1 - view.team) as Team;
      const locked = view.ready[view.team];
      if (locked) {
        P.picks = view.mine.map((id) => byId(id)!);
        P.preview.fighter ??= P.picks[0];
      }
      document.body.classList.add('selecting');
      document.body.classList.remove('pvp', 'drafting');
      const render = () => renderPvpPick(this.panel, {
        mode: view.mode, need, picks: P.picks, ready: locked, oppReady: view.ready[rival],
        myName: view.playerNames[view.team], oppName: view.playerNames[rival], preview: P.preview,
      }, (action, id) => {
        if (action === 'leave') return this.pvpLeave();
        if (action === 'unlock' && locked) return room.unlock();
        if (locked) return;
        if (action === 'pick' && id) {
          const job = byId(id)!;
          P.preview.fighter = job;
          P.picks = P.picks.includes(job) ? P.picks.filter((pick) => pick !== job) : [...P.picks, job].slice(-need);
          render();
        } else if (action === 'ready' && P.picks.length === need) {
          room.send({ t: 'lock', match: view.match, ids: P.picks.map((job) => job.id) });
        }
      });
      render();
      return;
    }

    if (!view.lineups) return;
    const run = this.roomRun ??= { match: view.match, draft: -1, report: '', repair: '', blocked: false, shownResult: false, fightBuilt: false };
    if (view.phase === 'draft' && view.pick === 0 && !run.fightBuilt) {
      this.panel.classList.remove('show', 'wide');
      document.body.classList.remove('selecting');
      document.body.classList.add('pvp', 'drafting');
      this.scene.setArena(view.arena);
      this.showRoomDraft(room, view, run);
      return;
    }
    if (!run.fightBuilt) {
      const royale = !!PVP_MODES[view.mode].royale;
      this.sfx.init();
      if (!royale) this.picks = view.lineups.flat().map((id) => byId(id)!);
      this.tourney = null;
      this.match = null;
      this.spec = {
        kind: 'pvp', arena: view.arena, gacha: PVP_MODES[view.mode].gacha,
        control: ['remote', 'remote'], names: view.playerNames, localSide: view.team,
        resultActions: royale ? ROYALE_RESULTS : ROOM_RESULTS,
      };
      this.draftLog = view.log;
      this.started = true;
      this.newFight(view.seed, royale ? roomSimulation(view) : undefined);
      document.body.classList.add('pvp');
      run.fightBuilt = true;
    }
    this.draftLog = view.log;
    if (view.phase !== 'draft') {
      this.draft.cancel();
      document.body.classList.remove('drafting');
    }
    if (view.phase === 'result' && view.result) {
      if (!run.shownResult) this.showRoomResult(view, run);
      this.updateRematchVotes(view, run);
      return;
    }
    if (view.repair && run.repair !== view.repair.hash) {
      run.repair = view.repair.hash;
      const repaired = roomSimulation(view);
      const draft = SURGE_TICKS.indexOf(view.repair.tick) + 1;
      const log = draft ? view.log.filter((pick) => pick.pick < draft) : view.log;
      stepRoom(repaired, log, view.repair.tick);
      if (roomCheckpoint(repaired) === view.repair.hash) {
        this.sim = repaired;
        this.scene.setFighters(repaired);
        this.hud.setup(repaired, TEAM_HEX, view.team, view.playerNames);
        this.hud.callout('Fight resynchronized');
      } else {
        run.blocked = true;
        this.hud.callout('Simulation differs. Waiting for the room result.', '#ffb02e');
      }
    }
    if (view.phase === 'draft') this.showRoomDraft(room, view, run);
  }

  private showRoyaleLobby(room: RoomClient, view: RoomView) {
    const P = this.pvp;
    P.view.busy = true;
    P.view.code = room.code;
    document.body.classList.add('selecting');
    document.body.classList.remove('pvp', 'drafting', 'royale');
    if (view.mine[0]) {
      P.picks = [byId(view.mine[0])!];
      P.preview.fighter ??= P.picks[0];
    }
    const draw = () => renderRoyaleLobby(this.panel, view, room.code, P.picks[0], P.view.status, P.preview, (action, id) => {
      if (action === 'leave') return this.pvpLeave();
      if (action === 'copycode') {
        void navigator.clipboard.writeText(room.code).catch(() => {});
      } else if (action === 'pick' && id && !view.ready[view.team]) {
        const fighter = byId(id);
        if (fighter) { P.picks = [fighter]; P.preview.fighter = fighter; draw(); }
      } else if (action === 'ready' && P.picks[0]) {
        room.send({ t: 'lock', match: view.match, ids: [P.picks[0].id] });
      } else if (action === 'unlock') {
        room.unlock();
      } else if (action === 'start') {
        room.send({ t: 'start', match: view.match });
      }
    });
    draw();
  }

  private showRoomDraft(room: RoomClient, view: RoomView, run: RoomRun) {
    if (run.draft === view.pick) return;
    run.draft = view.pick;
    this.hideBuffs();
    if (view.eligible && !view.eligible.includes(view.team)) {
      this.hud.callout('SURVIVORS ARE DRAFTING');
      return;
    }
    if (view.chosen) {
      document.body.classList.remove('drafting');
      this.hud.callout('WAITING FOR OTHER PICKS');
      return;
    }
    document.body.classList.add('drafting');
    const team = view.team;
    const fighters = view.lineups![team].map((id) => byId(id)!);
    const owned = (side: BattleSide) => view.log.filter((p) => p.team === side).map((p) => p.id);
    let reroll = view.rerolls;
    const offers = () => offersFor(view.seed, team, view.pick, reroll, fighters, owned(team));
    void this.draft.pick({
      title: view.pick === 0 ? 'Choose your first card' : `Card pick ${view.pick + 1}`,
      subtitle: PVP_MODES[view.mode].royale ? 'The fight resumes when all survivors are ready.' : 'Both players resume together after the draft.',
      offers: offers(), rerollsLeft: GACHA.rerolls - reroll,
      timer: Math.max(1, Math.ceil((view.at - room.clock()) / 1000)), serverDeadline: true,
      detailed: this.select.detailed, team: fighters, owned: owned(team),
      rivalOwned: PVP_MODES[view.mode].royale ? [] : owned((1 - team) as Team),
      rivalName: PVP_MODES[view.mode].royale ? '' : view.playerNames[1 - team],
    }, () => {
      reroll++;
      room.send({ t: 'reroll', match: view.match, pick: view.pick, reroll });
      return offers();
    }).then((card) => {
      if (this.roomLink === room && room.view.match === view.match && room.view.phase === 'draft' && room.view.pick === view.pick) {
        room.send({ t: 'card', match: view.match, pick: view.pick, reroll, id: card.id });
        if (PVP_MODES[view.mode].royale) {
          document.body.classList.remove('drafting');
          this.hud.callout('WAITING FOR OTHER PICKS');
        }
      }
    });
  }

  private showRoomResult(view: RoomView, run: RoomRun) {
    const result = view.result!;
    run.shownResult = true;
    this.introT = 0;
    this.intro.stop();
    this.sfx.mood('off');
    if (this.sim.tick !== result.tick || roomCheckpoint(this.sim) !== result.hash) {
      this.sim = roomSimulation(view);
      stepRoom(this.sim, view.log, result.tick);
      this.scene.setFighters(this.sim);
      this.hud.setup(this.sim, TEAM_HEX, this.spec.localSide, this.spec.kind === 'pvp' ? this.spec.names : undefined);
    }
    const confirmed = this.sim.over && roomCheckpoint(this.sim) === result.hash;
    const royale = !!PVP_MODES[view.mode].royale;
    const actions = royale ? ROYALE_RESULTS : ROOM_RESULTS;
    if (confirmed) {
      renderResults(this.panel, this.sim, TEAM_HEX, { actions, names: this.spec.names, localSide: view.team });
    } else {
      const label = result.winner === -1 ? 'Draw' : result.winner === view.team ? 'You won' : `${view.playerNames[result.winner]} won`;
      this.panel.onclick = null;
      this.panel.classList.remove('wide');
      this.panel.innerHTML = `<div class="card"><h1></h1><p>Result confirmed by the room.</p><div class="actions">${actions}</div></div>`;
      this.panel.querySelector('h1')!.textContent = label;
      this.panel.classList.add('show');
    }
    if (royale) return; // invite-only free-for-all is unranked
    const key = `jobwars-room-result-${this.roomLink?.code}-${view.seed}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}
    const score = result.winner === view.team ? 1 : result.winner === -1 ? 0.5 : 0;
    const delta = recordResult(view.rivalMmr, score, view.mode);
    this.hud.callout(`${delta >= 0 ? '+' : ''}${delta} MMR`, delta >= 0 ? '#6dff9a' : '#ff5a46');
  }

  private updateRematchVotes(view: RoomView, run: RoomRun) {
    const actions = this.panel.querySelector('.actions')!;
    const button = actions.querySelector<HTMLButtonElement>('[data-act="pvprematch"]')!;
    let votes = this.panel.querySelector<HTMLElement>('.rematch-votes');
    if (!votes) {
      votes = document.createElement('section');
      votes.className = 'rematch-votes';
      votes.setAttribute('aria-label', 'Rematch votes');
      votes.innerHTML = '<div class="rematch-summary" role="status"></div><ul></ul>';
      actions.before(votes);
    }
    const seats = view.playerNames.flatMap((name, i) => !view.occupied || view.occupied[i] ? [{
      name: i === view.team ? `${name} (you)` : name,
      ready: !!view.rematch[i],
      label: view.rematch[i] ? 'Voted' : view.present[i] ? 'Waiting' : 'Reconnecting',
    }] : []);
    const voted = !!view.rematch[view.team];
    const minimum = view.occupied ? 3 : 2;
    const enough = seats.length >= minimum;
    if (voted || !enough) run.rematchPending = false;
    const count = seats.filter((seat) => seat.ready).length;
    const summary = votes.querySelector('.rematch-summary')!;
    const message = enough ? `Rematch votes · ${count}/${seats.length}` : `Rematch requires at least ${minimum} players`;
    if (summary.textContent !== message) summary.textContent = message;
    const list = votes.querySelector('ul')!;
    list.replaceChildren(...seats.map(({ name, ready, label }) => {
      const item = document.createElement('li');
      const player = document.createElement('span');
      const status = document.createElement('strong');
      player.textContent = name;
      status.textContent = label;
      item.classList.toggle('voted', ready);
      item.append(player, status);
      return item;
    }));
    button.disabled = !enough || voted || !!run.rematchPending;
    button.textContent = voted ? 'Voted' : run.rematchPending ? 'Sending vote…' : 'Vote for rematch';
  }

  private tickRoom(room: RoomClient, run: RoomRun) {
    const view = room.view;
    if (!run.fightBuilt || run.shownResult || run.blocked || !this.started) return 0;
    const current = room.clock();
    if (view.phase === 'fight' && current < view.at) return 0;
    if (this.introT > 0) {
      if (view.phase === 'fight') {
        this.introT = 0;
        this.beginFight();
      } else this.intro.stop();
    }
    const target = view.phase === 'draft' ? view.tick : targetTick(view, current);
    const before = this.sim.tick;
    const catchUp = target - before > 12;
    stepRoom(this.sim, view.log, Math.min(target, before + 480), (events) => {
      if (!catchUp) this.handle(events);
      else if (this.sim.opts.royale && target - this.sim.tick <= 3 / DT) {
        for (const event of events) if (event.type === 'ko') this.showElimination(event);
      }
    });
    if (this.sim.over || this.sim.paused) {
      const id = `${this.sim.tick}:${this.sim.over}`;
      if (run.report !== id) {
        run.report = id;
        room.send({
          t: 'report', match: view.match, tick: this.sim.tick, hash: roomCheckpoint(this.sim),
          winner: this.sim.over ? this.sim.winner ?? -1 : undefined,
        });
      }
    }
    return (this.sim.tick - before) * DT;
  }

  private pvpConnected(sess: PvpSession) {
    const P = this.pvp;
    P.session = sess;
    P.view.busy = false;
    P.view.status = '';
    P.view.code = '';
    sess.onClose = () => {
      if (P.session !== sess) return;
      P.session = null;
      P.pickListen?.abort();
      if (P.inMatch && this.started && !this.sim.over) this.hud.callout('OPPONENT LEFT', '#ffb02e');
      else this.showPvp('Your opponent left.');
    };
    this.sfx.jingle('intro');
    this.pvpPickScreen();
  }

  /** each player picks their own fighter(s); the host starts the match once both lock in */
  private pvpPickScreen() {
    const P = this.pvp, sess = P.session;
    if (!sess) return this.showPvp();
    this.leaveMatch();
    P.inMatch = false;
    P.picks = [];
    P.preview = { skill: 'passive', detailed: this.cardDetails };
    P.ready = false;
    P.oppReady = false;
    P.oppPicks = null;
    P.pickListen?.abort();
    const listener = P.pickListen = new AbortController();
    document.body.classList.add('selecting');
    const need = PVP_MODES[sess.mode].tag ? 2 : 1;
    const draw = () => renderPvpPick(this.panel, {
      need, picks: P.picks, oppReady: P.oppReady, ready: P.ready, mode: sess.mode,
      myName: sess.playerName, oppName: sess.oppName, preview: P.preview,
    }, (action, id) => {
      if (action === 'leave') return this.pvpLeave();
      if (action === 'pick' && id && !P.ready) {
        const fighter = byId(id)!;
        P.preview.fighter = fighter;
        P.picks = P.picks.includes(fighter) ? P.picks.filter((pick) => pick !== fighter) : [...P.picks, fighter].slice(-need);
      } else if (action === 'ready' && !P.ready && P.picks.length === need) {
        P.ready = true;
        sess.send({ t: 'picks', ids: P.picks.map((d) => d.id) });
      } else if (action === 'unlock' && P.ready) {
        P.ready = false;
        sess.send({ t: 'unlock' });
      }
      draw();
      maybeStart();
    });
    const start = (seed: number, lineups: [string[], string[]]) => {
      const me = sess.host ? 0 : 1;
      P.picks = lineups[me].map((id) => byId(id)!);
      P.oppPicks = lineups[1 - me];
      P.inMatch = true;
      listener.abort();
      this.pvpBegin(seed);
    };
    const maybeStart = () => {
      if (!sess.host || !P.ready || !P.oppPicks || P.inMatch) return;
      const seed = this.randomSeed();
      const lineups: [string[], string[]] = [P.picks.map((d) => d.id), P.oppPicks];
      sess.send({ t: 'start', seed, lineups });
      start(seed, lineups);
    };
    const listen = async () => {
      while (P.session === sess && !listener.signal.aborted) {
        const message = await sess.wait((m): m is Extract<Msg, { t: 'picks' | 'unlock' | 'start' }> =>
          m.t === 'picks' || m.t === 'unlock' || (!sess.host && m.t === 'start'), 0, listener.signal);
        if (P.session !== sess || listener.signal.aborted) return;
        if (message.t === 'start') return start(message.seed, message.lineups);
        P.oppPicks = message.t === 'picks' ? message.ids : null;
        P.oppReady = !!P.oppPicks;
        draw();
        maybeStart();
      }
    };
    void listen().catch(() => {
      if (!listener.signal.aborted && P.session === sess) this.pvpLeave();
    });
    draw();
  }

  private pvpBegin(seed: number) {
    const P = this.pvp, sess = P.session!;
    const mine = P.picks, theirs = P.oppPicks!.map((id) => byId(id)!);
    const me: Team = sess.host ? 0 : 1;
    this.tourney = null;
    this.picks = me === 0 ? [...mine, ...theirs] : [...theirs, ...mine];
    const closed = new Promise<void>((res) => { const old = sess.onClose; sess.onClose = () => { old?.(); res(); }; });
    this.spec = {
      kind: 'pvp',
      arena: 'auto',
      gacha: PVP_MODES[sess.mode].gacha,
      control: me === 0 ? ['human', 'remote'] : ['remote', 'human'],
      names: sess.playerNames,
      localSide: me,
      remote: {
        // the rival's pick arrives over the network; if they drop, the CPU picks for them
        pick: (t, n, offers) => Promise.race([
          sess.wait((m): m is Extract<Msg, { t: 'card' }> => m.t === 'card' && m.team === t && m.pick === n &&
            offers(m.reroll).some((card) => card.id === m.id)).then((m) => m.id),
          closed.then(() => cpuPick(seed, t, n, offers(0))?.id ?? ''),
        ]),
        send: (t, n, reroll, id) => sess.send({ t: 'card', team: t, pick: n, reroll, id }),
      },
      onEnd: (sim) => void this.pvpFinish(sim, me),
      resultActions: '<button class="primary" data-act="pvprematch">Rematch</button><button data-act="share">Share this fight</button><button data-act="pvpleave">Leave</button>',
    };
    document.body.classList.add('pvp');
    this.start(seed);
  }

  /** compare results with the rival (desync check), then update MMR */
  private async pvpFinish(sim: Sim, me: Team) {
    const sess = this.pvp.session;
    const hash = `${sim.winner}:${sim.tick}:${sim.fighters.map((f) => Math.round(f.hp)).join(',')}`;
    let winner = sim.winner;
    let note = '';
    if (sess) {
      sess.send({ t: 'result', winner: sim.winner === 0 || sim.winner === 1 ? sim.winner : -1, hash });
      const theirs = await sess.wait((m): m is Extract<Msg, { t: 'result' }> => m.t === 'result', 6000).catch(() => null);
      if (theirs && theirs.hash !== hash) {
        // should never happen (deterministic sim); the host's result is the official one
        if (!sess.host) winner = theirs.winner as Team | -1;
        note = 'Results differed between your machines; the host’s result counts.';
      }
    }
    const score = winner === me ? 1 : winner === -1 ? 0.5 : 0;
    const d = sess ? recordResult(sess.oppMmr, score as 0 | 0.5 | 1, sess.mode) : 0;
    this.hud.callout(`${d >= 0 ? '+' : ''}${d} MMR`, d >= 0 ? '#6dff9a' : '#ff5a46');
    if (note) console.warn(note);
  }

  pvpRematch() {
    if (this.roomLink) {
      const room = this.roomLink;
      const run = this.roomRun;
      const view = room.view;
      const button = this.panel.querySelector<HTMLButtonElement>('[data-act="pvprematch"]');
      if (!run || view.phase !== 'result' || !button || button.disabled) return;
      run.rematchPending = true;
      this.updateRematchVotes(view, run);
      room.send({ t: 'rematch', match: view.match });
      return;
    }
    const sess = this.pvp.session;
    if (!sess) return this.showPvp('Your opponent left.');
    sess.send({ t: 'rematch' });
    this.panel.innerHTML = '<div class="card"><h1>Rematch?</h1><p>Waiting for your opponent…</p><div class="actions"><button data-act="pvpleave">Leave</button></div></div>';
    void sess.wait((m): m is Extract<Msg, { t: 'rematch' }> => m.t === 'rematch').then(() => this.pvp.session === sess && this.pvpPickScreen());
  }

  pvpLeave() {
    this.pvpEnd();
    this.showPvp();
  }

  /** drop any search or connection */
  private pvpEnd() {
    this.roomLink?.close();
    this.roomLink = null;
    this.roomRun = null;
    this.roomRound = 0;
    document.body.classList.remove('drafting');
    const P = this.pvp;
    if (P.abort && roomService) clearSavedRoom();
    P.abort?.abort();
    P.abort = null;
    P.view.busy = false;
    P.view.status = '';
    P.view.code = '';
    P.pickListen?.abort();
    P.pickListen = undefined;
    const s = P.session;
    P.session = null;
    P.inMatch = false;
    s?.close();
  }

  // ---------------- Story ----------------
  private level: Level | null = null;
  private storyChapter = 1;
  private storyPicks: FighterDef[] = [];

  showStory(chapter?: number) {
    this.leaveMatch();
    this.spec = CLASSIC;
    this.tourney = null;
    document.body.classList.add('selecting');
    this.sfx.mood('menu');
    const p = loadProgress();
    if (chapter) this.storyChapter = chapter;
    else {
      // open on the chapter you're up to
      const next = LEVELS.find((l) => isOpen(p, l.id) && !(p.stars[l.id] > 0)) ?? LEVELS[LEVELS.length - 1];
      this.storyChapter = next.chapter;
    }
    renderStoryMap(this.panel, p, this.storyChapter, (a, v) => {
      if (a === 'back') return this.showMenu();
      if (a === 'chapter') return this.showStory(Number(v));
      if (a === 'level' && v) this.showLevel(v);
    });
  }

  showLevel(id: string) {
    this.leaveMatch();
    this.spec = CLASSIC;
    document.body.classList.add('selecting');
    const l = LEVELS.find((x) => x.id === id)!;
    const p = loadProgress();
    this.level = l;
    const need = l.yours;
    this.storyPicks = this.storyPicks.filter((d) => p.unlocked.includes(d.id)).slice(0, need);
    const draw = () => renderLevel(this.panel, l, p, this.storyPicks, this.select.detailed, (a, v) => {
      if (a === 'map') return this.showStory(l.chapter);
      if (a === 'pick' && v) {
        const d = byId(v)!;
        this.storyPicks = this.storyPicks.includes(d) ? this.storyPicks.filter((x) => x !== d) : [...this.storyPicks, d].slice(-need);
        return draw();
      }
      if (a === 'play') this.startLevel(l);
    });
    draw();
  }

  private startLevel(l: Level) {
    const mine = [...this.storyPicks, ...(l.partner ? [byId(l.partner)!] : [])];
    const enemies = l.enemies.map((id) => byId(id)!);
    // a 1-vs-2 handicap is fought as a 2v2 with your side's second slot empty: use the sim's teams directly
    this.picks = [...mine, ...enemies];
    this.tourney = null;
    const o = l.opts ?? {};
    const extra: Partial<SimOpts> = {};
    for (const k of ['teamHpMul', 'timeLimit', 'hpMul', 'startHpPct', 'surgeEvery'] as const) if (o[k] !== undefined) (extra as Record<string, unknown>)[k] = o[k];
    if (l.classic && !extra.timeLimit) extra.timeLimit = 99;
    let outcome = { won: false, stars: 0, reason: '' };
    let recruits: FighterDef[] = [];
    this.spec = {
      kind: 'story',
      arena: storyArena(l),
      blue: mine.length,
      gacha: !l.classic,
      control: ['human', 'cpu'],
      names: ['You', enemies.map((d) => d.displayName).join(' & ')],
      startCards: [o.myCards ?? [], o.enemyCards ?? []],
      extra,
      onEnd: (sim) => {
        outcome = judge(l, sim);
        const p = loadProgress();
        const before = new Set(p.unlocked);
        if (outcome.won) {
          p.stars[l.id] = Math.max(p.stars[l.id] ?? 0, outcome.stars);
          p.best[l.id] = Math.min(p.best[l.id] ?? Infinity, Math.round(sim.t));
          for (const id of l.unlocks) if (!p.unlocked.includes(id)) p.unlocked.push(id);
          saveProgress(p);
        }
        recruits = l.unlocks.filter((id) => !before.has(id) && p.unlocked.includes(id)).map((id) => byId(id)!);
        this.hud.callout(outcome.won ? 'CLEARED!' : 'DEFEAT', outcome.won ? '#6dff9a' : '#ff5a46');
      },
      result: () => {
        const i = LEVELS.indexOf(l);
        return storyResultHtml(l, outcome.won, outcome.stars, loadProgress().stars[l.id] ?? 0, outcome.reason, recruits, i < LEVELS.length - 1);
      },
    };
    this.start(this.randomSeed());
  }

  storyNext() {
    const i = LEVELS.indexOf(this.level!);
    const next = LEVELS[i + 1];
    if (next) this.showLevel(next.id);
    else this.showStory();
  }

  storyRetry() {
    if (this.level) this.startLevel(this.level);
  }

  // ---------------- tournament ----------------
  startTourney(entries: Entry[], format: Format) {
    const shuffled = entries.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.tEntries = entries;
    this.tourney = createTournament(shuffled, format, this.randomSeed());
    this.showBracket();
  }

  showBracket() {
    const t = this.tourney;
    if (!t) return this.showSelect();
    this.leaveMatch();
    this.spec = { kind: 'tourney', gacha: false, control: ['cpu', 'cpu'] };
    this.started = false;
    this.match = null;
    this.paused = false;
    this.introT = 0;
    this.intro?.stop();
    this.replaying = false;
    document.body.classList.remove('replaying');
    this.sfx.mood('menu');
    document.body.classList.add('selecting');
    this.sfx.stopAll();
    this.cutscene?.stop();
    const def = (id: string) => byId(id)!;
    const skipWhile = (keep: (r: number) => boolean) => {
      for (let n = nextMatch(t); n && keep(n.r); n = nextMatch(t)) {
        const sim = simulate(n.m, def);
        report(t, n.r, n.i, decide(sim), describe(sim));
      }
      this.showBracket();
    };
    if (champion(t) && this.champSounded !== t) {
      this.champSounded = t;
      this.sfx.jingle('champion');
    }
    renderBracket(this.panel, t, def, {
      watch: () => {
        const n = nextMatch(t);
        if (!n) return;
        this.picks = [...n.m.a!, ...n.m.b!].map(def);
        this.match = { r: n.r, i: n.i, seed: n.m.seed };
        this.start(n.m.seed);
      },
      skip: () => {
        const n = nextMatch(t);
        if (n) {
          const sim = simulate(n.m, def);
          report(t, n.r, n.i, decide(sim), describe(sim));
        }
        this.showBracket();
      },
      skipRound: () => {
        const r0 = nextMatch(t)?.r;
        skipWhile((r) => r === r0);
      },
      skipAll: () => skipWhile(() => true),
      quit: () => {
        this.tourney = null;
        this.showSelect();
      },
      again: () => this.startTourney(this.tEntries, t.format),
    });
  }

  /** A watched bracket match ended: write the result in (only the first time, only for its own seed). */
  private reportMatch() {
    const t = this.tourney, m = this.match;
    if (!t || !m || this.sim.seed !== m.seed) return;
    report(t, m.r, m.i, decide(this.sim), describe(this.sim));
  }

  get selecting() {
    return this.panel.classList.contains('wide');
  }

  start(seed = this.seed) {
    this.sfx.init();
    void this.begin(seed);
  }

  /** Classic: straight into the fight. Gacha: the pre-fight pick first. */
  private async begin(seed: number) {
    this.seed = seed;
    this.draftLog = [];
    this.drafting = false;
    if (this.spec.gacha) {
      this.started = false;
      this.panel.classList.remove('show', 'wide');
      document.body.classList.remove('selecting');
      document.body.classList.add('drafting');
      this.sfx.mood('menu');
      const spec = this.spec;
      const ok = await this.draftRound(0);
      document.body.classList.remove('drafting');
      if (!ok || spec !== this.spec) return; // left during the draft
    }
    this.started = true;
    this.newFight(seed);
  }

  /** Sim options for the current match (Gacha settings, Story twists, starting cards). */
  private simOpts(): SimOpts {
    const pre = (t: Team) => [...(this.spec.startCards?.[t] ?? []), ...this.draftLog.filter((p) => p.team === t && p.pick === 0).map((p) => p.id)];
    const base: SimOpts = this.spec.gacha ? gachaOpts([pre(0), pre(1)]) : { cards: [pre(0), pre(1)] };
    if (this.spec.sharedDraft?.legacy) Object.assign(base, { hpMul: 4.2, timeLimit: 180, surgeEvery: 20, overtimeAt: 100 });
    return { ...base, ...this.spec.extra };
  }

  /** how many picks are on Blue (the rest are Red) */
  get blueCount() {
    return this.spec.blue ?? this.picks.length / 2;
  }

  private teams(): [FighterDef[], FighterDef[]] {
    const h = this.blueCount;
    return [this.picks.slice(0, h), this.picks.slice(h)];
  }

  /**
   * One Gacha pick for both sides (pick 0 = before the fight). Each side's controller chooses:
   * the draft overlay for you, a seeded random pick for the CPU, the network for a remote player.
   * Resolves false if the match was abandoned meanwhile.
   */
  private async draftRound(pick: number): Promise<boolean> {
    const spec = this.spec;
    const teams = this.teams();
    const owned = (t: Team) => [...(spec.startCards?.[t] ?? []), ...this.draftLog.filter((p) => p.team === t).map((p) => p.id)];
    const choose = async (t: Team): Promise<string> => {
      let reroll = 0;
      const preset = spec.sharedDraft?.log.find((p) => p.team === t && p.pick === pick);
      if (preset) return preset.id;
      const offers = (attempt = reroll) => offersFor(this.seed, t, pick, attempt, teams[t], owned(t));
      const side = spec.control[t];
      if (side === 'cpu') return cpuPick(this.seed, t, pick, offers())?.id ?? '';
      if (side === 'remote') return spec.remote ? spec.remote.pick(t, pick, offers) : '';
      const first = offers();
      if (!first.length) return '';
      const names = spec.names ?? ['You', 'CPU'];
      const card: Card = await this.draft.pick({
        title: pick === 0 ? 'Choose your first card' : `Card pick ${pick + 1}`,
        subtitle: pick === 0 ? `Draft every ${spec.extra?.surgeEvery ?? GACHA.surgeEvery} seconds of combat. Both sides share the round’s rarity.` : `${Math.round(this.sim?.t ?? 0)}s · the fight is paused`,
        offers: first,
        rerollsLeft: GACHA.rerolls - reroll,
        timer: pick === 0 ? 25 : 12,
        detailed: this.select.detailed,
        team: teams[t],
        owned: owned(t),
        rivalOwned: owned((1 - t) as Team),
        rivalName: names[1 - t],
      }, () => {
        reroll++;
        this.sfx.ui('tab');
        return offers();
      });
      this.sfx.ui('go');
      spec.remote?.send(t, pick, reroll, card.id);
      return card.id;
    };
    const ids = await Promise.all(([0, 1] as Team[]).map(choose));
    if (spec !== this.spec) return false;
    ids.forEach((id, t) => id && this.draftLog.push({ team: t as Team, pick, id }));
    return true;
  }

  /** Replays: re-apply a surge's recorded picks without asking anyone. */
  private autoSurge(sim: Sim) {
    for (const p of this.draftLog) if (p.pick === sim.surges) sim.addCard(p.team, p.id);
    sim.resume();
  }

  /** A surge during the live fight: everyone picks, then the cards land and the fight resumes. */
  private async surge() {
    if (this.drafting) return;
    this.drafting = true;
    const sim = this.sim, n = sim.surges;
    this.hud.callout('CARD PICK!', '#a35cff');
    const ok = await this.draftRound(n);
    if (!ok || sim !== this.sim) return;
    for (const p of this.draftLog) if (p.pick === n) sim.addCard(p.team, p.id);
    sim.resume();
    this.drafting = false;
  }

  // ---------------- buff panel ----------------
  toggleBuffs() {
    if (!this.spec.gacha && !this.sim.fighters.some((f) => f.cards.length)) return;
    if (this.buffsEl.classList.contains('show')) return this.hideBuffs();
    if (this.sim.opts.royale && this.roomLink?.view.phase === 'draft' && this.draft.open) return;
    if (this.sim.opts.royale) {
      this.buffsEl.innerHTML = buffPanelHtml(this.sim.fighters.map((f) => this.spec.names?.[f.team] ?? f.def.displayName), this.sim.fighters.map((f) => f.cards), this.select.detailed);
      this.buffsEl.classList.add('show');
      return;
    }
    const cards: [string[], string[]] = [0, 1].map((t) => this.sim.fighters.find((f) => f.team === t)?.cards ?? []) as [string[], string[]];
    const names = this.spec.names ?? [this.teams()[0].map((d) => d.displayName).join(' & '), this.teams()[1].map((d) => d.displayName).join(' & ')];
    this.buffsEl.innerHTML = buffPanelHtml(names as [string, string], cards, this.select.detailed);
    this.buffsEl.classList.add('show');
    this.paused = true;
  }

  hideBuffs() {
    if (!this.buffsEl?.classList.contains('show')) return;
    this.buffsEl.classList.remove('show');
    this.paused = false;
  }

  // ---------------- loop ----------------
  private frame(dt: number) {
    this.juice.update(dt);
    this.sfx.update(dt);
    let simDt = 0;

    const room = this.roomLink;
    if (room && this.roomRun) {
      this.juice.hitstop = Math.max(0, this.juice.hitstop - dt);
      simDt = this.tickRoom(room, this.roomRun);
    } else if (this.introT > 0) {
      // VS splash: hold the fight until it's done
      this.introT -= dt;
      if (this.introT <= 0) this.beginFight();
    } else if (this.cutT > 0) {
      // special-move cutscene: time is frozen
      this.cutT -= dt;
      if (this.cutT <= 0) {
        const rest = this.pending;
        this.pending = [];
        this.handle(rest, true);
      }
    } else {
      const running = this.started && !this.paused && !this.sim.over;
      if (running || (this.started && this.sim.over && this.juice.slowmoT > 0)) {
        if (this.juice.hitstop > 0) {
          this.juice.hitstop -= dt;
        } else if (!this.sim.over) {
          this.acc += dt * (this.replaying ? 0.4 : this.speed) * this.juice.timeScale;
          while (this.acc >= DT && !this.sim.over) {
            this.acc -= DT;
            simDt += DT;
            this.handle(this.sim.step());
            if (this.sim.paused) {
              // gacha surge: replays re-apply the recorded picks; live fights ask each side
              this.acc = 0;
              if (this.replaying) this.autoSurge(this.sim);
              else void this.surge();
              break;
            }
            if (this.juice.hitstop > 0 || this.cutT > 0) break; // freeze right on the impact frame
          }
        }
      }
    }
    if (this.replaying && this.ko && !this.sim.over) {
      // replay camera: close on the fighter who's about to fall
      const v = this.sim.fighters[this.ko.victim];
      this.scene.focus = { x: v.x, y: v.y - 60, zoomMul: 1.3 + Math.min(0.35, (this.sim.tick - (this.ko.tick - 170)) / 400) };
    }
    const frozen = this.juice.hitstop > 0 || this.cutT > 0 || this.introT > 0;
    const alpha = room || frozen ? 1 : Math.min(1, this.acc / DT);
    this.scene.render(this.sim, alpha, dt, simDt || (this.sim.over ? dt * this.juice.timeScale : 0));
    const roomReady = !room || (
      this.roomRun?.fightBuilt && !this.roomRun.blocked && !this.roomRun.shownResult &&
      room.view.phase === 'fight' && room.clock() >= room.view.at
    );
    const battle = this.started && !this.sim.over && !this.sim.paused && !this.drafting && roomReady;
    this.hud.update(this.sim, dt, !!battle && this.introT <= 0 && !this.replaying);
    const audible = battle && !this.paused && this.introT <= 0;
    for (const f of this.sim.fighters)
      this.sfx.charge(f.idx, audible && !frozen && f.state === 'charge' ? Math.min(1, f.stateT / f.stateDur) : null);

    if (this.started && (!battle || this.replaying)) this.sfx.mood('off');
    if (audible && !this.replaying) {
      const low = this.sim.fighters.some((f) => f.state !== 'ko' && f.hp / f.maxHp < 0.3);
      const left = this.sim.timeLimit - this.sim.t;
      this.sfx.mood(low || left < 15 ? 'tense' : 'fight');
      if (room || !frozen) {
        // The room clock keeps running through local effects.
        const sec = Math.ceil(left);
        if (simDt > 0 && sec > 0 && sec <= 10 && (this.lastTick < 0 || sec < this.lastTick)) {
          this.lastTick = sec;
          this.sfx.tick(sec <= 3);
        }
        this.heartT -= dt;
        if (simDt > 0 && low && this.heartT <= 0) {
          this.heartT = 0.85;
          this.sfx.heartbeat();
        }
      }
    }

    if (!room && this.endT >= 0 && this.cutT <= 0) {
      this.endT -= dt;
      if (this.endT < 0 && this.ko && !this.replaying && !this.replayed && this.juice.enabled && this.replayOn && this.sim.over && this.sim.tick === this.ko.tick) {
        this.startReplay();
      } else if (this.endT < 0) {
        this.replaying = false;
        this.scene.focus = null;
        document.body.classList.remove('replaying');
        const inBracket = this.tourney && this.match && this.sim.seed === this.match.seed;
        if (this.spec.result) {
          this.panel.onclick = null;
          this.panel.classList.remove('wide');
          this.panel.innerHTML = this.spec.result();
          this.panel.classList.add('show');
        } else renderResults(this.panel, this.sim, TEAM_HEX, inBracket ? { tourney: roundName(this.tourney!, this.match!.r) } : { actions: this.spec.resultActions, names: this.spec.names, localSide: this.spec.localSide });
      }
    }
  }

  /** KO replays on/off (the R key shortcut row in main.ts toggles it) */
  replayOn = true;
  /** who last hit each fighter (for the replay camera) */
  private lastHitBy: Record<number, number> = {};

  // ---------------- events → feel ----------------
  private showElimination(event: Extract<SimEvent, { type: 'ko' }>) {
    const label = (idx: number) => {
      const fighter = this.sim.fighters[idx];
      return this.spec.names?.[fighter.team] || fighter.def.displayName;
    };
    this.hud.elimination(label(event.b), event.by === undefined ? undefined : label(event.by));
  }

  private handle(events: SimEvent[], resumedSpecial = false) {
    const j = this.juice;
    const fx = this.scene.fx;
    const on = j.enabled;
    const F = this.sim.fighters;
    const royale = !!this.sim.opts.royale;
    const view = (i: number) => this.scene.views[i];
    const sc = (i: number) => this.scene.views[i].visualSize / DEPTH.k;
    const showDamage = (target: number, amount: number, critical = false) =>
      fx.damage(target, () => view(target).point('chest'), amount, critical);

    for (let k = 0; k < events.length; k++) {
      const e = events[k];
      switch (e.type) {
        case 'swing': {
          // Keep the actual wind-up and swing pose readable on misses.
          const a = F[e.a];
          const sh = view(e.a).point('shoulder');
          this.sfx.whoosh(e.heavy, e.inReach ? 1 : 0.45, a.def.id);
          if (on && e.heavy && e.inReach) fx.slash(sh.x, sh.y, a.face, a.def.range * 0.68, 0xffc04a, true, royale ? 0.6 : 0.9);
          break;
        }
        case 'miss': {
          this.sfx.miss();
          if (!royale) fx.text(e.x, e.y - HEIGHT * sc(e.b) - 50, 'MISS', { color: 0xb8b0a4, size: on ? 30 : 22, toss: false, dur: 0.7 });
          break;
        }
        case 'bounce': {
          view(e.a).wallSquash(e.nx, e.ny, e.speed);
          this.sfx.bounce(e.speed);
          if (on && e.speed > (royale ? 420 : 220)) fx.dust(e.x, e.y, 2 + Math.round(e.speed / 200), e.nx * 0.5, e.ny * 0.5);
          break;
        }
        case 'bump': {
          view(e.a).squash(5, -4);
          view(e.b).squash(5, -4);
          this.sfx.bump(e.force);
          j.addTrauma(Math.min(0.12, e.force / 6000));
          if (on && !royale) fx.dust(e.x, e.y, 3, 0, 0);
          break;
        }
        case 'hit': {
          const b = F[e.b];
          const y = e.y - HEIGHT * sc(e.b);
          const heavy = e.heavy;
          this.sfx.hit(heavy, e.crit, F[e.a].def.id, e.skill);
          this.lastHitBy[e.b] = e.a;
          if (!this.firstBlood && !this.replaying) {
            this.firstBlood = true;
            this.sfx.firstBlood();
            if (!royale) fx.text(e.x, y - 130, 'FIRST BLOOD!', { color: 0xff5a46, size: on ? 44 : 28, toss: false, dur: 1.3 });
          }
          view(e.b).hitFlash();
          view(e.b).squash(heavy ? 10 : 6, heavy ? -9 : -6);
          j.addHitstop(heavy ? 0.09 : e.crit ? 0.11 : 0.05);
          j.addTrauma(heavy ? 0.23 : e.crit ? 0.25 : e.skill ? 0.10 : 0.04);
          if (!royale && (e.crit || heavy)) j.addPunch(heavy ? 0.04 : 0.03);
          if (on) {
            fx.sparks(e.x, y, e.dx, e.dy, heavy ? 12 : e.crit ? 9 : e.skill ? 4 : 2, e.crit ? 0xffe066 : 0xfff1c8);
            if (heavy || e.crit) fx.ring(e.x, y, e.crit ? 0xffe066 : 0xffffff, heavy ? 140 : 90, 0.3, heavy ? 10 : 6);
            if (heavy) fx.dust(b.x, b.y, 8, e.dx, e.dy);
          }
          showDamage(e.b, e.dmg, e.crit);
          if (heavy && on && !royale) this.hud.flash(0.18, 90);
          break;
        }
        case 'blocked': {
          const y = e.y - HEIGHT * sc(e.b);
          view(e.b).shieldPop(false);
          this.sfx.block();
          view(e.b).squash(4, -2);
          j.addHitstop(0.04);
          j.addTrauma(0.08);
          if (on) fx.sparks(e.x, y, F[e.a].x - F[e.b].x, 0, 7, 0x8fd3ff, 500);
          showDamage(e.b, e.dmg);
          break;
        }
        case 'parry': {
          const y = e.y - HEIGHT * sc(e.b);
          view(e.b).shieldPop(true);
          this.sfx.parry();
          view(e.a).hitFlash();
          j.addHitstop(0.12);
          j.addTrauma(0.2);
          j.addPunch(0.025);
          if (on) {
            fx.ring(e.x, y, 0x6ff0ff, 120, 0.35, 8, 1);
            fx.burstRing(e.x, y, 14, 0x6ff0ff, 420, 9);
          }
          fx.text(e.x, y - 130, 'PARRY!', { color: 0x6ff0ff, size: on ? 54 : 30, toss: false, dur: 1 });
          break;
        }
        case 'guardBreak': {
          const b = F[e.b];
          const y = e.y - HEIGHT * sc(e.b);
          this.sfx.guardBreak();
          view(e.b).hitFlash();
          j.addHitstop(0.11);
          j.addTrauma(0.45);
          j.addPunch(0.04);
          if (on) {
            fx.shards(e.x, y, 0x8fd3ff, 14);
            fx.ring(b.x, b.y, 0xff5a46, 120, 0.35, 8);
          }
          fx.text(e.x, y - 150, 'BREAK!', { color: 0xff5a46, size: on ? 62 : 30, toss: false, dur: 1.1 });
          break;
        }
        case 'interrupt': {
          const b = F[e.b];
          this.sfx.interrupt();
          fx.text(b.x, b.y - 150 * sc(e.b), 'INTERRUPTED', { color: 0xffa23a, size: on ? 34 : 24, toss: false });
          break;
        }
        case 'dodge': {
          const b = F[e.b];
          view(e.b).dodged();
          this.sfx.dash();
          if (on) fx.dust(b.x, b.y, 4, -e.dx, -e.dy);
          if (!royale) fx.text(b.x, b.y - 140 * sc(e.b), 'DODGE', { color: 0xbfe8ff, size: on ? 32 : 22, toss: false });
          break;
        }
        case 'chargeStart': {
          const a = F[e.a];
          this.sfx.chargeStart();
          if (on) fx.ring(a.x, a.y, a.def.color, 90, 0.4, 5);
          break;
        }
        case 'chargeRelease': {
          const a = F[e.a];
          j.addTrauma(0.12);
          if (on) fx.dust(a.x, a.y, 6, Math.cos(a.face), Math.sin(a.face));
          break;
        }
        case 'wallSlam': {
          this.sfx.wallSlam();
          view(e.b).hitFlash();
          j.addHitstop(0.08);
          j.addTrauma(0.4);
          if (on) {
            fx.dust(e.x, e.y, 14, e.nx, e.ny);
            fx.shards(e.x, e.y - 40, 0x8a7560, 8);
            fx.propPop('dust', e.x, e.y - 30, 110, 0.5, { rise: 20 });
          }
          showDamage(e.b, e.dmg);
          break;
        }
        case 'status': {
          const b = F[e.b];
          const LABEL: Record<string, [string, number]> = {
            stun: ['STUN', 0xffe066], poison: [`POISON ×${e.stacks}`, 0x8be04a], burn: ['BURN', 0xff8a3a], slow: ['SLOW', 0x8fd3ff],
            wet: ['WET', 0x6fc3ff], blind: ['BLIND', 0xa08cff], spicy: ['SPICY! +ATK', 0xff6a3a], hearty: ['HEARTY! +DEF', 0xffd23f],
            light: ['LIGHT! +SPEED', 0xbfe8ff], lifeSupport: ['LIFE SUPPORT', 0x6dff9a],
            bleed: [`BLEED ×${e.stacks}`, 0xff4a5a], root: ['ROOTED', 0x9ad07a], silence: ['SILENCED', 0xc0b8d8], disarm: ['DISARMED', 0xc0c7d0],
            weaken: ['WEAKENED', 0xb08cff], armorBreak: ['ARMOR BREAK', 0xff9a6a], sleep: ['ZZZ…', 0xbfd8ff], confuse: ['CONFUSED', 0xffd23f],
            charm: ['CHARMED', 0xff7ab8], glitch: ['GLITCH', 0x4cc9f0], mark: ['MARKED', 0x3a86ff], shield: ['SHIELD', 0x9fd8ff],
            haste: ['HASTE', 0xbfe8ff], empower: ['POWER UP', 0xffd23f], fortify: ['FORTIFIED', 0xc9d4de], superArmor: ['UNSTOPPABLE', 0xffd23f],
            invuln: ['INVULNERABLE', 0xffffff], airborne: ['AIRBORNE', 0xbfe8ff],
          };
          const [label, col] = LABEL[e.kind] ?? [e.kind.toUpperCase(), 0xffffff];
          if (e.kind === 'stun') this.sfx.stun();
          else this.sfx.status(e.kind);
          if (!royale || ['stun', 'sleep', 'silence', 'disarm', 'root', 'charm'].includes(e.kind)) {
            fx.text(b.x + 40, b.y - 175 * sc(e.b), label, { color: col, size: royale ? 18 : on ? 28 : 20, toss: false, dur: royale ? 0.55 : 0.9 });
          }
          break;
        }
        case 'dot': {
          this.sfx.dot(e.kind);
          showDamage(e.b, e.dmg);
          break;
        }
        case 'heal': {
          const b = F[e.b];
          this.sfx.heal();
          fx.text(b.x + 30, b.y - 130 * sc(e.b), `+${e.amount}`, { color: 0x6dff9a, size: on ? 36 : 24, toss: false, dur: 0.9 });
          if (on) for (let i = 0; i < 6; i++) fx.sparkle(b.x, b.y - 60, 0x6dff9a);
          break;
        }
        case 'cleanse': {
          const b = F[e.b];
          this.sfx.cleanse();
          fx.text(b.x, b.y - 200 * sc(e.b), 'CLEANSED', { color: 0xffffff, size: on ? 28 : 20, toss: false });
          if (on) fx.ring(b.x, b.y - 60, 0xffffff, 100, 0.4, 6, 1);
          break;
        }
        case 'note': {
          const b = F[e.b];
          if (!royale) fx.text(b.x - 40, b.y - 185 * sc(e.b), e.text, { color: e.color, size: on ? 30 : 22, toss: false, dur: 0.8 });
          break;
        }
        case 'shieldHit': {
          const b = F[e.b];
          this.sfx.absorb();
          if (!royale) fx.text(b.x + 30, b.y - 150 * sc(e.b), `ABSORB ${e.absorbed}`, { color: 0x9fd8ff, size: on ? 26 : 20, toss: false, dur: 0.7 });
          break;
        }
        case 'specialReady': {
          this.sfx.specialReady();
          break;
        }
        case 'skill': {
          const a = F[e.a];
          const special = e.kind === 'special';
          if (special && !(resumedSpecial && k === 0)) {
            // Local battles hold the arena cues and impact until the cutscene clears.
            const casts = (this.specialCasts[e.a] = (this.specialCasts[e.a] ?? 0) + 1);
            const mode = this.replaying ? 'off' : this.cutMode === 'full' && casts > 1 ? 'short' : this.cutMode;
            this.sfx.special(a.def.id);
            if (mode !== 'off' && !royale) {
              this.cutscene.play(a.def, a.team, mode);
              if (!this.roomLink) {
                this.cutT = CUTSCENE_DUR[mode];
                this.pending = events.slice(k);
                j.addTrauma(0.3);
                return;
              }
            }
          }
          if (!special) this.sfx.skill(a.def.id);
          this.hud.skillFired(e.a, e.kind);
          this.castCues(e.a, e.name, special, castColor(a.def));
          if (royale && special) this.hud.announce(`${a.def.displayName}: ${e.name}`, '#ffd23f', 1);
          break;
        }
        case 'hazard': {
          this.sfx.hazard(e.kind, e.action);
          if (e.action === 'trigger') j.addTrauma(0.15);
          if (e.action === 'expire' && e.kind === 'hook') fx.text(e.x, e.y - 60, 'MISSED', { color: 0xb8b0a4, size: 24, toss: false, dur: 0.6 });
          break;
        }
        case 'fx':
          this.playFx(e);
          break;
        case 'ko': {
          const b = F[e.b];
          this.sfx.ko();
          if (royale && !this.replaying) this.showElimination(e);
          if (!this.sim.over) {
            this.sfx.down();
            // a tag-team partner falls but the fight goes on: big hit, no slow-mo or zoom
            j.addHitstop(0.14);
            j.addTrauma(0.55);
            if (on) {
              fx.ring(b.x, b.y, 0xffffff, 200, 0.5, 10);
              fx.shards(b.x, b.y - 60, b.def.color, 12);
            }
            if (!royale) fx.text(b.x, b.y - 200 * sc(e.b), `${b.def.displayName.toUpperCase()} DOWN!`, { color: 0xff5a46, size: on ? 46 : 28, toss: false, dur: 1.4 });
            break;
          }
          j.addHitstop(0.18);
          j.addTrauma(0.7);
          j.slowmo(0.25, 1.4);
          this.scene.focus = on ? { x: b.x, y: b.y - 60, zoomMul: 1.45 } : null;
          if (on) {
            this.hud.flash(0.9, 260);
            fx.ring(b.x, b.y, 0xffffff, 260, 0.6, 14);
            fx.shards(b.x, b.y - 60, b.def.color, 18);
          }
          if (!royale) this.hud.callout('K.O.!');
          if (!this.replaying) this.ko = { tick: this.sim.tick, victim: e.b, killer: this.lastHitBy[e.b] ?? -1 };
          break;
        }
        case 'card': {
          // a card landed: flash it over that side's fighters
          const c = CARD_BY_ID.get(e.id);
          if (!c || this.replaying) break;
          for (const f of F) if (f.team === e.team && f.state !== 'ko') {
            if (royale) continue; // The draft and Cards panel already show the choice.
            const hd = view(f.idx).point('head');
            fx.text(hd.x, hd.y - 60, `${c.glyph} ${c.name}`, { color: c.rarity === 'epic' ? 0xc89bff : c.rarity === 'rare' ? 0x8fb8ff : 0xb8e0a8, size: on ? 30 : 22, toss: false, dur: 1.4 });
            if (on) fx.ring(f.x, f.y, c.rarity === 'epic' ? 0xa35cff : c.rarity === 'rare' ? 0x4c8dff : 0x8fbf7a, 110, 0.5, 6);
            if (on) {
              const ch = view(f.idx).point('chest');
              fx.propPop('fx-pick', ch.x, ch.y, 150, 0.5, { additive: true });
              if (c.rarity === 'epic') fx.propPop('fx-epic', f.x, f.y - 10, 190, 0.9, { additive: true, layer: 'under' });
            }
          }
          this.sfx.status('empower');
          break;
        }
        case 'proc': {
          // a card effect went off (Golden Parachute, Phoenix, Chain Reaction, …)
          const c = CARD_BY_ID.get(e.card);
          const a = F[e.a];
          if (!c) break;
          const big = ['golden-parachute', 'phoenix', 'second-wind', 'second-opinion'].includes(e.card);
          // the card's own effect sprite (art/PROMPTS_CARDS.md cells 83–90)
          const sprite: Record<string, [string, number, number]> = {
            'golden-parachute': ['fx-parachute', 140, 1.4], 'second-opinion': ['fx-parachute', 140, 1.4], phoenix: ['fx-phoenix', 230, 1.3],
            'chain-reaction': ['fx-chain', 170, 0.5], 'lightning-rod': ['fx-rod', 190, 0.5], aegis: ['fx-shield', 150, 0.8],
          };
          const sp = sprite[e.card];
          if (sp && on && (!royale || big)) {
            const at = e.b !== undefined && (e.card === 'chain-reaction' || e.card === 'lightning-rod') ? F[e.b] : a;
            fx.propPop(sp[0], at.x, at.y - 70 * sc(at.idx), sp[1], sp[2], { rise: sp[0] === 'fx-parachute' ? -60 : 30, additive: sp[0] !== 'fx-parachute' });
          }
          if (!royale || big) fx.text(a.x, a.y - 210 * sc(e.a), `${c.glyph} ${c.name.toUpperCase()}!`, { color: 0xffd23f, size: on ? (big ? 44 : 30) : 22, toss: false, dur: big ? 1.4 : 0.9 });
          if (big) {
            j.addHitstop(0.12);
            j.addTrauma(0.35);
            if (on) fx.burstAt(a.x, a.y - 60, e.card === 'phoenix' ? 0xff8a2a : 0xffd23f);
            this.sfx.jingle('intro');
          } else this.sfx.status(e.card === 'aegis' ? 'shield' : 'mark');
          break;
        }
        case 'overtime': {
          this.hud.callout('OVERTIME!', '#ff5a46');
          if (on) fx.propPop('fx-overtime', ARENA_W / 2, ARENA_H / 2 - 40, 220, 1.4, { rise: 40 });
          this.sfx.firstBlood();
          j.addTrauma(0.3);
          break;
        }
        case 'end': {
          if (this.roomLink) break; // only display the room-confirmed result
          if (!this.replaying && !this.ended) {
            this.ended = true;
            this.spec.onEnd?.(this.sim);
          }
          if (this.replaying) {
            this.endT = 2.4;
            break;
          }
          if (e.reason === 'time') this.hud.callout('TIME!', '#ffb02e');
          this.endT = 2.6;
          this.reportMatch();
          this.sfx.mood('off');
          // winners cheer and celebrate; a draw gets a sad trombone
          const winners = F.filter((f) => f.team === e.winner && f.state !== 'ko');
          const match = this.sim;
          setTimeout(() => {
            if (this.started && this.sim === match) this.sfx.jingle(winners.length ? 'win' : 'draw');
          }, e.reason === 'ko' ? 900 : 300);
          for (const f of winners) this.scene.views[f.idx]?.celebrate();
          if (on && winners.length) this.scene.fx.confetti(TEAM_COLORS[winners[0].team]);
          break;
        }
      }
    }
  }

  /**
   * Every cast reads at a glance: a burst behind the caster, its skill name on a plate over its
   * head, and (when it's aimed) a telegraph line and a lock-on reticle that follow the target.
   */
  private castCues(i: number, name: string, special: boolean, col: number) {
    const fx = this.scene.fx;
    const F = this.sim.fighters;
    const v = this.scene.views[i];
    if (!v) return;
    const a = F[i];
    const tint = special ? 0xffd23f : col;
    const royale = !!this.sim.opts.royale;
    fx.castPlate(() => v.point('head'), name, special ? tint : TEAM_COLORS[a.team], special, a.def.displayName.toUpperCase(), this.juice.enabled, i, royale);
    if (!this.juice.enabled) return;
    const c = v.point('chest');
    if (special) fx.castBurst(c.x, c.y, tint, true);
    fx.ring(a.x, a.y, tint, special ? 176 : 76, special ? 0.65 : 0.3, special ? 11 : 4);
    const t = F[a.targetIdx];
    const tv = t && this.scene.views[t.idx];
    if (t && tv && t.state !== 'ko' && t.team !== a.team) {
      if (special) fx.telegraph(() => v.point('feet'), () => tv.point('feet'), tint, 0.65);
      fx.reticle(() => tv.point('feet'), tint, special ? 0.95 : 0.4);
    }
  }

  /** Kit visual cues (fire cone, hose, lightning, truck, fish, …). */
  private playFx(e: Extract<SimEvent, { type: 'fx' }>) {
    const fx = this.scene.fx;
    const j = this.juice;
    const F = this.sim.fighters;
    const a = F[e.a];
    const h = (i: number) => HEIGHT * this.scene.views[i].visualSize / DEPTH.k;
    const at = (i: number, part: 'tip' | 'hand' | 'shoulder' | 'head' | 'chest' | 'feet') => this.scene.views[i].point(part);
    switch (e.fx) {
      case 'cone': {
        this.sfx.fire();
        const t = at(e.a, 'tip');
        fx.cone(t.x, t.y, e.angle);
        j.addTrauma(0.15);
        break;
      }
      case 'stream': {
        this.sfx.water();
        const o = at(e.a, 'hand'), c = at(e.b, 'chest');
        fx.stream(o.x, o.y, c.x, c.y);
        break;
      }
      case 'zap': {
        this.sfx.zap();
        // from the attacker's tool tip (or the trap) to the target's chest
        const fromTrap = Math.hypot(a.x - e.x, a.y - e.y) > a.def.range * 1.6;
        const o = fromTrap ? { x: e.x, y: e.y } : at(e.a, 'tip');
        const c = at(e.b, 'chest');
        fx.zap(o.x, o.y, c.x, c.y);
        j.addTrauma(0.12);
        break;
      }
      case 'bolt':
        this.sfx.thunder();
        fx.bolt(e.x, e.y - h(e.b));
        this.hud.flash(0.35, 90);
        j.addTrauma(0.3);
        break;
      case 'blackout':
        fx.darkness(-400, -500, ARENA_W + 800, ARENA_H + 900, e.dur);
        break;
      case 'truck':
        if (e.color !== undefined) {
          // the Pilot's airstrike reuses the cue with a colour: draw a plane instead of a truck
          this.sfx.dash();
          fx.plane(ARENA_W, e.y, Math.cos(e.angle) >= 0 ? 1 : -1, e.dur, e.color);
          break;
        }
        this.sfx.horn();
        fx.truck(ARENA_W, e.y, Math.cos(e.angle) >= 0 ? 1 : -1, e.dur);
        j.addTrauma(0.25);
        break;
      case 'shot': {
        const o = at(e.a, 'tip'), c = at(e.b, 'chest');
        this.sfx.whoosh(false, 0.5);
        fx.tracer(o.x, o.y, c.x, c.y, e.color ?? 0xffffff, e.dur || 0.15, e.prop);
        break;
      }
      case 'drop':
        fx.dropObj(e.x, e.y, e.color ?? 0x8a7560, e.dur, e.prop);
        if (e.dur > 0.05) this.sfx.whoosh(true, 0.6);
        else { this.sfx.wallSlam(); j.addTrauma(0.3); }
        break;
      case 'shockwave':
        this.sfx.bump(600);
        fx.shockwave(at(e.a, 'chest').x, at(e.a, 'feet').y, e.color ?? 0xffffff);
        j.addTrauma(0.2);
        break;
      case 'burst': {
        const c = e.a === e.b ? at(e.a, 'chest') : { x: e.x, y: e.y - h(e.b) };
        this.sfx.status();
        fx.burstAt(c.x, c.y, e.color ?? 0xffffff);
        fx.propPop(e.prop, c.x, c.y - 20, 80, 0.7, { rise: 40 });
        break;
      }
      case 'slashx': {
        const c = at(e.b, 'chest');
        this.sfx.whoosh(false, 0.8);
        fx.crossSlash(c.x, c.y, e.angle, e.color ?? 0xffffff);
        break;
      }
      case 'rewind': {
        const c = at(e.a, 'chest');
        this.sfx.specialReady();
        fx.rewind(c.x, c.y, e.color ?? 0x4cc9f0);
        break;
      }
      case 'clone':
        if (this.juice.enabled && this.scene.views[e.a]) fx.afterimage(this.scene.views[e.a].silhouette, a.x + 30, a.y, e.color ?? 0xe63946, Math.cos(a.face) >= 0 ? 1 : -1);
        break;
      case 'bomb':
        this.sfx.explosion();
        fx.propPop('parcelBomb', e.x, e.y - h(e.b) - 30, 70, 0.4);
        fx.explosion(e.x, e.y - h(e.b), 0xc8935a, 0.8);
        j.addTrauma(0.4);
        break;
      case 'fish':
        fx.fishShadow(e.x, e.y, e.dur);
        break;
      case 'splash':
        this.sfx.splash();
        fx.splash(e.x, e.y);
        j.addTrauma(0.45);
        this.hud.flash(0.3, 120);
        break;
      case 'explosion':
        this.sfx.explosion();
        fx.explosion(e.x, e.y - h(e.b), e.color ?? 0xff8a2a);
        if (e.prop && e.prop !== 'fire') fx.propPop(e.prop, e.x, e.y - h(e.b), 90, 0.5);
        j.addTrauma(0.55);
        this.hud.flash(0.4, 140);
        break;
      case 'ram':
        this.sfx.dash();
        fx.streaks(at(e.a, 'chest').x, at(e.a, 'chest').y, e.angle, 0xffc04a);
        fx.dust(a.x, a.y, 6, -Math.cos(e.angle), -Math.sin(e.angle));
        break;
      case 'pull':
        fx.streaks(at(e.b, 'chest').x, at(e.b, 'chest').y, e.angle, 0xffffff);
        break;
      case 'feast': {
        const hd = at(e.a, 'head');
        fx.feast(hd.x, hd.y, e.dur > 0);
        break;
      }
      case 'heartbeat': {
        this.sfx.heartbeat();
        const c = at(e.a, 'chest');
        fx.heartbeat(c.x, c.y);
        break;
      }
    }
  }
}
