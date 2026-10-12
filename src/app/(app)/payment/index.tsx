// Màn 8 — chọn phương thức. Số cần thu = Bill.total − paidAmount do server trả (D7).
// Đã chia bill → chọn phần cần thu trước. MVP: tiền mặt + VietQR (pos-plan Mục 3.1 Payment).
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { Banknote, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, QrCode, Wallet } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '@/tw';
import { useBill, useCurrentShift } from '@/data/queries';
import { formatMoney } from '@/lib/format';
import { color } from '@/lib/theme';
import { useBillStore } from '@/store/bill-store';
import { useOrderStore } from '@/store/order-store';

export default function Payment() {
  const { t } = useTranslation();
  const router = useRouter();
  const active = useOrderStore((s) => s.active);
  const billId = useBillStore((s) => s.billId);
  const splitBillIds = useBillStore((s) => s.splitBillIds);
  const setBillId = useBillStore((s) => s.setBillId);
  const bill = useBill(billId ?? undefined);
  const shift = useCurrentShift();
  const noShift = shift.data === null; // chỉ chặn khi chắc chắn chưa có ca (lỗi mạng thì để server quyết)

  // Vừa chia bill → mặc định chọn phần đầu.
  useEffect(() => {
    if (splitBillIds.length > 0 && (!billId || !splitBillIds.includes(billId))) setBillId(splitBillIds[0]);
  }, [splitBillIds, billId, setBillId]);

  if (!active || !billId) return <Redirect href="/(app)/cart" />;

  const b = bill.data;
  const due = b ? b.total - b.paidAmount : 0;
  const paid = b?.status === 'PAID';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C' }} edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="mr-2 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70">
          <ChevronLeft size={22} color={color.text.primary} />
        </Pressable>
        <Text className="text-xl font-extrabold text-fg">{t('payment.title')}</Text>
      </View>

      {/* Chọn phần (khi đã chia) */}
      {splitBillIds.length > 0 && (
        <View className="mx-4 mb-3 flex-row flex-wrap gap-2">
          {splitBillIds.map((id, i) => (
            <PartChip key={id} billId={id} index={i} selected={id === billId} onPress={() => setBillId(id)} />
          ))}
        </View>
      )}

      {/* Total */}
      <View className="mx-4 mb-4 items-center rounded-2xl border border-line bg-surface py-6">
        {!b ? (
          <ActivityIndicator color={color.brand.DEFAULT} />
        ) : (
          <>
            <Text className="text-muted">{paid ? t('payment.paidFull') : t('payment.due')}</Text>
            <Text className="mt-1 text-4xl font-extrabold text-brand">{formatMoney(paid ? b.total : due)}</Text>
            <Text className="mt-1 text-xs text-muted">
              {b.code}
              {b.part ? ` · ${t('common.partOf', { n: b.part.index + 1, of: b.part.of })}` : ''} · {active.tableName ?? t('common.takeaway')}
            </Text>
          </>
        )}
      </View>

      {/* D14: máy chưa mở ca → không thu được tiền (server trả SHIFT_REQUIRED). Nhắc mở ca trước. */}
      {!paid && b && noShift && (
        <Pressable
          onPress={() => router.push('/(app)/shift')}
          className="mx-4 mb-3 flex-row items-center rounded-2xl border px-4 py-3 active:opacity-80"
          style={{ borderColor: color.status.pending, backgroundColor: 'rgba(245,158,11,0.10)' }}
        >
          <Wallet size={20} color={color.status.pending} />
          <View className="ml-3 flex-1">
            <Text className="font-bold text-fg">{t('shift.required')}</Text>
            <Text className="text-xs text-muted">{t('shift.requiredHint')}</Text>
          </View>
          <Text className="font-bold text-pending">{t('shift.openNow')}</Text>
        </Pressable>
      )}

      {!paid && b && (
        <View className="gap-3 px-4">
          <Method icon={<Banknote size={24} color={color.brand.DEFAULT} />} label={t('payment.cash')} disabled={noShift} onPress={() => router.push('/(app)/payment/cash')} />
          <Method icon={<QrCode size={24} color={color.brand.DEFAULT} />} label={t('payment.qr')} disabled={noShift} onPress={() => router.push('/(app)/payment/qr')} />
          <Method icon={<CreditCard size={24} color={color.text.muted} />} label={t('payment.card')} sub={t('payment.cardUnsupported')} disabled />
        </View>
      )}
    </SafeAreaView>
  );
}

function PartChip({ billId, index, selected, onPress }: { billId: string; index: number; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const b = useBill(billId).data;
  const done = b?.status === 'PAID';
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-full border px-3 py-2 ${selected ? 'border-brand' : 'border-line bg-surface'}`}
      style={selected ? { backgroundColor: 'rgba(243,112,33,0.12)' } : undefined}
    >
      {done && <CheckCircle2 size={14} color={color.status.available} />}
      <Text className={`ml-1 font-semibold ${selected ? 'text-brand' : 'text-fg'}`}>
        {t('common.part', { n: index + 1 })}
        {b ? ` · ${formatMoney(b.total)}` : ''}
      </Text>
    </Pressable>
  );
}

function Method({
  icon,
  label,
  sub,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center rounded-2xl border border-line bg-surface px-4 py-4 active:opacity-80"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-elevated">{icon}</View>
      <View className="ml-3 flex-1">
        <Text className="text-base font-bold text-fg">{label}</Text>
        {!!sub && <Text className="text-xs text-muted">{sub}</Text>}
      </View>
      {!disabled && <ChevronRight size={20} color={color.text.muted} />}
    </Pressable>
  );
}
