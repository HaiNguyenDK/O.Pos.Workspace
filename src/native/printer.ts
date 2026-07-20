// src/native/printer.ts — STUB (D2: chưa chốt model máy in, PoC dời sang Sprint 3).
// Giữ interface ổn định để màn payment/success gọi được ngay. Sprint 3 thay bằng
// impl thật: BLE (react-native-ble-plx) | TCP socket (WiFi/LAN) | SDK POS Android.
import type { Bill } from '@/data/types';

export type PrinterTarget = { kind: 'ble' | 'tcp' | 'integrated'; id: string };

export interface Printer {
  isReady(): boolean;
  printReceipt(bill: Bill): Promise<void>;
  printLine(text: string): Promise<void>;
}

/** Stub: log ra console thay vì in thật. */
export const printer: Printer = {
  isReady() {
    return false; // chưa chốt phần cứng
  },
  async printReceipt(bill: Bill) {
    console.log('[printer stub] printReceipt', bill.code, '→ tổng', bill.total);
  },
  async printLine(text: string) {
    console.log('[printer stub] printLine:', text);
  },
};
