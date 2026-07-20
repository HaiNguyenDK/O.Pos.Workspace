// src/components/sheets/merge-tables-sheet.tsx — gộp nhiều bàn vào đơn hiện tại (multi-select).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { useTables } from '@/data/queries';
import { color } from '@/lib/theme';

export type MergeTablesSheetHandle = { present: () => void };

export const MergeTablesSheet = forwardRef<
  MergeTablesSheetHandle,
  { currentTableId?: string; onConfirm: (tableIds: string[]) => void }
>(function MergeTablesSheet({ currentTableId, onConfirm }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const tables = useTables();
  const [selected, setSelected] = useState<string[]>([]);

  useImperativeHandle(ref, () => ({
    present: () => {
      setSelected([]);
      sheet.current?.present();
    },
  }));

  const targets = (tables.data ?? []).filter((t) => t.id !== currentTableId);
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
        <Text className="mb-2 text-muted">Chọn các bàn muốn gộp vào đơn này</Text>
        {targets.map((t) => {
          const on = selected.includes(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => toggle(t.id)}
              className={`flex-row items-center justify-between rounded-2xl border px-4 py-4 active:opacity-80 ${on ? 'border-brand' : 'border-line bg-elevated'}`}
              style={on ? { backgroundColor: 'rgba(243,112,33,0.15)' } : undefined}
            >
              <Text className="text-base font-bold text-fg">{t.name} · {t.zone}</Text>
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
            onConfirm(selected);
            sheet.current?.dismiss();
          }}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
