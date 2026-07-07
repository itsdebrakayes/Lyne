import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

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
      AsyncStorage.getItem('qmenow:first-run-tutorial-v1'),
      new Promise(resolve => setTimeout(resolve, 1200)),
    ]).then(([seen]) => {
      setTutorialSeen(seen === 'complete');
      setLaunching(false);
    });
  }, []);

  const completeTutorial = async () => {
    await AsyncStorage.setItem('qmenow:first-run-tutorial-v1', 'complete').catch(() => {});
    setTutorialSeen(true);
  };

  if (launching || tutorialSeen === null || !fontsLoaded) return <LaunchScreen />;
  if (!tutorialSeen) return <OnboardingScreen onComplete={completeTutorial} />;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <AppNavigator />
    </QueryClientProvider>
  );
}
