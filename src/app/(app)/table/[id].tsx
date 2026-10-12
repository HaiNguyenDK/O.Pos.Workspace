// Màn 3 — mở/tiếp tục đơn tại bàn. Form: tên khách, số người, mode, note. TextInput + +/- guests.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useOpenOrder, useRunningOrder, useTables } from '@/data/queries';
import { useActionKey } from '@/lib/use-action-key';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import { useCartStore } from '@/store/cart-store';
import { useOrderStore } from '@/store/order-store';
import { isPosApiError, type Order, type ServiceMode } from '@/data/types';

export default function TableDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const tables = useTables();
  const table = useMemo(() => tables.data?.find((tb) => tb.id === id), [tables.data, id]);
  const running = useRunningOrder(id);

  const openOrder = useOpenOrder();
  const action = useActionKey();
  const setActive = useOrderStore((s) => s.setActive);
  const clearCart = useCartStore((s) => s.clear);
  const resetBill = useBillStore((s) => s.reset);

  const [customerName, setCustomerName] = useState('');
  const [guests, setGuests] = useState(2);
  const [mode, setMode] = useState<ServiceMode>('DINE_IN');
  const [note, setNote] = useState('');

  const enter = useCallback(
    (o: Pick<Order, 'id' | 'tableId' | 'tableName' | 'customerName' | 'mode'>, to: '/(app)/cart' | '/(app)/menu') => {
      setActive({ orderId: o.id, tableId: o.tableId, tableName: o.tableName, customerName: o.customerName, mode: o.mode });
      clearCart();
      resetBill();
      router.replace(to);
    },
    [setActive, clearCart, resetBill, router]
  );

  // Có đơn đang chạy tại bàn → tiếp tục luôn (không hiện form).
  useEffect(() => {
    if (running.data) enter(running.data, '/(app)/cart');
  }, [running.data, enter]);

  const submit = () => {
    openOrder.mutate(
      {
        idempotencyKey: action.key(),
        tableId: id,
        customerName: customerName.trim() || t('table.defaultCustomer', { name: table?.name ?? '' }).trim(),
        guests,
        mode,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (order) => {
          action.reset();
          enter(order, '/(app)/menu');
        },
        onError: (e) => {
          action.settle(e);
          // Máy khác vừa mở đơn cho bàn này → vào luôn đơn đó.
          if (isPosApiError(e) && e.code === 'TABLE_OCCUPIED') {
            toast.info(t('table.alreadyOpen'), t('table.alreadyOpenHint'));
            running.refetch();
            return;
          }
          toast.error(t('common.error'), (e as Error).message);
        },
      }
    );
  };

  if (running.isLoading || running.data) {
    return (
      <View className="flex-1 items-center justify-center bg-app">
        <ActivityIndicator color={color.brand.DEFAULT} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
            <ChevronLeft size={22} color={color.text.primary} />
          </Pressable>
          <Text className="text-xl font-extrabold text-fg">{t('table.openTitle', { name: table?.name ?? id })}</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Tên khách */}
          <View>
            <Text className="mb-2 font-semibold text-muted">{t('table.customerName')}</Text>
            <TextField
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={t('table.defaultCustomer', { name: table?.name ?? '' }).trim()}
              returnKeyType="next"
            />
          </View>

          {/* Số người */}
          <View>
            <Text className="mb-2 font-semibold text-muted">{t('table.guests')}</Text>
            <View className="flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
              <Stepper onPress={() => setGuests((g) => Math.max(1, g - 1))} icon={<Minus size={20} color={color.text.primary} />} />
              <Text className="text-2xl font-extrabold text-fg">{guests}</Text>
              <Stepper onPress={() => setGuests((g) => g + 1)} icon={<Plus size={20} color={color.text.primary} />} />
            </View>
          </View>

          {/* Mode */}
          <View>
            <Text className="mb-2 font-semibold text-muted">{t('table.mode')}</Text>
            <View className="flex-row rounded-2xl bg-surface p-1">
              {(['DINE_IN', 'TAKE_AWAY'] as ServiceMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  className={`flex-1 items-center rounded-xl py-3 ${mode === m ? 'bg-brand' : ''}`}
                >
                  <Text className={`font-bold ${mode === m ? 'text-white' : 'text-muted'}`}>
                    {m === 'DINE_IN' ? t('common.dineIn') : t('common.takeaway')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Note */}
          <View>
            <Text className="mb-2 font-semibold text-muted">{t('common.note')}</Text>
            <TextField
              value={note}
              onChangeText={setNote}
              placeholder={t('table.notePlaceholder')}
              multiline
            />
          </View>
        </ScrollView>

        <View className="border-t border-line px-4 py-4">
          <Button label={t('table.submit')} onPress={submit} loading={openOrder.isPending} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stepper({ onPress, icon }: { onPress: () => void; icon: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} className="h-11 w-11 items-center justify-center rounded-full bg-elevated active:opacity-70">
      {icon}
    </Pressable>
  );
}
