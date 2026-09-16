// Geometry validator. Run: node --import ./scripts/register.mjs scripts/check-board.mjs
//
// Finds gaps a 1-krone coin can enter but never leave. A coin wedges when a gap
// is narrower than the coin but wider than nothing, and no solver fixes that —
// it is a property of the board, and invisible until a coin sticks behind glass.
import { boardGeometry } from '../src/board.ts';
import {
  COIN_R, TUNE, SLOT_VALUES, SLOT_XS, RAIL_X_L, RAIL_X_R, WALL_L, WALL_R,
  POCKET_DEPTH, railY,
} from '../src/engine.ts';

const COIN_D = COIN_R * 2;
const FUSED = 0.6; // surfaces this close act as one obstacle
const { edges, pegs } = boardGeometry(TUNE);
const bad = [];

function pointSeg(px, py, e) {
  const ex = e.x2 - e.x1, ey = e.y2 - e.y1;
  const len2 = ex * ex + ey * ey;
  let u = len2 > 0 ? ((px - e.x1) * ex + (py - e.y1) * ey) / len2 : 0;
  u = Math.max(0, Math.min(1, u));
  return {
    d: Math.hypot(px - (e.x1 + ex * u), py - (e.y1 + ey * u)),
    x: e.x1 + ex * u,
    y: e.y1 + ey * u,
  };
}

// A coin only ever occupies the open field or the two drop channels; anything
// measured below the rail is inside the moulding.
const reachable = (x, y) => {
  const floor = railY(x, TUNE.railDrop);
  if (y < floor + 1) return true;
  return y < floor + POCKET_DEPTH + 2 && (x < RAIL_X_L || x > RAIL_X_R);
};

for (let i = 0; i < pegs.length; i++) {
  for (let j = i + 1; j < pegs.length; j++) {
    const a = pegs[i], b = pegs[j];
    const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (gap > FUSED && gap < COIN_D) {
      bad.push(`peg-peg gap ${gap.toFixed(2)} (need >${COIN_D}) between (${a.x},${a.y}) and (${b.x},${b.y})`);
    }
  }
}

for (const p of pegs) {
  for (const e of edges) {
    if (e.surface === 'arch') continue; // slivers behind the arch are sealed
    const gap = pointSeg(p.x, p.y, e).d - p.r;
    if (gap > FUSED && gap < COIN_D && reachable(p.x, p.y)) {
      bad.push(`peg-wall gap ${gap.toFixed(2)} at peg (${p.x},${p.y}) vs ${e.surface} (${e.x1.toFixed(1)},${e.y1.toFixed(1)})-(${e.x2.toFixed(1)},${e.y2.toFixed(1)})`);
    }
  }
}

for (let i = 0; i < edges.length; i++) {
  for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i], b = edges[j];
    if (a.surface === 'arch' || b.surface === 'arch') continue;
    if (a.surface === b.surface && a.surface === 'rail') continue; // one polyline
    let best = { d: Infinity, x: 0, y: 0 };
    for (const [p, e] of [[[a.x1, a.y1], b], [[a.x2, a.y2], b], [[b.x1, b.y1], a], [[b.x2, b.y2], a]]) {
      const hit = pointSeg(p[0], p[1], e);
      if (hit.d < best.d) best = { d: hit.d, x: p[0], y: p[1] };
    }
    if (best.d > FUSED && best.d < COIN_D && reachable(best.x, best.y)) {
      bad.push(`wall-wall gap ${best.d.toFixed(2)} between ${a.surface} and ${b.surface} near (${best.x.toFixed(1)},${best.y.toFixed(1)})`);
    }
  }
}

// A coin has to be able to sit over a hole long enough to line up with it.
SLOT_VALUES.forEach((v, k) => {
  const half = k === 4 ? TUNE.jackpotHalf : TUNE.slotHalf;
  if (half * 2 < COIN_D * 0.9) {
    bad.push(`hole ${k + 1} (pays ${v}) is only ${(half * 2).toFixed(2)} wide, under a coin`);
  }
  if (Math.abs(SLOT_XS[k] - 50) + half > (RAIL_X_R - RAIL_X_L) / 2 + 50 - 50) {
    // holes must sit on the rail, not past its ends
    if (SLOT_XS[k] - half < RAIL_X_L || SLOT_XS[k] + half > RAIL_X_R) {
      bad.push(`hole ${k + 1} hangs off the end of the rail`);
    }
  }
});

// The drop channel beside each rail end has to pass a coin, or misses jam.
[['left', RAIL_X_L - WALL_L], ['right', WALL_R - RAIL_X_R]].forEach(([side, w]) => {
  if (w <= COIN_D) bad.push(`${side} drop channel is only ${w.toFixed(2)} wide`);
});

if (bad.length === 0) {
  console.log(`board clean: ${pegs.length} pegs, ${edges.length} edges, 9 holes`);
} else {
  console.log(`${bad.length} problem(s):`);
  for (const b of bad) console.log('  ' + b);
  process.exitCode = 1;
}
