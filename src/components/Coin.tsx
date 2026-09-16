import React from 'react';
import { Image, StyleProp, ImageStyle } from 'react-native';

/**
 * A 1983 Norwegian 1-krone piece, photographed. The obverse carries Olav V's
 * profile and the legend ALT FOR NORGE; the reverse carries the royal crown
 * over 1 KRONE. Both faces are cut from the same photograph and masked to the
 * rim, so this is the coin itself rather than a drawing of it.
 *
 * A machine of this vintage takes exactly this coin: the 1997 replacement, with
 * its centre hole, is what put these machines out of service.
 */
export type CoinFace = 'obverse' | 'reverse';

const ART: Record<CoinFace, { big: number; small: number }> = {
  obverse: {
    big: require('../../assets/coin/obverse.png'),
    small: require('../../assets/coin/obverse-small.png'),
  },
  reverse: {
    big: require('../../assets/coin/reverse.png'),
    small: require('../../assets/coin/reverse-small.png'),
  },
};

export function Coin({
  size,
  face = 'reverse',
  detail = true,
  style,
}: {
  size: number;
  face?: CoinFace;
  /** Off for the small coins in the tubes and the bowl, which use lighter art. */
  detail?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={detail ? ART[face].big : ART[face].small}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}
