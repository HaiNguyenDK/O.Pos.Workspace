// src/lib/shift.ts — quyền + tiện ích cho ca thu ngân (pos-plan Mục 3.7, Mục 6; D14).
// Server mới là nơi kiểm quyền thật; ở đây chỉ để ẩn/hiện nút cho đúng vai trò.
import type { TFunction } from 'i18next';
import { isPosApiError, type Branch, type ShiftReport, type StaffRole } from '@/data/types';
import { printShiftReport } from '@/native/printer';
import { toast } from '@/lib/toast';

/** Mở ca, xem X: mọi vai trò được thu tiền. */
export const canOpenShift = (role?: StaffRole) => !!role && ['OWNER', 'MANAGER', 'CASHIER', 'WAITER'].includes(role);
/** Chốt ca Z, thu/chi tiền mặt: CASHIER, MANAGER, OWNER (chi của CASHIER cần PIN quản lý). */
export const canManageCash = (role?: StaffRole) => !!role && ['OWNER', 'MANAGER', 'CASHIER'].includes(role);
/** Duyệt được (D12) — chi tiền không cần PIN; được xem tiền hệ thống giữa ca. */
export const isManager = (role?: StaffRole) => role === 'MANAGER' || role === 'OWNER';

/**
 * Lỗi SHIFT_REQUIRED khi thu tiền → toast có hành động mở màn ca. Trả true nếu đã xử lý.
 * `openShift` thường là () => router.push('/(app)/shift').
 */
export function handleShiftRequired(e: unknown, t: TFunction, openShift: () => void): boolean {
  if (!isPosApiError(e) || e.code !== 'SHIFT_REQUIRED') return false;
  toast.action('error', t('shift.required'), t('shift.requiredHint'), openShift);
  return true;
}

/** In báo cáo X/Z ra Sunmi + toast kết quả (như in bill / in thử). */
export async function printReport(
  report: ShiftReport,
  branch: Branch | undefined,
  t: TFunction,
  opts?: { showCash?: boolean }
) {
  const shop = branch ? { name: branch.name, address: branch.address, phone: branch.phone } : undefined;
  const res = await printShiftReport(report, shop, opts);
  if (res.printed) toast.success(t('shift.reportPrinted', { kind: report.kind }), t('shift.number', { number: report.shift.number }));
  else if (res.reason === 'unsupported') toast.info(t('printer.noSunmi'), t('printer.runOnSunmiToPrint'));
  else if (res.reason === 'not_connected') toast.error(t('printer.notConnected'), t('printer.checkService'));
  else toast.error(t('printer.error'), t('printer.tryAgain'));
}
