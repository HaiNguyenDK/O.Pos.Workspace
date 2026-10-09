// src/store/cart-store.ts — giỏ: các dòng MỚI chưa gửi bếp cho đơn đang mở.
// Mỗi dòng có lineId (UUID) sinh ngay khi thêm — dùng làm id dòng phía server (D6).
import { create } from 'zustand';
import { newId } from '@/lib/id';
import type { MenuItem, Money, NewLineInput } from '@/data/types';

export type CartLine = {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPrice: Money;
  quantity: number;
  note?: string;
};

export const toNewLine = (l: CartLine): NewLineInput => ({
  lineId: l.lineId,
  menuItemId: l.menuItemId,
  quantity: l.quantity,
  modifierOptionIds: [],
  note: l.note,
});

type CartState = {
  lines: CartLine[];
  addItem: (item: MenuItem, qty?: number, note?: string) => void;
  setQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  lines: [],

  addItem: (item, qty = 1, note) =>
    set((s) => {
      const existing = s.lines.find((l) => l.menuItemId === item.id && l.note === note);
      if (existing) {
        return { lines: s.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + qty } : l)) };
      }
      return {
        lines: [
          ...s.lines,
          { lineId: newId(), menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: qty, note },
        ],
      };
    }),

  setQty: (lineId, qty) =>
    set((s) => ({
      lines:
        qty <= 0
          ? s.lines.filter((l) => l.lineId !== lineId)
          : s.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l)),
    })),

  removeLine: (lineId) => set((s) => ({ lines: s.lines.filter((l) => l.lineId !== lineId) })),

  clear: () => set({ lines: [] }),
}));
