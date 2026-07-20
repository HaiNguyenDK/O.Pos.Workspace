// src/components/ui/status-chip.tsx — chip trạng thái DÙNG CHUNG map màu status (Mục 3.3).
// Màu lấy từ tokens (traffic-light functional) — KHÔNG dùng brand cam ở đây.
import { View, Text } from '@/tw';
import { color } from '@/lib/theme';

type StatusKey = keyof typeof color.status;

const labelVi: Record<StatusKey, string> = {
  available: 'Trống',
  occupied: 'Có khách',
  reserved: 'Đã đặt',
  pending: 'Chờ',
  ready: 'Sẵn sàng',
  paid: 'Đã thu',
  cancelled: 'Đã huỷ',
};

export function StatusChip({ status, label }: { status: StatusKey; label?: string }) {
  const c = color.status[status];
  return (
    <View
      className="flex-row items-center self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: `${c}22` }}
    >
      <View className="mr-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
      <Text className="text-xs font-semibold" style={{ color: c }}>
        {label ?? labelVi[status]}
      </Text>
    </View>
  );
}
