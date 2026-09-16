// Board balance search. Run: node --import ./scripts/register.mjs scripts/grid.mjs [plays]
import { SLOT_VALUES, TUNE, COL_COUNT, COL_MAX, RESULT_CENTRE } from '../src/engine.ts';
import { createBoard, launchBoard, stepBoard, RESULT_FLYING } from '../src/physics.ts';

const N = Number(process.argv[2] ?? 600);
const DT = 1 / 60;

export function evaluate(over, n = N) {
  const tune = { ...TUNE, ...over };
  const board = createBoard(tune);
  board.columns = Array.from({ length: COL_COUNT }, (_, i) =>
    Math.min(COL_MAX, Math.round(6 + Math.abs(i - (COL_COUNT - 1) / 2) * 0.72)),
  );
  const hits = new Array(9).fill(0);
  let paid = 0, won = 0, time = 0, timeouts = 0;
  for (let i = 0; i < n; i++) {
    launchBoard(board, Math.random());
    let r = 0;
    for (let s = 0; s < 2400; s++) {
      r = stepBoard(board, DT);
      if (r !== RESULT_FLYING) break;
    }
    time += board.t;
    if (board.t > 13) timeouts++;
    if (r > 0) { hits[r - 1]++; won++; paid += SLOT_VALUES[r - 1]; }
    else if (r === RESULT_CENTRE) { won++; paid += 10; }
  }
  const left = hits.slice(0, 4).reduce((a, b) => a + b, 0);
  const right = hits.slice(5).reduce((a, b) => a + b, 0);
  return {
    tune, hits, n,
    hit: won / n, payback: paid / n, jackpot: hits[4] / n,
    flight: time / n, timeouts: timeouts / n,
    // 0 means all action on the left, 1 all on the right, 0.5 even.
    balance: left + right > 0 ? right / (left + right) : 0.5,
  };
}

function line(keys, r) {
  const head = keys.map((k) => String(r.tune[k]).padStart(Math.max(4, k.length))).join(' ');
  const covered = r.hits.filter((h) => h / r.n >= 0.004).length;
  return `${head}  ${(100 * r.hit).toFixed(1).padStart(5)}  ${r.payback.toFixed(3).padStart(7)}  ${(100 * r.jackpot).toFixed(2).padStart(5)}  ${r.flight.toFixed(2)}s  ${r.balance.toFixed(2)}   ${covered}   [${r.hits.map((h) => ((100 * h) / r.n).toFixed(1)).join(' ')}]`;
}

if (process.argv[1].endsWith('grid.mjs')) {
  const keys = ['enterRate', 'railDrop'];
  const rows = [];
  for (const enterRate of [0.72, 0.8, 0.9])
    for (const railDrop of [2.5, 3])
      rows.push(evaluate({ enterRate, railDrop }));
  rows.sort((a, b) => Math.abs(a.payback - 0.85) - Math.abs(b.payback - 0.85));
  console.log(keys.join(' ') + '   hit%   payback  jack%  flight   bal  pockets  distribution');
  for (const r of rows) console.log(line(keys, r));
}
