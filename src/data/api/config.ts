// src/data/api/config.ts — cấu hình kết nối BE, đọc từ biến môi trường Expo (EXPO_PUBLIC_*).
// D10: dữ liệu qua GraphQL router (federation), auth qua REST /api/v1/auth/*.

export type ApiMode = 'mock' | 'graphql';

export const apiConfig = {
  mode: (process.env.EXPO_PUBLIC_API_MODE ?? 'mock') as ApiMode,
  /** Endpoint router, vd https://<router-host>/graphql — ⏳ chờ BE cấp URL dev/staging. */
  graphqlUrl: process.env.EXPO_PUBLIC_GRAPHQL_URL ?? '',
  /**
   * Tenant (= nhà hàng) và chi nhánh của máy. Khi BE có PIN máy dùng chung (pos-be-api-request 3.3),
   * token sẽ mang tenantId/branchId và 2 biến này chỉ còn là giá trị dự phòng.
   */
  tenantId: process.env.EXPO_PUBLIC_TENANT_ID ?? '',
  branchId: process.env.EXPO_PUBLIC_BRANCH_ID ?? '',
  /**
   * CHỈ DÙNG KHI DEV: access token lấy bằng REST portal login + select-tenant của BE.
   * Cần vì BE chưa có PIN máy dùng chung (pos-be-api-request 3.3) — PIN trong app đang là mock nên token mock
   * không gọi được BE. Biến EXPO_PUBLIC_* bị đóng gói vào app → KHÔNG đặt khi build bản phát hành.
   */
  devAccessToken: process.env.EXPO_PUBLIC_DEV_ACCESS_TOKEN ?? '',
  timeoutMs: 15000,
};
