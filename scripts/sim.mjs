// Monte Carlo over the shipped board. Run: node scripts/sim.mjs [plays]
import { SLOT_VALUES, MAX_FLIGHT, TUNE } from '../src/engine.ts';
import { createBoard, launchBoard, stepBoard, coinState, RESULT_FLYING, RESULT_LOST } from '../src/physics.ts';

const PLAYS = Number(process.argv[2] ?? 20000);
const DT = 1 / 60;
const board = createBoard(TUNE);

function play(power) {
  launchBoard(board, power);
  for (let i = 0; i < 2400; i++) {
    const r = stepBoard(board, DT);
    if (r !== RESULT_FLYING) return { r, t: board.t };
  }
  return { r: RESULT_LOST, t: board.t };
}

const hits = new Array(9).fill(0);
const bands = Array.from({ length: 10 }, () => ({ n: 0, hits: 0, paid: 0 }));
let lost = 0, paid = 0, time = 0, longest = 0, timeouts = 0;

for (let i = 0; i < PLAYS; i++) {
  const power = Math.random();
  const { r, t } = play(power);
  const band = bands[Math.min(9, Math.floor(power * 10))];
  band.n++;
  time += t;
  longest = Math.max(longest, t);
  if (t >= MAX_FLIGHT) timeouts++;
  if (r === RESULT_LOST) lost++;
  else {
    hits[r - 1]++; paid += SLOT_VALUES[r - 1];
    band.hits++; band.paid += SLOT_VALUES[r - 1];
  }
}

const pct = (n) => ((100 * n) / PLAYS).toFixed(2) + '%';
console.log(`plays          ${PLAYS}`);
console.log(`hit rate       ${pct(PLAYS - lost)}`);
console.log(`payback        ${(paid / PLAYS).toFixed(3)} kr per 1 kr played`);
console.log(`house edge     ${(100 * (1 - paid / PLAYS)).toFixed(1)}%`);
console.log(`flight         ${(time / PLAYS).toFixed(2)} s mean, ${longest.toFixed(2)} s worst`);
console.log(`hit time cap   ${pct(timeouts)} of flicks`);
console.log('\npocket   pays   rate     share of payout');
hits.forEach((h, k) => {
  const share = paid > 0 ? (100 * h * SLOT_VALUES[k]) / paid : 0;
  console.log(`  ${k + 1}       ${String(SLOT_VALUES[k]).padStart(2)}    ${pct(h).padStart(6)}   ${share.toFixed(1)}%`);
});
console.log('\npower      flicks   hit rate   payback');
bands.forEach((b, i) => {
  console.log(`  ${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}   ${String(b.n).padStart(6)}     ${((100 * b.hits) / b.n).toFixed(1).padStart(5)}%    ${(b.paid / b.n).toFixed(3)}`);
});
