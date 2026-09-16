/**
 * Where a win's coins come from.
 *
 * On the cabinet a win is paid out of the stock standing in the tubes behind
 * that hole: coins are pushed out of the bottom one at a time and the stack
 * steps down. The coin just played is always kept. This is that accounting,
 * kept pure so it can be tested without a device.
 */
import { COL_COUNT, COL_MAX } from './engine';

/** The two tubes behind a hole. */
export function tubesBehind(dropTube: number): [number, number] {
  const a = Math.max(0, Math.min(COL_COUNT - 1, dropTube));
  const b = Math.max(0, Math.min(COL_COUNT - 1, dropTube + 1));
  return [a, b];
}

/** Takes one coin from the fuller of the two tubes behind a hole. */
export function takeOne(tubes: number[], dropTube: number): number[] {
  const [a, b] = tubesBehind(dropTube);
  const from = tubes[a] >= tubes[b] ? a : b;
  if (tubes[from] <= 0) return tubes;
  const next = [...tubes];
  next[from] -= 1;
  return next;
}

/** Adds the coin played to the machine's stock. */
export function keepPlayed(tubes: number[], dropTube: number): number[] {
  const next = [...tubes];
  const i = Math.max(0, Math.min(COL_COUNT - 1, dropTube));
  next[i] = Math.min(COL_MAX, next[i] + 1);
  return next;
}
