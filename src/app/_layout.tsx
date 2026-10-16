import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/Toast';
import { ExternalSheetHost } from '@/external/ExternalSheet';
import { fontFiles } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { UpdateProvider } from '@/update/UpdateProvider';
import { OtaBanner, UpdateSheet } from '@/update/UpdateSheet';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { colors, name, ready } = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const done = (fontsLoaded || !!fontError) && ready;

  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => {});
  }, [done]);

  if (!done) return null;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg }}
      {...(Platform.OS === 'web' ? ({ dir: 'rtl', lang: 'fa' } as object) : {})}
    >
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.isTV ? 'fade' : 'default',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="movie/[id]" />
        <Stack.Screen name="series/[id]" />
        <Stack.Screen name="player" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
      </Stack>
      <UpdateSheet />
      <OtaBanner />
      <ExternalSheetHost />
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <UpdateProvider>
            <Shell />
          </UpdateProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
