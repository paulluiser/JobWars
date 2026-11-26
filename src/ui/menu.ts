import { ROSTER } from '../data/roster';
import { PVP_MODES, type PvpMode } from '../net/pvp';
import { RANKS, rankOf, type Profile } from '../modes/mmr';
import { CHAPTERS, LEVELS, isOpen, totalStars, type Level, type Progress } from '../modes/story';
import { CARD_BY_ID } from '../data/cards';
import type { FighterDef } from '../sim/types';
import { face } from './face';
import { cardIcon } from './cards';
import { posterUrl, uiArtUrl } from '../render/art';

/** a menu emblem from the UI sheet (art/PROMPTS_UI.md), or a glyph until it exists */
const emblem = (id: string, glyph: string, cls = 'emb') => {
  const url = uiArtUrl(id);
  return `<span class="${cls}">${url ? `<img src="${url}" alt="">` : `<i>${glyph}</i>`}</span>`;
};
const RANK_GLYPH: Record<string, string> = { Intern: '📛', Associate: '🟢', Specialist: '🔷', Manager: '🟣', Director: '🏅', Executive: '🎖️', CEO: '👑' };
const rankEmblem = (name: string) => emblem(`rank-${name.toLowerCase()}`, RANK_GLYPH[name] ?? '⭐', 'rk-emb');

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const byId = (id: string) => ROSTER.find((d) => d.id === id)!;
const stars = (n: number, of = 3) => `<span class="stars">${'★'.repeat(n)}<i>${'★'.repeat(of - n)}</i></span>`;
const rankBadge = (mmr: number) => {
  const r = rankOf(mmr);
  return `<span class="rank" style="--rk:${r.color}">${rankEmblem(r.name)}${r.name} <b>${mmr}</b></span>`;
};

function show(panel: HTMLElement, html: string, onClick: (t: HTMLElement) => void) {
  panel.innerHTML = html;
  panel.onclick = (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-m]');
    if (t && !(t as HTMLButtonElement).disabled) onClick(t);
  };
  panel.classList.add('show', 'wide');
}

// ---------------- main menu ----------------

export function renderMenu(panel: HTMLElement, profile: Profile, story: Progress, go: (where: 'pvp' | 'story' | 'cpu') => void) {
  const cleared = LEVELS.filter((l) => (story.stars[l.id] ?? 0) > 0).length;
  const portrait = document.body.classList.contains('portrait');
  const poster = posterUrl(portrait);
  // a featured worker rotates beside the cards (the whole roster, in random order)
  const order = [...ROSTER].sort(() => Math.random() - 0.5).slice(0, 8);
  const r = rankOf(profile.mmr);
  show(panel, `
    <div class="menu">
      <div class="m-bg">${poster ? `<div class="m-poster" style="background-image:url('${poster}')"></div>` : `<div class="m-crowd">${order.slice(0, 6).map((d, i) => `<span style="--i:${i}">${face(d, 'bust')}</span>`).join('')}</div>`}</div>
      <div class="m-top">
        <div class="m-title"><span>JOB</span><span>WARS</span></div>
        <div class="m-sub">Real jobs. Real fights. Pick a shift.</div>
      </div>
      <div class="m-cards">
        <button class="m-card pvp" data-m="pvp" style="--i:0">
          <span class="m-strap"></span>${emblem('mode-pvp', '⚔️', 'm-icon')}
          <span class="m-name">Player vs Player</span>
          <span class="m-desc">Classic or Gacha, 1v1 or Tag Team. Quick match or a lobby code.</span>
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
      <div class="m-feature" aria-hidden="true">${order.map((d, i) => `<div class="mf" style="--i:${i}"><div class="mf-bust">${face(d, 'bust')}</div><div class="mf-tag"><b>${esc(d.name)}</b><span>${esc(d.role)} · ${esc(d.quirk)}</span></div></div>`).join('')}</div>
      <div class="m-foot"><span class="rank-chip" style="--rk:${r.color}">${rankEmblem(r.name)} ${r.name}</span><span>Esc: menu · B: cards · K: share · F: fighters</span></div>
    </div>`, (t) => go(t.dataset.m as 'pvp' | 'story' | 'cpu'));
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

// ---------------- PvP ----------------

export interface PvpView {
  mode: PvpMode;
  profile: Profile;
  status: string;
  code: string;
  busy: boolean;
  error: string;
}

export function renderPvp(panel: HTMLElement, v: PvpView, act: (a: string, value?: string) => void, roomHosted = false) {
  const r = rankOf(v.profile.mmr);
  const next = RANKS[RANKS.indexOf(r) + 1];
  const modes = (Object.keys(PVP_MODES) as PvpMode[]).map((m) => `
    <button class="pm ${m === v.mode ? 'on' : ''} ${PVP_MODES[m].gacha ? 'gacha' : ''}" data-m="mode" data-v="${m}" ${v.busy ? 'disabled' : ''}>
      <b>${PVP_MODES[m].name}</b><span>${PVP_MODES[m].tag ? '2V2' : '1V1'}${PVP_MODES[m].gacha ? ' · GACHA' : ''}</span><p>${PVP_MODES[m].blurb}</p>
    </button>`).join('');
  const hist = v.profile.history.slice(0, 6).map((h) => `<span class="h-${h.result}">${h.result} ${h.delta >= 0 ? '+' : ''}${h.delta}</span>`).join('') || '<em>No matches yet</em>';
  show(panel, `
    <div class="pvp">
      <div class="sub-head"><button class="back" data-m="back">‹ Menu</button><h2>Player vs Player</h2></div>
      <div class="pvp-body">
        <div class="pvp-modes">${modes}</div>
        <div class="pvp-side">
          <div class="pvp-rank" style="--rk:${r.color}">
            ${rankEmblem(r.name)}<div class="pr-name">${r.name}</div>
            <div class="pr-mmr">${v.profile.mmr} MMR</div>
            <div class="pr-next">${next ? `${next.min - v.profile.mmr} to ${next.name}` : 'Top rank'}</div>
            <div class="pr-rec">${v.profile.wins}W · ${v.profile.losses}L · ${v.profile.draws}D · peak ${v.profile.peak}</div>
            <div class="pr-hist">${hist}</div>
          </div>
          <button class="primary big" data-m="quick" ${v.busy ? 'disabled' : ''}>Quick match</button>
          <button data-m="host" ${v.busy ? 'disabled' : ''}>Create a lobby</button>
          <div class="join"><input id="joincode" maxlength="5" placeholder="CODE" value="" autocomplete="off" spellcheck="false" ${v.busy ? 'disabled' : ''}><button data-m="join" ${v.busy ? 'disabled' : ''}>Join</button></div>
          ${v.code ? `<div class="lobby-code">Your lobby code<b>${esc(v.code)}</b><button data-m="copycode">Copy</button></div>` : ''}
          ${v.status ? `<div class="pvp-status">${v.busy ? '<i class="spin"></i>' : ''}${esc(v.status)}${v.busy ? ' <button data-m="cancel">Cancel</button>' : ''}</div>` : ''}
          ${v.error ? `<div class="pvp-error">${esc(v.error)}</div>` : ''}
          <p class="pvp-note">${roomHosted ? 'Online rooms can reconnect after a brief disconnect.' : 'Peer-to-peer: both of you need this page open.'} Your rating is kept in this browser.</p>
        </div>
      </div>
    </div>`, (t) => {
    if (t.dataset.m === 'join') act('join', (panel.querySelector('#joincode') as HTMLInputElement).value);
    else act(t.dataset.m!, t.dataset.v);
  });
  const input = panel.querySelector<HTMLInputElement>('#joincode');
  input?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') act('join', input.value);
  });
  input?.addEventListener('input', () => (input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '')));
}

/** Pick your own fighter(s) for a PvP match; the opponent's choice stays hidden until the fight. */
export function renderPvpPick(panel: HTMLElement, opts: { need: number; picks: FighterDef[]; oppReady: boolean; ready: boolean; oppMmr: number; myMmr: number; mode: PvpMode }, act: (a: string, id?: string) => void) {
  const grid = ROSTER.map((d) => `<button class="badge mini ${opts.picks.includes(d) ? 'focus' : ''}" data-m="pick" data-v="${d.id}" ${opts.ready ? 'disabled' : ''}>
      <span class="face" style="background:${hex(d.color)}">${face(d, 'icon')}</span><span class="bname">${d.name}</span><span class="brole">${d.role}</span></button>`).join('');
  const slots = Array.from({ length: opts.need }, (_, i) => opts.picks[i]
    ? `<span class="pslot">${face(opts.picks[i], 'icon')}<b>${opts.picks[i].name}</b></span>` : `<span class="pslot empty">?</span>`).join('');
  show(panel, `
    <div class="pvp-pick">
      <div class="sub-head"><button class="back" data-m="leave">‹ Leave</button><h2>${PVP_MODES[opts.mode].name}</h2>
        <div class="vsline">${rankBadge(opts.myMmr)} <i>vs</i> ${rankBadge(opts.oppMmr)}</div></div>
      <div class="pp-slots">${slots}<span class="pp-opp ${opts.oppReady ? 'ok' : ''}">${opts.oppReady ? 'Opponent is ready' : 'Opponent is choosing…'}</span></div>
      <div class="grid mini-grid">${grid}</div>
      <div class="sel-foot"><span class="hint">${opts.ready ? 'Locked in. Waiting for your opponent…' : `Pick ${opts.need === 2 ? 'two jobs' : 'a job'}. Your opponent won’t see it until the fight.`}</span>
        <button class="primary big" data-m="ready" ${opts.picks.length === opts.need && !opts.ready ? '' : 'disabled'}>Lock in</button></div>
    </div>`, (t) => act(t.dataset.m!, t.dataset.v));
}

// ---------------- Story ----------------

export function renderStoryMap(panel: HTMLElement, p: Progress, chapter: number, act: (a: string, v?: string) => void) {
  const ch = CHAPTERS.find((c) => c.n === chapter)!;
  const tabs = CHAPTERS.map((c) => {
    const ls = LEVELS.filter((l) => l.chapter === c.n);
    const open = isOpen(p, ls[0].id);
    const got = ls.reduce((s, l) => s + (p.stars[l.id] ?? 0), 0);
    return `<button class="ch ${c.n === chapter ? 'on' : ''}" data-m="chapter" data-v="${c.n}" ${open ? '' : 'disabled'} style="--cc:${c.color}">${uiArtUrl(`district-${c.n}`) ? emblem(`district-${c.n}`, '', 'ch-emb') : `<b>${c.n}</b>`}<span>${open ? esc(c.place) : 'Locked'}</span><i>★ ${got}/12</i></button>`;
  }).join('');
  const levels = LEVELS.filter((l) => l.chapter === chapter).map((l) => {
    const open = isOpen(p, l.id);
    const st = p.stars[l.id] ?? 0;
    const enemies = l.enemies.map((id) => `<span class="lv-face">${face(byId(id), 'icon')}</span>`).join('');
    return `<button class="lv ${open ? '' : 'locked'} ${st ? 'done' : ''} ${/BOSS|FINALE/.test(l.title) ? 'boss' : ''}" data-m="level" data-v="${l.id}" ${open ? '' : 'disabled'}>
      <span class="lv-id">${l.id}</span>
      <span class="lv-faces">${open ? enemies : '<span class="lv-lock">🔒</span>'}</span>
      <span class="lv-title">${esc(l.title)}</span>
      <span class="lv-twist">${open ? esc(l.twist) : 'Clear the previous level to open.'}</span>
      <span class="lv-foot">${stars(st)}${l.unlocks.length ? `<span class="lv-unlock">${st ? 'Recruited' : 'Recruit'}: ${l.unlocks.map((id) => byId(id).name).join(', ')}</span>` : ''}</span>
    </button>`;
  }).join('');
  const roster = ROSTER.map((d) => `<span class="rs ${p.unlocked.includes(d.id) ? '' : 'off'}" title="${d.name}">${face(d, 'icon')}</span>`).join('');
  show(panel, `
    <div class="story">
      <div class="sub-head"><button class="back" data-m="back">‹ Menu</button><h2>Story Mode</h2><span class="st-total">★ ${totalStars(p)}/${LEVELS.length * 3}</span></div>
      <div class="chapters">${tabs}</div>
      <div class="ch-head" style="--cc:${ch.color}"><b>Chapter ${ch.n}: ${esc(ch.name)}</b><span>${esc(ch.place)}. ${esc(ch.blurb)}</span></div>
      <div class="levels">${levels}</div>
      <div class="roster-strip"><span>Your crew ${p.unlocked.length}/30</span>${roster}</div>
    </div>`, (t) => act(t.dataset.m!, t.dataset.v));
}

export function renderLevel(panel: HTMLElement, l: Level, p: Progress, picks: FighterDef[], detailed: boolean, act: (a: string, v?: string) => void) {
  const speaker = (who: string) => (who === 'you' ? (picks[0] ? picks[0] : byId(p.unlocked[0])) : byId(who));
  const lines = l.intro.map((ln, i) => {
    const d = speaker(ln.who);
    return `<div class="dl ${ln.who === 'you' ? 'me' : ''}" style="--d:${i * 0.15}s"><span class="dl-face">${face(d, 'icon')}</span><div><b>${ln.who === 'you' ? 'You' : d.name}</b><p>${esc(ln.text)}</p></div></div>`;
  }).join('');
  const need = l.yours;
  const grid = ROSTER.filter((d) => p.unlocked.includes(d.id)).map((d) => `<button class="badge mini ${picks.includes(d) ? 'focus' : ''}" data-m="pick" data-v="${d.id}">
    <span class="face" style="background:${hex(d.color)}">${face(d, 'icon')}</span><span class="bname">${d.name}</span><span class="brole">${d.role}</span></button>`).join('');
  const slots = Array.from({ length: need }, (_, i) => (picks[i] ? `<span class="pslot">${face(picks[i], 'icon')}<b>${picks[i].name}</b></span>` : `<span class="pslot empty">?</span>`)).join('');
  const gifts = [...(l.opts?.myCards ?? [])].map((id) => CARD_BY_ID.get(id)).filter(Boolean);
  const theirs = [...(l.opts?.enemyCards ?? [])].map((id) => CARD_BY_ID.get(id)).filter(Boolean);
  const best = p.stars[l.id] ?? 0;
  show(panel, `
    <div class="level">
      <div class="sub-head"><button class="back" data-m="map">‹ Map</button><h2>${l.id} · ${esc(l.title)}</h2>${stars(best)}</div>
      <div class="lv-body">
        <div class="lv-left">
          <div class="lv-twistbox"><b>Twist</b> ${esc(l.twist)}</div>
          <div class="dialogue">${lines}</div>
          <div class="lv-rules">
            <span>${l.rule === 'survive' ? '🛡️ Survive until the bell' : l.rule === 'timeAttack' ? `⏱️ Win by K.O. within ${l.opts?.timeLimit ?? 0} s` : '🥊 Knock them out'}</span>
            <span>${l.classic ? 'Classic rules (no cards)' : `🃏 Card pick every ${l.opts?.surgeEvery ?? 20} s`}</span>
            <span>★★ finish with 40%+ HP · ★★★ ${l.rule === 'survive' ? 'with 60%+ HP' : `win in under ${l.par} s`}</span>
          </div>
          ${gifts.length || theirs.length ? `<div class="lv-cards">${gifts.length ? `<div><span>You start with</span>${gifts.map((c) => `<span title="${esc(c!.name)}: ${esc(detailed ? c!.detailed : c!.simple)}">${cardIcon(c!)}</span>`).join('')}</div>` : ''}${theirs.length ? `<div><span>They start with</span>${theirs.map((c) => `<span title="${esc(c!.name)}: ${esc(detailed ? c!.detailed : c!.simple)}">${cardIcon(c!)}</span>`).join('')}</div>` : ''}</div>` : ''}
        </div>
        <div class="lv-right">
          <div class="pp-slots">${slots}${l.partner ? `<span class="pslot guest">${face(byId(l.partner), 'icon')}<b>${byId(l.partner).name}</b><i>guest</i></span>` : ''}<span class="vs-mini">VS</span>${l.enemies.map((id) => `<span class="pslot enemy">${face(byId(id), 'icon')}<b>${byId(id).name}</b></span>`).join('')}</div>
          <div class="grid mini-grid">${grid}</div>
        </div>
      </div>
      <div class="sel-foot"><span class="hint">${picks.length < need ? `Choose ${need === 2 ? 'two jobs' : 'a job'} from your crew.` : 'Ready when you are.'}</span>
        <button class="primary big" data-m="play" ${picks.length === need ? '' : 'disabled'}>Start level</button></div>
    </div>`, (t) => act(t.dataset.m!, t.dataset.v));
}

/** The result card after a Story level: stars, the rival's last word, new recruits. */
export function storyResultHtml(l: Level, won: boolean, starsGot: number, best: number, reason: string, recruits: FighterDef[], hasNext: boolean) {
  const lines = won ? l.win.map((ln) => `<div class="dl"><span class="dl-face">${face(byId(ln.who), 'icon')}</span><div><b>${byId(ln.who).name}</b><p>${esc(ln.text)}</p></div></div>`).join('') : '';
  return `
    <div class="card story-result ${won ? 'won' : 'lost'}">
      <div class="clip"></div>
      <div class="head"><span>STORY · ${l.id} ${esc(l.title).toUpperCase()}</span><span>${won ? 'CLEARED' : 'TRY AGAIN'}</span></div>
      <h1>${won ? 'Level cleared!' : 'Not this time'} <span class="stamp">${won ? 'Hired' : 'Pending'}</span></h1>
      <div class="sr-stars">${stars(starsGot)}<span>${esc(reason)}${won && best > starsGot ? ` · best ${best}★` : ''}</span></div>
      ${lines ? `<div class="dialogue">${lines}</div>` : ''}
      ${recruits.length ? `<div class="recruits"><b>New recruit${recruits.length > 1 ? 's' : ''}!</b>${recruits.map((d) => `<div class="recruit"><span class="rc-bust">${face(d, 'bust')}</span><span>${d.name}</span></div>`).join('')}</div>` : ''}
      <div class="actions">
        ${won && hasNext ? '<button class="primary" data-act="storynext">Next level</button>' : ''}
        <button ${won ? '' : 'class="primary"'} data-act="storyretry">Retry</button>
        <button data-act="storymap">Story map</button>
      </div>
    </div>`;
}
