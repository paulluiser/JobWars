import { CARD_BY_ID, RARITY_COLOR, type Card } from '../data/cards';
import { cardArtUrl } from '../render/art';
import type { FighterDef } from '../sim/types';
import { face } from './face';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A card's icon: the painted one when the art exists (art/PROMPTS_CARDS.md), else its glyph. */
export function cardIcon(c: Card, cls = 'cicon') {
  const url = cardArtUrl(c.id);
  return `<span class="${cls} r-${c.rarity}" style="--rc:${RARITY_COLOR[c.rarity]}">${url ? `<img src="${url}" alt="">` : `<i>${c.glyph}</i>`}</span>`;
}

const tag = (c: Card) => (c.job ? `<span class="ctag job">${esc(c.job)} only</span>` : c.role ? `<span class="ctag role">${esc(c.role)} only</span>` : '');

/** A full card face (draft offers, buff panel). */
export function cardFace(c: Card, detailed: boolean, extra = '') {
  return `<div class="cardface r-${c.rarity}" style="--rc:${RARITY_COLOR[c.rarity]}">
    <div class="cf-rarity">${c.rarity.toUpperCase()}${tag(c)}</div>
    ${cardIcon(c, 'cf-icon')}
    <div class="cf-name">${esc(c.name)}</div>
    <p>${esc(detailed ? c.detailed : c.simple)}</p>
    ${extra}
  </div>`;
}

export interface DraftView {
  title: string;
  subtitle: string;
  offers: Card[];
  rerollsLeft: number;
  /** seconds to choose (0 = no timer) */
  timer: number;
  serverDeadline?: boolean;
  detailed: boolean;
  /** this side's team and cards so far */
  team: FighterDef[];
  owned: string[];
  /** the other side's cards (visible: both see each other's buffs) */
  rivalOwned: string[];
  rivalName: string;
}

/**
 * The pick overlay: three cards, one reroll button, a countdown (auto-picks at random when it
 * runs out, so a match never stalls), and both sides' current cards along the bottom.
 */
export class DraftOverlay {
  private el: HTMLElement;
  private timer = 0;
  private done: ((c: Card) => void) | null = null;
  private onReroll: (() => void) | null = null;
  private v: DraftView | null = null;

  constructor(stage: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'draft';
    stage.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-card],[data-reroll],[data-detail]');
      if (!t || !this.v) return;
      if (t.dataset.card !== undefined) this.finish(this.v.offers[Number(t.dataset.card)]);
      else if (t.dataset.reroll !== undefined && this.v.rerollsLeft > 0) this.onReroll?.();
      else if (t.dataset.detail !== undefined) {
        this.v.detailed = !this.v.detailed;
        try { localStorage.setItem('detailMode', this.v.detailed ? 'detailed' : 'simple'); } catch {}
        this.draw();
      }
    });
  }

  get open() {
    return !!this.done;
  }

  /** Show a pick; resolves with the chosen card. `reroll` swaps the offers in place. */
  pick(v: DraftView, reroll: () => Card[]): Promise<Card> {
    this.v = v;
    this.onReroll = () => {
      if (!this.v) return;
      this.v.offers = reroll();
      this.v.rerollsLeft--;
      this.draw();
    };
    this.draw();
    this.el.className = 'show';
    let left = v.timer;
    clearInterval(this.timer);
    if (left > 0) {
      this.timer = window.setInterval(() => {
        left -= 1;
        const t = this.el.querySelector('.dr-timer');
        if (t) t.textContent = `${left}s`;
        if (left <= 0 && this.v) {
          if (this.v.serverDeadline) this.cancel();
          else this.finish(this.v.offers[Math.floor(Math.random() * this.v.offers.length)]);
        }
      }, 1000);
    }
    return new Promise((res) => (this.done = res));
  }

  private finish(c: Card) {
    clearInterval(this.timer);
    this.el.className = '';
    const d = this.done;
    this.done = null;
    d?.(c);
  }

  /** close without picking (match abandoned) */
  cancel() {
    clearInterval(this.timer);
    this.el.className = '';
    this.done = null;
  }

  private draw() {
    const v = this.v!;
    const strip = (ids: string[]) => ids.map((id) => CARD_BY_ID.get(id)).filter(Boolean).map((c) => `<span title="${esc(c!.name)}: ${esc(c!.simple)}">${cardIcon(c!)}</span>`).join('') || '<em>none yet</em>';
    this.el.innerHTML = `
      <div class="dr-box">
        <div class="dr-head">
          <div class="dr-team">${v.team.map((d) => `<span class="dr-face">${face(d, 'icon')}</span>`).join('')}</div>
          <div><div class="dr-title">${esc(v.title)}</div><div class="dr-sub">${esc(v.subtitle)}</div></div>
          ${v.timer > 0 ? `<div class="dr-timer">${v.timer}s</div>` : ''}
        </div>
        <div class="dr-offers">${v.offers.map((c, i) => `<button class="dr-card" data-card="${i}">${cardFace(c, v.detailed)}</button>`).join('')}</div>
        <div class="dr-foot">
          <button data-reroll ${v.rerollsLeft > 0 ? '' : 'disabled'}>Reroll (${v.rerollsLeft} left)</button>
          <button data-detail>${v.detailed ? 'Simple' : 'Detailed'}</button>
        </div>
        <div class="dr-owned"><span>Your cards</span>${strip(v.owned)}</div>
        <div class="dr-owned rival"><span>${esc(v.rivalName)}</span>${strip(v.rivalOwned)}</div>
      </div>`;
  }
}

/** Both sides' cards, side by side (the "Cards" button / B key during a Gacha match). */
export function buffPanelHtml(names: [string, string], cards: [string[], string[]], detailed: boolean) {
  const col = (i: 0 | 1) => {
    const list = cards[i].map((id) => CARD_BY_ID.get(id)).filter(Boolean) as Card[];
    return `<div class="bp-col ${i ? 'red' : 'blue'}">
      <div class="bp-name">${esc(names[i])} <span>${list.length} card${list.length === 1 ? '' : 's'}</span></div>
      ${list.map((c) => `<div class="bp-card r-${c.rarity}" style="--rc:${RARITY_COLOR[c.rarity]}">${cardIcon(c)}<div><b>${esc(c.name)}</b>${tag(c)}<p>${esc(detailed ? c.detailed : c.simple)}</p></div></div>`).join('') || '<p class="bp-none">No cards yet.</p>'}
    </div>`;
  };
  return `<div class="bp-box"><div class="bp-head">Cards in play <button data-act="buffs">Close (B)</button></div><div class="bp-cols">${col(0)}${col(1)}</div></div>`;
}
