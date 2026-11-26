// 2v2 smoke + stats: random teams, report errors, timeouts, length, per-job win rate
import { Sim } from '../src/sim/sim';
import { ROSTER } from '../src/data/roster';
import { Rng } from '../src/sim/rng';
const N = Number(process.argv[2] ?? 600);
const r = new Rng(12345);
const wins: Record<string, [number, number]> = {};
let timeouts = 0, len = 0, errors = 0;
for (let g = 0; g < N; g++) {
  const pick = () => ROSTER[Math.floor(r.range(0, ROSTER.length))];
  const teams: [any[], any[]] = [[pick(), pick()], [pick(), pick()]];
  try {
    const sim = new Sim(teams, 1000 + g);
    while (!sim.over) sim.step();
    len += sim.t;
    if (sim.t >= 99) timeouts++;
    teams.forEach((t, ti) => t.forEach((d) => { const w = (wins[d.id] ??= [0, 0]); w[1]++; if (sim.winner === ti) w[0]++; }));
  } catch (e) { errors++; if (errors < 4) console.error(teams.map((t) => t.map((d) => d.id)), e); }
}
console.log(`games ${N}  errors ${errors}  timeouts ${(timeouts / N * 100).toFixed(1)}%  avg ${(len / N).toFixed(1)}s`);
console.log(Object.entries(wins).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([id, [w, n]]) => `${id} ${(w / n * 100).toFixed(0)}%`).join('  '));
