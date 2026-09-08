import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from './src/lib/ThemeProvider';
import { LockGate } from './src/components/LockGate';
import OfflineBanner from './src/components/OfflineBanner';
import { startNetworkWatch } from './src/lib/network';
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
import { initMonitoring, monitoringEnabled, Sentry } from './src/lib/monitoring';

// Before anything else renders, so a crash during boot is still reported.
// No-ops entirely until a DSN is configured.
initMonitoring();

/* Point React Query at the device's real connectivity, so queries pause while
   offline and refetch themselves on reconnect instead of burning retries into a
   dead radio. This was written and then never called — the whole network module
   was orphaned, which is also why nobody noticed the banner was unmounted. */
startNetworkWatch();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Hold the native (dark) splash until the JS launch screen is ready to take
// over, so the handoff is dark→dark with no white flash. Best-effort — a
// rejection just means the OS already dismissed it.
SplashScreen.preventAutoHideAsync().catch(() => {});

function App() {
  const [launching, setLaunching] = useState(true);

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    const id = setTimeout(() => setLaunching(false), 1200);
    return () => clearTimeout(id);
  }, []);

  // Reveal the animated JS launch screen once the fonts are ready — until then
  // the matching-dark native splash stays up, so the brand lockup never flashes
  // in a fallback system font.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  /* The first-run flow — a welcome screen and a four-step explainer that also
     asked for a town and a set of sectors — is out for version one. It was not
     finished to the standard of the rest of the app, and an unfinished tutorial
     is the first thing a new user sees.
  
     Nothing downstream depends on it. The Home header asks the phone for a
     location and falls back to the country rather than to a town somebody
     typed; Search opens unfiltered; the agency rail orders by wait rather than
     by a declared sector. The screens are still in the repository
     (src/screens/auth/Onboarding*.tsx) so putting the flow back is a matter of
     restoring this gate, not rewriting it.
  
     SafeAreaProvider still wraps everything — including the launch early
     return — so useSafeAreaInsets() is available from the first frame. */
  let body: React.ReactNode;
  if (launching || !fontsLoaded) {
    body = <LaunchScreen />;
  } else {
    body = (
      <QueryClientProvider client={queryClient}>
        <LockGate>
          <AppNavigator />
        </LockGate>
      </QueryClientProvider>
    );
  }

  /* The offline banner sits ABOVE everything, including the launch stage,
     because losing the connection is true across all of it. It was written for this and then never mounted — the component
     existed, rendered nowhere, so the app has been silently pretending to be
     online since it was added. It renders nothing at all when connected, which
     is why nobody noticed. */
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <View style={{ flex: 1 }}>{body}</View>
        </View>
      </ThemeProvider>
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
