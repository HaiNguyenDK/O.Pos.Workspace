// src/data/api/terminal.ts — phiên kích hoạt máy (chế độ graphql).
// BE chưa có /auth/pos/terminal/* (pos-be-api-request 3.3) nên tạm dùng đăng nhập portal của quản lý:
// login → chọn tenant → token theo tenant gắn với X-Device-Id của máy. Token dùng cho mọi request GraphQL;
// PIN nhân viên vẫn chạy mock cho tới khi BE có PIN máy dùng chung.
import { apiConfig } from '@/data/api/config';
import { getDeviceId } from '@/data/api/session';
import { PosApiError } from '@/data/types';

export type TerminalSession = {
  accessToken: string;
  refreshToken: string;
  /** ISO — hết hạn access token */
  expiresAt: string;
  tenantId: string;
  /** Email quản lý đã kích hoạt máy */
  email: string;
  branchId?: string;
  branchName?: string;
};

type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };
type LoginResponse = TokenResponse & { tenants?: string[] | null };

const KEY = 'pos.terminal.session';
let current: TerminalSession | null = null;

// Import động: tầng API chạy được ngoài app (script verify) khi không đụng tới lưu trữ.
const secureStore = () => import('expo-secure-store');

export const terminalSession = {
  get: () => current,
  /** Chỉ đặt trong bộ nhớ (script kiểm thử). */
  set: (s: TerminalSession | null) => {
    current = s;
  },
  /** Ghi bộ nhớ trước; lỗi lưu trữ không làm hỏng request (lần mở app sau sẽ phải kích hoạt lại). */
  async save(s: TerminalSession | null) {
    current = s;
    try {
      const store = await secureStore();
      if (s) await store.setItemAsync(KEY, JSON.stringify(s));
      else await store.deleteItemAsync(KEY);
    } catch (e) {
      console.warn('[terminal] không lưu được phiên máy', e);
    }
  },
  async load() {
    const raw = await (await secureStore()).getItemAsync(KEY);
    current = raw ? (JSON.parse(raw) as TerminalSession) : null;
    return current;
  },
};

const expiresAt = (expiresIn: number) => new Date(Date.now() + expiresIn * 1000).toISOString();

async function rest<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  if (!apiConfig.restUrl) throw new PosApiError('VALIDATION', 'Chưa cấu hình EXPO_PUBLIC_REST_URL');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), apiConfig.timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${apiConfig.restUrl}${path}`, {
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
    try {
      const b = (await res.json()) as { message?: string; error?: string };
      message = b.message || b.error || message;
    } catch {
      // body không phải JSON
    }
    if (res.status >= 500) throw new Error(message); // lỗi tạm thời
    throw new PosApiError(res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'FORBIDDEN' : 'VALIDATION', message);
  }
  return (await res.json()) as T;
}

/** Bước 1: email + mật khẩu portal → token chọn tenant + danh sách tenant được phép. */
export async function terminalLogin(email: string, password: string) {
  const res = await rest<LoginResponse>('/auth/portal/login', {
    method: 'POST',
    body: { email, password, deviceId: getDeviceId() },
  });
  return { preToken: res.accessToken, tenants: res.tenants ?? [] };
}

/** Bước 2: chọn tenant → token theo tenant, lưu thành phiên của máy. */
export async function terminalSelectTenant(preToken: string, tenantId: string, email: string) {
  const res = await rest<TokenResponse>('/auth/portal/select-tenant', {
    method: 'POST',
    token: preToken,
    body: { tenantId },
  });
  const session: TerminalSession = {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    expiresAt: expiresAt(res.expiresIn),
    tenantId,
    email,
  };
  await terminalSession.save(session);
  return session;
}

let refreshing: Promise<TerminalSession> | null = null;

/** Làm mới access token (1 lần cho nhiều request đồng thời). Lỗi 401 → máy phải kích hoạt lại. */
export function refreshTerminal(): Promise<TerminalSession> {
  const s = current;
  if (!s) return Promise.reject(new PosApiError('UNAUTHENTICATED', 'Máy chưa được kích hoạt'));
  refreshing ??= rest<TokenResponse>('/auth/portal/refresh', {
    method: 'POST',
    body: { refreshToken: s.refreshToken, deviceId: getDeviceId() },
  })
    .then(async (res) => {
      if (!res?.accessToken) throw new PosApiError('UNAUTHENTICATED', 'Không làm mới được phiên của máy');
      const next = { ...s, accessToken: res.accessToken, refreshToken: res.refreshToken, expiresAt: expiresAt(res.expiresIn) };
      await terminalSession.save(next);
      return next;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Token còn dùng được ≥ 60s thì giữ, sắp hết thì làm mới trước. */
export async function terminalAccessToken(): Promise<string | undefined> {
  const s = current;
  if (!s) return undefined;
  if (Date.parse(s.expiresAt) - Date.now() > 60_000) return s.accessToken;
  return (await refreshTerminal()).accessToken;
}
