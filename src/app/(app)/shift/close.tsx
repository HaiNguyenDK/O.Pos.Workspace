// Chốt ca — ĐẾM MÙ (pos-plan Mục 3.7, D14).
// Bước 1: nhập tiền đếm được (+ ghi chú) — KHÔNG hiện tiền hệ thống.
// Bước 2: closeShift → server trả báo cáo Z (expected + variance) → hiện kết quả, In Z, về Home.
// Chỉ CASHIER / MANAGER / OWNER (Mục 6). Sau khi chốt máy không còn ca mở.
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Lock, Printer } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { TextField } from '@/components/ui/text-field';
import {
  ShiftReportCard,
  signedMoney,
  varianceLabelKey,
  varianceTone,
} from '@/components/ui/shift-report-card';
import { useCloseShift, useCurrentShift, useMe } from '@/data/queries';
import type { ShiftReport } from '@/data/types';
import { formatDateTime, formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { canManageCash, printReport } from '@/lib/shift';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useActionKey } from '@/lib/use-action-key';
import { useAuthStore } from '@/store/auth-store';

export default function CloseShift() {
  const { t } = useTranslation();
  const router = useRouter();
  const staff = useAuthStore((s) => s.staff);
  const current = useCurrentShift();
  const close = useCloseShift();
  const action = useActionKey();
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [z, setZ] = useState<ShiftReport | null>(null);

  // Đã chốt → luôn hiện kết quả Z (ca hiện tại lúc này đã là null).
  const zReport = z ?? close.data;
  if (zReport) return <ZResult report={zReport} />;

  const header = (
    <View className="flex-row items-center px-4 py-3">
      <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
        <ChevronLeft size={22} color={color.text.primary} />
      </Pressable>
      <Text className="text-xl font-extrabold text-fg">
        {current.data ? t('shift.closeTitle', { number: current.data.number }) : t('shift.close')}
      </Text>
    </View>
  );

  // Đang chốt: cache ca hiện tại có thể đã về null trước khi kịp có báo cáo Z → chờ, không redirect.
  if (current.isLoading || (!current.data && (close.isPending || close.isSuccess)))
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
        {header}
        <ActivityIndicator className="mt-10" color={color.brand.DEFAULT} />
      </SafeAreaView>
    );
  if (!current.data) return <Redirect href="/(app)/shift" />;
  const shift = current.data;

  if (!canManageCash(staff?.role))
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
        {header}
        <Text className="mt-10 px-6 text-center text-muted">{t('shift.noPermission')}</Text>
      </SafeAreaView>
    );

  const counted = Number(raw || 0);

  const doClose = () =>
    close.mutate(
      { idempotencyKey: action.key(), shiftId: shift.id, countedCash: counted, note: note.trim() || undefined },
      {
        onSuccess: (report) => {
          action.reset();
          haptics.success();
          toast.success(t('shift.closed', { number: report.shift.number }));
          setZ(report);
        },
        onError: (e) => {
          action.settle(e);
          toast.error(t('shift.closeFailed'), (e as Error).message);
        },
      }
    );

  const confirm = () =>
    Alert.alert(t('shift.confirmCloseTitle'), t('shift.confirmCloseMsg', { amount: formatMoney(counted) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('shift.confirmClose'), style: 'destructive', onPress: doClose },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      {header}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Card className="items-center py-5">
          <Text className="text-muted">{t('shift.counted')}</Text>
          <Text className="mt-1 text-4xl font-extrabold text-brand">{formatMoney(counted)}</Text>
          <Text className="mt-2 text-center text-xs text-muted">{t('shift.countHint')}</Text>
        </Card>
        <TextField value={note} onChangeText={setNote} placeholder={t('shift.note')} maxLength={200} />
      </ScrollView>
      <View className="px-4 pb-4">
        <NumericKeypad value={raw} onChange={setRaw} />
        <Button
          className="mt-2"
          label={t('shift.confirmClose')}
          loading={close.isPending}
          onPress={confirm}
          leftIcon={<Lock size={18} color="#fff" />}
        />
      </View>
    </SafeAreaView>
  );
}

/** Kết quả chốt ca (báo cáo Z do server trả). */
function ZResult({ report }: { report: ShiftReport }) {
  const { t } = useTranslation();
  const router = useRouter();
  const me = useMe();
  const [printing, setPrinting] = useState(false);
  const sh = report.shift;
  const variance = report.variance ?? 0;

  const onPrint = async () => {
    setPrinting(true);
    await printReport(report, me.data?.branch, t);
    setPrinting(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="px-4 py-3">
        <Text className="text-xl font-extrabold text-fg">{t('shift.closed', { number: sh.number })}</Text>
        <Text className="text-muted">
          {sh.closedBy && sh.closedAt ? t('shift.closedBy', { name: sh.closedBy.name, time: formatDateTime(sh.closedAt) }) : ''}
        </Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
        <Card>
          <Text className="mb-2 font-semibold text-muted">{t('shift.zResult')}</Text>
          <View className="flex-row justify-between py-1">
            <Text className="text-muted">{t('shift.expected')}</Text>
            <Text className="font-semibold text-fg">{formatMoney(report.cash.expected)}</Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-muted">{t('shift.counted')}</Text>
            <Text className="font-semibold text-fg">{formatMoney(report.counted ?? 0)}</Text>
          </View>
          <View className="mt-1 items-center border-t border-line pt-3">
            <Text className={`font-bold ${varianceTone(variance)}`}>
              {t('shift.variance')} · {t(varianceLabelKey(variance))}
            </Text>
            <Text className={`mt-1 text-3xl font-extrabold ${varianceTone(variance)}`}>{signedMoney(variance)}</Text>
          </View>
          {!!sh.closeNote && <Text className="mt-2 text-muted">{sh.closeNote}</Text>}
        </Card>
        <ShiftReportCard report={report} showCash />
      </ScrollView>
      <View className="gap-2 border-t border-line px-4 pb-4 pt-3">
        <Button
          variant="ghost"
          label={t('shift.printZ')}
          loading={printing}
          onPress={onPrint}
          leftIcon={<Printer size={18} color={color.text.primary} />}
        />
        <Button label={t('shift.done')} onPress={() => router.replace('/(app)/home')} />
      </View>
    </SafeAreaView>
  );
}
