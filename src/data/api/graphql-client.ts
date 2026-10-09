// src/data/api/graphql-client.ts — gọi GraphQL router của BE (passiontech).
// Gắn header theo BE (pkg/middleware): Authorization, X-Tenant-ID, X-Device-Id.
// Lỗi nghiệp vụ → PosApiError (mã contract); lỗi mạng/timeout → Error thường (offline queue thử lại được).
import { apiConfig } from '@/data/api/config';
import { apiSession } from '@/data/api/session';
import { PosApiError, type PosErrorCode } from '@/data/types';

/**
 * BE trả extensions.code dạng số (pkg/errx). Bảng này ánh xạ các mã đã biết;
 * ⏳ bảng mã của restaurant service chờ BE cấp (pos-be-api-request Mục 4).
 */
const KNOWN_CODES: Record<number, PosErrorCode> = {
  // REST PIN (auth/pin_auth_handler.go)
  40101: 'UNAUTHENTICATED',
  40301: 'FORBIDDEN',
  42301: 'FORBIDDEN',
  // Auth module (errx/codes_core.go)
  200201: 'UNAUTHENTICATED',
  200202: 'UNAUTHENTICATED',
  200203: 'UNAUTHENTICATED',
  200204: 'UNAUTHENTICATED',
  200207: 'UNAUTHENTICATED', // device mismatch
  // Order module (errx/codes_order.go)
  210011: 'ORDER_LOCKED',
  210012: 'ORDER_LOCKED',
};

/** Mã chung kiểu HTTP (…400, …401, …403, …404) của sponge errcode. */
function byHttpSuffix(code: number): PosErrorCode | undefined {
  switch (code % 1000) {
    case 400:
      return 'VALIDATION';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    default:
      return undefined;
  }
}

export function mapErrorCode(code: unknown): PosErrorCode {
  const n = typeof code === 'number' ? code : Number(code);
  if (!Number.isFinite(n)) return 'VALIDATION';
  return KNOWN_CODES[n] ?? byHttpSuffix(n) ?? 'VALIDATION';
}

type GqlError = { message: string; extensions?: { code?: unknown } };

/** Id cố định của máy — BE so với claim deviceIdHash trong token. Gán khi khởi động (lib/device). */
let deviceId = '';
export const setDeviceId = (id: string) => {
  deviceId = id;
};

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!apiConfig.graphqlUrl) throw new PosApiError('VALIDATION', 'Chưa cấu hình EXPO_PUBLIC_GRAPHQL_URL');
  const session = apiSession.get();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = apiConfig.devAccessToken || session?.accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiConfig.tenantId) headers['X-Tenant-ID'] = apiConfig.tenantId;
  if (deviceId) headers['X-Device-Id'] = deviceId;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), apiConfig.timeoutMs);
  let res: Response;
  try {
    res = await fetch(apiConfig.graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) throw new PosApiError('UNAUTHENTICATED', 'Phiên đăng nhập hết hạn');
  if (res.status === 403) throw new PosApiError('FORBIDDEN', 'Không có quyền');
  if (res.status >= 500) throw new Error(`Máy chủ lỗi (${res.status})`); // coi như lỗi tạm thời

  const body = (await res.json()) as { data?: T; errors?: GqlError[] };
  if (body.errors?.length) {
    const e = body.errors[0];
    throw new PosApiError(mapErrorCode(e.extensions?.code), e.message, { beCode: e.extensions?.code });
  }
  if (!body.data) throw new Error('Phản hồi rỗng từ máy chủ');
  return body.data;
}
