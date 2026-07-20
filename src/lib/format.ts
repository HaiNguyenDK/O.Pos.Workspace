// src/lib/format.ts — format tiền/ngày DÙNG CHUNG (Mục 3.6). KHÔNG format thủ công nơi khác.
// Đơn vị tiền: VND (đồng, số nguyên). Đổi ở đây nếu quán dùng tiền tệ khác.

const currencyFmt = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return currencyFmt.format(amount ?? 0);
}

/** ISO 8601 string → giờ:phút ngày/tháng (hiển thị). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(d);
}
