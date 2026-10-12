// src/native/receipt.ts — format hoá đơn text cho máy in nhiệt 58mm (32 cột).
// In từ Bill server trả (D7): đủ dòng Tạm tính / Giảm giá / Phí phục vụ / VAT / Tip / Tổng để cộng ra đúng.
// Layout ở JS để dễ chỉnh; native chỉ printText. Money format qua lib/format.
// ⏳ Tiếng Việt có dấu + ký hiệu ₫ trên Sunmi cần test máy thật (pos-plan Mục 8 #1).
import { formatMoney, formatDateTime } from '@/lib/format';
import { taxLabel } from '@/domain/pricing';
import type { Bill, Payment, PaymentMethod, ShiftReport } from '@/data/types';

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

/** Mã máy rút gọn để in (6 ký tự cuối của X-Device-Id). */
export const shortTerminalId = (id: string) => (id ? id.replace(/-/g, '').slice(-6).toUpperCase() : '—');

const signedMoney = (v: number) => (v > 0 ? `+${formatMoney(v)}` : formatMoney(v));

/**
 * Báo cáo X/Z ca thu ngân (pos-plan Mục 3.7) — 58mm, 32 cột.
 * `showCash = false` (báo cáo X do người không phải quản lý in) → ẩn khối tiền mặt để giữ đếm mù.
 * Báo cáo Z luôn in đủ: tiền hệ thống, tiền đếm, chênh lệch.
 */
export function formatShiftReport(
  r: ShiftReport,
  shop: ShopInfo = { name: 'KOPAG POS' },
  opts: { showCash?: boolean } = {}
): string {
  const sh = r.shift;
  const isZ = r.kind === 'Z';
  const showCash = isZ || opts.showCash !== false;
  const out: string[] = [];
  out.push(center(shop.name.toUpperCase()));
  if (shop.address) out.push(center(shop.address));
  out.push(line('='));
  out.push(center(`BAO CAO ${r.kind}`));
  out.push(center(isZ ? '(Chot ca)' : '(Giua ca)'));
  out.push(line('='));
  out.push(lr('May', shortTerminalId(sh.terminalId)));
  out.push(lr('Ca', `#${sh.number}`));
  out.push(lr('Mo ca', sh.openedBy.name));
  out.push(lr('', formatDateTime(sh.openedAt)));
  if (isZ && sh.closedBy) {
    out.push(lr('Chot ca', sh.closedBy.name));
    out.push(lr('', formatDateTime(sh.closedAt ?? r.generatedAt)));
  } else {
    out.push(lr('Gio in', formatDateTime(r.generatedAt)));
  }

  out.push(line());
  out.push('DOANH THU');
  out.push(lr('So bill', String(r.sales.bills)));
  out.push(lr('Tam tinh', formatMoney(r.sales.subtotal)));
  if (r.sales.discount > 0) out.push(lr('Giam gia', `-${formatMoney(r.sales.discount)}`));
  if (r.sales.serviceCharge > 0) out.push(lr('Phi phuc vu', formatMoney(r.sales.serviceCharge)));
  out.push(lr('VAT', formatMoney(r.sales.tax)));
  if (r.sales.tips > 0) out.push(lr('Tip', formatMoney(r.sales.tips)));
  out.push(lr('TONG THU', formatMoney(r.sales.total)));

  out.push(line());
  out.push('THANH TOAN');
  if (r.payments.length === 0) out.push('  (khong co)');
  for (const p of r.payments) out.push(lr(`${METHOD_LABEL[p.method]} (${p.count})`, formatMoney(p.amount)));
  if (r.voids.lines > 0) out.push(lr(`Huy mon (${r.voids.lines})`, formatMoney(r.voids.amount)));

  if (showCash) {
    out.push(line());
    out.push('TIEN MAT');
    out.push(lr('Dau ca', formatMoney(r.cash.openingFloat)));
    out.push(lr('Thu tien mat', formatMoney(r.cash.cashSales)));
    if (r.cash.cashIn > 0) out.push(lr('Nop vao', formatMoney(r.cash.cashIn)));
    if (r.cash.cashOut > 0) out.push(lr('Chi ra', `-${formatMoney(r.cash.cashOut)}`));
    out.push(lr('Tien he thong', formatMoney(r.cash.expected)));
    if (isZ && r.counted !== undefined && r.variance !== undefined) {
      out.push(lr('Tien dem duoc', formatMoney(r.counted)));
      const tag = r.variance === 0 ? 'Khop' : r.variance < 0 ? 'Thieu' : 'Thua';
      out.push(lr(`Chenh lech (${tag})`, signedMoney(r.variance)));
      if (sh.closeNote) out.push(`Ghi chu: ${sh.closeNote}`);
    }
  }

  out.push(line());
  if (isZ) {
    out.push('');
    out.push(lr('Thu ngan', 'Quan ly'));
    out.push('');
    out.push('');
  }
  return out.join('\n');
}
