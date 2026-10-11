// src/data/api/be/approvals.ts — quản lý duyệt bằng PIN (passiontech-auth). Cờ: `approvals`.
// BE @ bb3e223c6: POST /api/v1/pos/auth/approve, header X-Tenant-Id, body { branchId, pin, action, reason?, deviceId }
// → { code: 0, message, data: { approvalToken } }. Token dùng 1 lần, 5 phút, chỉ MANAGER/OWNER.
// BE không trả approver/expiresAt → đọc từ JWT (sub = staffId người duyệt, exp); tên người duyệt chưa có → ''.
// Lỗi: 40101 sai PIN → UNAUTHENTICATED; 42301 khoá → FORBIDDEN; 40301 không phải quản lý → FORBIDDEN (errors.ts).
// ⚠️ Bảo mật #1 (be-review-2026-10-11): /approve không xác thực, không giới hạn tần suất; bỏ deviceId thì không bị khoá
//   → FE luôn gửi deviceId. ⚠️ Bảo mật #3/#4: token mang role MANAGER, không gắn hành động/đối tượng.
import type { PosApi } from '@/data/api/PosApi';
import { POS_AUTH_BASE, rest, tenantHeader, unwrap } from '@/data/api/rest-client';
import { getDeviceId } from '@/data/api/session';
import { currentBranchId, currentTenantId } from '@/data/api/be/common';
import { decodeJwt, jwtExpiresAt } from '@/data/api/be/jwt';
import type { Approval } from '@/data/types';

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
    const raw = await rest<BeApproval | { data: BeApproval }>(APPROVE_PATH, {
      method: 'POST',
      headers: tenantHeader(currentTenantId()),
      body: { branchId: currentBranchId(), pin, action, deviceId: getDeviceId() },
    });
    return toApproval(unwrap(raw));
  },
} satisfies Pick<PosApi, 'requestApproval'>;
