import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileWalletProvider, WalletAuthorization, WalletAuthorizationCache } from '@wallet-ui/react-native-web3js';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Shell } from './src/Shell';
import * as Notifications from 'expo-notifications';
import { MarketClosedError, RPC_URL } from './src/api';

// Alerts that arrive while the app is open still show as a banner.
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export default function App() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => subscription.remove();
  }, []);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: (count, error) => count < 2 && !(error instanceof MarketClosedError), staleTime: 30_000 } } }));
  const [cache] = useState<WalletAuthorizationCache>(() => {
    let authorization: WalletAuthorization | undefined;
    return { get: async () => authorization, set: async value => { authorization = value; }, clear: async () => { authorization = undefined; } };
  });
  return <SafeAreaProvider><QueryClientProvider client={client}>
    <MobileWalletProvider cache={cache} chain="solana:mainnet" endpoint={RPC_URL} identity={{ name: 'Closing Bell', uri: 'https://guts805.github.io' }}>
      <StatusBar style="light" /><Shell />
    </MobileWalletProvider>
  </QueryClientProvider></SafeAreaProvider>;
}
