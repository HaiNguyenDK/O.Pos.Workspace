// src/data/api/be/payments.ts — thanh toán POS trên BE (passiontech-payment). Cờ: `payments`.
// Schema thật: apps/passiontech-payment/graph/schema.graphqls @ 4f4594354 (PR #800) —
// paymentServiceCreatePosPayment / ConfirmPosPayment / CancelPosPayment, PaymentServicePaymentGqlOutput.
// Gateway ogw (2026-10-12) đã có 3 op POS nhưng còn là schema trước PR #800 (chưa có roundingAdjustment,
// idempotencyKey của Confirm/Cancel) → chỉ bật cờ khi BE deploy PR #800 (be-recheck-2026-10-12).
// Máy thu tiền = header X-Device-Id (graphql-client luôn gửi); BE bỏ qua input.deviceId.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { currentBranchId, money, opt, optMoney, toPaymentMethod } from '@/data/api/be/common';
import { PosApiError, type Payment, type PaymentMethod, type PaymentStatus } from '@/data/types';

/**
 * Vendor QR (enum PaymentServicePaymentVendorCodeGql): PAYOS | SEPAY. BE mặc định PAYOS khi method QR.
 * ⚠️ BE chưa tích hợp PayOS/SePay thật: qrPayload là chuỗi dev `QR|vendor|id|amount`, chỉ xác nhận tay được (review câu hỏi 5).
 */
export const VIETQR_VENDOR = 'PAYOS';

// ── Kiểu BE: PaymentServicePaymentGqlOutput (chỉ field dùng tới) ──

export type BePayment = {
  id: string;
  amount: number;
  /** PaymentServicePaymentStatusGql: PENDING | PROCESSED | SUCCESS | FAILED | CHECKING | EXPIRED | CANCELLED */
  status: string;
  /** PaymentServicePaymentVendorCodeGql: CASH | PAYOS | SEPAY | … */
  vendor?: string | null;
  /** PaymentServicePaymentMethodTypeGql: CASH | QR | … */
  paymentMethodType?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  /** Hạn QR POS (10 phút). Khác `expiredAt` (field cũ của luồng web). */
  expiresAt?: string | null;
  transactions?: { vendorTransactionId?: string | null }[] | null;
  billId?: string | null;
  shiftId?: string | null;
  qrPayload?: string | null;
  tendered?: number | null;
  change?: number | null;
  /** CASH: amount đã làm tròn − số tiền yêu cầu; null khi bằng 0. */
  roundingAdjustment?: number | null;
};

export const PAYMENT_FIELDS = `
  id amount status vendor paymentMethodType createdAt paidAt expiresAt
  billId shiftId qrPayload tendered change roundingAdjustment
  transactions { vendorTransactionId }
`;

export const GET_PAYMENT = /* GraphQL */ `
  query PosGetPayment($id: ID!) {
    paymentServiceGetPayment(id: $id) { ${PAYMENT_FIELDS} }
  }
`;

export const CREATE_POS_PAYMENT = /* GraphQL */ `
  mutation PosCreatePayment($input: PaymentServiceCreatePosPaymentInput!) {
    paymentServiceCreatePosPayment(input: $input) { ${PAYMENT_FIELDS} }
  }
`;

// BE chỉ ghi log idempotencyKey của Cancel/Confirm; retry an toàn nhờ kiểm trạng thái payment.
export const CANCEL_POS_PAYMENT = /* GraphQL */ `
  mutation PosCancelPayment($paymentId: ID!, $idempotencyKey: ID) {
    paymentServiceCancelPosPayment(paymentId: $paymentId, idempotencyKey: $idempotencyKey) { ${PAYMENT_FIELDS} }
  }
`;

export const CONFIRM_POS_PAYMENT = /* GraphQL */ `
  mutation PosConfirmPayment($paymentId: ID!, $approvalToken: String, $reason: String, $idempotencyKey: ID) {
    paymentServiceConfirmPosPayment(
      paymentId: $paymentId
      approvalToken: $approvalToken
      reason: $reason
      idempotencyKey: $idempotencyKey
    ) { ${PAYMENT_FIELDS} }
  }
`;

// ── Ánh xạ BE → contract ──

/**
 * Trạng thái payment → contract. Nhận cả enum GraphQL (SUCCESS…) lẫn tên proto thô `PAYMENT_STATUS_*`
 * mà restaurant trả trong PosServiceBill.payments[].status.
 */
export function toPaymentStatus(status: string | null | undefined): PaymentStatus {
  const s = (status ?? '').trim().toUpperCase().replace(/^PAYMENT_STATUS_/, '');
  switch (s) {
    case 'PENDING':
    case 'PROCESSED':
    case 'CHECKING':
    case 'PAID_PARTIALLY':
      return 'PENDING';
    case 'SUCCESS':
    case 'SUCCEEDED':
    case 'PAID':
    case 'REFUNDING': // chưa hoàn xong → vẫn tính là đã thu
    case 'REFUND_FAILED':
      return 'SUCCEEDED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'REFUNDED':
      return 'REFUNDED';
    default:
      return 'FAILED';
  }
}

/**
 * BE Payment → contract Payment. BE không lưu clientRef → lấy từ `ctx` khi vừa tạo, còn lại rỗng.
 * `ctx.method` dùng khi BE không trả vendor/paymentMethodType.
 */
export function toPayment(p: BePayment, ctx: { billId?: string; clientRef?: string; method?: PaymentMethod } = {}): Payment {
  const providerRef = opt(p.transactions?.find((t) => t.vendorTransactionId)?.vendorTransactionId);
  const method = toPaymentMethod(p.vendor) ?? toPaymentMethod(p.paymentMethodType) ?? ctx.method ?? 'VIETQR';
  const status = toPaymentStatus(p.status);
  return {
    id: p.id,
    billId: p.billId ?? ctx.billId ?? '',
    clientRef: ctx.clientRef ?? '',
    method,
    amount: money(p.amount),
    tendered: optMoney(p.tendered),
    change: optMoney(p.change),
    qr: p.qrPayload ? { payload: p.qrPayload, expiresAt: p.expiresAt ?? '' } : undefined,
    status,
    providerRef,
    confirmedBy: method === 'CASH' ? 'STAFF' : status === 'SUCCEEDED' && providerRef ? 'PROVIDER' : undefined,
    shiftId: opt(p.shiftId),
    roundingAdjustment: optMoney(p.roundingAdjustment),
    createdAt: p.createdAt ?? new Date().toISOString(),
    succeededAt: status === 'SUCCEEDED' ? opt(p.paidAt) : undefined,
  };
}

// ── PosApi ──

export const bePaymentsApi = {
  async getPayment(paymentId) {
    const data = await gql<{ paymentServiceGetPayment: BePayment | null }>(GET_PAYMENT, { id: paymentId });
    if (!data.paymentServiceGetPayment) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
    return toPayment(data.paymentServiceGetPayment);
  },

  /**
   * paymentServiceCreatePosPayment: CASH → SUCCESS ngay (có change); VIETQR → method QR, vendor PAYOS, PENDING + qrPayload.
   * Ca = ca đang mở của máy theo header X-Device-Id (không gửi shiftId) → chưa mở ca: SHIFT_REQUIRED (212715);
   * bill đã có payment PENDING: PAYMENT_PENDING (212717). CASH có thể bị làm tròn: `amount` trả về là số đã làm tròn,
   * `change` tính theo số đó, chênh lệch ở `roundingAdjustment`.
   * ⚠️ BE-61 (be-recheck-2026-10-12): BE tin `branchId` của input → luôn gửi chi nhánh của máy, không gửi rỗng.
   * ⚠️ BE-64: 2 lần thu CASH sát nhau vẫn có thể cùng qua; lần đua thua có thể trả lỗi SQL thô (VALIDATION).
   *   UI giữ khoá nút + idempotencyKey theo bill.
   */
  async startPayment(input) {
    const ctx = { billId: input.billId, clientRef: input.clientRef, method: input.method };
    if (input.method !== 'CASH' && input.method !== 'VIETQR') throw new PosApiError('VALIDATION', 'Phương thức chưa hỗ trợ ở MVP');
    const cash = input.method === 'CASH';
    const data = await gql<{ paymentServiceCreatePosPayment: BePayment | null }>(CREATE_POS_PAYMENT, {
      input: {
        idempotencyKey: input.idempotencyKey,
        billId: input.billId,
        amount: input.amount,
        method: cash ? 'CASH' : 'QR',
        // Với method CASH phải gửi vendor CASH (BE lấy vendor input nếu có — graphql_payment.go CreatePosPayment).
        vendor: cash ? 'CASH' : VIETQR_VENDOR,
        branchId: currentBranchId(),
        tendered: cash ? (input.tendered ?? input.amount) : undefined,
        description: input.clientRef,
      },
    });
    if (!data.paymentServiceCreatePosPayment) throw new PosApiError('PROVIDER_ERROR', 'Không tạo được giao dịch');
    return toPayment(data.paymentServiceCreatePosPayment, ctx);
  },

  async cancelPayment(input) {
    const data = await gql<{ paymentServiceCancelPosPayment: BePayment | null }>(CANCEL_POS_PAYMENT, {
      paymentId: input.paymentId,
      idempotencyKey: input.idempotencyKey,
    });
    if (!data.paymentServiceCancelPosPayment) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
    return toPayment(data.paymentServiceCancelPosPayment);
  },

  /**
   * OWNER/MANAGER xác nhận không cần approval; CASHIER/WAITER cần approvalToken action CONFIRM_PAYMENT.
   * BE kiểm payment PENDING trước rồi mới tiêu token (BE-32).
   */
  async confirmPaymentManually(input) {
    const data = await gql<{ paymentServiceConfirmPosPayment: BePayment | null }>(CONFIRM_POS_PAYMENT, {
      paymentId: input.paymentId,
      approvalToken: input.approvalToken,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
    if (!data.paymentServiceConfirmPosPayment) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
    // Xác nhận tay → confirmedBy STAFF (BE ghi event MANUAL_UPDATE).
    return { ...toPayment(data.paymentServiceConfirmPosPayment), confirmedBy: 'STAFF' };
  },
} satisfies Pick<PosApi, 'getPayment' | 'startPayment' | 'cancelPayment' | 'confirmPaymentManually'>;
