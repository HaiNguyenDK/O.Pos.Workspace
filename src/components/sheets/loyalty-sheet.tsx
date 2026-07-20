// src/components/sheets/loyalty-sheet.tsx — tra cứu khách hàng thân thiết theo SĐT (mock).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Star } from 'lucide-react-native';
import { Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { lookupLoyalty } from '@/lib/billing';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore, type LoyaltyCustomer } from '@/store/bill-store';

export type LoyaltySheetHandle = { present: () => void };

export const LoyaltySheet = forwardRef<LoyaltySheetHandle>(function LoyaltySheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<LoyaltyCustomer | null>(null);
  const setLoyalty = useBillStore((s) => s.setLoyalty);

  useImperativeHandle(ref, () => ({
    present: () => {
      setPhone('');
      setFound(null);
      sheet.current?.present();
    },
  }));

  const search = (p: string) => {
    const c = lookupLoyalty(p);
    setFound(c);
    if (!c) toast.error('Không tìm thấy', 'Cần SĐT ≥ 9 số');
  };

  const apply = () => {
    if (!found) return;
    setLoyalty(found);
    toast.success('Đã gắn khách', `${found.name} · ${found.points} điểm`);
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
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: color.text.muted }}
      backgroundStyle={{ backgroundColor: color.bg.surface }}
    >
      <BottomSheetView style={{ padding: 20, paddingBottom: 36 }}>
        <Text className="text-xl font-extrabold text-fg">Khách thân thiết</Text>
        <BottomSheetTextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Số điện thoại…"
          placeholderTextColor={color.text.muted}
          onSubmitEditing={() => search(phone)}
          style={{
            marginTop: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: color.line,
            backgroundColor: color.bg.elevated,
            color: color.text.primary,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
          }}
        />
        {found && (
          <View className="mt-4 flex-row items-center rounded-2xl border border-line bg-elevated px-4 py-3">
            <Star size={20} color={color.brand.DEFAULT} />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-fg">{found.name}</Text>
              <Text className="text-xs text-muted">{found.phone} · {found.points} điểm</Text>
            </View>
          </View>
        )}
        <View className="mt-6 flex-row gap-3">
          <Button className="flex-1" variant="ghost" label="Tra cứu" onPress={() => search(phone)} />
          <Button className="flex-1" label="Gắn khách" onPress={apply} disabled={!found} />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
