// src/data/api/be/payments.ts — thanh toán trên BE (passiontech-payment). Cờ: `payments`.
// Đề xuất: docs/pos/pos-be-api-request.md Mục 3.4 (RecordCashPayment, qrPayload, ConfirmPaymentManually).
// GetPayment / CreatePayment / CancelPayment đã có trên BE; các field POS (billId, change, qrPayload, shiftId…)
// là phần đề xuất thêm — chỉ bật cờ khi BE đã deploy.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { currentBranchId, money, opt, optMoney, toPaymentMethod } from '@/data/api/be/common';
import { PosApiError, type Payment, type PaymentMethod, type PaymentStatus } from '@/data/types';

/**
 * ⏳ chờ BE xác nhận tên/field: vendor VietQR có báo có (PayOS / SePay / VNPAY-QR — Mục 3.4, câu hỏi 5).
 * Enum BE hiện có: MOMO | NAPAS | VNPAY.
 */
export const VIETQR_VENDOR = 'VNPAY';

// ── Kiểu BE: PaymentServicePaymentGqlOutput (đã có) + field POS đề xuất ──

export type BePayment = {
  id: string;
  amount: number;
  status: string; // BE hiện có: PENDING | PROCESSED | SUCCESS | FAILED (+ đề xuất CANCELLED / EXPIRED)
  paymentMethodType?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  expiredAt?: string | null;
  transactions?: { vendorTransactionId?: string | null }[] | null;
  // Đề xuất 3.4 / 3.11:
  billId?: string | null;
  tendered?: number | null; // ⏳ chờ BE xác nhận tên/field (doc chỉ nêu `change`)
  change?: number | null;
  qrPayload?: string | null;
  shiftId?: string | null;
  failureReason?: string | null;
};

// ⏳ chờ BE xác nhận tên/field: `tendered`, `failureReason`, và việc qrPayload nằm trên Payment (doc: "CreatePayment … trả thêm qrPayload, expiresAt").
// expiresAt của QR dùng field `expiredAt` BE đã có.
export const PAYMENT_FIELDS = `
  id amount status paymentMethodType createdAt paidAt expiredAt
  transactions { vendorTransactionId }
  billId tendered change qrPayload shiftId failureReason
`;

export const GET_PAYMENT = /* GraphQL */ `
  query PosGetPayment($id: ID!) {
    paymentServiceGetPayment(id: $id) { ${PAYMENT_FIELDS} }
  }
`;

// ⏳ chờ BE xác nhận tên/field: tên kiểu input của RecordCashPayment / ConfirmPaymentManually.
export const RECORD_CASH = /* GraphQL */ `
  mutation PosRecordCashPayment($input: PaymentServiceRecordCashPaymentGqlInput!) {
    paymentServiceRecordCashPayment(input: $input) { ${PAYMENT_FIELDS} }
  }
`;

export const CREATE_PAYMENT = /* GraphQL */ `
  mutation PosCreatePayment($input: PaymentServiceCreatePaymentGqlInput!) {
    paymentServiceCreatePayment(input: $input) { payUrl payment { ${PAYMENT_FIELDS} } }
  }
`;

// ⏳ chờ BE xác nhận tên/field: op hiện có chỉ nhận `id`; 3.8 đề nghị mọi mutation POS nhận idempotencyKey.
export const CANCEL_PAYMENT = /* GraphQL */ `
  mutation PosCancelPayment($id: ID!, $idempotencyKey: String) {
    paymentServiceCancelPayment(id: $id, idempotencyKey: $idempotencyKey) { ${PAYMENT_FIELDS} }
  }
`;

export const CONFIRM_MANUALLY = /* GraphQL */ `
  mutation PosConfirmPaymentManually($input: PaymentServiceConfirmPaymentManuallyGqlInput!) {
    paymentServiceConfirmPaymentManually(input: $input) { ${PAYMENT_FIELDS} }
  }
`;

// ── Ánh xạ BE → contract ──

/** PROCESSED = đã gọi cổng, chờ kết quả → PENDING. FAILED có failureReason CANCELLED/EXPIRED → tách ra (3.4). */
export function toPaymentStatus(status: string, failureReason?: string | null): PaymentStatus {
  const s = status.toUpperCase();
  switch (s) {
    case 'PENDING':
    case 'PROCESSED':
      return 'PENDING';
    case 'SUCCESS':
    case 'SUCCEEDED':
      return 'SUCCEEDED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'FAILED': {
      const r = (failureReason ?? '').toUpperCase();
      if (r === 'CANCELLED' || r === 'CANCELED') return 'CANCELLED';
      if (r === 'EXPIRED') return 'EXPIRED';
      return 'FAILED';
    }
    default:
      return 'FAILED';
  }
}

/**
 * BE Payment → contract Payment. BE không lưu clientRef → lấy từ `ctx` khi vừa tạo, còn lại rỗng.
 * `ctx.method` dùng khi BE không trả paymentMethodType.
 */
export function toPayment(p: BePayment, ctx: { billId?: string; clientRef?: string; method?: PaymentMethod } = {}): Payment {
  const providerRef = opt(p.transactions?.find((t) => t.vendorTransactionId)?.vendorTransactionId);
  const method =
    toPaymentMethod(p.paymentMethodType) ?? ctx.method ?? (p.tendered !== null && p.tendered !== undefined ? 'CASH' : 'VIETQR');
  const status = toPaymentStatus(p.status, p.failureReason);
  return {
    id: p.id,
    billId: p.billId ?? ctx.billId ?? '',
    clientRef: ctx.clientRef ?? '',
    method,
    amount: money(p.amount),
    tendered: optMoney(p.tendered),
    change: optMoney(p.change),
    qr: p.qrPayload ? { payload: p.qrPayload, expiresAt: p.expiredAt ?? '' } : undefined,
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
   * CASH → paymentServiceRecordCashPayment (SUCCESS ngay, có change).
   * VIETQR → paymentServiceCreatePayment (method QR, BE sinh qrPayload EMVCo). Số tiền server đối chiếu với bill (3.4).
   */
  async startPayment(input) {
    const ctx = { billId: input.billId, clientRef: input.clientRef, method: input.method };
    if (input.method === 'CASH') {
      const data = await gql<{ paymentServiceRecordCashPayment: BePayment }>(RECORD_CASH, {
        input: {
          idempotencyKey: input.idempotencyKey,
          billId: input.billId,
          amount: input.amount,
          tendered: input.tendered ?? input.amount,
        },
      });
      return toPayment(data.paymentServiceRecordCashPayment, ctx);
    }
    if (input.method !== 'VIETQR') throw new PosApiError('VALIDATION', 'Phương thức chưa hỗ trợ ở MVP');
    const data = await gql<{ paymentServiceCreatePayment: { payUrl?: string | null; payment: BePayment } }>(CREATE_PAYMENT, {
      input: {
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        currency: 'VND',
        branchId: currentBranchId(),
        vendor: VIETQR_VENDOR,
        paymentMethodType: 'QR',
        billId: input.billId, // ⏳ chờ BE xác nhận tên/field (3.4: "Trường billId trên Payment")
        description: input.clientRef,
      },
    });
    return toPayment(data.paymentServiceCreatePayment.payment, ctx);
  },

  async cancelPayment(input) {
    const data = await gql<{ paymentServiceCancelPayment: BePayment | null }>(CANCEL_PAYMENT, {
      id: input.paymentId,
      idempotencyKey: input.idempotencyKey,
    });
    if (!data.paymentServiceCancelPayment) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
    return toPayment(data.paymentServiceCancelPayment);
  },

  async confirmPaymentManually(input) {
    const data = await gql<{ paymentServiceConfirmPaymentManually: BePayment }>(CONFIRM_MANUALLY, {
      input: {
        idempotencyKey: input.idempotencyKey,
        paymentId: input.paymentId,
        approvalToken: input.approvalToken,
        reason: input.reason,
      },
    });
    // Xác nhận tay → confirmedBy STAFF (BE ghi event MANUAL_UPDATE).
    return { ...toPayment(data.paymentServiceConfirmPaymentManually), confirmedBy: 'STAFF' };
  },
} satisfies Pick<PosApi, 'getPayment' | 'startPayment' | 'cancelPayment' | 'confirmPaymentManually'>;
