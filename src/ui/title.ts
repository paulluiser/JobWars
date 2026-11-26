import { ROSTER } from '../data/roster';
import { posterUrl } from '../render/art';
import { face } from './face';

/**
 * Title screen ("landing poster"): the key art drifting slowly behind light rays and embers, the
 * logo dropping in letter by letter, a tagline and a pulsing "Tap to start". The tap also unlocks
 * audio. Before the poster art exists (art/PROMPTS_UI.md), a crowd of the real character busts
 * rises in a fan behind the logo instead.
 */
const HEROES = ['builder', 'police', 'scientist', 'firefighter', 'chef', 'nurse', 'electrician', 'lawyer', 'musician'];

export class TitleScreen {
  private el: HTMLElement;

  constructor(stage: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'title';
    stage.appendChild(this.el);
  }

  show(portrait: boolean, onStart: () => void) {
    const poster = posterUrl(portrait);
    const crowd = poster
      ? ''
      : `<div class="t-crowd">${HEROES.map((id, i) => {
          const d = ROSTER.find((r) => r.id === id)!;
          const mid = (HEROES.length - 1) / 2;
          const off = i - mid;
          return `<div class="t-hero" style="--i:${i};--x:${off};--z:${10 - Math.abs(off)};--r:${off * 4}deg">${face(d, 'bust')}</div>`;
        }).join('')}</div>`;
    const letters = (w: string, cls: string, base: number) => [...w].map((ch, i) => `<span class="${cls}" style="--d:${(base + i) * 0.07}s">${ch}</span>`).join('');
    this.el.innerHTML = `
      ${poster ? `<div class="t-poster" style="background-image:url('${poster}')"></div>` : '<div class="t-sky"></div>'}
      <div class="t-rays"></div>
      ${crowd}
      <div class="t-embers">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i};--x:${(i * 37) % 100}%;--s:${0.6 + ((i * 7) % 5) / 6}"></i>`).join('')}</div>
      <div class="t-shade"></div>
      <div class="t-logo">
        <div class="t-word">${letters('JOB', 'l1', 0)}</div>
        <div class="t-word wars">${letters('WARS', 'l2', 3)}</div>
        <div class="t-tag">30 real jobs. One arena. No overtime pay.</div>
      </div>
      <button class="t-start">Tap to start</button>
      <div class="t-foot"><span>PvP · Gacha · Story · Tag Team</span><span>Sound effects: Oculus Audio Pack 01 (CC BY 4.0)</span></div>`;
    this.el.className = 'show';
    const go = (e?: Event) => {
      e?.preventDefault();
      window.removeEventListener('keydown', key);
      this.el.onclick = null;
      this.el.classList.add('leaving');
      onStart();
      setTimeout(() => (this.el.className = ''), 650);
    };
    const key = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'Escape'].includes(e.code)) go(e);
    };
    window.addEventListener('keydown', key);
    this.el.onclick = () => go();
  }

  get open() {
    return this.el.classList.contains('show') && !this.el.classList.contains('leaving');
  }
}
