// src/data/api/config.ts — cấu hình kết nối BE, đọc từ biến môi trường Expo (EXPO_PUBLIC_*).
// D10: dữ liệu qua GraphQL router (federation), auth qua REST /api/v1/auth/*.

export type ApiMode = 'mock' | 'graphql';

/**
 * Nhóm API BE (shape thật theo BE @ bb3e223c6 — docs/pos/be-review-2026-10-11.md). Chế độ graphql: nhóm nào bật
 * thì gọi BE thật, nhóm nào tắt thì chạy mock — BE deploy nhóm nào chỉ cần thêm tên nhóm vào EXPO_PUBLIC_BE_FEATURES.
 * - `menu-v2`: getMenu dùng productServiceMenu (modifierGroups, station, priceVnd) thay vì SearchProducts.
 * - `branch-settings`: me() đọc Branch.phoneNumber + settings (VAT, phí phục vụ, làm tròn) từ entity.
 * Hai cờ này chưa lên gateway ogw (review Mục 1) — bật khi BE publish subgraph product/entity.
 */
export const BE_FEATURES = [
  'orders',
  'bills',
  'payments',
  'approvals',
  'pin',
  'shifts',
  'notifications',
  'menu-v2',
  'branch-settings',
] as const;
export type BeFeature = (typeof BE_FEATURES)[number];

/** "orders, bills" → Set{orders, bills}. Rỗng → không nhóm nào (mọi thứ chạy mock). Tên lạ bị bỏ qua. */
export function parseBeFeatures(raw: string | undefined): Set<BeFeature> {
  const out = new Set<BeFeature>();
  for (const part of (raw ?? '').split(',')) {
    const name = part.trim().toLowerCase();
    if (!name) continue;
    if ((BE_FEATURES as readonly string[]).includes(name)) out.add(name as BeFeature);
    else console.warn(`[PosApi] EXPO_PUBLIC_BE_FEATURES: bỏ qua nhóm không biết "${name}"`);
  }
  return out;
}

export const apiConfig = {
  mode: (process.env.EXPO_PUBLIC_API_MODE ?? 'mock') as ApiMode,
  /** Endpoint router, vd https://ogw.passiontech.xyz/graphql */
  graphqlUrl: process.env.EXPO_PUBLIC_GRAPHQL_URL ?? '',
  /**
   * REST auth của gateway, vd https://ogw.passiontech.xyz/api/v1. Dùng cho kích hoạt máy bằng đăng nhập portal
   * (/auth/portal/*) và auth POS của BE (/pos/auth/{terminal/activate, pin-login, approve}).
   */
  restUrl: process.env.EXPO_PUBLIC_REST_URL ?? '',
  /** Dự phòng khi máy chưa kích hoạt — bình thường tenant/chi nhánh lấy từ phiên kích hoạt máy. */
  tenantId: process.env.EXPO_PUBLIC_TENANT_ID ?? '',
  branchId: process.env.EXPO_PUBLIC_BRANCH_ID ?? '',
  /** Nhóm API gọi BE thật (chỉ có tác dụng ở chế độ graphql). Đọc lúc gọi → đổi được khi chạy (script verify). */
  beFeatures: parseBeFeatures(process.env.EXPO_PUBLIC_BE_FEATURES),
  timeoutMs: 15000,
};
