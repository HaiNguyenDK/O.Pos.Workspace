// Redirect gốc → pin-login | home theo auth (Mục 6).
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';

export default function Index() {
  const token = useAuthStore((s) => s.token);
  return <Redirect href={token ? '/(app)/home' : '/(auth)/pin-login'} />;
}
