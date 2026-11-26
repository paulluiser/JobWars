import { MAX_DISPLAY_NAME_LENGTH, type RoomView } from '../net/roomWire';
import { fighterProfileHtml, ROLE_COLORS } from './screens';
import type { SkillKind } from './skillArt';
import { ROSTER } from '../data/roster';
import { PVP_MODES, type PvpMode } from '../net/pvp';
import { RANKS, rankOf, type Profile } from '../modes/mmr';
import { CHAPTERS, LEVELS, isOpen, totalStars, type Level, type Progress } from '../modes/story';
import { CARD_BY_ID, GACHA } from '../data/cards';
import type { FighterDef } from '../sim/types';
import { face } from './face';
import { cardIcon } from './cards';
import { posterUrl, uiArtUrl } from '../render/art';
import './workshop.css';

/** a menu emblem from the UI sheet (art/PROMPTS_UI.md), or a glyph until it exists */
const emblem = (id: string, glyph: string, cls = 'emb') => {
  const url = uiArtUrl(id);
  return `<span class="${cls}" aria-hidden="true">${url ? `<img src="${url}" alt="">` : `<i>${glyph}</i>`}</span>`;
};
const RANK_GLYPH: Record<string, string> = { Intern: '📛', Associate: '🟢', Specialist: '🔷', Manager: '🟣', Director: '🏅', Executive: '🎖️', CEO: '👑' };
const rankEmblem = (name: string) => emblem(`rank-${name.toLowerCase()}`, RANK_GLYPH[name] ?? '⭐', 'rk-emb');

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const byId = (id: string) => ROSTER.find((d) => d.id === id)!;
const stars = (n: number, of = 3) => `<span class="stars" aria-label="${n} of ${of} stars">${'★'.repeat(n)}<i>${'★'.repeat(of - n)}</i></span>`;
const rankBadge = (mmr: number) => {
  const r = rankOf(mmr);
  return `<span class="rank" style="--rk:${r.color}">${rankEmblem(r.name)}${r.name} <b>${mmr}</b></span>`;
};

function show(panel: HTMLElement, html: string, onClick: (t: HTMLElement) => void) {
  const focused = document.activeElement;
  const previous = focused instanceof HTMLButtonElement && panel.contains(focused) ? focused.dataset : null;
  const surface = panel.firstElementChild?.classList[0];
  const rosterScroll = panel.querySelector<HTMLElement>('.roster-scroll')?.scrollTop ?? 0;
  panel.innerHTML = html;
  panel.onclick = (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-m]');
    if (t && !(t as HTMLButtonElement).disabled) onClick(t);
  };
  panel.classList.add('show', 'wide');
  if (surface !== panel.firstElementChild?.classList[0]) return;
  const roster = panel.querySelector<HTMLElement>('.roster-scroll');
  if (roster) roster.scrollTop = rosterScroll;
  if (previous) {
    [...panel.querySelectorAll<HTMLButtonElement>('button[data-m]:enabled')].find((button) =>
      button.dataset.m === previous.m && button.dataset.v === previous.v)?.focus({ preventScroll: true });
  }
}

// ---------------- main menu ----------------

export function renderMenu(panel: HTMLElement, profile: Profile, story: Progress, go: (where: 'pvp' | 'story' | 'cpu' | 'heroes') => void) {
  const cleared = LEVELS.filter((l) => (story.stars[l.id] ?? 0) > 0).length;
  const portrait = document.body.classList.contains('portrait');
  const poster = posterUrl(portrait);
  // a featured worker rotates beside the cards (the whole roster, in random order)
  const order = [...ROSTER].sort(() => Math.random() - 0.5).slice(0, 8);
  const r = rankOf(profile.mmr);
  show(panel, `
    <div class="menu">
      <div class="m-bg">${poster ? `<div class="m-poster" style="background-image:url('${poster}')"></div>` : `<div class="m-crowd">${order.slice(0, 6).map((d, i) => `<span style="--i:${i}">${face(d, 'bust')}</span>`).join('')}</div>`}</div>
      <button class="m-settings" data-act="settings">Settings</button>
      <button class="m-heroes" data-m="heroes">View all heroes</button>
      <div class="m-navigation">
        <div class="m-top">
          <div class="m-title"><span>JOB</span><span>WARS</span></div>
          <div class="m-sub">Real jobs. Real fights. Pick a shift.</div>
        </div>
        <div class="m-cards">
          <button class="m-card pvp" data-m="pvp" style="--i:0">
            <span class="m-strap"></span>${emblem('mode-pvp', '⚔️', 'm-icon')}
            <span class="m-name">Player vs Player</span>
            <span class="m-desc">Classic or Gacha. Duel, Tag Team, or Battle Royale.</span>
            <span class="m-meta">${rankBadge(profile.mmr)} · ${profile.wins}W ${profile.losses}L</span>
          </button>
          <button class="m-card story" data-m="story" style="--i:1">
            <span class="m-strap"></span>${emblem('mode-story', '📖', 'm-icon')}
            <span class="m-name">Story Mode</span>
            <span class="m-desc">A career across Metro City: 24 levels, bosses, recruit all 30 jobs.</span>
            <span class="m-meta">${cleared}/${LEVELS.length} cleared · ★ ${totalStars(story)}/${LEVELS.length * 3} · ${story.unlocked.length}/30 jobs</span>
          </button>
          <button class="m-card cpu" data-m="cpu" style="--i:2">
            <span class="m-strap"></span>${emblem('mode-cpu', '🤖', 'm-icon')}
            <span class="m-name">CPU Battle</span>
            <span class="m-desc">Every job unlocked. 1v1, Tag Team and Tournaments, Classic or Gacha.</span>
            <span class="m-meta">${emblem('trophy', '🏆', 'mini-emb')} All 30 jobs</span>
          </button>
        </div>
      </div>
      <div class="m-feature" aria-label="Featured heroes">${order.map((d, i) => `<div class="mf" style="--i:${i};--hero-light:${hex(d.accent)}"><div class="mf-bust">${face(d, 'bust')}</div><div class="mf-tag"><b>${esc(d.displayName)}</b><span>${esc(d.name)} · ${esc(d.role)}</span></div></div>`).join('')}</div>
      <div class="m-foot"><span class="rank-chip" style="--rk:${r.color}">${rankEmblem(r.name)} ${r.name}</span><span>Esc: menu · B: cards · K: share · F: fighters</span></div>
    </div>`, (t) => go(t.dataset.m as 'pvp' | 'story' | 'cpu' | 'heroes'));
  // cards lean toward the pointer
  for (const card of panel.querySelectorAll<HTMLElement>('.m-card')) {
    card.addEventListener('pointermove', (e) => {
      const b = card.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      card.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }
}

export type SettingsView = {
  sound: 'on' | 'off';
  juice: 'on' | 'off';
  cutscene: 'full' | 'short' | 'off';
  layout: 'auto' | 'portrait' | 'landscape';
  details: 'simple' | 'detailed';
};

export function renderSettings(panel: HTMLElement, settings: SettingsView, back: () => void) {
  const poster = posterUrl(document.body.classList.contains('portrait'));
  const setting = (key: keyof SettingsView, label: string, description: string, options: [string, string][]) => `
    <label class="setting-row">
      <span><b>${label}</b><small>${description}</small></span>
      <select data-pref="${key}" aria-label="${label}">${options.map(([value, name]) => `<option value="${value}" ${settings[key] === value ? 'selected' : ''}>${name}</option>`).join('')}</select>
    </label>`;
  const toggles: [string, string][] = [['on', 'On'], ['off', 'Off']];
  show(panel, `
    <section class="settings desk-screen">
      <div class="settings-backdrop" aria-hidden="true" ${poster ? `style="--settings-art:url('${poster}')"` : ''}></div>
      <header class="desk-head"><button class="back" data-m="back" aria-label="Menu">Menu</button><h2 tabindex="-1">Settings</h2></header>
      <div class="desk-sheet settings-sheet">
        ${setting('sound', 'Sound', 'Music and sound effects.', toggles)}
        ${setting('juice', 'Combat effects', 'Screen shake, hit effects and slow motion.', toggles)}
        ${setting('cutscene', 'Cutscenes', 'Special move camera sequences.', [['full', 'Full'], ['short', 'Short'], ['off', 'Off']])}
        ${setting('layout', 'Layout', 'Auto follows the shape of your screen.', [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']])}
        ${setting('details', 'Card descriptions', 'Show simple summaries or exact effects.', [['simple', 'Simple'], ['detailed', 'Detailed']])}
      </div>
    </section>`, back);
  panel.querySelector('h2')?.focus();
}

// ---------------- PvP ----------------

export interface PvpView {
  mode: PvpMode;
  playerName: string;
  profile: Profile;
  status: string;
  code: string;
  busy: boolean;
  error: string;
}

const ratingNumber = new Intl.NumberFormat();
const matchDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const outcomes = { W: 'Win', L: 'Loss', D: 'Draw' } as const;

function pvpRating(profile: Profile) {
  const rank = rankOf(profile.mmr);
  const next = RANKS[RANKS.indexOf(rank) + 1];
  return `
    <section class="pvp-rating" aria-label="PvP rating">
      <div class="rating-identity">
        ${rankEmblem(rank.name)}
        <div><span class="rating-rank">${rank.name}</span><div class="rating-score"><b>${ratingNumber.format(profile.mmr)}</b> <span>MMR</span></div></div>
      </div>
      <div class="rating-progress">
        ${next ? `<span>${ratingNumber.format(next.min - profile.mmr)} MMR to <b>${next.name}</b></span>
          <progress aria-label="Progress to ${next.name}" value="${profile.mmr - rank.min}" max="${next.min - rank.min}"></progress>` : '<span>Top rank reached</span>'}
      </div>
      <dl class="rating-record">
        <div><dt>Wins</dt><dd>${ratingNumber.format(profile.wins)}</dd></div>
        <div><dt>Losses</dt><dd>${ratingNumber.format(profile.losses)}</dd></div>
        <div><dt>Draws</dt><dd>${ratingNumber.format(profile.draws)}</dd></div>
        <div><dt>Peak MMR</dt><dd>${ratingNumber.format(profile.peak)}</dd></div>
      </dl>
    </section>`;
}

function pvpHistory(profile: Profile) {
  if (!profile.history.length) return '<p class="history-empty">No ranked matches yet.</p>';
  const rows = profile.history.map(({ at, mode, result, delta, opp }) => {
    const date = new Date(at);
    const when = Number.isFinite(date.getTime()) ? `<time datetime="${date.toISOString()}">${matchDate.format(date)}</time>` : '';
    const outcome = Object.hasOwn(outcomes, result) ? result : 'D';
    const modeName = Object.hasOwn(PVP_MODES, mode) ? PVP_MODES[mode as PvpMode].name : 'PvP match';
    return `<tr>
      <td><span class="history-result h-${outcome}">${outcomes[outcome]}</span></td>
      <td><b>${modeName}</b>${when}</td><td class="history-number">${ratingNumber.format(opp)}</td>
      <td class="history-number history-${delta > 0 ? 'gain' : delta < 0 ? 'loss' : 'even'}">${delta > 0 ? '+' : ''}${ratingNumber.format(delta)}</td>
    </tr>`;
  }).join('');
  return `<table aria-label="Ranked matches, newest first">
    <thead><tr><th scope="col">Result</th><th scope="col">Format</th><th scope="col">Opponent MMR</th><th scope="col">MMR change</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

const matchFormats = [
  { name: 'Duel', modes: ['classic1', 'gacha1'] },
  { name: 'Tag Team', modes: ['classic2', 'gacha2'] },
  { name: 'Battle Royale', modes: ['royaleClassic', 'royaleGacha'] },
] as const;

export function renderPvp(panel: HTMLElement, v: PvpView, act: (a: string, value?: string) => void, roomHosted = false) {
  const showingHistory = !v.busy && panel.querySelector<HTMLElement>('.pvp')?.dataset.view === 'history';
  const joinField = panel.querySelector<HTMLInputElement>('#joincode');
  const joinCode = joinField?.value ?? '';
  const joining = joinField && joinField === document.activeElement;
  const editingName = panel.querySelector('#playername') === document.activeElement;
  const mode = PVP_MODES[v.mode];
  const formats = matchFormats.filter(({ modes }) => roomHosted || !PVP_MODES[modes[0]].royale);
  const selected = formats.find(({ modes }) => modes[0] === v.mode || modes[1] === v.mode) ?? formats[0];
  const disabled = v.busy ? 'disabled' : '';
  const formatButtons = formats.map(({ name, modes }) =>
    `<button class="match-mode" data-m="format" data-v="${modes[0]}" aria-pressed="${selected.modes === modes}" ${disabled}>${name}</button>`).join('');
  const ruleButtons = ['Classic', 'Gacha'].map((name, index) =>
    `<button class="match-mode" data-m="rules" data-v="${index}" aria-pressed="${Number(mode.gacha) === index}" ${disabled}>${name}</button>`).join('');
  show(panel, `
    <section class="pvp desk-screen" data-view="${showingHistory ? 'history' : 'play'}">
      <header class="desk-head"><button class="back" data-m="back" aria-label="Menu">Menu</button><h2>Player vs Player</h2></header>
      ${pvpRating(v.profile)}
      <div class="pvp-views" role="group" aria-label="PvP view">
        <button data-m="play" aria-pressed="${!showingHistory}" aria-controls="pvp-play">Play</button>
        <button data-m="history" aria-pressed="${showingHistory}" aria-controls="pvp-history" ${v.busy ? 'disabled' : ''}>Match history</button>
      </div>
      <div id="pvp-play" class="desk-sheet match-desk" ${showingHistory ? 'hidden' : ''}>
        <div class="match-setup">
          <section aria-labelledby="format-title">
            <h3 id="format-title">Match format</h3>
            <div class="match-modes">
              <div class="match-row" role="group" aria-label="Match format">${formatButtons}</div>
              <div class="match-row" role="group" aria-label="Match rules">${ruleButtons}</div>
            </div>
            <p class="match-description">${mode.royale ? `${mode.blurb} Unranked.` : mode.gacha ? `Draft a card every ${GACHA.surgeEvery} seconds.` : 'Fighters battle without cards.'}</p>
          </section>
        </div>
        <section class="match-actions" aria-labelledby="lobby-title">
          <h3 id="lobby-title">${mode.royale ? 'Invite your friends' : 'Find an opponent'}</h3>
          <label class="player-name" for="playername">Display name
            <input id="playername" maxlength="${MAX_DISPLAY_NAME_LENGTH}" value="${esc(v.playerName)}" placeholder="Your name" autocomplete="nickname" ${v.busy ? 'disabled' : ''} required>
          </label>
          ${mode.royale ? '' : `<button class="primary big" data-m="quick" ${v.busy ? 'disabled' : ''}>Quick match</button>`}
          <button class="${mode.royale ? 'primary big' : ''}" data-m="host" ${v.busy ? 'disabled' : ''}>Create a lobby</button>
          <div class="lobby-join">
            <label for="joincode">Lobby code</label>
            <div class="join"><input id="joincode" maxlength="5" placeholder="5 characters" value="${esc(joinCode)}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${v.busy ? 'disabled' : ''}><button data-m="join" ${v.busy ? 'disabled' : ''}>Join</button></div>
          </div>
          ${v.code ? `<div class="lobby-code">Your lobby code<b>${esc(v.code)}</b><button data-m="copycode">Copy</button></div>` : ''}
          ${v.status ? `<div class="pvp-status"><span role="status">${v.busy ? '<i class="spin" aria-hidden="true"></i>' : ''}${esc(v.status)}</span>${v.busy ? '<button data-m="cancel">Cancel</button>' : ''}</div>` : ''}
          ${v.error ? `<div class="pvp-error" role="alert">${esc(v.error)}</div>` : ''}
          <p class="lobby-note">Lobby codes use the host’s match format. ${roomHosted ? 'Rooms can reconnect after a brief disconnect.' : 'Both players need to keep this page open.'}</p>
        </section>
      </div>
      <section id="pvp-history" class="desk-sheet pvp-history" aria-label="Match history" tabindex="0" ${showingHistory ? '' : 'hidden'}>${pvpHistory(v.profile)}</section>
    </section>`, (t) => {
    if (t.dataset.m === 'play' || t.dataset.m === 'history') {
      const history = t.dataset.m === 'history';
      panel.querySelector<HTMLElement>('.pvp')!.dataset.view = t.dataset.m;
      panel.querySelector<HTMLElement>('#pvp-play')!.hidden = history;
      panel.querySelector<HTMLElement>('#pvp-history')!.hidden = !history;
      panel.querySelector('[data-m="play"]')!.setAttribute('aria-pressed', String(!history));
      panel.querySelector('[data-m="history"]')!.setAttribute('aria-pressed', String(history));
      return;
    }
    if (t.dataset.m === 'format') {
      const format = formats.find(({ modes }) => modes[0] === t.dataset.v);
      if (format) act('mode', format.modes[mode.gacha ? 1 : 0]);
      return;
    }
    if (t.dataset.m === 'rules') {
      act('mode', selected.modes[t.dataset.v === '1' ? 1 : 0]);
      return;
    }
    if (t.dataset.m === 'join') act('join', (panel.querySelector('#joincode') as HTMLInputElement).value);
    else act(t.dataset.m!, t.dataset.v);
  });
  const nameInput = panel.querySelector<HTMLInputElement>('#playername')!;
  if (editingName && !v.busy) nameInput.focus({ preventScroll: true });
  nameInput.addEventListener('input', () => act('playername', nameInput.value));
  const input = panel.querySelector<HTMLInputElement>('#joincode');
  if (joining && !v.busy) input?.focus({ preventScroll: true });
  input?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') act('join', input.value);
  });
  input?.addEventListener('input', () => (input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '')));
}

export interface HeroPreview {
  fighter?: FighterDef;
  detailed: boolean;
  skill: SkillKind;
}

function previewHtml(state: HeroPreview) {
  const fighter = state.fighter ?? ROSTER[0];
  return `<aside class="detail fighter-profile" aria-label="Fighter profile" style="--rc:${ROLE_COLORS[fighter.role]}">${fighterProfileHtml(fighter, state.detailed, state.skill)}</aside>`;
}

function bindHeroPreview(panel: HTMLElement, state: HeroPreview) {
  const preview = panel.querySelector<HTMLElement>('.fighter-profile')!;
  preview.onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-inspect], button[data-sel]');
    if (!button) return;
    if (button.dataset.inspect) state.skill = button.dataset.inspect as SkillKind;
    else state.detailed = button.dataset.sel === 'detailed';
    const selector = button.dataset.inspect ? `[data-inspect="${state.skill}"]` : `[data-sel="${button.dataset.sel}"]`;
    preview.innerHTML = fighterProfileHtml(state.fighter ?? ROSTER[0], state.detailed, state.skill);
    preview.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  };
}

export function renderHeroLibrary(panel: HTMLElement, detailed: boolean, back: () => void) {
  const preview: HeroPreview = { fighter: ROSTER[0], skill: 'passive', detailed };
  const draw = () => {
    show(panel, `
      <section class="hero-index desk-screen">
        <header class="desk-head"><button class="back" data-m="back" aria-label="Menu">Menu</button><h2>All heroes</h2></header>
        <div class="desk-sheet hero-picker">
          <div class="grid mini-grid roster-scroll" aria-label="Heroes">${ROSTER.map((d) => crewButton(d, d === preview.fighter)).join('')}</div>
          ${previewHtml(preview)}
        </div>
      </section>`, (button) => {
      if (button.dataset.m === 'back') return back();
      preview.fighter = byId(button.dataset.v!);
      draw();
    });
    bindHeroPreview(panel, preview);
  };
  draw();
}

export function renderRoyaleLobby(panel: HTMLElement, view: RoomView, code: string, pick: FighterDef | undefined, notice: string, preview: HeroPreview, act: (action: string, id?: string) => void) {
  const occupied = view.occupied ?? [];
  const joined = occupied.filter(Boolean).length;
  const ready = occupied.filter((taken, i) => taken && view.present[i] && view.ready[i]).length;
  const locked = view.ready[view.team];
  const roster = ROSTER.map((d) => crewButton(d, pick === d, !!locked)).join('');
  show(panel, `
    <section class="royale-lobby desk-screen">
      <header class="desk-head">
        <button class="back" data-m="leave">Leave</button><h2>${PVP_MODES[view.mode].name}</h2>
      </header>
      <div class="desk-sheet royale-desk">
        <section class="royale-seats">
          <div class="lobby-code">Invite code <b>${esc(code)}</b><button data-m="copycode">Copy</button></div>
          <ol aria-label="Lobby seats">${occupied.map((taken, i) => `
            <li><b>${taken ? esc(view.playerNames[i] || `Player ${i + 1}`) : `Seat ${i + 1}`}${i === view.team ? ' (you)' : i === 0 && taken ? ' (host)' : ''}</b>
            <span>${!taken ? 'Open' : !view.present[i] ? 'Reconnecting' : view.ready[i] ? 'Ready' : 'Choosing'}</span></li>`).join('')}</ol>
        </section>
        <div class="royale-picks hero-picker">
          <div class="grid mini-grid roster-scroll" aria-label="Choose a fighter">${roster}</div>
          ${previewHtml(preview)}
        </div>
      </div>
      <footer class="brief-footer">
        <span role="status">${esc(notice || (joined < 3 ? `${joined}/5 players · 3 needed`
          : ready < joined ? `${ready}/${joined} ready`
          : view.team === 0 ? `${ready} players ready` : 'Waiting for the host to start'))}</span>
        <div class="royale-actions">${lockControls(!!locked, !pick || !!notice)}
        ${view.team === 0 ? `<button class="primary big" data-m="start" ${joined < 3 || ready < joined || notice ? 'disabled' : ''}>Start battle</button>` : ''}</div>
      </footer>
    </section>`, (button) => act(button.dataset.m!, button.dataset.v));
  bindHeroPreview(panel, preview);
}

function lockControls(locked: boolean, unavailable: boolean) {
  return `<button class="primary" data-m="ready" ${locked || unavailable ? 'disabled' : ''}>${locked ? 'Locked' : 'Lock in'}</button>
    ${locked ? `<button data-m="unlock" ${unavailable ? 'disabled' : ''}>Unlock hero</button>` : ''}`;
}

/** Opponent choices stay hidden until both sides lock in. */
export function renderPvpPick(panel: HTMLElement, opts: {
  need: number; picks: FighterDef[]; oppReady: boolean; ready: boolean; mode: PvpMode;
  myName: string; oppName: string; preview: HeroPreview;
}, act: (action: string, id?: string) => void) {
  const grid = ROSTER.map((d) => crewButton(d, opts.picks.includes(d), opts.ready)).join('');
  const slots = Array.from({ length: opts.need }, (_, i) => opts.picks[i]
    ? fighterSlot(opts.picks[i]) : `<span class="pslot empty">Open slot</span>`).join('');
  show(panel, `
    <section class="pvp-pick desk-screen">
      <header class="desk-head"><button class="back" data-m="leave">Leave</button><h2>${PVP_MODES[opts.mode].name}</h2></header>
      <div class="pick-status"><b>${esc(opts.myName)} (you)</b><div class="pp-slots">${slots}</div>
        <span role="status">${opts.oppReady ? `${esc(opts.oppName)} is ready`
          : opts.ready ? `<i class="spin" aria-hidden="true"></i> Waiting for ${esc(opts.oppName)} to lock in…`
          : `${esc(opts.oppName)} is choosing…`}</span></div>
      <div class="desk-sheet hero-picker"><div class="grid mini-grid roster-scroll" aria-label="Choose a fighter">${grid}</div>${previewHtml(opts.preview)}</div>
      <footer class="brief-footer"><span>Choose ${opts.need === 2 ? 'two fighters' : 'one fighter'}</span>
        <div class="royale-actions">${lockControls(opts.ready, opts.picks.length !== opts.need)}</div></footer>
    </section>`, (button) => act(button.dataset.m!, button.dataset.v));
  bindHeroPreview(panel, opts.preview);
}

// ---------------- Story ----------------

function crewButton(d: FighterDef, picked: boolean, locked = false) {
  return `<button class="badge mini ${picked ? 'focus' : ''}" data-m="pick" data-v="${d.id}" aria-pressed="${picked}" ${locked ? 'disabled' : ''}>
    <span class="face" style="background:${hex(d.color)}">${face(d, 'icon')}</span><span class="bname">${esc(d.displayName)}</span><span class="brole">${esc(d.name)} · ${esc(d.role)}</span></button>`;
}

function fighterSlot(d: FighterDef, kind = '') {
  return `<span class="pslot ${kind}">${face(d, 'icon')}<span><b>${esc(d.displayName)}</b><small>${esc(d.name)}</small></span>${kind === 'guest' ? '<i>Guest</i>' : ''}</span>`;
}

export function renderStoryMap(panel: HTMLElement, p: Progress, chapter: number, act: (a: string, v?: string) => void) {
  const ch = CHAPTERS.find((c) => c.n === chapter)!;
  const tabs = CHAPTERS.map((c) => {
    const ls = LEVELS.filter((l) => l.chapter === c.n);
    const open = isOpen(p, ls[0].id);
    const got = ls.reduce((s, l) => s + (p.stars[l.id] ?? 0), 0);
    return `<button class="district" data-m="chapter" data-v="${c.n}" ${open ? '' : 'disabled'} aria-pressed="${c.n === chapter}">
      ${emblem(`district-${c.n}`, String(c.n), 'ch-emb')}<span><b>${esc(c.place)}</b><small>${open ? `★ ${got}/${ls.length * 3}` : 'Locked'}</small></span></button>`;
  }).join('');
  const levels = LEVELS.filter((l) => l.chapter === chapter).map((l) => {
    const open = isOpen(p, l.id);
    const st = p.stars[l.id] ?? 0;
    const enemies = l.enemies.map((id) => `<span class="lv-face">${face(byId(id), 'icon')}</span>`).join('');
    return `<button class="lv ${open ? '' : 'locked'} ${st ? 'done' : ''} ${/BOSS|FINALE/.test(l.title) ? 'boss' : ''}" data-m="level" data-v="${l.id}" ${open ? '' : 'disabled'}>
      <span class="lv-id">${l.id}</span>
      <span class="lv-faces" aria-hidden="true">${open ? enemies : emblem('lock', '', 'lv-lock')}</span>
      <span class="level-summary"><span class="lv-title">${esc(l.title)}</span><span class="lv-twist">${open ? esc(l.twist) : 'Clear the previous level to unlock.'}</span></span>
      ${open ? `<span class="lv-foot">${stars(st)}${l.unlocks.length ? `<span class="lv-unlock">${st ? 'Recruited' : 'Recruit'} ${l.unlocks.map((id) => esc(byId(id).displayName)).join(', ')}</span>` : ''}</span>` : ''}
    </button>`;
  }).join('');
  const roster = ROSTER.filter((d) => p.unlocked.includes(d.id)).map((d) => `<span class="rs" title="${esc(d.displayName)} · ${esc(d.name)}">${face(d, 'icon')}</span>`).join('');
  show(panel, `
    <section class="story desk-screen">
      <header class="desk-head"><button class="back" data-m="back" aria-label="Menu">Menu</button><h2>Story Mode</h2><span class="story-total">★ ${totalStars(p)}/${LEVELS.length * 3}</span></header>
      <div class="desk-sheet story-desk">
        <nav class="districts" aria-label="Story chapters">${tabs}</nav>
        <div class="story-route">
          <div class="chapter-summary">
            ${emblem(`district-${ch.n}`, '', 'district-art')}
            <div><span>Chapter ${ch.n} · ${esc(ch.place)}</span><h3>${esc(ch.name)}</h3><p>${esc(ch.blurb)}</p></div>
          </div>
          <div class="level-list" aria-label="Chapter levels">${levels}</div>
        </div>
        <div class="crew-strip"><b>Your crew <span>${p.unlocked.length}/${ROSTER.length}</span></b><div>${roster}</div></div>
      </div>
    </section>`, (t) => act(t.dataset.m!, t.dataset.v));
}

export function renderLevel(panel: HTMLElement, l: Level, p: Progress, picks: FighterDef[], detailed: boolean, act: (a: string, v?: string) => void) {
  const speaker = (who: string) => (who === 'you' ? (picks[0] ? picks[0] : byId(p.unlocked[0])) : byId(who));
  const lines = l.intro.map((ln, i) => {
    const d = speaker(ln.who);
    return `<div class="dl ${ln.who === 'you' ? 'me' : ''}" style="--d:${i * 0.15}s"><span class="dl-face">${face(d, 'icon')}</span><div><b>${ln.who === 'you' ? 'You' : esc(d.displayName)}</b><p>${esc(ln.text)}</p></div></div>`;
  }).join('');
  const need = l.yours;
  const grid = ROSTER.filter((d) => p.unlocked.includes(d.id)).map((d) => crewButton(d, picks.includes(d))).join('');
  const slots = Array.from({ length: need }, (_, i) => (picks[i] ? fighterSlot(picks[i]) : `<span class="pslot empty">Open slot</span>`)).join('');
  const gifts = [...(l.opts?.myCards ?? [])].map((id) => CARD_BY_ID.get(id)).filter(Boolean);
  const theirs = [...(l.opts?.enemyCards ?? [])].map((id) => CARD_BY_ID.get(id)).filter(Boolean);
  const best = p.stars[l.id] ?? 0;
  show(panel, `
    <section class="level desk-screen">
      <header class="desk-head"><button class="back" data-m="map" aria-label="Map">Map</button><h2>${esc(l.title)}</h2><span class="brief-score">${l.id} ${stars(best)}</span></header>
      <div class="desk-sheet level-desk">
        <section class="level-brief" aria-labelledby="brief-title">
          <h3 id="brief-title">Match briefing</h3>
          <p class="brief-twist">${esc(l.twist)}</p>
          <div class="lv-rules">
            <span>${l.rule === 'survive' ? 'Survive until the bell' : l.rule === 'timeAttack' ? `Win by K.O. within ${l.opts?.timeLimit ?? 0} s` : 'Knock them out'}</span>
            ${l.classic ? '' : `<span>Draft a card every ${l.opts?.surgeEvery ?? GACHA.surgeEvery} s</span>`}
            <span>★★ finish with 40%+ HP · ★★★ ${l.rule === 'survive' ? 'with 60%+ HP' : `win in under ${l.par} s`}</span>
          </div>
          ${gifts.length || theirs.length ? `<div class="lv-cards">${gifts.length ? `<div><span>You start with</span>${gifts.map((c) => `<span title="${esc(c!.name)}: ${esc(detailed ? c!.detailed : c!.simple)}">${cardIcon(c!)}</span>`).join('')}</div>` : ''}${theirs.length ? `<div><span>They start with</span>${theirs.map((c) => `<span title="${esc(c!.name)}: ${esc(detailed ? c!.detailed : c!.simple)}">${cardIcon(c!)}</span>`).join('')}</div>` : ''}</div>` : ''}
          <div class="dialogue">${lines}</div>
        </section>
        <section class="level-crew" aria-labelledby="crew-title">
          <h3 id="crew-title">Choose your crew</h3>
          <div class="pp-slots">${slots}${l.partner ? fighterSlot(byId(l.partner), 'guest') : ''}<span class="vs-mini">VS</span>${l.enemies.map((id) => fighterSlot(byId(id), 'enemy')).join('')}</div>
          <div class="grid mini-grid">${grid}</div>
        </section>
      </div>
      <div class="brief-footer"><span>${picks.length}/${need} selected</span>
        <button class="primary big" data-m="play" ${picks.length === need ? '' : 'disabled'}>Start level</button></div>
    </section>`, (t) => act(t.dataset.m!, t.dataset.v));
}

/** The result card after a Story level: stars, the rival's last word, new recruits. */
export function storyResultHtml(l: Level, won: boolean, starsGot: number, best: number, reason: string, recruits: FighterDef[], hasNext: boolean) {
  const lines = won ? l.win.map((ln) => `<div class="dl"><span class="dl-face">${face(byId(ln.who), 'icon')}</span><div><b>${esc(byId(ln.who).displayName)}</b><p>${esc(ln.text)}</p></div></div>`).join('') : '';
  return `
    <div class="card story-result ${won ? 'won' : 'lost'}">
      <div class="clip"></div>
      <div class="head"><span>STORY · ${l.id} ${esc(l.title).toUpperCase()}</span><span>${won ? 'CLEARED' : 'TRY AGAIN'}</span></div>
      <h1>${won ? 'Level cleared!' : 'Not this time'} <span class="stamp">${won ? 'Hired' : 'Pending'}</span></h1>
      <div class="sr-stars">${stars(starsGot)}<span>${esc(reason)}${won && best > starsGot ? ` · best ${best}★` : ''}</span></div>
      ${lines ? `<div class="dialogue">${lines}</div>` : ''}
      ${recruits.length ? `<div class="recruits"><b>New recruit${recruits.length > 1 ? 's' : ''}!</b>${recruits.map((d) => `<div class="recruit"><span class="rc-bust">${face(d, 'bust')}</span><span>${esc(d.displayName)} · ${esc(d.name)}</span></div>`).join('')}</div>` : ''}
      <div class="actions">
        ${won && hasNext ? '<button class="primary" data-act="storynext">Next level</button>' : ''}
        <button ${won ? '' : 'class="primary"'} data-act="storyretry">Retry</button>
        <button data-act="storymap">Story map</button>
      </div>
    </div>`;
}
