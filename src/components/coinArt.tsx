import React, { createContext, useContext, useMemo } from 'react';
import { useImage, type ImageRef } from 'expo-image';

/**
 * The coin art is decoded once and shared.
 *
 * A loaded machine shows a couple of hundred coins at a time, and mounting that
 * many independent images means that many decodes of the same two pictures.
 * `useImage` hands every coin the same reference instead, at a decode size
 * matched to how large a coin ever gets on screen.
 */
const DECODE_PX = 128;

export type CoinArt = { obverse: ImageRef | null; reverse: ImageRef | null };

const CoinArtContext = createContext<CoinArt>({ obverse: null, reverse: null });

export function CoinArtProvider({ children }: { children: React.ReactNode }) {
  const obverse = useImage(
    require('../../assets/coin/obverse.png'),
    { maxWidth: DECODE_PX, maxHeight: DECODE_PX },
    [],
  );
  const reverse = useImage(
    require('../../assets/coin/reverse.png'),
    { maxWidth: DECODE_PX, maxHeight: DECODE_PX },
    [],
  );
  const value = useMemo(() => ({ obverse, reverse }), [obverse, reverse]);
  return <CoinArtContext.Provider value={value}>{children}</CoinArtContext.Provider>;
}

export const useCoinArt = () => useContext(CoinArtContext);
