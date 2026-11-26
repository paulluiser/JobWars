export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** Square arena (world units) so the same fight works in landscape and portrait. */
export const ARENA_W = 520;
export const ARENA_H = 520;

export const TIME_LIMIT = 99;

export const COMBAT = {
  /** blocked hits deal this share of damage */
  blockChip: 0.3,
  guardMax: 100,
  guardPerBlock: 25,
  guardRegen: 12,
  guardRegenDelay: 1.5,
  guardBreakStun: 1.2,
  parryStagger: 0.6,
  interruptStagger: 0.45,
  /** clean hits stagger the target briefly (heavy fighters have poise vs basic hits) */
  flinch: 0.18,
  heavyFlinch: 0.4,
  poiseWeight: 1.2,
  critMult: 1.5,
  /** at the very edge of reach, accuracy drops by this share */
  edgeMissPenalty: 0.35,
  knockBasic: 170,
  knockHeavy: 760,
  dodgeHop: 320,
  /** how fast speed relaxes back to cruise speed after knockback (1/s) */
  speedRelax: 2.2,
  /** random angle added on every wall bounce so paths never loop */
  bounceJitter: 0.14,
  /** ball-to-ball restitution */
  bumpRestitution: 0.85,
  wallSlamSpeed: 560,
  wallSlamStun: 0.4,
  heavyRecover: 0.5,
  /** a full charge is held this long waiting for the foe to come into reach */
  chargeHold: 1.5,
  ccWindow: 6,
};

/** Tag Team puts four fighters in the same box: everyone is drawn and collides at this size… */
export const TAG_SCALE = 0.78;
/** …and reaches this much less far (shrinks less than the body, so the fights don't drag on) */
export const TAG_REACH = 0.9;

/**
 * Rage bar for special moves: fills by dealing damage (fraction of the target's max HP × dealt),
 * taking it (fraction of own max HP × taken) and a slow trickle per second. Full = special fires,
 * then the bar empties and fills again, so specials can repeat in a long fight.
 */
export const RAGE = { max: 100, dealt: 80, taken: 92, passive: 1.8 };
