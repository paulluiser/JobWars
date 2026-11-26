# Job Wars

> **New here? Start with [docs/HANDOFF.md](docs/HANDOFF.md)**: architecture, game logic, balance, design system, infrastructure, security, testing and what's left to build.

Browser auto-battler where real-world jobs fight as chibi RPG heroes. Design: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

Current state: **M4 + full art**: all 30 jobs playable with real art (sprites, cutscene portraits, icons), seven painted
arenas and a painted props sheet (summons, thrown objects, special-move props, items, effects). Auto-balanced to
43–56% overall win rates. Character select with role filter, attribute bars and Simple/Detailed skill text.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (?seed=123 replays a fight; ?mode=tag&blue=chef,nurse&red=miner,pilot)
npm test           # sim determinism/combat tests + art pipeline test
npm run art        # process art/raw → public/art (see Art pipeline)
npm run simstats   # every matchup N times: win-rate matrix, fight length, per-fighter stats
npm run tagstats   # random 2v2 fights: errors, time-outs, fight length, per-job win rate
npm run tune:tag   # auto-balance the 2v2 layer (writes src/data/tagBalance.ts); 1v1 is untouched
npm run gachastats -- 2000 [tag]   # Gacha balance: match length, time-outs, job and card win rates
npm run tune:gacha # auto-balance the Gacha-only job layer (writes src/data/gachaBalance.ts)
npm run art:cards  # regenerate art/PROMPTS_CARDS.md (one ChatGPT prompt for every card icon)
npm run sfx -- --src <unzipped pack>   # cut the recorded sound effects into public/sfx
npm run tune       # auto-balance ATK/HP multipliers toward 50% (writes src/data/balance.ts)
```

Keys: `F` fighters · `R` rematch · `T` replay seed · `Space` pause · `S` speed · `J` juice on/off · `M` sound · `C` cutscenes (full/short/off) · `L` layout (auto / 9:16 / 16:9) · `Enter` fight (on the select screen).
Link a specific fight with `?blue=chef&red=fisher&seed=1234&arena=theatre`.
Add `?layout=portrait` to the URL to force the vertical layout, e.g. for recording Reels/TikTok on desktop.

## Art pipeline (M3)

1. Generate images in ChatGPT with the prompts in [art/PROMPTS.md](art/PROMPTS.md) (rules: [docs/ART_STYLE.md](docs/ART_STYLE.md)).
2. Put each job's images (any file names, sprite sheets OK) in a folder named after the job inside `art/inbox/`
   (or anywhere, then `npm run art -- --inbox "/that/folder"`). Put the props sheet in `Props` and each
   arena painting in `Arena - <id>` or name it by ID inside `Arena` (see [arena prompts](art/PROMPTS_ARENAS.md)).
3. `npm run art` cleans them into `public/art/` (background removal, trim, resize, manifest).
4. `npm run dev`, open `/rig.html`, align each arm with its shoulder or select an arena and align its floor, then **Save**.
5. Reload the game. Characters with art use it; the rest keep the placeholders.

## Deploy (Vercel)

Static Vite build, no server. Import the repo in Vercel and it picks up `vercel.json`
(`npm run build` → `dist/`). Or from the CLI: `npx vercel --prod`.

## Layout

- `src/sim/` deterministic fixed-tick combat (seeded RNG, no DOM)
- `src/ai/` swing-or-charge choice (skill AI plugs in here in M2)
- `src/data/roster.ts` stats + Simple/Detailed skill text
- `src/sim/kits.ts` passive / active / special behaviour per job
- `src/render/` PixiJS scene, puppet rigs, particles, juice (hit-stop, shake, slow-mo)
- `src/audio/` procedural Web Audio SFX
- `src/ui/` DOM HUD, character select, results, special-move cutscene, placeholder SVG portraits

## Sound effects & credits

Recorded sound effects: **"Oculus Audio Pack 01" by Oculus VR, LLC**
(https://developers.meta.com/vr/downloads/package/oculus-audio-pack-1/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Taken from Meta's
[Meta-open-sound](https://github.com/facebookincubator/Meta-open-sound) release
`oculus-audio-pack-v1.0.0` (OGG bundle, checksums verified), then cut, loudness-levelled and
converted to MP3 by `tools/sfx/build.ts`. The licence and attribution ship with the game in
`public/sfx/`, and the credit is shown on the character-select screen.

- Which source clip becomes which sound: `tools/sfx/samples.ts`.
- Which sound plays for each job, skill, event, status and hazard: `src/audio/sfxmap.ts`.
- Fire, explosions, thunder, zaps, the charge hum and the heartbeat are procedural (`src/audio/sfx.ts`),
  as is the music (`src/audio/music.ts`). Anything not loaded falls back to procedural sound.

## Game modes

The game opens on a main menu with three modes:

- **Player vs Player**: *PvP Classic (1v1)*, *PvP Gacha (1v1)*, *Tag Team Classic (2v2)* and *Gacha Tag
  Team (2v2)*. Play by **quick match** (matched by rank first, then widened) or a **5-letter lobby code**.
  Online play is peer-to-peer over WebRTC (PeerJS, `src/net/pvp.ts`): only the seed, the fighters and the
  card picks are sent, and both machines simulate the identical fight. The sim's maths is engine-independent
  (`src/sim/dmath.ts`) so Chrome, Safari and Firefox agree bit for bit; a result hash checks it. **MMR**
  (Elo, `src/modes/mmr.ts`) with ranks Intern → Associate → Specialist → Manager → Director → Executive → CEO
  is kept in the browser.
- **Story Mode**: a 24-level career across six Metro City districts (`src/modes/story.ts`). Start with the
  Chef, Firefighter and Nurse and recruit the other 27 jobs by beating them. Every level is a Gacha fight
  with a twist: classic rules, time attack, survival 1-vs-2, bosses with big HP and epic cards, power surges
  (a pick every 10 s), sudden death, lab accidents, tag teams and a finale. 1–3 stars per level.
- **CPU Battle**: everything unlocked. 1v1, Tag Team (with a **Gacha** toggle: you draft for Blue, the CPU
  drafts for Red at random) and Tournaments. The arena picker offers every arena and Auto, which uses
  the home arena of a fighter chosen by the match seed. Tournaments use the Job Fair Arena.

### Gacha (Chaos-style card draft)

Pick 1 of 3 cards before the fight, then the fight pauses for another pick **every 20 s** (12 s countdown,
2 rerolls a match). Odds shift toward rare and epic picks as the match goes on. **82 cards**
(`src/data/cards.ts`): 45 general (15 common, 15 rare, 15 epic), 7 class cards (one per role) and 30 job
cards, offered only to a team with that class or job. Gacha matches run 2–3 minutes (×4.2 HP, 3:00 limit);
from 1:40 **overtime** ramps damage up and cuts healing so stalling doesn't win. The **Cards** button (B)
shows both sides' cards; each HUD ID card shows its card strip. Gacha has its own job-balance layer
(`src/data/gachaBalance.ts`).

### Special moves: the rage bar

Every fighter fills a rage bar by dealing and taking damage (plus a slow trickle). When it's full the special
fires and the bar empties, so specials repeat in long fights. The first special of each fighter gets the full
cutscene, repeats get the short one.

### Card art

Paste the single prompt in `art/PROMPTS_CARDS.md` into ChatGPT (with the Chef master attached), save the
image in a folder called **Cards** in your assets folder, and run `npm run art -- --inbox "<that folder>"`.
It slices the 10 × 9 sheet into the 82 card icons and 8 card effects. Until then cards show an emoji.

### Title screen, menu and loader art

`art/PROMPTS_UI.md` holds three ChatGPT prompts: the landing poster (landscape and portrait) and a 5 × 4 UI emblem
sheet (menu mode emblems, the seven PvP rank insignia, the six Story district emblems, trophy, star, lock, loader
badge). Drop them in a `Poster` / `UI` folder, or all three in one folder such as `UI Assets` (they're told apart by
shape), and run `npm run art -- --inbox "<assets folder>"`. The boot loader is plain HTML in `index.html` so it
paints instantly; the title screen is `src/ui/title.ts`; the animated menu is `renderMenu` in `src/ui/menu.ts`.
Card sheets are de-fringed on import (generator halos removed, effect glows kept).

