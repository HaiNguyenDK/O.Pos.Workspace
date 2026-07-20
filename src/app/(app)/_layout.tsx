// Guard: yêu cầu đăng nhập. Chưa có token → về pin-login.
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';

export default function AppLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Redirect href="/(auth)/pin-login" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0B0C' } }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="table/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}
