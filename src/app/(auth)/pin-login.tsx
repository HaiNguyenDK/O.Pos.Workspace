// Màn 1 — đăng nhập PIN 6 số (màn đầu tiên nhân viên thấy). secure-store lưu token; haptics thay shake khi sai.
// Hiện chi nhánh máy đang gắn; "Thiết lập lại máy" (chế độ graphql) mở màn thiết lập — cần tài khoản quản lý.
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '@/tw';
import { PinKeypad } from '@/components/ui/pin-keypad';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { needsActivation, useTerminalStore } from '@/store/terminal-store';
import { isPosApiError } from '@/data/types';

export default function PinLogin() {
  const { t } = useTranslation();
  const router = useRouter();
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const branchName = useTerminalStore((s) => s.session?.branchName);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  // Đủ 6 số → gửi ngay trong handler (không qua effect), khoá bằng ref để không gửi trùng.
  const submit = (value: string) => {
    if (busy.current) return;
    busy.current = true;
    loginWithPin(value)
      .then(() => router.replace('/(app)/home'))
      .catch((e) => {
        setMessage(isPosApiError(e) && e.code !== 'UNAUTHENTICATED' ? e.message : null);
        setError(true);
        if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 600);
      })
      .finally(() => {
        busy.current = false;
      });
  };

  const onChange = (value: string) => {
    if (busy.current) return;
    setPin(value);
    if (value.length === 6) submit(value);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-extrabold text-brand">{t('appName')}</Text>
        {needsActivation ? (
          <View className="mt-3 rounded-full border border-line bg-surface px-4 py-1.5">
            <Text className="text-sm font-semibold text-fg">
              {branchName ? t('pin.branch', { name: branchName }) : t('pin.noBranch')}
            </Text>
          </View>
        ) : null}
        <Text className="mb-10 mt-4 text-base text-muted">
          {message ?? (error ? t('pin.wrong') : `${t('pin.title')} · ${t('pin.hint')}`)}
        </Text>
        <PinKeypad value={pin} onChange={onChange} error={error} />
      </View>
      {needsActivation ? (
        <Pressable
          onPress={() => router.push({ pathname: '/(auth)/activate', params: { reset: '1' } })}
          className="items-center pb-6 active:opacity-70"
          accessibilityRole="button"
        >
          <Text className="text-sm text-muted underline">{t('pin.setup')}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
