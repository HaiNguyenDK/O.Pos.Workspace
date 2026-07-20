// src/domain/pricing.ts — MỌI surface tính tiền qua đây (Mục 3.4). KHÔNG hardcode thuế/phí nơi khác.
import type { OrderLine, Voucher } from '@/data/types';

export const TAX_RATE = 0.1; // VAT 10% (điều chỉnh theo cấu hình quán)
export const SERVICE_RATE = 0.05; // phí phục vụ (nếu bật)

export function calcSubtotal(lines: OrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

export function calcTax(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE);
}

export function calcServiceCharge(subtotal: number): number {
  return Math.round(subtotal * SERVICE_RATE);
}

function voucherDiscount(subtotal: number, voucher?: Voucher): number {
  if (!voucher) return 0;
  if (voucher.type === 'percent') return Math.round((subtotal * voucher.value) / 100);
  return Math.min(voucher.value, subtotal);
}

export type PriceBreakdown = {
  subtotal: number;
  tax: number;
  service: number;
  discount: number;
  total: number;
};

export function calcTotal(
  lines: OrderLine[],
  opts?: { discount?: number; tip?: number; voucher?: Voucher; service?: boolean }
): PriceBreakdown {
  const subtotal = calcSubtotal(lines);
  const tax = calcTax(subtotal);
  const service = opts?.service ? calcServiceCharge(subtotal) : 0;
  const discount = (opts?.discount ?? 0) + voucherDiscount(subtotal, opts?.voucher);
  const tip = opts?.tip ?? 0;
  const total = Math.max(0, subtotal + tax + service + tip - discount);
  return { subtotal, tax, service, discount, total };
}
