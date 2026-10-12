// src/components/ui/status-chip.tsx — chip trạng thái DÙNG CHUNG map màu status (Mục 3.3).
// Màu lấy từ tokens (traffic-light functional) — KHÔNG dùng brand cam ở đây.
import { useTranslation } from 'react-i18next';
import { View, Text } from '@/tw';
import { color } from '@/lib/theme';

type StatusKey = keyof typeof color.status;

const labelKey: Record<StatusKey, string> = {
  available: 'status.available',
  occupied: 'status.occupied',
  reserved: 'status.reserved',
  pending: 'status.pending',
  ready: 'status.ready',
  paid: 'status.paid',
  cancelled: 'status.cancelled',
};

export function StatusChip({ status, label }: { status: StatusKey; label?: string }) {
  const { t } = useTranslation();
  const c = color.status[status];
  return (
    <View
      className="flex-row items-center self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: `${c}22` }}
    >
      <View className="mr-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
      <Text className="text-xs font-semibold" style={{ color: c }}>
        {label ?? t(labelKey[status])}
      </Text>
    </View>
  );
}
