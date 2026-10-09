// Màn 5 — Giỏ: dòng đã gửi (từ server, có trạng thái bếp, huỷ được) + dòng chờ gửi offline
// + dòng mới (sửa qty/huỷ), move/merge, gửi bếp. Gửi bếp = addLines CHỈ dòng mới (D6).
import { onlineManager } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CloudOff, Minus, MoveRight, Plus, Trash2, Users } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { ApprovalSheet, type ApprovalSheetHandle } from '@/components/sheets/approval-sheet';
import { MoveTableSheet, type MoveTableSheetHandle } from '@/components/sheets/move-table-sheet';
import { MergeTablesSheet, type MergeTablesSheetHandle } from '@/components/sheets/merge-tables-sheet';
import {
  useAddLines,
  useBranchSettings,
  useMergeOrders,
  useMoveOrder,
  useOrder,
  useVoidLine,
} from '@/data/queries';
import { modifierText } from '@/domain/modifiers';
import { calcBill, calcSubtotal, taxLabel } from '@/domain/pricing';
import { isPosApiError, type OrderLine } from '@/data/types';
import { formatMoney } from '@/lib/format';
import { newId } from '@/lib/id';
import { lineLabel, lineTone } from '@/lib/status';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { haptics } from '@/lib/haptics';
import { useActionKey } from '@/lib/use-action-key';
import { toNewLine, useCartStore, type CartLine } from '@/store/cart-store';
import { useOrderStore } from '@/store/order-store';
import { useOfflineQueueStore } from '@/store/offline-queue-store';

const VOID_REASONS = ['Khách đổi ý', 'Nhập nhầm', 'Hết món'];

export default function Cart() {
  const { t } = useTranslation();
  const router = useRouter();
  const moveSheet = useRef<MoveTableSheetHandle>(null);
  const mergeSheet = useRef<MergeTablesSheetHandle>(null);
  const approvalSheet = useRef<ApprovalSheetHandle>(null);

  const active = useOrderStore((s) => s.active);
  const setActive = useOrderStore((s) => s.setActive);
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const removeLine = useCartStore((s) => s.removeLine);
  const clearCart = useCartStore((s) => s.clear);
  const queue = useOfflineQueueStore((st) => st.queue);
  const enqueueOffline = useOfflineQueueStore((st) => st.enqueue);
  const removeQueued = useOfflineQueueStore((st) => st.remove);

  const order = useOrder(active?.orderId);
  const settings = useBranchSettings();
  const addLines = useAddLines();
  const voidLine = useVoidLine();
  const moveOrder = useMoveOrder();
  const mergeOrders = useMergeOrders();
  const sendKey = useActionKey();

  if (!active) return <Redirect href="/(app)/home" />;

  const sent = (order.data?.lines ?? []).filter((l) => l.status !== 'VOIDED');
  const queued = queue.filter((q) => q.orderId === active.orderId);
  const queuedLines = queued.flatMap((q) => q.lines);
  const preview = settings
    ? calcBill([...sent, ...queuedLines, ...lines], settings)
    : null;
  const hasNew = lines.length > 0;
  const canPay = sent.length > 0 && !hasNew && queued.length === 0;

  const queueOffline = (key: string, toSend: CartLine[]) => {
    enqueueOffline({ idempotencyKey: key, orderId: active.orderId, tableName: active.tableName, lines: toSend });
    clearCart();
    sendKey.reset();
    haptics.warning();
    toast.info('Đã lưu offline', 'Sẽ tự gửi bếp khi có mạng lại');
  };

  const send = () => {
    const key = sendKey.key();
    const toSend = lines;
    // Mất mạng → xếp hàng đợi (persist) với đúng key; gửi bếp khi có mạng lại.
    if (!onlineManager.isOnline()) return queueOffline(key, toSend);
    addLines.mutate(
      { idempotencyKey: key, orderId: active.orderId, lines: toSend.map(toNewLine) },
      {
        onSuccess: () => {
          haptics.success();
          clearCart();
          sendKey.reset();
          toast.success('Đã gửi bếp', `${toSend.length} món · ${active.tableName ?? 'Mang về'}`);
        },
        onError: (e) => {
          // Lỗi mạng giữa chừng → không biết server đã nhận chưa: xếp hàng với CÙNG key (server bỏ qua nếu trùng).
          if (!isPosApiError(e)) return queueOffline(key, toSend);
          sendKey.settle(e);
          haptics.error();
          toast.error(t('common.error'), e.message);
        },
      }
    );
  };

  const doVoid = (line: OrderLine, reason: string, approvalToken?: string) =>
    voidLine.mutate(
      { idempotencyKey: newId(), orderId: active.orderId, lineId: line.id, reason, approvalToken },
      {
        onSuccess: () => toast.success('Đã huỷ món', line.name),
        onError: (e) => toast.error(t('common.error'), (e as Error).message),
      }
    );

  const askVoid = (line: OrderLine) =>
    Alert.alert(`Huỷ ${line.quantity}× ${line.name}?`, 'Chọn lý do', [
      ...VOID_REASONS.map((reason) => ({
        text: reason,
        onPress: () =>
          line.status === 'FIRED'
            ? doVoid(line, reason)
            : approvalSheet.current?.request('VOID_LINE', `Bếp đã làm "${line.name}" — cần quản lý duyệt huỷ`, (a) =>
                doVoid(line, reason, a.approvalToken)
              ),
      })),
      { text: 'Không huỷ', style: 'cancel' },
    ]);

  const onConflict = (e: unknown) => {
    if (isPosApiError(e) && e.code === 'VERSION_CONFLICT') {
      order.refetch();
      toast.error('Đơn vừa thay đổi', 'Đã tải lại, vui lòng thao tác lại');
    } else toast.error(t('common.error'), (e as Error).message);
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
          <Text className="text-xs text-muted">
            {active.customerName}
            {order.data ? ` · ${order.data.code}` : ''}
          </Text>
        </View>
      </View>

      {/* Move / Merge */}
      {active.mode === 'DINE_IN' && (
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
        {/* Đã gửi (server) */}
        {order.isLoading && <ActivityIndicator color={color.brand.DEFAULT} />}
        {sent.length > 0 && (
          <View className="gap-2">
            <Text className="font-bold text-muted">Đã gửi bếp</Text>
            {sent.map((l) => (
              <View key={l.id} className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3">
                <Text className="w-8 font-bold text-brand">{l.quantity}×</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-fg">{l.name}</Text>
                  {l.modifiers.length > 0 && <Text className="text-xs text-muted">{modifierText(l.modifiers)}</Text>}
                  {!!l.note && <Text className="text-xs text-muted">{l.note}</Text>}
                  <View className="mt-1">
                    <StatusChip status={lineTone[l.status]} label={lineLabel[l.status]} />
                  </View>
                </View>
                <Text className="text-muted">{formatMoney(l.lineTotal)}</Text>
                {l.status !== 'SERVED' && (
                  <Pressable onPress={() => askVoid(l)} hitSlop={8} className="ml-3 active:opacity-60">
                    <Trash2 size={18} color={color.status.cancelled} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Chờ gửi (offline) */}
        {queued.length > 0 && (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <CloudOff size={14} color={color.status.pending} />
              <Text className="font-bold text-muted">Chờ gửi bếp (offline)</Text>
            </View>
            {queued.map((q) => (
              <View key={q.idempotencyKey} className="gap-1 rounded-2xl border border-line bg-surface px-4 py-3">
                {q.lines.map((l) => (
                  <Text key={l.lineId} className="text-fg">
                    {l.quantity}× {l.name}{l.modifiers.length > 0 ? ` (${modifierText(l.modifiers)})` : ''}
                  </Text>
                ))}
                {!!q.error && (
                  <View className="mt-1 flex-row items-center justify-between">
                    <Text className="flex-1 text-xs" style={{ color: color.status.cancelled }}>
                      Không gửi được: {q.error}
                    </Text>
                    <Pressable onPress={() => removeQueued(q.idempotencyKey)} hitSlop={8} className="ml-2 active:opacity-60">
                      <Text className="text-xs font-bold text-brand">Bỏ</Text>
                    </Pressable>
                  </View>
                )}
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
              <View key={l.lineId} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Text className="font-semibold text-fg">{l.name}</Text>
                    {l.modifiers.length > 0 && <Text className="text-xs text-muted">{modifierText(l.modifiers)}</Text>}
                    {!!l.note && <Text className="text-xs text-muted">{l.note}</Text>}
                    <Text className="mt-0.5 text-brand">{formatMoney(calcSubtotal([l]))}</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Pressable onPress={() => setQty(l.lineId, l.quantity - 1)} className="h-9 w-9 items-center justify-center rounded-full bg-elevated active:opacity-70">
                      <Minus size={16} color={color.text.primary} />
                    </Pressable>
                    <Text className="w-5 text-center font-extrabold text-fg">{l.quantity}</Text>
                    <Pressable onPress={() => setQty(l.lineId, l.quantity + 1)} className="h-9 w-9 items-center justify-center rounded-full bg-brand active:opacity-80">
                      <Plus size={16} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => removeLine(l.lineId)} hitSlop={8} className="ml-1 active:opacity-60">
                      <Trash2 size={18} color={color.status.cancelled} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Totals (xem trước — số chuẩn ở màn hoá đơn) + actions */}
      <View className="border-t border-line px-4 py-4">
        {preview && settings && (
          <>
            <Row label="Tạm tính" value={formatMoney(preview.subtotal)} />
            <Row label={`Thuế (${taxLabel(settings.taxRate)})`} value={formatMoney(preview.tax)} />
            <View className="mb-3 mt-1 flex-row justify-between">
              <Text className="text-base font-bold text-fg">Tổng (tạm)</Text>
              <Text className="text-xl font-extrabold text-brand">{formatMoney(preview.total)}</Text>
            </View>
          </>
        )}

        <View className="flex-row gap-3">
          <Button className="flex-1" variant="ghost" label="Thêm món" onPress={() => router.push('/(app)/menu')} />
          {hasNew ? (
            <Button className="flex-1" label={t('cart.sendToKitchen')} onPress={send} loading={addLines.isPending} />
          ) : (
            <Button className="flex-1" variant="cart" label="Thanh toán" onPress={() => router.push('/(app)/bill')} disabled={!canPay} />
          )}
        </View>
      </View>

      <MoveTableSheet
        ref={moveSheet}
        currentTableId={active.tableId}
        onSelect={(toTableId) =>
          order.data &&
          moveOrder.mutate(
            { idempotencyKey: newId(), orderId: active.orderId, toTableId, expectedVersion: order.data.version },
            {
              onSuccess: (o) => {
                setActive({ ...active, tableId: o.tableId, tableName: o.tableName });
                toast.success('Đã chuyển bàn', o.tableName);
              },
              onError: onConflict,
            }
          )
        }
      />
      <MergeTablesSheet
        ref={mergeSheet}
        currentOrderId={active.orderId}
        onConfirm={(sources) =>
          mergeOrders.mutate(
            {
              idempotencyKey: newId(),
              primaryOrderId: active.orderId,
              sourceOrderIds: sources.map((s) => s.id),
              expectedVersions: sources.map((s) => s.version),
            },
            {
              onSuccess: () => toast.success('Đã gộp bàn', `${sources.length} bàn`),
              onError: onConflict,
            }
          )
        }
      />
      <ApprovalSheet ref={approvalSheet} />
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
