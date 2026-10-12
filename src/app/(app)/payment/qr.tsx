// Màn 10 — VietQR (D8): startPayment(VIETQR) → server trả qr.payload + expiresAt → poll trạng thái.
// PAID chỉ khi cổng thanh toán báo về. Xác nhận tay = ngoại lệ, cần PIN quản lý (D12). Rời màn → huỷ payment đang chờ.
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { ApprovalSheet, type ApprovalSheetHandle } from '@/components/sheets/approval-sheet';
import {
  invalidateAfterPayment,
  useBill,
  useCancelPayment,
  useConfirmPaymentManually,
  usePayment,
  useStartPayment,
} from '@/data/queries';
import { isPosApiError } from '@/data/types';
import { formatMoney } from '@/lib/format';
import { newId } from '@/lib/id';
import { handleShiftRequired } from '@/lib/shift';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';

export default function PaymentQr() {
  const { t } = useTranslation();
  const router = useRouter();
  const approvalSheet = useRef<ApprovalSheetHandle>(null);
  const qc = useQueryClient();
  const billId = useBillStore((s) => s.billId);
  const setLastPaymentId = useBillStore((s) => s.setLastPaymentId);
  const bill = useBill(billId ?? undefined);

  const start = useStartPayment();
  const cancel = useCancelPayment();
  const confirmManual = useConfirmPaymentManually();

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const payment = usePayment(paymentId ?? undefined);
  const p = payment.data;
  const [now, setNow] = useState(Date.now());
  const leaving = useRef(false);

  const due = bill.data ? bill.data.total - bill.data.paidAmount : 0;

  const create = () => {
    if (!billId || !bill.data) return;
    start.mutate(
      { idempotencyKey: newId(), billId, clientRef: newId(), method: 'VIETQR', amount: due },
      {
        onSuccess: (np) => setPaymentId(np.id),
        onError: (e) => {
          // Đã có giao dịch chờ (vd quay lại màn) → dùng tiếp giao dịch đó.
          const pending = bill.data?.payments.find((x) => x.status === 'PENDING' && x.method === 'VIETQR');
          if (isPosApiError(e) && e.code === 'PAYMENT_PENDING' && pending) return setPaymentId(pending.id);
          // D14: máy chưa mở ca → nhắc mở ca (chạm toast → màn Ca làm việc).
          if (handleShiftRequired(e, t, () => router.replace('/(app)/shift'))) return;
          toast.error(t('payment.qrCreateFailed'), (e as Error).message);
        },
      }
    );
  };

  // Tạo mã khi có bill.
  useEffect(() => {
    if (bill.data && !paymentId && !start.isPending) create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill.data?.id]);

  // Đồng hồ đếm ngược.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Cổng báo có → làm mới bill (poll không qua mutation) rồi sang màn thành công.
  useEffect(() => {
    if (p?.status === 'SUCCEEDED') {
      leaving.current = true;
      invalidateAfterPayment(qc, p.billId);
      setLastPaymentId(p.id);
      router.replace('/(app)/payment/success');
    }
  }, [p?.status, p?.id, p?.billId, qc, router, setLastPaymentId]);

  // Rời màn khi còn chờ → huỷ để có thể đổi phương thức.
  const latest = useRef(p);
  latest.current = p;
  useEffect(
    () => () => {
      const cur = latest.current;
      if (!leaving.current && cur?.status === 'PENDING') cancel.mutate({ idempotencyKey: newId(), paymentId: cur.id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!billId) return <Redirect href="/(app)/payment" />;

  const expiresAt = p?.qr ? Date.parse(p.qr.expiresAt) : 0;
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const expired = !!p && (p.status === 'EXPIRED' || (p.status === 'PENDING' && left === 0));
  const ended = p && ['FAILED', 'CANCELLED'].includes(p.status);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  const regenerate = () => {
    const old = p;
    setPaymentId(null);
    if (old?.status === 'PENDING')
      cancel.mutate({ idempotencyKey: newId(), paymentId: old.id }, { onSettled: create });
    else create();
  };

  const manualConfirm = () =>
    p &&
    approvalSheet.current?.request('CONFIRM_PAYMENT', t('payment.manualApproval', { amount: formatMoney(p.amount) }), (a) =>
      confirmManual.mutate(
        { idempotencyKey: newId(), paymentId: p.id, approvalToken: a.approvalToken, reason: 'Khách đã chuyển, cổng chưa báo về' },
        { onError: (e) => toast.error(t('payment.manualFailed'), (e as Error).message) }
      )
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">{t('payment.qr')}</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <Text className="mb-1 text-muted">{t('payment.scanToPay')}</Text>
        <Text className="mb-6 text-3xl font-extrabold text-brand">{formatMoney(p?.amount ?? due)}</Text>

        <View className="rounded-3xl bg-white p-5" style={{ opacity: expired || ended ? 0.3 : 1 }}>
          {p?.qr ? <QRCode value={p.qr.payload} size={220} /> : <ActivityIndicator style={{ width: 220, height: 220 }} />}
        </View>

        <Text className={`mt-6 text-lg font-bold ${expired || ended ? 'text-cancelled' : 'text-fg'}`}>
          {!p
            ? t('payment.qrCreating')
            : expired
              ? t('payment.qrExpired')
              : ended
                ? t('payment.qrCancelled')
                : t('payment.qrValidFor', { time: `${mm}:${ss}` })}
        </Text>
        {p?.status === 'PENDING' && !expired && <Text className="mt-2 text-muted">{t('payment.waitingBank')}</Text>}
      </View>

      <View className="gap-3 px-4 pb-4">
        {expired || ended ? (
          <Button label={t('payment.qrRegenerate')} loading={start.isPending || cancel.isPending} onPress={regenerate} />
        ) : (
          <Button
            variant="ghost"
            label={t('payment.manualConfirm')}
            disabled={p?.status !== 'PENDING'}
            loading={confirmManual.isPending}
            onPress={manualConfirm}
          />
        )}
      </View>
      <ApprovalSheet ref={approvalSheet} />
    </SafeAreaView>
  );
}
