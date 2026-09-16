// Geometry validator: finds gaps a 1-krone coin can neither pass nor leave.
// A coin wedges when a gap is narrower than the coin but wider than nothing.
import { buildSegments, buildPegs, COIN_R, TUNE, SLOT_VALUES, railY } from '../src/engine.ts';

const COIN_D = COIN_R * 2;
const FUSED = 0.6; // surfaces this close act as one obstacle
const groups = [];
const segs = buildSegments(TUNE, groups);
const pegs = buildPegs();
const bad = [];

const pegAt = (i) => ({ x: pegs[i], y: pegs[i + 1], r: pegs[i + 2] });

for (let i = 0; i < pegs.length; i += 4) {
  const a = pegAt(i);
  for (let j = i + 4; j < pegs.length; j += 4) {
    const b = pegAt(j);
    const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (gap > FUSED && gap < COIN_D) {
      bad.push(
        `peg-peg gap ${gap.toFixed(2)} (need >${COIN_D}) between (${a.x},${a.y}) and (${b.x},${b.y})`,
      );
    }
  }
}

function segDist(px, py, i) {
  const x1 = segs[i], y1 = segs[i + 1];
  const ex = segs[i + 2] - x1, ey = segs[i + 3] - y1;
  const len2 = ex * ex + ey * ey;
  let u = len2 > 0 ? ((px - x1) * ex + (py - y1) * ey) / len2 : 0;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(px - (x1 + ex * u), py - (y1 + ey * u));
}

for (let i = 0; i < pegs.length; i += 4) {
  const a = pegAt(i);
  for (let j = 0; j < segs.length; j += 6) {
    const gap = segDist(a.x, a.y, j) - a.r;
    if (gap > FUSED && gap < COIN_D && reachable(a.x, a.y)) {
      bad.push(
        `peg-wall gap ${gap.toFixed(2)} (need >${COIN_D}) at peg (${a.x},${a.y}) vs seg (${segs[j]},${segs[j + 1]})-(${segs[j + 2]},${segs[j + 3]})`,
      );
    }
  }
}

// Segment pairs that are not joined at a corner.
function segSegDist(i, j) {
  let best = { d: Infinity, x: 0, y: 0 };
  for (const [a, b] of [[i, j], [j, i]]) {
    for (const k of [0, 2]) {
      const px = segs[a + k], py = segs[a + k + 1];
      const d = segDist(px, py, b);
      if (d < best.d) best = { d, x: px, y: py };
    }
  }
  return best;
}

// A coin only ever occupies the open field, a pocket mouth down to capture
// depth, or the two side channels. Structure under the pocket row is sealed.
function reachable(x, y) {
  const floor = railY(x, TUNE.railDrop);
  if (y < floor + 2.5) return true;
  return y < floor + 6 && (x < 7.7 || x > 92.3);
}
for (let i = 0; i < segs.length; i += 6) {
  for (let j = i + 6; j < segs.length; j += 6) {
    const shares =
      (segs[i] === segs[j] && segs[i + 1] === segs[j + 1]) ||
      (segs[i] === segs[j + 2] && segs[i + 1] === segs[j + 3]) ||
      (segs[i + 2] === segs[j] && segs[i + 3] === segs[j + 1]) ||
      (segs[i + 2] === segs[j + 2] && segs[i + 3] === segs[j + 3]);
    if (shares) continue;
    // Slivers sealed off by the arch are not reachable by a coin.
    if (groups[i / 6] === 'arch' || groups[j / 6] === 'arch') continue;
    // The pocket row is a solid moulding: the space measured between two of
    // its faces is inside the moulding. Mouth widths are asserted below.
    if (groups[i / 6] === 'slot' && groups[j / 6] === 'slot') continue;
    const hit = segSegDist(i, j);
    const gap = hit.d;
    if (gap > FUSED && gap < COIN_D && reachable(hit.x, hit.y)) {
      bad.push(
        `wall-wall gap ${gap.toFixed(2)} between (${segs[i].toFixed(1)},${segs[i + 1].toFixed(1)})-(${segs[i + 2].toFixed(1)},${segs[i + 3].toFixed(1)}) and (${segs[j].toFixed(1)},${segs[j + 1].toFixed(1)})-(${segs[j + 2].toFixed(1)},${segs[j + 3].toFixed(1)})`,
      );
    }
  }
}

// Every pocket mouth must clear a coin, or nothing can ever win.
SLOT_VALUES.forEach((v, k) => {
  const h = k === 4 ? TUNE.jackpotHalf : TUNE.slotHalf;
  const clear = 2 * h - COIN_D;
  if (clear <= 0.05) {
    bad.push(`pocket ${k + 1} (pays ${v}) mouth clears only ${clear.toFixed(2)}`);
  }
});

// The drop channel beside each end of the pocket rail has to pass a coin.
[['left', 7.6 - 2], ['right', 98 - 92.4]].forEach(([side, w]) => {
  if (w <= COIN_D) bad.push(`${side} drop channel is only ${w.toFixed(2)} wide`);
});

if (bad.length === 0) {
  console.log(`board clean: ${pegs.length / 4} pegs, ${segs.length / 6} segments`);
} else {
  console.log(`${bad.length} wedge risk(s):`);
  for (const b of bad) console.log('  ' + b);
  process.exitCode = 1;
}
