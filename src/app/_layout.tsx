import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BootScreen, OfflineBanner } from '@/components/BootScreen';
import { CrashScreen } from '@/components/CrashScreen';
import { toast, ToastHost } from '@/components/Toast';
import { onNotificationTap } from '@/notifications';
import { startContentWatcher } from '@/notifications/watcher';
import { InstallPrompt } from '@/pwa/InstallPrompt';
import { registerPwa } from '@/pwa/register';
import { checkConnection, startMonitor, useNetStatus } from '@/net/connectivity';
import { ExternalSheetHost } from '@/external/ExternalSheet';
import { fontFiles } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { UpdateProvider } from '@/update/UpdateProvider';
import { OtaBanner, UpdateSheet } from '@/update/UpdateSheet';

/** Replaces the app when any route throws while rendering, instead of leaving a blank screen. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <CrashScreen error={error} retry={() => void retry()} />;
}

SplashScreen.preventAutoHideAsync().catch(() => {});
registerPwa();

function Shell() {
  const { colors, name, ready } = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  const done = (fontsLoaded || !!fontError) && ready;
  const net = useNetStatus();
  const [minShown, setMinShown] = useState(false);
  const [offlineOk, setOfflineOk] = useState(false);
  const wasDown = useRef(false);

  useEffect(() => {
    if (!done) return;
    SplashScreen.hideAsync().catch(() => {});
    startMonitor();
    void checkConnection();
    const t = setTimeout(() => setMinShown(true), 2000);
    return () => clearTimeout(t);
  }, [done]);

  useEffect(() => {
    if (net !== 'online') return;
    startContentWatcher();
  }, [net]);

  useEffect(() => onNotificationTap((url) => router.push(url as never)), []);

  useEffect(() => {
    if (net === 'online' && wasDown.current) {
      wasDown.current = false;
      toast('اتصال برقرار شد', 'check');
    } else if (net === 'offline' || net === 'server') wasDown.current = true;
  }, [net]);

  if (!done) return null;

  // `?splash=hold` / `?splash=offline` pin the splash for design review and screenshots.
  const hold = Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('splash') : null;
  const booting = !minShown || net === 'checking' || hold === 'hold';
  const shownNet = hold === 'offline' ? 'offline' : net;
  if (booting || hold === 'offline' || ((net === 'offline' || net === 'server') && !offlineOk)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
        <BootScreen
          status={booting ? 'checking' : (shownNet as 'offline' | 'server')}
          onRetry={() => void checkConnection()}
          onContinue={() => setOfflineOk(true)}
        />
      </View>
    );
  }

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
      <OfflineBanner status={net} onRetry={() => void checkConnection()} />
      <InstallPrompt />
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
