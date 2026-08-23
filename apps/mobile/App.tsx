import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from './src/lib/ThemeProvider';
import { LockGate } from './src/components/LockGate';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { focusManager } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import OfflineBanner from './src/components/OfflineBanner';
import { startNetworkWatch } from './src/lib/network';
import LaunchScreen, { LAUNCH_DURATION_MS } from './src/components/LaunchScreen';
import OnboardingScreen from './src/screens/auth/OnboardingScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// State restoration: coming back from the background must not leave a stale
// queue position on screen. Telling React Query the app regained focus makes
// every active query refetch, so the ticket a customer left open is current by
// the time they have finished looking at it.
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

export default function App() {
  const [launching, setLaunching] = useState(true);
  const [tutorialSeen, setTutorialSeen] = useState<boolean | null>(null);

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('Lyne:first-run-tutorial-v1'),
      // Hold the splash long enough for the figure to walk all the way across.
      new Promise(resolve => setTimeout(resolve, LAUNCH_DURATION_MS)),
    ]).then(([seen]) => {
      setTutorialSeen(seen === 'complete');
      setLaunching(false);
    });
  }, []);

  useEffect(() => {
    const stopNetworkWatch = startNetworkWatch();
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      stopNetworkWatch();
      subscription.remove();
    };
  }, []);

  const completeTutorial = async () => {
    await AsyncStorage.setItem('Lyne:first-run-tutorial-v1', 'complete').catch(() => {});
    setTutorialSeen(true);
  };

  if (launching || tutorialSeen === null || !fontsLoaded) return <LaunchScreen />;
  if (!tutorialSeen) return <OnboardingScreen onComplete={completeTutorial} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <LockGate>
            {/* Above everything: losing the connection is true on every screen. */}
            <OfflineBanner />
            <AppNavigator />
          </LockGate>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
