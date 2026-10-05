import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AnimatedSplashScreen } from '@/components/animated-splash-screen';

// Prevent the native splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Prevent unhandled promise rejection if already called */
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appReady, setAppReady] = useState(false);
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);

  const handleSplashComplete = useCallback(() => {
    setSplashAnimationComplete(true);
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        setAppReady(true);
      } finally {
        try {
          await SplashScreen.hideAsync();
        } catch {
          // Handled silently
        }
      }
    }

    prepare();

    // Absolute fallback safety: ensure the app reaches the main screen within 1800ms
    const safetyTimer = setTimeout(() => {
      setAppReady(true);
      setSplashAnimationComplete(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 1800);

    return () => clearTimeout(safetyTimer);
  }, []);

  if (!appReady) {
    return null; // Keep rendering native splash screen briefly
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      {!splashAnimationComplete && (
        <AnimatedSplashScreen onAnimationComplete={handleSplashComplete} />
      )}
    </ThemeProvider>
  );
}
