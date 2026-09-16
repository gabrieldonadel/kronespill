import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
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
              <G key={j}>
                <Circle
                  cx={tubeX(i)}
                  cy={COL_BOTTOM - COIN_R - 0.3 - j * STACK_PITCH}
                  r={Math.min(COIN_R, TUBE_PITCH / 2 - 0.2)}
                  fill={(i * 7 + j) % 3 === 0 ? C.coin : C.coinMid}
                  stroke="#5A5F64"
                  strokeWidth={0.34}
                />
                {/* A hint of relief, so a stack does not read as flat discs. */}
                <Path
                  d={`M${tubeX(i) - 1.1} ${COL_BOTTOM - COIN_R - 0.9 - j * STACK_PITCH} h2.2`}
                  stroke={C.coinDark}
                  strokeWidth={0.3}
                  opacity={0.5}
                />
              </G>
            ))}
          </G>
        ))}
      </Svg>
    );
  },
  (a, b) => a.scale === b.scale && a.counts.join() === b.counts.join(),
);
