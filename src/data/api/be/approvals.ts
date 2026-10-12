// src/data/api/be/approvals.ts — quản lý duyệt bằng PIN (passiontech-auth). Cờ: `approvals`.
// BE @ 4f4594354 (PR #800): POST /api/v1/pos/auth/approve — bắt buộc Bearer JWT POS (staffJwt của pin-login)
// + header X-Device-Id khớp máy; body { branchId (= chi nhánh của token), pin, action, reason? } (deviceId trong body bị bỏ qua)
// → { code: 0, message, data: { approvalToken } }. Token dùng 1 lần, 5 phút, gắn action + tenant + branch, chỉ MANAGER/OWNER.
// → Cờ `approvals` cần bật cùng `pin` (không có staffJwt thì BE trả 401).
// BE không trả approver/expiresAt → đọc từ JWT (sub = staffId người duyệt, exp); tên người duyệt chưa có → ''.
// Lỗi: 40101 sai PIN → UNAUTHENTICATED; 42301 khoá → FORBIDDEN; 40301 không phải quản lý → FORBIDDEN (errors.ts).
import type { PosApi } from '@/data/api/PosApi';
import { POS_AUTH_BASE, rest, tenantHeader, unwrap } from '@/data/api/rest-client';
import { apiSession } from '@/data/api/session';
import { currentBranchId, currentTenantId } from '@/data/api/be/common';
import { decodeJwt, jwtExpiresAt } from '@/data/api/be/jwt';
import { PosApiError, type Approval } from '@/data/types';

export const APPROVE_PATH = `${POS_AUTH_BASE}/approve`;

/** Hạn approval token của BE (jwt_usecase GeneratePosApprovalToken) — dự phòng khi thiếu exp. */
const APPROVAL_TTL_SEC = 300;

export type BeApproval = { approvalToken: string };

export function toApproval(a: BeApproval, nowMs = Date.now()): Approval {
  const claims = decodeJwt(a.approvalToken);
  return {
    approvalToken: a.approvalToken,
    approver: { id: typeof claims.sub === 'string' ? claims.sub : '', name: '' },
    expiresAt: jwtExpiresAt(claims, APPROVAL_TTL_SEC, nowMs),
  };
}

export const beApprovalsApi = {
  async requestApproval({ pin, action }) {
    const token = apiSession.get()?.accessToken;
    if (!token) throw new PosApiError('UNAUTHENTICATED', 'Cần đăng nhập PIN trước khi xin duyệt');
    const raw = await rest<BeApproval | { data: BeApproval }>(APPROVE_PATH, {
      method: 'POST',
      token,
      headers: tenantHeader(currentTenantId()),
      body: { branchId: currentBranchId(), pin, action },
    });
    return toApproval(unwrap(raw));
  },
} satisfies Pick<PosApi, 'requestApproval'>;
