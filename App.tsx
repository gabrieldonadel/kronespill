import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KiteProvider } from 'tuft-kite';
import { CoinArtProvider } from './src/components/coinArt';
import { Game } from './src/Game';

const KITE_URL = process.env.EXPO_PUBLIC_KITE_URL;
const KITE_TOKEN = process.env.EXPO_PUBLIC_KITE_TOKEN;

export default function App() {
  const app = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <CoinArtProvider>
          <Game />
        </CoinArtProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  // Remote control for development only, and only when configured locally.
  if (__DEV__ && KITE_URL && KITE_TOKEN) {
    return (
      <KiteProvider url={KITE_URL} token={KITE_TOKEN}>
        {app}
      </KiteProvider>
    );
  }
  return app;
}
