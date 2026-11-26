import type { Sim } from '../sim/sim';
import { kitOf } from '../sim/kits';
import type { Fighter } from '../sim/types';

/**
 * Fighters bounce without steering. Their choices, in priority order:
 *   1. Special: fire it the moment the rage bar is full, from almost any state.
 *   2. Active skill: when it's off cooldown and the kit's condition holds.
 *   3. When the foe is in reach or closing into it: a swing or a charged blow.
 * Whether a swing connects is decided by reach and the attack table in the sim.
 */
export function think(sim: Sim, f: Fighter) {
  if (f.special === 'ready' && f.state !== 'stun' && f.state !== 'cast') {
    sim.castSpecial(f);
    return;
  }
  if (!sim.actionable(f)) return;
  if (f.activeCd <= 0 && !sim.has(f, 'silence') && kitOf(f).active.canCast(sim, f, sim.foeOf(f))) {
    sim.castActive(f);
    return;
  }
  if (f.attackCd > 0 || sim.has(f, 'disarm') || sim.has(f, 'charm')) return;
  if (kitOf(f).noSwing?.(sim, f) || !sim.canStartSwing(f)) return;
  if (sim.rng.chance(f.def.chargeChance)) sim.startCharge(f);
  else sim.startAttack(f);
}
