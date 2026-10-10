// Màn 2 — Home: 2 tab (Sơ đồ bàn | Đơn đang chạy), search/filter theo zone. DoD Sprint 0.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ScanLine, Settings as SettingsIcon, Wallet } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { TableCard } from '@/components/ui/table-card';
import { OrderRow } from '@/components/ui/order-row';
import { ErrorState } from '@/components/ui/error-state';
import { useCurrentShift, useRunningOrders, useTables } from '@/data/queries';
import { color } from '@/lib/theme';
import { useNotifications } from '@/data/queries';

type Tab = 'tables' | 'orders';
const ALL_ZONES = '__all__';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tables');

  const tables = useTables();
  const orders = useRunningOrders();
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  const shift = useCurrentShift();

  const zones = useMemo(() => {
    const z = new Set((tables.data ?? []).map((t) => t.zone));
    return [ALL_ZONES, ...z];
  }, [tables.data]);
  const [zone, setZone] = useState(ALL_ZONES);
  const filteredTables = (tables.data ?? []).filter((tb) => zone === ALL_ZONES || tb.zone === zone);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <Text className="text-2xl font-extrabold text-fg">
          {t('appName')} <Text className="text-brand">POS</Text>
        </Text>
        <View className="flex-row items-center gap-2">
          {/* Ca thu ngân (pos-plan 3.7): chấm xanh = đang mở ca, vàng = chưa mở. */}
          <Pressable
            onPress={() => router.push('/(app)/shift')}
            accessibilityLabel={shift.data ? t('shift.statusOpen', { number: shift.data.number }) : t('shift.noShift')}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface active:opacity-70"
          >
            <Wallet size={20} color={color.text.primary} />
            {!shift.isLoading && (
              <View className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${shift.data ? 'bg-available' : 'bg-pending'}`} />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/scan')}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface active:opacity-70"
          >
            <ScanLine size={20} color={color.brand.DEFAULT} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/notifications')}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface active:opacity-70"
          >
            <Bell size={20} color={color.text.primary} />
            {unread > 0 && (
              <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-brand" />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            className="h-11 w-11 items-center justify-center rounded-full bg-surface active:opacity-70"
          >
            <SettingsIcon size={20} color={color.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View className="mx-4 mb-3 flex-row rounded-2xl bg-surface p-1">
        {(['tables', 'orders'] as Tab[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            className={`flex-1 items-center rounded-xl py-2.5 ${tab === key ? 'bg-brand' : ''}`}
          >
            <Text className={`font-bold ${tab === key ? 'text-white' : 'text-muted'}`}>
              {key === 'tables' ? t('home.tabTables') : t('home.tabOrders')}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'tables' ? (
        <>
          {/* Zone filter */}
          <FlatList
            horizontal
            data={zones}
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 48, flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            keyExtractor={(z) => z}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setZone(item)}
                className={`h-9 justify-center rounded-full px-4 ${zone === item ? 'bg-elevated border border-brand' : 'bg-surface'}`}
              >
                <Text className={zone === item ? 'font-semibold text-brand' : 'text-muted'}>
                  {item === ALL_ZONES ? t('common.all') : item}
                </Text>
              </Pressable>
            )}
          />
          {tables.isLoading ? (
            <Loading />
          ) : tables.isError ? (
            <ErrorState onRetry={() => tables.refetch()} />
          ) : (
            <FlatList
              data={filteredTables}
              keyExtractor={(tb) => tb.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              refreshControl={
                <RefreshControl refreshing={tables.isRefetching} onRefresh={tables.refetch} tintColor={color.brand.DEFAULT} />
              }
              renderItem={({ item }) => (
                <TableCard table={item} onPress={() => router.push(`/(app)/table/${item.id}`)} />
              )}
              ListEmptyComponent={<Empty text={t('common.empty')} />}
            />
          )}
        </>
      ) : orders.isLoading ? (
        <Loading />
      ) : orders.isError ? (
        <ErrorState onRetry={() => orders.refetch()} />
      ) : (
        <FlatList
          data={orders.data ?? []}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={orders.isRefetching} onRefresh={orders.refetch} tintColor={color.brand.DEFAULT} />
          }
          renderItem={({ item }) => (
            <OrderRow order={item} onPress={() => item.tableId && router.push(`/(app)/table/${item.tableId}`)} />
          )}
          ListEmptyComponent={<Empty text={t('common.empty')} />}
        />
      )}
    </SafeAreaView>
  );
}

function Loading() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={color.brand.DEFAULT} />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View className="items-center py-16">
      <Text className="text-muted">{text}</Text>
    </View>
  );
}
