// Màn 4 — thực đơn: grid 2 cột, category tabs ngang, quick add, modifier sheet.
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ShoppingCart } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { MenuItemCard } from '@/components/ui/menu-item-card';
import { ModifierSheet, type ModifierSheetHandle } from '@/components/sheets/modifier-sheet';
import { ErrorState } from '@/components/ui/error-state';
import { useMenu } from '@/data/queries';
import { color } from '@/lib/theme';
import { formatMoney } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { useCartStore } from '@/store/cart-store';
import { useOrderStore } from '@/store/order-store';
import type { MenuItem } from '@/data/types';

export default function Menu() {
  const router = useRouter();
  const menu = useMenu();
  const modifier = useRef<ModifierSheetHandle>(null);

  const active = useOrderStore((s) => s.active);
  const lines = useCartStore((s) => s.lines);
  const addItem = useCartStore((s) => s.addItem);
  const totals = useCartStore((s) => s.totals);

  const [cat, setCat] = useState<string>('all');
  const items = useMemo(() => {
    const all = menu.data?.items ?? [];
    return cat === 'all' ? all : all.filter((i) => i.categoryId === cat);
  }, [menu.data, cat]);

  const cartCount = lines.reduce((n, l) => n + l.quantity, 0);
  const qtyOf = (id: string) => lines.filter((l) => l.menuItemId === id).reduce((n, l) => n + l.quantity, 0);

  const quickAdd = (item: MenuItem) => {
    haptics.light();
    addItem(item, 1);
    toast.success('Đã thêm', item.name);
  };

  const categories = [{ id: 'all', name: 'Tất cả' }, ...(menu.data?.categories ?? [])];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-fg">Thực đơn</Text>
          {!!active && (
            <Text className="text-xs text-muted">
              {active.tableName ?? 'Mang về'} · {active.customerName}
            </Text>
          )}
        </View>
      </View>

      {/* Category tabs */}
      <FlatList
        horizontal
        data={categories}
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48, flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setCat(item.id)}
            className={`h-9 justify-center rounded-full px-4 ${cat === item.id ? 'border border-brand bg-elevated' : 'bg-surface'}`}
          >
            <Text className={cat === item.id ? 'font-semibold text-brand' : 'text-muted'}>{item.name}</Text>
          </Pressable>
        )}
      />

      {menu.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.brand.DEFAULT} />
        </View>
      ) : menu.isError ? (
        <ErrorState onRetry={() => menu.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <MenuItemCard
              item={item}
              qtyInCart={qtyOf(item.id)}
              onPress={() => modifier.current?.present(item)}
              onQuickAdd={() => quickAdd(item)}
            />
          )}
        />
      )}

      {/* Cart bar */}
      {cartCount > 0 && (
        <View className="absolute inset-x-4 bottom-6">
          <Pressable
            onPress={() => router.push('/(app)/cart')}
            className="flex-row items-center justify-between rounded-2xl bg-cart px-5 py-4 active:opacity-90"
          >
            <View className="flex-row items-center">
              <ShoppingCart size={20} color="#fff" />
              <Text className="ml-2 font-bold text-white">{cartCount} món trong giỏ</Text>
            </View>
            <Text className="font-extrabold text-white">{formatMoney(totals().total)}</Text>
          </Pressable>
        </View>
      )}

      <ModifierSheet ref={modifier} onAdd={(item, qty, note) => {
        haptics.light();
        addItem(item, qty, note);
        toast.success('Đã thêm', `${item.name} ×${qty}`);
      }} />
    </SafeAreaView>
  );
}
