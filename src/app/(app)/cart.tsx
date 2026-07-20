// Màn 5 — Giỏ: dòng đã gửi (read-only) + dòng mới (sửa qty/note/huỷ), move/merge, gửi bếp.
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Minus, MoveRight, Plus, Trash2, Users } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { MoveTableSheet, type MoveTableSheetHandle } from '@/components/sheets/move-table-sheet';
import { MergeTablesSheet, type MergeTablesSheetHandle } from '@/components/sheets/merge-tables-sheet';
import { useMergeTables, useMoveTable, useSendToKitchen } from '@/data/queries';
import { calcTotal } from '@/domain/pricing';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useCartStore } from '@/store/cart-store';
import { useOrderStore } from '@/store/order-store';
import type { OrderLine } from '@/data/types';

/** Gộp dòng theo menuItemId|note để tạo danh sách items đầy đủ gửi bếp. */
function mergeLines(a: OrderLine[], b: OrderLine[]): OrderLine[] {
  const map = new Map<string, OrderLine>();
  for (const l of [...a, ...b]) {
    const key = `${l.menuItemId}|${l.note ?? ''}`;
    const found = map.get(key);
    if (found) found.quantity += l.quantity;
    else map.set(key, { ...l });
  }
  return [...map.values()];
}

export default function Cart() {
  const { t } = useTranslation();
  const router = useRouter();
  const moveSheet = useRef<MoveTableSheetHandle>(null);
  const mergeSheet = useRef<MergeTablesSheetHandle>(null);

  const active = useOrderStore((s) => s.active);
  const sentLines = useOrderStore((s) => s.sentLines);
  const setActive = useOrderStore((s) => s.setActive);
  const setSentLines = useOrderStore((s) => s.setSentLines);
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clear);

  const sendToKitchen = useSendToKitchen();
  const moveTable = useMoveTable();
  const mergeTables = useMergeTables();

  if (!active) return <Redirect href="/(app)/home" />;

  const allLines = mergeLines(sentLines, lines);
  const totals = calcTotal(allLines);
  const hasNew = lines.length > 0;

  const send = () => {
    sendToKitchen.mutate(
      { orderId: active.orderId, lines: allLines },
      {
        onSuccess: (order) => {
          setSentLines(order.items);
          clearCart();
          toast.success('Đã gửi bếp', `${order.items.length} món · ${active.tableName ?? 'Mang về'}`);
        },
        onError: (e) => toast.error(t('common.error'), (e as Error).message),
      }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-fg">{active.tableName ?? 'Mang về'}</Text>
          <Text className="text-xs text-muted">{active.customerName}</Text>
        </View>
      </View>

      {/* Move / Merge */}
      {active.mode === 'dine-in' && (
        <View className="mb-2 flex-row gap-3 px-4">
          <Pressable onPress={() => moveSheet.current?.present()} className="flex-1 flex-row items-center justify-center rounded-xl border border-line bg-surface py-3 active:opacity-70">
            <MoveRight size={16} color={color.text.primary} />
            <Text className="ml-2 font-semibold text-fg">Chuyển bàn</Text>
          </Pressable>
          <Pressable onPress={() => mergeSheet.current?.present()} className="flex-1 flex-row items-center justify-center rounded-xl border border-line bg-surface py-3 active:opacity-70">
            <Users size={16} color={color.text.primary} />
            <Text className="ml-2 font-semibold text-fg">Gộp bàn</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 20 }}>
        {/* Đã gửi */}
        {sentLines.length > 0 && (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="font-bold text-muted">Đã gửi bếp</Text>
              <StatusChip status="ready" label="đã gửi" />
            </View>
            {sentLines.map((l, i) => (
              <View key={`s${i}`} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3">
                <Text className="w-8 font-bold text-brand">{l.quantity}×</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-fg">{l.name}</Text>
                  {!!l.note && <Text className="text-xs text-muted">{l.note}</Text>}
                </View>
                <Text className="text-muted">{formatMoney(l.price * l.quantity)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Món mới */}
        <View className="mt-2 gap-2">
          <Text className="font-bold text-muted">Món mới</Text>
          {lines.length === 0 ? (
            <Text className="py-4 text-center text-muted">{t('cart.empty')}</Text>
          ) : (
            lines.map((l) => (
              <View key={`${l.menuItemId}|${l.note ?? ''}`} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Text className="font-semibold text-fg">{l.name}</Text>
                    {!!l.note && <Text className="text-xs text-muted">{l.note}</Text>}
                    <Text className="mt-0.5 text-brand">{formatMoney(l.price * l.quantity)}</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Pressable onPress={() => setQty(l.menuItemId, l.quantity - 1)} className="h-9 w-9 items-center justify-center rounded-full bg-elevated active:opacity-70">
                      <Minus size={16} color={color.text.primary} />
                    </Pressable>
                    <Text className="w-5 text-center font-extrabold text-fg">{l.quantity}</Text>
                    <Pressable onPress={() => setQty(l.menuItemId, l.quantity + 1)} className="h-9 w-9 items-center justify-center rounded-full bg-brand active:opacity-80">
                      <Plus size={16} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => removeItem(l.menuItemId)} hitSlop={8} className="ml-1 active:opacity-60">
                      <Trash2 size={18} color={color.status.cancelled} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Totals + actions */}
      <View className="border-t border-line px-4 py-4">
        <Row label="Tạm tính" value={formatMoney(totals.subtotal)} />
        <Row label="Thuế (VAT 10%)" value={formatMoney(totals.tax)} />
        <View className="mb-3 mt-1 flex-row justify-between">
          <Text className="text-base font-bold text-fg">Tổng cộng</Text>
          <Text className="text-xl font-extrabold text-brand">{formatMoney(totals.total)}</Text>
        </View>

        <View className="flex-row gap-3">
          <Button className="flex-1" variant="ghost" label="Thêm món" onPress={() => router.push('/(app)/menu')} />
          {hasNew ? (
            <Button className="flex-1" label={t('cart.sendToKitchen')} onPress={send} loading={sendToKitchen.isPending} />
          ) : (
            <Button className="flex-1" variant="cart" label="Thanh toán" onPress={() => router.push('/(app)/bill')} disabled={sentLines.length === 0} />
          )}
        </View>
      </View>

      <MoveTableSheet
        ref={moveSheet}
        currentTableId={active.tableId}
        onSelect={(toTableId) =>
          moveTable.mutate(
            { orderId: active.orderId, toTableId },
            {
              onSuccess: (order) => {
                setActive({ ...active, tableId: order.tableId, tableName: order.tableName }, sentLines);
                toast.success('Đã chuyển bàn', order.tableName);
              },
              onError: (e) => toast.error(t('common.error'), (e as Error).message),
            }
          )
        }
      />
      <MergeTablesSheet
        ref={mergeSheet}
        currentTableId={active.tableId}
        onConfirm={(tableIds) =>
          mergeTables.mutate(
            { orderId: active.orderId, tableIds },
            {
              onSuccess: () => toast.success('Đã gộp bàn', `${tableIds.length} bàn`),
              onError: (e) => toast.error(t('common.error'), (e as Error).message),
            }
          )
        }
      />
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-0.5">
      <Text className="text-muted">{label}</Text>
      <Text className="text-fg">{value}</Text>
    </View>
  );
}
