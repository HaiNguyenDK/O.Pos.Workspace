// src/components/ui/menu-item-card.tsx — thẻ món (grid 2 cột). Gradient từ imageGradient, quick add.
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { parseGradient } from '@/lib/gradient';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import type { MenuItem } from '@/data/types';

export function MenuItemCard({
  item,
  qtyInCart,
  onPress,
  onQuickAdd,
}: {
  item: MenuItem;
  qtyInCart?: number;
  onPress?: () => void;
  onQuickAdd?: () => void;
}) {
  const g = parseGradient(item.imageGradient);
  const soldOut = item.available <= 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={soldOut}
      className={`flex-1 overflow-hidden rounded-2xl border border-line bg-surface active:opacity-80 ${soldOut ? 'opacity-40' : ''}`}
    >
      <LinearGradient colors={g.colors} start={g.start} end={g.end} style={{ height: 84, alignItems: 'center', justifyContent: 'center' }}>
        <Text className="text-4xl">{item.emoji}</Text>
        {!!qtyInCart && qtyInCart > 0 && (
          <View className="absolute right-2 top-2 h-6 min-w-6 items-center justify-center rounded-full bg-cart px-1.5">
            <Text className="text-xs font-bold text-white">{qtyInCart}</Text>
          </View>
        )}
      </LinearGradient>

      <View className="p-3">
        <Text numberOfLines={1} className="font-bold text-fg">{item.name}</Text>
        <Text numberOfLines={1} className="mt-0.5 text-xs text-muted">{item.description}</Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="font-extrabold text-brand">{formatMoney(item.price)}</Text>
          <Pressable
            onPress={onQuickAdd}
            disabled={soldOut}
            hitSlop={8}
            className="h-8 w-8 items-center justify-center rounded-full bg-brand active:opacity-80"
          >
            <Plus size={18} color="#fff" />
          </Pressable>
        </View>
        <Text className="mt-1 text-[10px] text-muted">{soldOut ? 'Hết hàng' : `Còn ${item.available}`}</Text>
      </View>
    </Pressable>
  );
}
