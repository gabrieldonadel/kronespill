/**
 * The board, solved by planck.js (a TypeScript rewrite of Box2D).
 *
 * The coin is a disc with real angular dynamics, so it rolls along the rail and
 * spins off the pins the way a krone does behind the glass. Contact impulses
 * come out of the solver, which is what drives the impact sounds.
 *
 * This module is the only place that knows about planck. It runs unchanged in
 * Hermes and in Node, so scripts/ can still balance the machine offline.
 */
import { Circle, Edge, Vec2, World, type Body, type Contact } from 'planck';

import { boardGeometry, type Surface } from './board';
import {
  COIN_R,
  DRAIN_MARGIN,
  G,
  LAUNCH_X,
  LAUNCH_Y,
  MAX_FLIGHT,
  POCKET_DEPTH,
  RESULT_FLYING,
  RESULT_LOST,
  SLOT_XS,
  STALL_NUDGE,
  STALL_SPEED,
  TUNE,
  launchVelocity,
  railY,
  type Tune,
} from './engine';

/**
 * Board units per physics metre. Box2D is tuned for bodies roughly 0.1 to 10 m
 * across; at this scale the coin is a 0.22 m disc and the board is 10 m wide,
 * which keeps the solver's slop (5 mm) far below the tightest pocket clearance.
 */
export const UNITS_PER_METER = 10;
const m = (u: number) => u / UNITS_PER_METER;
const u = (mm: number) => mm * UNITS_PER_METER;

/** Coin on steel, coin on rubber, coin on painted wood. */
const MATERIAL: Record<Surface, { friction: number; restitution: number }> = {
  pin: { friction: 0.25, restitution: 0.62 },
  bumper: { friction: 0.3, restitution: 0.72 },
  arch: { friction: 0.2, restitution: 0.2 },
  wall: { friction: 0.25, restitution: 0.3 },
  rail: { friction: 0.35, restitution: 0.45 },
  // The launch channel and its turn: polished metal, so the coin keeps speed.
  guide: { friction: 0.08, restitution: 0.25 },
};

const COIN_FRICTION = 0.32;
const COIN_RESTITUTION = 0.12;

export type Board = {
  world: World;
  coin: Body;
  tune: Tune;
  /** Seconds since launch. */
  t: number;
  stall: number;
  /** Largest contact impulse since the last read, and what it struck. */
  loudest: number;
  loudestOn: Surface | null;
};

function addEdge(
  ground: Body,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  surface: Surface,
  tune: Tune,
) {
  const mat =
    surface === 'rail'
      ? { friction: tune.railFric, restitution: tune.railRest }
      : MATERIAL[surface];
  ground.createFixture({
    shape: new Edge(new Vec2(m(x1), m(y1)), new Vec2(m(x2), m(y2))),
    ...mat,
    userData: surface,
  });
}

export function createBoard(tune: Tune = TUNE): Board {
  const world = new World({ gravity: new Vec2(0, m(G)) });
  const ground = world.createBody({ type: 'static' });
  const { edges, pegs } = boardGeometry(tune);

  for (const e of edges) addEdge(ground, e.x1, e.y1, e.x2, e.y2, e.surface, tune);
  for (const p of pegs) {
    ground.createFixture({
      shape: new Circle(new Vec2(m(p.x), m(p.y)), m(p.r)),
      ...MATERIAL[p.surface],
      userData: p.surface,
    });
  }

  const coin = world.createBody({
    type: 'dynamic',
    position: new Vec2(m(LAUNCH_X), m(LAUNCH_Y)),
    bullet: true, // continuous collision: the flick is fast enough to tunnel
    linearDamping: tune.linDamp,
    angularDamping: tune.angDamp,
  });
  coin.createFixture({
    shape: new Circle(m(COIN_R)),
    density: 1,
    friction: COIN_FRICTION,
    restitution: COIN_RESTITUTION,
    userData: 'coin',
  });
  coin.setActive(false);

  const board: Board = {
    world,
    coin,
    tune,
    t: 0,
    stall: 0,
    loudest: 0,
    loudestOn: null,
  };

  // Impact strength straight out of the solver, for sound and haptics.
  world.on('post-solve', (contact: Contact, impulse) => {
    let peak = 0;
    for (const j of impulse.normalImpulses) peak = Math.max(peak, Math.abs(j));
    if (peak <= board.loudest) return;
    const a = contact.getFixtureA().getUserData() as string;
    const b = contact.getFixtureB().getUserData() as string;
    const other = (a === 'coin' ? b : a) as Surface;
    board.loudest = peak;
    board.loudestOn = other ?? null;
  });

  return board;
}

export function launchBoard(board: Board, power: number) {
  const { vx, vy } = launchVelocity(power, board.tune);
  board.coin.setActive(true);
  board.coin.setTransform(new Vec2(m(LAUNCH_X), m(LAUNCH_Y)), 0);
  board.coin.setLinearVelocity(new Vec2(m(vx), m(vy)));
  board.coin.setAngularVelocity(0);
  board.coin.setAwake(true);
  board.t = 0;
  board.stall = 0;
  board.loudest = 0;
  board.loudestOn = null;
}

export function coinState(board: Board) {
  const p = board.coin.getPosition();
  const v = board.coin.getLinearVelocity();
  return {
    x: u(p.x),
    y: u(p.y),
    vx: u(v.x),
    vy: u(v.y),
    /** Degrees, for the rendered sprite. */
    angle: (board.coin.getAngle() * 180) / Math.PI,
  };
}

/** Fixed solver tick. Small enough that a 33 m/s coin moves under 20 cm. */
const FIXED_DT = 1 / 180;

/**
 * Advances the board. Returns RESULT_FLYING, RESULT_LOST, or pocket index + 1.
 */
export function stepBoard(board: Board, dt: number): number {
  const total = Math.max(FIXED_DT, Math.min(dt, 1 / 20));
  const steps = Math.max(1, Math.round(total / FIXED_DT));
  const { tune } = board;

  for (let s = 0; s < steps; s++) {
    board.world.step(FIXED_DT);
    board.t += FIXED_DT;

    const p = board.coin.getPosition();
    const v = board.coin.getLinearVelocity();
    const x = u(p.x);
    const y = u(p.y);
    const vx = u(v.x);
    const vy = u(v.y);

    // A coin balanced on a pin gets the same treatment a real one gets: the
    // cabinet is never perfectly still.
    if (Math.hypot(vx, vy) < STALL_SPEED) {
      board.stall += FIXED_DT;
      if (board.stall > STALL_NUDGE) {
        board.stall = 0;
        board.coin.setAwake(true);
        board.coin.applyLinearImpulse(
          new Vec2(
            m((Math.random() - 0.5) * 34) * board.coin.getMass(),
            m(-6) * board.coin.getMass(),
          ),
          board.coin.getWorldCenter(),
          true,
        );
        board.t += 0.3;
      }
    } else {
      board.stall = 0;
    }

    // Rolling over a hole: one alignment chance per tick spent over it.
    const floor = railY(x, tune.railDrop);
    if (y > floor - COIN_R * tune.rollBand && y < floor + COIN_R) {
      for (let k = 0; k < SLOT_XS.length; k++) {
        const half = k === 4 ? tune.jackpotHalf : tune.slotHalf;
        if (Math.abs(x - SLOT_XS[k]) >= half) continue;
        const rate = tune.enterRate * (k === 4 ? tune.jackpotEnterScale : 1);
        if (Math.random() < rate * FIXED_DT) return k + 1;
      }
    }

    if (y > floor + POCKET_DEPTH + DRAIN_MARGIN) return RESULT_LOST;
    if (board.t > MAX_FLIGHT) return RESULT_LOST;
  }

  return RESULT_FLYING;
}

/** Reads and clears the loudest impact since the last call. */
export function takeImpact(board: Board): { strength: number; on: Surface | null } {
  const out = { strength: board.loudest, on: board.loudestOn };
  board.loudest = 0;
  board.loudestOn = null;
  return out;
}

export { RESULT_FLYING, RESULT_LOST };
