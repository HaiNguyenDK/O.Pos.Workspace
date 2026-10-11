// src/data/api/be/pin.ts — PIN nhân viên trên máy dùng chung (passiontech-auth). Cờ: `pin`.
// Đề xuất: docs/pos/pos-be-api-request.md Mục 3.3 — POST /auth/pos/pin/login { deviceId, deviceSecret, pin }
// → { accessToken, refreshToken, expiresIn, staff{ id, name, role, branchId } }. Token mang tenant/branch/role.
import type { LoginResult, PosApi } from '@/data/api/PosApi';
import { rest, unwrap } from '@/data/api/rest-client';
import { getDeviceId } from '@/data/api/session';
import { terminalSession } from '@/data/api/terminal';
import { PosApiError, type Staff, type StaffRole } from '@/data/types';

export const PIN_LOGIN_PATH = '/auth/pos/pin/login';

export type BePosStaff = { id: string; name: string; role: string; branchId: string };
export type BePinLoginResponse = { accessToken: string; refreshToken: string; expiresIn: number; staff: BePosStaff };

const ROLES: StaffRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'];

/** Vai trò POS theo branch (3.3). Vai trò lạ → WAITER (ít quyền thao tác tiền nhất trên máy order). */
export function toStaffRole(role: string | null | undefined): StaffRole {
  const r = (role ?? '').trim().toUpperCase() as StaffRole;
  return ROLES.includes(r) ? r : 'WAITER';
}

export const toStaff = (s: BePosStaff): Staff => ({ id: s.id, name: s.name, role: toStaffRole(s.role), branchId: s.branchId });

export function toLoginResult(r: BePinLoginResponse, nowMs = Date.now()): LoginResult {
  return {
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiresAt: new Date(nowMs + r.expiresIn * 1000).toISOString(),
    staff: toStaff(r.staff),
  };
}

export const bePinApi = {
  async loginPin(pin) {
    const deviceSecret = terminalSession.get()?.deviceSecret;
    // 40301 "máy chưa đăng ký": chưa có deviceSecret từ POST /auth/pos/terminal/register.
    if (!deviceSecret) throw new PosApiError('FORBIDDEN', 'Máy chưa được đăng ký để đăng nhập bằng PIN');
    const raw = await rest<BePinLoginResponse | { data: BePinLoginResponse }>(PIN_LOGIN_PATH, {
      method: 'POST',
      body: { deviceId: getDeviceId(), deviceSecret, pin },
    });
    return toLoginResult(unwrap(raw));
  },
} satisfies Pick<PosApi, 'loginPin'>;
