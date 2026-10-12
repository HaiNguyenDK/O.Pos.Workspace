// Màn 14 — Thông báo từ bếp (ready/assigned/alert/promo). Tap → vào bàn. Mark all read.
// Nút "Giả lập món sẵn sàng" minh hoạ push→deep-link (local notification thay FCM).
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BellRing, ChevronLeft, CircleAlert, Tag, Utensils } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { ErrorState } from '@/components/ui/error-state';
import { useNotifications, useRunningOrders } from '@/data/queries';
import { notifyKitchenReady } from '@/native/notifications';
import { formatTime } from '@/lib/format';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { NotificationKind } from '@/data/types';

const KIND_META: Record<NotificationKind, { icon: typeof BellRing; color: string }> = {
  ready: { icon: Utensils, color: color.status.available },
  assigned: { icon: BellRing, color: color.brand.DEFAULT },
  alert: { icon: CircleAlert, color: color.status.cancelled },
  promo: { icon: Tag, color: color.status.reserved },
};

export default function Notifications() {
  const { t } = useTranslation();
  const router = useRouter();
  const notifications = useNotifications();
  const runningOrders = useRunningOrders();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const items = useMemo(
    () => (notifications.data ?? []).map((n) => ({ ...n, read: n.read || readIds.has(n.id) })),
    [notifications.data, readIds]
  );
  const unread = items.filter((n) => !n.read).length;

  const markAllRead = () => setReadIds(new Set(items.map((n) => n.id)));

  const open = (id: string, tableId?: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    if (tableId) router.push(`/(app)/table/${tableId}`);
  };

  // Demo: giả lập bếp báo "món sẵn sàng" cho 1 đơn đang chạy.
  const simulate = async () => {
    const order = runningOrders.data?.find((o) => o.tableId);
    if (!order?.tableId) return toast.info(t('notifications.noOrder'), t('notifications.noOrderHint'));
    const ok = await notifyKitchenReady(order.tableId, order.tableName ?? t('common.table'));
    toast[ok ? 'success' : 'error'](
      ok ? t('notifications.testSent') : t('notifications.blocked'),
      ok ? t('notifications.testSentHint') : t('notifications.blockedHint')
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="flex-1 text-xl font-extrabold text-fg">{t('nav.notifications')}</Text>
        {unread > 0 && (
          <Pressable onPress={markAllRead} className="active:opacity-60">
            <Text className="font-semibold text-brand">{t('notifications.markAllRead')}</Text>
          </Pressable>
        )}
      </View>

      {notifications.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.brand.DEFAULT} />
        </View>
      ) : notifications.isError ? (
        <ErrorState onRetry={() => notifications.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={notifications.refetch} tintColor={color.brand.DEFAULT} />}
          ListHeaderComponent={
            <Pressable onPress={simulate} className="mb-2 flex-row items-center justify-center rounded-2xl border border-line bg-surface py-3 active:opacity-70">
              <BellRing size={16} color={color.brand.DEFAULT} />
              <Text className="ml-2 font-semibold text-brand">{t('notifications.simulate')}</Text>
            </Pressable>
          }
          ListEmptyComponent={<Text className="py-16 text-center text-muted">{t('notifications.empty')}</Text>}
          renderItem={({ item }) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            return (
              <Pressable
                onPress={() => open(item.id, item.tableId)}
                className={`flex-row items-center rounded-2xl border bg-surface p-4 active:opacity-80 ${item.read ? 'border-line' : 'border-brand'}`}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${meta.color}22` }}>
                  <Icon size={20} color={meta.color} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className={`font-bold ${item.read ? 'text-muted' : 'text-fg'}`}>{item.title}</Text>
                  <Text className="text-xs text-muted">{item.body}</Text>
                </View>
                <Text className="text-[10px] text-muted">{formatTime(item.createdAt)}</Text>
                {!item.read && <View className="ml-2 h-2 w-2 rounded-full bg-brand" />}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
