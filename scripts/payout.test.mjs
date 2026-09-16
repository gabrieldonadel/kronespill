// Run: node --import ./scripts/register.mjs scripts/payout.test.mjs
import { COL_COUNT, COL_MAX } from '../src/engine.ts';
import { keepPlayed, takeOne, tubesBehind } from '../src/payout.ts';

let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) { failures++; console.log(`  FAIL ${name} ${extra}`); }
  else console.log(`  ok   ${name}`);
};

const full = () => new Array(COL_COUNT).fill(6);
const sum = (a) => a.reduce((x, y) => x + y, 0);

// A win of three pays three coins out of the stock behind the hole.
let t = full();
for (let i = 0; i < 3; i++) t = takeOne(t, 8);
check('a 3 kr win removes 3 coins from the stock', sum(t) === sum(full()) - 3, `got ${sum(t)}`);
check('it draws only from the two tubes behind the hole',
  t.every((n, i) => (tubesBehind(8).includes(i) ? n < 6 : n === 6)));

// A jackpot of ten, paid from two tubes holding six each.
t = full();
for (let i = 0; i < 10; i++) t = takeOne(t, 8);
const [a, b] = tubesBehind(8);
check('a 10 kr jackpot empties evenly', Math.abs(t[a] - t[b]) <= 1, `${t[a]} vs ${t[b]}`);
check('a jackpot removes 10 coins', sum(t) === sum(full()) - 10, `got ${sum(t)}`);

// Empty tubes never go negative, however many wins land on them.
t = new Array(COL_COUNT).fill(0);
for (let i = 0; i < 25; i++) t = takeOne(t, 3);
check('an empty stack never goes negative', t.every((n) => n === 0));

// The coin played is kept, and a full tube does not overflow.
t = full();
check('the coin played is kept', sum(keepPlayed(t, 5)) === sum(t) + 1);
t = new Array(COL_COUNT).fill(COL_MAX);
check('a full tube does not overflow', sum(keepPlayed(t, 5)) === sum(t));

// Tube indices behind the first and last holes stay in range.
check('tube indices stay in range',
  tubesBehind(-2).every((i) => i >= 0 && i < COL_COUNT) &&
  tubesBehind(COL_COUNT + 4).every((i) => i >= 0 && i < COL_COUNT));

console.log(failures === 0 ? '\npayout accounting: all checks passed' : `\n${failures} failed`);
process.exitCode = failures ? 1 : 0;
