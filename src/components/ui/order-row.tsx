// src/components/ui/order-row.tsx — dòng đơn đang chạy (tab "Đơn" màn home).
// Số tiền là tạm tính các món chưa huỷ (Order không mang tổng — tổng chuẩn nằm ở Bill).
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { StatusChip } from '@/components/ui/status-chip';
import { calcSubtotal } from '@/domain/pricing';
import { color } from '@/lib/theme';
import { formatMoney, formatTime } from '@/lib/format';
import { orderLabel, orderTone } from '@/lib/status';
import type { Order } from '@/data/types';

export function OrderRow({ order, onPress }: { order: Order; onPress?: () => void }) {
  const lines = order.lines.filter((l) => l.status !== 'VOIDED');
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl border border-line bg-surface p-4 active:opacity-80"
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-fg">{order.tableName ?? order.customerName ?? order.code}</Text>
          <StatusChip status={orderTone[order.status]} label={orderLabel[order.status]} />
        </View>
        <Text className="mt-1 text-xs text-muted">
          {order.code} · {lines.length} món · {formatTime(order.updatedAt)}
        </Text>
      </View>
      <Text className="mr-2 text-base font-extrabold text-brand">{formatMoney(calcSubtotal(lines))}</Text>
      <ChevronRight size={18} color={color.text.muted} />
    </Pressable>
  );
}
