// Guard: yêu cầu đăng nhập. Chưa có token / token hết hạn / bỏ máy quá lâu → về pin-login (máy dùng chung).
import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, View } from 'react-native';
import { ConnectivityBanner } from '@/components/ui/connectivity-banner';
import { NotificationRouter } from '@/components/notification-router';
import { IDLE_LOGOUT_MS, useAuthStore } from '@/store/auth-store';

export default function AppLayout() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const isExpired = useAuthStore((s) => s.isExpired);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        backgroundAt.current ??= Date.now();
        return;
      }
      const idle = backgroundAt.current ? Date.now() - backgroundAt.current : 0;
      backgroundAt.current = null;
      if (idle > IDLE_LOGOUT_MS || isExpired()) logout();
    });
    return () => sub.remove();
  }, [logout, isExpired]);

  if (!token || isExpired()) return <Redirect href="/(auth)/pin-login" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0C' } }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="table/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Overlay đáy: báo mất mạng + tự flush hàng đợi gửi bếp khi có mạng lại. */}
      <ConnectivityBanner />
      {/* Nghe tap push bếp → deep link vào bàn. */}
      <NotificationRouter />
    </View>
  );
}
