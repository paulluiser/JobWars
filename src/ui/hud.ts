import type { Sim } from '../sim/sim';
import type { BattleSide, Fighter } from '../sim/types';
import { face } from './face';
import { CARD_BY_ID } from '../data/cards';
import { cardIcon } from './cards';
import { skillIcon } from './skillArt';

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const CHIP: Record<string, [string, string]> = {
  poison: ['poison', 'Poison'],
  burn: ['burn', 'Burn'],
  slow: ['slow', 'Slow'],
  wet: ['slow', 'Wet'],
  blind: ['stun', 'Blind'],
  spicy: ['burn', 'Spicy'],
  hearty: ['stun', 'Hearty'],
  light: ['slow', 'Light'],
  lifeSupport: ['poison', 'Life Support'],
  bleed: ['burn', 'Bleed'],
  root: ['poison', 'Rooted'],
  silence: ['stun', 'Silenced'],
  disarm: ['stun', 'Disarmed'],
  weaken: ['stun', 'Weakened'],
  armorBreak: ['burn', 'Armor Break'],
  sleep: ['slow', 'Asleep'],
  confuse: ['stun', 'Confused'],
  charm: ['burn', 'Charmed'],
  glitch: ['slow', 'Glitch'],
  mark: ['slow', 'Marked'],
  shield: ['slow', 'Shield'],
  haste: ['slow', 'Haste'],
  empower: ['burn', 'Power up'],
  fortify: ['stun', 'Fortified'],
  superArmor: ['stun', 'Unstoppable'],
  invuln: ['poison', 'Invulnerable'],
  airborne: ['slow', 'Airborne'],
};

class Banner {
  ghost: number;
  hold = 0;
  lastHp: number;
  private fill: HTMLElement;
  private ghostEl: HTMLElement;
  private bar: HTMLElement;
  private num: HTMLElement;
  private guard: HTMLElement;
  private chips: HTMLElement;
  private cd: HTMLElement;
  private sp: HTMLElement;
  private lastChips = '';
  private cardsEl: HTMLElement;
  private lastCards = -1;
  private lastSp = '';
  private rage: HTMLElement;
  private spT: HTMLElement;

  constructor(readonly el: HTMLElement, readonly f: Fighter, teamColor: string, playerLabel?: string) {
    const d = f.def;
    el.innerHTML = `
      <div class="strap" style="background:${teamColor}"></div>
      <div class="tape"></div>
      <div class="portrait" style="background:${hex(d.color)}">${face(d, 'icon')}</div>
      <div class="info">
        <div class="row"><span><span class="name" title="${d.name} · ${d.role}">${d.displayName}</span><span class="title">${d.name} · ${d.role}</span></span><span class="hpnum"></span></div>
        <div class="bar"><div class="ghost"></div><div class="fill"></div></div>
        <div class="gbar"><div></div></div>
        <div class="skills-row"><span class="sk ac" title="${d.active.simple}"><span class="cd"></span>${skillIcon(d.id, 'active')}${d.active.name}</span><span class="sk sp" title="${d.special.simple}"><span class="rage"></span>${skillIcon(d.id, 'special')}<span class="sp-t">Rage</span></span></div>
        <div class="chips"></div>
        <div class="hcards"></div>
      </div>`;
    if (playerLabel) {
      const title = el.querySelector<HTMLElement>('.title')!;
      title.classList.add('player-label');
      title.textContent = playerLabel;
      title.title = playerLabel;
    }
    this.fill = el.querySelector('.fill')!;
    this.ghostEl = el.querySelector('.ghost')!;
    this.bar = el.querySelector('.bar')!;
    this.num = el.querySelector('.hpnum')!;
    this.guard = el.querySelector('.gbar > div')!;
    this.chips = el.querySelector('.chips')!;
    this.cardsEl = el.querySelector('.hcards')!;
    this.cd = el.querySelector('.sk.ac .cd')!;
    this.sp = el.querySelector('.sk.sp')!;
    this.rage = el.querySelector('.sk.sp .rage')!;
    this.spT = el.querySelector('.sk.sp .sp-t')!;
    this.ghost = f.hp;
    this.lastHp = f.hp;
    el.classList.remove('low', 'down');
  }

  update(dt: number) {
    const f = this.f;
    if (f.hp < this.lastHp) {
      if (this.lastHp - f.hp > f.maxHp * 0.06) {
        this.bar.classList.remove('shake');
        void this.bar.offsetWidth;
        this.bar.classList.add('shake');
      }
      this.hold = 0.35;
    }
    this.lastHp = f.hp;
    if (this.hold > 0) this.hold -= dt;
    else this.ghost += (f.hp - this.ghost) * Math.min(1, dt * 6);
    if (this.ghost < f.hp) this.ghost = f.hp;
    const pct = f.hp / f.maxHp;
    this.fill.style.width = `${pct * 100}%`;
    this.ghostEl.style.width = `${(this.ghost / f.maxHp) * 100}%`;
    this.bar.classList.toggle('low', pct < 0.3);
    this.el.classList.toggle('low', pct < 0.3 && f.state !== 'ko');
    this.el.classList.toggle('down', f.state === 'ko');
    this.num.textContent = this.el.classList.contains('royale-banner')
      ? f.state === 'ko' ? 'Eliminated' : `${Math.ceil(pct * 100)}%`
      : `${Math.ceil(f.hp)} / ${f.maxHp}`;
    this.guard.style.width = `${f.guard}%`;
    this.guard.style.background = f.guard > 50 ? '#8fd3ff' : f.guard > 25 ? '#ffd25a' : '#ff5a46';
    this.cd.style.width = `${(f.activeCd / f.def.active.cooldown) * 100}%`;

    // rage bar: fills by dealing and taking damage; full = the special fires
    const spState = f.special === 'ready' || (f.state === 'cast' && f.casting === 'special') ? 'ready' : 'locked';
    this.rage.style.width = `${spState === 'ready' ? 100 : f.rage}%`;
    if (spState !== this.lastSp) {
      this.lastSp = spState;
      this.sp.className = `sk sp ${spState === 'ready' ? 'ready' : ''}`;
    }
    const label = spState === 'ready' ? `${f.def.special.name}!` : `Rage ${Math.floor(f.rage)}%`;
    if (this.spT.textContent !== label) this.spT.textContent = label;

    // gacha cards held (newest last); the Cards panel (B) has the details
    if (f.cards.length !== this.lastCards) {
      this.lastCards = f.cards.length;
      this.cardsEl.innerHTML = f.cards.map((id) => CARD_BY_ID.get(id)).filter(Boolean).map((c) => `<span title="${c!.name}: ${c!.simple}">${cardIcon(c!)}</span>`).join('');
    }

    const chips: string[] = [];
    if (f.state === 'stun') chips.push(`<span class="chip stun">Stunned</span>`);
    for (const s of f.statuses) {
      const [cls, label] = CHIP[s.kind] ?? ['stun', s.kind];
      const stacks = s.kind === 'poison' || s.kind === 'bleed' ? ` ×${s.stacks}` : s.kind === 'shield' ? ` ${Math.round(s.value)}` : '';
      if (s.remaining > 60) {
        chips.push(`<span class="chip ${cls}">${label}${stacks}</span>`);
        continue;
      }
      chips.push(`<span class="chip ${cls}">${label}${stacks} ${s.remaining.toFixed(1)}s</span>`);
    }
    if (f.state === 'ko') chips.push(`<span class="chip stun">K.O.</span>`);
    const html = chips.join('');
    if (html !== this.lastChips) {
      this.chips.innerHTML = html;
      this.lastChips = html;
    }
  }
}

export class Hud {
  private banners: Banner[] = [];
  private royale = $('#royale-hud');
  private timer = $('#timer');
  private seedEl = $('#seed');
  private vig = [$('#vig0'), $('#vig1')];
  private flashEl = $('#flash');
  private callEl = $('#callout');

  setup(sim: Sim, teamColors: string[], yours?: BattleSide, playerNames?: string[]) {
    this.royale.hidden = !sim.opts.royale;
    this.royale.replaceChildren();
    const label = (side: BattleSide) => {
      const name = playerNames?.[side] || (sim.opts.royale ? `Player ${side + 1}` : '');
      return name && side === yours ? `${name} (you)` : name;
    };
    if (sim.opts.royale) {
      this.banners = sim.fighters.map((f) => {
        const el = document.createElement('div');
        el.className = f.team === yours ? 'banner royale-banner local' : 'banner royale-banner';
        el.style.setProperty('--team-color', teamColors[f.team]);
        this.royale.append(el);
        return new Banner(el, f, teamColors[f.team], label(f.team));
      });
    } else {
      // Blue takes #b0, #b2 (left). Red takes #b1, #b3 (right).
      const seen = [0, 0];
      this.banners = sim.fighters.map((f) => new Banner($(`#b${f.team + 2 * seen[f.team]++}`), f, teamColors[f.team], label(f.team)));
    }
    for (let i = 0; i < 4; i++) $(`#b${i}`).hidden = !this.banners.some((b) => b.el.id === `b${i}`);
    this.seedEl.textContent = `Seed ${sim.seed}`;
    this.callEl.className = '';
  }

  update(sim: Sim, dt: number) {
    for (const b of this.banners) b.update(dt);
    const left = Math.max(0, Math.ceil(sim.timeLimit - sim.t));
    this.timer.textContent = String(left);
    this.timer.classList.toggle('urgent', left <= 10);
    [0, 1].forEach((team) => this.vig[team].classList.toggle('on', !sim.opts.royale && sim.fighters.some((f) => f.team === team && f.state !== 'ko' && f.hp / f.maxHp < 0.3)));
  }

  /** the cast skill's chip on its ID card pops, so the HUD says who just used what */
  skillFired(idx: number, kind: 'active' | 'special') {
    const b = this.banners.find((x) => x.f.idx === idx);
    const chip = b?.el.querySelector<HTMLElement>(kind === 'active' ? '.sk.ac' : '.sk.sp');
    if (!b || !chip) return;
    for (const el of [chip, b.el]) {
      el.classList.remove('fired');
      void el.offsetWidth;
      el.classList.add('fired');
    }
  }

  flash(opacity = 0.8, ms = 180) {
    this.flashEl.animate([{ opacity }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  }

  callout(text: string, color = '#ffd23f') {
    this.callEl.textContent = text;
    this.callEl.style.color = color;
    this.callEl.classList.remove('show');
    void this.callEl.offsetWidth;
    this.callEl.classList.add('show');
  }
}
