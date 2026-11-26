import type { FighterDef, Role, SkillText } from '../sim/types';

/**
 * M4 roster: the 24 jobs after the first six. Stats start from a per-role template and are
 * tuned with `npm run simstats`. Behaviour: src/sim/kits2.ts (keep the numbers in sync).
 */

type Base = Omit<FighterDef, 'id' | 'displayName' | 'name' | 'title' | 'role' | 'mergedFrom' | 'quirk' | 'color' | 'accent' | 'skin' | 'passive' | 'active' | 'special'>;

const ROLE: Record<Role, Base> = {
  Tank: { hp: 1850, atk: 116, def: 32, speed: 300, range: 145, radius: 35, windup: 0.3, recover: 0.3, attackCooldown: 0.5, accuracy: 0.82, evasion: 0.05, blockChance: 0.3, parryShare: 0.15, critChance: 0.07, chargeChance: 0.15, chargeTime: 0.85, chargeMult: 2.4, weight: 1.3 },
  Fighter: { hp: 1500, atk: 120, def: 24, speed: 340, range: 148, radius: 32, windup: 0.25, recover: 0.26, attackCooldown: 0.42, accuracy: 0.86, evasion: 0.08, blockChance: 0.22, parryShare: 0.25, critChance: 0.1, chargeChance: 0.14, chargeTime: 0.75, chargeMult: 2.3, weight: 1.05 },
  Assassin: { hp: 1280, atk: 114, def: 14, speed: 390, range: 140, radius: 29, windup: 0.18, recover: 0.2, attackCooldown: 0.32, accuracy: 0.9, evasion: 0.15, blockChance: 0.14, parryShare: 0.4, critChance: 0.15, chargeChance: 0.08, chargeTime: 0.6, chargeMult: 2.1, weight: 0.85 },
  Mage: { hp: 1350, atk: 122, def: 18, speed: 355, range: 150, radius: 30, windup: 0.22, recover: 0.24, attackCooldown: 0.4, accuracy: 0.88, evasion: 0.1, blockChance: 0.18, parryShare: 0.3, critChance: 0.1, chargeChance: 0.1, chargeTime: 0.7, chargeMult: 2.2, weight: 0.95 },
  Marksman: { hp: 1350, atk: 116, def: 16, speed: 330, range: 180, radius: 30, windup: 0.26, recover: 0.24, attackCooldown: 0.45, accuracy: 0.92, evasion: 0.1, blockChance: 0.16, parryShare: 0.3, critChance: 0.1, chargeChance: 0.1, chargeTime: 0.7, chargeMult: 2.2, weight: 0.95 },
  Support: { hp: 1500, atk: 100, def: 24, speed: 340, range: 145, radius: 31, windup: 0.24, recover: 0.24, attackCooldown: 0.42, accuracy: 0.88, evasion: 0.1, blockChance: 0.25, parryShare: 0.3, critChance: 0.08, chargeChance: 0.1, chargeTime: 0.75, chargeMult: 2.2, weight: 1 },
  Controller: { hp: 1400, atk: 108, def: 20, speed: 345, range: 150, radius: 30, windup: 0.24, recover: 0.24, attackCooldown: 0.42, accuracy: 0.88, evasion: 0.1, blockChance: 0.2, parryShare: 0.3, critChance: 0.08, chargeChance: 0.1, chargeTime: 0.7, chargeMult: 2.2, weight: 0.95 },
};

interface Spec {
  id: string; displayName: string; name: string; title: string; role: Role; mergedFrom: string; quirk: string;
  color: number; accent: number; skin: number;
  stats?: Partial<Base>;
  passive: SkillText; active: SkillText & { cooldown: number }; special: SkillText & { quote: string };
}

const make = ({ stats, ...s }: Spec): FighterDef => ({ ...ROLE[s.role], ...(stats ?? {}), ...s });

export const ROSTER2: FighterDef[] = [
  make({
    id: 'farmer', displayName: 'Rosa', name: 'Farmer', title: 'Sunny Acres', role: 'Fighter', mergedFrom: 'farmer, gardener, rancher',
    quirk: 'Plants crops in the arena and snacks on the harvest.', color: 0x3d6fa5, accent: 0xe3c16f, skin: 0xe9b98c,
    passive: { name: 'Harvest Season', simple: 'Plants seeds while fighting. Rolling over grown crops heals.', detailed: 'Every 8 s plants a seed where it stands (max 4). Seeds ripen after 6 s; touching a ripe crop heals 6% max HP. Enemies trample unripe seeds.' },
    active: { name: 'Scythe Sweep', cooldown: 9, simple: 'A wide swing that slows the enemy and harvests nearby crops.', detailed: 'Used when the foe is within 120% of reach. 140% ATK and Slow 30% for 2 s; harvests every ripe crop within 220 px (6% heal each). Can be dodged.' },
    special: { name: 'Bountiful Harvest', quote: 'Harvest time!', simple: 'Giant pumpkins rain down on the enemy.', detailed: 'All seeds ripen instantly and heals 15% max HP. Then 6 pumpkins drop on the foe, 0.25 s apart: 80% ATK each and a short stagger. Can’t be dodged.' },
  }),
  make({
    id: 'builder', displayName: 'Mack', name: 'Builder', title: 'Site 12, crew lead', role: 'Tank', mergedFrom: 'construction worker, mason, carpenter',
    quirk: 'Builds walls in the arena: enemies who crash into them see stars.', color: 0xff7a1a, accent: 0xf5f5f0, skin: 0xd9a377, stats: { hp: 1900 },
    passive: { name: 'Hard Hat', simple: 'Takes less damage from skills.', detailed: 'Takes 25% less damage from all skills and specials.' },
    active: { name: 'Brick Wall', cooldown: 12, simple: 'Builds a wall. Enemies bouncing into it hard get stunned.', detailed: 'Used when the foe is within 360 px. Builds a wall half-way between them for 5 s (max 2). Fighters bounce off it; an enemy hitting it faster than 300 px/s is Stunned 0.8 s.' },
    special: { name: 'Demolition Day', quote: 'Demolition day!', simple: 'A wrecking ball smashes the enemy and clears the arena.', detailed: 'Destroys every wall, trap and zone in the arena, then 350% ATK with huge knockback and Armor Break 40% for 5 s. Can’t be dodged.' },
  }),
  make({
    id: 'miner', displayName: 'Bram', name: 'Miner', title: 'Deep shaft 3', role: 'Fighter', mergedFrom: 'miner, quarry worker',
    quirk: 'Digs underground and pops up right under the enemy.', color: 0x7a5a3a, accent: 0xffd23f, skin: 0xc98f62, stats: { hp: 1550, def: 26 },
    passive: { name: 'Lucky Strike', simple: 'Hits sometimes dig up gems that make the Miner stronger.', detailed: 'Each connecting swing has a 20% chance to drop a gem nearby. Rolling over it: +5% ATK for 15 s, stacking up to 5.' },
    active: { name: 'Tunnel', cooldown: 11, simple: 'Burrows underground and bursts out under the enemy.', detailed: 'Used when the foe is within 520 px. Untargetable underground for 1 s, then pops up under the foe: 160% ATK, Stun 0.75 s. Can be dodged.' },
    special: { name: 'Cave-In', quote: 'Cave-in!', simple: 'The ceiling collapses on the enemy.', detailed: '6 falling rocks over 2 s, 70% ATK each, then a boulder: 60% ATK and Stun 1.5 s. Can’t be dodged.' },
  }),
  make({
    id: 'welder', displayName: 'Inez', name: 'Welder', title: 'Foundry floor', role: 'Fighter', mergedFrom: 'welder, factory worker, blacksmith',
    quirk: 'Heats up with every hit until everything it touches burns.', color: 0x2c3e5a, accent: 0xff9a3c, skin: 0xf0c4a0,
    passive: { name: 'Heat Up', simple: 'Gets hotter with every hit. When maxed, every hit burns.', detailed: '+10 Heat per connecting swing (max 100). At 100: Overheat for 4 s, where every hit applies Burn 3 s and swings are 15% faster; then 20% slower for 2 s while cooling.' },
    active: { name: 'Spark Shower', cooldown: 8, simple: 'A cone of hot sparks that burns.', detailed: 'Used when the foe is within 120% of reach. 3 bursts × 50% ATK, each applying Burn 3 s; +30 Heat. Can be dodged.' },
    special: { name: 'Forge Weld', quote: 'Hot work!', simple: 'Welds the enemy in place, then wears the scraps as armour.', detailed: 'Root 2 s, then 300% ATK. Gains a Shield worth 20% max HP for 6 s. Can’t be dodged.' },
  }),
  make({
    id: 'plumber', displayName: 'Nico', name: 'Plumber', title: 'Emergency call-outs', role: 'Tank', mergedFrom: 'plumber, pipefitter',
    quirk: 'Leaves pipes around the arena and warps between them.', color: 0x2a9d8f, accent: 0x264653, skin: 0xe2b48c,
    passive: { name: 'Pipe Network', simple: 'Leaves pipes behind and pops out of another one.', detailed: 'Every 12 s places a pipe (max 3). Rolling into a pipe warps the Plumber to another one (1.5 s cooldown).' },
    active: { name: 'Plunger Yank', cooldown: 9, simple: 'Sticks a plunger on the enemy so it can’t use skills, and pulls it in.', detailed: 'Used when the foe is within 300 px. 100% ATK, Silence 1.5 s, and yanks the foe toward the Plumber. Can be dodged.' },
    special: { name: 'Flood', quote: 'Pipes burst!', simple: 'The pipes burst and a wave washes the enemy away.', detailed: 'Removes all the foe’s buffs, then 250% ATK with huge knockback (wall slams likely) and Wet 5 s. Can’t be dodged.' },
  }),
  make({
    id: 'mechanic', displayName: 'Joe', name: 'Mechanic', title: 'Bay 2, Joe’s Garage', role: 'Support', mergedFrom: 'auto mechanic, technician',
    quirk: 'Builds a turret, and patches itself up with scrap.', color: 0x5b7083, accent: 0xd62828, skin: 0xd9a377,
    passive: { name: 'Spare Parts', simple: 'Blocks, dodges and hits taken leave scrap for repairs.', detailed: '+1 Scrap per block, parry or dodge, and a 25% chance per hit taken. At 4 Scrap repairs 6% max HP (the lower-HP ally in Tag Team).' },
    active: { name: 'Deploy Turret', cooldown: 14, simple: 'Builds a small turret that shoots and slows.', detailed: 'Places a turret for 8 s (one at a time). Every 0.5 s it shoots a foe within 380 px for 40% ATK, adding Slow 5% each time (max 30%).' },
    special: { name: 'Mech Suit', quote: 'Fixed it!', simple: 'Hops into a robot suit: tough, unstoppable, hits twice as hard.', detailed: '6 s: DEF ×1.5 +15, immune to stuns and other crowd control, and ATK doubled.' },
  }),
  make({
    id: 'engineer', displayName: 'Priya', name: 'Engineer', title: 'Structural, level 4', role: 'Mage', mergedFrom: 'civil/mechanical engineer, architect',
    quirk: 'Measures the enemy first, then hits it where it hurts.', color: 0x3a86ff, accent: 0xc9a66b, skin: 0xf3c9a0,
    passive: { name: 'Measured Twice', simple: 'After a few hits the enemy is marked and takes extra damage.', detailed: 'Every 3rd connecting swing Marks the foe for 4 s: the Engineer deals 25% more damage to a Marked foe.' },
    active: { name: 'Load Test', cooldown: 11, simple: 'Drops a steel beam where the enemy is standing. Will it still be there?', detailed: 'Used when the foe is within 420 px. Marks the floor where the foe is; 0.8 s later a beam lands there: 180% ATK, Stun 1 s and Mark 4 s if the foe hasn’t bounced away.' },
    special: { name: 'Grand Design', quote: 'By the numbers.', simple: 'Traps the enemy, then everything explodes.', detailed: 'Root 2 s, then 350% ATK ignoring 50% of the foe’s DEF. Can’t be dodged.' },
  }),
  make({
    id: 'pilot', displayName: 'Skye', name: 'Pilot', title: 'Flight 7, captain', role: 'Marksman', mergedFrom: 'pilot, flight crew',
    quirk: 'Left alone, it takes off where swings can’t reach.', color: 0x7b4a2a, accent: 0xf2f2f2, skin: 0xe8b48a,
    passive: { name: 'Altitude', simple: 'If nobody hits it for a while, it flies out of reach of the next swing.', detailed: 'After 7 s without taking damage becomes Airborne: the next swing aimed at it misses automatically, which brings it back down.' },
    active: { name: 'Flare Barrage', cooldown: 10, simple: 'Shoots bright flares that blind the enemy.', detailed: 'Used when the foe is within 460 px. 3 flares × 80% ATK, each applying Blind 2 s (accuracy halved). Each can be dodged.' },
    special: { name: 'Airstrike', quote: 'Bombs away!', simple: 'A plane flies over and bombs the enemy.', detailed: '5 bombs 0.22 s apart, 100% ATK each with Burn 3 s. Can’t be dodged.' },
  }),
  make({
    id: 'merchant', displayName: 'Omar', name: 'Merchant', title: 'Market stall 14', role: 'Support', mergedFrom: 'shopkeeper, cashier, salesperson',
    quirk: 'Earns gold all fight long and shops automatically.', color: 0x2d6a4f, accent: 0xf4d35e, skin: 0xf0c4a0,
    passive: { name: 'Profit Margin', simple: 'Earns coins from every hit and buys random items.', detailed: '+1 Gold per hit dealt or taken. Every 10 Gold buys a random item: Potion (heal 8%), Bomb (120% ATK) or Whetstone (+15% ATK for 6 s).' },
    active: { name: 'Coin Toss', cooldown: 8, simple: 'Flips a coin: heads is a big hit, tails steals a buff.', detailed: 'Used when the foe is within 150% of reach. Heads: 200% ATK. Tails: 100% ATK and steals one buff. Can be dodged.' },
    special: { name: 'Clearance Sale', quote: 'Everything must go!', simple: 'Throws all its money at once, then buys a big heal.', detailed: 'Spends all Gold: 20% ATK per Gold (at least 10 Gold’s worth), then heals 20% max HP. Can’t be dodged.' },
  }),
  make({
    id: 'waiter', displayName: 'Mateo', name: 'Waiter', title: 'Table service', role: 'Assassin', mergedFrom: 'waiter, barista, bartender',
    quirk: 'Perfectly balanced: dodges, then strikes back with a crit.', color: 0x222831, accent: 0xc1121f, skin: 0xf6d3b3,
    passive: { name: 'Service with a Smile', simple: 'Hard to hit. After dodging or parrying, the next hit is a critical hit.', detailed: '+10% evasion. After a dodge or parry the next connecting swing is a guaranteed crit.' },
    active: { name: 'Tray Ricochet', cooldown: 8, simple: 'Throws a tray that bounces around the arena.', detailed: 'Used when the foe is within 480 px. The tray bounces off walls up to 3 times and can hit up to 3 times: 90% ATK and Slow 20% for 2 s per hit. Can be dodged.' },
    special: { name: 'Order Up!', quote: 'Order up, table two!', simple: 'Throws a whole tower of plates.', detailed: '10 plates 0.14 s apart, 50% ATK each; the last one is hot coffee: Burn 4 s. Can’t be dodged.' },
  }),
  make({
    id: 'cleaner', displayName: 'Tess', name: 'Cleaner', title: 'Facilities, night crew', role: 'Support', mergedFrom: 'janitor, housekeeper',
    quirk: 'Wipes off bad effects and makes the floor slippery.', color: 0x4361ee, accent: 0xffd60a, skin: 0xc98f62,
    passive: { name: 'Spotless', simple: 'Regularly cleans off a bad effect.', detailed: 'Every 6 s removes one debuff from itself.' },
    active: { name: 'Wet Floor', cooldown: 10, simple: 'Mops the floor so enemies slip and slide.', detailed: 'Used when the foe is within 300 px. A 110 px wet zone for 5 s: enemies inside are Slowed 30%, with a 25% chance every 0.5 s to slip (Stun 0.5 s).' },
    special: { name: 'Deep Clean', quote: 'Spotless!', simple: 'A blast of bleach wipes the enemy’s buffs and poisons it.', detailed: 'Cleanses itself, removes all the foe’s buffs and shields, then 60% ATK and 5 Poison stacks for 6 s. Can’t be dodged.' },
  }),
  make({
    id: 'tailor', displayName: 'Mei', name: 'Tailor', title: 'Bespoke & alterations', role: 'Assassin', mergedFrom: 'tailor, garment worker, seamstress',
    quirk: 'Stitches the enemy to the floor.', color: 0x6a4c93, accent: 0xffca3a, skin: 0xf3c9a0,
    passive: { name: 'Measure Up', simple: 'Hits wrap the enemy in thread until it’s tied up.', detailed: 'Each connecting swing or needle adds 1 Thread to the foe. At 5 Thread: Root 1 s.' },
    active: { name: 'Needle Volley', cooldown: 7, simple: 'Throws needles that make the enemy bleed.', detailed: 'Used when the foe is within 420 px. 5 needles × 40% ATK, each applying Bleed 3 s (1.2% max HP/s per stack, max 3) and 1 Thread. Each can be dodged.' },
    special: { name: 'Sew Shut', quote: 'Sewn shut!', simple: 'Stitches the enemy to the floor, then: snip!', detailed: 'Root 2.5 s and Silence 3 s, then giant shears: 300% ATK. Can’t be dodged.' },
  }),
  make({
    id: 'barber', displayName: 'Dax', name: 'Barber', title: 'Fresh Cuts, chair 1', role: 'Assassin', mergedFrom: 'barber, hairdresser, stylist',
    quirk: 'A combo artist: quick snips stack into critical cuts.', color: 0xe63946, accent: 0xf1faee, skin: 0xe2b48c,
    passive: { name: 'Fresh Cut', simple: 'Fast hits in a row turn into critical cuts that bleed.', detailed: 'Each connecting swing within 2 s of the last adds +5% crit (max +30%). Critical swings apply Bleed 3 s.' },
    active: { name: 'Blow Dry', cooldown: 9, simple: 'Blasts the enemy back and blows away its shield.', detailed: 'Used when the foe is within 130% of reach. Removes the foe’s Shield, then 100% ATK with big knockback. Can be dodged.' },
    special: { name: 'Signature Style', quote: 'Fresh cut!', simple: 'Gives the enemy an embarrassing haircut.', detailed: '8 snips × 50% ATK, then Weaken 30% for 5 s and Silence 2 s. Can’t be dodged.' },
  }),
  make({
    id: 'doctor', displayName: 'Ken', name: 'Doctor', title: 'Emergency dept.', role: 'Support', mergedFrom: 'physician, surgeon, dentist',
    quirk: 'Diagnoses the weak spot, and heals better than anyone.', color: 0x4ea8de, accent: 0xf8f9fa, skin: 0xf6d3b3,
    passive: { name: 'Diagnosis', simple: 'Finds the enemy’s weak spot and gets more from healing.', detailed: 'After its first connecting swing on a foe, deals 15% more swing damage to it. Receives 20% more healing.' },
    active: { name: 'Anesthesia', cooldown: 10, simple: 'An injection that puts the enemy to sleep.', detailed: 'Used when the foe is within 120% of reach. 80% ATK and Sleep 1.5 s; the hit that wakes it deals 50% extra. Can be dodged.' },
    special: { name: 'Emergency Surgery', quote: 'Emergency surgery!', simple: 'A quick operation: can’t be hurt for a moment, heals big, clears bad effects.', detailed: 'Invulnerable 1.5 s, heals 35% max HP and cleanses all debuffs (on the lower-HP ally in Tag Team).' },
  }),
  make({
    id: 'scientist', displayName: 'Rhea', name: 'Scientist', title: 'Lab B, do not enter', role: 'Mage', mergedFrom: 'researcher, chemist, pharmacist',
    quirk: 'Random experiments, and repeated results get stronger.', color: 0x7209b7, accent: 0x80ffdb, skin: 0xf0c4a0,
    passive: { name: 'Hypothesis', simple: 'Hits apply a random potion effect. The same result twice lasts longer.', detailed: 'Each connecting swing applies Poison, Slow 20% or Weaken 15% at random for 3 s. The same effect twice in a row is Confirmed: 6 s.' },
    active: { name: 'Volatile Mixture', cooldown: 10, simple: 'Throws an acid puddle that poisons and melts armour.', detailed: 'Used when the foe is within 420 px. A 90 px puddle at the foe for 4 s: enemies inside get Armor Break 20% and a Poison stack every second.' },
    special: { name: 'Eureka!', quote: 'Eureka!', simple: 'Drinks a strange serum and turns into a monster.', detailed: 'For 7 s: ATK +60% and 30% of all damage dealt heals the Scientist.' },
  }),
  make({
    id: 'teacher', displayName: 'Alma', name: 'Teacher', title: 'Room 204', role: 'Controller', mergedFrom: 'teacher, professor, tutor',
    quirk: 'Learns the enemy’s moves while being hit by them.', color: 0x8d6e63, accent: 0x2a9d8f, skin: 0xf3c9a0,
    passive: { name: 'Lesson Plan', simple: 'Gets used to the enemy’s skills and takes less damage from them.', detailed: 'Each skill hit from an opponent teaches the Teacher: that opponent’s skills deal 10% less per lesson (max 30%).' },
    active: { name: 'Pop Quiz', cooldown: 11, simple: 'A surprise question that confuses the enemy.', detailed: 'Used when the foe is within 420 px. 120% ATK and Confuse 2 s (accuracy ×0.7, bounces off in random directions). Can be dodged.' },
    special: { name: 'Detention', quote: 'Detention!', simple: 'Locks the enemy in place and resets its skill.', detailed: 'Root and Silence 3 s, and the foe’s active skill cooldown resets to full.' },
  }),
  make({
    id: 'programmer', displayName: 'Ada', name: 'Programmer', title: 'Backend, on call', role: 'Mage', mergedFrom: 'software developer, IT',
    quirk: 'Can undo a big hit.', color: 0x3a0ca3, accent: 0x4cc9f0, skin: 0xe8b48a,
    passive: { name: 'Ctrl+Z', simple: 'Sometimes undoes a big hit.', detailed: 'Once every 30 s, a single hit bigger than 10% max HP rewinds HP to what it was 2 s ago.' },
    active: { name: 'Inject Bug', cooldown: 10, simple: 'Sends a bug that makes the enemy glitch.', detailed: 'Used when the foe is within 420 px. 100% ATK; the foe’s skill cooldown gets +2 s and it Glitches for 3 s (swings 30% slower). Can be dodged.' },
    special: { name: 'Blue Screen', quote: 'Blue screen!', simple: 'Crashes the enemy, then gets a speed boost.', detailed: 'Removes the foe’s buffs and Stuns it 2.5 s. The Programmer gains Haste (+30% speed and swing speed) for 5 s.' },
  }),
  make({
    id: 'accountant', displayName: 'Eliot', name: 'Accountant', title: 'Audit & tax', role: 'Marksman', mergedFrom: 'accountant, banker, clerk',
    quirk: 'Keeps a tally and makes the enemy pay it back with interest.', color: 0x6c757d, accent: 0x43aa8b, skin: 0xf6d3b3,
    passive: { name: 'Compound Interest', simple: 'Pays back part of the damage it takes, with interest.', detailed: '15% of damage taken is stored as Debt. Every 6 s the Debt is paid out to the foe ×1.5, ignoring DEF.' },
    active: { name: 'Audit', cooldown: 10, simple: 'Taxes away the enemy’s buffs, and each one hurts.', detailed: 'Used when the foe is within 420 px. Removes every buff from the foe: 100% ATK + 60% ATK per buff removed. Can be dodged.' },
    special: { name: 'Foreclosure', quote: 'Pay up!', simple: 'Collects everything owed in one huge hit.', detailed: 'Deals 25% of the foe’s missing HP plus all stored Debt ×2, ignoring DEF. Can’t be dodged.' },
  }),
  make({
    id: 'lawyer', displayName: 'Vera', name: 'Lawyer', title: 'Partner, 30th floor', role: 'Controller', mergedFrom: 'lawyer, judge',
    quirk: 'Objects to the enemy’s skills.', color: 0x1d3557, accent: 0xe9c46a, skin: 0xd9a377,
    passive: { name: 'Objection!', simple: 'Every so often, cancels an enemy skill completely.', detailed: 'Every 12 s, the next enemy skill hit is cancelled and that enemy is Silenced 1 s.' },
    active: { name: 'Cross-Examine', cooldown: 9, simple: 'Puts the enemy on trial: using a skill soon after gets it punished.', detailed: 'Used when the foe is within 130% of reach. 130% ATK. If the foe uses its active skill within 4 s: Contempt, 200% ATK. Can be dodged.' },
    special: { name: 'Verdict: Guilty', quote: 'Guilty!', simple: 'A giant gavel: the more bad effects the enemy has, the harder it hits.', detailed: '200% ATK + 50% ATK per debuff on the foe, and Stun 1.5 s. Can’t be dodged.' },
  }),
  make({
    id: 'police', displayName: 'Leon', name: 'Police', title: 'Precinct 5', role: 'Tank', mergedFrom: 'police officer, security guard',
    quirk: 'The blocking specialist.', color: 0x14213d, accent: 0xfca311, skin: 0xc98f62,
    passive: { name: 'Riot Shield', simple: 'Much better at blocking and parrying.', detailed: '+10% block chance, and twice as many of its blocks are parries.' },
    active: { name: 'Handcuffs', cooldown: 12, simple: 'Cuffs the enemy so it can’t move or attack.', detailed: 'Used when the foe is within 320 px. 60% ATK, Root 1.5 s and Disarm 2 s (no swings). Can be dodged.' },
    special: { name: 'Backup Arrives', quote: 'Backup’s here!', simple: 'Calls backup: officers tackle the enemy.', detailed: 'Gains a Shield worth 20% max HP for 6 s, then 3 tackles × 80% ATK; the last Stuns 2 s. Can’t be dodged.' },
  }),
  make({
    id: 'soldier', displayName: 'Soren', name: 'Soldier', title: 'Unit 3, squad B', role: 'Fighter', mergedFrom: 'soldier, marine',
    quirk: 'Has to reload, but gets tougher when hurt.', color: 0x606c38, accent: 0x283618, skin: 0xd9a377, stats: { range: 185, accuracy: 0.9 },
    passive: { name: 'Battle Hardened', simple: 'Shoots from range but must reload. Gets tougher when hurt.', detailed: 'Long reach. After every 6 connecting shots, reloads for 1.2 s (no swings). Below 50% HP: DEF +20%.' },
    active: { name: 'Frag Grenade', cooldown: 10, simple: 'A grenade that blasts the enemy back and makes it bleed.', detailed: 'Used when the foe is within 420 px. Thrown at the foe, explodes after 0.6 s in a 90 px radius: 170% ATK, big knockback, Bleed 3 s.' },
    special: { name: 'Last Stand', quote: 'Hold the line!', simple: 'Plants its feet and unloads.', detailed: 'Reloads, gains Super Armor (no stuns or knockback) for 4 s and fires 12 shots × 45% ATK. Can’t be dodged.' },
  }),
  make({
    id: 'artist', displayName: 'Yara', name: 'Artist', title: 'Studio loft', role: 'Mage', mergedFrom: 'painter, illustrator, designer',
    quirk: 'Paints in three colours, and mixing them makes a masterpiece.', color: 0xffe8a3, accent: 0xe63946, skin: 0xf3c9a0,
    passive: { name: 'Palette', simple: 'Hits cycle through colours. All three on the enemy makes a big splash.', detailed: 'Connecting swings cycle Red (Burn 2 s) → Blue (Slow 20%) → Yellow (stagger 0.2 s). All three on the foe within 5 s: Masterpiece, 150% ATK.' },
    active: { name: 'Brushstroke', cooldown: 9, simple: 'Paints a pool of the current colour on the floor.', detailed: 'Used when the foe is within 300 px. A 100 px paint zone for 4 s: every 0.5 s, enemies inside take 30% ATK and the colour’s effect.' },
    special: { name: 'Living Canvas', quote: 'Masterpiece!', simple: 'Paints a copy of itself that repeats every hit.', detailed: 'For 8 s, every connecting swing is repeated 0.2 s later by the painted clone for 50% ATK.' },
  }),
  make({
    id: 'musician', displayName: 'Zuri', name: 'Musician', title: 'Tonight: sold out', role: 'Support', mergedFrom: 'musician, singer, performer',
    quirk: 'Fights to a beat: on-beat hits hit harder.', color: 0x2b2d42, accent: 0xef233c, skin: 0xe2b48c,
    passive: { name: 'On Beat', simple: 'Hits on the beat do extra damage, and the chorus heals.', detailed: 'The arena pulses at 120 BPM. Swings that land within 0.12 s of a beat deal +30%. Every 8 beats the Chorus heals 4% max HP (allies too).' },
    active: { name: 'Power Chord', cooldown: 9, simple: 'A sound wave that pushes the enemy away and silences it.', detailed: 'Used when the foe is within 260 px. Shockwave: 150% ATK, big knockback, Silence 1 s. Can be dodged.' },
    special: { name: 'Encore', quote: 'Encore!', simple: 'A concert! The enemy can’t help but dance closer.', detailed: 'Charms the foe for 2 s (it’s pulled toward the Musician and can’t swing), and for 6 s every beat deals 40% ATK.' },
  }),
  make({
    id: 'athlete', displayName: 'Jett', name: 'Athlete', title: 'Varsity, #7', role: 'Fighter', mergedFrom: 'athlete, coach',
    quirk: 'Warms up: gets faster the longer it keeps hitting.', color: 0xffb703, accent: 0x219ebc, skin: 0xc98f62, stats: { speed: 360 },
    passive: { name: 'Warm Up', simple: 'Swings faster with every hit in a row.', detailed: '+5% swing speed per connecting swing (max +30%). Resets after 3 s without connecting.' },
    active: { name: 'Power Shot', cooldown: 8, simple: 'Smacks a ball that ricochets around the arena.', detailed: 'Used when the foe is within 480 px. The ball bounces off walls twice and can hit twice: 130% ATK with big knockback each. Can be dodged.' },
    special: { name: 'Hat Trick', quote: 'Hat trick!', simple: 'Three unstoppable shots in a row.', detailed: '3 shots 0.45 s apart: 150% ATK each with a stagger; the third deals 225%. Can’t be dodged.' },
  }),
];
