// src/data/api/be/shifts.ts — ca thu ngân & báo cáo X/Z (passiontech-restaurant). Cờ: `shifts`.
// Schema thật: apps/passiontech-restaurant/internal/handler/graphql/shift.graphqls @ bb3e223c6.
// Ca theo máy (X-Device-Id do gql() gắn). Đếm mù: CloseShift chỉ gửi countedCash; expected/variance do server trả.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { currentBranchId, money, opt, optMoney, toPaymentMethod, toStaffRef, type BeStaffRef } from '@/data/api/be/common';
import type { CashMovement, CashMovementType, PaymentMethod, Shift, ShiftReport, ShiftStatus } from '@/data/types';

// ── Kiểu BE ──

export type BePosShift = {
  id: string;
  branchId: string;
  terminalId: string;
  number: number;
  status: ShiftStatus;
  openedBy: BeStaffRef;
  openedAt: string;
  openingFloat: number;
  closedBy?: BeStaffRef | null;
  closedAt?: string | null;
  countedCash?: number | null;
  /** null khi ca OPEN và người gọi không phải MANAGER/OWNER (đếm mù). */
  expectedCash?: number | null;
  variance?: number | null;
  closeNote?: string | null;
};

export type BePosCashMovement = {
  id: string;
  shiftId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  by: BeStaffRef;
  createdAt: string;
};

/** PosServiceShiftReport — PHẲNG (contract lồng sales/voids/cash). */
export type BePosShiftReport = {
  kind: string;
  shift: BePosShift;
  generatedAt: string;
  bills: number;
  subtotal: number;
  discountTotal: number;
  serviceCharge: number;
  tax: number;
  tips: number;
  total: number;
  /** method: CASH | PAYOS_QR | SEPAY_QR | VIETQR | OTHER (shift_usecase.paymentMethodLabel) */
  payments: { method: string; count: number; amount: number }[];
  voidLines: number;
  voidAmount: number;
  openingFloat: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  /** 0 khi bị ẩn (ca OPEN, người gọi không phải MANAGER/OWNER). */
  expectedCash: number;
  counted?: number | null;
  variance?: number | null;
};

const SHIFT_FIELDS = `
  id branchId terminalId number status openingFloat openedAt closedAt countedCash expectedCash variance closeNote
  openedBy { id name }
  closedBy { id name }
`;

const REPORT_FIELDS = `
  kind generatedAt
  shift { ${SHIFT_FIELDS} }
  bills subtotal discountTotal serviceCharge tax tips total
  payments { method count amount }
  voidLines voidAmount
  openingFloat cashSales cashIn cashOut expectedCash counted variance
`;

export const CURRENT_SHIFT = /* GraphQL */ `
  query PosCurrentShift {
    restaurantServiceCurrentShift { ${SHIFT_FIELDS} }
  }
`;

export const SHIFT_REPORT = /* GraphQL */ `
  query PosShiftReport($shiftId: ID!) {
    restaurantServiceShiftReport(shiftId: $shiftId) { ${REPORT_FIELDS} }
  }
`;

/** BE trả mảng, không phân trang → FE tự chia trang. */
export const LIST_SHIFTS = /* GraphQL */ `
  query PosListShifts($branchId: String!, $terminalId: String, $status: PosShiftStatus, $from: Time, $to: Time) {
    restaurantServiceListShifts(branchId: $branchId, terminalId: $terminalId, status: $status, from: $from, to: $to) { ${SHIFT_FIELDS} }
  }
`;

export const OPEN_SHIFT = /* GraphQL */ `
  mutation PosOpenShift($idempotencyKey: String!, $openingFloat: Int!, $branchId: String!) {
    restaurantServiceOpenShift(idempotencyKey: $idempotencyKey, openingFloat: $openingFloat, branchId: $branchId) { ${SHIFT_FIELDS} }
  }
`;

export const ADD_CASH_MOVEMENT = /* GraphQL */ `
  mutation PosAddCashMovement($idempotencyKey: String!, $shiftId: ID!, $type: PosCashMovementType!, $amount: Int!, $reason: String!, $approvalToken: String) {
    restaurantServiceAddCashMovement(idempotencyKey: $idempotencyKey, shiftId: $shiftId, type: $type, amount: $amount, reason: $reason, approvalToken: $approvalToken) {
      id shiftId type amount reason createdAt
      by { id name }
    }
  }
`;

export const CLOSE_SHIFT = /* GraphQL */ `
  mutation PosCloseShift($idempotencyKey: String!, $shiftId: ID!, $countedCash: Int!, $note: String) {
    restaurantServiceCloseShift(idempotencyKey: $idempotencyKey, shiftId: $shiftId, countedCash: $countedCash, note: $note) { ${REPORT_FIELDS} }
  }
`;

// ── Ánh xạ ──

export function toShift(s: BePosShift): Shift {
  return {
    id: s.id,
    branchId: s.branchId,
    terminalId: s.terminalId,
    number: s.number,
    status: s.status,
    openedBy: toStaffRef(s.openedBy),
    openedAt: s.openedAt,
    openingFloat: money(s.openingFloat),
    closedBy: s.closedBy ? toStaffRef(s.closedBy) : undefined,
    closedAt: opt(s.closedAt),
    countedCash: optMoney(s.countedCash),
    expectedCash: optMoney(s.expectedCash),
    variance: optMoney(s.variance),
    closeNote: opt(s.closeNote),
  };
}

export function toCashMovement(m: BePosCashMovement): CashMovement {
  return {
    id: m.id,
    shiftId: m.shiftId,
    type: m.type,
    amount: money(m.amount),
    reason: m.reason,
    by: toStaffRef(m.by),
    createdAt: m.createdAt,
  };
}

/** Gộp dòng theo phương thức contract (PAYOS_QR + SEPAY_QR + VIETQR → VIETQR). Nhãn lạ (OTHER) bị bỏ. */
function toReportPayments(rows: BePosShiftReport['payments']): ShiftReport['payments'] {
  const out = new Map<PaymentMethod, { method: PaymentMethod; count: number; amount: number }>();
  for (const p of rows) {
    const method = toPaymentMethod(p.method);
    if (!method) continue;
    const cur = out.get(method) ?? { method, count: 0, amount: 0 };
    cur.count += p.count;
    cur.amount += money(p.amount);
    out.set(method, cur);
  }
  return [...out.values()];
}

/**
 * Báo cáo phẳng của BE → ShiftReport lồng của contract.
 * Báo cáo X với người không phải MANAGER/OWNER: BE trả expectedCash = 0 và shift.expectedCash = null (đếm mù) →
 * cash.expected = 0 nghĩa là "bị ẩn", không phải "két rỗng"; UI đã ẩn khối tiền mặt theo vai trò (ShiftReportCard showCash).
 */
export function toShiftReport(r: BePosShiftReport): ShiftReport {
  const kind = r.kind?.toUpperCase() === 'Z' ? 'Z' : 'X';
  return {
    kind,
    shift: toShift(r.shift),
    generatedAt: r.generatedAt,
    sales: {
      bills: r.bills,
      subtotal: money(r.subtotal),
      discount: money(r.discountTotal),
      serviceCharge: money(r.serviceCharge),
      tax: money(r.tax),
      total: money(r.total),
      tips: money(r.tips),
    },
    // ⚠️ BE bug #10 (be-review-2026-10-11): doanh thu tính theo ca của máy mở đơn, payment theo ca thu tiền → có thể lệch.
    payments: toReportPayments(r.payments),
    voids: { lines: r.voidLines, amount: money(r.voidAmount) },
    cash: {
      openingFloat: money(r.openingFloat),
      cashSales: money(r.cashSales),
      cashIn: money(r.cashIn),
      cashOut: money(r.cashOut),
      expected: money(r.expectedCash),
    },
    counted: kind === 'Z' ? optMoney(r.counted) : undefined,
    variance: kind === 'Z' ? optMoney(r.variance) : undefined,
  };
}

// ── PosApi ──

export const beShiftsApi = {
  async getCurrentShift() {
    const data = await gql<{ restaurantServiceCurrentShift: BePosShift | null }>(CURRENT_SHIFT);
    return data.restaurantServiceCurrentShift ? toShift(data.restaurantServiceCurrentShift) : null;
  },

  async openShift(input) {
    const data = await gql<{ restaurantServiceOpenShift: BePosShift }>(OPEN_SHIFT, {
      idempotencyKey: input.idempotencyKey,
      openingFloat: input.openingFloat,
      branchId: currentBranchId(),
    });
    return toShift(data.restaurantServiceOpenShift);
  },

  // ⚠️ BE bug #9: gửi lại (retry cùng idempotencyKey) → panic nil ở BE (lỗi 5xx → hàng đợi offline thử lại tiếp).
  async addCashMovement(input) {
    const data = await gql<{ restaurantServiceAddCashMovement: BePosCashMovement }>(ADD_CASH_MOVEMENT, {
      idempotencyKey: input.idempotencyKey,
      shiftId: input.shiftId,
      type: input.type,
      amount: input.amount,
      reason: input.reason,
      approvalToken: input.approvalToken,
    });
    return toCashMovement(data.restaurantServiceAddCashMovement);
  },

  async getShiftReport({ shiftId }) {
    const data = await gql<{ restaurantServiceShiftReport: BePosShiftReport }>(SHIFT_REPORT, { shiftId });
    return toShiftReport(data.restaurantServiceShiftReport);
  },

  async closeShift(input) {
    const data = await gql<{ restaurantServiceCloseShift: BePosShiftReport }>(CLOSE_SHIFT, {
      idempotencyKey: input.idempotencyKey,
      shiftId: input.shiftId,
      countedCash: input.countedCash,
      note: input.note,
    });
    return toShiftReport(data.restaurantServiceCloseShift);
  },

  /** BE trả mảng → sắp openedAt mới nhất trước rồi cắt trang ở FE. */
  async listShifts(query) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const data = await gql<{ restaurantServiceListShifts: BePosShift[] }>(LIST_SHIFTS, {
      branchId: query.branchId,
      terminalId: query.terminalId,
      from: query.from,
      to: query.to,
    });
    const all = [...data.restaurantServiceListShifts].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    return { items: all.slice((page - 1) * pageSize, page * pageSize).map(toShift), page, pageSize, total: all.length };
  },
} satisfies Pick<
  PosApi,
  'getCurrentShift' | 'openShift' | 'addCashMovement' | 'getShiftReport' | 'closeShift' | 'listShifts'
>;
