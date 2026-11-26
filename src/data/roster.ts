import type { FighterDef } from '../sim/types';
import { ROSTER2 } from './roster2';
import { BALANCE } from './balance';
import { RATINGS, statsFromRatings } from './attributes';

/**
 * M2 roster: 6 jobs, one per role (Controller comes with the full 30 in M4).
 * Stats + player-facing skill text. Behaviour lives in src/sim/kits.ts; keep the
 * numbers in `detailed` in sync with it.
 */

const CHEF: FighterDef = {
  id: 'chef',
  displayName: 'Luca',
  name: 'Chef',
  title: 'Kitchen dept.',
  role: 'Fighter',
  mergedFrom: 'cook, baker',
  quirk: 'Collects ingredients from every hit and cooks mid-fight.',
  color: 0xf4f1ea,
  accent: 0xd9452b,
  skin: 0xf3c9a0,
  hp: 1450, atk: 110, def: 22, speed: 350, range: 148, radius: 32,
  windup: 0.24, recover: 0.26, attackCooldown: 0.42,
  accuracy: 0.86, evasion: 0.08, blockChance: 0.22, parryShare: 0.25, critChance: 0.1,
  chargeChance: 0.14, chargeTime: 0.75, chargeMult: 2.3, weight: 1.05,
  passive: {
    name: 'Mise en Place',
    simple: 'Every few hits, cooks a snack that heals and powers up.',
    detailed: 'Each swing that connects (hit or block) adds 1 ingredient. At 4, eats a dish: heals 6% max HP and gains one random buff for 6 s: Spicy (+20% ATK), Hearty (+20% DEF) or Light (+20% speed and swing speed).',
  },
  active: {
    name: 'Flambé',
    cooldown: 9,
    simple: 'Tosses fire from the wok and sets the enemy on fire.',
    detailed: 'Used when the foe is within 125% of reach. 140% ATK and Burn 3 s (2% max HP/s, healing −30%). Can be dodged.',
  },
  special: {
    name: "Chef's Special",
    quote: 'Order up!',
    simple: 'Serves a full-course meal: big heal, clears bad effects, all three buffs.',
    detailed: 'Heals 20% max HP, cleanses all debuffs, and gains Spicy + Hearty + Light for 8 s.',
  },
};

const FIREFIGHTER: FighterDef = {
  id: 'firefighter',
  displayName: 'Rafa',
  name: 'Firefighter',
  title: 'Station 9',
  role: 'Tank',
  mergedFrom: 'firefighter, rescue worker',
  quirk: 'Fireproof, and water is a weapon.',
  color: 0xd63b2a,
  accent: 0xf2c230,
  skin: 0xe8b48a,
  hp: 1850, atk: 120, def: 32, speed: 300, range: 145, radius: 36,
  windup: 0.3, recover: 0.3, attackCooldown: 0.5,
  accuracy: 0.82, evasion: 0.04, blockChance: 0.32, parryShare: 0.15, critChance: 0.07,
  chargeChance: 0.15, chargeTime: 0.85, chargeMult: 2.4, weight: 1.35,
  passive: {
    name: 'Fireproof',
    simple: "Fire can't hurt them, and getting wet doesn't slow them.",
    detailed: 'Immune to Burn from any source (100%). Can still get Wet, but ignores its 15% Slow.',
  },
  active: {
    name: 'High-Pressure Hose',
    cooldown: 10,
    simple: 'A water blast that pushes the enemy back and soaks them.',
    detailed: 'Used when the foe is within 330 px. 1.5 s spray: 6 × 30% ATK, each pushing the foe back and applying Wet 4 s (Slow 15%, puts out Burn, makes Shock stun longer). Can’t be dodged.',
  },
  special: {
    name: 'Backdraft',
    quote: 'Stand back!',
    simple: 'Smashes a door open and a fireball blasts the enemy.',
    detailed: 'Boils off Wet, then 300% ATK with huge knockback (wall slams likely) and Burn 4 s. Can’t be dodged.',
  },
};

const ELECTRICIAN: FighterDef = {
  id: 'electrician',
  displayName: 'Jiro',
  name: 'Electrician',
  title: 'Grid maintenance',
  role: 'Mage',
  mergedFrom: 'electrician, lineman',
  quirk: 'Every 4th connection shocks. Deadly against wet targets.',
  color: 0x2a4a86,
  accent: 0xf5c518,
  skin: 0xd9a377,
  hp: 1350, atk: 126, def: 18, speed: 360, range: 150, radius: 30,
  windup: 0.22, recover: 0.24, attackCooldown: 0.4,
  accuracy: 0.88, evasion: 0.1, blockChance: 0.18, parryShare: 0.3, critChance: 0.1,
  chargeChance: 0.1, chargeTime: 0.7, chargeMult: 2.2, weight: 0.95,
  passive: {
    name: 'Live Wire',
    simple: 'Every 4th hit zaps harder. Wet enemies get stunned.',
    detailed: 'Every 4th swing that connects deals +60% and shocks: a 0.25 s stagger, or Stun 1 s if the target is Wet.',
  },
  active: {
    name: 'Short Circuit',
    cooldown: 9,
    simple: 'Drops a shock trap right where they are.',
    detailed: 'Places a trap at its own position (max 2, lasts 8 s, arms after 0.6 s). An enemy bouncing into it takes 170% ATK and Stun 1 s (2 s if Wet).',
  },
  special: {
    name: 'Blackout',
    quote: 'Lights out.',
    simple: 'The lights go out and lightning strikes the enemy five times.',
    detailed: 'Blinds the foe for 4 s (accuracy halved), then 5 lightning bolts, 90% ATK each, 0.6 s apart. Each bolt staggers, or Stuns 0.6 s if the foe is Wet. Can’t be dodged.',
  },
};

const NURSE: FighterDef = {
  id: 'nurse',
  displayName: 'Mina',
  name: 'Nurse',
  title: 'Ward 3, night shift',
  role: 'Support',
  mergedFrom: 'nurse, paramedic, caregiver',
  quirk: 'Never stops patching people up.',
  color: 0x7fcfc4,
  accent: 0xec6f95,
  skin: 0xf6d3b3,
  hp: 1500, atk: 96, def: 24, speed: 340, range: 145, radius: 31,
  windup: 0.24, recover: 0.24, attackCooldown: 0.42,
  accuracy: 0.88, evasion: 0.1, blockChance: 0.25, parryShare: 0.3, critChance: 0.08,
  chargeChance: 0.1, chargeTime: 0.75, chargeMult: 2.2, weight: 1,
  passive: {
    name: 'Triage',
    simple: 'Slowly heals over time.',
    detailed: 'Heals 2% max HP every 6 s. In Tag Team, heals the lower-HP ally instead, for 3%.',
  },
  active: {
    name: 'Clear!',
    cooldown: 11,
    simple: 'Shocks the enemy with paddles and gets a little health back.',
    detailed: 'Used when the foe is within 110% of reach. 140% ATK and Stun 0.8 s; heals self for 5% max HP. Can be dodged.',
  },
  special: {
    name: 'Code Blue',
    quote: 'Not on my watch.',
    simple: "Can't be knocked out for 5 seconds, then heals big.",
    detailed: 'Life Support for 5 s: HP can’t drop below 1. When it ends, heals 20% max HP.',
  },
};

const COURIER: FighterDef = {
  id: 'courier',
  displayName: 'Kai',
  name: 'Courier',
  title: 'Same-day delivery',
  role: 'Assassin',
  mergedFrom: 'driver, trucker, delivery, postal worker',
  quirk: 'The longer it rides, the harder it hits.',
  color: 0xf08a24,
  accent: 0x4a3426,
  skin: 0xc98f62,
  hp: 1300, atk: 114, def: 14, speed: 400, range: 140, radius: 29,
  windup: 0.18, recover: 0.2, attackCooldown: 0.32,
  accuracy: 0.9, evasion: 0.16, blockChance: 0.14, parryShare: 0.4, critChance: 0.15,
  chargeChance: 0.08, chargeTime: 0.6, chargeMult: 2.1, weight: 0.85,
  passive: {
    name: 'Express Delivery',
    simple: 'Turns speed into power: the next hit lands harder.',
    detailed: '+1 Momentum every 0.5 s while moving at full speed (max 8). The next swing that connects deals +10% per Momentum and spends it all.',
  },
  active: {
    name: 'Ram',
    cooldown: 7,
    simple: 'Steers the scooter straight into the enemy.',
    detailed: 'Used when the foe is within 430 px. Launches at the foe at 950 px/s; on contact deals 150% ATK (plus the Momentum bonus) with big knockback. Can be dodged.',
  },
  special: {
    name: 'Rush Hour',
    quote: 'Sign here!',
    simple: 'A delivery truck runs the enemy over three times, then a parcel explodes.',
    detailed: '3 truck passes 0.55 s apart, 150% ATK each with sideways knockback, then a parcel bomb: 60% ATK and Stun 1 s. Can’t be dodged.',
  },
};

const FISHER: FighterDef = {
  id: 'fisher',
  displayName: 'Finn',
  name: 'Fisher',
  title: 'Harbor, pier 4',
  role: 'Marksman',
  mergedFrom: 'fisherman, sailor',
  quirk: 'Longest reach. Patience turns into crits.',
  color: 0x3f7d5a,
  accent: 0xe9c46a,
  skin: 0xe2b48c,
  hp: 1400, atk: 120, def: 16, speed: 330, range: 178, radius: 30,
  windup: 0.26, recover: 0.24, attackCooldown: 0.45,
  accuracy: 0.93, evasion: 0.1, blockChance: 0.16, parryShare: 0.3, critChance: 0.08,
  chargeChance: 0.1, chargeTime: 0.7, chargeMult: 2.2, weight: 0.95,
  passive: {
    name: 'Patient Angler',
    simple: 'Gets more critical hits the longer nobody hits them.',
    detailed: '+4% crit chance per full second without taking damage (max +40%). Resets when damaged.',
  },
  active: {
    name: 'Hook & Reel',
    cooldown: 10,
    simple: 'Hooks a far-away enemy and reels them in.',
    detailed: 'Used when the foe is 170–470 px away. Casts a hook at 1000 px/s; on hit 140% ATK, yanks the foe toward the Fisher and Stuns 0.5 s. Can be dodged.',
  },
  special: {
    name: 'The Big One',
    quote: "It's a monster!",
    simple: 'A giant fish leaps out under the enemy and soaks them.',
    detailed: '0.6 s shadow warning, then 340% ATK, Stun 1 s and Wet 4 s. Can’t be dodged.',
  },
};

const ROLE_REACH: Record<FighterDef['role'], number> = {
  Assassin: 141,
  Tank: 139,
  Fighter: 156,
  Controller: 158,
  Mage: 185,
  Support: 178,
  Marksman: 201,
};

const ROLE_ATTACK: Partial<Record<FighterDef['role'], { center: number; spread: number }>> = {
  Fighter: { center: 126, spread: 0.6 },
  Controller: { center: 125, spread: 0.6 },
  Mage: { center: 104, spread: 0.25 },
  Support: { center: 103, spread: 0.25 },
  Marksman: { center: 108, spread: 0.25 },
};

/** Calibrate swing damage by role while keeping the tuned strength of each kit. */
export const applyJobBalance = (d: FighterDef, b = BALANCE[d.id] ?? { atk: 1, hp: 1 }): FighterDef => {
  const attack = d.atk * b.atk;
  const role = ROLE_ATTACK[d.role];
  const atk = role ? role.center + (attack - 120) * role.spread : attack;
  return {
    ...d,
    atk: Math.round(atk),
    skillAtk: role ? Math.round(attack) : undefined,
    hp: Math.round((d.hp * b.hp) / 10) * 10,
  };
};

/** Keep the individual ratings within the reach and movement profile for the job's role. */
const profiled = (d: FighterDef): FighterDef => {
  const p = { ...d, ...statsFromRatings(RATINGS[d.id]) };
  p.range = Math.round(ROLE_REACH[p.role] + (p.range - 154) * 0.38);
  if (p.role === 'Assassin') {
    p.speed += 45;
    p.windup *= 0.86;
    p.recover *= 0.86;
    p.attackCooldown *= 0.86;
  }
  if (p.role === 'Tank') p.def += 4;
  return p;
};

export const DESIGNED: FighterDef[] = [CHEF, FIREFIGHTER, ELECTRICIAN, NURSE, COURIER, FISHER, ...ROSTER2].map(profiled);
export const ROSTER: FighterDef[] = DESIGNED.map((d) => applyJobBalance(d));

export const byId = (id: string) => ROSTER.find((d) => d.id === id);
