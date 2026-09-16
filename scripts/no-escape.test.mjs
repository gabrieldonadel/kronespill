// Every coin must end up somewhere inside the machine.
// Run: node --import ./scripts/register.mjs scripts/no-escape.test.mjs
//
// The board has no side channels: a coin pays out, joins a stack, or runs
// through to the cash box. This drops coins across the full width of the glass,
// at several stack profiles, and fails if any of them leaves the machine.
import {
  COL_BOTTOM, COL_COUNT, COL_MAX, RESULT_OVERFLOW, TUNE, resultColumn,
} from '../src/engine.ts';
import {
  UNITS_PER_METER, coinState, createBoard, stepBoard, syncStacks, RESULT_FLYING,
} from '../src/physics.ts';
import { Vec2 } from '../node_modules/planck/dist/planck.mjs';

const board = createBoard(TUNE);
const profiles = {
  'photo V': (i) => Math.min(COL_MAX, Math.round(6 + Math.abs(i - 8.5) * 0.72)),
  empty: () => 0,
  full: () => COL_MAX,
  'ragged': (i) => [0, 12, 3, 11, 1, 9, 12, 0, 7, 2, 12, 4, 0, 10, 12, 1, 6, 12][i],
};

let escaped = 0;
let checked = 0;
const outcomes = { hole: 0, tube: 0, cash: 0 };

for (const [name, fill] of Object.entries(profiles)) {
  syncStacks(board, Array.from({ length: COL_COUNT }, (_, i) => fill(i)));
  for (let x = 3; x <= 97; x += 1.5) {
    for (const vx of [-40, 0, 40]) {
      board.coin.setActive(true);
      board.coin.setTransform(new Vec2(x / UNITS_PER_METER, 42 / UNITS_PER_METER), 0);
      board.coin.setLinearVelocity(new Vec2(vx / UNITS_PER_METER, 0));
      board.coin.setAngularVelocity(0);
      board.coin.setAwake(true);
      board.t = 0;
      board.stall = 0;
      board.bankTime = 0;
      let r = RESULT_FLYING;
      for (let s = 0; s < 2400; s++) {
        r = stepBoard(board, 1 / 60);
        if (r !== RESULT_FLYING) break;
      }
      checked++;
      if (r > 0) outcomes.hole++;
      else if (r === RESULT_OVERFLOW) outcomes.cash++;
      else outcomes.tube++;

      const c = coinState(board);
      const out = c.y > COL_BOTTOM + 2 || c.x < 1 || c.x > 99;
      if (out) {
        escaped++;
        if (escaped <= 5) {
          console.log(
            `  ESCAPED on the ${name} profile: dropped at x=${x.toFixed(1)} vx=${vx}, ended at (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`,
          );
        }
      }
      if (r <= -2 && resultColumn(r) < 0) {
        console.log(`  bad tube index from result ${r}`);
        escaped++;
      }
    }
  }
}

console.log(
  `checked ${checked} drops across ${Object.keys(profiles).length} stack profiles`,
);
console.log(
  `  ${outcomes.hole} into holes, ${outcomes.tube} onto stacks, ${outcomes.cash} to the cash box`,
);
if (escaped === 0) {
  console.log('no coin left the machine');
} else {
  console.log(`${escaped} coin(s) left the machine`);
  process.exitCode = 1;
}
