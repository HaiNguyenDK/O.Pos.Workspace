// Màn 13 — Cài đặt: máy in (trạng thái + in thử), ngôn ngữ, toggle noti/âm/rung/phí phục vụ, đăng xuất.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, LogOut, Printer, ReceiptText } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import i18n from '@/lib/i18n';
import { getPrinterStatus, isPrinterSupported, testPrint } from '@/native/printer';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';

// Trạng thái máy in → i18n key (printer.status.*).
const STATUS_LABEL_KEY: Record<string, string> = {
  ready: 'printer.status.ready',
  preparing: 'printer.status.preparing',
  out_of_paper: 'printer.status.out_of_paper',
  overheated: 'printer.status.overheated',
  cover_open: 'printer.status.cover_open',
  comm_error: 'printer.status.comm_error',
  disconnected: 'printer.status.disconnected',
  unsupported: 'printer.status.unsupported',
  unknown: 'printer.status.unknown',
};

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const s = useSettingsStore();
  const logout = useAuthStore((st) => st.logout);

  const [status, setStatus] = useState('unknown');
  const [printing, setPrinting] = useState(false);
  const supported = isPrinterSupported();

  const refreshStatus = useCallback(() => {
    getPrinterStatus().then(setStatus);
  }, []);
  useEffect(refreshStatus, [refreshStatus]);

  const onTestPrint = async () => {
    setPrinting(true);
    const res = await testPrint();
    setPrinting(false);
    refreshStatus();
    if (res.printed) toast.success(t('printer.testPrinted'), t('printer.checkPaper'));
    else if (res.reason === 'unsupported') toast.info(t('printer.noSunmi'), t('printer.runOnSunmi'));
    else toast.error(t('printer.testError'), STATUS_LABEL_KEY[status] ? t(STATUS_LABEL_KEY[status]) : '');
  };

  const setLang = (lng: 'vi' | 'en') => {
    s.setLanguage(lng);
    i18n.changeLanguage(lng);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">{t('nav.settings')}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 24 }}>
        {/* Lịch sử */}
        <Pressable onPress={() => router.push('/(app)/history')} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-4 active:opacity-80">
          <ReceiptText size={20} color={color.brand.DEFAULT} />
          <Text className="ml-3 flex-1 font-semibold text-fg">{t('settings.billHistory')}</Text>
          <ChevronRight size={18} color={color.text.muted} />
        </Pressable>

        {/* Máy in */}
        <Section title={t('settings.printer')}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Printer size={20} color={supported ? color.brand.DEFAULT : color.text.muted} />
              <Text className="ml-3 font-semibold text-fg">{t('settings.status')}</Text>
            </View>
            <Text className={supported && status === 'ready' ? 'text-available' : 'text-muted'}>
              {STATUS_LABEL_KEY[status] ? t(STATUS_LABEL_KEY[status]) : status}
            </Text>
          </View>
          <Button
            className="mt-3"
            variant="ghost"
            label={t('settings.testPrint')}
            loading={printing}
            onPress={onTestPrint}
            leftIcon={<Printer size={18} color={color.text.primary} />}
          />
          {!supported && (
            <Text className="mt-2 text-xs text-muted">
              {t('settings.sunmiOnly')}
            </Text>
          )}
        </Section>

        {/* Ngôn ngữ */}
        <Section title={t('settings.language')}>
          <View className="flex-row rounded-2xl bg-elevated p-1">
            {(['vi', 'en'] as const).map((lng) => (
              <Pressable key={lng} onPress={() => setLang(lng)} className={`flex-1 items-center rounded-xl py-2.5 ${s.language === lng ? 'bg-brand' : ''}`}>
                <Text className={`font-bold ${s.language === lng ? 'text-white' : 'text-muted'}`}>
                  {lng === 'vi' ? 'Tiếng Việt' : 'English'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Toggle */}
        <Section title={t('settings.options')}>
          <ToggleRow label={t('settings.sound')} value={s.soundEnabled} onValueChange={s.toggleSound} />
          <ToggleRow label={t('settings.haptics')} value={s.hapticsEnabled} onValueChange={s.toggleHaptics} />
          <ToggleRow label={t('settings.serviceCharge')} value={s.serviceCharge} onValueChange={s.toggleServiceCharge} />
        </Section>

        <Button
          variant="ghost"
          label={t('settings.logout')}
          leftIcon={<LogOut size={18} color={color.status.cancelled} />}
          onPress={() => logout().then(() => router.replace('/(auth)/pin-login'))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 font-semibold text-muted">{title}</Text>
      <View className="gap-1 rounded-2xl border border-line bg-surface p-4">{children}</View>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: () => void }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-fg">{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: color.brand.DEFAULT, false: color.bg.elevated }} thumbColor="#fff" />
    </View>
  );
}
