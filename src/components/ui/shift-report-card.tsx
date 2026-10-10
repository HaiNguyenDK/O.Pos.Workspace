// src/components/ui/shift-report-card.tsx — hiển thị báo cáo X/Z ca thu ngân (pos-plan Mục 3.7).
// Số liệu lấy nguyên từ ShiftReport server trả — không tự tính lại ở client (D7).
// showCash = false → ẩn khối tiền mặt (tiền hệ thống) để giữ đếm mù cho người không phải quản lý.
import { useTranslation } from 'react-i18next';
import { Text, View } from '@/tw';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/format';
import { methodLabelKey } from '@/lib/status';
import type { Money, ShiftReport } from '@/data/types';

/** Màu chênh lệch: 0 = khớp (xanh), âm = thiếu (đỏ), dương = thừa (vàng). */
export function varianceTone(v: number) {
  return v === 0 ? 'text-available' : v < 0 ? 'text-cancelled' : 'text-pending';
}

export function varianceLabelKey(v: number) {
  return v === 0 ? 'shift.varianceOk' : v < 0 ? 'shift.varianceShort' : 'shift.varianceOver';
}

export const signedMoney = (v: Money) => (v > 0 ? `+${formatMoney(v)}` : formatMoney(v));

export function ShiftReportCard({ report, showCash }: { report: ShiftReport; showCash: boolean }) {
  const { t } = useTranslation();
  const { sales, payments, voids, cash } = report;
  return (
    <View className="gap-3">
      <Card>
        <Text className="mb-2 font-semibold text-muted">{t('shift.sales')}</Text>
        <Row label={t('shift.bills')} value={String(sales.bills)} />
        <Row label={t('common.subtotal')} value={formatMoney(sales.subtotal)} />
        {sales.discount > 0 && <Row label={t('common.discount')} value={`-${formatMoney(sales.discount)}`} />}
        {sales.serviceCharge > 0 && <Row label={t('common.serviceCharge')} value={formatMoney(sales.serviceCharge)} />}
        <Row label="VAT" value={formatMoney(sales.tax)} />
        {sales.tips > 0 && <Row label={t('shift.tips')} value={formatMoney(sales.tips)} />}
        <View className="mt-1 flex-row justify-between border-t border-line pt-2">
          <Text className="font-bold text-fg">{t('shift.total')}</Text>
          <Text className="text-lg font-extrabold text-brand">{formatMoney(sales.total)}</Text>
        </View>
      </Card>

      <Card>
        <Text className="mb-2 font-semibold text-muted">{t('shift.payments')}</Text>
        {payments.length === 0 ? (
          <Text className="text-muted">{t('shift.noPayments')}</Text>
        ) : (
          payments.map((p) => (
            <Row key={p.method} label={`${t(methodLabelKey[p.method])} (${p.count})`} value={formatMoney(p.amount)} />
          ))
        )}
        {voids.lines > 0 && (
          <Row label={t('shift.voids')} value={t('shift.voidsValue', { count: voids.lines, amount: formatMoney(voids.amount) })} muted />
        )}
      </Card>

      {showCash ? (
        <Card>
          <Text className="mb-2 font-semibold text-muted">{t('shift.cash')}</Text>
          <Row label={t('shift.openingFloat')} value={formatMoney(cash.openingFloat)} />
          <Row label={t('shift.cashSales')} value={formatMoney(cash.cashSales)} />
          <Row label={t('shift.cashIn')} value={formatMoney(cash.cashIn)} />
          <Row label={t('shift.cashOut')} value={cash.cashOut > 0 ? `-${formatMoney(cash.cashOut)}` : formatMoney(0)} />
          <View className="mt-1 flex-row justify-between border-t border-line pt-2">
            <Text className="font-bold text-fg">{t('shift.expected')}</Text>
            <Text className="font-extrabold text-fg">{formatMoney(cash.expected)}</Text>
          </View>
          {report.kind === 'Z' && report.counted !== undefined && report.variance !== undefined && (
            <>
              <Row label={t('shift.counted')} value={formatMoney(report.counted)} />
              <View className="flex-row justify-between py-1">
                <Text className="font-bold text-fg">
                  {t('shift.variance')} · {t(varianceLabelKey(report.variance))}
                </Text>
                <Text className={`font-extrabold ${varianceTone(report.variance)}`}>{signedMoney(report.variance)}</Text>
              </View>
            </>
          )}
        </Card>
      ) : (
        <Text className="px-1 text-xs text-muted">{t('shift.blindHint')}</Text>
      )}
    </View>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-muted">{label}</Text>
      <Text className={muted ? 'text-muted' : 'font-semibold text-fg'}>{value}</Text>
    </View>
  );
}
