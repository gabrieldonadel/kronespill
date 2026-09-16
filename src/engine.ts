/**
 * Board constants and tuning for the kronespill.
 *
 * Geometry is in board units: the glass playfield is 100 units wide and a
 * 1-krone coin is 4.4 units across, so one unit is 4.77 mm on the real cabinet.
 * Positions were measured off a photograph and a video of the machine.
 *
 * src/board.ts turns these into collision geometry, src/physics.ts solves it
 * with planck, and scripts/ run the same code in Node so the machine is
 * balanced and checked offline rather than by hand on a device.
 */

export const RESULT_FLYING = 0;
export const RESULT_LOST = -1;
// Any value >= 1 is a pocket index + 1.

export const COIN_R = 2.2;
/** One board unit in millimetres: a 21 mm krone is 4.4 units across. */
export const MM_PER_UNIT = 21 / COIN_R / 2;

/**
 * The cabinet hangs on the wall leaning back, so the coin runs on an inclined
 * plane and only feels g·sin(theta) along the board. The angle in the video is
 * around 18 degrees, which is what sets the pace of the whole game.
 */
export const INCLINE_DEG = 18;
export const G =
  ((9810 / MM_PER_UNIT) * Math.sin((INCLINE_DEG * Math.PI) / 180));
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
   * A hole is a slot in the backplate, behind the plane the coin rolls in. To
   * drop in, a coin has to line up with it in the depth axis a flat board does
   * not have. This is the rate, per second spent over a hole, at which that
   * alignment happens: a coin rolling quickly gets few chances, a coin that
   * stops over a hole eventually falls in. It is the machine's main economic
   * knob, and what keeps the charity ahead of the player.
   */
  enterRate: number;
  /** The starburst hole is tighter than the rest. */
  jackpotEnterScale: number;
  /** A coin bouncing high over the row cannot drop into anything. */
  rollBand: number;
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

  // Material properties of the board, searched the same way as the geometry.
  /** Air and backplate drag on the coin. */
  linDamp: number;
  /** Rolling resistance. */
  angDamp: number;
  railFric: number;
  railRest: number;
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
  railDrop: 3,
  railE: 0.7,
  impactHard: 5,
  hardFric: 0.95,
  softFric: 0.999,
  enterRate: 0.66,
  jackpotEnterScale: 0.45,
  rollBand: 1.6,
  lean: 12,
  speedMin: 230,
  speedMax: 330,
  leanJitter: 4,
  speedJitter: 0.06,
  linDamp: 0.02,
  angDamp: 0.04,
  railFric: 0.12,
  railRest: 0.7,
};

/** Height of the rail, and of a pocket mouth, at a given x. */
export function railY(x: number, railDrop: number): number {
  return SLOT_Y + (railDrop * Math.abs(x - 50)) / 45;
}

// ------------------------------------------------------------------ stepping

export function launchVelocity(
  power: number,
  tune: Tune = TUNE,
): { vx: number; vy: number } {
  const p = power < 0 ? 0 : power > 1 ? 1 : power;
  const spread = 1 + (Math.random() - 0.5) * tune.speedJitter;
  const speed = (tune.speedMin + (tune.speedMax - tune.speedMin) * p) * spread;
  const lean = tune.lean + (Math.random() - 0.5) * tune.leanJitter;
  const a = (lean * Math.PI) / 180;
  return { vx: -Math.sin(a) * speed, vy: -Math.cos(a) * speed };
}
