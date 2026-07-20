// Màn 6 — Bill preview: voucher, loyalty (SĐT), tip, discount, phí phục vụ. Tính qua domain/pricing.
import { Redirect, useRouter } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Split, Ticket, X } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { VoucherSheet, type VoucherSheetHandle } from '@/components/sheets/voucher-sheet';
import { LoyaltySheet, type LoyaltySheetHandle } from '@/components/sheets/loyalty-sheet';
import { calcTotal } from '@/domain/pricing';
import { TIP_PRESETS } from '@/lib/billing';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { useBillStore } from '@/store/bill-store';
import { useOrderStore } from '@/store/order-store';

const DISCOUNT_PRESETS = [0, 10000, 20000, 50000];

export default function Bill() {
  const router = useRouter();
  const voucherSheet = useRef<VoucherSheetHandle>(null);
  const loyaltySheet = useRef<LoyaltySheetHandle>(null);

  const active = useOrderStore((s) => s.active);
  const items = useOrderStore((s) => s.sentLines);
  const bill = useBillStore();

  if (!active) return <Redirect href="/(app)/home" />;
  if (items.length === 0) return <Redirect href="/(app)/cart" />;

  const breakdown = calcTotal(items, {
    voucher: bill.voucher ?? undefined,
    tip: bill.tip,
    discount: bill.discount,
    service: bill.service,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-fg">Hoá đơn</Text>
          <Text className="text-xs text-muted">{active.tableName ?? 'Mang về'} · {active.customerName}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 24 }}>
        {/* Items */}
        <View className="rounded-2xl border border-line bg-surface">
          {items.map((l, i) => (
            <View key={`${l.menuItemId}|${l.note ?? ''}`} className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
              <Text className="w-8 font-bold text-brand">{l.quantity}×</Text>
              <View className="flex-1">
                <Text className="font-semibold text-fg">{l.name}</Text>
                {!!l.note && <Text className="text-xs text-muted">{l.note}</Text>}
              </View>
              <Text className="text-muted">{formatMoney(l.price * l.quantity)}</Text>
            </View>
          ))}
        </View>

        {/* Voucher / Loyalty */}
        <View className="flex-row gap-3">
          <ActionTile
            icon={<Ticket size={18} color={color.brand.DEFAULT} />}
            label={bill.voucher ? bill.voucher.code : 'Voucher'}
            active={!!bill.voucher}
            onPress={() => voucherSheet.current?.present()}
            onClear={bill.voucher ? () => bill.setVoucher(null) : undefined}
          />
          <ActionTile
            icon={<Text className="text-base">⭐</Text>}
            label={bill.loyalty ? `${bill.loyalty.points}đ` : 'Tích điểm'}
            active={!!bill.loyalty}
            onPress={() => loyaltySheet.current?.present()}
            onClear={bill.loyalty ? () => bill.setLoyalty(null) : undefined}
          />
        </View>

        {/* Tip */}
        <Presets label="Tip" values={TIP_PRESETS} selected={bill.tip} onSelect={bill.setTip} />
        {/* Discount */}
        <Presets label="Giảm giá" values={DISCOUNT_PRESETS} selected={bill.discount} onSelect={bill.setDiscount} />

        {/* Service charge */}
        <View className="flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <View>
            <Text className="font-semibold text-fg">Phí phục vụ 5%</Text>
            <Text className="text-xs text-muted">Áp trên tạm tính</Text>
          </View>
          <Switch
            value={bill.service}
            onValueChange={bill.toggleService}
            trackColor={{ true: color.brand.DEFAULT, false: color.bg.elevated }}
            thumbColor="#fff"
          />
        </View>

        {/* Breakdown */}
        <View className="rounded-2xl border border-line bg-surface px-4 py-3">
          <Row label="Tạm tính" value={formatMoney(breakdown.subtotal)} />
          {breakdown.discount > 0 && <Row label="Giảm giá" value={`- ${formatMoney(breakdown.discount)}`} accent />}
          {breakdown.service > 0 && <Row label="Phí phục vụ" value={formatMoney(breakdown.service)} />}
          {bill.tip > 0 && <Row label="Tip" value={formatMoney(bill.tip)} />}
          <Row label="Thuế (VAT 10%)" value={formatMoney(breakdown.tax)} />
          <View className="mt-2 flex-row justify-between border-t border-line pt-2">
            <Text className="text-base font-bold text-fg">Tổng cộng</Text>
            <Text className="text-xl font-extrabold text-brand">{formatMoney(breakdown.total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View className="flex-row gap-3 border-t border-line px-4 py-4">
        <Button className="flex-1" variant="ghost" label="Chia hoá đơn" leftIcon={<Split size={18} color={color.text.primary} />} onPress={() => router.push('/(app)/bill/split')} />
        <Button className="flex-1" label="Thanh toán" onPress={() => router.push('/(app)/payment')} />
      </View>

      <VoucherSheet ref={voucherSheet} />
      <LoyaltySheet ref={loyaltySheet} />
    </SafeAreaView>
  );
}

function ActionTile({
  icon,
  label,
  active,
  onPress,
  onClear,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center rounded-2xl border px-3 py-3 active:opacity-70 ${active ? 'border-brand' : 'border-line bg-surface'}`}
      style={active ? { backgroundColor: 'rgba(243,112,33,0.12)' } : undefined}
    >
      {icon}
      <Text className={`ml-2 font-semibold ${active ? 'text-brand' : 'text-fg'}`}>{label}</Text>
      {onClear && (
        <Pressable onPress={onClear} hitSlop={8} className="ml-2 active:opacity-60">
          <X size={16} color={color.text.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

function Presets({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: number[];
  selected: number;
  onSelect: (n: number) => void;
}) {
  return (
    <View>
      <Text className="mb-2 font-semibold text-muted">{label}</Text>
      <View className="flex-row gap-2">
        {values.map((v) => {
          const on = selected === v;
          return (
            <Pressable
              key={v}
              onPress={() => onSelect(v)}
              className={`flex-1 items-center rounded-xl border py-3 active:opacity-70 ${on ? 'border-brand' : 'border-line bg-surface'}`}
              style={on ? { backgroundColor: 'rgba(243,112,33,0.12)' } : undefined}
            >
              <Text className={on ? 'font-bold text-brand' : 'text-muted'}>
                {v === 0 ? 'Không' : formatMoney(v)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className="flex-row justify-between py-0.5">
      <Text className="text-muted">{label}</Text>
      <Text className={accent ? 'text-brand' : 'text-fg'}>{value}</Text>
    </View>
  );
}
