// src/components/ui/order-row.tsx — dòng đơn đang chạy (tab "Đơn" màn home).
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { StatusChip } from '@/components/ui/status-chip';
import { color } from '@/lib/theme';
import { formatMoney, formatTime } from '@/lib/format';
import type { Order, OrderStatus } from '@/data/types';

// Order status → status-chip key (traffic-light). served/completed coi như paid tone.
const toChip = (s: OrderStatus): keyof typeof color.status =>
  s === 'pending' || s === 'preparing'
    ? 'pending'
    : s === 'ready'
      ? 'ready'
      : s === 'cancelled'
        ? 'cancelled'
        : 'paid';

export function OrderRow({ order, onPress }: { order: Order; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl border border-line bg-surface p-4 active:opacity-80"
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-fg">{order.tableName ?? order.customerName}</Text>
          <StatusChip status={toChip(order.status)} />
        </View>
        <Text className="mt-1 text-xs text-muted">
          {order.code} · {order.items.length} món · {formatTime(order.updatedAt)}
        </Text>
      </View>
      <Text className="mr-2 text-base font-extrabold text-brand">{formatMoney(order.total)}</Text>
      <ChevronRight size={18} color={color.text.muted} />
    </Pressable>
  );
}
