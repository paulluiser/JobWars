# Job Wars: Handoff Document

_Last updated: 2026-11-26. Covers the state of the code at the `main` branch's first commit._

Job Wars is a browser auto-battler: 30 real-world jobs (Chef, Firefighter, Nurse, …) fight as chibi RPG heroes that
bounce around a walled arena like balls, swing their work tools on a rhythm, and cast job-themed skills. You don't
steer; you pick fighters (and, in Gacha modes, draft buff cards) and watch. It ships as a static site (Vite +
PixiJS + TypeScript) and deploys to Vercel with no backend.

This document is the single entry point for whoever picks the project up. Read sections 1–4 first; the rest is
reference.

---

## Contents

1. [Status at a glance](#1-status-at-a-glance)
2. [Getting started](#2-getting-started)
3. [Repository map](#3-repository-map)
4. [Architecture](#4-architecture)
5. [Game logic](#5-game-logic)
6. [Game modes](#6-game-modes)
7. [Balancing](#7-balancing)
8. [Design system](#8-design-system)
9. [Animation and game feel](#9-animation-and-game-feel)
10. [Audio](#10-audio)
11. [Art pipeline](#11-art-pipeline)
12. [Infrastructure and deployment](#12-infrastructure-and-deployment)
13. [Security and privacy](#13-security-and-privacy)
14. [Testing](#14-testing)
15. [Known issues and limitations](#15-known-issues-and-limitations)
16. [What's missing and how to build it](#16-whats-missing-and-how-to-build-it)
17. [Decision log](#17-decision-log)
18. [Conventions](#18-conventions)

---

## 1. Status at a glance

| Area | State |
|---|---|
| Combat simulation | Done. Deterministic 60 Hz sim, 30 jobs with unique kits, 27 status effects, rage-bar specials. |
| Modes | Done: CPU Battle (1v1, Tag Team 2v2, Tournament, optional Gacha), Player vs Player (4 modes, online), Story (24 levels). |
| Gacha (card draft) | Done. 82 cards, pick every 15 s, overtime, own balance layer. |
| Online PvP | Done (peer-to-peer). Verified with two browser tabs; not yet tested across two real devices/networks. |
| MMR / ranks | Done, stored per browser (not tamper-proof; see §13). |
| Art | Done: 30 characters (body, arm+tool, bust, icon), 1 arena, 30 props, 82 card icons + 8 card effects, 2 posters, 20 UI emblems. |
| Audio | Done: recorded SFX (Meta's Oculus Audio Pack, CC BY 4.0) per job/skill/event + procedural music. **No voice lines** (deliberate decision). |
| Front-end flow | Done: boot loader → title (poster) → main menu → modes, with transitions; landscape and portrait layouts. |
| Arenas | **One arena only.** Multiple themed arenas were being designed when work paused; see §16.1 for the full plan. |
| Tests | 39 passing (Vitest): sim, attributes, art pipeline, modes, gacha, story, MMR, deterministic maths. |
| Deploy | Static build to Vercel (`vercel.json` present). Not deployed from this machine yet. |

---

## 2. Getting started

Requirements: Node 20+ (developed on Node 22), npm. `ffmpeg` only for rebuilding sound effects.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 39 tests
npm run build        # typecheck (app + tools) and production build into dist/
```

Useful URLs while developing:

- `/?seed=123&blue=chef&red=nurse`: opens straight into that exact fight (also what the **Share** button produces).
- `/?mode=tag&blue=chef,nurse&red=miner,pilot&seed=5`: Tag Team.
- `/?layout=portrait` / `?layout=landscape`: force a layout.
- `&g=0.0.hard-hat,1.0.phoenix,…`: a Gacha match's whole draft (team.pick.card), part of Gacha share links.
- `/rig.html`: the arm-rig tuner (dev only; Save writes `art/rig.json`).

All tool scripts (balance, art, sound) are listed in §7, §10 and §11. `window.game` is exposed in the browser
console for debugging.

---

## 3. Repository map

```
index.html              boot loader (inline, paints instantly), HUD/overlay markup, controls bar
rig.html                dev-only arm rig tuner page
src/
  main.ts               entry: layout (auto/portrait/landscape), keyboard shortcuts, controls, boot progress
  game.ts               the Game controller: screens, match flow, draft, replays, PvP/Story glue, event → feel
  sim/                  the deterministic simulation (no DOM, no Pixi; runs in Node for tests and tuners)
    sim.ts              Sim class: physics, attack table, damage, statuses, rage, cards, surges, overtime, end
    kits.ts, kits2.ts   the 30 job kits (passive / active / special), hook-based
    types.ts            Fighter, FighterDef, SimEvent, statuses …
    constants.ts        COMBAT tuning, RAGE, TAG_SCALE, arena size, tick rate
    dmath.ts            engine-independent sin/cos/atan2/exp/hypot (cross-browser lockstep)
    rng.ts              seeded mulberry32 (the sim never calls Math.random)
  ai/brain.ts           the tiny decision layer: special → active → swing/charge
  data/
    roster.ts, roster2.ts   the 30 jobs: stats, skill texts (Simple/Detailed), colours, quirks
    attributes.ts       11-attribute ratings per job → stats; signature strengths/weaknesses
    balance.ts          1v1 ATK/HP multipliers (written by `npm run tune`)
    tagBalance.ts       2v2 layer (written by `npm run tune:tag`)
    gachaBalance.ts     Gacha layer (written by `npm run tune:gacha`)
    cards.ts            82 gacha cards, the Aug profile, draft odds, GACHA settings
  modes/
    gacha.ts            offers, CPU picks, headless runGacha / replayGacha
    tournament.ts       knockout brackets
    story.ts            chapters, 24 levels, judging, progress (localStorage)
    mmr.ts              Elo + ranks, profile (localStorage)
  net/pvp.ts            PeerJS session: lobby codes, quick match, messages, handshake
  render/               PixiJS: scene/camera/arena, fighter puppets & sprite rigs, fx, juice, art loader
  ui/                   DOM screens: menu, select, draft, cards, bracket, story/pvp screens, HUD, intro,
                        title, cutscene, styles.css (the whole design system)
  audio/                sfx.ts (bus + procedural), samples.ts (recorded clip player), sfxmap.ts, music.ts
  tools/rig.ts          rig tuner page logic
tools/                  Node scripts: balance tuners/stats, art pipeline, sound build, prompt generators
tests/                  Vitest suites
art/                    ChatGPT prompt packs (PROMPTS*.md), rig.json, raw/ (source art), inbox/ (drop zone)
public/art/             processed game art + manifest.json (generated; committed so the site deploys)
public/sfx/             processed sound effects + licence + manifest (generated; committed)
docs/                   GAME_DESIGN.md (design bible + milestone log), ART_STYLE.md, HANDOFF.md (this)
```

---

## 4. Architecture

### 4.1 Layers

```
   ┌──────────────┐  events (SimEvent[])  ┌──────────────────────────────┐
   │  Sim (pure)  │ ────────────────────▶ │ Game.handle(): juice, fx, sfx │
   │  60 Hz fixed │                       │ HUD, callouts, cutscenes      │
   └──────▲───────┘                       └──────────────┬───────────────┘
          │ step() / addCard() / resume()                │ render(alpha)
   ┌──────┴───────┐                       ┌──────────────▼───────────────┐
   │ Game (flow)  │ ◀── DOM screens ────▶ │ Scene (PixiJS): arena, views  │
   │ modes, draft │                       │ FighterView, Fx, camera       │
   └──────▲───────┘                       └──────────────────────────────┘
          │ picks / seed / results
   ┌──────┴───────┐
   │ PvpSession   │  WebRTC (PeerJS)
   └──────────────┘
```

- **The sim is the single source of truth** and knows nothing about rendering. It advances in fixed 1/60 s ticks
  and returns a list of events (`hit`, `blocked`, `parry`, `skill`, `status`, `ko`, `surge`, `card`, `proc`, …).
- **Rendering interpolates** between the last two ticks (`alpha`) so motion is smooth at any frame rate, and the
  `Game` turns events into game feel (hit-stop, shake, particles, sounds, numbers).
- **Determinism** is the backbone of several features: replays (`?seed=`), KO replay (re-simulate the last 3 s),
  share links, Gacha replays from a draft log, tournament "skip match" (same result as watching), and online PvP.
  Rules that keep it deterministic: all randomness through the sim's seeded `Rng`; no `Math.random`, `Date` or
  wall-clock time in `src/sim` or `src/ai`; no engine-approximated maths (use `dmath.ts`); kits keep state only on
  `Fighter.kit` / `Fighter.augS`.

### 4.2 The Game controller (`src/game.ts`)

One `Game` instance owns the screen flow and the current match:

- **Screens**: `showTitle` → `showMenu` → `showSelect` (CPU Battle) / `showPvp` / `showStory` / `showLevel` /
  `showBracket`. Each screen renders into `#panel` (DOM); a MutationObserver in `main.ts` animates every new screen.
- **A match is described by a `MatchSpec`**: `kind` (cpu/pvp/story/tourney), `gacha`, `control` per side
  (`human` | `cpu` | `remote`), optional sim `extra` options, starting cards, the remote transport, an `onEnd`
  hook (Story progress, PvP MMR) and custom result screens. `begin()` runs the pre-fight draft, `newFight()` builds
  the `Sim`, the frame loop runs it, and `surge()` handles every mid-fight card pick.
- **Frame loop** order: intro hold → cutscene freeze → sim stepping (speed × slow-mo, hit-stop breaks) → replay
  camera → render → HUD → music mood / clock ticks / heartbeat → end-of-fight → KO replay or results.

### 4.3 Online PvP (`src/net/pvp.ts`)

Peer-to-peer lockstep: the host (Blue) and guest (Red) each simulate the same fight. Only these messages cross the
wire: `hello` (protocol version + MMR + mode), `picks`, `start` (seed, host only), `card` (each draft pick),
`result` (winner + hash), `rematch`, `bye`. See §13 for the trust model and §15 for limitations.

---

## 5. Game logic

### 5.1 Movement (ball physics)

Fighters never stop and never steer. Each has a cruise speed (from its Move speed attribute); speed relaxes back to
cruise after knockback (`speedRelax`). Walls reflect them like balls with a little random spin (`bounceJitter`) so
paths never loop. Hitting a wall above `wallSlamSpeed` is a **wall slam** (damage + short stun). Fighters bump each
other elastically, weighted by Weight. Solid hazards (the Builder's walls) also bounce them.

### 5.2 The attack table

A ready basic swing or charge can start when the target is in reach or their relative velocity projects it into
reach within one basic wind-up. Attack speed scales the wind-up, recovery, and cooldown. Each swing that reaches
the target at impact rolls, in order:

1. **Airborne** target (Pilot's passive): auto-miss.
2. **Dodge**: target's evasion (not while stunned/staggered or charging).
3. **Miss**: attacker's accuracy, minus a penalty at the edge of reach.
4. **Block**: target's block chance → parry (staggers the attacker) or guard (chip damage, drains the guard bar;
   an empty guard = guard break and stun). **Charged blows always break a block.**
5. **Crit**: ×1.5 damage (+ card bonuses).
6. **Hit**: knockback (heavy/crit stronger), flinch (heavy fighters have poise vs light hits), on-hit statuses.

Damage = ATK × multipliers × 100 / (100 + DEF) × ±8%. Hitting a charging fighter **interrupts** it.

**Skills** use `skillHit`: actives can be dodged, specials can't; neither can miss or be blocked.

### 5.3 Statuses

27 kinds: poison (stacks), burn, bleed, slow, wet, blind, root, silence, disarm, weaken, armorBreak, sleep, confuse,
charm, glitch, mark, spicy, hearty, light, lifeSupport, shield, haste, empower, fortify, superArmor, invuln, airborne.
Crowd control has diminishing returns within a 6 s window (×1 / ×0.5 / ×0.25). Elemental rules: wet puts out burn
and burn can't take hold on a wet target. Super armour / invulnerability grant CC immunity.

### 5.4 Jobs, kits and attributes

Each job has 11 attribute ratings 1–10 (HP, Attack, Defense, Attack speed, Move speed, Reach, Accuracy, Evasion,
Block, Crit, Weight) in `data/attributes.ts`, mapped to stats by `statsFromRatings`. Every pair of jobs differs by at
least 9 rating points and each attribute has a single champion (enforced by tests). A job's **kit**
(`sim/kits*.ts`) implements its passive (hooks such as `tick`, `strikeBonus`, `onLanded`, `onDamaged`,
`damageTakenMul` …), its active (`canCast` + `cast`, with a cooldown) and its special. Skill texts exist in
**Simple** and **Detailed** forms (`data/roster*.ts`).

### 5.5 Special moves: the rage bar

Rage (0–100) fills from damage dealt (fraction of the target's max HP × 80), damage taken (fraction of own max HP
× 92) and a 1.8/s trickle (`RAGE` in `constants.ts`). Full = the special fires (the AI fires it immediately), then
the bar empties. Specials repeat; the first per fighter gets the full cutscene, repeats the short one. Typical duel:
first special ≈19 s in, ≈1.6 per fighter.

### 5.6 Gacha cards (`data/cards.ts`)

A card is **pure data**: a partial `Aug` profile (≈45 numeric fields: `atk`, `hpMul`, `lifesteal`, `rageMul`,
`chain`, `phoenix` …). A fighter's cards are merged by `augOf()` (fields ending in `Mul` multiply, others add, with
caps: encore ≤ 0.7, cooldown ≥ ×0.4, evasion ≤ 0.2). The sim reads `f.aug` at its hook points; static changes
(HP, reach, size, weight, speed) are applied to the fighter's own copy of its def, and re-applied (keeping HP %) when a
card is added mid-fight. Cards apply to the whole team.

- 45 general cards (15 common, 15 rare, 15 epic), 7 class cards (one per role, rare), 30 job cards (one per job,
  epic). Exclusive cards are only offered to a team with that class/job, and are weighted ×3 when eligible.
- Draft: pick 1 of 3 before the fight, then every 15 s (`surgeEvery`) the sim pauses (`paused`, `surge` event) until
  every side has picked. Rarity is rolled once per round from the match seed and draft number (`PICK_ODDS`).
  Both sides share that rarity through two rerolls each round. Pick timers are 25 s before combat and
  12 s during combat. CPU picks at random, seeded.
- Offers are a pure function of (seed, team, pick, rerolls, jobs, owned), so PvP sends choices and reroll counts.

### 5.7 Gacha match rules

×4.5 HP, 2:30 limit, **overtime** from 1:40 (+25 % damage per 10 s, healing ×0.4). A time-out is decided on HP %.
Gacha uses its own job-balance layer.

### 5.8 Tag Team

2v2 with all four fighters in the arena. Bodies are scaled ×0.78 and reach ×0.9 (`TAG_SCALE`, `TAG_REACH`) so four
fit. Targets: nearest enemy. Several kits have team behaviour (Nurse/Doctor/Mechanic heal the lower-HP ally,
Musician's chorus heals allies). Its own balance layer (`tagBalance.ts`).

---

## 6. Game modes

### 6.1 CPU Battle
1v1 and Tag Team with every job unlocked, both sides picked by you (spectate). **Gacha toggle**: you draft for Blue,
the CPU drafts for Red. **Tournament**: 4/8/16 entries (Tag Team brackets up to 8 teams), seeded matches (skip =
watch), skip match/round/all, champion screen.

### 6.2 Player vs Player
Four modes: PvP Classic (1v1), PvP Gacha (1v1), Tag Team Classic (2v2), Gacha Tag Team (2v2). Quick match (by rank
tier, widening after ~20 s) or 5-letter lobby code. Each player picks their own job(s) secretly, then the host sends
the seed. Rematch keeps the connection. MMR: Elo starting at 1000, K = 48 for the first 10 games, 32 normally, 24
above 1500; ranks Intern < 900 ≤ Associate < 1050 ≤ Specialist < 1200 ≤ Manager < 1350 ≤ Director < 1500 ≤
Executive < 1700 ≤ CEO.

### 6.3 Story Mode
"Career Mode at the Metro City Job Fair": 6 chapters × 4 levels. Start with Chef, Firefighter, Nurse; each level
recruits the jobs you beat (all 30 by level 6-3). Gacha rules unless a level is "classic". Twists: classic rules,
time attack, survive a 1-vs-2, bosses (HP multiplier + epic cards), power surge (picks every 10 s), sudden death
(reduced starting HP), lab accident, tag teams, a finale. Stars: ★ clear, ★★ ≥ 40 % HP left, ★★★ under par time
(survive levels: ≥ 60 % HP). Progress in `localStorage['storyProgress']`.

---

## 7. Balancing

### 7.1 Layers (applied in this order)

1. **Attribute ratings** → stats (`attributes.ts`): the designed identity of each job.
2. **1v1 balance** (`balance.ts`): ATK/HP multipliers per job.
3. **2v2 layer** (`tagBalance.ts`): only when a side has 2 fighters.
4. **Gacha layer** (`gachaBalance.ts`): only in Gacha matches.
5. **Cards** (`cards.ts`): hand-tuned values.

Multipliers are fitted by auto-tuners that play thousands of seeded matches and nudge each job toward 50 %. Re-run
the relevant tuner after **any** kit, stat, rage or card change.

### 7.2 Tools

| Command | What it does | Time |
|---|---|---|
| `npm run simstats` | every 1v1 matchup ×N: win-rate matrix, fight length, per-job stats | ~10 s |
| `npm run tune -- 8 4 0.4` | 1v1 balancer (rounds, games per pair, step); continues from the current table | ~1 min |
| `npm run tagstats -- 2000` | random 2v2s: errors, time-outs, length, per-job win rate | ~5 s |
| `npm run tune:tag -- 10 400 0.8` | 2v2 balancer | ~2 min |
| `npm run gachastats -- 4000 [tag]` | Gacha: length, time-outs, picks, per-job and per-card win rates | ~15 s |
| `npm run tune:gacha -- 6 3000 0.5` | Gacha job balancer (half 1v1, half 2v2) | ~2 min |

### 7.3 Current numbers (fresh seeds)

| | Win-rate range | Avg length | Time-outs |
|---|---|---|---|
| 1v1 Classic | 44–57 % | 38 s | ~2.5 % |
| 2v2 Classic | 43–55 % | 37 s | ~1.5 % |
| Gacha (mixed) | 42–56 % | 2.0 min | ~7 % (3:00, decided on HP) |

Card win rates by rarity, by design: commons ~43–47 %, rares ~50 %, epics ~55–60 % (a side that rolled commons is
weaker; that's the gacha). Within a rarity, outliers were pulled in by hand. Noise floor: about ±4 % at these
sample sizes, so differences under ~5 % are not actionable.

### 7.4 How to rebalance

1. Change the kit/stat/card.
2. `npm test` (catches broken determinism and texts).
3. `npm run tune` → `npm run tune:tag` → `npm run tune:gacha` (in that order; each layer sits on the previous).
4. Check with `simstats`, `tagstats`, `gachastats`. Keep fights 30–45 s (classic) and about 2 min of combat (Gacha).
5. If a card is an outlier, adjust its numbers in `cards.ts` and update its `detailed` text to match.

---

## 8. Design system

All styling is in `src/ui/styles.css` (single file, ~1,300 lines, no framework).

- **Theme**: "workplace ID badge" paper UI on dark slate. Cards and panels are paper (`--paper` #f2efe6) with a
  dark warm-brown ink outline (`--ink` #2a1d14), a coloured strap on top, and a faint dotted paper texture.
- **Units**: everything is sized in `--u` = 1 % of the stage width (landscape, 1920 × 1080 logical) or
  1.7778 % (portrait, 1080 × H). The stage keeps its aspect ratio and the UI scales with it, so layouts are
  resolution-independent.
- **Layouts**: `body.portrait` switches to the phone layout (auto by window shape, or forced with the Layout
  button / `?layout=`). Tag Team (`body.tag`), Gacha (`body.gacha`), PvP (`body.pvp`), drafting, replaying, titled
  and selecting states are body classes that show/hide HUD parts and controls.
- **Fonts** (Google Fonts): Lilita One (display), Nunito (UI), Special Elite (typewriter labels).
- **Colour language**: team Blue #3f9cff / Red #ff5a46; rarity common #8fbf7a, rare #4c8dff, epic #a35cff; role
  lanyards (Tank #2b4a8a, Fighter #d9452b, Assassin #2a2a2a, Mage #7a4ab8, Marksman #3f8a4a, Support #f2efe6,
  Controller #e8892a); ranks have their own colours (`modes/mmr.ts`).
- **Components**: buttons (paper, ink border, drop-shadow press), badges (select grid), banners (HUD ID cards with
  HP ghost bar, guard bar, rage chip, status chips, card strip), card faces (rarity frames), chips, stamps, modal
  cards (results), dialogue bubbles (Story), seg toggles.
- **Accessibility present**: `aria-pressed` on toggles, `role=tablist` on mode tabs, `aria-live` on the boot loader,
  keyboard shortcuts for every control, `prefers-reduced-motion` honoured by menus/title.
  **Missing**: see §16.

Art direction for generated art lives in `docs/ART_STYLE.md` and every `art/PROMPTS*.md`.

---

## 9. Animation and game feel

Combat feel (`render/juice.ts`, `render/fx.ts`, `game.ts → handle`):

- **Hit-stop** (freeze frames on impact), **trauma-based screen shake**, **zoom punch**, **slow-motion** on the final
  K.O. with the camera closing in, white **hit flash** (a colour-matrix filter on sprites), **squash & stretch**
  springs (hits, wall bounces, bumps), particles (sparks, dust, shards, embers, bubbles, drips), floating damage
  numbers (crits bigger), HP **ghost bar**, guard ring under the feet, charge glow, stun stars, afterimages on dodge.
- **Sprite rig** (`render/fighterView.ts`): body + one arm-and-tool piece rotating around the shoulder. Poses: rest
  1.5 rad (tool held out front), wind-up −0.5 (drawn behind the body), strike 2.25 (forward-down); a sleeve-coloured
  shoulder cap fills the joint. Preview all 30 offline with `npx tsx tools/art/armsheet.ts out.png`.
- **Cast indicators**: skill nameplate over the caster, rotating rune ring under it, dashed telegraph line and
  lock-on reticle on the target, cast burst, HUD chip pop.
- **Set pieces**: VS intro splash, special-move cutscene (full/short/off), first-blood callout, partner-down beat
  (Tag Team), KO replay with letterbox (re-simulated from the seed), victory hop + confetti, card pick bursts, card
  effect sprites (parachute, phoenix, chain lightning, lightning rod, shield, overtime stopwatch).
- **Front-end motion**: boot loader (swinging ID badge), title screen (poster drift, rotating light rays, embers,
  letter-drop logo, pulsing start, zoom-out exit), menu (poster backdrop, card deal-in with stagger, pointer tilt,
  emblem bob, logo shine, featured-worker carousel), every screen slides in, draft cards deal in.
- Toggle juice with **J** (`Juice on/off`) to compare.

---

## 10. Audio

- **Recorded SFX** (`public/sfx`, 184 clips, 2.1 MB): from Meta's *Oculus Audio Pack 01* (CC BY 4.0, via the
  official `facebookincubator/Meta-open-sound` release, checksums verified). `tools/sfx/samples.ts` says which source
  clip (and which slice of it) becomes each key; `tools/sfx/build.ts` trims silence, loudness-levels and encodes
  mono MP3 (`npm run sfx -- --src "<unzipped pack>"`). `src/audio/sfxmap.ts` maps every job (swing family + pitch,
  hit material, active layers, special layers), event, status and hazard to keys.
- **Procedural** (`src/audio/sfx.ts`): fire, explosions, thunder, zaps, the charge hum, heartbeat and fallback for
  any missing clip.
- **Music** (`src/audio/music.ts`): procedural 16-step sequencer, moods `menu` / `fight` / `tense` (low HP or last
  15 s) plus jingles; the Oculus stingers replace the jingles when loaded.
- **Voice lines**: intentionally none (decision 2026-11-26). An ElevenLabs pipeline was built and removed.
- Audio starts on the first user gesture (title-screen tap). Mute = the Sound button / **M**.
- **Attribution requirement**: keep the credit line (select screen, title footer, README, `public/sfx/ATTRIBUTION.md`).

---

## 11. Art pipeline

All art was generated by hand in ChatGPT from the prompt packs and processed by Node scripts (`tools/art`).

| Prompt file | Produces | Pipeline output |
|---|---|---|
| `art/PROMPTS.md`, `PROMPTS_BATCH.md` | per job: one sprite sheet (master / body / arm+tool) + one bust | `public/art/<job>/{body,weapon,bust,icon}.webp`, auto-rig |
| `art/PROMPTS_PROPS.md` | one 6 × 5 props sheet | `public/art/props/*.webp` |
| `art/PROMPTS_CARDS.md` (`npm run art:cards`) | one 10 × 9 card sheet (82 icons + 8 effects) | `public/art/cards/*.webp` |
| `art/PROMPTS_UI.md` | landscape poster, portrait poster, 5 × 4 emblem sheet | `public/art/poster/*`, `public/art/ui/*` |

Workflow: put images (any file names) in folders named after the job / `Props` / `Cards` / `Poster` / `UI` /
`UI Assets` / `Arena`, then `npm run art -- --inbox "<folder>"`. Ingest classifies by folder name, whole-word file
names and image shape; sprite sheets are cut left→right into master|body|weapon; backgrounds are removed (flat or
checkerboard flood fill); grid sheets are sliced by blob centroid, de-fringed (generator halos removed, effect glows
kept) and stray edge fragments dropped. Rigs: `art/rig.json` (hand-fixed for all 30) overrides auto-rig; tune live at
`/rig.html`. Everything becomes WebP and `public/art/manifest.json`.

`art/raw/` (171 MB) holds the source images so the pipeline can always be re-run; `public/art/` (14 MB) is what ships.

---

## 12. Infrastructure and deployment

- **Build**: Vite 8, TypeScript 5 (strict), PixiJS 8, PeerJS 1.5. `npm run build` typechecks app and tools, then
  bundles to `dist/` (~640 kB JS, ~200 kB gzip; art 14 MB, sfx 2 MB, loaded progressively).
- **Hosting**: static. `vercel.json` sets framework vite, `npm run build`, output `dist`. Deploy by importing the
  GitHub repo in Vercel (auto-deploys on push to `main`) or `npx vercel --prod`. No environment variables are needed
  at build or run time.
- **Backend**: none. PvP signalling uses PeerJS's free public broker (`0.peerjs.com`) for the WebRTC handshake only;
  game data flows peer to peer. STUN only (no TURN), see §15.
- **Persistence**: browser `localStorage` only: `storyProgress`, `pvpProfile`, `pvpMode`, `mode`, `cpuGacha`,
  `detailMode`, `cutsceneMode`, `layoutMode`.
- **Dev server extras**: a Vite plugin (`vite.config.ts`, dev only) accepts `POST /__rig` from the rig tuner to write
  `art/rig.json`. It is not part of the production build.

---

## 13. Security and privacy

- **No secrets in the client or the repo.** The game needs no API keys. `.env` / `.env.*` are gitignored. The
  developer machine's `.env` holds an **ElevenLabs API key** left over from the removed voice-line experiment; it is
  not used by anything. **Rotate or delete that key** (ElevenLabs dashboard → API keys) since it was handled during
  development, and delete the local `.env`.
- **No personal data** is collected, stored server-side or sent anywhere. No analytics, no cookies.
- **PvP trust model**: peers are mutually untrusted. The protocol only accepts well-typed messages; a modified
  client can still lie about its picks/result. Mitigations in place: version/roster/card-list handshake
  (`PROTOCOL`), result-hash comparison (host's result wins on mismatch). **MMR is stored client-side and is
  editable**; it is honest-play matchmaking, not a ranked ladder. A real ladder needs a server (§16.3).
- **WebRTC exposes IP addresses** between matched peers (inherent to P2P). Mention it in a privacy note if the game
  is published widely; a TURN relay would hide them.
- **Third parties**: Google Fonts (font CSS/files), PeerJS public broker. Consider self-hosting fonts and running
  your own PeerServer for production.
- **XSS**: all text interpolated into HTML goes through an `esc()` helper or comes from static data; the only free-text
  input (lobby code) is upper-cased and stripped to `[A-Z0-9]`. Keep that rule when adding user-generated content
  (names, chat).
- **Supply chain**: 2 runtime dependencies (`pixi.js`, `peerjs`, MIT). `npm audit` reported 0 vulnerabilities at
  install. Pin versions and run `npm audit` in CI.
- **Recommended for production**: a Content-Security-Policy via `vercel.json` headers (script-src 'self';
  connect-src 'self' https://0.peerjs.com wss://0.peerjs.com; font-src fonts.gstatic.com; style-src 'self'
  'unsafe-inline' fonts.googleapis.com; img-src 'self' data:).

---

## 14. Testing

`npm test` (Vitest, ~10 s, 39 tests):

| Suite | Covers |
|---|---|
| `tests/sim.test.ts` | determinism, every active/special fires, rage-bar rules, Fireproof, arena bounds, skill texts |
| `tests/attributes.test.ts` | profiles, uniqueness (≥ 9 apart), single champions, mapping, signatures |
| `tests/modes.test.ts` | 2v2 determinism/termination, no friendly swings, tournament brackets, skip = watch, draws |
| `tests/gacha.test.ts` | card counts/caps, exclusives, deterministic offers, Gacha replay from log, Golden Parachute, Story data integrity and judging, Elo |
| `tests/dmath.test.ts` | deterministic maths vs platform maths |
| `tests/art.test.ts` | pipeline: background removal, trim, folder matching, sheet slicing, auto-rig |

Manual verification used during development (repeatable with the browser and `window.game`): every mode end to
end, both layouts, a full PvP Gacha match between two tabs (identical final tick and HP), KO replay, share links,
Story progress. **Gaps**: no UI/E2E tests, no automated cross-browser lockstep test, no visual regression tests,
no audio tests, no performance budget tests (§16.6).

---

## 15. Known issues and limitations

- **One arena only**; DEPTH foreshortening is computed from that arena's floor rectangle.
- **PvP across real devices is untested**: verified only between two tabs of one browser. Strict NATs/corporate
  networks can block WebRTC without a TURN server. If the PeerJS broker is down, PvP can't connect.
- **Cross-engine determinism** is guaranteed by construction (`dmath.ts`) but not yet exercised Chrome ↔ Safari ↔
  Firefox in practice.
- **MMR is local and editable**; both tabs in one browser share one profile.
- **A background tab doesn't advance the fight** (requestAnimationFrame pauses); in PvP the other player waits at the
  next card pick. Fine for normal play; noted for anyone testing with two tabs.
- **Text can stack over a fighter** when many labels fire at once (skill name, notes, statuses).
- **Draw rules**: a 3:00 Gacha time-out is decided on HP %; an exact tie is a draw (tournaments break ties by HP,
  then a seeded coin).
- **Story difficulty** was designed, not playtested end to end (the balancers don't cover Story twists).
- **Portrait mode on very small phones** has dense select/draft screens.
- **Bundle**: one ~640 kB chunk; PeerJS and Pixi could be split.

---

## 16. What's missing and how to build it

### 16.1 Multiple arenas (in progress when work paused)

**Goal**: 6 themed arenas (one per Story district) plus the current stone arena, assigned by context.

| Arena | Used for |
|---|---|
| Job Fair Arena (current stone courtyard) | default, tournaments, Story finale |
| Downtown street plaza | Story ch.1; jobs: courier, waiter, cleaner, merchant, police, chef |
| Construction site | Story ch.2; builder, welder, electrician, engineer, plumber |
| Hospital courtyard | Story ch.3; nurse, doctor, scientist, programmer, mechanic |
| City Hall & campus quad | Story ch.4; teacher, accountant, lawyer, athlete |
| Farm & harbour dock | Story ch.5; farmer, fisher, miner, pilot, soldier, firefighter |
| Theatre stage / grand hall | Story ch.6; tailor, barber, artist, musician |

**Steps**:
1. *Prompts* (`art/PROMPTS_ARENAS.md`): one message per arena (each needs full resolution), **attaching the current
   arena image** so the camera, box shape and wall positions match; only the theme changes. Keep the floor's
   middle clean (hazards and fighters draw on it). Square image.
2. *Pipeline*: ingest folders `Arena - <name>` (or keywords in the file name) into `art/raw/arena/<id>.png`; the
   processor already writes every PNG in `art/raw/arena` to `manifest.arenas[<id>]` with a floor rect from
   `art/rig.json` (`arenas.<id>.floor`, default x .1 y .22 w .8 h .58). Tune each floor on `/rig.html`.
3. *Loader*: `render/art.ts` currently keeps only the first arena; keep all (`arenas: Map`) and add
   `setArena(id)`; `Scene.drawArena()` already recomputes `DEPTH.k` from the floor; call it when the arena changes.
4. *Assignment*: add `arena?: string` to `MatchSpec`. Story: by chapter. CPU/PvP: home arena of a random fighter,
   chosen with the match seed (so both PvP players get the same one); tournaments: the default. Add an arena picker
   (Auto / each arena) to the CPU Battle select screen.
5. *Optional theme*: per-arena music mood or ambience and a wall-slam sound per material.

### 16.2 Network robustness (PvP)
- Run your own **PeerServer** (Node, small VPS or Fly.io) and a **TURN** server (coturn, or a managed one like
  Twilio/Metered) for NAT traversal; pass `config: { iceServers }` to `new Peer`.
- Reconnect handling (resume on brief drops), timeouts with forfeits, spectator links (join by code as a third peer).

### 16.3 Real accounts, ranked ladder and anti-cheat
Add a backend (Vercel Functions + a database such as Postgres/Neon or Upstash Redis): accounts (passkeys/OAuth),
server-side MMR, match records. Because fights are deterministic, the server can **re-simulate** a reported match
from (seed, picks, card log) with the same `Sim` code in Node and reject mismatches; that's cheap, strong
anti-cheat. Server-side matchmaking queue replaces the PeerJS slot trick.

### 16.4 Accessibility
Colour-blind-safe team/rarity palettes (add shapes/patterns, not just colour), text-size setting, full keyboard
navigation of every screen with visible focus, screen-reader labels for HUD values, captions for important sounds,
an explicit Reduce Motion toggle (not only the OS setting), photosensitivity check for flashes.

### 16.5 Settings, save and onboarding
A settings screen (volumes per bus, cutscenes, juice, layout, language), export/import of local progress, an
interactive tutorial (Story 1-1 is the closest), first-run hints for the draft and rage bar.

### 16.6 Quality and tooling
- CI (GitHub Actions): `npm ci`, `npm run build`, `npm test`, `npm audit`; deploy previews on Vercel.
- E2E tests (Playwright): boot → title → each mode; a two-browser PvP test (Chromium ↔ WebKit ↔ Firefox) that compares
  the result hash, the real cross-engine determinism check.
- Visual regression snapshots of menus; a performance budget (60 fps with 4 fighters on a mid phone).
- Code-split PeerJS (load on the PvP screen) and Pixi filters; consider a texture atlas for the 30 rigs.

### 16.7 Content and features from the design doc
Clip/GIF export of the last 10 s (MediaRecorder on the canvas), more arenas (§16.1), seasonal card sets, daily
challenge seed, spectator/caster view, localisation (all strings are in data files and templates), real composed
music (the procedural score is a placeholder), more Story chapters.

### 16.8 Story/Gacha polish
Playtest Story difficulty (consider a headless "can a random/greedy player clear it?" script using `runGacha` with
level options), card synergies display, a codex of all 82 cards, collection tracking.

---

## 17. Decision log

| Decision | Choice |
|---|---|
| Genre | Auto-battle spectate (ball-bounce movement, no steering), RPG-styled real jobs |
| Roster | Top 30 jobs, related jobs merged; all unlocked outside Story |
| Visual style | Original hand-painted chibi RPG (Zenonia 4 as a quality bar only); workplace ID-badge UI |
| Art source | Generated manually in ChatGPT from prompt packs; processed by our pipeline |
| Layouts | Landscape 16:9 and portrait (device shape) |
| Specials | Rage bar (was: once at ≤ 30 % HP) |
| Gacha | Pick every 15 s, about two minutes of combat, 45 general + class + job cards, CPU picks randomly |
| PvP networking | PeerJS P2P lockstep (chosen over Vercel + Upstash and local-only) |
| MMR | Elo with job-title ranks, client-side |
| Voice lines | None (ElevenLabs pipeline built, then removed by decision) |
| Sound library | Meta Oculus Audio Pack 01 (CC BY 4.0); Kenney was unreachable from the dev environment |
| Language | English only |

---

## 18. Conventions

- TypeScript strict; no framework for UI (template strings into `#panel`, event delegation via `data-*`).
- Sim code: no DOM, no Pixi, no `Math.random`, no wall-clock time, use `dmath` for trig/exp; anything stateful goes
  on the `Fighter`. Add new card mechanics as `Aug` fields + one hook in `sim.ts`, never as special cases.
- Data-first: jobs, cards, levels, sounds and prompts are tables; prefer editing data to editing logic.
- Generated files (`public/art`, `public/sfx`, `data/*Balance.ts`, `art/PROMPTS_CARDS.md`) are committed but should
  be regenerated by their scripts, not hand-edited (small hand nudges to balance tables are fine).
- After gameplay changes: `npm test`, then the relevant tuner(s), then a quick browser pass in both layouts.
- Comments explain *why*; user-facing text has Simple and Detailed versions for skills and cards.
