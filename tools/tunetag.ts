// Tag Team auto-balancer: plays rounds of random 2v2s (every job appears about equally often) and
// nudges each job's 2v2 ATK/HP multiplier toward a 50% win rate, then writes src/data/tagBalance.ts.
//   npm run tune:tag [-- rounds=10 passes=40 step=0.5]
import { writeFileSync } from 'node:fs';
import { Sim } from '../src/sim/sim';
import { ROSTER } from '../src/data/roster';
import { TAG_BALANCE } from '../src/data/tagBalance';
import { Rng } from '../src/sim/rng';

const ROUNDS = Number(process.argv[2] ?? 10);
const PASSES = Number(process.argv[3] ?? 40); // each pass deals the whole roster into teams once
const STEP = Number(process.argv[4] ?? 0.5);
const LO = 0.7, HI = 1.4; // 2v2 is a nudge on top of the 1v1 balance, not a redesign

// continue from the current table so repeated runs refine instead of restarting
for (const d of ROSTER) TAG_BALANCE[d.id] ??= { atk: 1, hp: 1 };
const mult = TAG_BALANCE; // the Sim reads this table live, so changes apply to the next fight

function round(seedBase: number) {
  const rng = new Rng(seedBase);
  const ids = ROSTER.map((d) => d.id);
  const w: Record<string, number> = {}, g: Record<string, number> = {};
  let len = 0, n = 0, timeouts = 0;
  for (let p = 0; p < PASSES; p++) {
    // shuffle, then deal into games of four (the 2 left over join the next pass's deck)
    const deck = ids.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng.range(0, i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    for (let k = 0; k + 4 <= deck.length; k += 4) {
      const t = deck.slice(k, k + 4).map((id) => ROSTER.find((d) => d.id === id)!);
      const sim = new Sim([[t[0], t[1]], [t[2], t[3]]], seedBase + p * 101 + k);
      while (!sim.over) sim.step();
      t.forEach((d, i) => {
        const team = i < 2 ? 0 : 1;
        g[d.id] = (g[d.id] ?? 0) + 1;
        w[d.id] = (w[d.id] ?? 0) + (sim.winner === team ? 1 : sim.winner === -1 ? 0.5 : 0);
      });
      len += sim.t; n++;
      if (sim.t >= 99) timeouts++;
    }
  }
  const wr = Object.fromEntries(ids.map((id) => [id, w[id] / g[id]]));
  return { wr, len: len / n, timeouts: timeouts / n, games: n };
}

const report = (wr: Record<string, number>) => {
  const v = Object.values(wr);
  return `range ${(Math.min(...v) * 100).toFixed(0)}–${(Math.max(...v) * 100).toFixed(0)}%, mean |off| ${(v.reduce((s, x) => s + Math.abs(x - 0.5), 0) / v.length * 100).toFixed(1)} pts`;
};

const before = round(424242);
console.log(`before (fresh seeds): ${report(before.wr)}, avg fight ${before.len.toFixed(1)}s, ${before.games} games`);
for (let r = 0; r < ROUNDS; r++) {
  const { wr, len, timeouts } = round(10000 * (r + 1));
  console.log(`round ${r + 1}: ${report(wr)}, avg fight ${len.toFixed(1)}s, time-outs ${(timeouts * 100).toFixed(1)}%`);
  const step = STEP / (1 + r * 0.3);
  for (const d of ROSTER) {
    const e = 0.5 - wr[d.id];
    const m = mult[d.id];
    m.atk = Math.max(LO, Math.min(HI, m.atk * (1 + e * step)));
    m.hp = Math.max(LO, Math.min(HI, m.hp * (1 + e * step * 0.8)));
  }
}
const after = round(424242);
console.log(`\nafter (same fresh seeds as "before"): ${report(after.wr)}, avg fight ${after.len.toFixed(1)}s, time-outs ${(after.timeouts * 100).toFixed(1)}%`);
for (const d of [...ROSTER].sort((a, b) => after.wr[b.id] - after.wr[a.id]))
  console.log(`${d.name.padEnd(12)} ${(before.wr[d.id] * 100).toFixed(0).padStart(3)}% → ${(after.wr[d.id] * 100).toFixed(0).padStart(3)}%   atk ×${mult[d.id].atk.toFixed(2)}  hp ×${mult[d.id].hp.toFixed(2)}`);

const out = Object.fromEntries(ROSTER.map((d) => [d.id, { atk: +mult[d.id].atk.toFixed(3), hp: +mult[d.id].hp.toFixed(3) }]));
writeFileSync('src/data/tagBalance.ts', `/**
 * Extra multipliers for Tag Team (2v2), written by \`npm run tune:tag\` (tools/tunetag.ts).
 * They sit on top of the 1v1 balance and apply only when a side has more than one fighter,
 * so 1v1 stays exactly as tuned. Jobs that aren't listed are unchanged (×1).
 */
export const TAG_BALANCE: Record<string, { atk: number; hp: number }> = ${JSON.stringify(out, null, 2)};
`);
console.log('wrote src/data/tagBalance.ts');
