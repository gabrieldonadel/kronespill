import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { C } from '../theme';

/**
 * The black instruction plate down the right frame member, lettered as on the
 * cabinet: use only undamaged 1-krone coins, one at a time.
 */
export function SidePlate({ width, height }: { width: number; height: number }) {
  const fs = Math.max(5, width * 0.17);
  return (
    <View style={[styles.plate, { width, height }]}>
      <View style={[styles.slot, { width: width * 0.52, height: width * 0.1 }]} />
      <Text style={[styles.text, { fontSize: fs, lineHeight: fs * 1.25 }]}>
        Bruk kun{'\n'}feilfrie{'\n'}kronestykker{'\n'}Legg på en{'\n'}av gangen.
      </Text>
      <Svg width={width * 0.8} height={width * 0.95} viewBox="0 0 80 95">
        <Path
          d="M6 30 L34 22 L32 14 L52 34 L70 74 L58 70 L54 82 L34 44 L24 48 Z"
          fill={C.plateText}
        />
        <SvgText
          x="36"
          y="46"
          fill={C.plate}
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          transform="rotate(58 36 46)"
        >
          RETURMYNT
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    backgroundColor: C.plate,
    alignItems: 'center',
    paddingTop: 6,
    gap: 6,
    overflow: 'hidden',
  },
  slot: {
    backgroundColor: '#000',
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.aluDark,
    marginBottom: 2,
  },
  text: {
    color: C.plateText,
    fontWeight: '700',
    textAlign: 'center',
  },
});
