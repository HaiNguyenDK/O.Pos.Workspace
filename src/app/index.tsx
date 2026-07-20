// Redirect gốc → pin-login | home theo auth (Mục 6).
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';

export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  // Chờ hydrate (≤1.5s) để biết token trước khi redirect (tránh nháy pin-login).
  if (!hydrated) return null;
  return <Redirect href={token ? '/(app)/home' : '/(auth)/pin-login'} />;
}
