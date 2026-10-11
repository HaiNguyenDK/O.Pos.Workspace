// src/data/api/be/pin.ts — PIN nhân viên trên máy dùng chung (passiontech-auth). Cờ: `pin`.
// BE @ bb3e223c6: POST /api/v1/pos/auth/pin-login, header X-Tenant-Id, body { deviceId, deviceToken, branchId, pin }
// → { code: 0, message, data: { staffJwt, staffCtx: { StaffID, Name, Role, BranchID } } } (staffCtx không có json tag → PascalCase).
// Không có refresh token: hết hạn (exp trong JWT) → app đưa về màn PIN.
// ⚠️ Route /api/v1/pos/auth/* đang bị edge ogw chặn 401 (be-review Mục 5) — chưa đăng nhập PIN được trên môi trường thật.
import type { LoginResult, PosApi } from '@/data/api/PosApi';
import { POS_AUTH_BASE, rest, tenantHeader, unwrap } from '@/data/api/rest-client';
import { getDeviceId } from '@/data/api/session';
import { terminalSession } from '@/data/api/terminal';
import { currentBranchId, currentTenantId } from '@/data/api/be/common';
import { decodeJwt, jwtExpiresAt } from '@/data/api/be/jwt';
import { PosApiError, type Staff, type StaffRole } from '@/data/types';

export const PIN_LOGIN_PATH = `${POS_AUTH_BASE}/pin-login`;

/** Hạn dự phòng khi JWT không có exp (BE mặc định theo cấu hình access token, review ghi 1h). */
const FALLBACK_TTL_SEC = 3600;

export type BePosStaffCtx = { StaffID: string; Name: string; Role: string; BranchID: string };
export type BePinLoginResponse = { staffJwt: string; staffCtx: BePosStaffCtx };

const ROLES: StaffRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'];

/** Vai trò POS theo branch. Vai trò lạ → WAITER (ít quyền thao tác tiền nhất trên máy order). */
export function toStaffRole(role: string | null | undefined): StaffRole {
  const r = (role ?? '').trim().toUpperCase() as StaffRole;
  return ROLES.includes(r) ? r : 'WAITER';
}

export const toStaff = (s: BePosStaffCtx): Staff => ({
  id: s.StaffID,
  name: s.Name,
  role: toStaffRole(s.Role),
  branchId: s.BranchID,
});

export function toLoginResult(r: BePinLoginResponse, nowMs = Date.now()): LoginResult {
  return {
    accessToken: r.staffJwt,
    refreshToken: '', // BE không cấp refresh token cho POS
    expiresAt: jwtExpiresAt(decodeJwt(r.staffJwt), FALLBACK_TTL_SEC, nowMs),
    staff: toStaff(r.staffCtx),
  };
}

export const bePinApi = {
  async loginPin(pin) {
    const deviceToken = terminalSession.get()?.deviceSecret;
    // Chưa có deviceToken (máy chưa kích hoạt bằng mã — terminal.activateWithCode) → BE sẽ trả 40101.
    if (!deviceToken) throw new PosApiError('FORBIDDEN', 'Máy chưa được đăng ký để đăng nhập bằng PIN');
    const raw = await rest<BePinLoginResponse | { data: BePinLoginResponse }>(PIN_LOGIN_PATH, {
      method: 'POST',
      headers: tenantHeader(currentTenantId()),
      body: { deviceId: getDeviceId(), deviceToken, branchId: currentBranchId(), pin },
    });
    return toLoginResult(unwrap(raw));
  },
} satisfies Pick<PosApi, 'loginPin'>;
