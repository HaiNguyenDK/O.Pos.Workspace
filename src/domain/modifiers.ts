// src/domain/modifiers.ts — kiểm tra lựa chọn modifier theo nhóm (min/max) — pos-plan Mục 3.1 ModifierGroup.
// Server là nơi kiểm chuẩn; client dùng cùng hàm để bật/tắt nút "Thêm".
import type { LineModifier, MenuItem } from '@/data/types';

export type ModifierCheck = { modifiers: LineModifier[]; error?: string };

export function resolveModifiers(item: MenuItem, optionIds: string[]): ModifierCheck {
  const ids = [...new Set(optionIds)];
  const modifiers: LineModifier[] = [];
  for (const id of ids) {
    const group = item.modifierGroups.find((g) => g.options.some((o) => o.id === id));
    if (!group) return { modifiers: [], error: `Lựa chọn không thuộc món ${item.name}` };
    const o = group.options.find((x) => x.id === id)!;
    modifiers.push({ optionId: o.id, name: o.name, priceDelta: o.priceDelta });
  }
  for (const g of item.modifierGroups) {
    const n = g.options.filter((o) => ids.includes(o.id)).length;
    if (n < g.min) return { modifiers, error: `Chọn ${g.name}` };
    if (n > g.max) return { modifiers, error: `${g.name}: tối đa ${g.max}` };
  }
  return { modifiers };
}

/** Món có nhóm bắt buộc → không "thêm nhanh" được, phải mở sheet chọn. */
export const needsModifierChoice = (item: MenuItem) => item.modifierGroups.some((g) => g.min > 0);

/** Lựa chọn mặc định: nhóm bắt buộc chọn 1 → lấy lựa chọn đầu tiên. */
export const defaultOptionIds = (item: MenuItem) =>
  item.modifierGroups.filter((g) => g.min === 1 && g.max === 1 && g.options.length > 0).map((g) => g.options[0].id);

export const modifierText = (mods: { name: string }[]) => mods.map((m) => m.name).join(', ');
