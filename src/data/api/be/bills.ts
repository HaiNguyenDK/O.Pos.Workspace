// src/data/api/be/bills.ts — bill & tính tiền trên BE (passiontech-restaurant). Cờ: `bills`.
// SDL đề xuất: docs/pos/pos-be-api-request.md Mục 3.2 — server tính tiền (D7), FE chỉ hiển thị.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { currentBranchId, money, opt } from '@/data/api/be/common';
import { withConflictOrder } from '@/data/api/be/orders';
import { PAYMENT_FIELDS, toPayment, type BePayment } from '@/data/api/be/payments';
import { PosApiError, type Bill, type BillStatus, type Discount, type SplitPlan } from '@/data/types';

// ── Kiểu BE (Mục 3.2) ──

// ⏳ chờ BE xác nhận tên/field: PosDiscount và BillPart chưa định nghĩa trong SDL — dùng tên field contract.
type BeDiscount = {
  kind: 'VOUCHER' | 'MANUAL';
  code?: string | null;
  type: 'PERCENT' | 'AMOUNT';
  value: number;
  amount: number;
  reason?: string | null;
  approvedBy?: string | null;
};

type BeBillLine = {
  lineId: string;
  name: string;
  quantity: number;
  modifiers?: string[] | null;
  unitPrice: number;
  lineTotal: number;
  note?: string | null;
};

export type BePosBill = {
  id: string;
  code: string;
  orderId: string;
  tableName?: string | null;
  customerName?: string | null;
  part?: { index: number; of: number } | null;
  lines?: BeBillLine[] | null;
  subtotal: number;
  discounts?: BeDiscount[] | null;
  discountTotal: number;
  serviceCharge: number;
  taxRate: number;
  tax: number;
  tip: number;
  total: number;
  paidAmount: number;
  status: BillStatus;
  payments?: BePayment[] | null;
  createdAt: string;
  paidAt?: string | null;
};

export const BILL_FIELDS = `
  id code orderId tableName customerName
  part { index of }
  lines { lineId name quantity modifiers unitPrice lineTotal note }
  subtotal discountTotal serviceCharge taxRate tax tip total paidAmount status createdAt paidAt
  discounts { kind code type value amount reason approvedBy }
  payments { ${PAYMENT_FIELDS} }
`;

// ⏳ chờ BE xác nhận tên/field: tên kiểu input.
export const REQUEST_BILL = /* GraphQL */ `
  mutation PosRequestBill($input: RestaurantServiceRequestBillGqlInput!) {
    restaurantServiceRequestBill(input: $input) { ${BILL_FIELDS} }
  }
`;

export const SPLIT_BILL = /* GraphQL */ `
  mutation PosSplitBill($input: RestaurantServiceSplitBillGqlInput!) {
    restaurantServiceSplitBill(input: $input) { ${BILL_FIELDS} }
  }
`;

// ⏳ chờ BE xác nhận tên/field: SDL 3.2 chưa có query đọc bill — đặt theo restaurantServicePosOrder(id).
export const BILL_QUERY = /* GraphQL */ `
  query PosBill($id: ID!) {
    restaurantServicePosBill(id: $id) { ${BILL_FIELDS} }
  }
`;

// ⏳ chờ BE xác nhận tên/field: query lịch sử bill (chỉ PAID, mới nhất trước) — kiểu trang theo
// restaurantServiceListShifts(page, pageSize) → { items total page pageSize }. Không gửi pagination.sort (Mục 4b).
export const BILLS_QUERY = /* GraphQL */ `
  query PosBills($branchId: ID!, $status: BillStatus, $search: String, $page: Int, $pageSize: Int) {
    restaurantServicePosBills(branchId: $branchId, status: $status, search: $search, page: $page, pageSize: $pageSize) {
      items { ${BILL_FIELDS} }
      total page pageSize
    }
  }
`;

// ── Ánh xạ ──

export function toDiscount(d: BeDiscount): Discount {
  return {
    kind: d.kind,
    code: opt(d.code),
    type: d.type,
    value: d.value,
    amount: money(d.amount),
    reason: opt(d.reason),
    approvedBy: opt(d.approvedBy),
  };
}

export function toBill(b: BePosBill): Bill {
  return {
    id: b.id,
    code: b.code,
    orderId: b.orderId,
    tableName: opt(b.tableName),
    customerName: opt(b.customerName),
    part: b.part ? { index: b.part.index, of: b.part.of } : undefined,
    lines: (b.lines ?? []).map((l) => ({
      lineId: l.lineId,
      name: l.name,
      quantity: l.quantity,
      modifiers: l.modifiers ?? [],
      unitPrice: money(l.unitPrice),
      lineTotal: money(l.lineTotal),
      note: opt(l.note),
    })),
    subtotal: money(b.subtotal),
    discounts: (b.discounts ?? []).map(toDiscount),
    discountTotal: money(b.discountTotal),
    serviceCharge: money(b.serviceCharge),
    taxRate: b.taxRate,
    tax: money(b.tax),
    tip: money(b.tip),
    total: money(b.total),
    paidAmount: money(b.paidAmount),
    status: b.status,
    payments: (b.payments ?? []).map((p) => toPayment(p, { billId: b.id })),
    createdAt: b.createdAt,
    paidAt: opt(b.paidAt),
  };
}

/** SplitPlan contract (assignments là map lineId → part) → input BE (mảng { lineId, part }). */
export function toSplitPlanInput(plan: SplitPlan) {
  if (plan.mode === 'EVEN') return { mode: 'EVEN', parts: plan.parts };
  return {
    mode: 'BY_LINE',
    parts: plan.parts,
    assignments: Object.entries(plan.assignments).map(([lineId, part]) => ({ lineId, part })),
  };
}

// ── PosApi ──

export const beBillsApi = {
  async requestBill(input) {
    const data = await withConflictOrder(
      gql<{ restaurantServiceRequestBill: BePosBill }>(REQUEST_BILL, {
        input: {
          idempotencyKey: input.idempotencyKey,
          orderId: input.orderId,
          expectedVersion: input.expectedVersion,
          voucherCode: input.voucherCode,
          customerId: input.customerId,
          manualDiscount: input.manualDiscount
            ? {
                type: input.manualDiscount.type,
                value: input.manualDiscount.value,
                reason: input.manualDiscount.reason,
                approvalToken: input.manualDiscount.approvalToken,
              }
            : undefined,
          serviceCharge: input.serviceCharge,
          tip: input.tip,
        },
      })
    );
    return toBill(data.restaurantServiceRequestBill);
  },

  async splitBill(input) {
    const data = await withConflictOrder(
      gql<{ restaurantServiceSplitBill: BePosBill[] }>(SPLIT_BILL, {
        input: {
          idempotencyKey: input.idempotencyKey,
          orderId: input.orderId,
          expectedVersion: input.expectedVersion,
          plan: toSplitPlanInput(input.plan),
        },
      })
    );
    return data.restaurantServiceSplitBill.map(toBill);
  },

  async getBill(billId) {
    const data = await gql<{ restaurantServicePosBill: BePosBill | null }>(BILL_QUERY, { id: billId });
    if (!data.restaurantServicePosBill) throw new PosApiError('NOT_FOUND', 'Không tìm thấy hoá đơn');
    return toBill(data.restaurantServicePosBill);
  },

  async listBills(query) {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const data = await gql<{
      restaurantServicePosBills: { items: BePosBill[]; total: number; page?: number | null; pageSize?: number | null };
    }>(BILLS_QUERY, {
      branchId: currentBranchId(),
      status: 'PAID',
      search: query?.search?.trim() || undefined,
      page,
      pageSize,
    });
    const r = data.restaurantServicePosBills;
    return { items: r.items.map(toBill), page: r.page ?? page, pageSize: r.pageSize ?? pageSize, total: r.total };
  },
} satisfies Pick<PosApi, 'requestBill' | 'splitBill' | 'getBill' | 'listBills'>;
