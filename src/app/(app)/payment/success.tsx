// Màn 11 — thành công: tóm tắt + in/email/sms/e-invoice. In gọi printer stub (D2 — thật ở Sprint 3).
import { Redirect, useRouter } from 'expo-router';
import { CheckCircle2, Mail, MessageSquare, Printer, ReceiptText } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { calcTotal } from '@/domain/pricing';
import { printer } from '@/native/printer';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import { useCartStore } from '@/store/cart-store';
import { useOrderStore } from '@/store/order-store';
import type { Bill, PaymentMethod } from '@/data/types';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Tiền mặt', qr: 'VietQR', card: 'Thẻ', ewallet: 'Ví điện tử' };

export default function PaymentSuccess() {
  const router = useRouter();
  const active = useOrderStore((s) => s.active);
  const items = useOrderStore((s) => s.sentLines);
  const clearOrder = useOrderStore((s) => s.clear);
  const clearCart = useCartStore((s) => s.clear);
  const bill = useBillStore();

  if (!active || items.length === 0) return <Redirect href="/(app)/home" />;

  const breakdown = calcTotal(items, {
    voucher: bill.voucher ?? undefined,
    tip: bill.tip,
    discount: bill.discount,
    service: bill.service,
  });
  const method = bill.method ?? 'cash';
  const change = method === 'cash' ? bill.tendered - breakdown.total : 0;

  const receipt: Bill = {
    id: `b${active.orderId}`,
    code: `HD-${active.orderId.slice(-4)}`,
    orderId: active.orderId,
    customerName: active.customerName,
    tableName: active.tableName,
    tableCode: active.tableId,
    items,
    subtotal: breakdown.subtotal,
    tax: breakdown.tax,
    total: breakdown.total,
    paymentMethod: method,
    paidAt: new Date().toISOString(),
  };

  const finish = () => {
    clearOrder();
    clearCart();
    bill.reset();
    router.replace('/(app)/home');
  };

  const doPrint = async () => {
    await printer.printReceipt(receipt);
    toast.info('Máy in chưa cấu hình', 'Đã log hoá đơn (stub) — sẽ in thật ở Sprint 3');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-1 px-4">
        <View className="items-center pt-10">
          <View className="h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
            <CheckCircle2 size={48} color={color.status.available} />
          </View>
          <Text className="mt-4 text-2xl font-extrabold text-fg">Thanh toán thành công</Text>
          <Text className="mt-1 text-3xl font-extrabold text-brand">{formatMoney(breakdown.total)}</Text>
          <Text className="mt-1 text-muted">{METHOD_LABEL[method]} · {receipt.code}</Text>
          {method === 'cash' && change > 0 && (
            <Text className="mt-1 text-muted">Tiền thối: {formatMoney(change)}</Text>
          )}
        </View>

        {/* Actions */}
        <View className="mt-8 flex-row flex-wrap gap-3">
          <ActionBtn icon={<Printer size={22} color={color.text.primary} />} label="In bill" onPress={doPrint} />
          <ActionBtn icon={<Mail size={22} color={color.text.primary} />} label="Email" onPress={() => toast.info('Gửi email', 'Tính năng ở giai đoạn sau')} />
          <ActionBtn icon={<MessageSquare size={22} color={color.text.primary} />} label="SMS" onPress={() => toast.info('Gửi SMS', 'Tính năng ở giai đoạn sau')} />
          <ActionBtn icon={<ReceiptText size={22} color={color.text.primary} />} label="HĐ điện tử" onPress={() => toast.info('Hoá đơn điện tử', 'TCT — giai đoạn P3')} />
        </View>
      </View>

      <View className="px-4 pb-4">
        <Button label="Hoàn tất" onPress={finish} />
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
