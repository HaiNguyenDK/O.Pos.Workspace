// src/data/api/config.ts — cấu hình kết nối BE, đọc từ biến môi trường Expo (EXPO_PUBLIC_*).
// D10: dữ liệu qua GraphQL router (federation), auth qua REST /api/v1/auth/*.

export type ApiMode = 'mock' | 'graphql';

export const apiConfig = {
  mode: (process.env.EXPO_PUBLIC_API_MODE ?? 'mock') as ApiMode,
  /** Endpoint router, vd https://ogw.passiontech.xyz/graphql */
  graphqlUrl: process.env.EXPO_PUBLIC_GRAPHQL_URL ?? '',
  /**
   * REST auth của gateway, vd https://ogw.passiontech.xyz/api/v1. Dùng để kích hoạt máy
   * (quản lý đăng nhập portal 1 lần) cho tới khi BE có /auth/pos/terminal/* (pos-be-api-request 3.3).
   */
  restUrl: process.env.EXPO_PUBLIC_REST_URL ?? '',
  /** Dự phòng khi máy chưa kích hoạt — bình thường tenant/chi nhánh lấy từ phiên kích hoạt máy. */
  tenantId: process.env.EXPO_PUBLIC_TENANT_ID ?? '',
  branchId: process.env.EXPO_PUBLIC_BRANCH_ID ?? '',
  timeoutMs: 15000,
};
