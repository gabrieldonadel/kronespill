import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { C } from '../theme';

/**
 * A pre-1997 Norwegian 1-krone piece: cupronickel, 21 mm, prominent raised rim,
 * relief worn soft. Those are the properties visible in the photograph of the
 * machine's coin tubes. The crown-and-denomination and portrait faces follow
 * the coin's design — the photograph is too worn to resolve the fine heraldry,
 * and at this size on a phone none of it is legible anyway.
 */
export type CoinFace = 'crown' | 'king';

export function Coin({
  size,
  face = 'crown',
  detail = true,
}: {
  size: number;
  face?: CoinFace;
  detail?: boolean;
}) {
  const id = `krone-${face}-${detail ? 'd' : 'p'}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          cx="36"
          cy="30"
          r="82"
        >
          <Stop offset="0" stopColor={C.coinLight} />
          <Stop offset="0.45" stopColor={C.coin} />
          <Stop offset="0.82" stopColor={C.coinMid} />
          <Stop offset="1" stopColor={C.coinDark} />
        </RadialGradient>
      </Defs>

      {/* Blank and rim. */}
      <Circle cx="50" cy="50" r="49" fill={`url(#${id})`} />
      <Circle cx="50" cy="50" r="46.5" fill="none" stroke={C.coinLight} strokeWidth="3" opacity={0.5} />
      <Circle cx="50" cy="50" r="49" fill="none" stroke={C.coinDark} strokeWidth="2" />

      {detail && face === 'crown' && (
        <G opacity={0.82}>
          {/* Crown over the denomination. */}
          <Path
            d="M33 34 L33 25 L40 30 L45 20 L50 28 L55 20 L60 30 L67 25 L67 34 Z"
            fill={C.coinDark}
          />
          <SvgText
            x="50"
            y="66"
            textAnchor="middle"
            fontSize="30"
            fontWeight="800"
            fill={C.coinDark}
          >
            1
          </SvgText>
          <SvgText
            x="50"
            y="82"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={C.coinDark}
            opacity={0.85}
          >
            KRONE
          </SvgText>
        </G>
      )}

      {detail && face === 'king' && (
        <G opacity={0.72}>
          {/* Profile facing right, as on the obverse. */}
          <Path
            d="M38 74 C36 64 34 56 36 48 C38 38 46 30 56 31 C64 32 69 39 68 47 C67 53 63 56 63 60 C63 64 66 66 66 70 C66 73 62 75 56 75 Z"
            fill={C.coinDark}
          />
          <Circle cx="50" cy="50" r="41" fill="none" stroke={C.coinDark} strokeWidth="1" strokeDasharray="2 4" opacity={0.6} />
        </G>
      )}

      {/* Worn highlight across the face. */}
      <Path d="M18 30 C34 16 62 14 80 26" stroke={C.coinLight} strokeWidth="3" fill="none" opacity={0.28} />
    </Svg>
  );
}
