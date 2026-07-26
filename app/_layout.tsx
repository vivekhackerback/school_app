import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    async function prepare() {
      try {
        // App is immediately ready to mount.
      } catch {
        // Handled silently
      } finally {
        setAppReady(true);
        // Hide native splash screen so the animated one can play
        try {
          await SplashScreen.hideAsync();
        } catch {
          // Handled silently
        }
      }
    }

    prepare();
  }, []);

  if (!appReady) {
    return null; // Keep rendering native splash screen
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      {!splashAnimationComplete && (
        <AnimatedSplashScreen onAnimationComplete={() => setSplashAnimationComplete(true)} />
      )}
    </ThemeProvider>
  );
}
