// src/data/api/graphql-client.ts — gọi GraphQL router của BE (passiontech).
// Gắn header theo BE (pkg/middleware): Authorization, X-Tenant-ID, X-Device-Id.
// Lỗi nghiệp vụ → PosApiError (mã contract); lỗi mạng/timeout → Error thường (offline queue thử lại được).
import { apiConfig } from '@/data/api/config';
import { apiSession, getDeviceId, setDeviceId } from '@/data/api/session';
import { refreshTerminal, terminalAccessToken, terminalSession } from '@/data/api/terminal';
import { errorExtras, isTransientErrorCode, mapErrorCode } from '@/data/api/errors';
import { isPosApiError, PosApiError } from '@/data/types';

/** Bảng mã lỗi BE → contract: data/api/errors.ts (giữ export cũ cho nơi đang import từ đây). */
export { mapErrorCode };

type GqlError = { message: string; extensions?: { code?: unknown } & Record<string, unknown> };

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
    // Giữ extensions (vd currentOrderId của TABLE_OCCUPIED, latestVersion của VERSION_CONFLICT).
    const { code, ...ext } = e.extensions ?? {};
    // Subgraph không gọi được / dịch vụ tạm lỗi → như mất mạng (thử lại được), không phải lỗi nghiệp vụ.
    if (isTransientErrorCode(code)) throw new Error(`Máy chủ tạm lỗi (${String(code)})`);
    throw new PosApiError(mapErrorCode(code), e.message, { ...errorExtras(code), ...ext, beCode: code });
  }
  if (!body.data) throw new Error('Phản hồi rỗng từ máy chủ');
  return body.data;
}

/**
 * Token: phiên kích hoạt máy (terminal.ts) — tự làm mới khi sắp hết hạn, và thử lại 1 lần nếu BE
 * báo UNAUTHENTICATED. Máy chưa kích hoạt thì dùng token phiên PIN (chế độ mock).
 * Cờ `pin` bật (POST /api/v1/pos/auth/pin-login): staffJwt mang tenant/branch/role → ưu tiên token đó;
 * BE không cấp refresh token → hết hạn thì app đưa về màn PIN (không tự làm mới).
 */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!apiConfig.graphqlUrl) throw new PosApiError('VALIDATION', 'Chưa cấu hình EXPO_PUBLIC_GRAPHQL_URL');
  const staffToken = apiConfig.beFeatures.has('pin') ? apiSession.get()?.accessToken : undefined;
  const token = staffToken ?? (await terminalAccessToken()) ?? apiSession.get()?.accessToken;
  try {
    return await send<T>(query, variables, token);
  } catch (e) {
    if (staffToken || !terminalSession.get() || !isPosApiError(e) || e.code !== 'UNAUTHENTICATED') throw e;
    const fresh = await refreshTerminal();
    return send<T>(query, variables, fresh.accessToken);
  }
}
