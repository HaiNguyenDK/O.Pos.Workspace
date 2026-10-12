import '@/global.css';
import '@/lib/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';

import { toastConfig } from '@/lib/toast';

import { navTheme } from '@/lib/theme';
import { setupOnlineManager } from '@/lib/connectivity';
import { useAuthStore } from '@/store/auth-store';
import { useTerminalStore } from '@/store/terminal-store';

SplashScreen.preventAutoHideAsync();
setupOnlineManager();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrateTerminal = useTerminalStore((s) => s.hydrate);
  const terminalHydrated = useTerminalStore((s) => s.hydrated);
  const hydrated = authHydrated && terminalHydrated;

  useEffect(() => {
    hydrate();
    hydrateTerminal();
  }, [hydrate, hydrateTerminal]);

  // Ẩn splash khi hydrate xong; fallback 2.5s để KHÔNG BAO GIỜ kẹt splash.
  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 2500);
    return () => clearTimeout(t);
  }, [hydrated]);

  // LUÔN mount navigator (không gate bằng return null → tránh treo splash).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <ThemeProvider value={navTheme}>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0C' } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </ThemeProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
      <Toast config={toastConfig} />
    </GestureHandlerRootView>
  );
}
