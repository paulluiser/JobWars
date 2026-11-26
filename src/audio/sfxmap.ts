/**
 * Which recorded sound (public/sfx, keys from tools/sfx/samples.ts) plays for what.
 * Each job has its own swing, hit material, active-skill and special sounds; every event,
 * status and hazard has its own cue. A list means "pick one at random" (variation); layers
 * play together. Procedural sounds in sfx.ts cover what the pack doesn't have (fire,
 * explosions, thunder, zaps) and fill in if a recording is missing.
 */
export interface JobSfx {
  /** whoosh family for its swings, and a playback rate (heavy tools swing lower) */
  swing: string[];
  rate: number;
  /** material layered on every landed hit: what its tool sounds like on impact */
  hit: string[];
  /** active skill: layers played together */
  active: string[];
  /** special move: layers played together (on top of the special stinger) */
  special: string[];
}

const W = ['whoosh1', 'whoosh2', 'whoosh3'];
const WS = ['whooshS1', 'whooshS2', 'whooshS3'];
const SW = ['swoosh1', 'swoosh2', 'swoosh3', 'swoosh4', 'swoosh5', 'swoosh6'];

export const JOB_SFX: Record<string, JobSfx> = {
  chef: { swing: WS, rate: 1.1, hit: ['knifeScrape'], active: ['spoon', 'whoosh2'], special: ['levelUpMallet', 'spoon'] },
  firefighter: { swing: SW, rate: 0.85, hit: ['axeChop'], active: ['faucetOn', 'faucetRun'], special: ['hatchClose', 'bigImpact2'] },
  electrician: { swing: WS, rate: 1.05, hit: ['switchOn'], active: ['electricBox', 'switchOn'], special: ['lever', 'hvacOff'] },
  nurse: { swing: WS, rate: 1.2, hit: ['plasticObj'], active: ['errSciFi', 'notify4'], special: ['notify2', 'powerUp1'] },
  courier: { swing: W, rate: 1.05, hit: ['canvasDrop'], active: ['shiftStick', 'engineHigh'], special: ['engine', 'carDoor'] },
  fisher: { swing: SW, rate: 1.15, hit: ['oar'], active: ['unlockKey', 'swoosh3'], special: ['bubbles', 'oar'] },
  farmer: { swing: SW, rate: 0.95, hit: ['swordScrape2'], active: ['swordScrape1', 'leaves'], special: ['chicken', 'pig', 'sheep'] },
  builder: { swing: W, rate: 0.8, hit: ['anvil'], active: ['woodDrop', 'toolBag'], special: ['bigImpact1', 'metalDrop4'] },
  miner: { swing: W, rate: 0.85, hit: ['metal3'], active: ['woodDrag', 'leaves'], special: ['bigImpact3', 'paneBreak'] },
  welder: { swing: W, rate: 0.95, hit: ['metal5'], active: ['grinder'], special: ['anvilRing', 'hydraulic'] },
  plumber: { swing: W, rate: 0.9, hit: ['bucket'], active: ['valve', 'burp'], special: ['flush'] },
  mechanic: { swing: WS, rate: 1.0, hit: ['metalDrop1'], active: ['servo', 'toolBag'], special: ['hydraulic', 'powerTool'] },
  engineer: { swing: W, rate: 0.9, hit: ['metal2'], active: ['metalDrop4', 'lever2'], special: ['pages', 'levelUp'] },
  pilot: { swing: WS, rate: 1.1, hit: ['shell2'], active: ['laser1', 'laser2'], special: ['engineHigh', 'shell1'] },
  merchant: { swing: WS, rate: 1.05, hit: ['coinDrop'], active: ['coins'], special: ['countUp', 'coins'] },
  waiter: { swing: SW, rate: 1.2, hit: ['ceramic'], active: ['can', 'swoosh2'], special: ['notify2', 'glassBreak'] },
  cleaner: { swing: SW, rate: 0.9, hit: ['plasticBottle'], active: ['faucetOn', 'squish2'], special: ['faucetRun', 'bubbles'] },
  tailor: { swing: WS, rate: 1.25, hit: ['cloth3'], active: ['knifeScrape', 'whooshS2'], special: ['paperTear', 'cloth1'] },
  barber: { swing: WS, rate: 1.3, hit: ['doorLock'], active: ['fanStart'], special: ['sword1', 'uiOpen'] },
  doctor: { swing: WS, rate: 1.15, hit: ['caseClose'], active: ['hiTechConfirm', 'errWood'], special: ['notify2', 'powerUp2'] },
  scientist: { swing: WS, rate: 1.1, hit: ['glassDrop'], active: ['glassBreak', 'squish1'], special: ['bellUp', 'spell1'] },
  teacher: { swing: W, rate: 1.05, hit: ['bookClose'], active: ['crumple', 'paperBall'], special: ['doorSlam', 'lockKey'] },
  programmer: { swing: WS, rate: 1.2, hit: ['hiTechBack'], active: ['typing', 'errHiTech'], special: ['errSciFi', 'typing'] },
  accountant: { swing: WS, rate: 1.15, hit: ['switchOff'], active: ['countUp', 'coinDrop'], special: ['knock', 'caseClose'] },
  lawyer: { swing: W, rate: 1.0, hit: ['knockOne'], active: ['bookOpen', 'knockOne'], special: ['woodDrop', 'snareCrash'] },
  police: { swing: W, rate: 1.0, hit: ['metalDrop2'], active: ['lockKey'], special: ['dog', 'carDoor'] },
  soldier: { swing: W, rate: 0.9, hit: ['shell1'], active: ['slideLock', 'shell3'], special: ['marchSnare', 'trunk'] },
  artist: { swing: SW, rate: 1.15, hit: ['squish1'], active: ['swoosh5', 'squish2'], special: ['spell2'] },
  musician: { swing: SW, rate: 0.95, hit: ['guitarDown'], active: ['guitarUp'], special: ['guitarUp2'] },
  athlete: { swing: SW, rate: 1.1, hit: ['kick3'], active: ['kick5', 'boing4'], special: ['kick1', 'kick4', 'victoryElectronic'] },
};

/** combat & match events */
export const EVENT_SFX = {
  punch: ['punch1', 'punch2', 'punch3', 'punch4', 'punch5', 'punch6'],
  punchHeavy: ['punchH1', 'punchH2', 'punchH3', 'punchH4'],
  crit: ['punchX'],
  skillHit: ['kick1', 'kick2', 'kick3', 'kick4', 'kick5'],
  miss: WS,
  heavySwing: SW,
  block: ['swordClash'],
  parry: ['sword2', 'metalConfirm'],
  guardBreak: ['bone1', 'bone2', 'bone3'],
  dodge: ['cloth1', 'cloth2', 'cloth3'],
  bump: ['gear1', 'gear2'],
  wallSlam: ['boing1', 'boing2', 'boing3'],
  interrupt: ['errMetal'],
  chargeStart: ['gear2'],
  stun: ['bellDown'],
  heal: ['powerUp1'],
  cleanse: ['uiOpen'],
  absorb: ['metal4'],
  specialReady: ['musicalOpen'],
  special: ['spell2'],
  ko: ['bigImpact1', 'bigImpact2', 'bigImpact3'],
  down: ['bigImpact2'],
  firstBlood: ['guitarUp'],
  intro: ['marchSnare'],
  fight: ['snareCrash'],
  tick: ['notify1'],
  tickUrgent: ['notify4'],
  win: ['victory'],
  draw: ['lossMallet'],
  champion: ['victoryBig'],
  replay: ['sciOpen'],
  share: ['notify3'],
  uiClick: ['uiConfirm'],
  uiTab: ['uiTab'],
  uiGo: ['uiGo'],
  uiBack: ['uiBack'],
} as const;

/** status effects as they land */
export const STATUS_SFX: Record<string, string[]> = {
  poison: ['squish1'], bleed: ['squish2'], burn: [], slow: ['gear1'], wet: ['faucetOff'], blind: ['errPops'],
  root: ['chains'], silence: ['errMetal'], disarm: ['metalDrop3'], weaken: ['errWood'], armorBreak: ['paneBreak'],
  sleep: ['tone1'], confuse: ['boing2'], charm: ['musicalOpen'], glitch: ['errHiTech'], mark: ['notify5'],
  spicy: ['powerUp2'], hearty: ['powerUp1'], light: ['sciOpen'], lifeSupport: ['notify2'], shield: ['hiTechConfirm'],
  haste: ['hiTechOpen'], empower: ['levelUpMallet'], fortify: ['lockKey'], superArmor: ['anvil'], invuln: ['bellUp'],
  airborne: ['swoosh6'],
};

/** hazards as they appear / go off */
export const HAZARD_SFX: Record<string, { spawn?: string[]; trigger?: string[] }> = {
  trap: { spawn: ['electricBox'], trigger: ['switchOn'] },
  hook: { spawn: ['swoosh3'], trigger: ['unlockKey'] },
  crop: { spawn: ['leaves'], trigger: ['leaves'] },
  wall: { spawn: ['woodDrop'], trigger: ['woodDrop'] },
  gem: { spawn: ['tone3'], trigger: ['coinDrop'] },
  pipe: { spawn: ['valve'], trigger: ['flush'] },
  turret: { spawn: ['servo'], trigger: ['laser2'] },
  beam: { spawn: ['metalDrop4'], trigger: ['anvil'] },
  tray: { spawn: ['can'], trigger: ['ceramic'] },
  zone: { spawn: ['faucetOn'], trigger: ['squish2'] },
  grenade: { spawn: ['slideLock'], trigger: [] },
  ball: { spawn: ['boing4'], trigger: ['kick2'] },
};
