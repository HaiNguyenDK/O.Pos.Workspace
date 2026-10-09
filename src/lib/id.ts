// src/lib/id.ts — UUID v4 cho lineId / idempotencyKey / clientRef (pos-plan Mục 3.1–3.2).
// Ưu tiên crypto.getRandomValues; Hermes cũ không có thì fallback Math.random (đủ cho khoá chống trùng).

declare const crypto: { getRandomValues?: (a: Uint8Array) => Uint8Array } | undefined;

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto?.getRandomValues) return crypto.getRandomValues(bytes);
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

export function newId(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
