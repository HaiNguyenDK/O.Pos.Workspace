// src/store/bill-store.ts — phiên thanh toán cho đơn đang mở.
// Chỉ giữ ĐIỀU CHỈNH người dùng chọn + id bill/payment server trả. Số tiền luôn lấy từ Bill server (D7).
import { create } from 'zustand';
import type { Customer, DiscountType, Money } from '@/data/types';

export type ManualDiscountDraft = { type: DiscountType; value: number; reason: string; approvalToken?: string };

type BillState = {
  voucherCode: string | null;
  manualDiscount: ManualDiscountDraft | null;
  serviceCharge: boolean;
  tip: Money;
  customer: Customer | null;
  /** Bill đang thu (bill gốc hoặc 1 phần sau khi chia). */
  billId: string | null;
  /** Các phần sau khi chia — rỗng nếu không chia. */
  splitBillIds: string[];
  /** Payment vừa thành công — màn success hiển thị tiền thối. */
  lastPaymentId: string | null;
  setVoucherCode: (c: string | null) => void;
  setManualDiscount: (d: ManualDiscountDraft | null) => void;
  toggleServiceCharge: () => void;
  setTip: (n: Money) => void;
  setCustomer: (c: Customer | null) => void;
  setBillId: (id: string | null) => void;
  setSplitBillIds: (ids: string[]) => void;
  setLastPaymentId: (id: string | null) => void;
  reset: () => void;
};

const initial = {
  voucherCode: null,
  manualDiscount: null,
  serviceCharge: false,
  tip: 0,
  customer: null,
  billId: null,
  splitBillIds: [],
  lastPaymentId: null,
};

export const useBillStore = create<BillState>((set) => ({
  ...initial,
  setVoucherCode: (voucherCode) => set({ voucherCode }),
  setManualDiscount: (manualDiscount) => set({ manualDiscount }),
  toggleServiceCharge: () => set((s) => ({ serviceCharge: !s.serviceCharge })),
  setTip: (tip) => set({ tip }),
  setCustomer: (customer) => set({ customer }),
  setBillId: (billId) => set({ billId }),
  setSplitBillIds: (splitBillIds) => set({ splitBillIds }),
  setLastPaymentId: (lastPaymentId) => set({ lastPaymentId }),
  reset: () => set(initial),
}));
