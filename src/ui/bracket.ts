import type { FighterDef } from '../sim/types';
import { champion, nextMatch, roundName, type Entry, type Match, type Tournament } from '../modes/tournament';
import { face } from './face';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export interface BracketActions {
  watch: () => void;
  skip: () => void;
  skipRound: () => void;
  skipAll: () => void;
  quit: () => void;
  again: () => void;
}

/**
 * The bracket board: one column per round, the next match highlighted, results written in
 * as they come. From here you watch the next match or let the rest play out instantly.
 */
export function renderBracket(panel: HTMLElement, t: Tournament, byId: (id: string) => FighterDef, act: BracketActions) {
  const next = nextMatch(t);
  const champ = champion(t);
  const name = (e: Entry) => e.map((id) => byId(id).name).join(' & ');
  const faces = (e: Entry) => e.map((id) => {
    const d = byId(id);
    return `<span class="bf" style="background:${hex(d.color)}">${face(d, 'icon')}</span>`;
  }).join('');
  const side = (m: Match, k: 0 | 1) => {
    const e = k === 0 ? m.a : m.b;
    if (!e) return `<div class="bs tbd"><span class="bf"></span><span class="bn">TBD</span></div>`;
    const cls = m.winner === null ? '' : m.winner === k ? 'won' : 'lost';
    return `<div class="bs ${cls}">${faces(e)}<span class="bn">${name(e)}</span></div>`;
  };
  const cols = t.rounds.map((round, r) => `
    <div class="bcol">
      <div class="bround">${roundName(t, r)}</div>
      <div class="bmatches">
        ${round.map((m, i) => {
          const isNext = next && next.r === r && next.i === i;
          return `<div class="bm ${isNext ? 'next' : ''} ${m.winner !== null ? 'done' : ''}">
            ${isNext ? '<span class="btag">NEXT</span>' : ''}
            ${side(m, 0)}${side(m, 1)}
            ${m.note ? `<div class="bnote">${m.note}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
  const champCol = `
    <div class="bcol champ-col">
      <div class="bround">Champion</div>
      <div class="bmatches"><div class="bchamp ${champ ? 'set' : ''}">${champ ? `${faces(champ)}<span class="bn">${name(champ)}</span>` : '<span class="trophy">🏆</span>'}</div></div>
    </div>`;

  const nextLabel = next ? `${name(next.m.a!)} vs ${name(next.m.b!)}` : '';
  const foot = champ
    ? `<button data-b="quit">Back to menu</button>
       <span class="hint"></span>
       <button class="primary big" data-b="again">New tournament</button>`
    : `<button data-b="quit">Quit</button>
       <button data-b="skipAll">Skip to the end</button>
       <button data-b="skipRound">Skip this round</button>
       <span class="hint">${roundName(t, next!.r)}: ${nextLabel}</span>
       <button data-b="skip">Skip match</button>
       <button class="primary big" data-b="watch">Watch match</button>`;

  const champBanner = champ
    ? `<div class="champion">
         <div class="champ-busts">${champ.map((id) => `<div class="champ-bust">${face(byId(id), 'bust')}</div>`).join('')}</div>
         <div class="champ-text"><div class="champ-kicker">${t.format === 'tag' ? 'TAG TEAM' : '1V1'} TOURNAMENT CHAMPION${champ.length > 1 ? 'S' : ''}</div><div class="champ-name">${name(champ)}</div><span class="stamp">Employee of the month</span></div>
       </div>`
    : '';

  panel.innerHTML = `
    <div class="bracket size-${t.rounds[0].length * 2} ${t.format}">
      <div class="b-head"><span class="b-title">Tournament</span><span class="b-sub">${t.format === 'tag' ? 'Tag Team' : '1v1'} · ${t.rounds[0].length * 2} ${t.format === 'tag' ? 'teams' : 'jobs'} · seed ${t.seed}</span></div>
      ${champBanner}
      <div class="b-board">${cols}${champCol}</div>
      <div class="sel-foot">${foot}</div>
    </div>`;
  panel.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-b]')?.dataset.b as keyof BracketActions | undefined;
    if (b) act[b]();
  };
  panel.classList.add('show', 'wide');
}
