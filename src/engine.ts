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

/**
 * How a round can end.
 *
 *   > 0             a winning hole, index + 1
 *   RESULT_FLYING   still in play
 *   RESULT_OVERFLOW down the middle, into the cash box behind the tubes
 *   <= -2           a coin tube, see columnResult / resultColumn
 *
 * A coin is never simply lost: it pays out, joins one of the stacks, or goes to
 * the cash box when the stacks have no room left.
 *
 * The explainer this board was built from has the middle paying 10 once every
 * tube is full. It cannot: a full machine would then pay 10 on two thirds of
 * all plays, which measured out at 1.23 kr returned per krone. The 10 the
 * cabinet actually pays is the starburst hole in the middle of the row, and
 * the middle chute is the run that carries paid coins to the bowl.
 */
export const RESULT_FLYING = 0;
export const RESULT_OVERFLOW = -1;
export const columnResult = (k: number) => -2 - k;
export const resultColumn = (r: number) => (r <= -2 ? -(r + 2) : -1);

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
export const ARCH_RY = 38.4;

/** Nine crown pockets: 3 2 3 2 [10] 3 2 3 2, as painted on the cabinet. */
export const SLOT_VALUES = [3, 2, 3, 2, 10, 3, 2, 3, 2];
export const SLOT_XS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export const SLOT_Y = 44;
export const POCKET_DEPTH = 4.5;
export const CAPTURE_DEPTH = 2.5;

/**
 * A coin that misses every hole falls onto the tops of the coin stacks and runs
 * along them. The stacks stand highest at the outside, so it runs inward and
 * settles into the lowest one with room. When every tube is full the surface is
 * level all the way to the middle, and the coin runs on into the payout chute,
 * which pays the jackpot.
 */
/** A coin this slow on the stacks has settled. */
export const SETTLE_SPEED = 24;

/**
 * The tube bank is narrower than the glass, so each side of the field funnels
 * into it: a short steep skirt from the side rail down to the head of the
 * outermost tube. Without them a coin coming down at the edge falls past the
 * bank entirely. These are the outer ends of the black rail on the cabinet.
 */
export const SKIRT_TOP_Y = 50;

/** How far the top coin of a stack crowns above the tube's shoulders. */
export const STACK_CROWN = 0.55;

/** The rail carrying the pocket row stops here; past it lie the side channels. */
export const RAIL_X_L = 7.6;
export const RAIL_X_R = 92.4;

export const COL_TOP = 58;
export const COL_BOTTOM = 106;
export const COL_COUNT = 18;
export const COL_MAX = 12;

/**
 * The tube bank: nine tubes, the payout chute, then nine more. Coins stack in a
 * tube this far apart, overlapping as they do on the cabinet.
 */
export const CHUTE_W = 4.7;
export const STACK_PITCH = 3.6;
export const TUBE_PITCH = (RAIL_X_R - RAIL_X_L - CHUTE_W) / COL_COUNT;
export const CHUTE_X0 = RAIL_X_L + (COL_COUNT / 2) * TUBE_PITCH;
export const CHUTE_X1 = CHUTE_X0 + CHUTE_W;

/** Left edge of a tube. */
export function tubeLeft(i: number): number {
  const base = RAIL_X_L + i * TUBE_PITCH;
  return i < COL_COUNT / 2 ? base : base + CHUTE_W;
}

export const tubeX = (i: number) => tubeLeft(i) + TUBE_PITCH / 2;

/**
 * Height of the surface a coin rests on in a tube: the top of the stack, or the
 * tube floor when it is empty. This is what coins roll along — there is no ramp
 * under the holes, the stacks themselves are the floor.
 */
export function stackTopY(count: number): number {
  if (count <= 0) return COL_BOTTOM - 0.3;
  return COL_BOTTOM - 0.3 - (count - 1) * STACK_PITCH - COIN_R;
}

/**
 * Launcher. The coin is flicked up the channel down the right edge of the
 * glass, rounds the guide at the top right, and is released heading left along
 * the ceiling — so a harder flick carries it further across the board. The
 * black cover over that channel is visible on the right of the cabinet in both
 * the photograph and the video.
 */
export const CHANNEL_INNER_X = 92.5;
export const CHANNEL_MOUTH_Y = 40;
export const CHANNEL_TURN_Y = 14;
/** Centre of the quarter turn at the head of the channel. */
export const TURN_CX = 86;
export const TURN_CY = 17;
export const TURN_R_OUT = 12;
export const TURN_R_IN = 6.5;
/** Where the guide lets go of the coin. */
export const RELEASE_X = TURN_CX;
export const RELEASE_Y = TURN_CY - (TURN_R_OUT + TURN_R_IN) / 2;

export const LAUNCH_X = (CHANNEL_INNER_X + 98) / 2 + 0.2;
export const LAUNCH_Y = 37;

/** Ceiling: shallow across the top, steepening down the left side. */
/** The ceiling lifts away from the guide's lip so the released coin has air. */
export const CEIL_LIFT_X = 76;
export const CEIL_APEX_X = 50;
export const CEIL_APEX_Y = 1.6;

/**
 * The striped strip up the middle of the tube bank, with the starred crown at
 * its head. It is the payout run: coins pushed out of the tubes travel down it
 * to the bowl. It is drawn, not simulated.
 */
export const PAYOUT_CHUTE_X = 50;
export const PAYOUT_CHUTE_TOP = 54;
export const PAYOUT_CHUTE_BOTTOM = 104;

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
  /** Flick lean off vertical, in degrees. The channel holds the coin, so this
   * is only the wobble a spring flicker gives it. */
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
  enterRate: 0.69,
  jackpotEnterScale: 0.45,
  rollBand: 1.6,
  lean: 0,
  speedMin: 228,
  speedMax: 312,
  leanJitter: 2.5,
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
