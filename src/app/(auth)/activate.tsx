// Thiết lập máy (1 lần, chế độ graphql): quản lý đăng nhập portal → chọn tenant → chọn chi nhánh.
// Tạm thời thay cho /auth/pos/terminal/activate (pos-be-api-request 3.3). Xong thì về màn PIN.
// `?reset=1` (từ màn PIN "Thiết lập lại máy"): bắt đầu lại từ đăng nhập, giữ phiên cũ tới khi chọn chi nhánh mới,
// có nút quay lại màn PIN.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { listBranches, type BranchOption } from '@/data/api/graphql';
import { terminalLogin, terminalSelectTenant } from '@/data/api/terminal';
import { isPosApiError } from '@/data/types';
import { loadDeviceId } from '@/lib/device';
import { color } from '@/lib/theme';
import { useTerminalStore } from '@/store/terminal-store';
import { Pressable, Text, View } from '@/tw';

type Step = 'login' | 'tenant' | 'branch';
const STEP_NO: Record<Step, number> = { login: 1, tenant: 2, branch: 3 };

const errorText = (e: unknown) => (isPosApiError(e) || e instanceof Error ? e.message : String(e));

export default function Activate() {
  const { t } = useTranslation();
  const router = useRouter();
  const reset = useLocalSearchParams<{ reset?: string }>().reset === '1';
  const session = useTerminalStore((s) => s.session);
  const setSession = useTerminalStore((s) => s.setSession);
  const setBranch = useTerminalStore((s) => s.setBranch);
  const deactivate = useTerminalStore((s) => s.deactivate);

  // Đã có phiên nhưng chưa chọn chi nhánh (vd. tắt app giữa chừng) → vào thẳng bước chi nhánh.
  const [step, setStep] = useState<Step>(session && !reset ? 'branch' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preToken, setPreToken] = useState('');
  const [tenants, setTenants] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseTenant = async (pre: string, tenantId: string) => {
    const s = await terminalSelectTenant(pre, tenantId, email.trim());
    await setSession(s);
    setStep('branch');
  };

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadDeviceId();
      const res = await terminalLogin(email.trim(), password);
      if (res.tenants.length === 0) throw new Error(t('terminal.noTenant'));
      if (res.tenants.length === 1) await chooseTenant(res.preToken, res.tenants[0]);
      else {
        setPreToken(res.preToken);
        setTenants(res.tenants);
        setStep('tenant');
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const onTenant = async (tenantId: string) => {
    setBusy(true);
    setError(null);
    try {
      await chooseTenant(preToken, tenantId);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Phiên máy nạp muộn (keystore chậm) mà đã có chi nhánh → máy đã kích hoạt, quay về luồng thường.
  // Thiết lập lại thì không tự quay về (máy vẫn còn chi nhánh cũ cho tới khi chọn chi nhánh mới).
  useEffect(() => {
    if (!reset && session?.branchId) router.replace('/');
  }, [reset, session?.branchId, router]);

  useEffect(() => {
    if (step !== 'branch') return;
    let cancelled = false;
    listBranches()
      .then((list) => !cancelled && setBranches(list))
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [step]);

  const onBranch = async (b: BranchOption) => {
    await setBranch(b);
    router.replace('/(auth)/pin-login');
  };

  const restart = async () => {
    await deactivate();
    setStep('login');
    setBranches(null);
    setError(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
          <View className="items-center">
            <Text className="text-3xl font-extrabold text-brand">{t('appName')}</Text>
            <Text className="mt-2 text-lg font-bold text-fg">{t('terminal.title')}</Text>
            <Text className="mt-1 text-center text-sm text-muted">{t('terminal.oneTimeNote')}</Text>
            <Text className="mt-4 text-xs font-semibold uppercase text-brand">{t('terminal.step', { n: STEP_NO[step] })}</Text>
            <Text className="mt-1 text-center text-fg">{t(`terminal.${step}Hint`)}</Text>
          </View>

          {step === 'login' ? (
            <View className="gap-3">
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder={t('terminal.email')}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <TextField value={password} onChangeText={setPassword} placeholder={t('terminal.password')} secureTextEntry />
              <Button label={t('terminal.activate')} onPress={onLogin} loading={busy} disabled={!email || !password} />
            </View>
          ) : null}

          {step === 'tenant' ? (
            <View className="gap-2">
              {tenants.map((id) => (
                <Pressable
                  key={id}
                  disabled={busy}
                  onPress={() => onTenant(id)}
                  className="rounded-2xl border border-line bg-surface p-4 active:opacity-80"
                >
                  <Text className="font-semibold text-fg">{id}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 'branch' ? (
            <View className="gap-2">
              {branches === null && !error ? <ActivityIndicator color={color.text.primary} /> : null}
              {branches?.length === 0 ? <Text className="text-center text-muted">{t('terminal.noBranch')}</Text> : null}
              {branches?.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => onBranch(b)}
                  className="rounded-2xl border border-line bg-surface p-4 active:opacity-80"
                >
                  <Text className="font-semibold text-fg">{b.name}</Text>
                  {b.address ? <Text className="mt-1 text-sm text-muted">{b.address}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {error ? <Text className="text-center text-cart">{error}</Text> : null}

          {step !== 'login' ? <Button variant="ghost" label={t('terminal.restart')} onPress={restart} /> : null}
          {reset && session?.branchId ? (
            <Button variant="ghost" label={t('terminal.backToPin')} onPress={() => router.replace('/(auth)/pin-login')} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
