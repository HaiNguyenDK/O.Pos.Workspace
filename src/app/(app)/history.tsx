// Màn 12 — Lịch sử hoá đơn: search, infinite scroll (paginate), in lại.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Printer, Search } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from '@/tw';
import { ErrorState } from '@/components/ui/error-state';
import { useHistoryInfinite } from '@/data/queries';
import { printReceipt } from '@/native/printer';
import { formatDateTime, formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { Bill, PaymentMethod } from '@/data/types';
import { methodLabel } from '@/lib/status';

const METHOD: Record<PaymentMethod, { label: string; color: string }> = {
  CASH: { label: methodLabel.CASH, color: color.status.available },
  VIETQR: { label: methodLabel.VIETQR, color: color.status.reserved },
  CARD: { label: methodLabel.CARD, color: color.brand.DEFAULT },
  EWALLET: { label: 'Ví', color: color.status.pending },
};

export default function History() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const q = useHistoryInfinite(search.trim() || undefined);

  const bills = useMemo(
    () =>
      (q.data?.pages.flatMap((p) => p.items) ?? []).sort(
        (a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')
      ),
    [q.data]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">{t('nav.history')}</Text>
      </View>

      {/* Search */}
      <View className="mx-4 mb-3 flex-row items-center rounded-2xl border border-line bg-surface px-3">
        <Search size={18} color={color.text.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm mã HĐ / khách…"
          placeholderTextColor={color.text.muted}
          className="flex-1 px-2 py-3 text-base text-fg"
        />
      </View>

      {q.isLoading ? (
        <Center><ActivityIndicator color={color.brand.DEFAULT} /></Center>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          ListEmptyComponent={<Center><Text className="text-muted">{t('common.empty')}</Text></Center>}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={color.brand.DEFAULT} style={{ marginVertical: 12 }} /> : null}
          renderItem={({ item }) => <BillRow bill={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function BillRow({ bill }: { bill: Bill }) {
  const paid = bill.payments.filter((p) => p.status === 'SUCCEEDED');
  const m = METHOD[paid[paid.length - 1]?.method ?? 'CASH'];
  const reprint = async () => {
    haptics.light();
    const res = await printReceipt(bill);
    if (res.printed) toast.success('Đã in lại', bill.code);
    else if (res.reason === 'unsupported') toast.info('Không có máy in Sunmi', bill.code);
    else toast.error('In lỗi', bill.code);
  };
  return (
    <View className="flex-row items-center rounded-2xl border border-line bg-surface p-4">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-bold text-fg">{bill.code}</Text>
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${m.color}22` }}>
            <Text className="text-[10px] font-semibold" style={{ color: m.color }}>{m.label}</Text>
          </View>
        </View>
        <Text className="mt-1 text-xs text-muted">
          {bill.tableName ?? '—'} · {bill.customerName} · {formatDateTime(bill.paidAt ?? bill.createdAt)}
        </Text>
        <Text className="mt-1 font-extrabold text-brand">{formatMoney(bill.total)}</Text>
      </View>
      <Pressable onPress={reprint} className="h-11 w-11 items-center justify-center rounded-full bg-elevated active:opacity-70">
        <Printer size={18} color={color.text.primary} />
      </Pressable>
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center py-16">{children}</View>;
}
