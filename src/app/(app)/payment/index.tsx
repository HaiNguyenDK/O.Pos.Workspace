// Màn 8 — chọn phương thức: tiền mặt / VietQR / thẻ / chia. Thẻ = mock thu ngay.
import { Redirect, useRouter } from 'expo-router';
import { Banknote, ChevronLeft, ChevronRight, CreditCard, QrCode, Split } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '@/tw';
import { usePay } from '@/data/queries';
import { calcTotal } from '@/domain/pricing';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import { useOrderStore } from '@/store/order-store';

export default function Payment() {
  const router = useRouter();
  const active = useOrderStore((s) => s.active);
  const items = useOrderStore((s) => s.sentLines);
  const bill = useBillStore();
  const pay = usePay();

  if (!active || items.length === 0) return <Redirect href="/(app)/cart" />;

  const total = calcTotal(items, {
    voucher: bill.voucher ?? undefined,
    tip: bill.tip,
    discount: bill.discount,
    service: bill.service,
  }).total;

  const payCard = () => {
    bill.setMethod('card');
    pay.mutate(
      { billId: `b${active.orderId}`, method: 'card' },
      {
        onSuccess: () => router.replace('/(app)/payment/success'),
        onError: (e) => toast.error('Lỗi thanh toán', (e as Error).message),
      }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">Thanh toán</Text>
      </View>

      {/* Total */}
      <View className="mx-4 mb-4 items-center rounded-2xl border border-line bg-surface py-6">
        <Text className="text-muted">Cần thu</Text>
        <Text className="mt-1 text-4xl font-extrabold text-brand">{formatMoney(total)}</Text>
        <Text className="mt-1 text-xs text-muted">{active.tableName ?? 'Mang về'} · {active.customerName}</Text>
      </View>

      <View className="gap-3 px-4">
        <Method icon={<Banknote size={24} color={color.brand.DEFAULT} />} label="Tiền mặt" onPress={() => { bill.setMethod('cash'); router.push('/(app)/payment/cash'); }} />
        <Method icon={<QrCode size={24} color={color.brand.DEFAULT} />} label="VietQR" onPress={() => { bill.setMethod('qr'); router.push('/(app)/payment/qr'); }} />
        <Method icon={<CreditCard size={24} color={color.brand.DEFAULT} />} label="Thẻ" sub={pay.isPending ? 'Đang xử lý…' : undefined} onPress={payCard} />
        <Method icon={<Split size={24} color={color.brand.DEFAULT} />} label="Chia hoá đơn" onPress={() => router.push('/(app)/bill/split')} />
      </View>
    </SafeAreaView>
  );
}

function Method({ icon, label, sub, onPress }: { icon: React.ReactNode; label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-4 active:opacity-80">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-elevated">{icon}</View>
      <View className="ml-3 flex-1">
        <Text className="text-base font-bold text-fg">{label}</Text>
        {!!sub && <Text className="text-xs text-muted">{sub}</Text>}
      </View>
      <ChevronRight size={20} color={color.text.muted} />
    </Pressable>
  );
}
