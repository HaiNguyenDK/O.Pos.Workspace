// src/data/api/be/common.ts — tiện ích chung cho adapter BE (be/*.ts).
// Quy ước: mapper BE → contract là hàm thuần; tiền BE đề xuất là Int nhưng vẫn Math.round phòng hờ (D4).
import { apiConfig } from '@/data/api/config';
import { apiSession } from '@/data/api/session';
import { terminalSession } from '@/data/api/terminal';
import { PosApiError, type PaymentMethod, type StaffRef } from '@/data/types';

/** null → undefined (contract dùng field tuỳ chọn, BE trả null). */
export const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

/** Tiền về số nguyên đồng. */
export const money = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export const optMoney = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : money(v));

/** Chi nhánh máy đang phục vụ: phiên kích hoạt máy → env dự phòng → chi nhánh của nhân viên. */
export function currentBranchId(): string {
  const id = terminalSession.get()?.branchId || apiConfig.branchId || apiSession.get()?.staff.branchId;
  if (!id) throw new PosApiError('VALIDATION', 'Máy chưa chọn chi nhánh');
  return id;
}

export type BeStaffRef = { id: string; name?: string | null };
export const toStaffRef = (s: BeStaffRef): StaffRef => ({ id: s.id, name: s.name ?? '' });

/**
 * Phương thức thanh toán BE → contract. BE hiện có PaymentMethodType BANK_TRANSFER|CARD|COD|QR|WALLET;
 * đề xuất 3.4 thêm CASH. Trả undefined nếu không nhận ra.
 */
export function toPaymentMethod(v: string | null | undefined): PaymentMethod | undefined {
  switch ((v ?? '').toUpperCase()) {
    case 'CASH':
      return 'CASH';
    case 'VIETQR':
    case 'QR':
    case 'BANK_TRANSFER':
      return 'VIETQR';
    case 'CARD':
      return 'CARD';
    case 'EWALLET':
    case 'WALLET':
      return 'EWALLET';
    default:
      return undefined;
  }
}
