import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import { COL_BOTTOM, COL_COUNT, COIN_R, GLASS_H, GLASS_W } from '../engine';
import { C } from '../theme';
import { TUBE_PITCH, tubeTop, tubeX } from './Playfield';

/** Coins stack in a tube this far apart, so they overlap as on the cabinet. */
export const STACK_PITCH = 3.6;

/** The coin stock sitting in the tube bank. Redraws only when a stack changes. */
export const TubeBank = React.memo(
  function TubeBank({ counts, scale }: { counts: number[]; scale: number }) {
    return (
      <Svg
        width={GLASS_W * scale}
        height={GLASS_H * scale}
        viewBox={`0 0 ${GLASS_W} ${GLASS_H}`}
      >
        {counts.map((n, i) => (
          <G key={`stack${i}`}>
            {Array.from({ length: n }, (_, j) => (
              <Circle
                key={j}
                cx={tubeX(i)}
                cy={COL_BOTTOM - COIN_R - 0.3 - j * STACK_PITCH}
                r={Math.min(COIN_R, TUBE_PITCH / 2 - 0.2)}
                fill={C.coinMid}
                stroke="#5A5F64"
                strokeWidth={0.34}
              />
            ))}
          </G>
        ))}
      </Svg>
    );
  },
  (a, b) => a.scale === b.scale && a.counts.join() === b.counts.join(),
);
