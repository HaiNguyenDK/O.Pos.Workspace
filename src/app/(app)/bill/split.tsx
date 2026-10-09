// Màn 7 — Chia hoá đơn: đều (EVEN) | theo món (BY_LINE, gán theo lineId).
// Xem trước bằng domain/split trên số của Bill server; "Chốt chia" → splitBill tạo các bill con để thu từng phần.
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { useBill, useBranchSettings, useOrder, useSplitBill } from '@/data/queries';
import { modifierText } from '@/domain/modifiers';
import { computeSplit } from '@/domain/split';
import { isPosApiError, type SplitPlan } from '@/data/types';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useActionKey } from '@/lib/use-action-key';
import { useBillStore } from '@/store/bill-store';
import { useOrderStore } from '@/store/order-store';

type Mode = SplitPlan['mode'];
const BUCKET_COLORS = ['#F37021', '#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#EF4444'];

export default function BillSplit() {
  const { t } = useTranslation();
  const router = useRouter();
  const active = useOrderStore((s) => s.active);
  const billId = useBillStore((s) => s.billId);
  const setSplitBillIds = useBillStore((s) => s.setSplitBillIds);
  const order = useOrder(active?.orderId);
  const bill = useBill(billId ?? undefined);
  const settings = useBranchSettings();
  const split = useSplitBill();
  const action = useActionKey();

  const [mode, setMode] = useState<Mode>('EVEN');
  const [parts, setParts] = useState(2);
  const [assign, setAssign] = useState<Record<string, number>>({});

  const lines = (order.data?.lines ?? []).filter((l) => l.status !== 'VOIDED');
  if (!active || !bill.data || !order.data || !settings || lines.length === 0) return <Redirect href="/(app)/bill" />;

  const plan: SplitPlan =
    mode === 'EVEN' ? { mode: 'EVEN', parts } : { mode: 'BY_LINE', parts, assignments: assign };
  const results = computeSplit(lines, bill.data, settings, plan);
  const cycle = (lineId: string) => setAssign((a) => ({ ...a, [lineId]: ((a[lineId] ?? 0) + 1) % parts }));
  const emptyPart = mode === 'BY_LINE' && results.some((r) => r.lineIds.length === 0);

  const confirm = () =>
    split.mutate(
      { idempotencyKey: action.key(), orderId: active.orderId, expectedVersion: order.data!.version, plan },
      {
        onSuccess: (bills) => {
          action.reset();
          setSplitBillIds(bills.map((b) => b.id));
          router.replace('/(app)/payment');
        },
        onError: (e) => {
          action.settle(e);
          if (isPosApiError(e) && e.code === 'VERSION_CONFLICT') {
            order.refetch();
            return toast.error(t('common.orderChanged'), t('split.reloadedCheck'));
          }
          toast.error(t('split.failed'), (e as Error).message);
        },
      }
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">{t('bill.split')}</Text>
      </View>

      {/* Mode toggle */}
      <View className="mx-4 mb-3 flex-row rounded-2xl bg-surface p-1">
        {(['EVEN', 'BY_LINE'] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} className={`flex-1 items-center rounded-xl py-2.5 ${mode === m ? 'bg-brand' : ''}`}>
            <Text className={`font-bold ${mode === m ? 'text-white' : 'text-muted'}`}>{m === 'EVEN' ? t('split.even') : t('split.byLine')}</Text>
          </Pressable>
        ))}
      </View>

      {/* Số phần */}
      <View className="mx-4 mb-3 flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <Text className="font-semibold text-muted">{t('split.parts')}</Text>
        <View className="flex-row items-center gap-5">
          <Pressable onPress={() => setParts((b) => Math.max(2, b - 1))} className="h-10 w-10 items-center justify-center rounded-full bg-elevated active:opacity-70">
            <Minus size={18} color={color.text.primary} />
          </Pressable>
          <Text className="w-6 text-center text-xl font-extrabold text-fg">{parts}</Text>
          <Pressable onPress={() => setParts((b) => Math.min(6, b + 1))} className="h-10 w-10 items-center justify-center rounded-full bg-brand active:opacity-80">
            <Plus size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 24 }}>
        {/* BY_LINE: gán từng dòng món vào phần (tap để đổi) */}
        {mode === 'BY_LINE' && (
          <View className="gap-2">
            <Text className="font-semibold text-muted">{t('split.tapToMove')}</Text>
            {lines.map((l) => {
              const b = Math.min(parts - 1, assign[l.id] ?? 0);
              return (
                <Pressable key={l.id} onPress={() => cycle(l.id)} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-80">
                  <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: BUCKET_COLORS[b % BUCKET_COLORS.length] }}>
                    <Text className="font-extrabold text-white">{b + 1}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-fg">{l.quantity}× {l.name}</Text>
                    {l.modifiers.length > 0 && <Text className="text-xs text-muted">{modifierText(l.modifiers)}</Text>}
                    {!!l.note && <Text className="text-xs text-muted">{l.note}</Text>}
                  </View>
                  <Text className="text-muted">{formatMoney(l.lineTotal)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Kết quả từng phần (gồm giảm giá, phí, thuế, tip phân bổ) */}
        <Text className="mt-2 font-semibold text-muted">{t('split.result')}</Text>
        {results.map((r) => (
          <View key={r.index} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-4">
            <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: BUCKET_COLORS[r.index % BUCKET_COLORS.length] }}>
              <Text className="font-extrabold text-white">{r.index + 1}</Text>
            </View>
            <Text className="ml-3 flex-1 font-bold text-fg">{t('common.part', { n: r.index + 1 })}</Text>
            <Text className="text-lg font-extrabold text-brand">{formatMoney(r.total)}</Text>
          </View>
        ))}
        <Text className="mt-1 text-center text-xs text-muted">
          {t('split.summary', {
            parts,
            sum: formatMoney(results.reduce((s, r) => s + r.total, 0)),
            total: formatMoney(bill.data.total),
          })}
        </Text>
      </ScrollView>

      <View className="border-t border-line px-4 py-4">
        <Button
          label={emptyPart ? t('split.emptyPart') : t('split.confirm', { parts })}
          disabled={emptyPart}
          loading={split.isPending}
          onPress={confirm}
        />
      </View>
    </SafeAreaView>
  );
}
