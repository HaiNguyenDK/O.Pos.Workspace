// src/store/bill-store.ts — phiên thanh toán cho đơn đang mở: voucher/tip/discount/service/method.
// Số tiền LUÔN tính qua domain/pricing từ orderStore.sentLines + các điều chỉnh ở đây.
import { create } from 'zustand';
import type { PaymentMethod, Voucher } from '@/data/types';

export type LoyaltyCustomer = { name: string; phone: string; points: number };

type BillState = {
  voucher: Voucher | null;
  loyalty: LoyaltyCustomer | null;
  tip: number;
  discount: number;
  service: boolean;
  method: PaymentMethod | null;
  tendered: number; // tiền khách đưa (cash)
  setVoucher: (v: Voucher | null) => void;
  setLoyalty: (c: LoyaltyCustomer | null) => void;
  setTip: (n: number) => void;
  setDiscount: (n: number) => void;
  toggleService: () => void;
  setMethod: (m: PaymentMethod | null) => void;
  setTendered: (n: number) => void;
  reset: () => void;
};

export const useBillStore = create<BillState>((set) => ({
  voucher: null,
  loyalty: null,
  tip: 0,
  discount: 0,
  service: false,
  method: null,
  tendered: 0,
  setVoucher: (voucher) => set({ voucher }),
  setLoyalty: (loyalty) => set({ loyalty }),
  setTip: (tip) => set({ tip }),
  setDiscount: (discount) => set({ discount }),
  toggleService: () => set((s) => ({ service: !s.service })),
  setMethod: (method) => set({ method }),
  setTendered: (tendered) => set({ tendered }),
  reset: () =>
    set({ voucher: null, loyalty: null, tip: 0, discount: 0, service: false, method: null, tendered: 0 }),
}));
