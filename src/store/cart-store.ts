// src/store/cart-store.ts — giỏ: các dòng MỚI chưa gửi bếp cho đơn đang mở.
// Mỗi dòng có lineId (UUID) sinh ngay khi thêm — dùng làm id dòng phía server (D6).
import { create } from 'zustand';
import { newId } from '@/lib/id';
import type { LineModifier, MenuItem, Money, NewLineInput } from '@/data/types';

export type CartLine = {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPrice: Money; // chưa gồm modifier
  modifiers: LineModifier[];
  quantity: number;
  note?: string;
};

export const toNewLine = (l: CartLine): NewLineInput => ({
  lineId: l.lineId,
  menuItemId: l.menuItemId,
  quantity: l.quantity,
  modifierOptionIds: l.modifiers.map((m) => m.optionId),
  note: l.note,
});

const sameChoice = (a: LineModifier[], b: LineModifier[]) =>
  a.length === b.length && a.every((m) => b.some((x) => x.optionId === m.optionId));

type CartState = {
  lines: CartLine[];
  addItem: (item: MenuItem, qty?: number, note?: string, modifiers?: LineModifier[]) => void;
  setQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  lines: [],

  // Cùng món + cùng ghi chú + cùng lựa chọn → cộng số lượng vào dòng có sẵn.
  addItem: (item, qty = 1, note, modifiers = []) =>
    set((s) => {
      const existing = s.lines.find(
        (l) => l.menuItemId === item.id && l.note === note && sameChoice(l.modifiers, modifiers)
      );
      if (existing) {
        return { lines: s.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + qty } : l)) };
      }
      return {
        lines: [
          ...s.lines,
          { lineId: newId(), menuItemId: item.id, name: item.name, unitPrice: item.price, modifiers, quantity: qty, note },
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
