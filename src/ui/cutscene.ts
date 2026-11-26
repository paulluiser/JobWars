import type { FighterDef } from '../sim/types';
import { face } from './face';

export type CutsceneMode = 'full' | 'short' | 'off';
export const CUTSCENE_DUR: Record<CutsceneMode, number> = { full: 1.8, short: 0.9, off: 0 };

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const lum = (n: number) => (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255;

/**
 * Special-move cutscene (time is frozen while it plays):
 * dim + desaturate → speed-line band in the character's colour → bust slides in from
 * its side → skill name slams in → quote → white flash → back to the fight.
 */
export class Cutscene {
  private el: HTMLElement;
  private timer = 0;

  constructor(stage: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'cutscene';
    this.el.innerHTML = `
      <div class="cs-dim"></div>
      <div class="cs-band"><div class="cs-lines"></div></div>
      <div class="cs-bust"></div>
      <div class="cs-plate"><div class="cs-kicker">SPECIAL MOVE</div><div class="cs-name"></div><div class="cs-quote"></div></div>
      <div class="cs-flash"></div>`;
    stage.appendChild(this.el);
  }

  play(def: FighterDef, side: 0 | 1, mode: CutsceneMode) {
    if (mode === 'off') return;
    const main = lum(def.color) > 0.85 ? def.accent : def.color;
    this.el.style.setProperty('--c', hex(main));
    this.el.style.setProperty('--a', hex(def.accent));
    this.el.style.setProperty('--k', mode === 'short' ? '0.5' : '1');
    this.el.querySelector('.cs-bust')!.innerHTML = face(def, 'bust', true);
    this.el.querySelector('.cs-name')!.textContent = def.special.name;
    this.el.querySelector('.cs-quote')!.textContent = `“${def.special.quote}”`;
    this.el.querySelector('.cs-kicker')!.textContent = `${def.name.toUpperCase()} · SPECIAL MOVE`;
    this.el.className = '';
    void this.el.offsetWidth;
    this.el.className = `show ${side === 1 ? 'right' : 'left'}`;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.el.className = ''), CUTSCENE_DUR[mode] * 1000 + 50);
  }

  stop() {
    clearTimeout(this.timer);
    this.el.className = '';
  }
}
