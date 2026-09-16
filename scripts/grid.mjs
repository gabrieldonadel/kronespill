// Board balance search. Run: node scripts/grid.mjs [playsPerConfig]
import {
  step, launchVelocity, buildSegments, buildPegs, TUNE,
  LAUNCH_X, LAUNCH_Y, SLOT_VALUES, RESULT_FLYING, RESULT_LOST,
} from '../src/engine.ts';

const N = Number(process.argv[2] ?? 600);
const DT = 1 / 60;
const pegs = buildPegs();

function trial(tune, segs, power) {
  const { vx, vy } = launchVelocity(power, tune);
  const b = { x: LAUNCH_X, y: LAUNCH_Y, vx, vy, spin: 0, t: 0, stall: 0 };
  for (let i = 0; i < 1400; i++) {
    const r = step(b, DT, segs, pegs, tune);
    if (r !== RESULT_FLYING) return r;
  }
  return RESULT_LOST;
}

export function evaluate(over, n = N) {
  const tune = { ...TUNE, ...over };
  const segs = buildSegments(tune);
  const hits = new Array(9).fill(0);
  let paid = 0, won = 0;
  for (let i = 0; i < n; i++) {
    const r = trial(tune, segs, Math.random());
    if (r > 0) { hits[r - 1]++; won++; paid += SLOT_VALUES[r - 1]; }
  }
  return { tune, hit: won / n, payback: paid / n, jackpot: hits[4] / n, hits, n };
}

function line(keys, r) {
  const head = keys.map((k) => String(r.tune[k]).padStart(k.length)).join(' ');
  return `${head}  ${(100 * r.hit).toFixed(1).padStart(5)}  ${r.payback.toFixed(3).padStart(7)}  ${(100 * r.jackpot).toFixed(2).padStart(5)}    ${r.hits.filter((h) => h / r.n >= 0.004).length}   [${r.hits.map((h) => ((100 * h) / r.n).toFixed(1)).join(' ')}]`;
}

if (process.argv[1].endsWith('grid.mjs')) {
  const keys = ['railDrop', 'vyCapture'];
  const rows = [];
  for (const vyCapture of [85, 87, 89])
    for (const railDrop of [1.5, 2, 2.5])
      rows.push(evaluate({ railDrop, vyCapture }));
  rows.sort((a, b) => Math.abs(a.payback - 0.8) - Math.abs(b.payback - 0.8));
  console.log(keys.join(' ') + '   hit%   payback  jack%  pockets  distribution');
  for (const r of rows) console.log(line(keys, r));
}
