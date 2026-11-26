// Auto-balancer: plays round-robins and nudges each job's ATK/HP multiplier toward a 50% overall
// win rate, then writes src/data/balance.ts.   npm run tune [-- rounds=8 games=2]
import { writeFileSync } from 'node:fs';
import { Sim } from '../src/sim/sim';
import { applyJobBalance, DESIGNED } from '../src/data/roster';
import { BALANCE } from '../src/data/balance';

const ROUNDS = Number(process.argv[2] ?? 8);
const GAMES = Number(process.argv[3] ?? 2);
// continue from the current table so repeated runs refine instead of restarting
const mult: Record<string, { atk: number; hp: number }> = Object.fromEntries(DESIGNED.map((d) => [d.id, { ...(BALANCE[d.id] ?? { atk: 1, hp: 1 }) }]));

function round(seedBase: number) {
  const defs = DESIGNED.map((d) => applyJobBalance(d, mult[d.id]));
  const w = defs.map(() => 0), g = defs.map(() => 0);
  let len = 0, n = 0;
  for (let i = 0; i < defs.length; i++)
    for (let j = 0; j < defs.length; j++) {
      if (i === j) continue;
      for (let k = 0; k < GAMES; k++) {
        const sim = new Sim([[defs[i]], [defs[j]]], seedBase + i * 977 + j * 131 + k);
        while (!sim.over) sim.step();
        g[i]++; g[j]++;
        if (sim.winner === 0) w[i]++;
        if (sim.winner === 1) w[j]++;
        len += sim.t; n++;
      }
    }
  return { wr: w.map((x, i) => x / g[i]), len: len / n };
}

for (let r = 0; r < ROUNDS; r++) {
  const { wr, len } = round(10000 * (r + 1));
  const spread = Math.max(...wr) - Math.min(...wr);
  console.log(`round ${r + 1}: spread ${(spread * 100).toFixed(0)} pts, avg fight ${len.toFixed(1)}s`);
  const step = Number(process.argv[4] ?? 0.6) / (1 + r * 0.35); // shrink steps as it converges
  DESIGNED.forEach((d, i) => {
    const e = 0.5 - wr[i];
    const m = mult[d.id];
    m.atk = Math.max(0.55, Math.min(1.7, m.atk * (1 + e * step)));
    m.hp = Math.max(0.55, Math.min(1.7, m.hp * (1 + e * step * 0.8)));
  });
}
const { wr, len } = round(999999);
console.log(`\nfinal check (fresh seeds): avg fight ${len.toFixed(1)}s`);
DESIGNED.forEach((d, i) => console.log(`${d.name.padEnd(12)} ${(wr[i] * 100).toFixed(1)}%   atk ×${mult[d.id].atk.toFixed(2)}  hp ×${mult[d.id].hp.toFixed(2)}`));

const out = Object.fromEntries(DESIGNED.map((d) => [d.id, { atk: +mult[d.id].atk.toFixed(3), hp: +mult[d.id].hp.toFixed(3) }]));
writeFileSync('src/data/balance.ts', `/**
 * Balance multipliers written by \`npm run tune\` (tools/tune.ts): each job's designed ATK and HP
 * in the roster files are multiplied by these so every job lands near a 50% overall win rate.
 * Re-run the tuner after changing a kit; edit by hand only for small nudges.
 */
export const BALANCE: Record<string, { atk: number; hp: number }> = ${JSON.stringify(out, null, 2)};
`);
console.log('wrote src/data/balance.ts');
