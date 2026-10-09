// src/components/sheets/merge-tables-sheet.tsx — gộp đơn của các bàn khác vào đơn hiện tại (multi-select).
// Chỉ liệt kê bàn đang có đơn chạy; trả về {id, version} để mergeOrders kiểm tra xung đột (pos-plan Mục 3.2).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { useRunningOrders } from '@/data/queries';
import { color } from '@/lib/theme';

export type MergeTablesSheetHandle = { present: () => void };
export type MergeSource = { id: string; version: number };

export const MergeTablesSheet = forwardRef<
  MergeTablesSheetHandle,
  { currentOrderId: string; onConfirm: (sources: MergeSource[]) => void }
>(function MergeTablesSheet({ currentOrderId, onConfirm }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const running = useRunningOrders();
  const [selected, setSelected] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    present: () => {
      setSelected([]);
      sheet.current?.present();
    },
  }));

  const targets = (running.data ?? []).filter((o) => o.id !== currentOrderId && o.tableId);
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: color.text.muted }}
      backgroundStyle={{ backgroundColor: color.bg.surface }}
    >
      <BottomSheetView style={{ padding: 20, paddingBottom: 36, gap: 10 }}>
        <Text className="text-xl font-extrabold text-fg">Gộp bàn</Text>
        <Text className="mb-2 text-muted">Chọn bàn đang có khách để gộp vào đơn này</Text>
        {targets.length === 0 && <Text className="py-6 text-center text-muted">Không có bàn nào đang có đơn</Text>}
        {targets.map((o) => {
          const on = selected.includes(o.id);
          return (
            <Pressable
              key={o.id}
              onPress={() => toggle(o.id)}
              className={`flex-row items-center justify-between rounded-2xl border px-4 py-4 active:opacity-80 ${on ? 'border-brand' : 'border-line bg-elevated'}`}
              style={on ? { backgroundColor: 'rgba(243,112,33,0.15)' } : undefined}
            >
              <Text className="text-base font-bold text-fg">
                {o.tableName} · {o.lines.filter((l) => l.status !== 'VOIDED').length} món
              </Text>
              <View className={`h-6 w-6 items-center justify-center rounded-full ${on ? 'bg-brand' : 'bg-surface'}`}>
                {on && <Check size={16} color="#fff" />}
              </View>
            </Pressable>
          );
        })}
        <Button
          className="mt-3"
          label={`Gộp ${selected.length} bàn`}
          disabled={selected.length === 0}
          onPress={() => {
            onConfirm(targets.filter((o) => selected.includes(o.id)).map((o) => ({ id: o.id, version: o.version })));
            sheet.current?.dismiss();
          }}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
