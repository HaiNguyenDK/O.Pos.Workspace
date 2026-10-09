// src/components/sheets/voucher-sheet.tsx — nhập mã giảm giá. Server kiểm tra khi tính bill (requestBill).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { color } from '@/lib/theme';
import { useBillStore } from '@/store/bill-store';

export type VoucherSheetHandle = { present: () => void };

const SUGGESTED = ['GIAM10', 'GIAM20', 'GIAM50K'];

export const VoucherSheet = forwardRef<VoucherSheetHandle>(function VoucherSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [code, setCode] = useState('');
  const setVoucherCode = useBillStore((s) => s.setVoucherCode);

  useImperativeHandle(ref, () => ({
    present: () => {
      setCode('');
      sheet.current?.present();
    },
  }));

  // Màn hoá đơn gọi lại requestBill; mã sai → server trả VALIDATION và màn hoá đơn báo lỗi.
  const apply = (c: string) => {
    setVoucherCode(c.trim().toUpperCase());
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
        <Text className="text-xl font-extrabold text-fg">Voucher</Text>
        <BottomSheetTextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="Nhập mã…"
          placeholderTextColor={color.text.muted}
          style={{
            marginTop: 14,
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
        <View className="mt-3 flex-row flex-wrap gap-2">
          {SUGGESTED.map((c) => (
            <Pressable key={c} onPress={() => setCode(c)} className="rounded-full border border-line bg-elevated px-3 py-2 active:opacity-70">
              <Text className="text-muted">{c}</Text>
            </Pressable>
          ))}
        </View>
        <Button className="mt-6" label="Áp dụng" onPress={() => apply(code)} disabled={!code.trim()} />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
