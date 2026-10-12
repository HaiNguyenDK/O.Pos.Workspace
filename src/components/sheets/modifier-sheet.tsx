// src/components/sheets/modifier-sheet.tsx — thêm món: số lượng + modifier theo nhóm (min/max) + ghi chú.
// Nhóm chọn 1 → radio; nhóm chọn nhiều → checkbox giới hạn max. Kiểm tra bằng domain/modifiers (server kiểm lại).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { defaultOptionIds, resolveModifiers } from '@/domain/modifiers';
import { lineTotal } from '@/domain/pricing';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import type { LineModifier, MenuItem, ModifierGroup } from '@/data/types';

const QUICK_NOTE_KEYS = ['modifier.notes.lessSpicy', 'modifier.notes.noOnion', 'modifier.notes.takeaway', 'modifier.notes.rush'];

export type ModifierSheetHandle = { present: (item: MenuItem) => void };

export const ModifierSheet = forwardRef<
  ModifierSheetHandle,
  { onAdd: (item: MenuItem, qty: number, note: string | undefined, modifiers: LineModifier[]) => void }
>(function ModifierSheet({ onAdd }, ref) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [freeNote, setFreeNote] = useState('');

  useImperativeHandle(ref, () => ({
    present: (it) => {
      setItem(it);
      setQty(1);
      setPicked(defaultOptionIds(it));
      setNotes([]);
      setFreeNote('');
      sheet.current?.present();
    },
  }));

  const toggleOption = (g: ModifierGroup, optionId: string) =>
    setPicked((prev) => {
      const inGroup = g.options.map((o) => o.id);
      if (g.max === 1) return [...prev.filter((id) => !inGroup.includes(id)), optionId];
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      if (prev.filter((id) => inGroup.includes(id)).length >= g.max) return prev;
      return [...prev, optionId];
    });

  const toggleNote = (n: string) =>
    setNotes((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const check = item ? resolveModifiers(item, picked) : { modifiers: [] as LineModifier[] };
  const price = item ? lineTotal({ unitPrice: item.price, quantity: qty, modifiers: check.modifiers }) : 0;

  const confirm = () => {
    if (!item || check.error) return;
    const note = [...notes, freeNote.trim()].filter(Boolean).join(', ') || undefined;
    onAdd(item, qty, note, check.modifiers);
    sheet.current?.dismiss();
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    []
  );

  return (
    <BottomSheetModal
      ref={sheet}
      snapPoints={['85%']}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: color.text.muted }}
      backgroundStyle={{ backgroundColor: color.bg.surface }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }}>
        {item && (
          <>
            <Text className="text-xl font-extrabold text-fg">{item.name}</Text>
            <Text className="mt-1 text-brand">{formatMoney(item.price)}</Text>

            {/* Nhóm modifier */}
            {item.modifierGroups.map((g) => {
              const count = g.options.filter((o) => picked.includes(o.id)).length;
              return (
                <View key={g.id} className="mt-5">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="font-semibold text-fg">{g.name}</Text>
                    <Text className="text-xs text-muted">
                      {g.min > 0 ? t('modifier.required') : t('modifier.optional')}
                      {g.max > 1 ? ` · ${t('modifier.max', { max: g.max, count })}` : ''}
                    </Text>
                  </View>
                  <View className="gap-2">
                    {g.options.map((o) => {
                      const on = picked.includes(o.id);
                      return (
                        <Pressable
                          key={o.id}
                          onPress={() => toggleOption(g, o.id)}
                          className={`flex-row items-center rounded-2xl border px-4 py-3 active:opacity-80 ${on ? 'border-brand' : 'border-line bg-elevated'}`}
                          style={on ? { backgroundColor: 'rgba(243,112,33,0.12)' } : undefined}
                        >
                          <View
                            className={`mr-3 h-5 w-5 items-center justify-center border ${g.max === 1 ? 'rounded-full' : 'rounded-md'} ${on ? 'border-brand bg-brand' : 'border-line'}`}
                          >
                            {on && <Check size={12} color="#fff" />}
                          </View>
                          <Text className={`flex-1 ${on ? 'font-semibold text-fg' : 'text-fg'}`}>{o.name}</Text>
                          {o.priceDelta > 0 && <Text className="text-muted">+{formatMoney(o.priceDelta)}</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Qty */}
            <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-line bg-elevated px-4 py-3">
              <Text className="font-semibold text-muted">{t('common.quantity')}</Text>
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
            <Text className="mb-2 mt-5 font-semibold text-muted">{t('modifier.quickNotes')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {QUICK_NOTE_KEYS.map((k) => t(k)).map((n) => {
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
              placeholder={t('modifier.otherNote')}
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
              label={check.error ?? t('modifier.add', { count: qty, amount: formatMoney(price) })}
              disabled={!!check.error}
              onPress={confirm}
            />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
