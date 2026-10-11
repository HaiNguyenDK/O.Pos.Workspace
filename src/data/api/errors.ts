// src/data/api/errors.ts — ánh xạ mã lỗi BE → mã contract (pos-plan Mục 3.2, pos-be-api-request Mục 4).
// Dùng chung cho GraphQL (extensions.code) và REST (body.code).
import type { PosErrorCode } from '@/data/types';

/**
 * BE trả extensions.code dạng số (pkg/errx). Bảng này chỉ chứa các mã ĐÃ CÓ trong tài liệu;
 * ⏳ bảng mã của restaurant service chờ BE cấp (pos-be-api-request Mục 4).
 */
const KNOWN_CODES: Record<number, PosErrorCode> = {
  // REST PIN (auth/pin_auth_handler.go) — pos-be-api-request Mục 4
  40101: 'UNAUTHENTICATED', // sai PIN
  40301: 'FORBIDDEN', // máy chưa đăng ký
  42301: 'FORBIDDEN', // khoá do sai PIN nhiều lần
  // Auth module (errx/codes_core.go)
  200201: 'UNAUTHENTICATED',
  200202: 'UNAUTHENTICATED',
  200203: 'UNAUTHENTICATED',
  200204: 'UNAUTHENTICATED',
  200207: 'UNAUTHENTICATED', // device mismatch
  // Order module (errx/codes_order.go)
  210011: 'ORDER_LOCKED',
  210012: 'ORDER_LOCKED',
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

/** Mã chuỗi khác tên contract nhưng đã có trong tài liệu (Mục 2: `401 DEVICE_MISMATCH`). */
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

/** Mã nhận ra được → tên contract; không nhận ra → undefined (để nơi gọi chọn mặc định). */
export function lookupErrorCode(code: unknown): PosErrorCode | undefined {
  if (code === null || code === undefined || code === '') return undefined;
  if (typeof code === 'string') {
    const s = code.trim().toUpperCase();
    if (CONTRACT_CODES.has(s as PosErrorCode)) return s as PosErrorCode;
    if (STRING_ALIASES[s]) return STRING_ALIASES[s];
  }
  const n = typeof code === 'number' ? code : Number(code);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return KNOWN_CODES[n] ?? byHttpSuffix(n);
}

export function mapErrorCode(code: unknown): PosErrorCode {
  return lookupErrorCode(code) ?? 'VALIDATION';
}
