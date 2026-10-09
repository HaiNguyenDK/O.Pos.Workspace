// src/lib/status.ts — map enum contract (pos-plan Mục 3.3) → tông màu chip (lib/theme color.status) + nhãn.
import type { color } from '@/lib/theme';
import type { LineStatus, OrderStatus, PaymentMethod, TableStatus } from '@/data/types';

export type Tone = keyof typeof color.status;

export const tableTone: Record<TableStatus, Tone> = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
};

export const orderTone: Record<OrderStatus, Tone> = {
  OPEN: 'pending',
  BILLING: 'ready',
  PAID: 'paid',
  VOIDED: 'cancelled',
  MERGED: 'paid',
};

export const orderLabel: Record<OrderStatus, string> = {
  OPEN: 'Đang phục vụ',
  BILLING: 'Chờ thanh toán',
  PAID: 'Đã thu',
  VOIDED: 'Đã huỷ',
  MERGED: 'Đã gộp',
};

export const lineTone: Record<LineStatus, Tone> = {
  FIRED: 'pending',
  PREPARING: 'pending',
  READY: 'ready',
  SERVED: 'paid',
  VOIDED: 'cancelled',
};

export const lineLabel: Record<LineStatus, string> = {
  FIRED: 'Đã gửi',
  PREPARING: 'Đang làm',
  READY: 'Sẵn sàng',
  SERVED: 'Đã ra món',
  VOIDED: 'Đã huỷ',
};

export const methodLabel: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  VIETQR: 'VietQR',
  CARD: 'Thẻ',
  EWALLET: 'Ví điện tử',
};
