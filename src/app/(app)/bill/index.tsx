// Màn 6 — Hoá đơn: chọn voucher, khách thân thiết, tip, giảm giá, phí phục vụ.
// Mỗi lần đổi điều chỉnh → requestBill; số tiền hiển thị LUÔN là Bill server trả (D7).
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Split, Ticket, X } from 'lucide-react-native';
import { Pressable, Text, View } from '@/tw';
import { Button } from '@/components/ui/button';
import { ApprovalSheet, type ApprovalSheetHandle } from '@/components/sheets/approval-sheet';
import { VoucherSheet, type VoucherSheetHandle } from '@/components/sheets/voucher-sheet';
import { LoyaltySheet, type LoyaltySheetHandle } from '@/components/sheets/loyalty-sheet';
import { useBill, useBranchSettings, useOrder, useRequestBill } from '@/data/queries';
import { isPosApiError } from '@/data/types';
import { DISCOUNT_PRESETS, TIP_PRESETS } from '@/lib/billing';
import { formatMoney } from '@/lib/format';
import { newId } from '@/lib/id';
import { taxLabel } from '@/domain/pricing';
import { color } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useBillStore } from '@/store/bill-store';
import { useOrderStore } from '@/store/order-store';

export default function BillScreen() {
  const router = useRouter();
  const voucherSheet = useRef<VoucherSheetHandle>(null);
  const loyaltySheet = useRef<LoyaltySheetHandle>(null);
  const approvalSheet = useRef<ApprovalSheetHandle>(null);

  const active = useOrderStore((s) => s.active);
  const order = useOrder(active?.orderId);
  const settings = useBranchSettings();
  const adj = useBillStore();
  const bill = useBill(adj.billId ?? undefined);
  const requestBill = useRequestBill();

  const version = order.data?.version;
  const discountValue = adj.manualDiscount?.value ?? 0;

  // Tính lại bill trên server mỗi khi đơn hoặc điều chỉnh đổi.
  useEffect(() => {
    if (!active || version === undefined) return;
    requestBill.mutate(
      {
        idempotencyKey: newId(),
        orderId: active.orderId,
        expectedVersion: version,
        voucherCode: adj.voucherCode ?? undefined,
        customerId: adj.customer?.id,
        manualDiscount: adj.manualDiscount ?? undefined,
        serviceCharge: adj.serviceCharge,
        tip: adj.tip,
      },
      {
        onSuccess: (b) => adj.setBillId(b.id),
        onError: (e) => {
          if (!isPosApiError(e)) return toast.error('Mất kết nối', 'Không tính được hoá đơn');
          if (e.code === 'VERSION_CONFLICT') return void order.refetch();
          if (e.code === 'APPROVAL_REQUIRED' && adj.manualDiscount) {
            const d = adj.manualDiscount;
            return approvalSheet.current?.request(
              'MANUAL_DISCOUNT',
              `Giảm ${formatMoney(d.value)} — cần quản lý duyệt`,
              (a) => adj.setManualDiscount({ ...d, approvalToken: a.approvalToken })
            );
          }
          if (e.code === 'VALIDATION' && adj.voucherCode) {
            adj.setVoucherCode(null);
            return toast.error('Voucher không áp dụng được', e.message);
          }
          toast.error('Không tính được hoá đơn', e.message);
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.orderId, version, adj.voucherCode, adj.customer?.id, adj.manualDiscount, adj.serviceCharge, adj.tip]);

  if (!active) return <Redirect href="/(app)/home" />;

  const b = bill.data;
  const stale = requestBill.isPending || !b;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-fg">Hoá đơn{b ? ` · ${b.code}` : ''}</Text>
          <Text className="text-xs text-muted">{active.tableName ?? 'Mang về'} · {active.customerName}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 24 }}>
        {/* Items */}
        {b && (
          <View className="rounded-2xl border border-line bg-surface">
            {b.lines.map((l, i) => (
              <View key={l.lineId} className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <Text className="w-8 font-bold text-brand">{l.quantity}×</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-fg">{l.name}</Text>
                  {!!l.note && <Text className="text-xs text-muted">{l.note}</Text>}
                </View>
                <Text className="text-muted">{formatMoney(l.lineTotal)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Voucher / Loyalty */}
        <View className="flex-row gap-3">
          <ActionTile
            icon={<Ticket size={18} color={color.brand.DEFAULT} />}
            label={adj.voucherCode ?? 'Voucher'}
            active={!!adj.voucherCode}
            onPress={() => voucherSheet.current?.present()}
            onClear={adj.voucherCode ? () => adj.setVoucherCode(null) : undefined}
          />
          <ActionTile
            icon={<Text className="text-base">⭐</Text>}
            label={adj.customer ? adj.customer.name : 'Tích điểm'}
            active={!!adj.customer}
            onPress={() => loyaltySheet.current?.present()}
            onClear={adj.customer ? () => adj.setCustomer(null) : undefined}
          />
        </View>

        {/* Tip */}
        <Presets label="Tip" values={TIP_PRESETS} selected={adj.tip} onSelect={adj.setTip} />
        {/* Giảm giá tay — waiter/thu ngân cần quản lý duyệt (pos-plan Mục 6) */}
        <Presets
          label="Giảm giá"
          values={DISCOUNT_PRESETS}
          selected={discountValue}
          onSelect={(v) =>
            adj.setManualDiscount(v > 0 ? { type: 'AMOUNT', value: v, reason: 'Giảm giá tại bàn' } : null)
          }
        />

        {/* Service charge */}
        {!!settings?.serviceChargeRate && (
          <View className="flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
            <View>
              <Text className="font-semibold text-fg">Phí phục vụ {Math.round(settings.serviceChargeRate * 100)}%</Text>
              <Text className="text-xs text-muted">Tính sau giảm giá, trước VAT</Text>
            </View>
            <Switch
              value={adj.serviceCharge}
              onValueChange={adj.toggleServiceCharge}
              trackColor={{ true: color.brand.DEFAULT, false: color.bg.elevated }}
              thumbColor="#fff"
            />
          </View>
        )}

        {/* Breakdown — số server trả */}
        <View className="rounded-2xl border border-line bg-surface px-4 py-3" style={{ opacity: stale ? 0.5 : 1 }}>
          {!b ? (
            <ActivityIndicator color={color.brand.DEFAULT} />
          ) : (
            <>
              <Row label="Tạm tính" value={formatMoney(b.subtotal)} />
              {b.discountTotal > 0 && <Row label="Giảm giá" value={`- ${formatMoney(b.discountTotal)}`} accent />}
              {b.serviceCharge > 0 && <Row label="Phí phục vụ" value={formatMoney(b.serviceCharge)} />}
              <Row label={`Thuế (${taxLabel(b.taxRate)})`} value={formatMoney(b.tax)} />
              {b.tip > 0 && <Row label="Tip" value={formatMoney(b.tip)} />}
              <View className="mt-2 flex-row justify-between border-t border-line pt-2">
                <Text className="text-base font-bold text-fg">Tổng cộng</Text>
                <Text className="text-xl font-extrabold text-brand">{formatMoney(b.total)}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View className="flex-row gap-3 border-t border-line px-4 py-4">
        <Button
          className="flex-1"
          variant="ghost"
          label="Chia hoá đơn"
          leftIcon={<Split size={18} color={color.text.primary} />}
          disabled={stale}
          onPress={() => router.push('/(app)/bill/split')}
        />
        <Button
          className="flex-1"
          label="Thanh toán"
          disabled={stale}
          onPress={() => {
            adj.setSplitBillIds([]);
            router.push('/(app)/payment');
          }}
        />
      </View>

      <VoucherSheet ref={voucherSheet} />
      <LoyaltySheet ref={loyaltySheet} />
      <ApprovalSheet ref={approvalSheet} />
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
