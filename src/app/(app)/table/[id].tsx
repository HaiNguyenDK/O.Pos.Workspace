// Màn 3 — mở/tiếp tục đơn tại bàn. Form: tên khách, số người, mode, note. TextInput + +/- guests.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { useCreateOrder, useRunningOrder, useTables } from '@/data/queries';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useCartStore } from '@/store/cart-store';
import { useOrderStore } from '@/store/order-store';
import type { ServiceMode } from '@/data/types';

export default function TableDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const tables = useTables();
  const table = useMemo(() => tables.data?.find((tb) => tb.id === id), [tables.data, id]);
  const running = useRunningOrder(id);

  const createOrder = useCreateOrder();
  const setActive = useOrderStore((s) => s.setActive);
  const clearCart = useCartStore((s) => s.clear);

  const [customerName, setCustomerName] = useState('');
  const [guests, setGuests] = useState(2);
  const [mode, setMode] = useState<ServiceMode>('dine-in');
  const [note, setNote] = useState('');

  // Có đơn đang chạy tại bàn → tiếp tục luôn (không hiện form).
  useEffect(() => {
    if (running.data) {
      const o = running.data;
      setActive(
        {
          orderId: o.id,
          tableId: o.tableId,
          tableName: o.tableName,
          customerName: o.customerName,
          mode: o.mode,
        },
        o.items
      );
      clearCart();
      router.replace('/(app)/cart');
    }
  }, [running.data, setActive, clearCart, router]);

  const submit = () => {
    createOrder.mutate(
      {
        tableId: id,
        customerName: customerName.trim() || `Khách ${table?.name ?? ''}`.trim(),
        guests,
        mode,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (order) => {
          setActive(
            {
              orderId: order.id,
              tableId: order.tableId,
              tableName: order.tableName,
              customerName: order.customerName,
              mode: order.mode,
            },
            []
          );
          clearCart();
          router.replace('/(app)/menu');
        },
        onError: (e) => toast.error(t('common.error'), (e as Error).message),
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
            <ChevronLeft size={22} color={color.text.primary} />
          </Pressable>
          <Text className="text-xl font-extrabold text-fg">Mở đơn · {table?.name ?? id}</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 20, paddingBottom: 24 }}>
          {/* Tên khách */}
          <View>
            <Text className="mb-2 font-semibold text-muted">Tên khách</Text>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={`Khách ${table?.name ?? ''}`.trim()}
              placeholderTextColor={color.text.muted}
              className="rounded-2xl border border-line bg-surface px-4 py-4 text-base text-fg"
            />
          </View>

          {/* Số người */}
          <View>
            <Text className="mb-2 font-semibold text-muted">Số người</Text>
            <View className="flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
              <Stepper onPress={() => setGuests((g) => Math.max(1, g - 1))} icon={<Minus size={20} color={color.text.primary} />} />
              <Text className="text-2xl font-extrabold text-fg">{guests}</Text>
              <Stepper onPress={() => setGuests((g) => g + 1)} icon={<Plus size={20} color={color.text.primary} />} />
            </View>
          </View>

          {/* Mode */}
          <View>
            <Text className="mb-2 font-semibold text-muted">Hình thức</Text>
            <View className="flex-row rounded-2xl bg-surface p-1">
              {(['dine-in', 'take-away'] as ServiceMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  className={`flex-1 items-center rounded-xl py-3 ${mode === m ? 'bg-brand' : ''}`}
                >
                  <Text className={`font-bold ${mode === m ? 'text-white' : 'text-muted'}`}>
                    {m === 'dine-in' ? 'Tại bàn' : 'Mang về'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Note */}
          <View>
            <Text className="mb-2 font-semibold text-muted">Ghi chú</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="VD: khách quen, bàn gần cửa sổ…"
              placeholderTextColor={color.text.muted}
              multiline
              className="min-h-20 rounded-2xl border border-line bg-surface px-4 py-4 text-base text-fg"
            />
          </View>
        </ScrollView>

        <View className="border-t border-line px-4 py-4">
          <Button label="Mở đơn & chọn món" onPress={submit} loading={createOrder.isPending} />
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
