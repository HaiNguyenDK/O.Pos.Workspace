// src/components/sheets/loyalty-sheet.tsx — tra cứu khách hàng thân thiết theo SĐT (PosApi.lookupCustomer — P1).
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react-native';
import { Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { useLookupCustomer } from '@/data/queries';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import type { Customer } from '@/data/types';

export type LoyaltySheetHandle = { present: () => void };

export const LoyaltySheet = forwardRef<LoyaltySheetHandle>(function LoyaltySheet(_props, ref) {
  const { t } = useTranslation();
  const sheet = useRef<BottomSheetModal>(null);
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<Customer | null>(null);
  const setCustomer = useBillStore((s) => s.setCustomer);
  const lookup = useLookupCustomer();

  useImperativeHandle(ref, () => ({
    present: () => {
      setPhone('');
      setFound(null);
      sheet.current?.present();
    },
  }));

  const search = (p: string) => {
    if (p.replace(/\D/g, '').length < 9) return toast.error(t('loyalty.invalidPhone'), t('loyalty.minDigits'));
    lookup.mutate(p, {
      onSuccess: (c) => {
        setFound(c);
        if (!c) toast.error(t('loyalty.notFound'), p);
      },
      onError: (e) => toast.error(t('loyalty.lookupError'), (e as Error).message),
    });
  };

  const apply = () => {
    if (!found) return;
    setCustomer(found);
    toast.success(t('loyalty.attached'), t('loyalty.attachedDetail', { name: found.name, count: found.pointBalance }));
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
        <Text className="text-xl font-extrabold text-fg">{t('loyalty.title')}</Text>
        <BottomSheetTextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={t('loyalty.phonePlaceholder')}
          placeholderTextColor={color.text.muted}
          onSubmitEditing={() => search(phone)}
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
        {found && (
          <View className="mt-4 flex-row items-center rounded-2xl border border-line bg-elevated px-4 py-3">
            <Star size={20} color={color.brand.DEFAULT} />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-fg">{found.name}</Text>
              <Text className="text-xs text-muted">
                {found.phone} · {t('loyalty.points', { count: found.pointBalance })}{found.tier ? ` · ${found.tier}` : ''}
              </Text>
            </View>
          </View>
        )}
        <View className="mt-6 flex-row gap-3">
          <Button className="flex-1" variant="ghost" label={t('loyalty.lookup')} loading={lookup.isPending} onPress={() => search(phone)} />
          <Button className="flex-1" label={t('loyalty.attach')} onPress={apply} disabled={!found} />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
