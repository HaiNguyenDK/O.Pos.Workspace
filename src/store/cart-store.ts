// src/store/cart-store.ts — giỏ hàng cho đơn đang mở (thay PosContext). Mục 5.
import { create } from 'zustand';
import { calcTotal, type PriceBreakdown } from '@/domain/pricing';
import type { MenuItem, OrderLine } from '@/data/types';

type CartState = {
  orderId: string | null;
  lines: OrderLine[];
  setOrder: (orderId: string | null) => void;
  addItem: (item: MenuItem, qty?: number, note?: string) => void;
  setQty: (menuItemId: string, qty: number) => void;
  removeItem: (menuItemId: string) => void;
  clear: () => void;
  totals: () => PriceBreakdown;
};

export const useCartStore = create<CartState>((set, get) => ({
  orderId: null,
  lines: [],

  setOrder: (orderId) => set({ orderId }),

  addItem: (item, qty = 1, note) =>
    set((s) => {
      const existing = s.lines.find((l) => l.menuItemId === item.id && l.note === note);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l === existing ? { ...l, quantity: l.quantity + qty } : l
          ),
        };
      }
      return {
        lines: [
          ...s.lines,
          { menuItemId: item.id, name: item.name, price: item.price, quantity: qty, note },
        ],
      };
    }),

  setQty: (menuItemId, qty) =>
    set((s) => ({
      lines:
        qty <= 0
          ? s.lines.filter((l) => l.menuItemId !== menuItemId)
          : s.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: qty } : l)),
    })),

  removeItem: (menuItemId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.menuItemId !== menuItemId) })),

  clear: () => set({ lines: [], orderId: null }),

  totals: () => calcTotal(get().lines),
}));
