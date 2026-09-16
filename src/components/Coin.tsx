import React from 'react';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { C } from '../theme';

/** A 1-krone piece, face on. */
export function Coin({ size, detail = true }: { size: number; detail?: boolean }) {
  const id = detail ? 'coinBig' : 'coinSmall';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          cx="38"
          cy="32"
          r="78"
        >
          <Stop offset="0" stopColor={C.coinLight} />
          <Stop offset="0.55" stopColor={C.coin} />
          <Stop offset="1" stopColor={C.coinDark} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="49" fill={`url(#${id})`} />
      <Circle cx="50" cy="50" r="49" fill="none" stroke={C.coinDark} strokeWidth="2" />
      {detail && (
        <G opacity={0.75}>
          <Circle cx="50" cy="50" r="40" fill="none" stroke={C.coinMid} strokeWidth="2.5" />
          {/* Crowned monogram, suggested rather than drawn in full. */}
          <Path
            d="M36 62 L36 44 L43 52 L50 38 L57 52 L64 44 L64 62 Z"
            fill={C.coinMid}
            opacity={0.9}
          />
          <Circle cx="50" cy="68" r="3" fill={C.coinMid} />
        </G>
      )}
    </Svg>
  );
}
