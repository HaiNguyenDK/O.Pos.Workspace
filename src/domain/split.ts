// src/domain/split.ts — chia hoá đơn (pos-plan Mục 3.4). EVEN | BY_LINE.
// Mỗi khoản (subtotal, giảm giá, phí phục vụ, thuế, tip) được chia sao cho Σ các phần = khoản của bill gốc.
import type { BranchSettings, Money, OrderLine, SplitPlan } from '@/data/types';
import { calcSubtotal, type PriceBreakdown } from '@/domain/pricing';

export type SplitPart = {
  index: number;
  lineIds: string[];
  subtotal: Money;
  discountTotal: Money;
  serviceCharge: Money;
  tax: Money;
  tip: Money;
  total: Money;
};

/** Chia đều, phần dư dồn vào phần cuối. */
export function splitEven(amount: Money, parts: number): Money[] {
  const n = Math.max(1, parts);
  const base = Math.floor(amount / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? amount - base * (n - 1) : base));
}

/** Chia theo trọng số bằng largest remainder — Σ kết quả = amount. */
export function allocate(amount: Money, weights: number[]): Money[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return splitEven(amount, weights.length);
  const exact = weights.map((w) => (amount * w) / sum);
  const out = exact.map(Math.floor);
  let left = amount - out.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i] += 1;
  return out;
}

export function computeSplit(
  lines: OrderLine[],
  bill: Pick<PriceBreakdown, 'subtotal' | 'discountTotal' | 'serviceCharge' | 'tax' | 'tip'>,
  settings: BranchSettings,
  plan: SplitPlan
): SplitPart[] {
  const n = Math.max(1, plan.parts);
  const active = lines.filter((l) => l.status !== 'VOIDED');

  let lineIdsOf: string[][];
  let share: (amount: Money) => Money[];

  if (plan.mode === 'EVEN') {
    lineIdsOf = Array.from({ length: n }, () => active.map((l) => l.id));
    share = (amount) => splitEven(amount, n);
  } else {
    lineIdsOf = Array.from({ length: n }, () => [] as string[]);
    for (const l of active) lineIdsOf[Math.min(n - 1, Math.max(0, plan.assignments[l.id] ?? 0))].push(l.id);
    const weights = lineIdsOf.map((ids) => calcSubtotal(active.filter((l) => ids.includes(l.id))));
    share = (amount) => allocate(amount, weights);
  }

  const subtotals = share(bill.subtotal);
  const discounts = share(bill.discountTotal);
  const services = share(bill.serviceCharge);
  const taxes = share(bill.tax);
  const tips = share(bill.tip);

  return lineIdsOf.map((lineIds, i) => {
    const taxable = subtotals[i] - discounts[i] + services[i];
    return {
      index: i,
      lineIds,
      subtotal: subtotals[i],
      discountTotal: discounts[i],
      serviceCharge: services[i],
      tax: taxes[i],
      tip: tips[i],
      total: taxable + (settings.pricesIncludeTax ? 0 : taxes[i]) + tips[i],
    };
  });
}
