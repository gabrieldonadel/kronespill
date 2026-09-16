// Fine power scan: hunts narrow strengths that reliably beat the machine.
// Run: node scripts/resonance.mjs <speedMin> <speedMax> [plays] [steps]
import { TUNE, SLOT_VALUES, RESULT_CENTRE } from '../src/engine.ts';
import { createBoard, launchBoard, stepBoard, RESULT_FLYING } from '../src/physics.ts';

const speedMin = Number(process.argv[2] ?? TUNE.speedMin);
const speedMax = Number(process.argv[3] ?? TUNE.speedMax);
const N = Number(process.argv[4] ?? 300);
const STEPS = Number(process.argv[5] ?? 40);
const DT = 1 / 60;
const tune = { ...TUNE, speedMin, speedMax };
const board = createBoard(tune);

const rows = [];
for (let i = 0; i < STEPS; i++) {
  const power = (i + 0.5) / STEPS;
  let paid = 0, jack = 0, hits = 0;
  for (let n = 0; n < N; n++) {
    launchBoard(board, power);
    let r = 0;
    for (let f = 0; f < 2400; f++) {
      r = stepBoard(board, DT);
      if (r !== RESULT_FLYING) break;
    }
    if (r > 0) { paid += SLOT_VALUES[r - 1]; hits++; if (r === 5) jack++; }
    else if (r === RESULT_CENTRE) { paid += 10; hits++; jack++; }
  }
  rows.push({ power, payback: paid / N, hit: hits / N, jack: jack / N });
}

const mean = rows.reduce((a, r) => a + r.payback, 0) / rows.length;
const worst = rows.reduce((a, r) => (r.payback > a.payback ? r : a));
console.log(`speed ${speedMin}-${speedMax}  mean payback ${mean.toFixed(3)}`);
console.log(
  `worst strength ${worst.power.toFixed(3)}: payback ${worst.payback.toFixed(2)}, hit ${(100 * worst.hit).toFixed(0)}%, jackpot ${(100 * worst.jack).toFixed(0)}%`,
);
for (const r of rows) {
  const bar = '#'.repeat(Math.round(r.payback * 20));
  console.log(
    `${r.power.toFixed(3)}  ${r.payback.toFixed(2).padStart(5)}  ${(100 * r.jack).toFixed(0).padStart(3)}% jack  ${bar}`,
  );
}
