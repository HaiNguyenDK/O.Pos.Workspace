// Ca làm việc (pos-plan Mục 3.7, D14) — ca theo MÁY.
// Chưa có ca → form mở ca (tiền lẻ đầu ca). Có ca → báo cáo X sống + In X, Thu/chi tiền mặt, Chốt ca.
// Đếm mù: người không phải quản lý KHÔNG thấy tiền hệ thống giữa ca (chỉ thấy sau khi chốt).
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Lock, Printer, Wallet } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { ShiftReportCard } from '@/components/ui/shift-report-card';
import { ApprovalSheet, type ApprovalSheetHandle } from '@/components/sheets/approval-sheet';
import {
  CashMovementSheet,
  type CashMovementDraft,
  type CashMovementSheetHandle,
} from '@/components/sheets/cash-movement-sheet';
import { useAddCashMovement, useCurrentShift, useMe, useOpenShift, useShiftReport } from '@/data/queries';
import { isPosApiError, type Shift } from '@/data/types';
import { formatDateTime, formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { newId } from '@/lib/id';
import { canManageCash, canOpenShift, isManager, printReport } from '@/lib/shift';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useActionKey } from '@/lib/use-action-key';
import { shortTerminalId } from '@/native/receipt';
import { useAuthStore } from '@/store/auth-store';

export default function ShiftScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const current = useCurrentShift();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">{t('shift.title')}</Text>
      </View>

      {current.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.brand.DEFAULT} />
        </View>
      ) : current.isError ? (
        <ErrorState onRetry={() => current.refetch()} />
      ) : current.data ? (
        <OpenShiftView shift={current.data} />
      ) : (
        <OpenShiftForm />
      )}
    </SafeAreaView>
  );
}

/** Chưa có ca → nhập tiền lẻ đầu ca rồi mở ca. */
function OpenShiftForm() {
  const { t } = useTranslation();
  const staff = useAuthStore((s) => s.staff);
  const open = useOpenShift();
  const action = useActionKey();
  const [raw, setRaw] = useState('');
  const amount = Number(raw || 0);
  const allowed = canOpenShift(staff?.role);

  const submit = () =>
    open.mutate(
      { idempotencyKey: action.key(), openingFloat: amount },
      {
        onSuccess: (sh) => {
          action.reset();
          haptics.success();
          toast.success(t('shift.opened', { number: sh.number }));
        },
        onError: (e) => {
          action.settle(e);
          if (isPosApiError(e) && e.code === 'SHIFT_ALREADY_OPEN') toast.info(t('shift.alreadyOpen'));
          else toast.error(t('shift.openFailed'), (e as Error).message);
        },
      }
    );

  return (
    <View className="flex-1 px-4 pb-4">
      <Card className="items-center py-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-elevated">
          <Wallet size={26} color={color.brand.DEFAULT} />
        </View>
        <Text className="mt-3 text-lg font-extrabold text-fg">{t('shift.openTitle')}</Text>
        <Text className="mt-1 text-center text-muted">{t('shift.openHint')}</Text>
        <Text className="mt-4 text-muted">{t('shift.openingFloat')}</Text>
        <Text className="mt-1 text-4xl font-extrabold text-brand">{formatMoney(amount)}</Text>
      </Card>
      {!allowed && <Text className="mt-3 text-center text-cancelled">{t('shift.noPermission')}</Text>}
      <View className="flex-1 justify-end">
        <NumericKeypad value={raw} onChange={setRaw} />
        <Button className="mt-2" label={t('shift.open')} disabled={!allowed} loading={open.isPending} onPress={submit} />
      </View>
    </View>
  );
}

/** Ca đang mở → báo cáo X + thao tác. */
function OpenShiftView({ shift }: { shift: Shift }) {
  const { t } = useTranslation();
  const router = useRouter();
  const staff = useAuthStore((s) => s.staff);
  const me = useMe();
  const report = useShiftReport(shift.id, true);
  const addMove = useAddCashMovement();
  const moveSheet = useRef<CashMovementSheetHandle>(null);
  const approvalSheet = useRef<ApprovalSheetHandle>(null);
  const [printing, setPrinting] = useState(false);

  const manager = isManager(staff?.role);
  const cashier = canManageCash(staff?.role);

  const onPrintX = async () => {
    if (!report.data) return;
    setPrinting(true);
    await printReport(report.data, me.data?.branch, t, { showCash: manager });
    setPrinting(false);
  };

  // Mỗi lần gửi = 1 idempotencyKey mới (payload có/không approvalToken là 2 yêu cầu khác nhau).
  const submitMove = (d: CashMovementDraft) => {
    const run = (approvalToken?: string) =>
      addMove.mutate(
        { idempotencyKey: newId(), shiftId: shift.id, ...d, approvalToken },
        {
          onSuccess: () => {
            haptics.success();
            toast.success(t('shift.cashMoveSaved'), `${d.type === 'IN' ? '+' : '-'}${formatMoney(d.amount)} · ${d.reason}`);
          },
          onError: (e) => {
            // Server đòi duyệt (vd vai trò đổi) → mở PIN quản lý rồi gửi lại.
            if (isPosApiError(e) && e.code === 'APPROVAL_REQUIRED' && !approvalToken) return askApproval();
            toast.error(t('shift.cashMoveFailed'), (e as Error).message);
          },
        }
      );
    const askApproval = () =>
      approvalSheet.current?.request('CASH_OUT', t('shift.cashOutApproval', { amount: formatMoney(d.amount) }), (a) =>
        run(a.approvalToken)
      );
    if (d.type === 'OUT' && !manager) askApproval();
    else run();
  };

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>
        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-extrabold text-fg">{t('shift.number', { number: shift.number })}</Text>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
              <Text className="text-xs font-bold text-available">{t('shift.statusOpen', { number: shift.number })}</Text>
            </View>
          </View>
          <Text className="mt-1 text-muted">
            {t('shift.openedBy', { name: shift.openedBy.name, time: formatDateTime(shift.openedAt) })}
          </Text>
          <Text className="text-xs text-muted">{t('shift.terminal', { id: shortTerminalId(shift.terminalId) })}</Text>
        </Card>

        <Text className="px-1 font-semibold text-muted">{t('shift.xLive')}</Text>
        {report.isLoading ? (
          <ActivityIndicator color={color.brand.DEFAULT} />
        ) : report.isError || !report.data ? (
          <ErrorState onRetry={() => report.refetch()} />
        ) : (
          <ShiftReportCard report={report.data} showCash={manager} />
        )}
      </ScrollView>

      <View className="gap-2 border-t border-line px-4 pb-4 pt-3">
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            variant="ghost"
            label={t('shift.printX')}
            loading={printing}
            disabled={!report.data}
            onPress={onPrintX}
            leftIcon={<Printer size={18} color={color.text.primary} />}
          />
          {cashier && (
            <Button
              className="flex-1"
              variant="ghost"
              label={t('shift.cashMove')}
              loading={addMove.isPending}
              onPress={() => moveSheet.current?.present()}
              leftIcon={<Wallet size={18} color={color.text.primary} />}
            />
          )}
        </View>
        {cashier && (
          <Button
            label={t('shift.close')}
            onPress={() => router.push('/(app)/shift/close')}
            leftIcon={<Lock size={18} color="#fff" />}
          />
        )}
      </View>

      <CashMovementSheet ref={moveSheet} onSubmit={submitMove} needsApprovalForOut={!manager} />
      <ApprovalSheet ref={approvalSheet} />
    </>
  );
}
