// src/data/api/graphql-client.ts — gọi GraphQL router của BE (passiontech).
// Gắn header theo BE (pkg/middleware): Authorization, X-Tenant-ID, X-Device-Id.
// Lỗi nghiệp vụ → PosApiError (mã contract); lỗi mạng/timeout → Error thường (offline queue thử lại được).
import { apiConfig } from '@/data/api/config';
import { apiSession, getDeviceId, setDeviceId } from '@/data/api/session';
import { refreshTerminal, terminalAccessToken, terminalSession } from '@/data/api/terminal';
import { isPosApiError, PosApiError, type PosErrorCode } from '@/data/types';

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

/** Giữ export cũ: lib/device và script verify gọi setDeviceId từ đây. */
export { setDeviceId };

async function send<T>(query: string, variables: Record<string, unknown> | undefined, token: string | undefined) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const tenantId = terminalSession.get()?.tenantId || apiConfig.tenantId;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  const deviceId = getDeviceId();
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

/**
 * Token: phiên kích hoạt máy (terminal.ts) — tự làm mới khi sắp hết hạn, và thử lại 1 lần nếu BE
 * báo UNAUTHENTICATED. Máy chưa kích hoạt thì dùng token phiên PIN (chế độ mock).
 */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!apiConfig.graphqlUrl) throw new PosApiError('VALIDATION', 'Chưa cấu hình EXPO_PUBLIC_GRAPHQL_URL');
  const token = (await terminalAccessToken()) ?? apiSession.get()?.accessToken;
  try {
    return await send<T>(query, variables, token);
  } catch (e) {
    if (!terminalSession.get() || !isPosApiError(e) || e.code !== 'UNAUTHENTICATED') throw e;
    const fresh = await refreshTerminal();
    return send<T>(query, variables, fresh.accessToken);
  }
}
