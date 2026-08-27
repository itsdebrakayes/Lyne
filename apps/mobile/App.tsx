import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
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
import AppNavigator from './src/navigation/AppNavigator';
import LaunchScreen from './src/components/LaunchScreen';
import OnboardingScreen from './src/screens/auth/OnboardingScreen';
import OnboardingSteps from './src/screens/auth/OnboardingSteps';
import { initMonitoring, monitoringEnabled, Sentry } from './src/lib/monitoring';

// Before anything else renders, so a crash during boot is still reported.
// No-ops entirely until a DSN is configured.
initMonitoring();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Hold the native (dark) splash until the JS launch screen is ready to take
// over, so the handoff is dark→dark with no white flash. Best-effort — a
// rejection just means the OS already dismissed it.
SplashScreen.preventAutoHideAsync().catch(() => {});

function App() {
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
      AsyncStorage.getItem('lyne:first-run-tutorial-v1'),
      new Promise(resolve => setTimeout(resolve, 1200)),
    ]).then(([seen]) => {
      setTutorialSeen(seen === 'complete');
      setLaunching(false);
    });
  }, []);

  // Reveal the animated JS launch screen once the fonts are ready — until then
  // the matching-dark native splash stays up, so the brand lockup never flashes
  // in a fallback system font.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  /* Two beats before the app proper: the welcome, then the setup steps.
     Kept as separate stages rather than one component, because the welcome is
     the brand moment and finished — the explainers and questions after it are
     a different job and change independently of it. */
  const [welcomeSeen, setWelcomeSeen] = useState(false);

  const completeTutorial = async () => {
    await AsyncStorage.setItem('lyne:first-run-tutorial-v1', 'complete').catch(() => {});
    setTutorialSeen(true);
  };

  // SafeAreaProvider wraps everything — including the launch/onboarding early
  // returns — so useSafeAreaInsets() is available on every screen from the
  // first frame (no flash of un-inset layout).
  let body: React.ReactNode;
  if (launching || tutorialSeen === null || !fontsLoaded) {
    body = <LaunchScreen />;
  } else if (!tutorialSeen && !welcomeSeen) {
    body = <OnboardingScreen onComplete={() => setWelcomeSeen(true)} />;
  } else if (!tutorialSeen) {
    /* Finishing OR skipping both land here — the flow is never a trap, so both
       paths mark the tutorial done and neither can strand somebody part-way
       through on the next launch. */
    body = <OnboardingSteps onDone={completeTutorial} />;
  } else {
    body = (
      <QueryClientProvider client={queryClient}>
        <LockGate>
          <AppNavigator />
        </LockGate>
      </QueryClientProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>{body}</ThemeProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap adds the error boundary and touch/navigation breadcrumbs that make
// a stack trace readable — without it you get the crash but not the path to it.
//
// Only applied when monitoring is actually on. Wrapping without a preceding
// init warns on every reload ("App Start Span could not be finished"), and a
// permanent warning toast in development is worse than useless — it sits on top
// of the UI and trains you to ignore warnings that might matter.
export default monitoringEnabled ? Sentry.wrap(App) : App;
