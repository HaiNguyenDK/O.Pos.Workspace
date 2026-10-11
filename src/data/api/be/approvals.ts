// src/data/api/be/approvals.ts — quản lý duyệt bằng PIN (passiontech-auth). Cờ: `approvals`.
// Đề xuất: docs/pos/pos-be-api-request.md Mục 3.3 — POST /auth/pos/approve { deviceId, pin, action }
// → { approvalToken, approver{ id, name }, expiresAt }. Token dùng 1 lần, ~60s, chỉ MANAGER/OWNER.
import type { PosApi } from '@/data/api/PosApi';
import { rest, unwrap } from '@/data/api/rest-client';
import { apiSession, getDeviceId } from '@/data/api/session';
import type { Approval } from '@/data/types';

export const APPROVE_PATH = '/auth/pos/approve';

export type BeApproval = { approvalToken: string; approver: { id: string; name?: string | null }; expiresAt: string };

export const toApproval = (a: BeApproval): Approval => ({
  approvalToken: a.approvalToken,
  approver: { id: a.approver.id, name: a.approver.name ?? '' },
  expiresAt: a.expiresAt,
});

export const beApprovalsApi = {
  async requestApproval({ pin, action }) {
    const raw = await rest<BeApproval | { data: BeApproval }>(APPROVE_PATH, {
      method: 'POST',
      // ⏳ chờ BE xác nhận tên/field: gửi kèm token của nhân viên đang thao tác (người xin duyệt) để BE ghi audit.
      token: apiSession.get()?.accessToken,
      body: { deviceId: getDeviceId(), pin, action },
    });
    return toApproval(unwrap(raw));
  },
} satisfies Pick<PosApi, 'requestApproval'>;
