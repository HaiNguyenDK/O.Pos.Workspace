// Màn 9 — tiền mặt: nhập tiền khách đưa, tính thối, gợi ý mệnh giá. NumericKeypad.
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { usePay } from '@/data/queries';
import { calcTotal } from '@/domain/pricing';
import { cashSuggestions } from '@/lib/billing';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import { useOrderStore } from '@/store/order-store';

export default function PaymentCash() {
  const router = useRouter();
  const active = useOrderStore((s) => s.active);
  const items = useOrderStore((s) => s.sentLines);
  const bill = useBillStore();
  const pay = usePay();
  const [raw, setRaw] = useState('');

  if (!active || items.length === 0) return <Redirect href="/(app)/cart" />;

  const total = calcTotal(items, {
    voucher: bill.voucher ?? undefined,
    tip: bill.tip,
    discount: bill.discount,
    service: bill.service,
  }).total;

  const tendered = Number(raw || 0);
  const change = tendered - total;
  const enough = tendered >= total;

  const confirm = () => {
    bill.setTendered(tendered);
    pay.mutate(
      { billId: `b${active.orderId}`, method: 'cash', meta: { tendered } },
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
        <Text className="text-xl font-extrabold text-fg">Tiền mặt</Text>
      </View>

      <View className="px-4">
        <View className="rounded-2xl border border-line bg-surface p-4">
          <View className="flex-row justify-between">
            <Text className="text-muted">Cần thu</Text>
            <Text className="font-bold text-fg">{formatMoney(total)}</Text>
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-muted">Khách đưa</Text>
            <Text className="text-2xl font-extrabold text-brand">{formatMoney(tendered)}</Text>
          </View>
          <View className="mt-2 flex-row justify-between border-t border-line pt-2">
            <Text className="font-bold text-fg">Tiền thối</Text>
            <Text className={`text-lg font-extrabold ${change < 0 ? 'text-muted' : 'text-fg'}`}>
              {change >= 0 ? formatMoney(change) : '—'}
            </Text>
          </View>
        </View>

        {/* Đúng tiền + gợi ý mệnh giá */}
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => { haptics.light(); setRaw(String(total)); }}
            className="flex-row items-center rounded-full border border-brand bg-brand px-4 py-2 active:opacity-80"
          >
            <Check size={16} color="#fff" />
            <Text className="ml-1.5 font-bold text-white">Đúng tiền</Text>
          </Pressable>
          {cashSuggestions(total).map((s) => (
            <Pressable key={s} onPress={() => { haptics.light(); setRaw(String(s)); }} className="rounded-full border border-line bg-surface px-4 py-2 active:opacity-70">
              <Text className="font-semibold text-fg">{formatMoney(s)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-3 flex-1 justify-end px-4 pb-4">
        <NumericKeypad value={raw} onChange={setRaw} />
        <Button className="mt-2" label={`Xác nhận · thối ${change >= 0 ? formatMoney(change) : '—'}`} disabled={!enough} loading={pay.isPending} onPress={confirm} />
      </View>
    </SafeAreaView>
  );
}
