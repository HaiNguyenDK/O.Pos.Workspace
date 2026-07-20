// src/native/receipt.ts — format hoá đơn text cho máy in nhiệt 58mm (32 cột).
// Layout ở JS để dễ chỉnh; native chỉ printText. Money format qua lib/format.
import { formatMoney, formatDateTime } from '@/lib/format';
import type { Bill, PaymentMethod } from '@/data/types';

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
  cash: 'Tien mat',
  qr: 'VietQR',
  card: 'The',
  ewallet: 'Vi dien tu',
};

export type ShopInfo = { name: string; address?: string; phone?: string };

/** Sinh chuỗi hoá đơn để printText. */
export function formatReceipt(bill: Bill, shop: ShopInfo = { name: 'WAITER POS' }): string {
  const out: string[] = [];
  out.push(center(shop.name.toUpperCase()));
  if (shop.address) out.push(center(shop.address));
  if (shop.phone) out.push(center(`DT: ${shop.phone}`));
  out.push(line());
  out.push(lr(bill.code, formatDateTime(bill.paidAt)));
  if (bill.tableName) out.push(`${bill.tableName} · ${bill.customerName}`);
  else out.push(bill.customerName);
  out.push(line());

  for (const it of bill.items) {
    out.push(`${it.quantity}x ${it.name}`);
    out.push(lr('', formatMoney(it.price * it.quantity)));
    if (it.note) out.push(`   (${it.note})`);
  }

  out.push(line());
  out.push(lr('Tam tinh', formatMoney(bill.subtotal)));
  out.push(lr('VAT 10%', formatMoney(bill.tax)));
  out.push(lr('TONG CONG', formatMoney(bill.total)));
  out.push(line());
  out.push(lr('Thanh toan', METHOD_LABEL[bill.paymentMethod]));
  out.push('');
  out.push(center('Cam on quy khach!'));
  out.push(center('Hen gap lai'));
  return out.join('\n');
}
