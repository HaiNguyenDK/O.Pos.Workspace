// src/domain/split.ts — chia hoá đơn (Mục 3.4). even | by-item.
import type { Bill, SplitPlan } from '@/data/types';

export type SplitResult = { bucket: number; total: number };

export function computeSplit(bill: Bill, plan: SplitPlan): SplitResult[] {
  if (plan.mode === 'even') {
    const n = Math.max(1, plan.buckets);
    const portions = plan.portions ?? Array.from({ length: n }, () => 1);
    const totalPortions = portions.reduce((a, b) => a + b, 0) || n;
    // Chia theo phần, dồn phần dư (làm tròn) vào bucket cuối để tổng khớp bill.total.
    let allocated = 0;
    const result: SplitResult[] = portions.map((p, i) => {
      if (i === portions.length - 1) {
        return { bucket: i, total: bill.total - allocated };
      }
      const amt = Math.round((bill.total * p) / totalPortions);
      allocated += amt;
      return { bucket: i, total: amt };
    });
    return result;
  }

  // by-item: gán mỗi món vào 1 bucket theo assignments[menuItemId].
  const buckets: Record<number, number> = {};
  for (const line of bill.items) {
    const b = plan.assignments[line.menuItemId] ?? 0;
    buckets[b] = (buckets[b] ?? 0) + line.price * line.quantity;
  }
  return Object.entries(buckets)
    .map(([bucket, subtotal]) => ({
      bucket: Number(bucket),
      // Cộng thuế theo tỷ lệ subtotal của bucket so với subtotal tổng.
      total: Math.round(subtotal + (subtotal / bill.subtotal) * bill.tax),
    }))
    .sort((a, b) => a.bucket - b.bucket);
}
