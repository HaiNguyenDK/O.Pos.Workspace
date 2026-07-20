// Màn 7 — Chia hoá đơn: đều (even) | theo món (by-item). Tính qua domain/split.
// Ghi chú: split tính trên items (tạm tính + thuế), không gồm tip/voucher.
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { calcTotal } from '@/domain/pricing';
import { computeSplit } from '@/domain/split';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { useOrderStore } from '@/store/order-store';
import type { Bill, SplitPlan } from '@/data/types';

type Mode = 'even' | 'by-item';
const BUCKET_COLORS = ['#F37021', '#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#EF4444'];

export default function BillSplit() {
  const router = useRouter();
  const active = useOrderStore((s) => s.active);
  const items = useOrderStore((s) => s.sentLines);

  const [mode, setMode] = useState<Mode>('even');
  const [buckets, setBuckets] = useState(2);
  const [assign, setAssign] = useState<Record<string, number>>({});

  const pseudoBill = useMemo<Bill>(() => {
    const b = calcTotal(items);
    return {
      id: '', code: '', orderId: active?.orderId ?? '', customerName: active?.customerName ?? '',
      items, subtotal: b.subtotal, tax: b.tax, total: b.total, paymentMethod: 'cash', paidAt: '',
    };
  }, [items, active]);

  if (!active || items.length === 0) return <Redirect href="/(app)/bill" />;

  const plan: SplitPlan =
    mode === 'even' ? { mode: 'even', buckets } : { mode: 'by-item', assignments: assign };
  const results = computeSplit(pseudoBill, plan);
  const cycleBucket = (menuItemId: string) =>
    setAssign((a) => ({ ...a, [menuItemId]: ((a[menuItemId] ?? 0) + 1) % buckets }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">Chia hoá đơn</Text>
      </View>

      {/* Mode toggle */}
      <View className="mx-4 mb-3 flex-row rounded-2xl bg-surface p-1">
        {(['even', 'by-item'] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} className={`flex-1 items-center rounded-xl py-2.5 ${mode === m ? 'bg-brand' : ''}`}>
            <Text className={`font-bold ${mode === m ? 'text-white' : 'text-muted'}`}>{m === 'even' ? 'Chia đều' : 'Theo món'}</Text>
          </Pressable>
        ))}
      </View>

      {/* Bucket count */}
      <View className="mx-4 mb-3 flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <Text className="font-semibold text-muted">Số phần</Text>
        <View className="flex-row items-center gap-5">
          <Pressable onPress={() => setBuckets((b) => Math.max(2, b - 1))} className="h-10 w-10 items-center justify-center rounded-full bg-elevated active:opacity-70">
            <Minus size={18} color={color.text.primary} />
          </Pressable>
          <Text className="w-6 text-center text-xl font-extrabold text-fg">{buckets}</Text>
          <Pressable onPress={() => setBuckets((b) => Math.min(6, b + 1))} className="h-10 w-10 items-center justify-center rounded-full bg-brand active:opacity-80">
            <Plus size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 24 }}>
        {/* By-item: gán món vào phần (tap để đổi) */}
        {mode === 'by-item' && (
          <View className="gap-2">
            <Text className="font-semibold text-muted">Chạm món để đổi phần</Text>
            {items.map((l) => {
              const b = assign[l.menuItemId] ?? 0;
              return (
                <Pressable key={l.menuItemId} onPress={() => cycleBucket(l.menuItemId)} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3 active:opacity-80">
                  <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: BUCKET_COLORS[b % BUCKET_COLORS.length] }}>
                    <Text className="font-extrabold text-white">{b + 1}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-fg">{l.quantity}× {l.name}</Text>
                  </View>
                  <Text className="text-muted">{formatMoney(l.price * l.quantity)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Kết quả từng phần */}
        <Text className="mt-2 font-semibold text-muted">Kết quả</Text>
        {Array.from({ length: buckets }).map((_, i) => {
          const r = results.find((x) => x.bucket === i);
          return (
            <View key={i} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-4">
              <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: BUCKET_COLORS[i % BUCKET_COLORS.length] }}>
                <Text className="font-extrabold text-white">{i + 1}</Text>
              </View>
              <Text className="ml-3 flex-1 font-bold text-fg">Phần {i + 1}</Text>
              <Text className="text-lg font-extrabold text-brand">{formatMoney(r?.total ?? 0)}</Text>
            </View>
          );
        })}
        <Text className="mt-1 text-center text-xs text-muted">
          Tổng {buckets} phần = {formatMoney(results.reduce((s, r) => s + r.total, 0))}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
