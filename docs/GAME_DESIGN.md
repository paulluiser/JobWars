# JOB WARS — Game Design Document (v0.1, planning)

> Working title. A browser-based **auto-battle spectator game**: pick fighters, watch them fight.
> Fighters are **real-world jobs reimagined as chibi fantasy RPG heroes** (a Chef with a flaming wok, a Plumber who travels through pipes).
> Art direction is inspired by Zenonia 4. It uses that game's *quality bar and techniques*, not its characters, UI or assets.

Decisions locked so far:

| Topic | Decision |
|---|---|
| Platform | Browser, **landscape 16:9 and portrait 9:16** (auto by screen shape; 9:16 can be forced for recording Reels/TikTok). Portrait stretches to tall phones (up to ~9:19.5). Static build, deploys to Vercel |
| Control | **Auto-battle, spectate.** Fighters **bounce like balls** in a square box (no steering) and **swing nonstop**; every swing that reaches is **dice-rolled from stats** |
| Roster | **30 real-world jobs**, related jobs merged, styled as fantasy RPG heroes |
| Art | **AI-generated painted sprites**, rigged and animated in code |
| Modes | Main menu: **Player vs Player** (Classic 1v1, Gacha 1v1, Tag Team Classic 2v2, Gacha Tag Team 2v2; quick match or lobby code; MMR ranks), **Story Mode** (24 levels, recruit all 30 jobs), **CPU Battle** (1v1, Tag Team, Tournament; optional Gacha) |
| Skills | 1 passive + 1 active + 1 low-HP special (with cutscene) per character |
| Text | Every skill has a **Simple** and a **Detailed** description (toggle) |
| Picking | Player picks **both sides freely**; mirror matches and random slots allowed |
| Progression | **None.** Sandbox: all 30 characters unlocked from the start |
| UI style | **Workplace ID badge** (section 5.5) |
| Image tool | **GPT-image / ChatGPT** (section 5.7) |
| Language | **English only** for v1 |
| Character looks | **One fixed design per job**, no variants or skins |

---

## 1. Core loop

1. **Mode select:** 1v1, Tag Team or Tournament (tabs at the top of the select screen).
2. **Character select:** the player fills **both sides freely** (Blue and Red, 1 or 2 slots each). The same job can appear on both sides (mirror matches). There's a **Random** button per slot and a **Random all** button. The grid of 30 has role filters. Each card shows the portrait, role, quirk and three skills, with a Simple/Detailed toggle.
3. **VS screen:** the two sides with portraits, role badges and stat bars (2–3 s, skippable).
4. **Battle:** AI vs AI, about 45–90 s. Speed toggle 1× / 2×. Cutscenes: Full / Short / Off.
5. **Results:** winner pose, MVP stats (damage, blocks, parries, statuses applied, special used), **Rematch**, **Swap sides**, **Replay (same seed)**, **Save clip**.

Why it's fun to watch: fights swing back and forth. Every character has a **comeback special** that unlocks at low HP, so the losing side always has one dramatic moment left.

---

## 2. Combat rules

### 2.0 Movement and attacking (decided after the M1 prototype)

Like ball-battle sims, **nothing is steered**:

* **Movement is ball physics.** Each fighter launches in a random direction at its **cruise speed** and bounces off the box walls (with a small random spin on every bounce so paths never repeat) and off each other (elastic bump, heavier fighters push lighter ones). Hits add knockback on top; speed relaxes back to cruise speed. Fighters only slow down (charging, stunned), never stop.
* **Attacking is continuous.** Every fighter swings on a fixed rhythm (wind-up → strike → recover → cooldown), forever, whether or not the foe is close. A swing only matters if the foe is **within reach** at the moment it lands.
* **Hitting is chance.** A swing in reach rolls the **attack table** from both fighters' stats, in this order:
  1. **Dodge**: the defender's *evasion* (hops aside). Not while stunned or charging.
  2. **Miss**: the attacker's *accuracy*, falling off by up to 35% at the very edge of reach.
  3. **Block**: the defender's *block chance* → a share of blocks are **parries** (*parry share*). A block takes 30% damage and 25 Guard; 0 Guard = **guard break**.
  4. **Crit**: *crit chance*, ×1.5.
  5. **Hit**.
* **Charge:** each swing cycle has a *charge chance* to wind up a heavy blow instead. Once full, it's **held** (glowing) for up to 1.5 s until the bounce brings the foe into reach.

The randomness is the point: every fight plays out differently, and the stats tilt the odds rather than decide the result. Skills are the planned, character-specific layer on top of this.

**Skill rules (built in M2):**
* **Active skills** fire automatically when off cooldown and the kit's condition holds (e.g. "foe within reach", "foe 170–470 px away"). They **never miss and can't be blocked**, but the target's **evasion can dodge them**.
* **Specials** unlock once at **≤30% HP** and fire immediately (even mid-swing or staggered; not while stunned). They **can't be dodged**. Time freezes for the cutscene (Full 1.8 s / Short 0.9 s / Off), then the effect plays.
* A clean hit or skill on a charging fighter interrupts the charge.
* Elemental rules live in the sim: **Wet** puts out Burn and blocks new Burn ("FIZZLE"); Wet makes Shock effects stun instead of stagger.

### 2.1 Stats

> **Attribute profiles (current source of truth):** every job has its own profile of 11 attributes rated 1–10: HP, Attack, Defense, Attack speed, Move speed, Reach, Accuracy, Evasion, Block, Crit, Weight (`src/data/attributes.ts`). Ratings map to stats (e.g. Attack speed 1 → 1.35 s swing cycle, 10 → 0.62 s; Move speed 250–440 px/s; Reach 118–200 px; Weight also sets body size and charge habits). Every pair of jobs differs by ≥ 9 rating points and most attributes have a single champion (fastest swing: Tailor; fastest mover: Courier; longest reach: Fisher; best accuracy: Accountant; best evasion: Waiter; best block: Police; best crit: Barber; most HP and heaviest: Builder). The select card shows each job's Strength and Weakness. The auto-balancer then scales only ATK and HP to keep win rates near 50%. The table below is the original v0 range.

| Stat | v0 (placeholders) | Notes |
|---|---|---|
| HP | 1,250 – 1,550 | tuned so fights last ~45–60 s |
| ATK | 110 – 150 | all damage scales off ATK |
| DEF | 15 – 30 | damage taken × `100 / (100 + DEF)` |
| Cruise speed | 330 – 380 px/s | ball speed in a 520 × 520 box |
| Reach | ~150 px | centre to the foe's edge |
| Swing rhythm | 0.8 – 1.05 s per cycle | wind-up + recover + cooldown |
| Accuracy | 80 – 90% | |
| Evasion | 5 – 15% | |
| Block chance / parry share | 20 – 30% / 15 – 45% | |
| Crit chance / dmg | 8 – 15% / ×1.5 | |
| Charge chance | 10 – 15% per cycle | |
| Weight | 0.9 – 1.3 | bump and knockback resistance; ≥1.2 gives poise |
| Guard | 100 | drains 25 per block, regenerates 12/s |

**Damage formula:** `ATK × skill% × 100/(100+DEF) × crit × buffs/debuffs × random(0.92–1.08)`

### 2.2 The combat triangle (easy to read at a glance)

The triangle survives as **odds**, not AI timing:

```
      BLOCK  ──beats──▶  BASIC ATTACK
        ▲                     │
     beaten by             beats (interrupts wind-up)
        │                     ▼
      CHARGE ATTACK ◀─────────┘
```

* **Basic attack:** the nonstop swings. A clean hit on a charging fighter **interrupts** the charge (0.45 s stagger).
* **Block:** rolled from block chance. Blocked hits deal 30% and drain 25 Guard. **Guard Break** at 0 Guard: stunned 1.2 s, big "BREAK!" pop.
  * **Parry:** a share of blocks are parries: no damage, the attacker is staggered 0.6 s. Cyan "PARRY!" flash and a bell-like SFX.
* **Charge attack:** wind-up with a pulsing glow and rising hum, held until in reach, then 210–240% ATK. If the defender rolls a block, **the charge breaks it** (guard break), so "charge beats block" is never ambiguous. Charging fighters can't dodge or block, which is the risk.
* **Flinch:** a clean hit cancels the target's light swing wind-up (0.18 s stagger; heavy hits 0.4 s). **Heavy fighters have poise** and keep swinging through basic hits.
* **Dodge:** rolled from evasion; the fighter hops sideways (a small physics impulse), leaving afterimages.
* **Active skill:** on cooldown (7–14 s).
* **Special move:** unlocks **once per match** when HP ≤ 30%. Time freezes during the cutscene, so it's fair.

### 2.3 Status effects

| Status | Effect | Stacking | Icon / VFX |
|---|---|---|---|
| **Poison** | 1.5% max HP per second | up to 5 stacks, duration refreshes | green bubbles, sickly tint |
| **Burn** | 2% max HP per second, healing received −30% | no stacking, duration refreshes | embers, orange flicker |
| **Bleed** | 1% max HP per second, doubled while moving | up to 3 stacks | red drips |
| **Slow** | move speed −X% | strongest one applies | frost on feet |
| **Stun** | can't act | — | stars orbit the head |
| **Root** | can't move, can attack | — | chains/vines at the feet |
| **Silence** | can't use the active skill or special | — | "…" speech bubble |
| **Disarm** | can't basic attack | — | weapon greyed out |
| **Blind** | 50% of basic attacks miss | — | dark swirl over the eyes |
| **Weaken** | ATK −X% | strongest one applies | purple down-arrow |
| **Armor Break** | DEF −X% | strongest one applies | cracked shield icon |
| **Sleep** | can't act; broken by damage, and the hit that wakes them deals +50% | — | "Zzz" |
| **Confuse** | moves randomly, 30% of attacks miss | — | spinning "?" |
| **Charm** | walks toward the caster, can't attack | — | hearts |
| **Wet** | Slow 15%, takes +30% Shock damage, immune to Burn | — | droplets, blue sheen |
| **Knockback / Knock-up** | displacement; slamming into a wall stuns 0.4 s and deals +10% | — | dust, impact ring |
| Buffs: **Shield, Haste, Regen, Empower, Super Armor, Invulnerable** | — | — | gold / cyan auras |

**Crowd-control diminishing returns:** a second hard CC (Stun, Sleep, Root or Charm) within 6 s lasts 50% as long, and a third lasts 25%. This prevents stun-lock loops in an auto-battler.
**Cleanse** removes debuffs. **Dispel** removes buffs and shields.

**Elemental interactions** (small, readable combos):
* Wet + Shock → Stun duration doubled
* Wet removes Burn; Burn can't apply while Wet
* Poison + Burn on the same target → "Toxic Fumes" (+20% damage from both)

### 2.4 Roles (MOBA-style)

| Role | Count | Identity |
|---|---|---|
| Tank | 4 | high HP/DEF, blocks often, crowd control |
| Fighter | 6 | sustained melee damage, all-round |
| Assassin | 4 | burst, mobility, crits |
| Mage | 5 | skill damage, zones, statuses |
| Marksman | 3 | ranged basic attacks, kiting |
| Support | 6 | healing, cleansing, buffs (strongest in Tag mode) |
| Controller | 2 | disables and counters |

### 2.5 AI (minimal by design)

There's no movement AI: the bounce decides positioning. The only per-character choice is, each swing cycle, **swing or charge** (from *charge chance*). In M2, the same hook decides when to fire the **active skill** (on cooldown, with simple conditions such as "foe in reach" or "ally below 40%") and the **special** (as soon as it unlocks at ≤30% HP). Personality now comes from stats: Police has a high block chance, the Waiter high evasion, the Bruiser-type jobs high weight.

---

## 3. Modes

### 3.1 1v1
One fighter per side. The player picks both freely (any slot can be randomized).

### 3.2 Tag Team (2v2)

*Built.* Teams are split down the middle of the picks; the last team with someone standing wins, and a fallen partner gets a "DOWN!" beat instead of the slow-mo K.O. Four fighters share the box, so in 2v2 every body is drawn and collides at 78% size (`TAG_SCALE`) and reaches 90% as far (`TAG_REACH`). 2v2 has its own balance layer (`src/data/tagBalance.ts`, written by `npm run tune:tag`) on top of the 1v1 numbers, so 1v1 is untouched. Check: `npm run tagstats -- 3000` → 40.5 s average, 1% time-outs, every job 46–54%.

### 3.3 Tournament

A knockout bracket of 4, 8 or 16 entries (single jobs, or pairs for a Tag Team bracket). Each match's seed is fixed when the bracket is drawn, so skipping a match simulates exactly the fight you would have watched. A draw goes to the side with more HP left, then a coin flip from the seed. Results are written in after the first watch only; Rematch/Watch again don't change the bracket.

The player assigns 4 fighters, 2 per side. **All four fight on the field at the same time** (decided).

**Rules**
* A side wins when both enemy fighters are KO'd. A KO'd fighter stays down unless revived (only Nurse's *Code Blue* can do that).
* **No friendly fire.** Area skills only hit enemies; ally-targeted skills (heals, cleanses, buffs) only affect the team.
* Each fighter's special still unlocks at their own 30% HP, once per match. If two specials trigger in the same tick, their cutscenes play back to back, the lower-HP fighter's first.
* Statuses and quirks that mention a "partner" or "ally" (Mechanic repairs, Nurse Triage, Chef's Special, Cleaner's Spotless, Musician's Chorus, Electrician's chain) only matter in this mode. That's what makes Supports worth picking here.
* The arena is 15% larger than in 1v1 so four fighters and their zones have room.

**Team AI** (on top of the 1v1 utility AI)
* **Target selection:** each fighter scores both enemies by distance, enemy HP %, threat (role and buffs) and its own role. Assassins hunt the weakest or backline enemy; Tanks stay near their ally and peel; Marksmen and Mages keep distance and target whoever is closest to their ally.
* **Focus fire:** a small bonus for attacking the same target as the ally. This makes kills happen, so fights don't drag.
* **Peel:** if the ally is below 40% HP and being hit, Tanks and Controllers switch to the attacker and use crowd control on them.
* **Positioning:** ranged fighters stay behind their melee ally; melee fighters stay between enemies and their backline.
* **Combos:** light cooperation is allowed, e.g. an ally holds a CC'd target in place while the other charges a heavy attack, or Firefighter's Wet sets up Electrician's stun.

**Readability with four fighters** (the main risk of this mode)
* Team colour rings under each fighter (blue vs red) plus a small team-coloured outline glow.
* Damage numbers from your own team are slightly smaller, and numbers that overlap get spread apart.
* The camera frames all four fighters, and pushes in on 1v1 duels inside the fight when the other pair is far away.
* Hit-stop only freezes the two fighters involved, so another duel keeps moving. Specials still freeze everything.
* A kill feed in the top centre ("Chef ⚔ Pilot") and a "2 vs 1!" banner when a fighter falls.

---

## 4. Roster: 30 jobs (with merges)

| # | Job | Merged from | Role |
|---|---|---|---|
| 1 | Farmer | farmer, gardener, rancher | Fighter |
| 2 | Fisher | fisherman, sailor | Marksman |
| 3 | Builder | construction worker, mason, carpenter | Tank |
| 4 | Miner | miner, quarry worker | Fighter |
| 5 | Welder | welder, factory worker, blacksmith | Fighter |
| 6 | Electrician | electrician, lineman | Mage |
| 7 | Plumber | plumber, pipefitter | Tank |
| 8 | Mechanic | auto mechanic, technician | Support |
| 9 | Engineer | civil/mechanical engineer, architect | Mage |
| 10 | Courier | driver, trucker, delivery, postal worker | Assassin |
| 11 | Pilot | pilot, flight crew | Marksman |
| 12 | Merchant | shopkeeper, cashier, salesperson | Support |
| 13 | Chef | cook, baker | Fighter |
| 14 | Waiter | waiter, barista, bartender | Assassin |
| 15 | Cleaner | janitor, housekeeper | Support |
| 16 | Tailor | tailor, garment worker, seamstress | Assassin |
| 17 | Barber | barber, hairdresser, stylist | Assassin |
| 18 | Doctor | physician, surgeon, dentist | Support |
| 19 | Nurse | nurse, paramedic, caregiver | Support |
| 20 | Scientist | researcher, chemist, pharmacist | Mage |
| 21 | Teacher | teacher, professor, tutor | Controller |
| 22 | Programmer | software developer, IT | Mage |
| 23 | Accountant | accountant, banker, clerk | Marksman |
| 24 | Lawyer | lawyer, judge | Controller |
| 25 | Police | police officer, security guard | Tank |
| 26 | Soldier | soldier, marine | Fighter |
| 27 | Firefighter | firefighter, rescue worker | Tank |
| 28 | Artist | painter, illustrator, designer | Mage |
| 29 | Musician | musician, singer, performer | Support |
| 30 | Athlete | athlete, coach | Fighter |

All numbers below are **v0 starting values**. The balance runner (section 7.3) will tune them toward a 45–55% win rate for every matchup.

> **Built in M2 (first 6) and M4 (the other 24):** all 30 jobs are playable. For M4 the kits were adapted to the bouncing model (e.g. the Builder's walls are solid obstacles fighters bounce off, the Engineer's beam lands where the foe *was*, the Pilot's Airborne makes the next swing miss). Chef, Firefighter, Electrician, Nurse, Courier, Fisher. Their kits were adapted to the bouncing model and tuned; the **authoritative numbers and text are in `src/data/roster.ts`** (behaviour in `src/sim/kits.ts`), and they differ from the v0 drafts below in places (e.g. the Electrician's trap is dropped where it stands and triggered by bouncing into it, and Courier's Ram is the one skill that steers). Overall win rates after tuning: 45–56% for all six; individual matchups 27–73% (tighten to 40–60% in M4).

Format for each character:
**Quirk**, then each skill as **Simple** (one line a kid would understand) and **Detailed** (numbers and rules).

---

### 1. Farmer — Fighter · scythe & pitchfork
**Quirk:** turns the arena into a field. Crops grow during the fight.
- **Passive — Harvest Season**
  - *Simple:* Plants seeds while fighting. Walk over grown crops to heal.
  - *Detailed:* Every 8 s, plants a seed at their feet. It ripens after 6 s. Stepping on a ripe crop heals 6% max HP. Enemies trample (destroy) unripe seeds. Max 4 seeds.
- **Active — Scythe Sweep** (CD 9 s)
  - *Simple:* A wide swing that slows and harvests nearby crops.
  - *Detailed:* 180° arc, 140% ATK, Slow 30% for 2 s. Instantly harvests every ripe crop within 200 px (each heals 6%).
- **Special — Bountiful Harvest**
  - *Simple:* Giant pumpkins rain from the sky.
  - *Detailed:* All seeds ripen instantly. 6 pumpkins fall over the enemy area, each 80% ATK and Knock-up 0.4 s. Heals 15% max HP.

### 2. Fisher — Marksman · harpoon rod
**Quirk:** gets more dangerous the longer nobody bothers them.
- **Passive — Patient Angler**
  - *Simple:* Gets more critical hits while left alone.
  - *Detailed:* +4% crit chance per second without taking damage (max +40%). Resets when hit.
- **Active — Hook & Reel** (CD 10 s)
  - *Simple:* Hooks the enemy and reels them in.
  - *Detailed:* Line projectile, 350 px range. 120% ATK, pulls the target 250 px toward the Fisher, Stun 0.5 s.
- **Special — The Big One**
  - *Simple:* A giant fish leaps out of the ground and soaks the enemy.
  - *Detailed:* 400% ATK, Knock-up 1 s, applies Wet for 4 s.

### 3. Builder — Tank · sledgehammer & bricks
**Quirk:** builds walls on the battlefield.
- **Passive — Hard Hat**
  - *Simple:* Takes less damage from heavy hits and projectiles.
  - *Detailed:* −30% damage from charge attacks and projectiles.
- **Active — Brick Wall** (CD 12 s)
  - *Simple:* Builds a wall that blocks shots. Enemies who crash into it get dizzy.
  - *Detailed:* Wall between Builder and enemy for 5 s, with HP = 30% of Builder's max HP. Blocks projectiles and movement. Enemies dashed or knocked into it are Stunned 0.8 s.
- **Special — Demolition Day**
  - *Simple:* A wrecking ball smashes across the arena.
  - *Detailed:* Wrecking ball sweeps the arena: 350% ATK, Armor Break 40% for 5 s, destroys all walls, turrets and zones.

### 4. Miner — Fighter · pickaxe & headlamp
**Quirk:** burrows underground and finds gems.
- **Passive — Lucky Strike**
  - *Simple:* Hits sometimes dig up gems that make the Miner stronger.
  - *Detailed:* Basic attacks have a 20% chance to drop a gem. Picking it up gives +5% ATK for 15 s (max 5 stacks).
- **Active — Tunnel** (CD 11 s)
  - *Simple:* Digs underground and pops up under the enemy.
  - *Detailed:* Untargetable for 1.2 s while burrowing, then resurfaces under the enemy: 160% ATK, Knock-up 0.75 s.
- **Special — Cave-In**
  - *Simple:* The ceiling collapses on the enemy.
  - *Detailed:* 2 s of falling rocks in a 300 px circle: 6 × 70% ATK, then a final boulder Stuns 1.5 s. The Miner is immune to the rocks.

### 5. Welder — Fighter · torch & welding mask
**Quirk:** a heat gauge. Overheats into a burning frenzy, then has to cool down.
- **Passive — Heat Up**
  - *Simple:* Gets hotter with every hit. When maxed, every attack burns.
  - *Detailed:* +10 Heat per hit (max 100). At 100: Overheat for 4 s, where every attack applies Burn 3 s and gives +15% attack speed. Then −20% attack speed for 2 s while cooling down.
- **Active — Spark Shower** (CD 8 s)
  - *Simple:* A cone of hot sparks that burns.
  - *Detailed:* Cone, 3 ticks × 50% ATK, Burn 3 s, +30 Heat.
- **Special — Forge Weld**
  - *Simple:* Seals the enemy in hot metal, then uses the scraps as armor.
  - *Detailed:* Root 2 s and 300% ATK. Gains a Shield of 20% max HP for 6 s.

### 6. Electrician — Mage · live wires & voltage tester
**Quirk:** electricity chains, and it's devastating against Wet targets.
- **Passive — Live Wire**
  - *Simple:* Every 4th attack zaps harder.
  - *Detailed:* Every 4th basic attack deals +60% as Shock and micro-stuns 0.2 s. In Tag 2v2, it chains to a second enemy for 50%.
- **Active — Short Circuit** (CD 10 s)
  - *Simple:* Places a trap that shocks and stuns.
  - *Detailed:* Junction-box trap, lasts 6 s. Triggered: 150% ATK, Stun 1 s (2 s if the target is Wet).
- **Special — Blackout**
  - *Simple:* The lights go out and lightning strikes in the dark.
  - *Detailed:* Arena goes dark for 4 s. Enemy is Blinded, and 5 lightning bolts hit for 90% ATK each.

### 7. Plumber — Tank · giant wrench & plunger
**Quirk:** leaves pipes around the arena and travels through them.
- **Passive — Pipe Network**
  - *Simple:* Leaves pipes behind and can jump between them.
  - *Detailed:* Every 12 s, places a pipe (max 3). Entering a pipe teleports the Plumber to another one (1.5 s cooldown). The AI uses pipes to escape or flank.
- **Active — Plunger Yank** (CD 9 s)
  - *Simple:* Sticks a plunger on the enemy so they can't use skills.
  - *Detailed:* 100% ATK, Silence 1.5 s, pulls 100 px.
- **Special — Flood**
  - *Simple:* Pipes burst and a wave washes the enemy away.
  - *Detailed:* Wave across the arena: 250% ATK, knockback into the wall, Wet 5 s, dispels all enemy buffs.

### 8. Mechanic — Support · wrench & toolbox
**Quirk:** turns blocked hits into scrap and repairs with it.
- **Passive — Spare Parts**
  - *Simple:* Blocking collects scrap used for repairs.
  - *Detailed:* +1 Scrap per blocked hit. At 5 Scrap, repairs 6% max HP (in Tag: whichever teammate has lower HP).
- **Active — Deploy Turret** (CD 14 s)
  - *Simple:* Builds a small turret that shoots and slows.
  - *Detailed:* Turret with 300 HP for 8 s. Fires every 0.5 s for 40% ATK, each hit adds Slow 5% (max 30%).
- **Special — Mech Suit**
  - *Simple:* Hops into a giant robot suit.
  - *Detailed:* 6 s in the mech: +50% DEF, immune to crowd control, basic attacks become 200% ATK slams with a small area.

### 9. Engineer — Mage · blueprints & crane drone
**Quirk:** measures the enemy first, then hits with precision.
- **Passive — Measured Twice**
  - *Simple:* After a few hits, the enemy is marked and takes extra damage.
  - *Detailed:* Each hit adds 1 Measure. At 3 Measure the target is Marked for 4 s: Engineer's attacks deal +25% and can't miss.
- **Active — Load Test** (CD 11 s)
  - *Simple:* Drops a steel beam on the enemy.
  - *Detailed:* 0.8 s shadow telegraph, then 180% ATK and Stun 1 s. Auto-Marks the target.
- **Special — Grand Design**
  - *Simple:* Traps the enemy in a triangle that explodes.
  - *Detailed:* 3 pylons Root the enemy for 2 s, then explode for 350% ATK, ignoring 50% DEF.

### 10. Courier — Assassin · cargo scooter & parcels
**Quirk:** never stops moving. Speed turns into damage.
- **Passive — Express Delivery**
  - *Simple:* The more they move, the harder the next hit.
  - *Detailed:* Builds Momentum while moving (up to +40% move speed). The next hit spends it for up to +80% damage.
- **Active — Ram** (CD 9 s)
  - *Simple:* Rams the enemy with the scooter.
  - *Detailed:* 400 px dash, invulnerable during the dash, 150% ATK and knockback.
- **Special — Rush Hour**
  - *Simple:* A delivery truck runs the enemy over three times.
  - *Detailed:* 3 truck passes, 150% ATK each with knockback, then a package bomb: Stun 1 s.

### 11. Pilot — Marksman · flare pistol & aviator goggles
**Quirk:** takes off, and melee can't reach a flying Pilot.
- **Passive — Altitude**
  - *Simple:* If not hit for a while, flies up where melee can't reach.
  - *Detailed:* After 5 s without damage, becomes Airborne: immune to melee basic attacks. Lost when hit by a skill or projectile.
- **Active — Flare Barrage** (CD 10 s)
  - *Simple:* Shoots bright flares that blind.
  - *Detailed:* 3 flares × 80% ATK, Blind 2 s.
- **Special — Airstrike**
  - *Simple:* A jet flies over and bombs a line.
  - *Detailed:* Line bombardment: 5 × 100% ATK, Burn 3 s.

### 12. Merchant — Support · coin purse & abacus
**Quirk:** earns gold during the fight and shops automatically.
- **Passive — Profit Margin**
  - *Simple:* Earns coins and buys random items.
  - *Detailed:* +1 Gold per hit dealt or taken. At 10 Gold, buys a random item: Potion (heal 8%), Bomb (120% ATK), or Whetstone (+15% ATK for 6 s).
- **Active — Coin Toss** (CD 8 s)
  - *Simple:* Flips a coin. Heads is a big hit; tails steals a buff.
  - *Detailed:* Heads: 200% ATK. Tails: 100% ATK and steals one enemy buff.
- **Special — Clearance Sale**
  - *Simple:* Throws all the money at once.
  - *Detailed:* Coin shower: 20% ATK × Gold held (minimum 10 hits), then buys a heal for 20% max HP.

### 13. Chef — Fighter · cleaver & flaming wok
**Quirk:** collects ingredients and cooks dishes mid-fight.
- **Passive — Mise en Place**
  - *Simple:* Cooks a meal every few hits to heal and power up.
  - *Detailed:* Every 3rd hit gives 1 Ingredient. At 3 Ingredients, eats a dish: heal 10% and one random buff for 6 s (Spicy +20% ATK / Hearty +20% DEF / Light +20% speed).
- **Active — Flambé** (CD 9 s)
  - *Simple:* Tosses fire from the wok.
  - *Detailed:* Cone, 160% ATK, Burn 4 s.
- **Special — Chef's Special**
  - *Simple:* Serves a full-course meal that heals and gives every bonus.
  - *Detailed:* Heals 25%, cleanses all debuffs, gains Spicy + Hearty + Light for 8 s (partner too in Tag).

### 14. Waiter — Assassin · serving trays
**Quirk:** perfectly balanced. Dodges, then counters.
- **Passive — Service with a Smile**
  - *Simple:* Hard to hit. After dodging, the next hit is a critical hit.
  - *Detailed:* 15% chance to evade attacks. After an evade or parry, the next attack is a guaranteed crit.
- **Active — Tray Ricochet** (CD 8 s)
  - *Simple:* Throws a tray that bounces around.
  - *Detailed:* Bounces up to 3 times off walls or enemies, 90% ATK per hit, Slow 20% for 2 s.
- **Special — Order Up!**
  - *Simple:* Throws a whole tower of plates.
  - *Detailed:* Spiral of 10 plates × 50% ATK. The last one is hot coffee: Burn 4 s.

### 15. Cleaner — Support · mop & spray bottle
**Quirk:** removes bad effects and makes the floor slippery.
- **Passive — Spotless**
  - *Simple:* Regularly cleans off bad effects.
  - *Detailed:* Cleanses 1 debuff from self every 6 s (in Tag: from the ally with the most debuffs).
- **Active — Wet Floor** (CD 10 s)
  - *Simple:* Mops the floor so enemies slip.
  - *Detailed:* Zone for 5 s: Slow 30%, and changing direction has a 25% chance of a 0.5 s slip-Stun. Puts out a caution sign.
- **Special — Deep Clean**
  - *Simple:* Bleach spray that wipes the enemy's buffs and poisons them.
  - *Detailed:* Dispels all enemy buffs and shields, applies 5 Poison stacks for 6 s, cleanses self.

### 16. Tailor — Assassin · needles, thread, giant shears
**Quirk:** stitches the enemy in place.
- **Passive — Measure Up**
  - *Simple:* Hits wrap the enemy in thread until they're tied up.
  - *Detailed:* Each hit adds 1 Thread. At 5 Thread: Root 1 s and the stacks reset.
- **Active — Needle Volley** (CD 7 s)
  - *Simple:* Throws needles that make the enemy bleed.
  - *Detailed:* 5 needles × 40% ATK, Bleed 3 s, +1 Thread each.
- **Special — Sew Shut**
  - *Simple:* Stitches the enemy to the floor, then snip!
  - *Detailed:* Root 2.5 s and Silence 3 s, then the shears hit for 300% ATK.

### 17. Barber — Assassin · razor, scissors, hair dryer
**Quirk:** a combo artist. Quick snips stack up.
- **Passive — Fresh Cut**
  - *Simple:* Fast hits in a row become critical cuts that bleed.
  - *Detailed:* Each hit on the same target within 2 s gives +5% crit (max 6 stacks). Crits apply Bleed 3 s.
- **Active — Blow Dry** (CD 9 s)
  - *Simple:* Blasts the enemy back with a hair dryer and blows away shields.
  - *Detailed:* 100% ATK, knockback 200 px, removes shields.
- **Special — Signature Style**
  - *Simple:* Gives the enemy an embarrassing haircut.
  - *Detailed:* 8 snips × 50% ATK, then Embarrassed for 5 s: Weaken 30% and Silence 2 s.

### 18. Doctor — Support · scalpel & giant syringe
**Quirk:** diagnoses weak points.
- **Passive — Diagnosis**
  - *Simple:* Finds the enemy's weak spot and heals better.
  - *Detailed:* The first hit reveals a Weak Point: +15% damage to that enemy. The Doctor gets +20% healing received.
- **Active — Anesthesia** (CD 10 s)
  - *Simple:* An injection that puts the enemy to sleep.
  - *Detailed:* 80% ATK and Sleep 1.5 s. The waking hit deals +50%.
- **Special — Emergency Surgery**
  - *Simple:* Operates on themself (or their partner) and comes back strong.
  - *Detailed:* Invulnerable 1.5 s, heals 35% max HP, cleanses all debuffs. In Tag it targets the teammate with lower HP.

### 19. Nurse — Support · defibrillator & bandages
**Quirk:** keeps people alive, even a fallen partner.
- **Passive — Triage**
  - *Simple:* Slowly heals over time.
  - *Detailed:* Heals 3% max HP every 5 s. In Tag, heals the lower-HP ally instead, +50%.
- **Active — Clear!** (CD 12 s)
  - *Simple:* Shocks the enemy with paddles and gets a little health back.
  - *Detailed:* 140% ATK, Stun 0.8 s, heals self 8%.
- **Special — Code Blue**
  - *Simple:* Can't be knocked out for a few seconds, then heals big. In Tag it revives the partner.
  - *Detailed:* 1v1: Life Support for 5 s (can't drop below 1 HP), then heals 30%. Tag: revives a KO'd partner at 40% HP (if the partner is alive, it applies Life Support to both).

### 20. Scientist — Mage · beakers & lab coat
**Quirk:** random experiments. Repeated results get stronger.
- **Passive — Hypothesis**
  - *Simple:* Throws random potions. Getting the same result twice makes it last longer.
  - *Detailed:* Basic attacks are vials that randomly apply Poison, Slow 20% or Weaken 15% (3 s). The same effect twice in a row is "Confirmed": duration ×2.
- **Active — Volatile Mixture** (CD 10 s)
  - *Simple:* An acid puddle that poisons and weakens armor.
  - *Detailed:* Puddle for 4 s: +1 Poison stack per second, Armor Break 20%.
- **Special — Eureka!**
  - *Simple:* Drinks a weird serum and turns into a monster.
  - *Detailed:* Transforms for 7 s: +60% ATK, 30% lifesteal, attacks become melee.

### 21. Teacher — Controller · chalk, pointer, textbooks
**Quirk:** learns the enemy's moves during the fight.
- **Passive — Lesson Plan**
  - *Simple:* Gets used to the enemy's skill and takes less damage from it each time.
  - *Detailed:* Each time the enemy's active skill hits, it deals 10% less to the Teacher next time (max 30%).
- **Active — Pop Quiz** (CD 11 s)
  - *Simple:* Confuses the enemy with a surprise question.
  - *Detailed:* Chalk throw, 120% ATK, Confuse 2 s.
- **Special — Detention**
  - *Simple:* Traps the enemy and resets their skill.
  - *Detailed:* Chalkboard cage: Root and Silence 3 s. The enemy's active skill cooldown is reset to full.

### 22. Programmer — Mage · laptop & energy drink
**Quirk:** can undo damage.
- **Passive — Ctrl+Z**
  - *Simple:* Sometimes undoes a big hit.
  - *Detailed:* Once every 30 s, when a single hit deals more than 10% max HP, rewinds HP to what it was 2 s ago.
- **Active — Inject Bug** (CD 10 s)
  - *Simple:* Sends a bug that makes the enemy glitch.
  - *Detailed:* 100% ATK and Glitch for 3 s: enemy cooldowns +2 s, and the enemy freezes for 0.2 s every 0.8 s.
- **Special — Blue Screen**
  - *Simple:* Crashes the enemy, then gets a speed boost.
  - *Detailed:* Stun 2.5 s, dispels the enemy's buffs. The Programmer gains Haste (+30% attack and move speed) for 5 s.

### 23. Accountant — Marksman · calculator & ledger
**Quirk:** keeps a tally and makes the enemy pay it back with interest.
- **Passive — Compound Interest**
  - *Simple:* Pays back part of the damage taken, plus extra.
  - *Detailed:* 15% of damage taken is stored as Debt. Every 6 s, the Debt is dealt back to the enemy × 1.5.
- **Active — Audit** (CD 10 s)
  - *Simple:* Taxes the enemy's buffs, removing them and dealing damage.
  - *Detailed:* 100% ATK. Removes every enemy buff, and each one removed deals 60% ATK.
- **Special — Foreclosure**
  - *Simple:* Collects everything owed in one huge hit.
  - *Detailed:* Deals 25% of the enemy's missing HP plus all stored Debt × 2.

### 24. Lawyer — Controller · gavel & briefcase
**Quirk:** objects to the enemy's moves.
- **Passive — Objection!**
  - *Simple:* Sometimes cancels an enemy skill completely.
  - *Detailed:* Every 12 s, negates the next enemy skill hit and Silences the enemy 1 s.
- **Active — Cross-Examine** (CD 9 s)
  - *Simple:* Puts the enemy on trial. Using a skill soon after gets them punished.
  - *Detailed:* 130% ATK. If the enemy uses an active skill within 4 s: Contempt, 200% ATK.
- **Special — Verdict: Guilty**
  - *Simple:* A giant gavel. The more bad effects the enemy has, the harder it hits.
  - *Detailed:* 200% ATK + 50% ATK per debuff on the enemy, Stun 1.5 s.

### 25. Police — Tank · riot shield, baton, handcuffs
**Quirk:** the blocking specialist.
- **Passive — Riot Shield**
  - *Simple:* Much better at blocking and parrying.
  - *Detailed:* Blocking uses 30% less Guard. Perfect Block window is doubled (0.3 s).
- **Active — Handcuffs** (CD 12 s)
  - *Simple:* Cuffs the enemy so they can't move or attack.
  - *Detailed:* Root 1.5 s and Disarm 2 s.
- **Special — Backup Arrives**
  - *Simple:* Calls for backup. Two officers tackle the enemy.
  - *Detailed:* 2 officers rush in: 3 × 80% ATK and Stun 2 s. The Police gains a Shield of 20% max HP.

### 26. Soldier — Fighter · rifle, grenades, helmet
**Quirk:** has to reload, but gets tougher when hurt.
- **Passive — Battle Hardened**
  - *Simple:* Gets tougher when hurt, but has to stop and reload.
  - *Detailed:* Basic attacks are ranged (6-round magazine, 1.2 s reload). Below 50% HP: +20% DEF.
- **Active — Frag Grenade** (CD 10 s)
  - *Simple:* A grenade that knocks back and causes bleeding.
  - *Detailed:* 170% ATK in an area, knockback, Bleed 3 s.
- **Special — Last Stand**
  - *Simple:* Plants a flag and unloads.
  - *Detailed:* Reloads fully, then 12 × 45% ATK over 4 s with Super Armor (can't be knocked back).

### 27. Firefighter — Tank · axe & hose
**Quirk:** fireproof. Water pushes the enemy away.
- **Passive — Fireproof**
  - *Simple:* Fire can't hurt them.
  - *Detailed:* Immune to Burn. Walking through fire zones extinguishes them.
- **Active — High-Pressure Hose** (CD 10 s)
  - *Simple:* A water blast that pushes the enemy and soaks them.
  - *Detailed:* 1.5 s channel: 6 × 30% ATK, continuous push, Wet 4 s. Cleanses Burn from allies in the stream.
- **Special — Backdraft**
  - *Simple:* Smashes a door open and fire explodes out.
  - *Detailed:* 300% ATK explosion, Burn 4 s on the enemy. The Firefighter is unaffected.

### 28. Artist — Mage · giant brush & palette
**Quirk:** paints in three colors, and mixing them makes a masterpiece.
- **Passive — Palette**
  - *Simple:* Attacks cycle colors. Hitting with all three makes a big explosion.
  - *Detailed:* Attacks cycle Red (Burn 2 s) → Blue (Slow 20%) → Yellow (micro-stun 0.2 s). All three on one target within 5 s: Masterpiece, 150% ATK.
- **Active — Brushstroke** (CD 9 s)
  - *Simple:* Paints a stripe on the ground in the current color.
  - *Detailed:* Line zone for 4 s with the current color's effect every 0.5 s (30% ATK per tick).
- **Special — Living Canvas**
  - *Simple:* Paints a clone that copies every attack.
  - *Detailed:* Clone for 8 s that mirrors the Artist's attacks at 50% damage.

### 29. Musician — Support · electric guitar & mic
**Quirk:** fights to a beat. On-beat hits are stronger.
- **Passive — On Beat**
  - *Simple:* Hits on the beat do extra damage, and the chorus heals.
  - *Detailed:* The arena has a 120 BPM pulse (shown as a ring). On-beat attacks deal +30%. Every 8 beats, the Chorus heals 4% (partner too in Tag).
- **Active — Power Chord** (CD 9 s)
  - *Simple:* A sound wave that pushes away and silences.
  - *Detailed:* Ring shockwave, 150% ATK, knockback, Silence 1 s.
- **Special — Encore**
  - *Simple:* A concert! The enemy can't help but dance.
  - *Detailed:* Spotlight for 6 s: enemy Charmed for 2 s, then every beat deals 40% ATK.

### 30. Athlete — Fighter · ball & sneakers
**Quirk:** warms up. Gets faster the longer they keep hitting.
- **Passive — Warm Up**
  - *Simple:* Attacks get faster with each hit in a row.
  - *Detailed:* +5% attack speed per consecutive hit (max +30%). Resets after 3 s without hitting.
- **Active — Power Shot** (CD 8 s)
  - *Simple:* Kicks a ball that bounces around.
  - *Detailed:* Ball ricochets twice, 130% ATK per hit, knockback. A wall slam stuns 0.5 s.
- **Special — Hat Trick**
  - *Simple:* Three unstoppable shots in a row.
  - *Detailed:* 3 shots × 150% ATK with Knock-up. The third is a guaranteed crit.

---

## 5. Art direction (research from the reference shots)

What makes the reference look high quality, and what we take from it:

### 5.1 Characters (in battle)
* **Chibi proportions, about 2–2.5 heads tall:** big head, big expressive eyes, small body, **oversized weapons and tools**. The job has to read from the **silhouette alone** (chef hat, hard hat, firefighter helmet, mortarboard, goggles). This is the #1 readability rule.
* **Clean, dark, slightly warm outlines** (about 2–3 px at 1080p), thicker on the outer silhouette and thinner inside.
* **Cel shading with 2–3 tones plus a soft rim light** on the side away from the camera. Painted, not flat-vector.
* **Saturated, warm palettes.** Each character owns **1 dominant colour + 1 accent** so teams read instantly (Firefighter red/yellow, Nurse white/pink, Electrician navy/yellow).
* **Soft oval drop shadow** under every character to ground them.
* **3/4 top-down camera** (about 50°). Characters face left or right (flipped), which halves the art cost.

### 5.2 Cutscene portraits (special moves)
* The references switch to **taller, semi-realistic anime busts** (about 6–7 heads, detailed rendering) for dialogue. That contrast makes the moment feel big. We do the same: every character gets a **bust portrait** with two expressions (neutral and battle cry).
* Composition: portrait slides in from one side, overlapping a framed **name plate**, with the world dimmed behind.

### 5.3 Environments
* **Hand-painted tiles** with visible brush texture (cobblestone, grass, crystal caves) and **ambient colour grading** per arena (warm daylight town, cold blue cave).
* **Props break up the edges** (crystals, banners, crates), and the centre of the arena stays clean for readability.
* Planned arenas (one per "district"): Market Square, Harbor Docks, Construction Site, Hospital Rooftop, Factory Floor, Concert Stage. Each one is a single painted background plus a few prop layers for depth and parallax.

### 5.4 VFX
* **Additive glows with white-hot cores** and coloured halos (the reference's magic orb), sparkle particles, and big readable slash arcs.
* Colour language: fire orange, poison green, shock yellow-white, water cyan, heal soft green-gold, special = the character's signature colour.

### 5.5 UI
* **Decided: the "Workplace ID badge" UI style.** The reference uses ornate bronze and gold frames. We deliberately go our own way with a motif that matches the jobs concept and is clearly original.
* **Building blocks:**
  * **Character cards = staff ID badges:** a lanyard clip, a coloured header strip with the staff number and role, a photo window with the portrait, the job name, a department line ("Kitchen dept."), a rubber stamp ("Approved", "On duty", or "Fired!" on KO), and a barcode footer.
  * **Skills = tool tags:** dashed-outline rows like hang tags, each with the skill icon. The special-move tag is highlighted with a solid border in the character's colour.
  * **Panels = paper and clipboards:** sticky tape, paper clips, sticky notes, punched holes. The VS screen is two badges slapped onto a cork board.
  * **Role badges** as coloured lanyard straps (Tank = navy, Fighter = red, Assassin = black, Mage = purple, Marksman = green, Support = white, Controller = orange).
  * **Typography:** a chunky rounded sans for names and numbers, a typewriter-style font for small print and the Detailed skill text, and a hand-drawn marker font for stamps and sticky notes.
* **Avoiding a clash with the painted art:** the badge UI is not flat vector. Paper grain, slightly worn laminate edges, ink bleed on stamps and a little lamination glare give it the same hand-made feel as the painted characters and arenas.
* Battle HUD (spectator): two top banners (taped name tags in the badge style) with portrait, name, HP bar (with a delayed "ghost" damage chunk), Guard bar, status icons with timers, skill cooldown pips, and a **SPECIAL READY** glint at low HP. In Tag Team mode each side shows two stacked fighter banners, and the fighters on the field have small HP and Guard bars over their heads.

### 5.6 AI art pipeline
Per character we produce:
1. **Style bible** (once): palette rules, outline weight, shading rules, proportion sheet, and 3 "golden" reference characters. Every later generation is checked against it.
2. **Battle sprite as two pieces** (decided in M3): a `body` (the whole chibi minus its front arm) and a `weapon` piece (front arm + hand + tool, drawn vertical with the shoulder at the bottom). Both are made from one `master` image with ChatGPT's edit mode, so the character stays identical. Two pieces is all the animation needs (the body squashes and hops; the arm rotates around the shoulder) and avoids error-prone segmentation.
3. **Rigged in code** (cut-out puppet animation): idle bob, walk, attack, charge wind-up, block, hit, cast, special pose, KO. This gives smooth animation from one image set, consistent style, and squash-and-stretch for juice.
4. **Cutscene bust**, 1024×1536, two expressions.
5. **Skill icons**: 3 per character, 128 px, circular.
6. **Post-process script:** normalise outline colour and thickness, palette-clamp, and resize to atlas. This fixes the drift that AI generation causes.

Biggest risk: **consistency across 30 characters.** Mitigation: lock the style bible and the first 3 characters before mass-producing, and use the same reference-image workflow for all of them.

### 5.7 Tool: GPT-image (ChatGPT image generation)

**Decided.** How we work with its strengths and weaknesses:

| GPT-image is… | So we… |
|---|---|
| Good at following **reference images** | Always attach the style sheet and 1–2 approved "golden" characters to every prompt. Never generate from text alone. |
| Able to output **transparent backgrounds** | Request transparent PNGs for sprites, parts, busts and icons. No manual background removal. |
| **Not seed-controllable**, so it drifts | Use a fixed **prompt template** (below), generate 3–4 options, keep the best one, and run the post-process script to normalise outlines and palette. |
| Weak at keeping a character identical across many images | Generate each character's **battle sprite once**, as a single image, then split it into parts. Animation comes from the code rig, not from generating more frames. |
| Fixed output sizes (square, portrait, landscape) | Sprites: square, character centred, full body. Busts: portrait. Arenas: landscape, then painted extensions or tiling where needed. |

**Two ways to run it**
* **ChatGPT app (manual):** no setup, good for the style exploration in M3. You generate, I give you the prompts and process the files you drop into `art/raw/`.
* **OpenAI Images API (scripted):** `tools/art/generate.ts` runs the prompt template for every character with the reference images attached, and saves the results to `art/raw/<job>/`. Needs your OpenAI API key (kept in a local `.env`, never committed) and costs per image. Worth it for producing 30 characters × (sprite + 2 busts + 3 icons) ≈ 180 final images, several hundred with retries.

Recommendation: explore and lock the style manually in ChatGPT, then switch to the script for the full roster.

**Prompt template (battle sprite)**
```
[attach: style_sheet.png, golden_character_1.png, golden_character_2.png]
Same art style as the attached references: chibi fantasy RPG character, 2.5 heads tall,
hand-painted cel shading with 3 tones and soft rim light, dark warm outline,
saturated colours. Full body, 3/4 view facing right, neutral standing pose,
arms slightly away from the body, legs apart, weapon held away from the body
(so parts can be separated). Transparent background, no shadow, no text.
Character: {JOB} — {costume and tool description}. Main colour {C1}, accent {C2}.
Silhouette feature: {hat/helmet/tool}.
```
The "arms and weapon away from the body" pose is deliberate: it makes splitting the image into rig parts much easier.

**Pipeline (built in M3):** `art/raw/<id>/{master,body,weapon,bust,icon}.png` → `npm run art` (`tools/art/process.ts`: removes flat or fake-checkerboard backgrounds, trims, resizes, crops an icon from the bust if missing, writes `public/art/manifest.json`) → `/rig.html` (dev page: align the shoulder, arm length and arena floor; **Save** writes `art/rig.json` and patches the manifest) → the game uses the sprites where present and the code-drawn placeholders everywhere else. Style guide: `docs/ART_STYLE.md`; prompts: `art/PROMPTS.md`.

---

## 6. Game feel / juice spec

Every hit should be **seen, heard and felt**. The values below are starting points.

| Technique | Spec |
|---|---|
| **Hit-stop** (both fighters freeze) | light 50 ms · heavy/charge 90 ms · crit 110 ms · special 180 ms · parry 120 ms |
| **Screen shake** (trauma model) | trauma 0–1, offset = trauma² × 14 px + 1.5° rotation, Perlin noise, decay 1.5/s. Light hit +0.15, crit +0.35, special +0.6 |
| **Hit flash** | target tinted white 60 ms → red 80 ms |
| **Squash & stretch** | on impact scale (1.2, 0.85) and spring back in 120 ms; jump/knock-up stretches vertically |
| **Anticipation** | 80–150 ms wind-up on every attack; charge = pulsing glow plus rising pitch hum |
| **Knockback** | impulse plus friction; wall slam = extra shake, dust burst, +10% damage, stun 0.4 s |
| **Slash trails / smears** | additive arcs on weapon swings, coloured per character |
| **Impact particles** | sparks on metal, dust on blunt, droplets on water, coins on Merchant hits |
| **Damage numbers** | pop at 1.4× → 1× with an arc toss. White normal · yellow "!" crit · green heal · purple poison · orange burn · grey BLOCK · cyan PARRY! · red BREAK! |
| **HP bar** | instant drop plus a white ghost chunk that drains after 0.3 s; the bar shakes on big hits |
| **Status VFX** | persistent on the body (see the status table) so you never need to read icons |
| **Camera** | dynamic framing keeps both fighters on screen; 3% zoom-punch on crits; zoom-in during specials |
| **KO** | slow-motion 0.25× for 1 s, zoom on the loser, white flash, winner pose |
| **Low HP** | heartbeat SFX, red vignette pulse on that side's banner, sweat drop on the sprite |
| **Audio** | every hit = whoosh + impact + material layer; pitch randomised ±8%; consecutive hits rise in pitch; music ducks during cutscenes; each job has signature SFX (sizzle, cash register, siren, chalk squeak) |
| **Accessibility** | toggles for screen shake, flashes and cutscene length |

### 6.1 Special-move cutscene (about 2 s, time frozen)
1. 0.00 s: hit-stop, world desaturates and darkens to 40%, music ducks.
2. 0.10 s: diagonal speed-line panel sweeps in, in the character's colour.
3. 0.15 s: bust portrait slides in from the side (ease-out-back), battle-cry expression.
4. 0.40 s: skill name slams in with kinetic type and a short sting.
5. 1.40 s: white flash, everything snaps back, and the effect plays in-world with max juice.
"Short" mode keeps only steps 1, 4 and 5 (about 0.8 s).

---

## 7. Technical plan

### 7.1 Stack
* **TypeScript + Vite**
* **PixiJS v8** (WebGL renderer, filters for glow/shockwave/colour grading, particle containers)
* **GSAP** for UI, cutscene and puppet tweens
* **Howler.js** for audio (sprites, pitch, ducking)
* **Vitest** for simulation tests
* No backend for v1. Static hosting.

### 7.2 Architecture
```
src/
  sim/        pure deterministic combat: fixed 60 Hz, seeded RNG, no DOM
              → emits events (hit, crit, block, parry, status, special_cast, ko…)
  data/       characters (stats + skills as data), statuses, arenas
  ai/         utility AI + per-character personality weights
  render/     PixiJS scene, puppet rigs, VFX, camera, damage numbers
  juice/      hit-stop, shake, flash, slow-mo — all driven by sim events
  audio/      event → sound mapping
  cutscene/   special-move sequencer
  ui/         menus, character select, HUD, results
tools/
  balance.ts  headless runner: N matches per matchup → win-rate matrix
  art/        sprite post-process + atlas packing
```
* **Sim and render are separate.** The simulation never knows about graphics. Juice and audio react to events. This makes the game deterministic: same seed, same fight. That enables replays and the headless balancing.
* **Skills are built from shared building blocks** (damage, applyStatus, dash, projectile, zone, summon, displace, shield, heal, cleanse/dispel), plus small custom hooks for each quirk. New characters are mostly data.

### 7.3 Balancing
`npm run balance` simulates every pair 500× (435 pairs × 2 sides). It outputs a win-rate heatmap and flags any matchup outside 40–60% and any character outside 47–53% overall. It also reports average fight length (target 45–90 s) and how often specials decide the match.

---

## 8. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 ✓ | Skeleton | Vite + Pixi project; sim loop; 2 placeholder fighters fight with basic attacks |
| M1 ✓ | Core combat + juice | Triangle (attack / block / parry / charge / dash), statuses, hit-stop, shake, numbers, HP ghost. **Already feels good with circles.** |
| M2 ✓ | 6 characters + specials | 1 per role (no Controller yet); active/passive/special working; cutscene system with placeholder SVG busts; character select with Simple/Detailed; 1v1 mode end to end |
| M3 ◐ | Art pipeline proof | ✓ Pipeline, style guide, prompts, rig tuner. ✓ Chef, Firefighter, Fisher + market arena generated, processed, rigged and in game (painted floor shown with 3/4 foreshortening). ☐ **Style sign-off** before the remaining 24. |
| M4 ✓ | Full roster logic | All 30 jobs playable: kits in `src/sim/kits.ts` + `kits2.ts`, stats/text in `src/data/roster.ts` + `roster2.ts`. New mechanics: bleed, root, silence, disarm, weaken, armor break, sleep, confuse, charm, glitch, mark, shield, haste, empower, fortify, super armor, invulnerable, airborne; solid walls, burrowing, crops, pipes, turrets, zones, ricochet projectiles. Auto-balancer (`npm run tune`, multipliers in `src/data/balance.ts`): every job 42–56% overall, avg fight ~43 s. Individual matchups still vary more; tighten with longer tuning runs. |
| M5 ✓ | Tag Team + Tournament | ✓ Mode tabs, 4-slot Tag Team select, four HUD ID cards (both layouts), partner K.O. without ending the fight, 4-column match report. ✓ Tournament: pick entrants or random fill, 4/8/16 bracket (Tag Team up to 8 teams), every match seeded so Skip = Watch, skip match/round/all, champion card. ☐ VS intro screen. |
| M6 ◐ | Full art + audio + polish | ✓ All 30 sprites/busts/icons, painted arena, 30 painted props, WebP art (12 MB). ✓ Arms: sleeve-coloured shoulder cap sampled from the art, natural swing arc, arm behind the body on the wind-up. ✓ Cast indicators: nameplate over the caster, floor rune circle, telegraph line + lock-on reticle on the target, HUD chip pop. ✓ VS intro splash, KO replay (re-simulated from the seed, slow-mo, letterbox, skippable), Share link (opens straight into the same fight), First Blood, victory hop + confetti. ✓ Audio (procedural, src/audio): adaptive music (menu / fight / tense + jingles), a signature cast sound per job, UI clicks, countdown ticks. Voice lines: none for now (removed by decision). ☐ More arenas, accessibility options, clip export. |

---

## 9. Open questions

1. ~~**Tag Team:** tag-switch or 2v2 all on field?~~ **Decided: 2v2, all on the field at once** (section 3.2).
2. ~~**Picking:**~~ **Decided: the player picks both sides freely.** No prediction or betting element.
3. ~~**Progression:**~~ **Decided: pure sandbox.** All 30 characters are unlocked from the start, with no levels, currency or saves needed.
4. ~~**Image tool:**~~ **Decided: GPT-image / ChatGPT** (workflow in section 5.7). Still to decide: manual in ChatGPT only, or the API script for the full roster?
5. ~~**UI identity:**~~ **Decided: Workplace ID badge** (section 5.5).
6. ~~**Language:**~~ **Decided: English only for v1.** All UI and skill text still lives in one strings file (not hard-coded), so adding a language later is cheap.
7. ~~**Characters' look:**~~ **Decided: one fixed design per job.** No gender variants or skins, so each job is exactly one recognisable character.

Decided at M3: **manual in ChatGPT** for the pilots (Chef, Firefighter, Fisher). Revisit an API batch script for the remaining 24 after sign-off.

## Update: Gacha, rage, PvP and Story (M7)

- **Rage bar replaces the ≤30% HP special.** Rage fills from damage dealt (fraction of the target's max HP ×80),
  damage taken (fraction of own max HP ×92) and 1.8/s passive. Full = the special fires and the bar empties.
  First special ≈19 s into a duel, ≈1.6 specials per fighter. 1v1 and 2v2 were re-tuned around it
  (44–57% and 43–55% win rates).
- **Gacha**: 82 cards (45 general 15/15/15, 7 class, 30 job), a pick before the fight and every 15 s.
  Each round shares one rarity across teams and two rerolls per player, with better odds for rare and epic rounds
  later in the match. Combat drafts have a 12 s timer. Gacha uses ×4.5 HP, a 2:30 limit, and overtime from
  1:40 (+25% damage per 10 s, healing ×0.4). Average combat time is about two minutes. Gacha has its own
  job-balance layer.
- **PvP** over PeerJS (WebRTC); lockstep from seed + picks; engine-independent maths; result hash;
  Elo MMR (K 48 placement / 32 / 24 above 1500) with seven job-title ranks; quick match by rank tier.
- **Story**: six chapters × four levels, varied rules (classic, time attack, survive 1v2, bosses, power surge,
  sudden death, tag, finale), stars for HP left and par time, recruits unlock jobs for Story.
- Determinism: `src/sim/dmath.ts` replaces Math.sin/cos/atan2/exp/hypot in the sim.

