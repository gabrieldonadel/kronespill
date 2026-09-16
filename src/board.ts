/**
 * The one description of the board's collision geometry.
 *
 * planck builds its fixtures from this, the renderer draws the rails from it,
 * and scripts/check-board.mjs validates it. Keeping a single source is what
 * stops the picture drifting away from what the coin actually hits.
 */
import {
  ARCH_CX,
  ARCH_CY,
  ARCH_RX,
  ARCH_RY,
  CEIL_APEX_X,
  CEIL_APEX_Y,
  CEIL_LIFT_X,
  CHANNEL_INNER_X,
  CHANNEL_MOUTH_Y,
  CHANNEL_TURN_Y,
  POCKET_DEPTH,
  RAIL_X_L,
  RAIL_X_R,
  RAMP_APEX_Y,
  RAMP_OUT_Y,
  RAMP_X_L,
  RAMP_X_R,
  CENTRE_GAP,
  TUNE,
  TURN_CX,
  TURN_CY,
  TURN_R_IN,
  TURN_R_OUT,
  WALL_L,
  WALL_R,
  railY,
  type Tune,
} from './engine';

export type Surface = 'pin' | 'bumper' | 'arch' | 'wall' | 'rail' | 'guide' | 'ramp';

export type BoardEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  surface: Surface;
};

export type BoardPeg = { x: number; y: number; r: number; surface: Surface };

export const ARCH_SEGMENTS = 26;
export const RAIL_SEGMENTS = 12;
export const TURN_SEGMENTS = 9;

/**
 * Pins and bumpers.
 *
 * Spacing rule: every gap between two obstacles is either wider than a coin
 * (4.4 units) or effectively closed. Anything in between is a wedge a coin can
 * rest in forever. The small screws flanking the bumpers on the real cabinet,
 * and the extra pins above each crown, are drawn rather than simulated for
 * that reason. scripts/check-board.mjs enforces it.
 */
export function boardPegs(): BoardPeg[] {
  const pegs: BoardPeg[] = [];
  const pin = (x: number, y: number, r: number): BoardPeg => ({
    x,
    y,
    r,
    surface: 'pin',
  });

  // A chrome pin above every crown shield, which is what stops a coin dropping
  // straight into the hole it was aimed at. The jackpot keeps a clear approach,
  // as on the cabinet, where the starburst fills that row.
  // No pin above the ninth shield: the launch channel takes that corner, and a
  // pin there would leave a gap too narrow for a coin to pass or escape.
  for (const c of [10, 20, 30, 40, 60, 70, 80]) pegs.push(pin(c, 39, 0.8));

  // The two large rubber bumpers.
  pegs.push({ x: 31, y: 27, r: 2.2, surface: 'bumper' });
  pegs.push({ x: 73, y: 27, r: 2.2, surface: 'bumper' });

  // Scattered pins in the open field. The centre band stays clear so the flick
  // has a way out of the chute.
  pegs.push(pin(17, 33, 0.8));
  pegs.push(pin(83, 33, 0.8));
  pegs.push(pin(39, 22, 0.9));
  pegs.push(pin(61, 22, 0.9));
  pegs.push(pin(50, 14, 0.9));

  return pegs;
}

export function boardEdges(tune: Tune = TUNE): BoardEdge[] {
  const edges: BoardEdge[] = [];
  const add = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    surface: Surface,
  ) => edges.push({ x1, y1, x2, y2, surface });
  const ry = (x: number) => railY(x, tune.railDrop);

  // Side rails. They stop where the ramp meets them: there is no way out of
  // the field at the sides, only down into the tubes or the middle chute.
  add(WALL_L, 4, WALL_L, RAMP_OUT_Y, 'wall');
  // Above the channel head the outer boundary is the guide's own lip.
  add(WALL_R, CHANNEL_TURN_Y, WALL_R, RAMP_OUT_Y, 'wall');

  // The V under the holes, closing the field and running coins inward.
  add(RAMP_X_L, RAMP_OUT_Y, 50 - CENTRE_GAP, RAMP_APEX_Y, 'ramp');
  add(50 + CENTRE_GAP, RAMP_APEX_Y, RAMP_X_R, RAMP_OUT_Y, 'ramp');

  // Launch channel down the right edge. The outer side is the board's own
  // rail; this is the inner wall and the quarter turn at its head.
  add(CHANNEL_INNER_X, CHANNEL_MOUTH_Y, CHANNEL_INNER_X, CHANNEL_TURN_Y, 'guide');
  for (let i = 0; i < TURN_SEGMENTS; i++) {
    const t1 = (Math.PI / 2) * (i / TURN_SEGMENTS);
    const t2 = (Math.PI / 2) * ((i + 1) / TURN_SEGMENTS);
    // Outer lip, carrying the coin over the top of the turn.
    add(
      TURN_CX + TURN_R_OUT * Math.cos(t1),
      TURN_CY - TURN_R_OUT * Math.sin(t1),
      TURN_CX + TURN_R_OUT * Math.cos(t2),
      TURN_CY - TURN_R_OUT * Math.sin(t2),
      'guide',
    );
    // Inner lip.
    add(
      TURN_CX + TURN_R_IN * Math.cos(t1),
      TURN_CY - TURN_R_IN * Math.sin(t1),
      TURN_CX + TURN_R_IN * Math.cos(t2),
      TURN_CY - TURN_R_IN * Math.sin(t2),
      'guide',
    );
  }

  // Ceiling: shallow from the release point across the top, then the airbrushed
  // arch down the left side of the field.
  add(TURN_CX, TURN_CY - TURN_R_OUT, CEIL_LIFT_X, CEIL_APEX_Y, 'arch');
  add(CEIL_LIFT_X, CEIL_APEX_Y, CEIL_APEX_X, CEIL_APEX_Y, 'arch');
  for (let i = 0; i < ARCH_SEGMENTS; i++) {
    const span = Math.PI / 2;
    const a1 = Math.PI - (span * i) / ARCH_SEGMENTS;
    const a2 = Math.PI - (span * (i + 1)) / ARCH_SEGMENTS;
    add(
      ARCH_CX + ARCH_RX * Math.cos(a1),
      ARCH_CY - ARCH_RY * Math.sin(a1),
      ARCH_CX + ARCH_RX * Math.cos(a2),
      ARCH_CY - ARCH_RY * Math.sin(a2),
      'arch',
    );
  }

  // The rail under the shields is unbroken: the coin rolls along it in front of
  // the panel, and the winning holes are slots behind that plane. Whether a
  // coin drops into one is decided by alignment, not by a gap in the floor.
  for (let i = 0; i < RAIL_SEGMENTS; i++) {
    const x1 = RAIL_X_L + ((RAIL_X_R - RAIL_X_L) * i) / RAIL_SEGMENTS;
    const x2 = RAIL_X_L + ((RAIL_X_R - RAIL_X_L) * (i + 1)) / RAIL_SEGMENTS;
    add(x1, ry(x1), x2, ry(x2), 'rail');
  }

  return edges;
}

export function boardGeometry(tune: Tune = TUNE) {
  return { edges: boardEdges(tune), pegs: boardPegs() };
}
