// src/data/api/index.ts — chọn impl theo EXPO_PUBLIC_API_MODE (mock | graphql).
// graphql = BE passiontech cho phần đã có (menu, chi nhánh), phần còn lại tạm mock — xem data/api/graphql.ts.
import { apiConfig } from '@/data/api/config';
import { graphqlPosApi } from '@/data/api/graphql';
import { mockPosApi } from '@/data/api/mock';
import type { PosApi } from '@/data/api/PosApi';

function resolveApi(): PosApi {
  if (apiConfig.mode === 'graphql') {
    if (!apiConfig.graphqlUrl) console.warn('[PosApi] API_MODE=graphql nhưng thiếu EXPO_PUBLIC_GRAPHQL_URL — dùng mock.');
    else return graphqlPosApi;
  }
  return mockPosApi;
}

export const api: PosApi = resolveApi();
export type { PosApi } from '@/data/api/PosApi';
