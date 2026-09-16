import React from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { C } from '../theme';

function starPath(spikes: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** The red starburst carrying the 10 kr jackpot, centre of the pocket row. */
export function Starburst({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={starPath(12, 49, 27)} fill={C.ink} />
      <Path d={starPath(12, 45, 25)} fill={C.starRed} />
      <Path d={starPath(12, 34, 22)} fill={C.starRedDeep} opacity={0.55} />
      <SvgText
        x="50"
        y="63"
        textAnchor="middle"
        fontSize="30"
        fontWeight="900"
        fill={C.ink}
      >
        10
      </SvgText>
    </Svg>
  );
}
