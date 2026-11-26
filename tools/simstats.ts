// Headless balance runner: `npm run simstats [-- N]` plays every matchup N times (both sides).
import { Sim } from '../src/sim/sim';
import { ROSTER } from '../src/data/roster';

const N = Number(process.argv[2] ?? 100);
const names = ROSTER.map((d) => d.name);
const wins: number[][] = ROSTER.map(() => ROSTER.map(() => 0));
const games: number[][] = ROSTER.map(() => ROSTER.map(() => 0));
let totalT = 0, fights = 0, timeouts = 0, minT = Infinity, maxT = 0;
const ev: Record<string, number> = {};
const per: Record<string, Record<string, number>> = {};

for (let i = 0; i < ROSTER.length; i++) {
  for (let j = 0; j < ROSTER.length; j++) {
    if (i === j) continue;
    for (let k = 0; k < N; k++) {
      const sim = new Sim([[ROSTER[i]], [ROSTER[j]]], 7919 * i + 104729 * j + k);
      while (!sim.over) for (const e of sim.step()) {
        ev[e.type] = (ev[e.type] ?? 0) + 1;
        if (e.type === 'end' && e.reason === 'time') timeouts++;
      }
      fights++;
      totalT += sim.t;
      minT = Math.min(minT, sim.t);
      maxT = Math.max(maxT, sim.t);
      games[i][j]++;
      if (sim.winner === 0) wins[i][j]++;
      if (sim.winner === 1) wins[j][i]++, (games[j][i] += 0);
      for (const f of sim.fighters) {
        const p = (per[f.def.name] ??= {});
        for (const [s, v] of Object.entries(f.stats)) p[s] = (p[s] ?? 0) + v;
        p.n = (p.n ?? 0) + 1;
      }
    }
  }
}

console.log(`fights: ${fights}  timeouts: ${timeouts}  length avg ${(totalT / fights).toFixed(1)}s (min ${minT.toFixed(1)}, max ${maxT.toFixed(1)})`);
console.log('\nwin rate of ROW vs COLUMN (both sides combined):');
console.log('            ' + names.map((n) => n.slice(0, 8).padStart(9)).join(''));
for (let i = 0; i < ROSTER.length; i++) {
  let row = names[i].padEnd(12);
  for (let j = 0; j < ROSTER.length; j++) {
    if (i === j) { row += '        -'; continue; }
    const w = wins[i][j], l = wins[j][i];
    row += `${((w / (games[i][j] + games[j][i])) * 100).toFixed(0)}%`.padStart(9);
    void l;
  }
  const tw = wins[i].reduce((a, b) => a + b, 0);
  const tg = games[i].reduce((a, b) => a + b, 0) + games.reduce((a, r) => a + r[i], 0);
  console.log(row + `   overall ${((tw / tg) * 100).toFixed(1)}%`);
}
console.log('\nper fighter, per fight:');
for (const [n, p] of Object.entries(per)) {
  const k = (s: string) => (p[s] / p.n).toFixed(1);
  console.log(`${n.padEnd(12)} dmg ${k('damageDealt')}  heal ${k('healing')}  hits ${k('hits')}  crits ${k('crits')}  blocks ${k('blocks')}  parries ${k('parries')}  dodges ${k('dodges')}  actives ${k('actives')}  specials ${k('specials')}`);
}
console.log('\nevents per fight:', Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +(v / fights).toFixed(1)])));
