// Màn 1 — đăng nhập PIN 6 số. secure-store lưu token; haptics thay shake khi sai.
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/tw';
import { PinKeypad } from '@/components/ui/pin-keypad';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { isPosApiError } from '@/data/types';

export default function PinLogin() {
  const { t } = useTranslation();
  const router = useRouter();
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pin.length !== 6 || busy) return;
    setBusy(true);
    loginWithPin(pin)
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
      .finally(() => setBusy(false));
  }, [pin, busy, loginWithPin, router, hapticsEnabled]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-extrabold text-brand">{t('appName')}</Text>
        <Text className="mb-10 mt-2 text-base text-muted">
          {message ?? (error ? t('pin.wrong') : `${t('pin.title')} · ${t('pin.hint')}`)}
        </Text>
        <PinKeypad value={pin} onChange={setPin} error={error} />
      </View>
    </SafeAreaView>
  );
}
