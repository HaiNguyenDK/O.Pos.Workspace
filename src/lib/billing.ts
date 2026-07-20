// src/lib/billing.ts — helper cho thanh toán (mock voucher/loyalty + gợi ý mệnh giá).
// Khi có backend: voucher/loyalty gọi qua PosApi thay vì mock ở đây.
import type { Voucher } from '@/data/types';
import type { LoyaltyCustomer } from '@/store/bill-store';

/** Mã voucher mock. */
const MOCK_VOUCHERS: Record<string, Voucher> = {
  GIAM10: { code: 'GIAM10', type: 'percent', value: 10 },
  GIAM20: { code: 'GIAM20', type: 'percent', value: 20 },
  GIAM50K: { code: 'GIAM50K', type: 'amount', value: 50000 },
};

export function validateVoucher(code: string): Voucher | null {
  return MOCK_VOUCHERS[code.trim().toUpperCase()] ?? null;
}

/** Lookup loyalty theo SĐT (mock: điểm = 4 số cuối). */
export function lookupLoyalty(phone: string): LoyaltyCustomer | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  return { name: `Khách ${digits.slice(-4)}`, phone: digits, points: Number(digits.slice(-3)) * 10 };
}

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
