import { Game } from './game';
import { portraitHeightFor, type Layout } from './render/scene';
import { onArtProgress } from './render/art';
import { renderSettings, type SettingsView } from './ui/menu';

const game = new Game();
const stage = document.getElementById('stage')!;
const panelEl = document.getElementById('panel')!;

// ---- layout: auto follows the window shape; portrait can be forced for recording vertical clips ----
type LayoutMode = SettingsView['layout'];
const MODES: LayoutMode[] = ['auto', 'portrait', 'landscape'];
const urlLayout = new URLSearchParams(location.search).get('layout') as LayoutMode | null;
let layoutMode: LayoutMode = urlLayout && MODES.includes(urlLayout) ? urlLayout : 'auto';
try {
  const saved = localStorage.getItem('layoutMode') as LayoutMode | null;
  if (!urlLayout && saved && MODES.includes(saved)) layoutMode = saved;
  game.sfx.setMuted(localStorage.getItem('soundMuted') === '1');
  game.juice.enabled = localStorage.getItem('combatEffects') !== 'off';
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
}
window.addEventListener('resize', applyLayout);

function setBtn(act: string, label: string, on?: boolean) {
  const b = document.querySelector<HTMLButtonElement>(`#controls [data-act="${act}"]`);
  if (!b) return;
  b.textContent = label;
  if (on !== undefined) b.classList.toggle('on', on);
}

const CUTSCENES = ['full', 'short', 'off'] as const;

function setPreference(key: keyof SettingsView, value: string) {
  let storageKey: string;
  let stored = value;
  switch (key) {
    case 'sound':
      game.sfx.init();
      game.sfx.setMuted(value === 'off');
      storageKey = 'soundMuted';
      stored = game.sfx.muted ? '1' : '0';
      break;
    case 'juice':
      game.juice.enabled = value === 'on';
      storageKey = 'combatEffects';
      break;
    case 'cutscene':
      game.cutMode = value as SettingsView['cutscene'];
      storageKey = 'cutsceneMode';
      break;
    case 'layout':
      layoutMode = value as LayoutMode;
      applyLayout();
      storageKey = 'layoutMode';
      break;
    case 'details':
      game.cardDetails = value === 'detailed';
      storageKey = 'detailMode';
      break;
  }
  try { localStorage.setItem(storageKey, stored); } catch {}
  const select = panelEl.querySelector<HTMLSelectElement>(`[data-pref="${key}"]`);
  if (select) select.value = value;
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
    case 'settings':
      renderSettings(panelEl, {
        sound: game.sfx.muted ? 'off' : 'on',
        juice: game.juice.enabled ? 'on' : 'off',
        cutscene: game.cutMode,
        layout: layoutMode,
        details: game.cardDetails ? 'detailed' : 'simple',
      }, () => {
        game.showMenu();
        panelEl.querySelector<HTMLButtonElement>('.m-settings')?.focus();
      });
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
    case 'cutscene':
      setPreference('cutscene', CUTSCENES[(CUTSCENES.indexOf(game.cutMode) + 1) % CUTSCENES.length]);
      break;
    case 'pause':
      if (game.synchronizedPvp) break;
      game.paused = !game.paused;
      setBtn('pause', game.paused ? 'Resume' : 'Pause');
      break;
    case 'speed':
      if (game.synchronizedPvp) break;
      game.speed = game.speed === 1 ? 2 : 1;
      setBtn('speed', `${game.speed}×`);
      break;
    case 'juice':
      setPreference('juice', game.juice.enabled ? 'off' : 'on');
      break;
    case 'layout':
      setPreference('layout', MODES[(MODES.indexOf(layoutMode) + 1) % MODES.length]);
      break;
    case 'sound':
      setPreference('sound', game.sfx.muted ? 'on' : 'off');
      break;
  }
}

panelEl.addEventListener('change', (e) => {
  const select = e.target;
  if (select instanceof HTMLSelectElement && select.dataset.pref) {
    setPreference(select.dataset.pref as keyof SettingsView, select.value);
  }
});

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
  if ((e.target as HTMLElement).closest('input, textarea, select')) return;
  if ((e.code === 'Enter' || e.code === 'Space') && (e.target as HTMLElement).closest('button, summary')) return;
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

const boot = document.getElementById('boot');
const fill = boot?.querySelector<HTMLElement>('.fill');
const pct = boot?.querySelector<HTMLElement>('.pct');
const what = boot?.querySelector<HTMLElement>('.what');
const setProgress = (p: number) => {
  const v = Math.round(Math.min(1, p) * 100);
  if (fill) fill.style.width = `${v}%`;
  if (pct) pct.textContent = `${v}%`;
};
onArtProgress((p) => setProgress(0.08 + p * 0.82));

// Animate between screens while keeping updates to the current screen still.
let previousScreen: string | null = null;
new MutationObserver(() => {
  const screen = panelEl.firstElementChild;
  const nextScreen = screen?.classList.item(0) ?? null;
  if (screen && nextScreen !== previousScreen) screen.classList.add('p-enter');
  previousScreen = nextScreen;
}).observe(panelEl, { childList: true });

applyLayout();
game
  .init(stage, resolveLayout(), portraitH())
  .then(() => {
    applyLayout();
    setProgress(1);
    setTimeout(() => boot?.classList.add('done'), 100);
    setTimeout(() => boot?.remove(), 400);
  })
  .catch((err) => {
    console.error(err);
    if (what) what.textContent = 'Couldn’t load Job Wars. Reload to try again.';
    if (pct) pct.textContent = '';
  });

// debug handle for testing in the browser console
(window as any).game = game;
