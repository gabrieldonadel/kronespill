import React from 'react';
import { View } from 'react-native';

import { COIN_R, COL_BOTTOM } from '../engine';
import { Coin } from './Coin';
import { TUBE_PITCH, tubeX } from './Playfield';

/** Coins stack in a tube this far apart, so they overlap as on the cabinet. */
export const STACK_PITCH = 3.6;

/**
 * The coin stock sitting in the tube bank, drawn with the real coin. Redraws
 * only when a stack changes, which is once per round.
 */
export const TubeBank = React.memo(
  function TubeBank({ counts, scale }: { counts: number[]; scale: number }) {
    const d = Math.min(COIN_R * 2, TUBE_PITCH - 0.35) * scale;
    return (
      <View style={{ flex: 1 }} pointerEvents="none">
        {counts.map((n, i) =>
          Array.from({ length: n }, (_, j) => (
            <Coin
              key={`${i}-${j}`}
              size={d}
              detail={false}
              // Machines are loaded from a mixed roll, so the faces alternate.
              face={(i * 7 + j) % 3 === 0 ? 'obverse' : 'reverse'}
              style={{
                position: 'absolute',
                left: tubeX(i) * scale - d / 2,
                top: (COL_BOTTOM - COIN_R - 0.3 - j * STACK_PITCH) * scale - d / 2,
              }}
            />
          )),
        )}
      </View>
    );
  },
  (a, b) => a.scale === b.scale && a.counts.join() === b.counts.join(),
);
