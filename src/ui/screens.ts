import { ROSTER } from '../data/roster';
import type { Sim } from '../sim/sim';
import type { Fighter, FighterDef, Role } from '../sim/types';
import { face } from './face';
import { signature } from '../data/attributes';
import { SIZES, type Format } from '../modes/tournament';
import { CARD_BY_ID } from '../data/cards';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lanyard colours per role (design doc §5.5). */
export const ROLE_COLORS: Record<Role, string> = {
  Tank: '#2b4a8a', Fighter: '#d9452b', Assassin: '#2a2a2a', Mage: '#7a4ab8', Marksman: '#3f8a4a', Support: '#f2efe6', Controller: '#e8892a',
};

/** The 11 attributes, read from the live (tuned) stats so the bars tell the truth. */
const ATTR_ROWS: { label: string; get: (d: FighterDef) => number; fmt: (v: number) => string; invert?: boolean }[] = [
  { label: 'HP', get: (d) => d.hp, fmt: (v) => String(v) },
  { label: 'Attack', get: (d) => d.atk, fmt: (v) => String(Math.round(v)) },
  { label: 'Defense', get: (d) => d.def, fmt: (v) => String(Math.round(v)) },
  { label: 'Attack speed', get: (d) => 1 / (d.windup + d.recover + d.attackCooldown), fmt: (v) => `${v.toFixed(2)}/s` },
  { label: 'Move speed', get: (d) => d.speed, fmt: (v) => String(v) },
  { label: 'Reach', get: (d) => d.range, fmt: (v) => String(v) },
  { label: 'Accuracy', get: (d) => d.accuracy, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'Evasion', get: (d) => d.evasion, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'Block', get: (d) => d.blockChance, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'Crit', get: (d) => d.critChance, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: 'Weight', get: (d) => d.weight, fmt: (v) => v.toFixed(2) },
];

function statBars(d: FighterDef) {
  const sig = signature(d.id);
  const rows = ATTR_ROWS.map(({ label, get, fmt }) => {
    const vals = ROSTER.map(get);
    const min = Math.min(...vals), max = Math.max(...vals);
    const v = get(d);
    const p = 8 + ((v - min) / (max - min || 1)) * 92;
    const cls = label === sig.best ? 'best' : label === sig.worst ? 'worst' : '';
    return `<div class="stat ${cls}"><span>${label}</span><div class="sbar"><div style="width:${p.toFixed(0)}%"></div></div><b>${fmt(v)}</b></div>`;
  }).join('');
  return `<div class="sig"><span class="sig-best">Strength: ${sig.best}</span><span class="sig-worst">Weakness: ${sig.worst}</span></div><div class="stats">${rows}</div>`;
}

function skillBlock(kind: string, tag: string, name: string, text: string, extra = '') {
  return `<div class="skill ${kind}"><div class="skill-tag">${tag}</div><div class="skill-name">${esc(name)}</div><p>${esc(text)}</p>${extra}</div>`;
}

export type Mode = 'duel' | 'tag' | 'tourney';
export const MODE_LABEL: Record<Mode, string> = { duel: '1v1', tag: 'Tag Team', tourney: 'Tournament' };

export interface SelectState {
  mode: Mode;
  /** duel: [blue, red]; tag: [blue 1, blue 2, red 1, red 2] */
  picks: FighterDef[];
  slot: number;
  focus: FighterDef;
  detailed: boolean;
  role?: Role | 'All';
  /** tournament: chosen entrants (the rest are drawn at random), bracket size and format */
  entrants: FighterDef[];
  tSize: number;
  tFormat: Format;
  /** CPU Battle 1v1 / Tag Team: play it as a Gacha match (you draft for Blue, the CPU for Red) */
  gacha: boolean;
}

export type SelectResult =
  | { mode: 'duel' | 'tag'; picks: FighterDef[]; gacha: boolean }
  | { mode: 'tourney'; entrants: FighterDef[]; format: Format };

const ROLES: (Role | 'All')[] = ['All', 'Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support', 'Controller'];
/** n different jobs at random, keeping the ones in `keep` */
export function randomJobs(n: number, keep: FighterDef[] = []): FighterDef[] {
  const out = keep.slice(0, n);
  const pool = ROSTER.filter((d) => !out.includes(d));
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
/** how many jobs a tournament needs: one per entry (duel), two per team (tag) */
export const jobsNeeded = (st: Pick<SelectState, 'tSize' | 'tFormat'>) => st.tSize * (st.tFormat === 'tag' ? 2 : 1);
const teamOf = (st: SelectState, slot: number) => (slot < st.picks.length / 2 ? 0 : 1);

/** Resize the picks when switching between 1v1 (2 jobs) and Tag Team (4 jobs). */
export function setMode(st: SelectState, mode: Mode) {
  st.mode = mode;
  const other = (not: FighterDef) => randomJobs(2).find((d) => d.id !== not.id)!;
  if (mode === 'tag' && st.picks.length === 2) st.picks = [st.picks[0], other(st.picks[0]), st.picks[1], other(st.picks[1])];
  if (mode === 'duel' && st.picks.length === 4) st.picks = [st.picks[0], st.picks[2]];
  st.slot = Math.min(st.slot, st.picks.length - 1);
  if (mode === 'tourney' && st.tFormat === 'tag' && st.tSize > 8) st.tSize = 8;
}

/**
 * Character select, in three modes:
 *  - 1v1 / Tag Team: pick every slot freely (mirror matches allowed). Clicking a badge fills the
 *    active slot and moves on to the next one.
 *  - Tournament: click badges to enter them (or leave it to chance), pick the bracket size, start.
 * Simple/Detailed toggles the skill descriptions either way.
 */
export function renderSelect(panel: HTMLElement, st: SelectState, onGo: (r: SelectResult) => void, onMode?: (m: Mode) => void) {
  let hintFlash = '';
  const draw = () => {
    const { picks, slot, focus, detailed, mode } = st;
    const tag = mode === 'tag';
    const slotHtml = (i: number) => {
      const d = picks[i];
      const red = teamOf(st, i) === 1;
      const n = tag ? ` ${(i % 2) + 1}` : '';
      return `<button class="slot ${red ? 'red' : 'blue'} ${tag ? 'small' : ''} ${slot === i ? 'active' : ''}" data-slot="${i}" aria-pressed="${slot === i}">
        <span class="slot-tag">${red ? 'RED' : 'BLUE'}${n}</span>
        <span class="slot-face">${face(d, 'icon')}</span>
        <span class="slot-name">${d.name}</span>
        <span class="slot-role">${d.role}</span>
      </button>`;
    };
    const need = jobsNeeded(st);
    const head = mode === 'tourney'
      ? `<div class="t-setup">
          <div class="t-opts">
            <div class="seg" role="group" aria-label="Format">${(['duel', 'tag'] as Format[]).map((f) => `<button data-tformat="${f}" class="${st.tFormat === f ? 'on' : ''}" aria-pressed="${st.tFormat === f}">${f === 'duel' ? '1v1 bracket' : 'Tag Team bracket'}</button>`).join('')}</div>
            <div class="seg" role="group" aria-label="Bracket size">${SIZES.filter((n) => st.tFormat === 'duel' || n <= 8).map((n) => `<button data-tsize="${n}" class="${st.tSize === n ? 'on' : ''}" aria-pressed="${st.tSize === n}">${n} ${st.tFormat === 'tag' ? 'teams' : 'jobs'}</button>`).join('')}</div>
          </div>
          <div class="t-entrants" aria-label="Entrants">
            ${Array.from({ length: need }, (_, i) => {
              const d = st.entrants[i];
              const pair = st.tFormat === 'tag' && i % 2 === 1 ? ' pair' : '';
              return d
                ? `<button class="ent${pair}" data-unenter="${d.id}" title="Remove ${d.name}">${face(d, 'icon')}<span>${d.name}</span></button>`
                : `<span class="ent empty${pair}">?</span>`;
            }).join('')}
          </div>
        </div>`
      : `<div class="sel-head">
          ${tag ? `<div class="team blue">${slotHtml(0)}${slotHtml(1)}</div>` : slotHtml(0)}
          <div class="vs-mid">VS</div>
          ${tag ? `<div class="team red">${slotHtml(2)}${slotHtml(3)}</div>` : slotHtml(1)}
        </div>`;
    const role = st.role ?? 'All';
    const filters = ROLES.map((r) => `<button class="rf ${r === role ? 'on' : ''}" data-role="${r}" style="--rc:${r === 'All' ? '#2a1d14' : ROLE_COLORS[r]}" aria-pressed="${r === role}">${r}</button>`).join('');
    const badges = ROSTER.filter((d) => role === 'All' || d.role === role).map((d) => {
      let marks = '';
      if (mode === 'tourney') {
        const k = st.entrants.indexOf(d);
        if (k >= 0) marks = `<i class="mk in">${st.tFormat === 'tag' ? `T${(k >> 1) + 1}` : '✓'}</i>`;
      } else {
        picks.forEach((p, i) => {
          if (p.id === d.id) marks += `<i class="mk ${teamOf(st, i) ? 'red' : 'blue'}">${teamOf(st, i) ? 'R' : 'B'}</i>`;
        });
      }
      return `<button class="badge ${focus.id === d.id ? 'focus' : ''}" data-pick="${d.id}" style="--rc:${ROLE_COLORS[d.role]}">
        <span class="strap"></span>
        <span class="face" style="background:${hex(d.color)}">${face(d, 'icon')}</span>
        <span class="bname">${d.name}</span>
        <span class="brole">${d.role}</span>
        <span class="marks">${marks}</span>
      </button>`;
    }).join('');
    const f = focus;
    const tabs = (Object.keys(MODE_LABEL) as Mode[]).map((m) => `<button data-mode="${m}" class="${m === mode ? 'on' : ''}" role="tab" aria-selected="${m === mode}">${MODE_LABEL[m]}</button>`).join('');
    const slotName = tag ? `${teamOf(st, slot) ? 'RED' : 'BLUE'} ${(slot % 2) + 1}` : slot ? 'RED' : 'BLUE';
    const hint = hintFlash || (mode === 'tourney'
      ? `${st.entrants.length} / ${need} picked · ${st.entrants.length < need ? 'the rest are drawn at random' : 'bracket full'}${st.tFormat === 'tag' ? ' · picks pair up in order' : ''}`
      : `Pick ${slotName}: click a badge`);
    const foot = mode === 'tourney'
      ? `<button data-sel="tfill">Random fill</button>
         <button data-sel="tclear">Clear</button>
         <span class="hint">${hint}</span>
         <button class="primary big" data-sel="go">Start tournament</button>`
      : `<button data-sel="rand">Random ${tag ? 'teams' : 'both'}</button>
         <button data-sel="swap">Swap sides</button>
         <button data-sel="gacha" class="gacha-toggle ${st.gacha ? 'on' : ''}" aria-pressed="${st.gacha}" title="You draft cards for Blue every 20 s; the CPU drafts for Red">Gacha ${st.gacha ? 'ON' : 'OFF'}</button>
         <span class="hint">${hint}</span>
         <button class="primary big" data-sel="go">Fight!</button>`;
    panel.innerHTML = `
      <div class="select mode-${mode}">
        <div class="modes" role="tablist" aria-label="Game mode"><button class="back" data-sel="back" aria-label="Back to the main menu">‹ Menu</button>${tabs}</div>
        ${head}
        <div class="sel-body">
          <div class="pick-col"><div class="filters" role="group" aria-label="Filter by role">${filters}</div><div class="grid">${badges}</div></div>
          <div class="detail" style="--rc:${ROLE_COLORS[f.role]}">
            <div class="d-head">
              <div class="d-face" style="background:${hex(f.color)}">${face(f, 'icon')}</div>
              <div>
                <div class="d-name">${f.name} <span class="d-role">${f.role}</span></div>
                <div class="d-title">${esc(f.title)} · covers ${esc(f.mergedFrom)}</div>
                <div class="d-quirk">${esc(f.quirk)}</div>
              </div>
            </div>
            ${statBars(f)}
            <div class="seg" role="group" aria-label="Description detail">
              <button data-sel="simple" class="${detailed ? '' : 'on'}" aria-pressed="${!detailed}">Simple</button>
              <button data-sel="detailed" class="${detailed ? 'on' : ''}" aria-pressed="${detailed}">Detailed</button>
            </div>
            ${skillBlock('passive', 'PASSIVE', f.passive.name, detailed ? f.passive.detailed : f.passive.simple)}
            ${skillBlock('active', `ACTIVE · ${f.active.cooldown}s cooldown`, f.active.name, detailed ? f.active.detailed : f.active.simple)}
            ${skillBlock('special', 'SPECIAL · fires when the rage bar is full', f.special.name, detailed ? f.special.detailed : f.special.simple, `<div class="quote">“${esc(f.special.quote)}”</div>`)}
          </div>
        </div>
        <div class="sel-foot">${foot}</div>
        <div class="credits">Sound effects: <a href="https://developers.meta.com/vr/downloads/package/oculus-audio-pack-1/" target="_blank" rel="noopener">“Oculus Audio Pack 01”</a> by Oculus VR, LLC, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> (cut and levelled for this game).</div>
      </div>`;
    hintFlash = '';
  };

  panel.onclick = (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-sel],[data-pick],[data-role],[data-mode],[data-slot],[data-tsize],[data-tformat],[data-unenter]');
    if (!t) return;
    const d = t.dataset;
    if (d.role) st.role = d.role as Role | 'All';
    else if (d.mode) {
      setMode(st, d.mode as Mode);
      onMode?.(st.mode);
    } else if (d.slot) {
      st.slot = Number(d.slot);
      st.focus = st.picks[st.slot];
    } else if (d.tsize) {
      st.tSize = Number(d.tsize);
      st.entrants = st.entrants.slice(0, jobsNeeded(st));
    } else if (d.tformat) {
      st.tFormat = d.tformat as Format;
      if (st.tFormat === 'tag' && st.tSize > 8) st.tSize = 8;
      st.entrants = st.entrants.slice(0, jobsNeeded(st));
    } else if (d.unenter) {
      st.entrants = st.entrants.filter((x) => x.id !== d.unenter);
    } else if (d.pick) {
      const job = ROSTER.find((r) => r.id === d.pick)!;
      st.focus = job;
      if (st.mode === 'tourney') {
        if (st.entrants.includes(job)) st.entrants = st.entrants.filter((x) => x !== job);
        else if (st.entrants.length < jobsNeeded(st)) st.entrants.push(job);
        else hintFlash = 'The bracket is full: remove someone first';
      } else {
        st.picks[st.slot] = job;
        st.slot = (st.slot + 1) % st.picks.length;
      }
    } else
      switch (d.sel) {
        case 'simple':
        case 'detailed':
          st.detailed = d.sel === 'detailed';
          try { localStorage.setItem('detailMode', st.detailed ? 'detailed' : 'simple'); } catch {}
          break;
        case 'rand':
          st.picks = randomJobs(st.picks.length);
          st.focus = st.picks[0];
          break;
        case 'swap': {
          const h = st.picks.length / 2;
          st.picks = [...st.picks.slice(h), ...st.picks.slice(0, h)];
          break;
        }
        case 'gacha':
          st.gacha = !st.gacha;
          try { localStorage.setItem('cpuGacha', st.gacha ? '1' : '0'); } catch {}
          break;
        case 'back':
          panel.onclick = null;
          onGo({ mode: 'menu' } as never);
          return;
        case 'tfill':
          st.entrants = randomJobs(jobsNeeded(st), st.entrants);
          break;
        case 'tclear':
          st.entrants = [];
          break;
        case 'go':
          panel.onclick = null;
          if (st.mode === 'tourney') onGo({ mode: 'tourney', entrants: randomJobs(jobsNeeded(st), st.entrants), format: st.tFormat });
          else onGo({ mode: st.mode, picks: st.picks.slice(), gacha: st.gacha });
          return;
      }
    draw();
  };
  draw();
  panel.classList.add('show', 'wide');
}

export const teamName = (fs: { def: FighterDef }[]) => fs.map((f) => f.def.name).join(' & ');

export function renderResults(panel: HTMLElement, sim: Sim, teamHex: string[], opts: { tourney?: string; actions?: string; names?: [string, string] } = {}) {
  const w = sim.winner;
  const winners = w === -1 || w === null ? [] : sim.fighters.filter((f) => f.team === w);
  const rows: [string, (f: Fighter) => string][] = [
    ['HP left', (f) => `${Math.round((f.hp / f.maxHp) * 100)}%`],
    ['Damage dealt', (f) => String(Math.round(f.stats.damageDealt))],
    ['Healing', (f) => String(Math.round(f.stats.healing))],
    ['Swings / hits', (f) => `${f.stats.swings} / ${f.stats.hits}`],
    ['Crits / misses', (f) => `${f.stats.crits} / ${f.stats.misses}`],
    ['Blocks / parries / dodges', (f) => `${f.stats.blocks} / ${f.stats.parries} / ${f.stats.dodges}`],
    ['Skills used', (f) => `${f.stats.actives}`],
    ['Specials', (f) => (f.stats.specials ? `${f.def.special.name}${f.stats.specials > 1 ? ` ×${f.stats.specials}` : ''}` : '—')],
  ];
  const fs = sim.fighters;
  const many = fs.length > 2;
  panel.onclick = null;
  panel.classList.remove('wide');
  const title = !winners.length ? 'Draw' : opts.names ? `${opts.names[w as number]} win${opts.names[w as number] === 'You' ? '!' : 's'}` : `${teamName(winners)} win${winners.length > 1 ? '' : 's'}`;
  const cardsRow = fs.some((f) => f.cards.length)
    ? `<tr><td>Cards</td>${fs.map((f) => `<td class="rcards">${f.cards.map((id) => CARD_BY_ID.get(id)?.glyph ?? '').join('')}</td>`).join('')}</tr>` : '';
  panel.innerHTML = `
    <div class="card ${many ? 'card-wide' : ''}">
      <div class="clip"></div>
      <div class="head"><span>${opts.tourney ? `${esc(opts.tourney.toUpperCase())} · ` : ''}MATCH REPORT · SEED ${sim.seed}</span><span>${sim.t.toFixed(1)}s</span></div>
      <h1>${title} <span class="stamp">${winners.length ? 'Approved' : 'Tie'}</span></h1>
      <table>
        <tr><th></th>${fs.map((f) => `<th style="color:${teamHex[f.team]}">${f.def.name}</th>`).join('')}</tr>
        ${rows.map(([k, fn]) => `<tr><td>${k}</td>${fs.map((f) => `<td>${fn(f)}</td>`).join('')}</tr>`).join('')}
        ${cardsRow}
      </table>
      <div class="actions">
        ${opts.actions ? opts.actions : opts.tourney
          ? `<button class="primary" data-act="bracket">Back to bracket</button>
             <button data-act="replay">Watch again</button>
             <button data-act="share">Share this fight</button>`
          : `<button class="primary" data-act="new">Rematch</button>
             <button data-act="replay">Replay seed ${sim.seed}</button>
             <button data-act="share">Share this fight</button>
             <button data-act="select">Change fighters</button>`}
      </div>
    </div>`;
  panel.classList.add('show');
}
