// src/components/sheets/modifier-sheet.tsx — thêm món với số lượng + ghi chú (modifier).
// Contract MenuItem không có options → modifier = qty + note (quick-note chips + free text).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import type { MenuItem } from '@/data/types';

const QUICK_NOTES = ['Ít cay', 'Không hành', 'Ít đá', 'Nhiều đá', 'Mang về', 'Không đường'];

export type ModifierSheetHandle = { present: (item: MenuItem) => void };

export const ModifierSheet = forwardRef<
  ModifierSheetHandle,
  { onAdd: (item: MenuItem, qty: number, note?: string) => void }
>(function ModifierSheet({ onAdd }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState<string[]>([]);
  const [freeNote, setFreeNote] = useState('');

  useImperativeHandle(ref, () => ({
    present: (it) => {
      setItem(it);
      setQty(1);
      setNotes([]);
      setFreeNote('');
      sheet.current?.present();
    },
  }));

  const toggleNote = (n: string) =>
    setNotes((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const confirm = () => {
    if (!item) return;
    const note = [...notes, freeNote.trim()].filter(Boolean).join(', ') || undefined;
    onAdd(item, qty, note);
    sheet.current?.dismiss();
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: color.text.muted }}
      backgroundStyle={{ backgroundColor: color.bg.surface }}
    >
      <BottomSheetView style={{ padding: 20, paddingBottom: 36 }}>
        {item && (
          <>
            <Text className="text-xl font-extrabold text-fg">{item.name}</Text>
            <Text className="mt-1 text-brand">{formatMoney(item.price)}</Text>

            {/* Qty */}
            <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-line bg-elevated px-4 py-3">
              <Text className="font-semibold text-muted">Số lượng</Text>
              <View className="flex-row items-center gap-5">
                <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
                  <Minus size={18} color={color.text.primary} />
                </Pressable>
                <Text className="w-6 text-center text-xl font-extrabold text-fg">{qty}</Text>
                <Pressable onPress={() => setQty((q) => q + 1)} className="h-10 w-10 items-center justify-center rounded-full bg-brand active:opacity-80">
                  <Plus size={18} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Quick notes */}
            <Text className="mb-2 mt-5 font-semibold text-muted">Ghi chú nhanh</Text>
            <View className="flex-row flex-wrap gap-2">
              {QUICK_NOTES.map((n) => {
                const on = notes.includes(n);
                return (
                  <Pressable
                    key={n}
                    onPress={() => toggleNote(n)}
                    className={`rounded-full border px-3 py-2 ${on ? 'border-brand' : 'border-line bg-elevated'}`}
                    style={on ? { backgroundColor: 'rgba(243,112,33,0.18)' } : undefined}
                  >
                    <Text className={on ? 'font-semibold text-brand' : 'text-muted'}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Free note */}
            <BottomSheetTextInput
              value={freeNote}
              onChangeText={setFreeNote}
              placeholder="Ghi chú khác…"
              placeholderTextColor={color.text.muted}
              style={{
                marginTop: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: color.line,
                backgroundColor: color.bg.elevated,
                color: color.text.primary,
                paddingHorizontal: 18,
                paddingVertical: 14,
                fontSize: 16,
              }}
            />

            <Button
              className="mt-6"
              label={`Thêm ${qty} món · ${formatMoney(item.price * qty)}`}
              onPress={confirm}
            />
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
