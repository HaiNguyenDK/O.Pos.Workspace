// src/data/api/terminal.ts — phiên kích hoạt máy (chế độ graphql).
// BE chưa có /auth/pos/terminal/* (pos-be-api-request 3.3) nên tạm dùng đăng nhập portal của quản lý:
// login → chọn tenant → token theo tenant gắn với X-Device-Id của máy. Token dùng cho mọi request GraphQL;
// PIN nhân viên vẫn chạy mock cho tới khi BE có PIN máy dùng chung.
import { rest } from '@/data/api/rest-client';
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
  /**
   * Bí mật máy do BE cấp khi đăng ký máy (POST /auth/pos/terminal/register, 3.3) — cần cho PIN máy dùng chung
   * (/auth/pos/pin/login). Chưa có cho tới khi BE làm luồng đăng ký máy.
   */
  deviceSecret?: string;
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
