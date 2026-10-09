// src/components/sheets/move-table-sheet.tsx — chuyển đơn sang bàn khác (chọn bàn trống).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { useTables } from '@/data/queries';
import { color } from '@/lib/theme';

export type MoveTableSheetHandle = { present: () => void };

export const MoveTableSheet = forwardRef<
  MoveTableSheetHandle,
  { currentTableId?: string; onSelect: (tableId: string) => void }
>(function MoveTableSheet({ currentTableId, onSelect }, ref) {
  const { t: tr } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const tables = useTables();
  useImperativeHandle(ref, () => ({ present: () => sheet.current?.present() }));

  const targets = (tables.data ?? []).filter(
    (t) => t.id !== currentTableId && t.status === 'AVAILABLE'
  );

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
        <Text className="text-xl font-extrabold text-fg">{tr('common.moveTable')}</Text>
        <Text className="mb-2 text-muted">{tr('move.hint')}</Text>
        {targets.length === 0 && <Text className="py-6 text-center text-muted">{tr('move.empty')}</Text>}
        {targets.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              onSelect(t.id);
              sheet.current?.dismiss();
            }}
            className="flex-row items-center justify-between rounded-2xl border border-line bg-elevated px-4 py-4 active:opacity-80"
          >
            <Text className="text-base font-bold text-fg">{t.name}</Text>
            <View className="flex-row items-center">
              <Users size={14} color={color.text.muted} />
              <Text className="ml-1 text-xs text-muted">{t.seats} · {t.zone}</Text>
            </View>
          </Pressable>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
