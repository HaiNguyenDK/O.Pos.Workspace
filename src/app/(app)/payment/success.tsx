// Màn 11 — thành công: tóm tắt từ Bill/Payment server trả + in/email/sms/e-invoice (D2 Sunmi).
// Đã chia bill và còn phần chưa thu → "Thu phần tiếp"; thu đủ → "Hoàn tất".
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { CheckCircle2, Mail, MessageSquare, Printer, ReceiptText } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { useBill, useBills, useMe, usePayment } from '@/data/queries';
import { printReceipt } from '@/native/printer';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { methodLabelKey } from '@/lib/status';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import { useCartStore } from '@/store/cart-store';
import { useOrderStore } from '@/store/order-store';

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const router = useRouter();
  const clearOrder = useOrderStore((s) => s.clear);
  const clearCart = useCartStore((s) => s.clear);
  const billState = useBillStore();
  const bill = useBill(billState.billId ?? undefined);
  const payment = usePayment(billState.lastPaymentId ?? undefined);
  const me = useMe();
  const parts = useBills(billState.splitBillIds);

  useEffect(() => {
    haptics.success();
  }, []);

  if (!billState.billId || !billState.lastPaymentId) return <Redirect href="/(app)/home" />;

  const b = bill.data;
  const p = payment.data;
  // Phần chưa thu (bill hiện tại vừa thu xong nên loại ra kể cả khi cache chưa kịp làm mới).
  const remaining = billState.splitBillIds.filter(
    (id, i) => id !== billState.billId && parts[i]?.data?.status !== 'PAID'
  );

  const finish = () => {
    clearOrder();
    clearCart();
    billState.reset();
    router.replace('/(app)/home');
  };

  const nextPart = () => {
    billState.setLastPaymentId(null);
    billState.setBillId(remaining[0]);
    router.replace('/(app)/payment');
  };

  const doPrint = async () => {
    if (!b) return;
    const br = me.data?.branch;
    const res = await printReceipt(b, br ? { name: br.name, address: br.address, phone: br.phone } : undefined);
    if (res.printed) toast.success(t('printer.printed'), b.code);
    else if (res.reason === 'unsupported') toast.info(t('printer.noSunmi'), t('printer.runOnSunmiToPrint'));
    else if (res.reason === 'not_connected') toast.error(t('printer.notConnected'), t('printer.checkService'));
    else toast.error(t('printer.error'), t('printer.tryAgain'));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-1 px-4">
        <View className="items-center pt-10">
          <View className="h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
            <CheckCircle2 size={48} color={color.status.available} />
          </View>
          <Text className="mt-4 text-2xl font-extrabold text-fg">{t('payment.success')}</Text>
          {!p || !b ? (
            <ActivityIndicator className="mt-3" color={color.brand.DEFAULT} />
          ) : (
            <>
              <Text className="mt-1 text-3xl font-extrabold text-brand">{formatMoney(p.amount)}</Text>
              <Text className="mt-1 text-muted">
                {t(methodLabelKey[p.method])} · {b.code}
                {b.part ? ` · ${t('common.partOf', { n: b.part.index + 1, of: b.part.of })}` : ''}
              </Text>
              {p.method === 'CASH' && (p.change ?? 0) > 0 && (
                <Text className="mt-1 text-muted">{t('payment.changeAmount', { amount: formatMoney(p.change ?? 0) })}</Text>
              )}
              {p.confirmedBy === 'STAFF' && p.method !== 'CASH' && (
                <Text className="mt-1 text-xs text-muted">{t('payment.manualConfirmed')}</Text>
              )}
            </>
          )}
        </View>

        {/* Actions */}
        <View className="mt-8 flex-row flex-wrap gap-3">
          <ActionBtn icon={<Printer size={22} color={color.text.primary} />} label={t('payment.printBill')} onPress={doPrint} />
          <ActionBtn icon={<Mail size={22} color={color.text.primary} />} label={t('payment.email')} onPress={() => toast.info(t('payment.sendEmail'), t('payment.laterPhase'))} />
          <ActionBtn icon={<MessageSquare size={22} color={color.text.primary} />} label={t('payment.sms')} onPress={() => toast.info(t('payment.sendSms'), t('payment.laterPhase'))} />
          <ActionBtn icon={<ReceiptText size={22} color={color.text.primary} />} label={t('payment.eInvoice')} onPress={() => toast.info(t('payment.eInvoiceTitle'), t('payment.eInvoicePending'))} />
        </View>
      </View>

      <View className="px-4 pb-4">
        {remaining.length > 0 ? (
          <Button label={t('payment.nextPart')} onPress={nextPart} />
        ) : (
          <Button label={t('payment.done')} onPress={finish} />
        )}
      </View>
    </SafeAreaView>
  );
}

function ActionBtn({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: '47%' }} className="items-center gap-2 rounded-2xl border border-line bg-surface py-5 active:opacity-70">
      {icon}
      <Text className="font-semibold text-fg">{label}</Text>
    </Pressable>
  );
}
