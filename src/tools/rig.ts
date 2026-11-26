// Dev-only rig tuner (/rig.html). Not part of the production build.
import { Application, Container, Graphics } from 'pixi.js';
import { ROSTER } from '../data/roster';
import { arenaArt, arenaIds, charArt, hasSprites, loadArt, setFloor, setRig, type Floor, type Rig } from '../render/art';
import { FighterView, VIS } from '../render/fighterView';
import { Fx } from '../render/fx';
import { Juice } from '../render/juice';
import type { Fighter, FighterState } from '../sim/types';
import { augOf } from '../data/cards';

const panel = document.getElementById('panel')!;
const view = document.getElementById('view')!;

const app = new Application();
await app.init({ width: 800, height: 700, background: 0xc9b28d, antialias: true, resolution: Math.min(2, devicePixelRatio || 1) });
view.appendChild(app.canvas);
await loadArt();

const world = new Container();
const under = new Container();
const over = new Container();
const guides = new Graphics();
world.addChild(under, guides, over);
app.stage.addChild(world);
world.position.set(400, 560);
world.scale.set(2.2);
const fx = new Fx(app.renderer, under, over);
const juice = new Juice();

const arenaNames = arenaIds();
let currentArena = arenaArt()?.name ?? arenaNames[0];

const ids = ROSTER.filter((d) => hasSprites(d.id)).map((d) => d.id);
let current = ids[0];
let fv: FighterView | null = null;
let fake: Fighter | null = null;

function makeFake(id: string): Fighter {
  const def = ROSTER.find((d) => d.id === id)!;
  return {
    idx: 0, team: 0, def, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, face: 0, hp: def.hp, maxHp: def.hp, guard: 100, guardRegenDelay: 0,
    state: 'move', stateT: 0, stateDur: 0, attackCd: 0, activeCd: 0, specialCd: def.special.cooldown, special: 'locked', casting: null, kit: {}, statuses: [], ccHistory: [], targetIdx: -1,
    stats: {} as Fighter['stats'], rage: 0, cards: [], aug: augOf([]), augS: {}, baseDef: def,
  };
}

function rebuild() {
  if (fv) fv.root.destroy({ children: true });
  if (!current) return;
  fake = makeFake(current);
  fv = new FighterView(fake, fx, juice);
  world.addChild(fv.root);
  const r = fake.def.radius;
  const s = (r / 32) * VIS;
  guides.clear();
  guides.circle(0, -55 * s, r).stroke({ width: 1.5, color: 0x2a1d14, alpha: 0.5 });
  guides.arc(0, -55 * s, r + fake.def.range, -0.7, 0.7).stroke({ width: 2, color: 0xffd23f, alpha: 0.9 });
  guides.moveTo(-60, 0).lineTo(60, 0).stroke({ width: 1, color: 0x2a1d14, alpha: 0.4 });
}

// state loop: move 1.2s → windup → recover → move → charge → recover → stagger
const LOOP: [FighterState, number][] = [['move', 1.2], ['windup', 0.28], ['recover', 0.3], ['move', 0.6], ['charge', 0.9], ['recover', 0.5], ['stagger', 0.4]];
let li = 0, lt = 0;
app.ticker.add((t) => {
  const dt = Math.min(0.05, t.deltaMS / 1000);
  if (!fv || !fake) return;
  lt += dt;
  const [st, dur] = LOOP[li];
  if (lt >= dur) {
    lt = 0;
    li = (li + 1) % LOOP.length;
  }
  fake.state = LOOP[li][0];
  fake.stateT = lt;
  fake.stateDur = LOOP[li][1];
  fake.vx = st === 'move' ? 300 : 0;
  fv.update(1, dt, dt);
  fx.update(dt);
});

// ---------------- panel ----------------
const SLIDERS: { key: string; label: string; min: number; max: number; step: number; get: (r: Rig) => number; set: (r: Rig, v: number) => void }[] = [
  { key: 'height', label: 'Body height', min: 60, max: 240, step: 1, get: (r) => r.height, set: (r, v) => (r.height = v) },
  { key: 'sx', label: 'Shoulder X', min: -80, max: 80, step: 1, get: (r) => r.shoulder.x, set: (r, v) => (r.shoulder.x = v) },
  { key: 'sy', label: 'Shoulder Y', min: -200, max: 0, step: 1, get: (r) => r.shoulder.y, set: (r, v) => (r.shoulder.y = v) },
  { key: 'wl', label: 'Arm + tool length', min: 30, max: 300, step: 1, get: (r) => r.weaponLength, set: (r, v) => (r.weaponLength = v) },
  { key: 'wa', label: 'Rest angle', min: -1.6, max: 1.6, step: 0.01, get: (r) => r.weaponAngle, set: (r, v) => (r.weaponAngle = v) },
];
const FLOOR: { key: keyof Floor; label: string }[] = [
  { key: 'x', label: 'Floor left' }, { key: 'y', label: 'Floor top' }, { key: 'w', label: 'Floor width' }, { key: 'h', label: 'Floor height' },
];

function rigJson() {
  const out: Record<string, unknown> = {};
  for (const id of ids) out[id] = charArt(id)!.rig;
  if (arenaNames.length) out.arenas = Object.fromEntries(arenaNames.map((id) => [id, { floor: arenaArt(id)!.floor }]));
  return out;
}

function drawArenaPreview(canvas: HTMLCanvasElement) {
  const a = arenaArt(currentArena);
  if (!a) return;
  const ctx = canvas.getContext('2d')!;
  const src = a.texture.source.resource as CanvasImageSource;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const f = a.floor;
  ctx.fillStyle = 'rgba(63,156,255,.18)';
  ctx.strokeStyle = '#3f9cff';
  ctx.lineWidth = 3;
  ctx.fillRect(f.x * canvas.width, f.y * canvas.height, f.w * canvas.width, f.h * canvas.height);
  ctx.strokeRect(f.x * canvas.width, f.y * canvas.height, f.w * canvas.width, f.h * canvas.height);
}

function render() {
  const arena = arenaArt(currentArena);
  if (!ids.length && !arena) {
    panel.innerHTML = `<div class="empty"><h2>No art yet</h2>Put ChatGPT images in <code>art/raw/&lt;id&gt;/</code> (see <code>art/PROMPTS.md</code>), run <code>npm run art</code>, then reload this page.</div>`;
    return;
  }
  const rig = current ? charArt(current)!.rig : null;
  panel.innerHTML = `
    ${ids.length ? `<h2>Character</h2>
    <select id="who">${ids.map((id) => `<option value="${id}" ${id === current ? 'selected' : ''}>${ROSTER.find((d) => d.id === id)!.name}</option>`).join('')}</select>
    ${SLIDERS.map((s) => `<label>${s.label}<input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.get(rig!)}" data-k="${s.key}"><output>${s.get(rig!)}</output></label>`).join('')}` : '<p class="empty">No character has both body.png and weapon.png yet.</p>'}
    ${arena ? `<h2>Arena floor</h2>
    <select id="arena" aria-label="Arena"></select>
    <div id="arenaBox"><canvas id="arenaCv" width="320" height="320"></canvas></div>
    ${FLOOR.map((s) => `<label>${s.label}<input type="range" min="0" max="1" step="0.005" value="${arena.floor[s.key]}" data-f="${s.key}"><output>${arena.floor[s.key]}</output></label>`).join('')}` : ''}
    <div class="row"><button class="primary" id="save">Save</button><button id="copy">Copy rig JSON</button></div>
    <div id="status"></div>`;
  const cv = document.getElementById('arenaCv') as HTMLCanvasElement | null;
  if (cv) drawArenaPreview(cv);
  const arenaSelect = document.querySelector<HTMLSelectElement>('#arena');
  if (arenaSelect) {
    arenaSelect.replaceChildren(...arenaNames.map((id) => new Option(id, id, false, id === currentArena)));
    arenaSelect.addEventListener('change', () => {
      currentArena = arenaSelect.value;
      render();
    });
  }
  document.getElementById('who')?.addEventListener('change', (e) => {
    current = (e.target as HTMLSelectElement).value;
    rebuild();
    render();
  });
  panel.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const s = SLIDERS.find((x) => x.key === inp.dataset.k)!;
      const r = structuredClone(charArt(current)!.rig);
      s.set(r, Number(inp.value));
      setRig(current, r);
      (inp.nextElementSibling as HTMLOutputElement).value = inp.value;
      rebuild();
    }),
  );
  panel.querySelectorAll<HTMLInputElement>('input[data-f]').forEach((inp) =>
    inp.addEventListener('input', () => {
      const f = { ...arenaArt(currentArena)!.floor, [inp.dataset.f!]: Number(inp.value) };
      setFloor(currentArena, f);
      (inp.nextElementSibling as HTMLOutputElement).value = inp.value;
      if (cv) drawArenaPreview(cv);
    }),
  );
  const status = document.getElementById('status')!;
  document.getElementById('copy')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rigJson(), null, 2));
      status.textContent = 'Copied. Paste into art/rig.json.';
    } catch {
      status.textContent = 'Clipboard blocked: use Save instead.';
    }
  });
  document.getElementById('save')!.addEventListener('click', async () => {
    status.textContent = 'Saving…';
    try {
      const res = await fetch('/__rig', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rigJson()) });
      const j = await res.json();
      status.textContent = j.ok ? 'Saved to art/rig.json and public/art/manifest.json.' : `Save failed: ${j.error}`;
    } catch (e) {
      status.textContent = `Save failed (is this the dev server?): ${String(e)}`;
    }
  });
}

rebuild();
render();
