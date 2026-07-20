// src/data/api/index.ts — chọn impl theo EXPO_PUBLIC_API_MODE (mock | graphql | rest).
// v1 chỉ có mock. graphqlPosApi/restPosApi thêm ở Sprint 5 (cùng interface, không sửa màn nào).
import { mockPosApi } from '@/data/api/mock';
import type { PosApi } from '@/data/api/PosApi';

const mode = process.env.EXPO_PUBLIC_API_MODE ?? 'mock';

function resolveApi(): PosApi {
  switch (mode) {
    case 'graphql':
    case 'rest':
      // TODO (Sprint 5): implement cùng interface PosApi.
      console.warn(`[PosApi] API_MODE="${mode}" chưa implement — dùng mock.`);
      return mockPosApi;
    default:
      return mockPosApi;
  }
}

export const api: PosApi = resolveApi();
export type { PosApi } from '@/data/api/PosApi';
