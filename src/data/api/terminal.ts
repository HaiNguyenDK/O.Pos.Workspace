// src/data/api/terminal.ts — phiên kích hoạt máy (chế độ graphql).
// Mặc định (UI hiện tại): quản lý đăng nhập portal 1 lần → chọn tenant → token theo tenant gắn với X-Device-Id.
// Token dùng cho mọi request GraphQL khi cờ `pin` tắt.
// BE đã có kích hoạt bằng mã (POST /api/v1/pos/auth/terminal/activate) → activateWithCode() cấp deviceId + deviceToken
// cho PIN máy dùng chung (be/pin.ts). UI kích hoạt chưa đổi — portal login vẫn là mặc định.
import { POS_AUTH_BASE, rest, tenantHeader, unwrap } from '@/data/api/rest-client';
import { DEVICE_ID_KEY, getDeviceId, setDeviceId } from '@/data/api/session';
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
   * `deviceToken` BE cấp 1 lần khi kích hoạt bằng mã (POST /pos/auth/terminal/activate) — cần cho PIN máy dùng chung
   * (/pos/auth/pin-login). Chỉ có sau activateWithCode().
   */
  deviceSecret?: string;
};

type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };
type LoginResponse = TokenResponse & { tenants?: string[] | null };

const KEY = 'pos.terminal.session';
let current: TerminalSession | null = null;

// Import động: tầng API chạy được ngoài app (script verify) khi không đụng tới lưu trữ.
// Nhớ promise import (kể cả lỗi) — import lại 1 module đã lỗi có thể treo ở runtime script.
let storeModule: Promise<typeof import('expo-secure-store')> | null = null;
const secureStore = () => (storeModule ??= import('expo-secure-store'));

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

type ActivateResponse = { deviceId: string; deviceToken: string; branchId?: string };

/** Ghi id máy do server cấp vào SecureStore (cùng khoá lib/device đọc lúc khởi động). Lỗi lưu không chặn kích hoạt. */
async function persistDeviceId(id: string) {
  try {
    await (await secureStore()).setItemAsync(DEVICE_ID_KEY, id);
  } catch (e) {
    console.warn('[terminal] không lưu được id máy', e);
  }
}

/**
 * Kích hoạt máy bằng mã quản lý tạo trên dashboard (POST /api/v1/pos/auth/terminal/activate, header X-Tenant-Id,
 * body { activationCode }) → { deviceId, deviceToken, branchId } (BE-48 @ 0fca3b033). Máy dùng deviceId của server
 * (X-Device-Id từ nay về sau), lưu deviceToken làm `deviceSecret` và chi nhánh của máy theo BE (pin-login cần branchId).
 * BE không trả tên chi nhánh → lấy `opts.branch.name` nếu cùng id, không thì để trống (màn PIN hiện "chưa có tên").
 * Mã kích hoạt hết hạn sau 15 phút, dùng 1 lần (sai/hết hạn → 40102).
 * Lưu ý: token portal cũ gắn deviceIdHash của id máy CŨ → sau khi đổi sang id server sẽ bị 401 DEVICE_MISMATCH
 * (BE @ b3af6c090 luôn kiểm) → bỏ token portal cũ; GraphQL dùng staffJwt (cờ `pin`) gắn id máy mới.
 */
export async function activateWithCode(
  tenantId: string,
  activationCode: string,
  opts: { branch?: { id: string; name?: string } } = {}
): Promise<TerminalSession> {
  const raw = await rest<ActivateResponse | { data: ActivateResponse }>(`${POS_AUTH_BASE}/terminal/activate`, {
    method: 'POST',
    headers: tenantHeader(tenantId),
    body: { activationCode: activationCode.trim() },
  });
  const res = unwrap(raw);
  if (!res?.deviceId || !res.deviceToken) throw new PosApiError('VALIDATION', 'Kích hoạt máy thất bại');
  setDeviceId(res.deviceId);
  await persistDeviceId(res.deviceId);
  const prev = current && current.tenantId === tenantId ? current : null;
  // Chi nhánh của máy: BE quyết (terminal đăng ký theo chi nhánh); BE cũ chưa trả → như trước.
  const branchId = res.branchId || opts.branch?.id || prev?.branchId;
  const nameOf = (b?: { id?: string; name?: string } | null) => (b && b.id === branchId ? b.name : undefined);
  const session: TerminalSession = {
    // Token portal cũ gắn id máy cũ → không dùng được với id server (DEVICE_MISMATCH).
    accessToken: '',
    refreshToken: '',
    expiresAt: new Date(0).toISOString(),
    tenantId,
    email: prev?.email ?? '',
    branchId,
    branchName: nameOf(opts.branch) ?? nameOf(prev ? { id: prev.branchId, name: prev.branchName } : null),
    deviceSecret: res.deviceToken,
  };
  await terminalSession.save(session);
  return session;
}

let refreshing: Promise<TerminalSession> | null = null;

/** Làm mới access token (1 lần cho nhiều request đồng thời). Lỗi 401 → máy phải kích hoạt lại. */
export function refreshTerminal(): Promise<TerminalSession> {
  const s = current;
  if (!s) return Promise.reject(new PosApiError('UNAUTHENTICATED', 'Máy chưa được kích hoạt'));
  // Kích hoạt bằng mã (không có token portal) → không làm mới được; GraphQL dùng token PIN nhân viên.
  if (!s.refreshToken) return Promise.reject(new PosApiError('UNAUTHENTICATED', 'Phiên đăng nhập đã hết, vui lòng nhập PIN'));
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
  if (!s || !s.accessToken) return undefined;
  if (Date.parse(s.expiresAt) - Date.now() > 60_000) return s.accessToken;
  return (await refreshTerminal()).accessToken;
}
