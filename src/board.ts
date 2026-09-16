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
  CHUTE_X0,
  CHUTE_X1,
  SKIRT_TOP_Y,
  STACK_CROWN,
  COL_BOTTOM,
  COL_TOP,
  COL_COUNT,
  COL_MAX,
  TUBE_PITCH,
  stackTopY,
  tubeLeft,
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

export type Surface =
  | 'pin'
  | 'bumper'
  | 'arch'
  | 'wall'
  | 'rail'
  | 'guide'
  | 'chute'
  | 'stack';

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

  // Side rails, running all the way down past the tube bank. There is no way
  // out of the field at the sides: a coin either pays out or joins a stack.
  add(WALL_L, 4, WALL_L, COL_BOTTOM, 'wall');
  // Above the channel head the outer boundary is the guide's own lip.
  add(WALL_R, CHANNEL_TURN_Y, WALL_R, COL_BOTTOM, 'wall');

  // Each side of the field funnels into the bank: a skirt down from the side
  // rail to the bank's shoulder, then the outer wall of the end tube. Without
  // them a coin coming down at the edge falls past the tubes altogether.
  add(WALL_L, SKIRT_TOP_Y, tubeLeft(0), COL_TOP - 0.5, 'chute');
  add(tubeLeft(0), COL_TOP - 0.5, tubeLeft(0), COL_BOTTOM, 'chute');
  const bankRight = tubeLeft(COL_COUNT - 1) + TUBE_PITCH;
  add(WALL_R, SKIRT_TOP_Y, bankRight, COL_TOP - 0.5, 'chute');
  add(bankRight, COL_TOP - 0.5, bankRight, COL_BOTTOM, 'chute');

  // Walls of the payout chute. Its mouth is level with the tops of the tubes,
  // so a coin can only run into it across stacks that are full.
  add(CHUTE_X0, COL_TOP + 4, CHUTE_X0, COL_BOTTOM, 'chute');
  add(CHUTE_X1, COL_TOP + 4, CHUTE_X1, COL_BOTTOM, 'chute');

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

/**
 * The surface a coin runs on in the tube bank.
 *
 * This is one unbroken wall: the top of each stack, a riser wherever the stack
 * beside it stands higher, and a skirt at each end funnelling in from the side
 * rail. Leave any of those out and a coin slips underneath a shelf or past the
 * outermost tube and falls out of the machine. Rebuilt whenever a stack
 * changes, which is once a round.
 */
export function stackShelves(counts: number[]): BoardEdge[] {
  const out: BoardEdge[] = [];
  const top = (i: number) => stackTopY(Math.min(counts[i] ?? 0, COL_MAX));
  const push = (x1: number, y1: number, x2: number, y2: number) =>
    out.push({ x1, y1, x2, y2, surface: 'stack' });

  for (let i = 0; i < COL_COUNT; i++) {
    const left = tubeLeft(i);
    const y = top(i);
    // The top of a stack is the curve of a coin, not a flat shelf. Rolling
    // over that scallop is what stops a coin running the length of the bank.
    push(left, y, left + TUBE_PITCH / 2, y - STACK_CROWN);
    push(left + TUBE_PITCH / 2, y - STACK_CROWN, left + TUBE_PITCH, y);

    // Riser between neighbouring stacks of different heights.
    const nextI = i + 1;
    if (nextI < COL_COUNT) {
      const nextLeft = tubeLeft(nextI);
      if (nextLeft === left + TUBE_PITCH && top(nextI) !== y) {
        push(nextLeft, y, nextLeft, top(nextI));
      }
    }
  }

  // Risers against the payout chute, so a coin cannot slip in from the side.
  push(CHUTE_X0, top(COL_COUNT / 2 - 1), CHUTE_X0, COL_TOP + 4);
  push(CHUTE_X1, top(COL_COUNT / 2), CHUTE_X1, COL_TOP + 4);

  return out;
}

export function boardGeometry(tune: Tune = TUNE) {
  return { edges: boardEdges(tune), pegs: boardPegs() };
}
