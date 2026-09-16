/**
 * Kronespill physics engine.
 *
 * Geometry is in board units: the glass playfield is 100 units wide and a
 * 1-krone coin is 4.4 units across, so one unit is roughly 4.8 mm on the real
 * cabinet. Positions were measured off a photograph of the machine.
 *
 * The same step() runs inside a Reanimated worklet on the phone and inside
 * scripts/*.mjs on a workstation, so the board is balanced and checked for
 * geometry faults offline rather than by hand on a device.
 */

export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  t: number;
  /** Seconds spent barely moving. Used to shake a jammed coin loose. */
  stall: number;
};

export const RESULT_FLYING = 0;
export const RESULT_LOST = -1;
// Any value >= 1 is a pocket index + 1.

export const COIN_R = 2.2;
export const G = 650;
export const SUBSTEPS = 6;
export const MAX_SPEED = 420;
export const MAX_FLIGHT = 14;

export const STALL_SPEED = 7;
export const STALL_NUDGE = 0.4;

// ------------------------------------------------------------- fixed geometry

export const GLASS_W = 100;
export const GLASS_H = 122;

export const WALL_L = 2;
export const WALL_R = 98;

/** Airbrushed arch that caps the open field. */
export const ARCH_CX = 50;
export const ARCH_CY = 40;
export const ARCH_RX = 48;
export const ARCH_RY = 34;

/** Nine crown pockets: 3 2 3 2 [10] 3 2 3 2, as painted on the cabinet. */
export const SLOT_VALUES = [3, 2, 3, 2, 10, 3, 2, 3, 2];
export const SLOT_XS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export const SLOT_Y = 44;
export const POCKET_DEPTH = 4.5;
export const CAPTURE_DEPTH = 2.5;
export const DRAIN_MARGIN = 1.5;

/** The rail carrying the pocket row stops here; past it lie the side channels. */
export const RAIL_X_L = 7.6;
export const RAIL_X_R = 92.4;

/** Black chevron rail and tube bank. Drawn only: see DRAIN below. */
export const CHEV_APEX_Y = 50.5;
export const CHEV_OUT_Y = 57;
export const CHEV_HALF_GAP = 3.6;
export const CHEV_OUT_X_L = 8.5;
export const CHEV_OUT_X_R = 91.5;

export const COL_TOP = 58;
export const COL_BOTTOM = 106;
export const COL_COUNT = 18;
export const COL_MAX = 12;

/** Launcher: the striped chute on the centre line. */
export const CHUTE_X = 50;
export const CHUTE_TOP = 54;
export const CHUTE_BOTTOM = 104;
export const LAUNCH_X = 50;
export const LAUNCH_Y = 41.5;

// -------------------------------------------------------------------- tuning

export type Tune = {
  /** Half width of a pocket mouth. A coin is 4.4 wide. */
  slotHalf: number;
  /** The jackpot mouth is tighter than the rest. */
  jackpotHalf: number;
  /** How far the pocket rail falls from the centre line to each end. */
  railDrop: number;
  /** Bounce of the pocket rail. */
  railE: number;
  /** Impacts above this are strikes; below it the coin is in sliding contact. */
  impactHard: number;
  /** Tangential speed kept on a strike. */
  hardFric: number;
  /** Tangential speed kept per substep of sliding contact. */
  softFric: number;
  /**
   * A coin only drops into a hole when it is not skating sideways. On the real
   * cabinet the coin rolls on edge and rides straight over a hole unless it is
   * nearly stopped above it. This is that effect in two dimensions.
   */
  vxCapture: number;
  /**
   * A coin also has to be dropping, not trickling along the rail. Together with
   * vxCapture this is the acceptance cone of a hole.
   */
  vyCapture: number;
  /** Flick lean off vertical, in degrees. Positive sends the coin left. */
  lean: number;
  speedMin: number;
  speedMax: number;
  /**
   * No two flicks of a spring flicker are identical. Without this the board has
   * narrow strengths that land the jackpot again and again, and the machine
   * stops being a gamble.
   */
  leanJitter: number;
  speedJitter: number;
};

/**
 * Balanced with scripts/grid.mjs and verified by scripts/sim.mjs. At these
 * values the machine returns about 0.80 kr per krone played, hits a pocket
 * roughly one flick in four, and no flick strength beats it (see
 * scripts/resonance.mjs). That is the shape of the real thing: the player wins
 * often enough to keep going, and the charity keeps the rest.
 */
export const TUNE: Tune = {
  slotHalf: 2.4,
  jackpotHalf: 2.28,
  railDrop: 1.5,
  railE: 0.7,
  impactHard: 5,
  hardFric: 0.95,
  softFric: 0.999,
  vxCapture: 18,
  vyCapture: 87,
  lean: 32,
  speedMin: 230,
  speedMax: 330,
  leanJitter: 4,
  speedJitter: 0.06,
};

/** Height of the rail, and of a pocket mouth, at a given x. */
export function railY(x: number, railDrop: number): number {
  'worklet';
  return SLOT_Y + (railDrop * Math.abs(x - 50)) / 45;
}

// ------------------------------------------------------------- collision set

export type SegGroup = 'wall' | 'arch' | 'slot';

/** Segments, stride 6: x1, y1, x2, y2, restitution, friction. */
export function buildSegments(
  tune: Tune = TUNE,
  groupsOut?: SegGroup[],
): number[] {
  const s: number[] = [];
  let group: SegGroup = 'wall';
  const push = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    e: number,
    f: number,
  ) => {
    s.push(x1, y1, x2, y2, e, f);
    if (groupsOut) groupsOut.push(group);
  };
  const ry = (x: number) => railY(x, tune.railDrop);
  const bottom = ry(WALL_L) + POCKET_DEPTH + DRAIN_MARGIN + 2;

  // Side rails, running past the pocket row into the drop channels.
  push(WALL_L, 4, WALL_L, bottom, 0.34, 0.9);
  push(WALL_R, 4, WALL_R, bottom, 0.34, 0.9);

  // Arch, sampled as a polyline the coin can chatter along.
  group = 'arch';
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a1 = Math.PI - (Math.PI * i) / N;
    const a2 = Math.PI - (Math.PI * (i + 1)) / N;
    push(
      ARCH_CX + ARCH_RX * Math.cos(a1),
      ARCH_CY - ARCH_RY * Math.sin(a1),
      ARCH_CX + ARCH_RX * Math.cos(a2),
      ARCH_CY - ARCH_RY * Math.sin(a2),
      0.16,
      0.99,
    );
  }

  // The row under the shields is a rail with a hole at each crown. A coin still
  // travelling rides across a hole; a slow one drops in.
  group = 'slot';
  let cursor = RAIL_X_L;
  for (let k = 0; k < SLOT_XS.length; k++) {
    const h = k === 4 ? tune.jackpotHalf : tune.slotHalf;
    const left = SLOT_XS[k] - h;
    const right = SLOT_XS[k] + h;
    push(cursor, ry(cursor), left, ry(left), tune.railE, 0.9);
    push(left, ry(left), left, ry(left) + POCKET_DEPTH, 0.2, 0.8);
    push(right, ry(right), right, ry(right) + POCKET_DEPTH, 0.2, 0.8);
    cursor = right;
  }
  push(cursor, ry(cursor), RAIL_X_R, ry(RAIL_X_R), tune.railE, 0.9);

  return s;
}

/**
 * Pins and bumpers, stride 4: x, y, radius, restitution.
 *
 * Spacing rule: every gap between two obstacles is either wider than a coin or
 * effectively closed. Anything in between is a wedge a coin can rest in
 * forever. The small screws flanking the bumpers on the real cabinet are drawn
 * rather than simulated for that reason. scripts/check-board.mjs enforces it.
 */
export function buildPegs(): number[] {
  const p: number[] = [];
  const push = (x: number, y: number, r: number, e: number) => {
    p.push(x, y, r, e);
  };

  // A chrome pin above every crown shield, which is what stops a coin dropping
  // straight into the hole it is aimed at. The jackpot keeps a clear approach,
  // exactly as on the cabinet, where the starburst fills that row.
  for (let k = 0; k < SLOT_XS.length; k++) {
    if (k === 4) continue;
    push(SLOT_XS[k], 39, 0.8, 0.44);
  }

  // The two large rubber bumpers.
  push(31, 27, 2.2, 0.72);
  push(73, 27, 2.2, 0.72);

  // Scattered pins in the open field.
  push(17, 33, 0.8, 0.44);
  push(83, 33, 0.8, 0.44);
  push(39, 22, 0.9, 0.44);
  push(61, 22, 0.9, 0.44);
  push(50, 14, 0.9, 0.44);

  return p;
}

export const SEGS = buildSegments();
export const PEGS = buildPegs();

// ------------------------------------------------------------------ stepping

export function launchVelocity(
  power: number,
  tune: Tune = TUNE,
): { vx: number; vy: number } {
  'worklet';
  const p = power < 0 ? 0 : power > 1 ? 1 : power;
  const spread = 1 + (Math.random() - 0.5) * tune.speedJitter;
  const speed = (tune.speedMin + (tune.speedMax - tune.speedMin) * p) * spread;
  const lean = tune.lean + (Math.random() - 0.5) * tune.leanJitter;
  const a = (lean * Math.PI) / 180;
  return { vx: -Math.sin(a) * speed, vy: -Math.cos(a) * speed };
}

/**
 * Advances the coin by dt seconds. Returns RESULT_FLYING, RESULT_LOST, or
 * pocket index + 1.
 */
export function step(
  b: Ball,
  dt: number,
  segs: number[] = SEGS,
  pegs: number[] = PEGS,
  tune: Tune = TUNE,
): number {
  'worklet';
  const h = dt / SUBSTEPS;

  for (let s = 0; s < SUBSTEPS; s++) {
    b.vy += G * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.t += h;
    b.spin += b.vx * h * 6;

    // Pins and bumpers.
    for (let i = 0; i < pegs.length; i += 4) {
      const px = pegs[i];
      const py = pegs[i + 1];
      const sum = pegs[i + 2] + COIN_R;
      const dx = b.x - px;
      const dy = b.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 >= sum * sum) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d;
      const ny = dy / d;
      b.x = px + nx * sum;
      b.y = py + ny * sum;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        // Friction only bites on a real strike. A coin in sliding contact has
        // to keep its tangential speed, or it welds itself to the pin.
        const hard = -vn > tune.impactHard;
        const f = hard ? tune.hardFric : tune.softFric;
        const e = pegs[i + 3] * (hard ? 1 : 0.4);
        const tx = b.vx - vn * nx;
        const ty = b.vy - vn * ny;
        // A little scatter keeps repeat launches from tracing one path.
        const j = (Math.random() - 0.5) * (hard ? 6 : 1.4);
        b.vx = tx * f - e * vn * nx - ny * j;
        b.vy = ty * f - e * vn * ny + nx * j;
        b.spin += j * 2;
      }
    }

    // Side rails, arch and the pocket row.
    for (let i = 0; i < segs.length; i += 6) {
      const x1 = segs[i];
      const y1 = segs[i + 1];
      const ex = segs[i + 2] - x1;
      const ey = segs[i + 3] - y1;
      const len2 = ex * ex + ey * ey;
      let u = len2 > 0 ? ((b.x - x1) * ex + (b.y - y1) * ey) / len2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const cx = x1 + ex * u;
      const cy = y1 + ey * u;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= COIN_R * COIN_R) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d;
      const ny = dy / d;
      b.x = cx + nx * COIN_R;
      b.y = cy + ny * COIN_R;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        const hard = -vn > tune.impactHard;
        const e = segs[i + 4] * (hard ? 1 : 0.4);
        const f = hard ? segs[i + 5] : tune.softFric;
        const tx = b.vx - vn * nx;
        const ty = b.vy - vn * ny;
        b.vx = tx * f - e * vn * nx;
        b.vy = ty * f - e * vn * ny;
      }
    }

    // Speed clamp keeps the discrete collision pass from tunnelling.
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > MAX_SPEED) {
      b.vx = (b.vx / sp) * MAX_SPEED;
      b.vy = (b.vy / sp) * MAX_SPEED;
    }

    // A coin balanced on a pin gets the same treatment a real one gets: the
    // cabinet is never perfectly still.
    if (sp < STALL_SPEED) {
      b.stall += h;
      if (b.stall > STALL_NUDGE) {
        b.stall = 0;
        b.vx += (Math.random() - 0.5) * 34;
        b.vy -= 6;
        b.t += 0.3;
      }
    } else {
      b.stall = 0;
    }

    const floor = railY(b.x, tune.railDrop);
    if (b.vy > tune.vyCapture && Math.abs(b.vx) < tune.vxCapture) {
      for (let k = 0; k < SLOT_XS.length; k++) {
        const c = SLOT_XS[k];
        const top = railY(c, tune.railDrop);
        const half = k === 4 ? tune.jackpotHalf : tune.slotHalf;
        if (
          b.y > top + CAPTURE_DEPTH &&
          b.y < top + POCKET_DEPTH + 0.5 &&
          Math.abs(b.x - c) < half
        ) {
          return k + 1;
        }
      }
    }
    if (b.y > floor + POCKET_DEPTH + DRAIN_MARGIN) return RESULT_LOST;
    if (b.t > MAX_FLIGHT) return RESULT_LOST;
  }

  return RESULT_FLYING;
}
