// src/data/api/be/jwt.ts — đọc claim JWT (KHÔNG kiểm chữ ký — chỉ để lấy sub/exp hiển thị; server mới là nơi xác thực).
// Dùng cho staffJwt (pin-login không trả expiresIn/refresh token) và approvalToken (approve không trả approver/expiresAt).

export type JwtClaims = { sub?: string; exp?: number; [k: string]: unknown };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64url → chuỗi UTF-8 (tự giải mã, không phụ thuộc atob/Buffer của runtime). */
function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('base64 không hợp lệ');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

/** Payload JWT; token hỏng → {} (nơi gọi tự chọn giá trị mặc định). */
export function decodeJwt(token: string): JwtClaims {
  try {
    const part = token.split('.')[1];
    if (!part) return {};
    const claims = JSON.parse(base64UrlDecode(part)) as unknown;
    return claims && typeof claims === 'object' ? (claims as JwtClaims) : {};
  } catch {
    return {};
  }
}

/** exp (giây) → ISO; thiếu exp → now + fallbackSec. */
export function jwtExpiresAt(claims: JwtClaims, fallbackSec: number, nowMs = Date.now()): string {
  const exp = typeof claims.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp * 1000 : nowMs + fallbackSec * 1000;
  return new Date(exp).toISOString();
}
