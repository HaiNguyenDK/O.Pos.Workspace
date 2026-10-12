// src/data/api/be/bills.ts — bill & tính tiền trên BE (passiontech-restaurant). Cờ: `bills`.
// Schema thật: apps/passiontech-restaurant/internal/handler/graphql/pos_bill.graphqls @ 4f4594354 (PR #800) — server tính tiền (D7).
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { currentBranchId, money, opt, toPaymentMethod, type BeStaffRef } from '@/data/api/be/common';
import { withConflictOrder } from '@/data/api/be/orders';
import { toPaymentStatus } from '@/data/api/be/payments';
import { PosApiError, type Bill, type BillStatus, type Discount, type Payment, type SplitPlan } from '@/data/types';

// ── Kiểu BE ──

type BeDiscount = {
  type: 'PERCENT' | 'AMOUNT' | 'VOUCHER';
  value: number;
  amount: number;
  reason?: string | null;
  voucherCode?: string | null;
  approvedBy?: BeStaffRef | null;
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

/** PosServicePayment — status/vendor là tên proto thô (PAYMENT_STATUS_*, PAYMENT_VENDOR_CODE_*). */
type BeBillPayment = { paymentId: string; status: string; amount: number; vendor: string };

export type BePosBill = {
  id: string;
  code: string;
  orderId: string;
  /** 0 = bill chưa chia; 1..n = phần thứ n (1-based) của bill đã chia. */
  part: number;
  tableName?: string | null;
  customerName?: string | null;
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
  payments?: BeBillPayment[] | null;
  createdAt: string;
  paidAt?: string | null;
};

export const BILL_FIELDS = `
  id code orderId part tableName customerName
  lines { lineId name quantity modifiers unitPrice lineTotal note }
  subtotal discountTotal serviceCharge taxRate tax tip total paidAmount status createdAt paidAt
  discounts { type value amount reason voucherCode approvedBy { id name } }
  payments { paymentId status amount vendor }
`;

export const REQUEST_BILL = /* GraphQL */ `
  mutation PosRequestBill($input: RestaurantServiceRequestBillInput!) {
    restaurantServiceRequestBill(input: $input) { ${BILL_FIELDS} }
  }
`;

export const SPLIT_BILL = /* GraphQL */ `
  mutation PosSplitBill($input: RestaurantServiceSplitBillInput!) {
    restaurantServiceSplitBill(input: $input) { ${BILL_FIELDS} }
  }
`;

export const BILL_QUERY = /* GraphQL */ `
  query PosBill($id: ID!) {
    restaurantServicePosBill(id: $id) { ${BILL_FIELDS} }
  }
`;

/** Bill cùng đơn — để suy ra `part.of` (BE chỉ trả số thứ tự phần). Chỉ cần id/part/status. */
export const BILLS_BY_ORDER_QUERY = /* GraphQL */ `
  query PosBillsByOrder($orderId: ID!) {
    restaurantServiceBillsByOrder(orderId: $orderId) { id part status }
  }
`;

/** Lịch sử bill: BE trả mảng (mới tạo trước), không phân trang/tìm kiếm → FE tự lọc + chia trang. */
export const BILLS_QUERY = /* GraphQL */ `
  query PosBills($branchId: String!, $status: BillStatus, $from: Time, $to: Time) {
    restaurantServiceBills(branchId: $branchId, status: $status, from: $from, to: $to) { ${BILL_FIELDS} }
  }
`;

// ── Ánh xạ ──

/**
 * Discount BE → contract. type VOUCHER (value = số tiền giảm của voucher) → kind VOUCHER, type AMOUNT.
 * `amount` = số tiền giảm thật của dòng (BE-38). Σamount có thể lớn hơn discountTotal (BE không chặn trần) →
 * tổng tiền dùng discountTotal, không cộng lại từ các dòng (D7).
 */
export function toDiscount(d: BeDiscount): Discount {
  const voucher = d.type === 'VOUCHER' || !!d.voucherCode;
  return {
    kind: voucher ? 'VOUCHER' : 'MANUAL',
    code: opt(d.voucherCode),
    type: d.type === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
    value: d.value,
    amount: money(d.amount),
    reason: opt(d.reason),
    approvedBy: d.approvedBy?.id || undefined,
  };
}

/** PosServicePayment (tóm tắt trong bill) → Payment contract; thiếu field thì lấy từ bill. */
export function toBillPayment(p: BeBillPayment, b: Pick<BePosBill, 'id' | 'createdAt' | 'paidAt'>): Payment {
  const method = toPaymentMethod(p.vendor) ?? 'VIETQR';
  const status = toPaymentStatus(p.status);
  return {
    id: p.paymentId,
    billId: b.id,
    clientRef: '',
    method,
    amount: money(p.amount),
    status,
    confirmedBy: method === 'CASH' ? 'STAFF' : undefined,
    createdAt: b.createdAt,
    succeededAt: status === 'SUCCEEDED' ? opt(b.paidAt) : undefined,
  };
}

/** `of` = số phần đang hiệu lực của đơn; Bill.part BE 1-based → contract index 0-based. */
export function toBill(b: BePosBill, partsOf?: number): Bill {
  return {
    id: b.id,
    code: b.code,
    orderId: b.orderId,
    tableName: opt(b.tableName),
    customerName: opt(b.customerName),
    part: b.part > 0 ? { index: b.part - 1, of: Math.max(partsOf ?? b.part, b.part) } : undefined,
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
    // Bill không làm tròn; làm tròn tiền mặt nằm ở Payment.roundingAdjustment (BE câu hỏi 2, PR #800).
    total: money(b.total),
    paidAmount: money(b.paidAmount),
    status: b.status,
    payments: (b.payments ?? []).map((p) => toBillPayment(p, b)),
    createdAt: b.createdAt,
    paidAt: opt(b.paidAt),
  };
}

/** Số phần của lần chia hiện hành: bill part>0 chưa VOID (bill VOID là lần chia cũ). */
export function countParts(siblings: { part: number; status: string }[]): number {
  return siblings.filter((s) => s.part > 0 && s.status !== 'VOID').length;
}

async function partsOfOrder(orderId: string): Promise<number> {
  const data = await gql<{ restaurantServiceBillsByOrder: { id: string; part: number; status: string }[] }>(
    BILLS_BY_ORDER_QUERY,
    { orderId }
  );
  return countParts(data.restaurantServiceBillsByOrder);
}

/** Bill đã chia → đọc bill cùng đơn để có `part.of`; bill chưa chia → không gọi thêm. */
async function toBillWithParts(b: BePosBill): Promise<Bill> {
  return toBill(b, b.part > 0 ? await partsOfOrder(b.orderId) : undefined);
}

/** SplitPlan contract → input phẳng của BE. Contract partIndex 0-based → BE part 1-based. */
export function toSplitInput(plan: SplitPlan) {
  if (plan.mode === 'EVEN') return { mode: 'EVEN' as const, parts: plan.parts };
  return {
    mode: 'BY_LINE' as const,
    parts: plan.parts,
    assignments: Object.entries(plan.assignments).map(([lineId, part]) => ({ lineId, part: part + 1 })),
  };
}

const matches = (b: BePosBill, q: string) =>
  [b.code, b.tableName, b.customerName].some((s) => (s ?? '').toLowerCase().includes(q));

// ── PosApi ──

export const beBillsApi = {
  // ⚠️ BE-25 (be-recheck-2026-10-12): chi nhánh chưa có settings (hoặc BE thiếu cấu hình entity) → VAT 0% không báo lỗi.
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
      }),
      [{ id: input.orderId, expectedVersion: input.expectedVersion }]
    );
    return toBillWithParts(data.restaurantServiceRequestBill);
  },

  // BY_LINE: mọi dòng phải được gán, khoản giảm/phí/thuế phân bổ theo subtotal từng phần; EVEN: dư +1đ cho phần cuối.
  // ⚠️ BE-62 (be-recheck-2026-10-12): chia lại chỉ huỷ phần 0 → các phần 1…N cũ vẫn OPEN, bàn không được giải phóng.
  async splitBill(input) {
    const data = await withConflictOrder(
      gql<{ restaurantServiceSplitBill: BePosBill[] }>(SPLIT_BILL, {
        input: {
          idempotencyKey: input.idempotencyKey,
          orderId: input.orderId,
          expectedVersion: input.expectedVersion,
          ...toSplitInput(input.plan),
        },
      }),
      [{ id: input.orderId, expectedVersion: input.expectedVersion }]
    );
    const bills = data.restaurantServiceSplitBill;
    return bills.map((b) => toBill(b, bills.length));
  },

  async getBill(billId) {
    const data = await gql<{ restaurantServicePosBill: BePosBill | null }>(BILL_QUERY, { id: billId });
    if (!data.restaurantServicePosBill) throw new PosApiError('NOT_FOUND', 'Không tìm thấy hoá đơn');
    return toBillWithParts(data.restaurantServicePosBill);
  },

  /**
   * restaurantServiceBills(branchId, PAID) trả toàn bộ bill đã thu của chi nhánh (không phân trang) →
   * FE tìm theo mã/bàn/tên khách, sắp paidAt mới nhất trước, rồi cắt trang.
   */
  async listBills(query) {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const q = query?.search?.trim().toLowerCase();
    const data = await gql<{ restaurantServiceBills: BePosBill[] }>(BILLS_QUERY, {
      branchId: currentBranchId(),
      status: 'PAID',
    });
    const all = data.restaurantServiceBills
      .filter((b) => !q || matches(b, q))
      .sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt));
    const slice = all.slice((page - 1) * pageSize, page * pageSize);
    // Bill đã chia trong trang → đọc số phần theo đơn (mỗi đơn 1 lần).
    const orderIds = [...new Set(slice.filter((b) => b.part > 0).map((b) => b.orderId))];
    const parts = new Map(await Promise.all(orderIds.map(async (id) => [id, await partsOfOrder(id)] as const)));
    return { items: slice.map((b) => toBill(b, parts.get(b.orderId))), page, pageSize, total: all.length };
  },
} satisfies Pick<PosApi, 'requestBill' | 'splitBill' | 'getBill' | 'listBills'>;
