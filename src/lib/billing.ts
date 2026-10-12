// src/lib/billing.ts — helper UI cho thanh toán (gợi ý mệnh giá, preset tip/giảm giá).
// Voucher / khách thân thiết đi qua PosApi (requestBill / lookupCustomer), không validate ở client.

/** Gợi ý mệnh giá tiền mặt ≥ tổng cần thu (VND). */
export function cashSuggestions(total: number): number[] {
  const notes = [10000, 20000, 50000, 100000, 200000, 500000];
  const out = new Set<number>();
  // Làm tròn lên bội số 10k, 50k, 100k
  out.add(Math.ceil(total / 10000) * 10000);
  out.add(Math.ceil(total / 50000) * 50000);
  out.add(Math.ceil(total / 100000) * 100000);
  for (const n of notes) if (n >= total) out.add(n);
  return [...out].filter((n) => n >= total).sort((a, b) => a - b).slice(0, 4);
}

export const TIP_PRESETS = [0, 10000, 20000, 50000];
export const DISCOUNT_PRESETS = [0, 10000, 20000, 50000];
