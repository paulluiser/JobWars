// Gacha auto-balancer: rounds of random Gacha matches (half 1v1, half 2v2, CPU drafts) nudging
// each job's Gacha-only ATK/HP multipliers toward 50%, then writes src/data/gachaBalance.ts.
//   npm run tune:gacha [-- rounds=10 matches=1200 step=0.9]
import { writeFileSync } from 'node:fs';
import { ROSTER } from '../src/data/roster';
import { GACHA_BALANCE } from '../src/data/gachaBalance';
import { runGacha } from '../src/modes/gacha';
import { Rng } from '../src/sim/rng';
const ROUNDS = Number(process.argv[2] ?? 10), N = Number(process.argv[3] ?? 1200), STEP = Number(process.argv[4] ?? 0.9);
for (const d of ROSTER) GACHA_BALANCE[d.id] ??= { atk: 1, hp: 1 }; // the sim reads this table live
const M = GACHA_BALANCE;
function round(seed: number) {
  const r = new Rng(seed);
  const pick = () => ROSTER[Math.floor(r.next() * ROSTER.length)];
  const w: Record<string, number> = {}, g: Record<string, number> = {};
  let len = 0, to = 0;
  for (let i = 0; i < N; i++) {
    const tag = i % 2 === 1;
    const teams: [any[], any[]] = tag ? [[pick(), pick()], [pick(), pick()]] : [[pick()], [pick()]];
    const { sim } = runGacha(teams, seed * 7 + i);
    len += sim.t; if (sim.t >= sim.timeLimit) to++;
    teams.forEach((t, ti) => t.forEach((d) => { g[d.id] = (g[d.id] ?? 0) + 1; w[d.id] = (w[d.id] ?? 0) + (sim.winner === ti ? 1 : sim.winner === -1 ? 0.5 : 0); }));
  }
  return { wr: Object.fromEntries(ROSTER.map((d) => [d.id, w[d.id] / g[d.id]])), len: len / N, to: to / N };
}
const rep = (wr: Record<string, number>) => { const v = Object.values(wr); return `range ${(Math.min(...v) * 100).toFixed(0)}–${(Math.max(...v) * 100).toFixed(0)}%, mean |off| ${(v.reduce((s, x) => s + Math.abs(x - 0.5), 0) / v.length * 100).toFixed(1)}`; };
for (let k = 0; k < ROUNDS; k++) {
  const { wr, len, to } = round(100 + k);
  console.log(`round ${k + 1}: ${rep(wr)}, avg ${len.toFixed(0)}s, time-outs ${(to * 100).toFixed(1)}%`);
  const step = STEP / (1 + k * 0.25);
  for (const d of ROSTER) {
    const e = 0.5 - wr[d.id];
    M[d.id].atk = Math.max(0.5, Math.min(1.8, M[d.id].atk * (1 + e * step)));
    M[d.id].hp = Math.max(0.5, Math.min(1.8, M[d.id].hp * (1 + e * step * 0.8)));
  }
}
const fin = round(999);
console.log(`\nfresh seeds: ${rep(fin.wr)}, avg ${fin.len.toFixed(0)}s, time-outs ${(fin.to * 100).toFixed(1)}%`);
console.log(ROSTER.map((d) => `${d.id} ${(fin.wr[d.id] * 100).toFixed(0)}% (atk×${M[d.id].atk.toFixed(2)} hp×${M[d.id].hp.toFixed(2)})`).join('  '));
const out = Object.fromEntries(ROSTER.map((d) => [d.id, { atk: +M[d.id].atk.toFixed(3), hp: +M[d.id].hp.toFixed(3) }]));
writeFileSync('src/data/gachaBalance.ts', `/**
 * Per-job ATK/HP multipliers for Gacha matches only, written by \`npm run tune:gacha\`
 * (tools/tunegacha.ts). Long, card-heavy fights reward different jobs than a 40 s duel, so Gacha
 * has its own layer on top of the normal balance. Jobs not listed are unchanged (×1).
 */
export const GACHA_BALANCE: Record<string, { atk: number; hp: number }> = ${JSON.stringify(out, null, 2)};
`);
console.log('wrote src/data/gachaBalance.ts');
