// src/native/receipt.ts — format hoá đơn text cho máy in nhiệt 58mm (32 cột).
// In từ Bill server trả (D7): đủ dòng Tạm tính / Giảm giá / Phí phục vụ / VAT / Tip / Tổng để cộng ra đúng.
// Layout ở JS để dễ chỉnh; native chỉ printText. Money format qua lib/format.
// ⏳ Tiếng Việt có dấu + ký hiệu ₫ trên Sunmi cần test máy thật (pos-plan Mục 8 #1).
import { formatMoney, formatDateTime } from '@/lib/format';
import { taxLabel } from '@/domain/pricing';
import type { Bill, Payment, PaymentMethod } from '@/data/types';

const WIDTH = 32;
const line = (ch = '-') => ch.repeat(WIDTH);

/** Trái + phải trên cùng một dòng, giãn bằng khoảng trắng. */
function lr(left: string, right: string): string {
  const space = WIDTH - left.length - right.length;
  if (space >= 1) return left + ' '.repeat(space) + right;
  // Xuống dòng nếu quá dài: trái một dòng, phải canh phải dòng dưới.
  return left + '\n' + right.padStart(WIDTH);
}

function center(text: string): string {
  if (text.length >= WIDTH) return text;
  const pad = Math.floor((WIDTH - text.length) / 2);
  return ' '.repeat(pad) + text;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Tien mat',
  VIETQR: 'VietQR',
  CARD: 'The',
  EWALLET: 'Vi dien tu',
};

export type ShopInfo = { name: string; address?: string; phone?: string };

/** Sinh chuỗi hoá đơn để printText. */
export function formatReceipt(bill: Bill, shop: ShopInfo = { name: 'KOPAG POS' }): string {
  const out: string[] = [];
  out.push(center(shop.name.toUpperCase()));
  if (shop.address) out.push(center(shop.address));
  if (shop.phone) out.push(center(`DT: ${shop.phone}`));
  out.push(line());
  out.push(lr(bill.code, formatDateTime(bill.paidAt ?? bill.createdAt)));
  const who = [bill.tableName, bill.customerName].filter(Boolean).join(' · ');
  if (who) out.push(who);
  if (bill.part) out.push(`Phan ${bill.part.index + 1}/${bill.part.of}`);
  out.push(line());

  for (const it of bill.lines) {
    out.push(`${it.quantity}x ${it.name}`);
    out.push(lr('', formatMoney(it.lineTotal)));
    if (it.modifiers.length > 0) out.push(`   + ${it.modifiers.join(', ')}`);
    if (it.note) out.push(`   (${it.note})`);
  }

  out.push(line());
  out.push(lr('Tam tinh', formatMoney(bill.subtotal)));
  if (bill.discountTotal > 0) out.push(lr('Giam gia', `-${formatMoney(bill.discountTotal)}`));
  if (bill.serviceCharge > 0) out.push(lr('Phi phuc vu', formatMoney(bill.serviceCharge)));
  out.push(lr(taxLabel(bill.taxRate), formatMoney(bill.tax)));
  if (bill.tip > 0) out.push(lr('Tip', formatMoney(bill.tip)));
  out.push(lr('TONG CONG', formatMoney(bill.total)));
  out.push(line());

  const paid: Payment[] = bill.payments.filter((p) => p.status === 'SUCCEEDED');
  for (const p of paid) {
    out.push(lr(`Thanh toan ${METHOD_LABEL[p.method]}`, formatMoney(p.amount)));
    if (p.method === 'CASH' && p.tendered !== undefined) {
      out.push(lr('  Khach dua', formatMoney(p.tendered)));
      out.push(lr('  Tien thoi', formatMoney(p.change ?? 0)));
    }
  }
  out.push('');
  out.push(center('Cam on quy khach!'));
  out.push(center('Hen gap lai'));
  return out.join('\n');
}
