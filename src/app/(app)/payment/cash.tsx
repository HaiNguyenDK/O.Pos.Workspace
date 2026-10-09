// Màn 9 — tiền mặt: nhập tiền khách đưa, tính thối, gợi ý mệnh giá. NumericKeypad.
// Số cần thu lấy từ Bill server; startPayment(CASH) — server ghi nhận và trả tiền thối.
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { useBill, useStartPayment } from '@/data/queries';
import { cashSuggestions } from '@/lib/billing';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { newId } from '@/lib/id';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useActionKey } from '@/lib/use-action-key';
import { useBillStore } from '@/store/bill-store';

export default function PaymentCash() {
  const router = useRouter();
  const billId = useBillStore((s) => s.billId);
  const setLastPaymentId = useBillStore((s) => s.setLastPaymentId);
  const bill = useBill(billId ?? undefined);
  const start = useStartPayment();
  const action = useActionKey();
  const [clientRef] = useState(newId);
  const [raw, setRaw] = useState('');

  if (!billId) return <Redirect href="/(app)/payment" />;
  const b = bill.data;
  const due = b ? b.total - b.paidAmount : 0;

  const tendered = Number(raw || 0);
  const change = tendered - due;
  const enough = !!b && tendered >= due;

  const confirm = () => {
    start.mutate(
      { idempotencyKey: action.key(), billId, clientRef, method: 'CASH', amount: due, tendered },
      {
        onSuccess: (p) => {
          action.reset();
          setLastPaymentId(p.id);
          router.replace('/(app)/payment/success');
        },
        onError: (e) => {
          action.settle(e);
          toast.error('Lỗi thanh toán', (e as Error).message);
        },
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
            <Text className="font-bold text-fg">{formatMoney(due)}</Text>
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
            onPress={() => { haptics.light(); setRaw(String(due)); }}
            className="flex-row items-center rounded-full border border-brand bg-brand px-4 py-2 active:opacity-80"
          >
            <Check size={16} color="#fff" />
            <Text className="ml-1.5 font-bold text-white">Đúng tiền</Text>
          </Pressable>
          {cashSuggestions(due).map((s) => (
            <Pressable key={s} onPress={() => { haptics.light(); setRaw(String(s)); }} className="rounded-full border border-line bg-surface px-4 py-2 active:opacity-70">
              <Text className="font-semibold text-fg">{formatMoney(s)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="mt-3 flex-1 justify-end px-4 pb-4">
        <NumericKeypad value={raw} onChange={setRaw} />
        <Button className="mt-2" label={`Xác nhận · thối ${change >= 0 ? formatMoney(change) : '—'}`} disabled={!enough} loading={start.isPending} onPress={confirm} />
      </View>
    </SafeAreaView>
  );
}
