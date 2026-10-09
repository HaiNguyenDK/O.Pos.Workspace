# Kopag POS — Waiter app (Expo)

App gọi món cầm tay cho phục vụ / thu ngân, chạy trên **Sunmi V2s** (Android) có máy in nhiệt tích hợp.

- Plan & contract dùng chung (nguồn sự thật): `../../docs/pos/pos-plan.md`
- Đề xuất API gửi team BE: `../../docs/pos/pos-be-api-request.md`
- In hoá đơn Sunmi: [`docs/sprint3-printing-sunmi.md`](docs/sprint3-printing-sunmi.md)

## Chạy

Package manager: **bun** (`bun.lock`). Không dùng npm/yarn.

```bash
bun install
bunx expo start                 # dev (Expo Go / dev client)
bunx expo run:android           # build native + cài lên máy (cần cho module sunmi-printer)
bunx tsc --noEmit -p .          # typecheck
```

Mặc định chạy với **mock API** (`EXPO_PUBLIC_API_MODE=mock`) — mock đóng vai server theo contract (idempotency, version, server tính tiền, thanh toán). PIN thử: `111111` phục vụ, `222222` thu ngân, `999999` quản lý (dùng để duyệt).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/app/` | Màn hình (expo-router) |
| `src/data/` | `types.ts` (contract), `api/PosApi.ts` (interface), `api/mock.ts`, `queries/` (TanStack Query), `offline.ts` |
| `src/domain/` | Tính tiền, chia bill, modifier — dùng chung cho mock và xem trước ở client |
| `src/store/` | Zustand: phiên đăng nhập, giỏ, đơn đang mở, phiên thanh toán, hàng đợi offline |
| `src/native/` | Máy in Sunmi, hoá đơn, thông báo |
| `modules/sunmi-printer/` | Local Expo module (Kotlin) cho máy in Sunmi |

UI chỉ gọi hook trong `src/data/queries` → `PosApi`. Đổi sang BE thật = thêm impl GraphQL cho `PosApi`, không sửa màn hình.
