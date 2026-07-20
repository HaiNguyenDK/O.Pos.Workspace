// Guard: yêu cầu đăng nhập. Chưa có token → về pin-login.
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { ConnectivityBanner } from '@/components/ui/connectivity-banner';
import { NotificationRouter } from '@/components/notification-router';
import { useAuthStore } from '@/store/auth-store';

export default function AppLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Redirect href="/(auth)/pin-login" />;

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
