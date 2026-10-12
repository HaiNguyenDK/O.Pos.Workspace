// src/data/api/errors.ts — ánh xạ mã lỗi BE → mã contract (pos-plan Mục 3.2).
// Dùng chung cho GraphQL (extensions.code) và REST (body.code).
// Nguồn: BE @ 4f4594354 (PR #800) — restaurant internal/errcode/codes.go, payment internal/ecode/payment_errors.go,
// staff internal/errcode/codes.go, auth internal/handler/pos_auth_handler.go (handleError).
import type { PosErrorCode } from '@/data/types';

/** BE trả extensions.code dạng số (pkg/errx, sponge HCode(n) = 200000 + n×100). */
const KNOWN_CODES: Record<number, PosErrorCode> = {
  // REST auth POS (pos_auth_handler.go handleError)
  40101: 'UNAUTHENTICATED', // sai PIN / sai thông tin máy
  40301: 'FORBIDDEN', // không đủ quyền (approve: người nhập PIN không phải MANAGER/OWNER)
  40102: 'UNAUTHENTICATED', // mã kích hoạt sai / hết hạn (15 phút) / đã dùng
  42301: 'FORBIDDEN', // khoá 15 phút do sai PIN 5 lần
  // Lỗi nội bộ còn lại (DAO, gRPC…) — payment 2030xx đã giữ mã nghiệp vụ (BE-30). Giữ VALIDATION + message BE.
  100003: 'VALIDATION',
  // Auth module (errx/codes_core.go)
  200201: 'UNAUTHENTICATED',
  200202: 'UNAUTHENTICATED',
  200203: 'UNAUTHENTICATED',
  200204: 'UNAUTHENTICATED',
  200207: 'UNAUTHENTICATED', // device mismatch
  // Order module cũ (errx/codes_order.go)
  210011: 'ORDER_LOCKED',
  210012: 'ORDER_LOCKED',
  // Restaurant POS — HCode(127) = 212700
  212701: 'TABLE_OCCUPIED', // extensions.currentOrderId
  212702: 'VERSION_CONFLICT', // extensions.latestVersion (không kèm đơn — be/orders.ts gọi lại PosOrder)
  212703: 'NOT_FOUND', // order
  212704: 'ORDER_LOCKED',
  212705: 'ITEM_UNAVAILABLE',
  212706: 'VALIDATION', // trạng thái dòng món không cho phép
  212707: 'NOT_FOUND', // phiếu bếp
  212708: 'VALIDATION', // hết 2 phút gọi lại phiếu — data.reason = RECALL_EXPIRED
  212709: 'NOT_FOUND', // bill
  212710: 'VALIDATION', // bill đã thanh toán
  212711: 'APPROVAL_REQUIRED',
  212712: 'APPROVAL_REQUIRED', // approval token sai/hết hạn → xin duyệt lại
  212713: 'IDEMPOTENCY_MISMATCH',
  212714: 'SHIFT_ALREADY_OPEN',
  212715: 'SHIFT_REQUIRED',
  212716: 'VALIDATION', // ca đã đóng
  212717: 'PAYMENT_PENDING',
  212718: 'NOT_FOUND', // bàn
  212719: 'VALIDATION', // kế hoạch chia bill không hợp lệ
  // Payment POS — HCode(30) = 203000
  203065: 'VALIDATION', // bill không thu được (đã trả / sai số tiền)
  203066: 'SHIFT_REQUIRED', // ca đã đóng hoặc không có
  203067: 'VALIDATION', // payment không còn PENDING
  203068: 'VALIDATION', // tiền khách đưa < số tiền
  203069: 'APPROVAL_REQUIRED',
  // Staff POS — HCode(151) = 215100
  215101: 'NOT_FOUND', // nhân viên
  215102: 'VALIDATION', // PIN trùng trong chi nhánh
  215103: 'FORBIDDEN', // nhân viên ngừng hoạt động
  215104: 'VALIDATION', // PIN sai định dạng
};

/**
 * Lý do chi tiết cho các mã gộp vào VALIDATION/APPROVAL_REQUIRED — gắn vào PosApiError.data.reason
 * để UI phân biệt được (vd gọi lại phiếu quá 2 phút).
 */
const REASONS: Record<number, string> = {
  212706: 'LINE_STATE_INVALID',
  212708: 'RECALL_EXPIRED',
  212710: 'BILL_ALREADY_PAID',
  212712: 'APPROVAL_INVALID',
  212716: 'SHIFT_CLOSED',
  212719: 'SPLIT_INVALID',
  203065: 'BILL_NOT_PAYABLE',
  203067: 'PAYMENT_NOT_PENDING',
  203068: 'INVALID_TENDERED',
  215102: 'PIN_CONFLICT',
  215103: 'STAFF_INACTIVE',
  215104: 'PIN_INVALID',
  42301: 'PIN_LOCKED',
  40102: 'ACTIVATION_CODE_INVALID',
};

/** Tên mã trong contract — BE có thể trả thẳng tên thay vì số (vd 'VERSION_CONFLICT'). */
const CONTRACT_CODES = new Set<PosErrorCode>([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'APPROVAL_REQUIRED',
  'NOT_FOUND',
  'VALIDATION',
  'VERSION_CONFLICT',
  'TABLE_OCCUPIED',
  'ITEM_UNAVAILABLE',
  'ORDER_LOCKED',
  'PAYMENT_PENDING',
  'IDEMPOTENCY_MISMATCH',
  'PROVIDER_ERROR',
  'SHIFT_REQUIRED',
  'SHIFT_ALREADY_OPEN',
]);

/** Mã chuỗi khác tên contract (`401 DEVICE_MISMATCH`). */
const STRING_ALIASES: Record<string, PosErrorCode> = {
  DEVICE_MISMATCH: 'UNAUTHENTICATED',
};

/** Mã chung kiểu HTTP (…400, …401, …403, …404) của sponge errcode. */
function byHttpSuffix(code: number): PosErrorCode | undefined {
  switch (code % 1000) {
    case 400:
      return 'VALIDATION';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    default:
      return undefined;
  }
}

const toNumber = (code: unknown): number => (typeof code === 'number' ? code : Number(code));

/** Mã nhận ra được → tên contract; không nhận ra → undefined (để nơi gọi chọn mặc định). */
export function lookupErrorCode(code: unknown): PosErrorCode | undefined {
  if (code === null || code === undefined || code === '') return undefined;
  if (typeof code === 'string') {
    const s = code.trim().toUpperCase();
    if (CONTRACT_CODES.has(s as PosErrorCode)) return s as PosErrorCode;
    if (STRING_ALIASES[s]) return STRING_ALIASES[s];
  }
  const n = toNumber(code);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return KNOWN_CODES[n] ?? byHttpSuffix(n);
}

export function mapErrorCode(code: unknown): PosErrorCode {
  return lookupErrorCode(code) ?? 'VALIDATION';
}

/** Dữ liệu thêm cho PosApiError.data theo mã BE (hiện chỉ `reason`). */
export function errorExtras(code: unknown): { reason?: string } {
  const reason = REASONS[toNumber(code)];
  return reason ? { reason } : {};
}
