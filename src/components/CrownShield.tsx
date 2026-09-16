import React from 'react';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { C } from '../theme';

/**
 * The yellow crown shield stamped above each winning hole. Drawn in a 100x132
 * box so the caller can scale it to board units.
 */
export function CrownShield({ size, value }: { size: number; value: number }) {
  return (
    <Svg width={size} height={size * 1.32} viewBox="0 0 100 132">
      {/* Crown: a band with three teeth, as on the cabinet. */}
      <Path
        d="M14 48 L14 30 L27 41 L27 18 L44 30 L50 12 L56 30 L73 18 L73 41 L86 30 L86 48 Z"
        fill={C.ink}
      />
      {/* Shield body. */}
      <Path
        d="M9 50 H91 V92 Q91 97 87 100 L54 124 Q50 127 46 124 L13 100 Q9 97 9 92 Z"
        fill={C.ink}
      />
      <Path
        d="M14 55 H86 V90 Q86 93 83 95 L53 117 Q50 119 47 117 L17 95 Q14 93 14 90 Z"
        fill={C.crownYellow}
      />
      <SvgText
        x="50"
        y="97"
        textAnchor="middle"
        fontSize="54"
        fontWeight="900"
        fill={C.ink}
      >
        {String(value)}
      </SvgText>
      {/* Mounting screw, bottom right. */}
      <Circle cx="80" cy="103" r="5" fill={C.aluMid} stroke={C.aluShadow} strokeWidth="1" />
    </Svg>
  );
}
