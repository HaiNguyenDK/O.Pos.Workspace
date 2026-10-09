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

// Nhãn hiển thị = i18n key; dịch tại call site bằng t(...).
export const orderLabelKey: Record<OrderStatus, string> = {
  OPEN: 'orderStatus.OPEN',
  BILLING: 'orderStatus.BILLING',
  PAID: 'orderStatus.PAID',
  VOIDED: 'orderStatus.VOIDED',
  MERGED: 'orderStatus.MERGED',
};

export const lineTone: Record<LineStatus, Tone> = {
  FIRED: 'pending',
  PREPARING: 'pending',
  READY: 'ready',
  SERVED: 'paid',
  VOIDED: 'cancelled',
};

export const lineLabelKey: Record<LineStatus, string> = {
  FIRED: 'lineStatus.FIRED',
  PREPARING: 'lineStatus.PREPARING',
  READY: 'lineStatus.READY',
  SERVED: 'lineStatus.SERVED',
  VOIDED: 'lineStatus.VOIDED',
};

export const methodLabelKey: Record<PaymentMethod, string> = {
  CASH: 'paymentMethod.CASH',
  VIETQR: 'paymentMethod.VIETQR',
  CARD: 'paymentMethod.CARD',
  EWALLET: 'paymentMethod.EWALLET',
};
