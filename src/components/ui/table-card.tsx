// src/components/ui/table-card.tsx — thẻ bàn trong sơ đồ (màn home). Viền màu theo status.
import { Users } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { StatusChip } from '@/components/ui/status-chip';
import { color } from '@/lib/theme';
import type { DiningTable } from '@/data/types';

export function TableCard({ table, onPress }: { table: DiningTable; onPress?: () => void }) {
  const accent = color.status[table.status];
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl border bg-surface p-4 active:opacity-80"
      style={{ borderColor: `${accent}55` }}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-fg">{table.name}</Text>
        <View className="flex-row items-center">
          <Users size={14} color={color.text.muted} />
          <Text className="ml-1 text-xs text-muted">{table.seats}</Text>
        </View>
      </View>
      <StatusChip status={table.status} />
      <Text className="mt-2 text-xs text-muted">{table.zone}</Text>
    </Pressable>
  );
}
