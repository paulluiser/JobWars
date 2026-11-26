import type { FighterDef } from '../sim/types';
import { face } from './face';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** How long the VS splash holds the fight (seconds); a click skips it. */
export const INTRO_DUR = 2.3;

/**
 * Pre-fight VS splash: each side's busts slam in from its edge on a team-coloured band with
 * names and roles, a VS stamp lands in the middle, then it all wipes away into "FIGHT!".
 */
export class Intro {
  private el: HTMLElement;
  private timer = 0;

  constructor(stage: HTMLElement, onSkip: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'intro';
    this.el.addEventListener('click', onSkip);
    stage.appendChild(this.el);
  }

  play(blue: FighterDef[], red: FighterDef[], label: string) {
    const side = (team: FighterDef[], cls: string) => `
      <div class="in-side ${cls}">
        <div class="in-busts">${team.map((d, i) => `<div class="in-bust" style="--d:${i * 0.08}s">${face(d, 'bust')}</div>`).join('')}</div>
        <div class="in-names">${team.map((d) => `<div class="in-name"><b style="--c:${hex(d.accent)}">${esc(d.name)}</b><span>${esc(d.role)} · ${esc(d.title)}</span></div>`).join('')}</div>
      </div>`;
    this.el.innerHTML = `
      <div class="in-band blue"></div><div class="in-band red"></div>
      ${side(blue, 'blue')}${side(red, 'red')}
      <div class="in-vs">VS</div>
      <div class="in-label">${esc(label)}</div>
      <div class="in-skip">click to skip</div>`;
    this.el.className = '';
    void this.el.offsetWidth;
    this.el.className = `show n${Math.max(blue.length, red.length)}`;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.stop(), INTRO_DUR * 1000);
  }

  stop() {
    clearTimeout(this.timer);
    this.el.className = '';
  }
}
