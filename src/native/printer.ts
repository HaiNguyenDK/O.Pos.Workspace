// src/native/printer.ts — in hoá đơn qua máy in tích hợp Sunmi (V2s). Sprint 3 (D2 chốt: Sunmi).
// Trên máy KHÔNG phải Sunmi (hoặc dev build chưa có native module) → fallback stub, app vẫn chạy.
import { formatReceipt, formatShiftReport, type ShopInfo } from '@/native/receipt';
import type { Bill, ShiftReport } from '@/data/types';

// requireNativeModule (trong module) sẽ throw nếu binary chưa build module → bọc require để fallback.
declare const require: (id: string) => any;

type SunmiApi = {
  isDeviceSupported(): boolean;
  isConnected(): boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  getStatus(): Promise<string>;
  printText(text: string): Promise<boolean>;
  printQRCode(data: string, moduleSize: number, errorLevel: number): Promise<boolean>;
  lineWrap(lines: number): Promise<boolean>;
  cutPaper(): Promise<boolean>;
};

let Sunmi: SunmiApi | null = null;
try {
  Sunmi = require('../../modules/sunmi-printer').SunmiPrinter as SunmiApi;
} catch {
  Sunmi = null; // module chưa có trong binary hiện tại
}

export type PrintResult = { printed: boolean; reason?: 'unsupported' | 'not_connected' | 'error' };

export function isPrinterSupported(): boolean {
  try {
    return !!Sunmi && Sunmi.isDeviceSupported();
  } catch {
    return false;
  }
}

export async function getPrinterStatus(): Promise<string> {
  if (!isPrinterSupported()) return 'unsupported';
  try {
    return await Sunmi!.getStatus();
  } catch {
    return 'unknown';
  }
}

async function ensureConnected(): Promise<boolean> {
  if (!Sunmi) return false;
  if (Sunmi.isConnected()) return true;
  try {
    await Sunmi.connect();
    // Chờ onConnected (bind bất đồng bộ) rồi kiểm tra lại.
    await new Promise((r) => setTimeout(r, 400));
    return Sunmi.isConnected();
  } catch {
    return false;
  }
}

/** In một khối text đã format (58mm) + đẩy giấy. */
async function printBlock(text: string, label: string): Promise<PrintResult> {
  if (!isPrinterSupported()) {
    console.log('[printer] không phải máy Sunmi — bỏ in', label);
    return { printed: false, reason: 'unsupported' };
  }
  if (!(await ensureConnected())) return { printed: false, reason: 'not_connected' };
  try {
    await Sunmi!.printText(text);
    await Sunmi!.lineWrap(3);
    return { printed: true };
  } catch (e) {
    console.warn('[printer] in lỗi', e);
    return { printed: false, reason: 'error' };
  }
}

export function printReceipt(bill: Bill, shop?: ShopInfo): Promise<PrintResult> {
  return printBlock(formatReceipt(bill, shop), bill.code);
}

/** In báo cáo X/Z ca thu ngân (pos-plan Mục 3.7). */
export function printShiftReport(report: ShiftReport, shop?: ShopInfo, opts?: { showCash?: boolean }): Promise<PrintResult> {
  return printBlock(formatShiftReport(report, shop, opts), `${report.kind} ca #${report.shift.number}`);
}

export async function testPrint(): Promise<PrintResult> {
  if (!isPrinterSupported()) return { printed: false, reason: 'unsupported' };
  if (!(await ensureConnected())) return { printed: false, reason: 'not_connected' };
  try {
    await Sunmi!.printText('WAITER POS\n   In thu giay OK!\n');
    await Sunmi!.lineWrap(3);
    return { printed: true };
  } catch {
    return { printed: false, reason: 'error' };
  }
}
