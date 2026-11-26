import type { SimOpts } from '../sim/sim';
import type { Sim } from '../sim/sim';

/**
 * Story Mode: "Career Mode at the Metro City Job Fair". You start as a new hire with three jobs
 * and work your way through six districts. Beating a rival recruits them (unlocks the job for
 * Story). Every level uses the Gacha rules (a card every 20 s) unless it says otherwise, and each
 * has a twist so no two play the same: time attacks, survival, bosses, power surges, sudden death,
 * handicaps, tag teams and a finale. Progress is saved in this browser.
 */
export const STARTERS = ['chef', 'firefighter', 'nurse'];

export type Rule =
  /** knock the other side out (or lead on HP at the bell) */
  | 'ko'
  /** still standing when the clock runs out */
  | 'survive'
  /** must win by K.O. before the clock runs out */
  | 'timeAttack';

export interface Line { who: string; text: string }

export interface Level {
  id: string;
  chapter: number;
  title: string;
  /** what's different about this level, shown on its card */
  twist: string;
  rule: Rule;
  /** you field one job, or two (tag); `partner` gives you a fixed ally instead of a second pick */
  yours: 1 | 2;
  partner?: string;
  enemies: string[];
  /** classic rules: no cards at all */
  classic?: boolean;
  opts?: Partial<SimOpts> & { enemyCards?: string[]; myCards?: string[] };
  /** ★★★ for winning in under this many seconds (★★ = finish with ≥ 40% HP) */
  par: number;
  intro: Line[];
  win: Line[];
  unlocks: string[];
}

export interface Chapter { n: number; name: string; place: string; blurb: string; color: string }

export const CHAPTERS: Chapter[] = [
  { n: 1, name: 'First Shift', place: 'Downtown', blurb: 'Your first day at the Job Fair. Downtown never sleeps, and neither do its workers.', color: '#d9452b' },
  { n: 2, name: 'Hard Hats Required', place: 'Construction Site', blurb: 'The skyline is half-built and everyone is behind schedule.', color: '#e8892a' },
  { n: 3, name: 'Code Blue', place: 'Hospital Hill', blurb: 'Doctors, labs and the people who keep the lights on.', color: '#4c8dff' },
  { n: 4, name: 'Office Politics', place: 'City Hall & Campus', blurb: 'Paperwork is a weapon here. So is a whistle.', color: '#a35cff' },
  { n: 5, name: 'Out of Town', place: 'Countryside & Harbor', blurb: 'Fields, docks, mines and a very loud airstrip.', color: '#3f8a4a' },
  { n: 6, name: 'The Big Show', place: 'Arts District & Grand Hall', blurb: 'Style, sound and the Job Fair Finals.', color: '#ffd23f' },
];

const L = (x: Level) => x;

export const LEVELS: Level[] = [
  // ---------------- 1. Downtown ----------------
  L({ id: '1-1', chapter: 1, title: 'Rush Hour', twist: 'Classic rules: no cards. Learn the basics.', rule: 'ko', yours: 1, enemies: ['courier'], classic: true, par: 35,
    intro: [{ who: 'courier', text: 'Out of my lane, new hire! I have forty parcels and zero patience.' }, { who: 'you', text: 'Forty-one. You just dropped one.' }],
    win: [{ who: 'courier', text: 'Fine, fine. You hit like overnight shipping. Want to team up some time?' }], unlocks: ['courier'] }),
  L({ id: '1-2', chapter: 1, title: 'Order Mix-Up', twist: 'Your first Gacha fight: pick a card now, then every 20 s.', rule: 'ko', yours: 1, enemies: ['waiter'], par: 80,
    intro: [{ who: 'waiter', text: 'Table six ordered the soup. You brought them a fight.' }, { who: 'you', text: 'Specials of the day: me.' }],
    win: [{ who: 'waiter', text: 'Service with a smile… a bruised one. I’ll take my tip in experience.' }], unlocks: ['waiter'] }),
  L({ id: '1-3', chapter: 1, title: 'Closing Time', twist: 'Tag team: pick two of your jobs.', rule: 'ko', yours: 2, enemies: ['cleaner', 'merchant'], par: 90,
    intro: [{ who: 'merchant', text: 'Last sale of the day! Everything must go, including you.' }, { who: 'cleaner', text: 'And I just mopped. Don’t you dare slip.' }],
    win: [{ who: 'cleaner', text: 'Spotless technique. Count us in.' }, { who: 'merchant', text: 'A fair trade. Two new recruits for one beating.' }], unlocks: ['cleaner', 'merchant'] }),
  L({ id: '1-4', chapter: 1, title: 'BOSS: Noise Complaint', twist: 'Boss: the Officer has 2.2× HP and Riot Gear + Iron Will.', rule: 'ko', yours: 1, enemies: ['police'], par: 110,
    opts: { teamHpMul: [1, 2.2], enemyCards: ['riot-gear', 'iron-will'] },
    intro: [{ who: 'police', text: 'We’ve had reports of a rookie causing a scene downtown.' }, { who: 'you', text: 'Reports? I’ve had *results*.' }, { who: 'police', text: 'Hands where I can see them.' }],
    win: [{ who: 'police', text: '…Off the record, that was impressive. The force could use you. Or I could use you.' }], unlocks: ['police'] }),

  // ---------------- 2. Construction ----------------
  L({ id: '2-1', chapter: 2, title: 'Beat the Deadline', twist: 'Time attack: knock the Builder out within 75 s.', rule: 'timeAttack', yours: 1, enemies: ['builder'], par: 50,
    opts: { timeLimit: 75, hpMul: 2 },
    intro: [{ who: 'builder', text: 'This wall goes up by end of shift. You’re standing where the wall goes.' }],
    win: [{ who: 'builder', text: 'Ahead of schedule. Never seen that on a site before.' }], unlocks: ['builder'] }),
  L({ id: '2-2', chapter: 2, title: 'Safety Inspection', twist: 'Two on one! Just stay standing for 80 s.', rule: 'survive', yours: 1, enemies: ['welder', 'electrician'], par: 80,
    opts: { timeLimit: 80, hpMul: 2.6, myCards: ['hard-hat'] },
    intro: [{ who: 'welder', text: 'Inspector, huh? Let’s see you inspect THIS.' }, { who: 'electrician', text: 'I’ll keep the current going.' }, { who: 'you', text: 'I’m not an inspector. I was just asking for directions.' }],
    win: [{ who: 'welder', text: 'Tough as a fresh seam. I’m in.' }], unlocks: ['welder'] }),
  L({ id: '2-3', chapter: 2, title: 'Power Surge', twist: 'Power surge: a card pick every 10 s instead of 20.', rule: 'ko', yours: 1, enemies: ['electrician'], par: 80,
    opts: { surgeEvery: 10 },
    intro: [{ who: 'electrician', text: 'Grid’s unstable today. Cards keep shorting into the arena.' }, { who: 'you', text: 'More cards for me, then.' }],
    win: [{ who: 'electrician', text: 'You conduct yourself well. I’ll wire into your crew.' }], unlocks: ['electrician'] }),
  L({ id: '2-4', chapter: 2, title: 'BOSS: The Blueprint', twist: 'Boss: the Engineer has 2.4× HP, Giant Mode and Load Bearing.', rule: 'ko', yours: 1, enemies: ['engineer'], par: 120,
    opts: { teamHpMul: [1, 2.4], enemyCards: ['giant-mode', 'load-bearing'] },
    intro: [{ who: 'engineer', text: 'I ran the numbers on you. You lose in every scenario.' }, { who: 'plumber', text: '(from under the stage) Boss, the pipes are making that noise again…' }],
    win: [{ who: 'engineer', text: 'An error in my calculations. Fascinating. Hire me to find it.' }, { who: 'plumber', text: 'And me! Someone has to fix what you two broke.' }], unlocks: ['engineer', 'plumber'] }),

  // ---------------- 3. Hospital Hill ----------------
  L({ id: '3-1', chapter: 3, title: 'Pit Stop', twist: 'Sudden death: both sides start at 50% HP.', rule: 'ko', yours: 1, enemies: ['mechanic'], par: 45,
    opts: { startHpPct: [0.5, 0.5] },
    intro: [{ who: 'mechanic', text: 'Ambulance bay’s closed for repairs. So are you, looks like.' }],
    win: [{ who: 'mechanic', text: 'Running on fumes and you still won? I want to see your engine.' }], unlocks: ['mechanic'] }),
  L({ id: '3-2', chapter: 3, title: 'Second Opinion', twist: 'The Doctor starts with Second Opinion and Night Shift.', rule: 'ko', yours: 1, enemies: ['doctor'], par: 90,
    opts: { enemyCards: ['second-opinion', 'night-shift'] },
    intro: [{ who: 'doctor', text: 'My diagnosis: you need rest. Lots of rest. On the floor.' }],
    win: [{ who: 'doctor', text: 'I stand corrected. Rare, but it happens.' }], unlocks: ['doctor'] }),
  L({ id: '3-3', chapter: 3, title: 'Lab Accident', twist: 'The Scientist starts with two epic cards; you get Hazard Pay.', rule: 'ko', yours: 1, enemies: ['scientist'], par: 95,
    opts: { enemyCards: ['double-shift', 'unstable-formula'], myCards: ['hazard-pay'] },
    intro: [{ who: 'scientist', text: 'Don’t touch anything. Especially the green one. ESPECIALLY me.' }],
    win: [{ who: 'scientist', text: 'Eureka! A specimen that fights back. For science, I join you.' }], unlocks: ['scientist'] }),
  L({ id: '3-4', chapter: 3, title: 'BOSS: Server Room', twist: 'Boss tag team: Programmer & Mechanic, both with Aegis Protocol.', rule: 'ko', yours: 2, enemies: ['programmer', 'mechanic'], par: 120,
    opts: { teamHpMul: [1, 1.5], enemyCards: ['aegis'] },
    intro: [{ who: 'programmer', text: 'You’re in my server room. Nobody gets in my server room.' }, { who: 'mechanic', text: 'I keep the hardware running. Mostly with a wrench.' }],
    win: [{ who: 'programmer', text: 'Okay. You found the bug, and the bug was me. I’ll push to your branch.' }], unlocks: ['programmer'] }),

  // ---------------- 4. City Hall & Campus ----------------
  L({ id: '4-1', chapter: 4, title: 'Pop Quiz', twist: 'Classic rules: no cards. Show what you’ve learned.', rule: 'ko', yours: 1, enemies: ['teacher'], classic: true, par: 40,
    intro: [{ who: 'teacher', text: 'Pencils down. This fight is worth 100% of your grade.' }],
    win: [{ who: 'teacher', text: 'A-plus. Class dismissed, and I’m enrolling in yours.' }], unlocks: ['teacher'] }),
  L({ id: '4-2', chapter: 4, title: 'The Audit', twist: 'Sudden death: you start at 60% HP, the Accountant at 100%.', rule: 'ko', yours: 1, enemies: ['accountant'], par: 85,
    opts: { startHpPct: [0.6, 1] },
    intro: [{ who: 'accountant', text: 'Your expense report has some… irregularities. Let’s settle up.' }],
    win: [{ who: 'accountant', text: 'The books balance. You’re a sound investment.' }], unlocks: ['accountant'] }),
  L({ id: '4-3', chapter: 4, title: 'Objection!', twist: 'The Lawyer reflects damage: Objection Sustained + Spiky Uniform.', rule: 'ko', yours: 1, enemies: ['lawyer'], par: 95,
    opts: { enemyCards: ['objection-sustained', 'spiky-uniform'] },
    intro: [{ who: 'lawyer', text: 'My client — me — pleads not guilty to losing.' }, { who: 'you', text: 'Overruled.' }],
    win: [{ who: 'lawyer', text: 'The court finds in your favour. I’ll be representing you from now on.' }], unlocks: ['lawyer'] }),
  L({ id: '4-4', chapter: 4, title: 'BOSS: Varsity Captain', twist: 'Boss: the Athlete has 2.3× HP, Flow State and Second Half.', rule: 'ko', yours: 1, enemies: ['athlete'], par: 120,
    opts: { teamHpMul: [1, 2.3], enemyCards: ['flow-state', 'second-half'] },
    intro: [{ who: 'athlete', text: 'Undefeated four seasons running. You’re just practice.' }],
    win: [{ who: 'athlete', text: 'Good game. Seriously. Can I be on your team?' }], unlocks: ['athlete'] }),

  // ---------------- 5. Countryside & Harbor ----------------
  L({ id: '5-1', chapter: 5, title: 'Harvest Festival', twist: 'The Farmer’s crops are ripe: it starts with Harvest Moon and First Aid Kit.', rule: 'ko', yours: 1, enemies: ['farmer'], par: 90,
    opts: { enemyCards: ['harvest-moon', 'first-aid'] },
    intro: [{ who: 'farmer', text: 'Y’all trampled my pumpkins. Ain’t nobody tramples my pumpkins.' }],
    win: [{ who: 'farmer', text: 'Well I’ll be. Strong as an ox. Saddle up, partner.' }], unlocks: ['farmer'] }),
  L({ id: '5-2', chapter: 5, title: 'The Big Catch', twist: 'Time attack: reel the Fisher in within 80 s.', rule: 'timeAttack', yours: 1, enemies: ['fisher'], par: 55,
    opts: { timeLimit: 80, hpMul: 2.2 },
    intro: [{ who: 'fisher', text: 'Shh. You’ll scare the fish. And then I’ll have to catch YOU instead.' }],
    win: [{ who: 'fisher', text: 'That’s the one that didn’t get away. Count me in.' }], unlocks: ['fisher'] }),
  L({ id: '5-3', chapter: 5, title: 'Up & Under', twist: 'Tag team vs the Miner & Pilot. You get Momentum to start.', rule: 'ko', yours: 2, enemies: ['miner', 'pilot'], par: 110,
    opts: { myCards: ['momentum'] },
    intro: [{ who: 'pilot', text: 'I fly over it.' }, { who: 'miner', text: 'I dig under it.' }, { who: 'you', text: 'I’ll go through both of you.' }],
    win: [{ who: 'miner', text: 'Struck gold with you two.' }, { who: 'pilot', text: 'Cleared for takeoff with your squad.' }], unlocks: ['miner', 'pilot'] }),
  L({ id: '5-4', chapter: 5, title: 'BOSS: Boot Camp', twist: 'Boss: the Soldier has 2.5× HP, Battle Hardened and Berserker.', rule: 'ko', yours: 1, enemies: ['soldier'], par: 125,
    opts: { teamHpMul: [1, 2.5], enemyCards: ['battle-hardened', 'berserker'] },
    intro: [{ who: 'soldier', text: 'Drop and give me twenty, recruit!' }, { who: 'you', text: 'Twenty what?' }, { who: 'soldier', text: 'HITS.' }],
    win: [{ who: 'soldier', text: 'At ease. You’ve earned your stripes, and my respect.' }], unlocks: ['soldier'] }),

  // ---------------- 6. Arts District & the Finals ----------------
  L({ id: '6-1', chapter: 6, title: 'Runway', twist: 'Fast fashion: both sides start with Running Shoes and Momentum.', rule: 'ko', yours: 1, enemies: ['tailor'], par: 80,
    opts: { enemyCards: ['running-shoes', 'momentum'], myCards: ['running-shoes', 'momentum'] },
    intro: [{ who: 'tailor', text: 'That outfit is a crime. Let me take it in. And you down.' }],
    win: [{ who: 'tailor', text: 'Impeccable form. I’ll stitch myself into your team.' }], unlocks: ['tailor'] }),
  L({ id: '6-2', chapter: 6, title: 'Fresh Cut', twist: 'Sudden death: everyone starts at 45% HP. Crits decide it.', rule: 'ko', yours: 1, enemies: ['barber'], par: 40,
    opts: { startHpPct: [0.45, 0.45], enemyCards: ['fresh-fade'] },
    intro: [{ who: 'barber', text: 'Just a little off the top? I’m thinking a LOT off the top.' }],
    win: [{ who: 'barber', text: 'Sharp. Very sharp. I’d like to be in your corner.' }], unlocks: ['barber'] }),
  L({ id: '6-3', chapter: 6, title: 'Gallery Opening', twist: 'Tag team vs the Artist & Musician, with Standing Ovation.', rule: 'ko', yours: 2, enemies: ['artist', 'musician'], par: 115,
    opts: { enemyCards: ['standing-ovation'] },
    intro: [{ who: 'artist', text: 'Tonight’s piece is called “Rookie, Defeated”. Mixed media.' }, { who: 'musician', text: 'And I’m playing the soundtrack. It’s a sad one.' }],
    win: [{ who: 'musician', text: 'Encore! …For you, I mean.' }, { who: 'artist', text: 'You’re my new muse. We’re coming with you.' }], unlocks: ['artist', 'musician'] }),
  L({ id: '6-4', chapter: 6, title: 'FINALE: Job Fair Finals', twist: 'The finale: your best two against the Officer & the Engineer, rematched with three epic cards.', rule: 'ko', yours: 2, enemies: ['police', 'engineer'], par: 150,
    opts: { teamHpMul: [1, 1.6], enemyCards: ['aegis', 'golden-parachute', 'grudge'] },
    intro: [{ who: 'police', text: 'Remember us? We remember you.' }, { who: 'engineer', text: 'I’ve recalculated. With your data this time.' }, { who: 'you', text: 'Then you know how this ends.' }],
    win: [{ who: 'police', text: 'Employee of the Year. Nobody’s arguing that.' }, { who: 'engineer', text: 'Confirmed: you are the best in Metro City.' }], unlocks: [] }),
];

// ---------------- progress ----------------

export interface Progress { stars: Record<string, number>; unlocked: string[]; best: Record<string, number> }
const KEY = 'storyProgress';

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (p && p.stars && Array.isArray(p.unlocked)) return p;
  } catch {}
  return { stars: {}, unlocked: [...STARTERS], best: {} };
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

/** a level is open once the one before it is cleared */
export function isOpen(p: Progress, id: string) {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i <= 0 || (p.stars[LEVELS[i - 1].id] ?? 0) > 0;
}

export const totalStars = (p: Progress) => Object.values(p.stars).reduce((a, b) => a + b, 0);

/** Did your side (team 0) win this level, and with how many stars? */
export function judge(level: Level, sim: Sim): { won: boolean; stars: number; reason: string } {
  const mine = sim.fighters.filter((f) => f.team === 0);
  const standing = mine.some((f) => f.state !== 'ko');
  const hpPct = mine.reduce((s, f) => s + f.hp / f.maxHp, 0) / mine.length;
  const timedOut = sim.t >= sim.timeLimit - 1e-6;
  let won: boolean;
  let reason = '';
  if (level.rule === 'survive') {
    won = standing;
    reason = won ? 'You survived!' : 'Knocked out before the bell.';
  } else if (level.rule === 'timeAttack') {
    won = sim.winner === 0 && !timedOut;
    reason = won ? 'Beat the clock!' : timedOut ? 'Out of time.' : 'Knocked out.';
  } else {
    won = sim.winner === 0;
    reason = won ? (timedOut ? 'Won on HP at the bell.' : 'K.O.!') : sim.winner === -1 ? 'A draw is not a win.' : 'Knocked out.';
  }
  if (!won) return { won, stars: 0, reason };
  let stars = 1;
  if (hpPct >= 0.4) stars++;
  if (sim.t <= level.par && level.rule !== 'survive') stars++;
  if (level.rule === 'survive' && hpPct >= 0.6) stars++;
  return { won, stars, reason };
}
