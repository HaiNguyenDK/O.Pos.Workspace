// src/domain/pricing.ts — công thức tính tiền (pos-plan Mục 3.4). Server là nơi tính chuẩn (D7);
// bản này dùng cho mock và cho client XEM TRƯỚC — phải ra cùng kết quả với cùng input.
import type { BranchSettings, DiscountType, LineStatus, Money } from '@/data/types';

export type PricingLine = {
  unitPrice: Money;
  quantity: number;
  modifiers?: { priceDelta: Money }[];
  status?: LineStatus;
};

export type DiscountRule = { type: DiscountType; value: number };

export type PricingAdjustments = {
  discounts?: DiscountRule[];
  serviceCharge?: boolean;
  tip?: Money;
};

export type PriceBreakdown = {
  subtotal: Money;
  discountAmounts: Money[]; // cùng thứ tự với adjustments.discounts
  discountTotal: Money;
  serviceCharge: Money;
  taxable: Money;
  tax: Money;
  tip: Money;
  total: Money;
};

export function lineUnitPrice(l: PricingLine): Money {
  return l.unitPrice + (l.modifiers ?? []).reduce((s, m) => s + m.priceDelta, 0);
}

export function lineTotal(l: PricingLine): Money {
  return lineUnitPrice(l) * l.quantity;
}

export function calcSubtotal(lines: PricingLine[]): Money {
  return lines.filter((l) => l.status !== 'VOIDED').reduce((s, l) => s + lineTotal(l), 0);
}

/** Giảm giá tính trên subtotal; tổng giảm không vượt subtotal (cắt dần từ khoản sau). */
function discountAmounts(subtotal: Money, rules: DiscountRule[]): Money[] {
  let left = subtotal;
  return rules.map((r) => {
    const raw = r.type === 'PERCENT' ? Math.round((subtotal * r.value) / 100) : r.value;
    const amt = Math.max(0, Math.min(raw, left));
    left -= amt;
    return amt;
  });
}

export function calcBill(
  lines: PricingLine[],
  settings: BranchSettings,
  adj: PricingAdjustments = {}
): PriceBreakdown {
  const subtotal = calcSubtotal(lines);
  const amounts = discountAmounts(subtotal, adj.discounts ?? []);
  const discountTotal = amounts.reduce((s, a) => s + a, 0);
  const serviceCharge = adj.serviceCharge
    ? Math.round(settings.serviceChargeRate * (subtotal - discountTotal))
    : 0;
  const taxable = subtotal - discountTotal + serviceCharge;
  const tax = settings.pricesIncludeTax
    ? taxable - Math.round(taxable / (1 + settings.taxRate))
    : Math.round(taxable * settings.taxRate);
  const tip = Math.max(0, adj.tip ?? 0);
  const total = taxable + (settings.pricesIncludeTax ? 0 : tax) + tip;
  return { subtotal, discountAmounts: amounts, discountTotal, serviceCharge, taxable, tax, tip, total };
}

/** Nhãn thuế hiển thị/in, vd "VAT 10%" — luôn lấy từ settings, không hardcode. */
export function taxLabel(taxRate: number): string {
  return `VAT ${Math.round(taxRate * 1000) / 10}%`;
}
