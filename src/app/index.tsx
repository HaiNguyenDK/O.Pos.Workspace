// Redirect gốc → kích hoạt máy | pin-login | home (Mục 6).
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { needsActivation, useTerminalStore } from '@/store/terminal-store';

export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const terminalHydrated = useTerminalStore((s) => s.hydrated);
  const branchId = useTerminalStore((s) => s.session?.branchId);
  // Chờ hydrate (≤1.5s) để biết token trước khi redirect (tránh nháy pin-login).
  if (!hydrated || !terminalHydrated) return null;
  // Chế độ graphql: máy phải được kích hoạt (có tenant + chi nhánh) trước khi nhân viên nhập PIN.
  if (needsActivation && !branchId) return <Redirect href="/(auth)/activate" />;
  return <Redirect href={token ? '/(app)/home' : '/(auth)/pin-login'} />;
}
