/**
 * Gacha cards: 45 general buffs (15 common, 15 rare, 15 epic) plus exclusives: one per class
 * (role) and one per job, offered only to a team that has that class or job. Modelled on Mobile
 * Legends' Chaos mode: pick 1 of 3 every 20 s, rarer cards turn up more as the match goes on.
 * A card is pure data: numbers merged into a fighter's augment profile (Aug below), which the sim
 * reads at its hook points. Cards apply to the whole team.
 */
import type { Role } from '../sim/types';

export type Rarity = 'common' | 'rare' | 'epic';

/** Everything a card can change. Fields ending in Mul multiply; everything else adds. */
export interface Aug {
  // stats (fractions: 0.15 = +15%)
  atk: number; def: number; defFlat: number; hpMul: number; atkSpeed: number; speed: number; range: number;
  acc: number; eva: number; block: number; crit: number; critDmg: number; weightMul: number; sizeMul: number;
  cdMul: number; skillDmg: number; guardRegenMul: number; ccMul: number; dotTakenMul: number;
  // sustain
  lifesteal: number; regen: number; startShield: number; healOnCast: number; healOnCrit: number;
  // conditional
  lowHpAtk: number; executioner: number; grudge: number; flow: number;
  comboEvery: number; poisonChance: number; burnOnCrit: number; counter: number; chain: number;
  thorns: number; reflectSkill: number; hasteOnBounce: number; hasteOnCast: number;
  // once-per-fight saves & timed procs
  secondWind: number; parachute: number; phoenix: number; encore: number; rageMul: number;
  lightningRod: number; aegis: number;
}

export const BASE_AUG: Aug = {
  atk: 0, def: 0, defFlat: 0, hpMul: 1, atkSpeed: 0, speed: 0, range: 0, acc: 0, eva: 0, block: 0, crit: 0, critDmg: 0,
  weightMul: 1, sizeMul: 1, cdMul: 1, skillDmg: 0, guardRegenMul: 1, ccMul: 1, dotTakenMul: 1,
  lifesteal: 0, regen: 0, startShield: 0, healOnCast: 0, healOnCrit: 0,
  lowHpAtk: 0, executioner: 0, grudge: 0, flow: 0, comboEvery: 0, poisonChance: 0, burnOnCrit: 0, counter: 0, chain: 0,
  thorns: 0, reflectSkill: 0, hasteOnBounce: 0, hasteOnCast: 0,
  secondWind: 0, parachute: 0, phoenix: 0, encore: 0, rageMul: 1, lightningRod: 0, aegis: 0,
};

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  /** placeholder glyph until the painted icon exists (art/PROMPTS_CARDS.md) */
  glyph: string;
  /** only offered to a team with this job / class */
  job?: string;
  role?: Role;
  simple: string;
  detailed: string;
  aug: Partial<Aug>;
}

const c = (rarity: Rarity) => (id: string, name: string, glyph: string, simple: string, detailed: string, aug: Partial<Aug>): Card =>
  ({ id, name, rarity, glyph, simple, detailed, aug });
const C = c('common'), R = c('rare'), E = c('epic');

export const CARDS: Card[] = [
  // ---------------- common: straightforward stat boosts ----------------
  C('overtime-pay', 'Overtime Pay', '💰', 'Hits harder.', '+15% ATK.', { atk: 0.15 }),
  C('hard-hat', 'Hard Hat', '⛑️', 'Takes less damage.', '+15% DEF and +6 flat DEF.', { def: 0.15, defFlat: 6 }),
  C('health-plan', 'Health Plan', '🩺', 'More health.', '+18% max HP.', { hpMul: 1.18 }),
  C('coffee-break', 'Coffee Break', '☕', 'Attacks faster.', '+12% attack speed.', { atkSpeed: 0.12 }),
  C('running-shoes', 'Running Shoes', '👟', 'Moves faster, dodges a little.', '+15% move speed, +2% evasion.', { speed: 0.15, eva: 0.02 }),
  C('long-reach', 'Extension Pole', '📏', 'Reaches further.', '+12% reach.', { range: 0.12 }),
  C('steady-hands', 'Steady Hands', '🎯', 'Misses less.', '+14% accuracy, +3% crit.', { acc: 0.14, crit: 0.03 }),
  C('light-feet', 'Light Feet', '🪶', 'Dodges more.', '+5% evasion.', { eva: 0.05 }),
  C('safety-gear', 'Safety Gear', '🛡️', 'Blocks more.', '+12% block chance.', { block: 0.12 }),
  C('sharp-eye', 'Sharp Eye', '👁️', 'More critical hits.', '+9% crit chance.', { crit: 0.09 }),
  C('heavy-lunch', 'Heavy Lunch', '🍱', 'Harder to knock around.', '+25% weight (less knockback), +6% max HP.', { weightMul: 1.25, hpMul: 1.06 }),
  C('fast-learner', 'Fast Learner', '📘', 'Uses its skill more often.', 'Active skill cooldown −15%.', { cdMul: 0.85 }),
  C('first-aid', 'First Aid Kit', '🩹', 'Slowly heals.', 'Regenerates 0.25% max HP per second.', { regen: 0.0025 }),
  C('thick-skin', 'Thick Skin', '🧥', 'Starts with a shield.', 'Starts the fight with a shield of 12% max HP.', { startShield: 0.12 }),
  C('pep-talk', 'Pep Talk', '📣', 'Guard recovers faster.', 'Guard regenerates 80% faster; +6% DEF.', { guardRegenMul: 1.8, def: 0.06 }),

  // ---------------- rare: new mechanics and conditions ----------------
  R('night-shift', 'Night Shift', '🦇', 'Heals from its hits.', 'Lifesteal: heals 13% of all damage dealt.', { lifesteal: 0.13 }),
  R('spiky-uniform', 'Spiky Uniform', '🌵', 'Hurts whoever hits it.', 'Reflects 15% of basic-attack damage taken back to the attacker.', { thorns: 0.15 }),
  R('overclock', 'Overclock', '⚡', 'Speeds up after using its skill.', 'Casting the active skill grants Haste for 5 s (+30% attack and move speed); cooldown −10%.', { hasteOnCast: 5, cdMul: 0.9 }),
  R('adrenaline', 'Adrenaline', '💉', 'Stronger when hurt.', '+25% ATK while below 50% HP.', { lowHpAtk: 0.25 }),
  R('hot-temper', 'Hot Temper', '🌋', 'Rage builds faster.', 'Rage bar fills 35% faster: more special moves.', { rageMul: 1.35 }),
  R('combo-breaker', 'Combo Breaker', '🥊', 'Every 4th hit is a big one.', 'Every 4th landed basic hit deals +60% damage and staggers.', { comboEvery: 4 }),
  R('poison-pen', 'Poison Pen', '🖋️', 'Hits can poison.', 'Basic hits have a 30% chance to add 1 Poison stack (4 s).', { poisonChance: 0.3 }),
  R('hot-coffee', 'Hot Coffee', '🔥', 'Critical hits burn.', 'Critical hits apply Burn for 2 s.', { burnOnCrit: 2 }),
  R('counter-clerk', 'Counter Clerk', '↩️', 'Hits back harder after blocking.', 'After a block or parry, the next basic hit deals +50% damage.', { counter: 0.5 }),
  R('second-wind', 'Second Wind', '🌬️', 'Heals once when nearly down.', 'Once per fight, dropping to 25% HP heals 20% max HP.', { secondWind: 0.2 }),
  R('hazard-pay', 'Hazard Pay', '☢️', 'Shrugs off poison, burn and bleed.', 'Damage over time (Poison, Burn, Bleed) taken −60%; +6% max HP.', { dotTakenMul: 0.4, hpMul: 1.06 }),
  R('momentum', 'Momentum', '🌀', 'Wall bounces give a speed burst.', 'Bouncing off a wall grants Haste for 1.2 s (+30% attack and move speed).', { hasteOnBounce: 1.2 }),
  R('executioner', 'Executioner', '🪓', 'Finishes off weak enemies.', '+30% damage to enemies below 30% HP.', { executioner: 0.3 }),
  R('iron-will', 'Iron Will', '🧱', 'Stuns and slows wear off faster.', 'Crowd control on it lasts 50% shorter; +6% max HP.', { ccMul: 0.5, hpMul: 1.06 }),
  R('bounty-hunter', 'Bounty Hunter', '🏹', 'Critical hits heal.', 'Each critical hit heals 3% max HP.', { healOnCrit: 0.03 }),

  // ---------------- epic: build-defining ----------------
  E('double-shift', 'Double Shift', '⏱️', 'Skill much more often and stronger.', 'Active cooldown −40%, skill damage +25%.', { cdMul: 0.6, skillDmg: 0.25 }),
  E('encore', 'Encore', '🎭', 'Specials come back fast.', 'After a special move the rage bar keeps 45% instead of emptying.', { encore: 0.45 }),
  E('golden-parachute', 'Golden Parachute', '🪂', 'Survives a knockout blow once.', 'Once per fight, a lethal hit leaves it at 1 HP and Invulnerable for 2 s.', { parachute: 1 }),
  E('chain-reaction', 'Chain Reaction', '⛓️', 'Hits can zap every enemy.', 'Basic hits have a 22% chance to zap every enemy for 45% ATK.', { chain: 0.22 }),
  E('giant-mode', 'Giant Mode', '🗿', 'Huge and tough, a bit slower.', '+28% max HP, +20% size and weight, −10% move speed.', { hpMul: 1.28, sizeMul: 1.2, weightMul: 1.2, speed: -0.1 }),
  E('berserker', 'Berserker', '😤', 'Fast, furious, less careful.', '+40% attack speed, +20% ATK, −20% DEF.', { atkSpeed: 0.4, atk: 0.2, def: -0.2 }),
  E('glass-cannon', 'Glass Cannon', '💥', 'Massive damage, fragile.', '+45% ATK, +10% crit chance, −25% max HP.', { atk: 0.45, crit: 0.1, hpMul: 0.75 }),
  E('aegis', 'Aegis Protocol', '🔰', 'Regular shields.', 'Every 18 s gains a shield of 14% max HP (8 s).', { aegis: 0.14 }),
  E('workaholic', 'Workaholic', '💼', 'Skills heal it.', 'Each active skill cast heals 4.5% max HP; cooldown −15%.', { healOnCast: 0.045, cdMul: 0.85 }),
  E('reflective-vest', 'Reflective Vest', '🪞', 'Bounces skills back.', 'Reflects 35% of skill damage taken back to the caster.', { reflectSkill: 0.35 }),
  E('critical-mass', 'Critical Mass', '☄️', 'Devastating critical hits.', '+8% crit chance, crit damage +100%.', { crit: 0.08, critDmg: 1 }),
  E('flow-state', 'Flow State', '🌊', 'Unstoppable while healthy.', 'Above 70% HP: +30% attack and move speed.', { flow: 0.3 }),
  E('grudge', 'Grudge', '😠', 'Gets angrier every hit it takes.', 'Each hit taken: +4% ATK, up to +40%.', { grudge: 0.04 }),
  E('lightning-rod', 'Lightning Rod', '🌩️', 'Lightning strikes its enemy.', 'Every 7 s, lightning strikes the nearest enemy for 100% ATK.', { lightningRod: 1.0 }),
  E('phoenix', 'Phoenix', '🐦‍🔥', 'Rises again once.', 'Once per fight, a lethal hit makes it burst into flame (80% ATK to nearby enemies), Invulnerable 1.5 s, then it revives at 35% HP.', { phoenix: 0.35 }),
];

/** Class cards: one per role, rare. */
const cls = (role: Role, id: string, name: string, glyph: string, simple: string, detailed: string, aug: Partial<Aug>): Card =>
  ({ id, name, rarity: 'rare', role, glyph, simple, detailed, aug });
export const CLASS_CARDS: Card[] = [
  cls('Tank', 'bulwark', 'Bulwark', '🏰', 'Tanks only: a wall of armour.', 'Tank class card. +20% DEF, +8% block, +5% max HP, guard regenerates 50% faster.', { def: 0.2, block: 0.08, hpMul: 1.05, guardRegenMul: 1.5 }),
  cls('Fighter', 'brawlers-blood', "Brawler's Blood", '🩸', 'Fighters only: hits harder and heals from it.', 'Fighter class card. +10% ATK, lifesteal 8%.', { atk: 0.1, lifesteal: 0.08 }),
  cls('Assassin', 'backstab', 'Backstab', '🗡️', 'Assassins only: finishes the job.', 'Assassin class card. +35% damage to enemies below 30% HP, +5% crit.', { executioner: 0.35, crit: 0.05 }),
  cls('Mage', 'mana-surge', 'Mana Surge', '🔮', 'Mages only: skills more often, harder.', 'Mage class card. Active cooldown −20%, skill damage +15%.', { cdMul: 0.8, skillDmg: 0.15 }),
  cls('Marksman', 'eagle-eye', 'Eagle Eye', '🦅', 'Marksmen only: longer, surer shots.', 'Marksman class card. +15% reach, +8% accuracy, +4% crit, +8% ATK.', { range: 0.15, acc: 0.08, crit: 0.04, atk: 0.08 }),
  cls('Support', 'field-medic', 'Field Medic', '⛑', 'Supports only: steady healing.', 'Support class card. Regenerates 0.4% max HP/s; skills heal 4% max HP.', { regen: 0.004, healOnCast: 0.04 }),
  cls('Controller', 'mind-games', 'Mind Games', '🧠', 'Controllers only: more specials, more skills.', 'Controller class card. Rage fills 35% faster, active cooldown −15%.', { rageMul: 1.35, cdMul: 0.85 }),
];

/** Job cards: one per job, epic, built around that job's style. */
const job = (j: string, id: string, name: string, glyph: string, simple: string, detailed: string, aug: Partial<Aug>): Card =>
  ({ id, name, rarity: 'epic', job: j, glyph, simple, detailed, aug });
export const JOB_CARDS: Card[] = [
  job('chef', 'secret-recipe', 'Secret Recipe', '📜', 'Chef only: skills hit harder and feed it.', 'Chef card. Skill damage +20%; each active skill heals 6% max HP.', { skillDmg: 0.2, healOnCast: 0.06 }),
  job('firefighter', 'fireproof-suit', 'Fireproof Suit', '🧯', 'Firefighter only: shrugs off everything.', 'Firefighter card. Damage over time taken −60%, +15% DEF, +8% max HP.', { dotTakenMul: 0.4, def: 0.15, hpMul: 1.08 }),
  job('electrician', 'high-voltage', 'High Voltage', '🔌', 'Electrician only: arcs to everyone.', 'Electrician card. Basic hits have a 15% chance to zap every enemy; skill damage +15%.', { chain: 0.15, skillDmg: 0.15 }),
  job('nurse', 'night-nurse', 'Night Nurse', '🌙', 'Nurse only: keeps itself going.', 'Nurse card. Regenerates 1% max HP/s; once, at 25% HP heals 20%.', { regen: 0.01, secondWind: 0.2 }),
  job('courier', 'express-lane', 'Express Lane', '📦', 'Courier only: never slows down.', 'Courier card. +20% move speed, +8% ATK, +8% max HP; wall bounces grant Haste for 1.5 s.', { speed: 0.2, atk: 0.08, hpMul: 1.08, hasteOnBounce: 1.5 }),
  job('fisher', 'big-catch', 'Big Catch', '🎣', 'Fisher only: reels in the kill.', 'Fisher card. +20% reach; +25% damage to enemies below 30% HP.', { range: 0.2, executioner: 0.25 }),
  job('farmer', 'harvest-moon', 'Harvest Moon', '🌕', 'Farmer only: grows sturdier.', 'Farmer card. +10% max HP, +15% weight.', { hpMul: 1.1, weightMul: 1.15 }),
  job('builder', 'reinforced-steel', 'Reinforced Steel', '🏗️', 'Builder only: hard as a girder.', 'Builder card. +25% DEF, +8 flat DEF; reflects 6% of basic-attack damage.', { def: 0.25, defFlat: 8, thorns: 0.06 }),
  job('miner', 'mother-lode', 'Mother Lode', '💎', 'Miner only: strikes gold.', 'Miner card. +10% crit chance; each crit heals 3% max HP.', { crit: 0.1, healOnCrit: 0.03 }),
  job('welder', 'hot-seam', 'Hot Seam', '🔥', 'Welder only: everything burns.', 'Welder card. +8% ATK; crits Burn for 3 s.', { atk: 0.08, burnOnCrit: 3 }),
  job('plumber', 'pressure-washer', 'Pressure Washer', '🚿', 'Plumber only: skills at full blast.', 'Plumber card. Skill damage +20%, active cooldown −15%.', { skillDmg: 0.2, cdMul: 0.85 }),
  job('mechanic', 'upgrade-kit', 'Upgrade Kit', '🔧', 'Mechanic only: self-repairing plating.', 'Mechanic card. Every 18 s a 15% max-HP shield; guard regenerates 40% faster.', { aegis: 0.15, guardRegenMul: 1.4 }),
  job('engineer', 'load-bearing', 'Load Bearing', '📐', 'Engineer only: built to take it.', 'Engineer card. +20% max HP; crowd control lasts 30% shorter.', { hpMul: 1.2, ccMul: 0.7 }),
  job('pilot', 'afterburner', 'Afterburner', '✈️', 'Pilot only: fast and slippery.', 'Pilot card. +15% attack speed, +12% move speed, +4% evasion.', { atkSpeed: 0.15, speed: 0.12, eva: 0.04 }),
  job('merchant', 'compound-interest', 'Compound Interest', '📈', 'Merchant only: every hit taken pays back.', 'Merchant card. Each hit taken +2.5% ATK (max +40%).', { grudge: 0.025 }),
  job('waiter', 'fine-service', 'Fine Service', '🛎️', 'Waiter only: serves it right back.', 'Waiter card. After a block or parry the next hit deals +60%; +8% block.', { counter: 0.6, block: 0.08 }),
  job('cleaner', 'sanitizer', 'Sanitizer', '🧴', 'Cleaner only: nothing sticks to it.', 'Cleaner card. Damage over time taken −50%, crowd control −20%, regenerates 0.4% max HP/s.', { dotTakenMul: 0.5, ccMul: 0.8, regen: 0.004 }),
  job('tailor', 'perfect-fit', 'Perfect Fit', '🧵', 'Tailor only: precise in every way.', 'Tailor card. +6% evasion, +6% accuracy, +5% crit.', { eva: 0.06, acc: 0.06, crit: 0.05 }),
  job('barber', 'fresh-fade', 'Fresh Fade', '💈', 'Barber only: razor-sharp crits.', 'Barber card. +8% crit chance, crit damage +50%.', { crit: 0.08, critDmg: 0.5 }),
  job('doctor', 'second-opinion', 'Second Opinion', '📋', 'Doctor only: walks away from a knockout once.', 'Doctor card. Once per fight a lethal hit leaves it at 1 HP and Invulnerable 2 s; +6% max HP.', { parachute: 1, hpMul: 1.06 }),
  job('scientist', 'unstable-formula', 'Unstable Formula', '⚗️', 'Scientist only: huge skills.', 'Scientist card. Skill damage +50%, +6% max HP.', { skillDmg: 0.5, hpMul: 1.06 }),
  job('teacher', 'extra-credit', 'Extra Credit', '⭐', 'Teacher only: more specials.', 'Teacher card. Rage fills 30% faster; skill damage +10%.', { rageMul: 1.3, skillDmg: 0.1 }),
  job('programmer', 'overclocked-cpu', 'Overclocked CPU', '💻', 'Programmer only: speeds up after every skill.', 'Programmer card. Active cooldown −20%; casting grants Haste for 4 s.', { cdMul: 0.8, hasteOnCast: 4 }),
  job('accountant', 'tax-return', 'Tax Return', '🧾', 'Accountant only: claws damage back.', 'Accountant card. Lifesteal 7%; crits heal 1.5% max HP.', { lifesteal: 0.07, healOnCrit: 0.015 }),
  job('lawyer', 'objection-sustained', 'Objection Sustained', '⚖️', 'Lawyer only: everything bounces back.', 'Lawyer card. Reflects 30% of skill damage and 10% of basic-attack damage taken.', { reflectSkill: 0.3, thorns: 0.1 }),
  job('police', 'riot-gear', 'Riot Gear', '🚔', 'Police only: holds the line.', 'Police card. +10% block, +15% DEF, crowd control −25%.', { block: 0.1, def: 0.15, ccMul: 0.75 }),
  job('soldier', 'battle-hardened', 'Battle Hardened', '🎖️', 'Soldier only: deadliest when cornered.', 'Soldier card. +20% ATK below 50% HP; once, at 25% HP heals 10%.', { lowHpAtk: 0.2, secondWind: 0.1 }),
  job('artist', 'masterpiece', 'Masterpiece', '🎨', 'Artist only: every 3rd stroke lands big.', 'Artist card. Every 3rd landed basic hit deals +60% and staggers; +4% crit.', { comboEvery: 3, crit: 0.04 }),
  job('musician', 'standing-ovation', 'Standing Ovation', '🎸', 'Musician only: the crowd wants more.', 'Musician card. Rage fills 40% faster; +15% attack speed, +12% ATK, +10% max HP.', { rageMul: 1.4, atkSpeed: 0.15, atk: 0.12, hpMul: 1.1 }),
  job('athlete', 'second-half', 'Second Half', '🏅', 'Athlete only: dominant while fresh.', 'Athlete card. Above 70% HP +20% attack and move speed; +10% move speed, +6% max HP.', { flow: 0.2, speed: 0.1, hpMul: 1.06 }),
];

export const ALL_CARDS: Card[] = [...CARDS, ...CLASS_CARDS, ...JOB_CARDS];
export const CARD_BY_ID = new Map(ALL_CARDS.map((x) => [x.id, x]));
export const RARITY_COLOR: Record<Rarity, string> = { common: '#8fbf7a', rare: '#4c8dff', epic: '#a35cff' };

/** Merge cards into one augment profile (Mul fields multiply, the rest add). */
export function augOf(cardIds: readonly string[]): Aug {
  const a: Aug = { ...BASE_AUG };
  for (const id of cardIds) {
    const card = CARD_BY_ID.get(id);
    if (!card) continue;
    for (const [k, v] of Object.entries(card.aug) as [keyof Aug, number][]) {
      if (k.endsWith('Mul')) a[k] *= v;
      else if (k === 'comboEvery') a[k] = a[k] ? Math.min(a[k], v) : v; // the more frequent combo wins
      else a[k] += v;
    }
  }
  a.encore = Math.min(0.7, a.encore); // a special must always cost something
  a.eva = Math.min(0.2, a.eva);
  a.cdMul = Math.max(0.4, a.cdMul);
  return a;
}

// ---------------- the draft ----------------

/** Rarity odds for each pick of the match (Chaos-style: rarer cards as the match goes on). */
export const PICK_ODDS: [common: number, rare: number, epic: number][] = [
  [0.7, 0.25, 0.05], // the pre-fight pick
  [0.55, 0.35, 0.1],
  [0.4, 0.42, 0.18],
  [0.3, 0.45, 0.25],
  [0.2, 0.45, 0.35],
  [0.1, 0.45, 0.45], // 6th pick onward
];
export const oddsFor = (pick: number) => PICK_ODDS[Math.min(pick, PICK_ODDS.length - 1)];

/**
 * Gacha match settings: a pick before the fight, then the fight pauses for a pick every 20 s.
 * HP is raised so a match lasts about 2–3 minutes (6–9 picks a side).
 */
export const GACHA = { hpMul: 4.2, timeLimit: 180, surgeEvery: 20, overtimeAt: 100, rerolls: 2, offers: 3, exclusiveWeight: 3 };
