// src/data/api/be/shifts.ts — ca thu ngân & báo cáo X/Z (passiontech-restaurant). Cờ: `shifts`.
// SDL đề xuất: docs/pos/pos-be-api-request.md Mục 3.11. Ca theo máy (X-Device-Id, header do gql() gắn).
// Đếm mù: CloseShift chỉ gửi countedCash; expected/variance do server trả trong báo cáo Z.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { money, opt, optMoney, toPaymentMethod, toStaffRef, type BeStaffRef } from '@/data/api/be/common';
import type { CashMovement, CashMovementType, Shift, ShiftReport, ShiftStatus } from '@/data/types';

// ── Kiểu BE (Mục 3.11) ──

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

export type BePosShiftReport = {
  kind: string;
  shift: BePosShift;
  generatedAt: string;
  sales: { bills: number; subtotal: number; discount: number; serviceCharge: number; tax: number; total: number; tips: number };
  payments: { method: string; count: number; amount: number }[];
  voids: { lines: number; amount: number };
  cash: { openingFloat: number; cashSales: number; cashIn: number; cashOut: number; expected: number };
  counted?: number | null;
  variance?: number | null;
};

const SHIFT_FIELDS = `
  id branchId terminalId number status openingFloat openedAt closedAt countedCash expectedCash variance closeNote
  openedBy { id name }
  closedBy { id name }
`;

// Field con của PosShiftSales/PaymentLine/Voids/Cash lấy theo chú thích trong SDL 3.11.
const REPORT_FIELDS = `
  kind generatedAt counted variance
  shift { ${SHIFT_FIELDS} }
  sales { bills subtotal discount serviceCharge tax total tips }
  payments { method count amount }
  voids { lines amount }
  cash { openingFloat cashSales cashIn cashOut expected }
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

// ⏳ chờ BE xác nhận tên/field: field của PosShiftPage (SDL chỉ nêu tên kiểu) — giả định { items total page pageSize }.
export const LIST_SHIFTS = /* GraphQL */ `
  query PosListShifts($branchId: ID!, $terminalId: String, $status: PosShiftStatus, $from: DateTime, $to: DateTime, $page: Int, $pageSize: Int) {
    restaurantServiceListShifts(branchId: $branchId, terminalId: $terminalId, status: $status, from: $from, to: $to, page: $page, pageSize: $pageSize) {
      items { ${SHIFT_FIELDS} }
      total page pageSize
    }
  }
`;

export const OPEN_SHIFT = /* GraphQL */ `
  mutation PosOpenShift($idempotencyKey: String!, $openingFloat: Int!) {
    restaurantServiceOpenShift(idempotencyKey: $idempotencyKey, openingFloat: $openingFloat) { ${SHIFT_FIELDS} }
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

export function toShiftReport(r: BePosShiftReport): ShiftReport {
  const kind = r.kind?.toUpperCase() === 'Z' ? 'Z' : 'X';
  return {
    kind,
    shift: toShift(r.shift),
    generatedAt: r.generatedAt,
    sales: {
      bills: r.sales.bills,
      subtotal: money(r.sales.subtotal),
      discount: money(r.sales.discount),
      serviceCharge: money(r.sales.serviceCharge),
      tax: money(r.sales.tax),
      total: money(r.sales.total),
      tips: money(r.sales.tips),
    },
    // Dòng phương thức lạ bị bỏ (không có chỗ hiển thị trong contract).
    payments: r.payments.flatMap((p) => {
      const method = toPaymentMethod(p.method);
      return method ? [{ method, count: p.count, amount: money(p.amount) }] : [];
    }),
    voids: { lines: r.voids.lines, amount: money(r.voids.amount) },
    cash: {
      openingFloat: money(r.cash.openingFloat),
      cashSales: money(r.cash.cashSales),
      cashIn: money(r.cash.cashIn),
      cashOut: money(r.cash.cashOut),
      expected: money(r.cash.expected),
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
    });
    return toShift(data.restaurantServiceOpenShift);
  },

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

  async listShifts(query) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const data = await gql<{
      restaurantServiceListShifts: { items: BePosShift[]; total: number; page?: number | null; pageSize?: number | null };
    }>(LIST_SHIFTS, {
      branchId: query.branchId,
      terminalId: query.terminalId,
      from: query.from,
      to: query.to,
      page,
      pageSize,
    });
    const r = data.restaurantServiceListShifts;
    return { items: r.items.map(toShift), page: r.page ?? page, pageSize: r.pageSize ?? pageSize, total: r.total };
  },
} satisfies Pick<
  PosApi,
  'getCurrentShift' | 'openShift' | 'addCashMovement' | 'getShiftReport' | 'closeShift' | 'listShifts'
>;
