// src/data/api/be/payments.ts — thanh toán POS trên BE (passiontech-payment). Cờ: `payments`.
// Schema thật: apps/passiontech-payment/graph/schema.graphqls @ bb3e223c6 —
// paymentServiceCreatePosPayment / ConfirmPosPayment / CancelPosPayment, PaymentServicePaymentGqlOutput.
// ⚠️ Op POS của payment CHƯA lên gateway ogw (be-review Mục 1) — chỉ bật cờ khi BE publish subgraph.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { getDeviceId } from '@/data/api/session';
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
};

export const PAYMENT_FIELDS = `
  id amount status vendor paymentMethodType createdAt paidAt expiresAt
  billId shiftId qrPayload tendered change
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

// ⚠️ BE bug #16 (be-review-2026-10-11): Cancel/Confirm POS payment không nhận idempotencyKey.
export const CANCEL_POS_PAYMENT = /* GraphQL */ `
  mutation PosCancelPayment($paymentId: ID!) {
    paymentServiceCancelPosPayment(paymentId: $paymentId) { ${PAYMENT_FIELDS} }
  }
`;

export const CONFIRM_POS_PAYMENT = /* GraphQL */ `
  mutation PosConfirmPayment($paymentId: ID!, $approvalToken: String, $reason: String) {
    paymentServiceConfirmPosPayment(paymentId: $paymentId, approvalToken: $approvalToken, reason: $reason) { ${PAYMENT_FIELDS} }
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
   * Luôn gửi branchId + deviceId: BE tự tìm ca đang mở của máy theo deviceId (không gửi shiftId).
   * ⚠️ BE bug #10: không chặn SHIFT_REQUIRED khi máy chưa mở ca (payment không gắn ca) — UI vẫn chặn theo contract.
   * ⚠️ BE bug #11: không có quy tắc 1 payment PENDING / bill (PAYMENT_PENDING) → có thể thu trùng.
   * ⚠️ BE bug #12: lỗi 203065–203069 hiện về FE dưới dạng 100003 (VALIDATION, message của BE).
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
        deviceId: getDeviceId() || undefined,
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
    });
    if (!data.paymentServiceCancelPosPayment) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
    return toPayment(data.paymentServiceCancelPosPayment);
  },

  /**
   * ⚠️ BE bug #13: approval token bị tiêu TRƯỚC khi kiểm trạng thái payment — retry/nhầm trạng thái làm mất token
   * (UI phải xin duyệt lại). ⚠️ Bảo mật #4: payment không kiểm action/branch của approval.
   */
  async confirmPaymentManually(input) {
    const data = await gql<{ paymentServiceConfirmPosPayment: BePayment | null }>(CONFIRM_POS_PAYMENT, {
      paymentId: input.paymentId,
      approvalToken: input.approvalToken,
      reason: input.reason,
    });
    if (!data.paymentServiceConfirmPosPayment) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
    // Xác nhận tay → confirmedBy STAFF (BE ghi event MANUAL_UPDATE).
    return { ...toPayment(data.paymentServiceConfirmPosPayment), confirmedBy: 'STAFF' };
  },
} satisfies Pick<PosApi, 'getPayment' | 'startPayment' | 'cancelPayment' | 'confirmPaymentManually'>;
