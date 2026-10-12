// src/components/sheets/cash-movement-sheet.tsx — thu/chi tiền mặt ngoài bán hàng (pos-plan Mục 3.7).
// Sheet chỉ thu thập { type, amount, reason }; màn ca gọi API và xin duyệt (OUT bởi người không phải quản lý, D12).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import type { CashMovementType, Money } from '@/data/types';

export type CashMovementDraft = { type: CashMovementType; amount: Money; reason: string };
export type CashMovementSheetHandle = { present: () => void };

const REASON_KEYS = ['float', 'supplies', 'petty'] as const;

const inputStyle = {
  marginTop: 8,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: color.line,
  backgroundColor: color.bg.elevated,
  color: color.text.primary,
  paddingHorizontal: 18,
  paddingVertical: 14,
  fontSize: 16,
} as const;

export const CashMovementSheet = forwardRef<
  CashMovementSheetHandle,
  { onSubmit: (draft: CashMovementDraft) => void; needsApprovalForOut: boolean }
>(function CashMovementSheet({ onSubmit, needsApprovalForOut }, ref) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const [type, setType] = useState<CashMovementType>('IN');
  const [raw, setRaw] = useState('');
  const [reason, setReason] = useState('');

  useImperativeHandle(ref, () => ({
    present: () => {
      setType('IN');
      setRaw('');
      setReason('');
      sheet.current?.present();
    },
  }));

  const amount = Number(raw.replace(/\D/g, '') || 0);
  const valid = amount > 0 && reason.trim().length > 0;

  const submit = () => {
    sheet.current?.dismiss();
    onSubmit({ type, amount, reason: reason.trim() });
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
        <Text className="text-xl font-extrabold text-fg">{t('shift.cashMove')}</Text>

        {/* IN / OUT */}
        <View className="mt-4 flex-row rounded-2xl bg-elevated p-1">
          {(['IN', 'OUT'] as const).map((k) => {
            const on = type === k;
            const Icon = k === 'IN' ? ArrowDownToLine : ArrowUpFromLine;
            return (
              <Pressable key={k} onPress={() => setType(k)} className={`flex-1 flex-row items-center justify-center rounded-xl py-2.5 ${on ? 'bg-brand' : ''}`}>
                <Icon size={16} color={on ? '#fff' : color.text.muted} />
                <Text className={`ml-1.5 font-bold ${on ? 'text-white' : 'text-muted'}`}>
                  {k === 'IN' ? t('shift.moveIn') : t('shift.moveOut')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {type === 'OUT' && needsApprovalForOut && <Text className="mt-2 text-xs text-pending">{t('shift.outNeedsApproval')}</Text>}

        <Text className="mt-4 font-semibold text-muted">{t('shift.amount')}</Text>
        <BottomSheetTextInput
          value={raw}
          onChangeText={(v) => setRaw(v.replace(/\D/g, '').slice(0, 12))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={color.text.muted}
          style={inputStyle}
        />
        {amount > 0 && <Text className="mt-1 text-right font-bold text-brand">{formatMoney(amount)}</Text>}

        <Text className="mt-3 font-semibold text-muted">{t('shift.reason')}</Text>
        <BottomSheetTextInput
          value={reason}
          onChangeText={setReason}
          placeholder={t('shift.reasonPlaceholder')}
          placeholderTextColor={color.text.muted}
          style={inputStyle}
        />
        <View className="mt-3 flex-row flex-wrap gap-2">
          {REASON_KEYS.map((k) => {
            const label = t(`shift.reasonSuggestions.${k}`);
            return (
              <Pressable key={k} onPress={() => setReason(label)} className="rounded-full border border-line bg-elevated px-3 py-2 active:opacity-70">
                <Text className="text-muted">{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button className="mt-6" label={t('common.confirm')} disabled={!valid} onPress={submit} />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
