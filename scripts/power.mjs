// Checks that no flick strength beats the machine. Run: node scripts/power.mjs
import {
  step, launchVelocity, buildSegments, buildPegs, TUNE,
  LAUNCH_X, LAUNCH_Y, SLOT_VALUES, RESULT_FLYING, RESULT_LOST,
} from '../src/engine.ts';

const N = Number(process.argv[2] ?? 700);
const DT = 1 / 60;
const pegs = buildPegs();

function bandPayback(tune, segs, power) {
  let paid = 0, hits = 0;
  for (let i = 0; i < N; i++) {
    const { vx, vy } = launchVelocity(power, tune);
    const b = { x: LAUNCH_X, y: LAUNCH_Y, vx, vy, spin: 0, t: 0, stall: 0 };
    let r = RESULT_LOST;
    for (let f = 0; f < 2400; f++) {
      r = step(b, DT, segs, pegs, tune);
      if (r !== RESULT_FLYING) break;
    }
    if (r > 0) { paid += SLOT_VALUES[r - 1]; hits++; }
  }
  return { payback: paid / N, hit: hits / N };
}

console.log('sMin sMax  mean   worst band (payback)   profile');
for (const speedMin of [150, 200, 230, 260])
  for (const speedMax of [300, 330, 370]) {
    if (speedMin >= speedMax) continue;
    const tune = { ...TUNE, speedMin, speedMax };
    const segs = buildSegments(tune);
    const bands = [];
    for (let i = 0; i < 10; i++) bands.push(bandPayback(tune, segs, (i + 0.5) / 10));
    const mean = bands.reduce((a, b) => a + b.payback, 0) / bands.length;
    const worst = Math.max(...bands.map((b) => b.payback));
    console.log(
      `${String(speedMin).padStart(4)} ${String(speedMax).padStart(4)}  ${mean.toFixed(3)}  ${worst.toFixed(3)}   [${bands.map((b) => b.payback.toFixed(2)).join(' ')}]`,
    );
  }
