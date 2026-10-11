// src/data/api/rest-client.ts — gọi REST auth của gateway (base = EXPO_PUBLIC_REST_URL, kết thúc bằng /api/v1).
// Dùng cho kích hoạt máy (terminal.ts: /auth/portal/*, /pos/auth/terminal/activate) và auth POS
// (be/pin.ts: /pos/auth/pin-login, be/approvals.ts: /pos/auth/approve).
// Lỗi nghiệp vụ → PosApiError (mã contract); lỗi mạng/5xx/timeout → Error thường (thử lại được).
import { apiConfig } from '@/data/api/config';
import { errorExtras, lookupErrorCode } from '@/data/api/errors';
import { getDeviceId } from '@/data/api/session';
import { PosApiError, type PosErrorCode } from '@/data/types';

/** Auth POS của BE: apps/passiontech-auth/internal/routers/routers.go — `/api/v1/pos/auth/*`. */
export const POS_AUTH_BASE = '/pos/auth';

function byStatus(status: number): PosErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403 || status === 423) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  return 'VALIDATION';
}

export type RestInit = { method?: string; token?: string; body?: unknown; headers?: Record<string, string> };

export async function rest<T>(path: string, init: RestInit = {}): Promise<T> {
  if (!apiConfig.restUrl) throw new PosApiError('VALIDATION', 'Chưa cấu hình EXPO_PUBLIC_REST_URL');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
    ...init.headers,
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), apiConfig.timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${apiConfig.restUrl.replace(/\/+$/, '')}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let message = `Máy chủ trả lỗi ${res.status}`;
    let code: unknown;
    try {
      const b = (await res.json()) as { message?: string; error?: string; code?: unknown };
      message = b.message || b.error || message;
      code = b.code;
    } catch {
      // body không phải JSON
    }
    if (res.status >= 500) throw new Error(message); // lỗi tạm thời
    // BE auth POS trả { code: 40101 | 42301 | 40301, message } — mã nhận ra được thì ưu tiên, không thì theo HTTP status.
    throw new PosApiError(
      lookupErrorCode(code) ?? byStatus(res.status),
      message,
      code === undefined ? undefined : { ...errorExtras(code), beCode: code }
    );
  }
  return (await res.json()) as T;
}

/** Handler auth của BE bọc kết quả `{ code: 0, message, data }`; endpoint khác trả thẳng. Nhận cả hai. */
export function unwrap<T>(body: T | { data: T }): T {
  if (body && typeof body === 'object' && 'data' in body && body.data && typeof body.data === 'object') return body.data;
  return body as T;
}

/** Header tenant cho auth POS (BE đọc `X-Tenant-Id`, không cần token). */
export const tenantHeader = (tenantId: string): Record<string, string> => ({ 'X-Tenant-Id': tenantId });
