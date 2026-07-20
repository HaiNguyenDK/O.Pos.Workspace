// src/store/order-store.ts — ngữ cảnh ĐƠN ĐANG MỞ (chia sẻ giữa table→menu→cart).
// cartStore giữ dòng MỚI chưa gửi; orderStore giữ định danh đơn + snapshot dòng ĐÃ gửi.
import { create } from 'zustand';
import type { OrderLine, ServiceMode } from '@/data/types';

type ActiveOrder = {
  orderId: string;
  tableId?: string;
  tableName?: string;
  customerName: string;
  mode: ServiceMode;
};

type OrderState = {
  active: ActiveOrder | null;
  sentLines: OrderLine[]; // đã gửi bếp (read-only trong giỏ)
  setActive: (o: ActiveOrder, sentLines?: OrderLine[]) => void;
  setSentLines: (lines: OrderLine[]) => void;
  clear: () => void;
};

export const useOrderStore = create<OrderState>((set) => ({
  active: null,
  sentLines: [],
  setActive: (active, sentLines = []) => set({ active, sentLines }),
  setSentLines: (sentLines) => set({ sentLines }),
  clear: () => set({ active: null, sentLines: [] }),
}));
