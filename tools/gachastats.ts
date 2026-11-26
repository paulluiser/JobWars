// Gacha balance: random teams, CPU (random) drafts. Reports match length, time-outs, picks per
// side, win rate per job and per card (when held).   npx tsx tools/gachastats.ts [games] [tag]
import { ROSTER } from '../src/data/roster';
import { ALL_CARDS } from '../src/data/cards';
import { runGacha } from '../src/modes/gacha';
import { Rng } from '../src/sim/rng';
const N = Number(process.argv[2] ?? 300);
const TAG = process.argv[3] === 'tag';
const r = new Rng(4242);
const pick = () => ROSTER[Math.floor(r.next() * ROSTER.length)];
const jw: Record<string, [number, number]> = {}, cw: Record<string, [number, number]> = {};
let len = 0, to = 0, picks = 0, sp = 0;
for (let g = 0; g < N; g++) {
  const teams: [any[], any[]] = TAG ? [[pick(), pick()], [pick(), pick()]] : [[pick()], [pick()]];
  const { sim, log } = runGacha(teams, 7000 + g);
  len += sim.t; if (sim.t >= sim.timeLimit) to++;
  picks += log.length / 2;
  sp += sim.fighters.reduce((s, f) => s + f.stats.specials, 0) / sim.fighters.length;
  const won = (t: number) => (sim.winner === t ? 1 : sim.winner === -1 ? 0.5 : 0);
  teams.forEach((t, ti) => t.forEach((d) => { const w = (jw[d.id] ??= [0, 0]); w[0] += won(ti); w[1]++; }));
  for (const p of log) { const w = (cw[p.id] ??= [0, 0]); w[0] += won(p.team); w[1]++; }
}
console.log(`${TAG ? '2v2' : '1v1'} gacha: ${N} matches, avg ${(len / N).toFixed(0)}s (${(len / N / 60).toFixed(1)} min), time-outs ${(to / N * 100).toFixed(1)}%, picks/side ${(picks / N).toFixed(1)}, specials/fighter ${(sp / N).toFixed(1)}`);
const fmt = (m: Record<string, [number, number]>, min = 8) => Object.entries(m).filter(([, [, n]]) => n >= min).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([k, [w, n]]) => `${k} ${(w / n * 100).toFixed(0)}%(${n})`);
console.log('jobs:', fmt(jw).join('  '));
const cards = fmt(cw);
console.log(`cards seen ${Object.keys(cw).length}/${ALL_CARDS.length}. top:`, cards.slice(0, 12).join('  '));
console.log('bottom:', cards.slice(-12).join('  '));
