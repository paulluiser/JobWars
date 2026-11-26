import { ROSTER } from '../data/roster';
import { ARENA_NAMES, isArenaId, type ArenaChoice } from '../data/arenas';
import type { Sim } from '../sim/sim';
import type { BattleSide, Fighter, FighterDef, Role } from '../sim/types';
import { face } from './face';
import { signature } from '../data/attributes';
import { SIZES, type Format } from '../modes/tournament';
import { CARD_BY_ID, GACHA } from '../data/cards';
import { skillIcon, type SkillKind } from './skillArt';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lanyard colours per role (design doc §5.5). */
export const ROLE_COLORS: Record<Role, string> = {
  Tank: '#2b4a8a', Fighter: '#d9452b', Assassin: '#2a2a2a', Mage: '#7a4ab8', Marksman: '#3f8a4a', Support: '#f2efe6', Controller: '#e8892a',
};

/** Profile attributes from the live, tuned fighter definitions. */
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
  { label: 'Skill power', get: (d) => d.skillAtk ?? d.atk, fmt: (v) => String(Math.round(v)) },
];

function statBars(d: FighterDef) {
  const sig = signature(d.id);
  const statName = (label: string) => label === 'Attack' ? 'Basic attack' : label;
  const rows = ATTR_ROWS.map(({ label, get, fmt }) => {
    const vals = ROSTER.map(get);
    const min = Math.min(...vals), max = Math.max(...vals);
    const v = get(d);
    const p = 8 + ((v - min) / (max - min || 1)) * 92;
    const cls = label === sig.best ? 'best' : label === sig.worst ? 'worst' : '';
    return `<div class="stat ${cls}"><span>${statName(label)}</span><div class="sbar"><div style="width:${p.toFixed(0)}%"></div></div><b>${fmt(v)}</b></div>`;
  }).join('');
  return `<div class="sig"><span class="sig-best">Strength: ${statName(sig.best)}</span><span class="sig-worst">Weakness: ${statName(sig.worst)}</span></div><div class="stats">${rows}</div>`;
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
  arena: ArenaChoice;
}

export type SelectResult =
  | { mode: 'menu' }
  | { mode: 'duel' | 'tag'; picks: FighterDef[]; gacha: boolean; arena: ArenaChoice }
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

export function fighterProfileHtml(focus: FighterDef, detailed: boolean, skill: SkillKind) {
  const ability = (kind: SkillKind) => {
    const move = focus[kind];
    const meta = kind === 'active' ? `${focus.active.cooldown}s cooldown` : kind === 'special' ? `${focus.special.cooldown}s charge · full rage` : 'Always on';
    return `<div class="skill ${kind}">
      ${skillIcon(focus.id, kind)}
      <div class="skill-copy"><div class="skill-tag">${kind} · ${meta}</div>
      <div class="skill-name">${esc(move.name)}</div><p>${esc(detailed ? move.detailed : move.simple)}</p>
      ${detailed && kind === 'special' ? `<div class="quote">“${esc(focus.special.quote)}”</div>` : ''}</div>
    </div>`;
  };
  const kinds: SkillKind[] = ['passive', 'active', 'special'];
  return `<div class="d-head">
      <div class="d-face" style="background:${hex(focus.color)}">${face(focus, 'icon')}</div>
      <div><div class="d-name">${esc(focus.displayName)}</div>
      <div class="d-identity">${esc(focus.name)} <span class="d-role">${focus.role}</span></div>
      <div class="d-title">${esc(focus.title)} · covers ${esc(focus.mergedFrom)}</div>
      <p class="d-quirk">${esc(focus.quirk)}</p></div>
    </div>
    <div class="profile-stats">${statBars(focus)}</div>
    <div class="profile-toolbar">
      <div class="skill-tabs" role="group" aria-label="Choose a skill">${kinds.map((kind) =>
        `<button data-inspect="${kind}" aria-pressed="${skill === kind}">${kind}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Description detail">
        <button data-sel="simple" class="${detailed ? '' : 'on'}" aria-pressed="${!detailed}">Simple</button>
        <button data-sel="detailed" class="${detailed ? 'on' : ''}" aria-pressed="${detailed}">Detailed</button>
      </div>
    </div>
    ${ability(skill)}
  `;
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
  let skill: SkillKind = 'passive';
  const tabs = (Object.keys(MODE_LABEL) as Mode[]).map((m) =>
    `<button data-mode="${m}" role="tab">${MODE_LABEL[m]}</button>`).join('');
  const filters = ROLES.map((r) =>
    `<button class="rf" data-role="${r}" style="--rc:${r === 'All' ? '#2a1d14' : ROLE_COLORS[r]}">${r}</button>`).join('');

  panel.innerHTML = `<div class="select">
    <header class="select-top">
      <button class="back" data-sel="back" aria-label="Back to the main menu">‹ Menu</button>
      <h2>CPU Battle</h2>
      <nav class="modes" role="tablist" aria-label="Battle mode">${tabs}</nav>
    </header>
    <div data-roster-setup></div>
    <div class="sel-body">
      <div class="pick-col">
        <div class="filters" role="group" aria-label="Filter by role">${filters}</div>
        <div class="grid" aria-label="Fighters">
        ${ROSTER.map((d) => `<button class="badge" data-pick="${d.id}" style="--rc:${ROLE_COLORS[d.role]}"
          aria-label="${esc(d.displayName)}, ${esc(d.name)}, ${d.role}">
          <span class="strap"></span>
          <span class="face" style="background:${hex(d.color)}">${face(d, 'icon')}</span>
          <span class="bname">${esc(d.displayName)}</span><span class="brole">${esc(d.name)}</span>
          <span class="marks" aria-hidden="true"></span>
        </button>`).join('')}
        </div>
      </div>
      <aside class="detail fighter-profile" aria-label="Fighter profile"></aside>
    </div>
    <footer class="roster-footer">
      <div class="sel-foot" data-roster-actions></div>
      <div class="credits">Sound effects from <a href="https://developers.meta.com/vr/downloads/package/oculus-audio-pack-1/" target="_blank" rel="noopener">Oculus Audio Pack 01</a> by Oculus VR, LLC, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</div>
    </footer>
  </div>`;
  const screen = panel.firstElementChild as HTMLElement;
  const setup = screen.querySelector<HTMLElement>('[data-roster-setup]')!;
  const detail = screen.querySelector<HTMLElement>('.detail')!;
  const dock = screen.querySelector<HTMLElement>('[data-roster-actions]')!;
  const modeButtons = screen.querySelectorAll<HTMLButtonElement>('[data-mode]');
  const filterButtons = screen.querySelectorAll<HTMLButtonElement>('[data-role]');
  const badges = screen.querySelectorAll<HTMLButtonElement>('[data-pick]');
  const regions = new Map<HTMLElement, string>();
  const update = (region: HTMLElement, html: string) => {
    if (regions.get(region) === html) return;
    const focused = document.activeElement as HTMLElement | null;
    const focusAttribute = region.contains(focused)
      ? ['data-sel', 'data-inspect', 'data-slot', 'data-unenter', 'data-tformat', 'data-tsize'].find((a) => focused?.hasAttribute(a))
      : undefined;
    const focusValue = focusAttribute ? focused?.getAttribute(focusAttribute) : null;
    region.innerHTML = html;
    regions.set(region, html);
    if (focusAttribute && focusValue) region.querySelector<HTMLElement>(`[${focusAttribute}="${CSS.escape(focusValue)}"]`)?.focus({ preventScroll: true });
  };

  const draw = () => {
    const { picks, slot, focus, detailed, mode } = st;
    const tag = mode === 'tag';
    const tourney = mode === 'tourney';
    const role = st.role ?? 'All';
    screen.className = `select mode-${mode}${screen.classList.contains('p-enter') ? ' p-enter' : ''}`;
    for (const btn of modeButtons) {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('on', active);
      btn.setAttribute('aria-selected', String(active));
    }
    for (const btn of filterButtons) {
      const active = btn.dataset.role === role;
      btn.classList.toggle('on', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    badges.forEach((button, index) => {
      const d = ROSTER[index];
      button.hidden = role !== 'All' && role !== d.role;
      button.classList.toggle('focus', focus.id === d.id);
      const marks = button.querySelector<HTMLElement>('.marks')!;
      if (tourney) {
        const position = st.entrants.indexOf(d);
        update(marks, position < 0 ? '' : `<i class="mk in">${st.tFormat === 'tag' ? `T${(position >> 1) + 1}` : '✓'}</i>`);
      } else {
        update(marks, picks.map((fighter, i) => fighter.id === d.id ?
          teamOf(st, i) ? '<i class="mk red">R</i>' : '<i class="mk blue">B</i>' : '').join(''));
      }
    });

    const slotHtml = (i: number) => {
      const d = picks[i];
      const red = teamOf(st, i) === 1;
      const group = red ? 'Red' : 'Blue';
      return `<button class="slot ${red ? 'red' : 'blue'} ${tag ? 'small' : ''} ${slot === i ? 'active' : ''}" data-slot="${i}" aria-pressed="${slot === i}">
        <span class="slot-tag">${group}${tag ? ` ${i % 2 + 1}` : ''}</span>
        <span class="slot-face">${face(d, 'icon')}</span>
        <span class="slot-name">${esc(d.displayName)}</span>
        <span class="slot-role">${esc(d.name)}</span>
      </button>`;
    };
    const entrant = (i: number) => {
      const d = st.entrants[i];
      return d
        ? `<button class="ent" data-unenter="${d.id}" title="Remove ${esc(d.displayName)}">${face(d, 'icon')}<span>${esc(d.displayName)}</span></button>`
        : '<span class="ent empty" aria-label="Open slot">–</span>';
    };
    const need = jobsNeeded(st);
    update(setup, tourney
      ? `<div class="t-setup">
          <div class="t-opts">
            <div class="seg" role="group" aria-label="Format">${(['duel', 'tag'] as Format[]).map((f) => `<button data-tformat="${f}" class="${st.tFormat === f ? 'on' : ''}" aria-pressed="${st.tFormat === f}">${f === 'duel' ? '1v1 bracket' : 'Tag Team bracket'}</button>`).join('')}</div>
            <div class="seg" role="group" aria-label="Bracket size">${SIZES.filter((n) => st.tFormat === 'duel' || n <= 8).map((n) => `<button data-tsize="${n}" class="${st.tSize === n ? 'on' : ''}" aria-pressed="${st.tSize === n}">${n} ${st.tFormat === 'tag' ? 'teams' : 'fighters'}</button>`).join('')}</div>
          </div>
          <div class="t-entrants ${st.tFormat === 'tag' ? 'team-entrants' : ''}" aria-label="Entrants">${st.tFormat === 'tag'
            ? Array.from({ length: st.tSize }, (_, i) => `<div class="entrant-team" aria-label="Team ${i + 1}">${entrant(i * 2)}${entrant(i * 2 + 1)}</div>`).join('')
            : Array.from({ length: need }, (_, i) => entrant(i)).join('')}</div>
        </div>`
      : `<div class="sel-head">
          ${tag ? `<div class="team blue">${slotHtml(0)}${slotHtml(1)}</div>` : slotHtml(0)}
          <div class="vs-mid" aria-hidden="true">VS</div>
          ${tag ? `<div class="team red">${slotHtml(2)}${slotHtml(3)}</div>` : slotHtml(1)}
        </div>`);

    detail.style.setProperty('--rc', ROLE_COLORS[focus.role]);
    update(detail, fighterProfileHtml(focus, detailed, skill));

    const position = `${teamOf(st, slot) ? 'Red' : 'Blue'}${tag ? ` ${slot % 2 + 1}` : ''}`;
    const hint = hintFlash || (tourney
      ? `${st.entrants.length}/${need} selected${st.entrants.length < need ? ' · Empty slots fill at random' : ''}`
      : `Picking for ${position}`);
    update(dock, `<div class="setup-tools">${tourney
      ? '<button data-sel="tfill">Random fill</button><button data-sel="tclear">Clear</button>'
      : `<button data-sel="rand">Random</button><button data-sel="swap">Swap</button>
        <button data-sel="gacha" class="gacha-toggle ${st.gacha ? 'on' : ''}" aria-pressed="${st.gacha}" title="Draft cards for Blue every ${GACHA.surgeEvery} seconds">Gacha ${st.gacha ? 'on' : 'off'}</button>
        <label class="arena-pick">Arena <select data-arena><option value="auto">Auto</option>
          ${Object.entries(ARENA_NAMES).map(([id, name]) => `<option value="${id}" ${st.arena === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}
        </select></label>`}</div>
      <div class="setup-start"><span class="hint" role="status"></span><button class="primary big" data-sel="go">${tourney ? 'Start tournament' : 'Fight!'}</button></div>`);
    const hintEl = dock.querySelector<HTMLElement>('.hint')!;
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
    hintFlash = '';
  };

  screen.onchange = (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.matches('[data-arena]') && (select.value === 'auto' || isArenaId(select.value))) st.arena = select.value;
  };

  panel.onclick = (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-sel],[data-pick],[data-role],[data-mode],[data-slot],[data-tsize],[data-tformat],[data-unenter],[data-inspect]');
    if (!target || !screen.contains(target)) return;
    const d = target.dataset;
    if (d.role) st.role = d.role as Role | 'All';
    else if (d.mode) {
      setMode(st, d.mode as Mode);
      onMode?.(st.mode);
    } else if (d.slot !== undefined) {
      st.slot = Number(d.slot);
      st.focus = st.picks[st.slot];
    } else if (d.inspect) skill = d.inspect as SkillKind;
    else if (d.tsize) {
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
        else hintFlash = 'Bracket full. Remove a fighter first.';
      } else {
        st.picks[st.slot] = job;
        st.slot = (st.slot + 1) % st.picks.length;
      }
    } else {
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
          onGo({ mode: 'menu' });
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
          else onGo({ mode: st.mode, picks: st.picks.slice(), gacha: st.gacha, arena: st.arena });
          return;
      }
    }
    draw();
  };
  draw();
  panel.classList.add('show', 'wide');
}

export const teamName = (fs: { def: FighterDef }[]) => fs.map((f) => f.def.displayName).join(' & ');

export function renderResults(panel: HTMLElement, sim: Sim, teamHex: string[], opts: { tourney?: string; actions?: string; names?: string[]; localSide?: BattleSide } = {}) {
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
  const winner = winners[0]?.team;
  const name = winner === undefined ? undefined : opts.names?.[winner];
  const title = winner === undefined ? 'Draw' : opts.localSide === winner || name === 'You' ? 'You win!'
    : name ? `${name} wins` : `${teamName(winners)} win${winners.length > 1 ? '' : 's'}`;
  const cardsRow = fs.some((f) => f.cards.length)
    ? `<tr><td>Cards</td>${fs.map((f) => `<td class="rcards">${f.cards.map((id) => CARD_BY_ID.get(id)?.glyph ?? '').join('')}</td>`).join('')}</tr>` : '';
  panel.innerHTML = `
    <div class="card ${many ? 'card-wide' : ''}">
      <div class="clip"></div>
      <div class="head"><span>${opts.tourney ? `${esc(opts.tourney.toUpperCase())} · ` : ''}MATCH REPORT · SEED ${sim.seed}</span><span>${sim.t.toFixed(1)}s</span></div>
      <h1>${esc(title)} <span class="stamp">${winners.length ? 'Approved' : 'Tie'}</span></h1>
      <table>
        <tr><th></th>${fs.map((f) => `<th style="color:${teamHex[f.team]}" title="${esc(f.def.role)}">${opts.localSide !== undefined && opts.names?.[f.team] ? `<span class="result-player">${esc(opts.names[f.team])}</span><br>` : ''}${esc(f.def.displayName)}<br>${esc(f.def.name)}</th>`).join('')}</tr>
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
