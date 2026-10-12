// src/store/order-store.ts — ngữ cảnh ĐƠN ĐANG MỞ (chia sẻ giữa table→menu→cart→bill).
// Chỉ giữ định danh; dòng món, version, trạng thái luôn đọc từ server (useOrder) — D7.
import { create } from 'zustand';
import type { ServiceMode } from '@/data/types';

export type ActiveOrder = {
  orderId: string;
  tableId?: string;
  tableName?: string;
  customerName?: string;
  mode: ServiceMode;
};

type OrderState = {
  active: ActiveOrder | null;
  setActive: (o: ActiveOrder) => void;
  clear: () => void;
};

export const useOrderStore = create<OrderState>((set) => ({
  active: null,
  setActive: (active) => set({ active }),
  clear: () => set({ active: null }),
}));
