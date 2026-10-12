// src/data/api/be/common.ts — tiện ích chung cho adapter BE (be/*.ts).
// Quy ước: mapper BE → contract là hàm thuần; tiền BE là Int nhưng vẫn Math.round phòng hờ (D4).
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

/** Tenant của máy (header X-Tenant-Id cho auth POS): phiên kích hoạt máy → env dự phòng. */
export function currentTenantId(): string {
  const id = terminalSession.get()?.tenantId || apiConfig.tenantId;
  if (!id) throw new PosApiError('VALIDATION', 'Máy chưa gắn tenant');
  return id;
}

/** BE: PosServiceStaffRef { id name } (restaurant) — ⚠️ BE-39 (chưa sửa): name vẫn có thể là email/id. */
export type BeStaffRef = { id: string; name?: string | null };
export const toStaffRef = (s: BeStaffRef): StaffRef => ({ id: s.id, name: s.name ?? '' });

/**
 * Phương thức thanh toán BE → contract. Nhận cả:
 * - PaymentMethodType của payment GraphQL (CASH | QR | BANK_TRANSFER | CARD | WALLET | COD),
 * - vendor (CASH | PAYOS | SEPAY | NAPAS | …, kể cả dạng proto `PAYMENT_VENDOR_CODE_*` trong bill.payments),
 * - nhãn báo cáo ca của restaurant (CASH | PAYOS_QR | SEPAY_QR | VIETQR | OTHER — shift_usecase.paymentMethodLabel).
 * Không nhận ra (vd OTHER) → undefined.
 */
export function toPaymentMethod(v: string | null | undefined): PaymentMethod | undefined {
  const s = (v ?? '').trim().toUpperCase().replace(/^PAYMENT_VENDOR_CODE_/, '');
  switch (s) {
    case 'CASH':
      return 'CASH';
    case 'VIETQR':
    case 'QR':
    case 'BANK_TRANSFER':
    case 'BANK_DIRECT':
    case 'PAYOS':
    case 'SEPAY':
    case 'NAPAS':
    case 'PAYOS_QR':
    case 'SEPAY_QR':
      return 'VIETQR';
    case 'CARD':
    case 'CARD_ACQUIRER':
      return 'CARD';
    case 'EWALLET':
    case 'WALLET':
    case 'MOMO':
    case 'ZALOPAY':
    case 'VNPAY':
      return 'EWALLET';
    default:
      return undefined;
  }
}
