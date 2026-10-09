# Sprint 3 — In hoá đơn trên Sunmi V2s

> Bổ trợ [waiter-pos-mobile-plan.md](../../docs/waiter-pos-mobile-plan.md) Mục 8 (rủi ro #1/#2). Quyết định D2 đã chốt: **máy in tích hợp Sunmi (Android 11, bản STGL có GMS)**.

## Kiến trúc
- **Local Expo native module** `modules/sunmi-printer/` (Kotlin) bind Sunmi inner printer service qua AIDL bằng thư viện `com.sunmi:printerlibrary:1.0.22` (Maven Central).
  - `SunmiPrinterModule.kt`: `connect/disconnect`, `isDeviceSupported`, `isConnected`, `getStatus`, `printText`, `printQRCode`, `lineWrap`, `cutPaper`.
  - `AndroidManifest.xml`: `<queries>` cho package `woyou.aidlservice.jiuiv5` — **bắt buộc trên Android 11** (package visibility) để bind service ngoài.
- **JS**: `src/native/printer.ts` — `printReceipt(bill)`, `testPrint()`, `getPrinterStatus()`, `isPrinterSupported()`.
  - Layout hoá đơn ở JS: `src/native/receipt.ts` (58mm, 32 cột) — dễ chỉnh, native chỉ `printText`.
  - **Fallback an toàn**: nếu không phải máy Sunmi (hoặc binary chưa build module) → `require` bọc try/catch → stub, app vẫn chạy trên máy thường/Expo Go.
- **UI**: nút "In bill" ở `payment/success`; mục "Máy in (Sunmi)" + "In thử" + trạng thái ở `settings`.

## Build & chạy trên máy Sunmi V2s (USB debug)
Vì đã thêm native module + dependency Maven, **phải build lại native** (không phải chỉ reload JS):

```powershell
cd O.Pos.Workspace
bunx expo run:android       # tự prebuild, autolink module sunmi-printer, tải com.sunmi:printerlibrary, cài lên máy
```
- Lần đầu Gradle sẽ tải `com.sunmi:printerlibrary` từ Maven Central (cần mạng).
- Sau khi cài: mở app → PIN → tạo đơn → gửi bếp → thanh toán → **In bill**; hoặc Settings → **In thử**.
- Kiểm tra trạng thái: Settings hiển thị `Sẵn sàng / Hết giấy / Mở nắp…` từ `updatePrinterState()`.

## Lỗi splash trắng (đã fix)
Thiếu `babel.config.js` → `react-native-worklets/plugin` không chạy → Reanimated 4 crash khi mount → kẹt splash. Đã thêm `babel.config.js` (`babel-preset-expo` tự thêm worklets plugin). Chỉ cần `npx expo start -c` + reload; **không** cần build native cho fix này.

## Còn lại của Sprint 3 (chưa làm)
- Camera quét QR bàn (`expo-camera`), push deep-link (`expo-notifications` + FCM), offline queue "gửi bếp" (AsyncStorage).
- Nâng cấp layout hoá đơn: logo bitmap, in QR VietQR thật trên bill, đậm/to cho tiêu đề (Sunmi `setFontSize`/bold).
- (Tuỳ chọn) chuyển sang ESC/POS `sendRAWData` nếu cần định dạng nâng cao.
