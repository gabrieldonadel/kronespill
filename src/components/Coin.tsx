import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';

import { C } from '../theme';
import { useCoinArt } from './coinArt';

/**
 * A 1983 Norwegian 1-krone piece, photographed. The obverse carries Olav V's
 * profile and the legend ALT FOR NORGE; the reverse carries the royal crown
 * over 1 KRONE. Both faces are cut from one photograph and masked to the rim,
 * so this is the coin itself rather than a drawing of it.
 *
 * A machine of this vintage takes exactly this coin: the 1997 replacement, with
 * its centre hole, is what put these machines out of service.
 */
export type CoinFace = 'obverse' | 'reverse';

export function Coin({
  size,
  face = 'reverse',
  style,
}: {
  size: number;
  face?: CoinFace;
  style?: StyleProp<ImageStyle & ViewStyle>;
}) {
  const art = useCoinArt();
  const ref = art[face];

  // Until the shared decode lands, stand in a blank of the same size rather
  // than loading the file again per coin.
  if (!ref) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: C.coinMid,
            borderWidth: Math.max(0.5, size * 0.04),
            borderColor: C.coinDark,
          },
          style,
        ]}
      />
    );
  }

  return (
    <Image
      source={ref}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      cachePolicy="memory"
      priority="high"
    />
  );
}
