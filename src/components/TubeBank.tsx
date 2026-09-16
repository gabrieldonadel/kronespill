import React from 'react';
import { View } from 'react-native';

import { COIN_R, STACK_PITCH, TUBE_PITCH, stackTopY, tubeX } from '../engine';
import { Coin } from './Coin';

/**
 * One tube of coin stock. Memoised on its own count, so paying a win out of one
 * tube does not re-render the whole bank.
 */
const Tube = React.memo(function Tube({
  index,
  count,
  scale,
  diameter,
}: {
  index: number;
  count: number;
  scale: number;
  diameter: number;
}) {
  const left = tubeX(index) * scale - diameter / 2;
  return (
    <>
      {Array.from({ length: count }, (_, j) => (
        <Coin
          key={j}
          size={diameter}
          // Machines are loaded from a mixed roll, so the faces alternate.
          face={(index * 7 + j) % 3 === 0 ? 'obverse' : 'reverse'}
          style={{
            position: 'absolute',
            left,
            top: (stackTopY(j + 1) + COIN_R) * scale - diameter / 2,
          }}
        />
      ))}
    </>
  );
});

/** The coin stock standing in the tube bank, drawn with the real coin. */
export const TubeBank = React.memo(function TubeBank({
  counts,
  scale,
}: {
  counts: number[];
  scale: number;
}) {
  const diameter = Math.min(COIN_R * 2, TUBE_PITCH - 0.35) * scale;
  return (
    <View style={{ flex: 1 }} pointerEvents="none">
      {counts.map((n, i) => (
        <Tube key={i} index={i} count={n} scale={scale} diameter={diameter} />
      ))}
    </View>
  );
});
