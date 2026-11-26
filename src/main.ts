import { Game } from './game';
import { portraitHeightFor, type Layout } from './render/scene';
import { onArtProgress } from './render/art';

const game = new Game();
const stage = document.getElementById('stage')!;

// ---- layout: auto follows the window shape; portrait can be forced for recording vertical clips ----
type LayoutMode = 'auto' | Layout;
const MODES: LayoutMode[] = ['auto', 'portrait', 'landscape'];
const urlLayout = new URLSearchParams(location.search).get('layout') as LayoutMode | null;
let layoutMode: LayoutMode = urlLayout && MODES.includes(urlLayout) ? urlLayout : 'auto';
try {
  const saved = localStorage.getItem('layoutMode') as LayoutMode | null;
  if (!urlLayout && saved && MODES.includes(saved)) layoutMode = saved;
} catch {}

function resolveLayout(): Layout {
  if (layoutMode !== 'auto') return layoutMode;
  return window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
}

function portraitH() {
  return portraitHeightFor(window.innerWidth, window.innerHeight);
}

function applyLayout() {
  const l = resolveLayout();
  document.body.classList.toggle('portrait', l === 'portrait');
  // portrait stage takes the device's real shape (9:16 .. ~9:19.5) so phones have no dead strip
  const h = portraitH();
  stage.style.setProperty('--ph', String(h));
  if (game.scene.app) game.scene.setLayout(l, h);
  const label = layoutMode === 'auto' ? 'Layout: auto' : layoutMode === 'portrait' ? 'Layout: 9:16' : 'Layout: 16:9';
  setBtn('layout', label);
}
window.addEventListener('resize', applyLayout);

function setBtn(act: string, label: string, on?: boolean) {
  const b = document.querySelector<HTMLButtonElement>(`#controls [data-act="${act}"]`);
  if (!b) return;
  b.textContent = label;
  if (on !== undefined) b.classList.toggle('on', on);
}

function act(name: string, el?: HTMLElement | null) {
  switch (name) {
    case 'share':
      game.sfx.share();
      void game.share(el ?? document.querySelector<HTMLElement>('#controls [data-act="share"]'));
      break;
    case 'skipreplay':
      game.endReplay();
      break;
    case 'new':
      if (game.spec.kind === 'pvp') break; // a PvP rematch goes through both players
      if (game.spec.kind === 'story') game.storyRetry();
      else game.start(game.randomSeed());
      break;
    case 'replay':
      if (game.spec.kind === 'pvp' || game.spec.kind === 'story') break;
      game.start(game.seed);
      break;
    case 'select':
      // back to wherever this match was set up (CPU select, bracket, Story level)
      game.backToSetup();
      break;
    case 'menu':
      game.showMenu();
      break;
    case 'buffs':
      game.toggleBuffs();
      break;
    case 'storynext':
      game.storyNext();
      break;
    case 'storyretry':
      game.storyRetry();
      break;
    case 'storymap':
      game.showStory();
      break;
    case 'pvprematch':
      game.pvpRematch();
      break;
    case 'pvpleave':
      game.pvpLeave();
      break;
    case 'bracket':
      game.showBracket();
      break;
    case 'cutscene': {
      const order = ['full', 'short', 'off'] as const;
      game.cutMode = order[(order.indexOf(game.cutMode) + 1) % order.length];
      try {
        localStorage.setItem('cutsceneMode', game.cutMode);
      } catch {}
      setBtn('cutscene', `Cutscenes: ${game.cutMode}`);
      break;
    }
    case 'pause':
      game.paused = !game.paused;
      setBtn('pause', game.paused ? 'Resume' : 'Pause');
      break;
    case 'speed':
      game.speed = game.speed === 1 ? 2 : 1;
      setBtn('speed', `${game.speed}×`);
      break;
    case 'juice':
      game.juice.enabled = !game.juice.enabled;
      setBtn('juice', game.juice.enabled ? 'Juice on' : 'Juice off', game.juice.enabled);
      break;
    case 'layout':
      layoutMode = MODES[(MODES.indexOf(layoutMode) + 1) % MODES.length];
      try {
        localStorage.setItem('layoutMode', layoutMode);
      } catch {}
      applyLayout();
      break;
    case 'sound':
      game.sfx.init();
      game.sfx.setMuted(!game.sfx.muted);
      setBtn('sound', game.sfx.muted ? 'Sound off' : 'Sound on', !game.sfx.muted);
      break;
  }
}

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  // every button clicks; mode tabs and Fight/Watch get their own sounds
  const b = t.closest('button');
  if (b) {
    game.sfx.init();
    game.sfx.ui(b.matches('[data-sel="go"], [data-b="watch"], [data-b="again"]') ? 'go' : b.matches('[data-mode], [data-tformat], [data-tsize]') ? 'tab' : 'click');
  }
  const el = t.closest<HTMLElement>('[data-act]');
  if (el) act(el.dataset.act!, el);
});

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if ((e.target as HTMLElement).closest('input, textarea')) return;
  const map: Record<string, string> = { KeyR: 'new', KeyT: 'replay', Space: 'pause', KeyS: 'speed', KeyJ: 'juice', KeyM: 'sound', KeyL: 'layout', KeyC: 'cutscene', KeyF: 'select', KeyK: 'share', KeyB: 'buffs', Escape: 'menu' };
  if (e.code === 'Escape' && game.draft.open) return;
  if (e.code === 'Escape' && game.started && !game.sim.over) {
    // Esc mid-fight closes the card panel rather than quitting
    e.preventDefault();
    act('buffs');
    return;
  }
  if (game.replaying && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    act('skipreplay');
    return;
  }
  if (e.code === 'Enter' && game.selecting) {
    e.preventDefault();
    document.querySelector<HTMLButtonElement>('[data-sel="go"], [data-b="watch"], [data-b="again"]')?.click();
    return;
  }
  const a = map[e.code];
  if (!a) return;
  e.preventDefault();
  act(a);
});

// ---- boot loader (markup in index.html): real progress from the art loader, rotating tips ----
const boot = document.getElementById('boot');
const fill = boot?.querySelector<HTMLElement>('.fill');
const pct = boot?.querySelector<HTMLElement>('.pct');
const what = boot?.querySelector<HTMLElement>('.what');
const tipEl = boot?.querySelector<HTMLElement>('.tip');
const TIPS = [
  'The rage bar fills as you deal and take damage. Full bar = special move.',
  'In Gacha matches you pick a new card every 20 seconds.',
  'Charged blows break a block; a quick hit interrupts a charge.',
  'Job cards only show up for their own job. Class cards for their class.',
  'Wall slams hurt. Heavy jobs get knocked around less.',
  'Story Mode recruits a new job every time you beat one.',
  'Press B mid-match to see both sides\' cards.',
  'Overtime starts at 1:40 in Gacha: damage climbs, healing drops.',
];
let tipI = Math.floor(Math.random() * TIPS.length);
const nextTip = () => {
  if (!tipEl) return;
  tipEl.style.opacity = '0';
  setTimeout(() => {
    tipEl.textContent = `Tip: ${TIPS[tipI++ % TIPS.length]}`;
    tipEl.style.opacity = '1';
  }, 250);
};
nextTip();
const tipTimer = setInterval(nextTip, 2600);
const setProgress = (p: number, label?: string) => {
  const v = Math.round(Math.min(1, p) * 100);
  if (fill) fill.style.width = `${Math.max(4, v)}%`;
  if (pct) pct.textContent = `${v}%`;
  if (label && what) what.textContent = label;
};
const labels = ['Clocking in…', 'Sharpening cleavers…', 'Unrolling blueprints…', 'Restocking the cards…', 'Warming up the arena…'];
onArtProgress((p) => setProgress(0.08 + p * 0.82, labels[Math.min(labels.length - 1, Math.floor(p * labels.length))]));

// every new menu screen slides in (any render into #panel)
const panelEl = document.getElementById('panel')!;
new MutationObserver(() => {
  const first = panelEl.firstElementChild;
  if (first && !first.classList.contains('p-enter')) first.classList.add('p-enter');
}).observe(panelEl, { childList: true });

applyLayout();
game
  .init(stage, resolveLayout(), portraitH())
  .then(() => {
    applyLayout();
    setBtn('cutscene', `Cutscenes: ${game.cutMode}`);
    setProgress(1, 'Ready!');
    clearInterval(tipTimer);
    setTimeout(() => boot?.classList.add('done'), 250);
    setTimeout(() => boot?.remove(), 900);
  })
  .catch((err) => {
  console.error(err);
  stage.insertAdjacentHTML('beforeend', `<p style="position:absolute;inset:auto 0 45% 0;text-align:center">Couldn't start the renderer: ${String(err)}</p>`);
});

// debug handle for testing in the browser console
(window as any).game = game;
