// src/data/api/mock.ts — mockPosApi: đóng vai server theo contract (pos-plan Mục 3.2–3.4; D1).
// State in-memory trong phiên chạy. Mô phỏng: idempotency, version, append-only lines,
// server tính tiền, thanh toán PENDING→SUCCEEDED, duyệt bằng approvalToken (D12).
import * as db from '@/data/mocks';
import { apiSession } from '@/data/api/session';
import type { PosApi } from '@/data/api/PosApi';
import { calcBill, lineTotal, lineUnitPrice, type DiscountRule } from '@/domain/pricing';
import { resolveModifiers } from '@/domain/modifiers';
import { computeSplit } from '@/domain/split';
import { newId } from '@/lib/id';
import {
  PosApiError,
  type Approval,
  type ApprovalAction,
  type Bill,
  type DiningTable,
  type MenuItem,
  type Discount,
  type Order,
  type OrderLine,
  type Payment,
  type RequestBillInput,
  type Staff,
} from '@/data/types';

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const QR_TTL_MS = 5 * 60 * 1000;
const MOCK_IPN_MS = 8000; // giả lập cổng thanh toán báo có sau 8s
const APPROVAL_TTL_MS = 60 * 1000;
const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

// ── State ──
let orders: Order[] = clone(db.orders);
let bills: Bill[] = clone(db.bills);
const payments = new Map<string, Payment>();
const reservedTableIds = new Set(db.tables.filter((t) => t.status === 'RESERVED').map((t) => t.id));
const billAdjustments = new Map<string, Omit<RequestBillInput, 'idempotencyKey' | 'expectedVersion'>>();
const approvals = new Map<string, { approver: Staff; action: ApprovalAction; expiresAt: number }>();
const approvedDiscounts = new Map<string, { type: Discount['type']; value: number; approver: Staff }>();
const idemStore = new Map<string, { payload: string; result: unknown }>();
let pinFails = 0;
let pinLockedUntil = 0;

/** Catalog món mà "server" mock nhận — mặc định menu mock; adapter GraphQL nạp menu BE thật vào đây. */
const menuCatalog = new Map<string, MenuItem>(db.menuItems.map((m) => [m.id, m]));
export function registerMenu(items: MenuItem[]) {
  for (const m of items) menuCatalog.set(m.id, m);
}

let seq = 100;
const nextCode = (prefix: string) => `${prefix}-${String(++seq).padStart(4, '0')}`;

// ── Helpers ──

/** Cùng key → trả lại kết quả cũ; cùng key khác payload → IDEMPOTENCY_MISMATCH. */
async function idem<T>(input: { idempotencyKey: string }, fn: () => T): Promise<T> {
  await delay();
  const { idempotencyKey, ...rest } = input;
  const payload = JSON.stringify(rest);
  const hit = idemStore.get(idempotencyKey);
  if (hit) {
    if (hit.payload !== payload) throw new PosApiError('IDEMPOTENCY_MISMATCH', 'Yêu cầu trùng khoá nhưng khác nội dung');
    return clone(hit.result as T);
  }
  const result = fn();
  idemStore.set(idempotencyKey, { payload, result: clone(result) });
  return clone(result);
}

function me(): Staff {
  const s = apiSession.get();
  if (!s) throw new PosApiError('UNAUTHENTICATED', 'Phiên đăng nhập đã hết, vui lòng nhập PIN');
  return s.staff;
}

function findOrder(id: string): Order {
  const o = orders.find((x) => x.id === id);
  if (!o) throw new PosApiError('NOT_FOUND', 'Không tìm thấy đơn');
  return o;
}

function findBill(id: string): Bill {
  const b = bills.find((x) => x.id === id);
  if (!b) throw new PosApiError('NOT_FOUND', 'Không tìm thấy hoá đơn');
  return b;
}

function checkVersion(o: Order, expected: number) {
  if (o.version !== expected)
    throw new PosApiError('VERSION_CONFLICT', 'Đơn vừa được người khác cập nhật', { order: clone(o) });
}

function touch(o: Order) {
  o.version += 1;
  o.updatedAt = now();
}

function isRunning(o: Order) {
  return o.status === 'OPEN' || o.status === 'BILLING';
}

function deriveTables(): DiningTable[] {
  return db.tables.map((t) => {
    const o = orders.find((x) => x.tableId === t.id && isRunning(x));
    if (o) return { ...t, status: 'OCCUPIED', currentOrderId: o.id };
    return { ...t, status: reservedTableIds.has(t.id) ? 'RESERVED' : 'AVAILABLE', currentOrderId: undefined };
  });
}

function consumeApproval(token: string | undefined, action: ApprovalAction): Staff {
  const a = token ? approvals.get(token) : undefined;
  if (!a || a.action !== action || a.expiresAt < Date.now())
    throw new PosApiError('APPROVAL_REQUIRED', 'Cần quản lý duyệt bằng PIN');
  approvals.delete(token!); // dùng 1 lần
  return a.approver;
}

const canApprove = (s: Staff) => s.role === 'MANAGER' || s.role === 'OWNER';

/** Bill đang mở của đơn mà chưa thu đồng nào → huỷ để tính lại. Đã thu một phần → khoá. */
function voidOpenBills(orderId: string) {
  for (const b of bills) {
    if (b.orderId !== orderId || b.status !== 'OPEN') continue;
    if (b.paidAmount > 0 || b.payments.some((p) => p.status === 'PENDING'))
      throw new PosApiError('ORDER_LOCKED', 'Hoá đơn đang được thanh toán, không sửa được đơn');
    b.status = 'VOID';
  }
}

function reopenIfBilling(o: Order) {
  if (o.status === 'BILLING') {
    voidOpenBills(o.id);
    o.status = 'OPEN';
  }
}

function ensureEditable(o: Order) {
  if (!isRunning(o)) throw new PosApiError('ORDER_LOCKED', 'Đơn đã đóng');
}

function buildBill(
  o: Order,
  lines: OrderLine[],
  money: { subtotal: number; discountTotal: number; serviceCharge: number; tax: number; tip: number; total: number },
  discounts: Discount[],
  part?: Bill['part']
): Bill {
  return {
    id: `b${Date.now()}${Math.floor(Math.random() * 1000)}`,
    code: nextCode('HD'),
    orderId: o.id,
    tableName: o.tableName,
    customerName: o.customerName,
    part,
    lines: lines.map((l) => ({
      lineId: l.id,
      name: l.name,
      quantity: l.quantity,
      modifiers: l.modifiers.map((x) => x.name),
      unitPrice: lineUnitPrice(l),
      lineTotal: l.lineTotal,
      note: l.note,
    })),
    subtotal: money.subtotal,
    discountTotal: money.discountTotal,
    serviceCharge: money.serviceCharge,
    tax: money.tax,
    tip: money.tip,
    total: money.total,
    discounts,
    taxRate: db.branch.settings.taxRate,
    paidAmount: 0,
    status: 'OPEN',
    payments: [],
    createdAt: now(),
  };
}

function priceOrder(o: Order, adj: Omit<RequestBillInput, 'idempotencyKey' | 'expectedVersion'>) {
  const rules: (DiscountRule & Omit<Discount, 'amount'>)[] = [];
  if (adj.voucherCode) {
    const v = db.vouchers[adj.voucherCode.trim().toUpperCase()];
    if (!v) throw new PosApiError('VALIDATION', `Mã voucher không hợp lệ: ${adj.voucherCode}`);
    rules.push({ kind: 'VOUCHER', code: adj.voucherCode.trim().toUpperCase(), type: v.type, value: v.value });
  }
  if (adj.manualDiscount && adj.manualDiscount.value > 0) {
    const actor = me();
    // Giảm giá tay đã duyệt được giữ cho đơn — tính lại bill (đổi tip, phí…) không phải duyệt lại,
    // trừ khi đổi loại/giá trị giảm.
    const prev = approvedDiscounts.get(o.id);
    const same = prev && prev.type === adj.manualDiscount.type && prev.value === adj.manualDiscount.value;
    const approver = canApprove(actor)
      ? actor
      : same
        ? prev.approver
        : consumeApproval(adj.manualDiscount.approvalToken, 'MANUAL_DISCOUNT');
    approvedDiscounts.set(o.id, { type: adj.manualDiscount.type, value: adj.manualDiscount.value, approver });
    rules.push({
      kind: 'MANUAL',
      type: adj.manualDiscount.type,
      value: adj.manualDiscount.value,
      reason: adj.manualDiscount.reason,
      approvedBy: approver.id,
    });
  }
  const lines = o.lines.filter((l) => l.status !== 'VOIDED');
  const p = calcBill(lines, db.branch.settings, { discounts: rules, serviceCharge: adj.serviceCharge, tip: adj.tip });
  const discounts: Discount[] = rules.map((r, i) => ({ ...r, amount: p.discountAmounts[i] }));
  return { lines, p, discounts };
}

function settle(payment: Payment) {
  payment.status = 'SUCCEEDED';
  payment.succeededAt = now();
  const bill = findBill(payment.billId);
  bill.paidAmount += payment.amount;
  bill.payments = bill.payments.map((x) => (x.id === payment.id ? clone(payment) : x));
  if (bill.paidAmount >= bill.total) {
    bill.status = 'PAID';
    bill.paidAt = now();
  }
  const o = findOrder(bill.orderId);
  const live = bills.filter((b) => b.orderId === o.id && b.status !== 'VOID');
  if (live.length > 0 && live.every((b) => b.status === 'PAID')) {
    o.status = 'PAID';
    touch(o);
  }
}

function syncPayment(p: Payment) {
  const bill = bills.find((b) => b.id === p.billId);
  if (bill) bill.payments = bill.payments.map((x) => (x.id === p.id ? clone(p) : x));
}

function refreshExpiry(p: Payment) {
  if (p.status === 'PENDING' && p.qr && Date.parse(p.qr.expiresAt) < Date.now()) {
    p.status = 'EXPIRED';
    syncPayment(p);
  }
}

// ── API ──

export const mockPosApi: PosApi = {
  async loginPin(pin) {
    await delay(400);
    if (Date.now() < pinLockedUntil) throw new PosApiError('FORBIDDEN', 'Máy tạm khoá 15 phút do nhập sai PIN nhiều lần');
    const s = db.staff.find((x) => x.pin === pin);
    if (!s) {
      pinFails += 1;
      if (pinFails >= PIN_MAX_FAILS) {
        pinLockedUntil = Date.now() + PIN_LOCK_MS;
        pinFails = 0;
      }
      throw new PosApiError('UNAUTHENTICATED', 'Sai PIN');
    }
    pinFails = 0;
    const { pin: _pin, ...staff } = s;
    return {
      accessToken: `mock-access.${staff.id}.${newId()}`,
      refreshToken: `mock-refresh.${newId()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      staff,
    };
  },

  async requestApproval({ pin, action }) {
    await delay(300);
    const s = db.staff.find((x) => x.pin === pin);
    if (!s) throw new PosApiError('UNAUTHENTICATED', 'Sai PIN quản lý');
    if (!canApprove(s)) throw new PosApiError('FORBIDDEN', `${s.name} không có quyền duyệt`);
    const token = `appr-${newId()}`;
    const { pin: _pin, ...approver } = s;
    const expiresAt = Date.now() + APPROVAL_TTL_MS;
    approvals.set(token, { approver, action, expiresAt });
    const res: Approval = {
      approvalToken: token,
      approver: { id: approver.id, name: approver.name },
      expiresAt: new Date(expiresAt).toISOString(),
    };
    return res;
  },

  async me() {
    await delay(150);
    return { staff: me(), branch: clone(db.branch) };
  },

  async listTables() {
    await delay();
    return deriveTables();
  },

  async getMenu() {
    await delay();
    return { categories: clone(db.categories), items: clone(db.menuItems) };
  },

  async getRunningOrders() {
    await delay();
    return clone(orders.filter(isRunning));
  },

  async getRunningOrder(tableId) {
    await delay();
    const o = orders.find((x) => x.tableId === tableId && isRunning(x));
    return o ? clone(o) : null;
  },

  async getOrder(orderId) {
    await delay(150);
    return clone(findOrder(orderId));
  },

  async getBill(billId) {
    await delay(150);
    const b = findBill(billId);
    for (const p of b.payments) {
      const live = payments.get(p.id);
      if (live) refreshExpiry(live);
    }
    return clone(findBill(billId));
  },

  async getPayment(paymentId) {
    await delay(150);
    const p = payments.get(paymentId);
    if (!p) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
    refreshExpiry(p);
    return clone(p);
  },

  async listBills(query) {
    await delay();
    const q = query?.search?.trim().toLowerCase();
    const all = bills
      .filter((b) => b.status === 'PAID')
      .filter((b) => !q || [b.code, b.tableName, b.customerName].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    return { items: clone(all.slice((page - 1) * pageSize, page * pageSize)), page, pageSize, total: all.length };
  },

  async listNotifications() {
    await delay();
    return clone(db.notifications);
  },

  async lookupCustomer(phone) {
    await delay();
    const digits = phone.replace(/\D/g, '');
    return clone(db.customers.find((c) => c.phone === digits) ?? null);
  },

  openOrder(input) {
    return idem(input, () => {
      const staff = me();
      if (input.tableId) {
        const t = deriveTables().find((x) => x.id === input.tableId);
        if (!t) throw new PosApiError('NOT_FOUND', 'Không tìm thấy bàn');
        if (t.currentOrderId)
          throw new PosApiError('TABLE_OCCUPIED', `${t.name} đang có đơn`, { currentOrderId: t.currentOrderId });
      }
      const tableName = input.tableId ? db.tables.find((t) => t.id === input.tableId)?.name : undefined;
      const order: Order = {
        id: `o${Date.now()}`,
        code: nextCode('DH'),
        branchId: db.BRANCH_ID,
        tableId: input.tableId,
        tableName,
        customerName: input.customerName,
        mode: input.mode,
        guests: input.guests,
        note: input.note,
        status: 'OPEN',
        lines: [],
        version: 1,
        openedBy: staff.id,
        createdAt: now(),
        updatedAt: now(),
      };
      orders = [order, ...orders];
      return order;
    });
  },

  addLines(input) {
    return idem(input, () => {
      me();
      const o = findOrder(input.orderId);
      ensureEditable(o);
      const fresh = input.lines.filter((l) => !o.lines.some((x) => x.id === l.lineId));
      if (fresh.length === 0) return o;
      const firedAt = now();
      const created = fresh.map((l): OrderLine => {
        const m = menuCatalog.get(l.menuItemId);
        if (!m) throw new PosApiError('NOT_FOUND', 'Món không tồn tại');
        if (!m.isAvailable) throw new PosApiError('ITEM_UNAVAILABLE', `${m.name} đã hết`);
        if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new PosApiError('VALIDATION', 'Số lượng không hợp lệ');
        const { modifiers, error } = resolveModifiers(m, l.modifierOptionIds);
        if (error) throw new PosApiError('VALIDATION', `${m.name}: ${error}`);
        const base = { unitPrice: m.price, modifiers, quantity: l.quantity };
        return { id: l.lineId, menuItemId: m.id, name: m.name, ...base, note: l.note, lineTotal: lineTotal(base), status: 'FIRED', firedAt };
      });
      reopenIfBilling(o);
      o.lines = [...o.lines, ...created];
      touch(o);
      return o;
    });
  },

  voidLine(input) {
    return idem(input, () => {
      const actor = me();
      const o = findOrder(input.orderId);
      ensureEditable(o);
      const line = o.lines.find((l) => l.id === input.lineId);
      if (!line) throw new PosApiError('NOT_FOUND', 'Không tìm thấy món');
      if (line.status === 'VOIDED') return o;
      if (line.status === 'SERVED') throw new PosApiError('VALIDATION', 'Món đã phục vụ, không huỷ được');
      const approver = line.status === 'FIRED' ? undefined : consumeApproval(input.approvalToken, 'VOID_LINE');
      reopenIfBilling(o);
      line.status = 'VOIDED';
      line.voided = { reason: input.reason, by: actor.id, approvedBy: approver?.id, at: now() };
      touch(o);
      return o;
    });
  },

  moveOrder(input) {
    return idem(input, () => {
      me();
      const o = findOrder(input.orderId);
      ensureEditable(o);
      checkVersion(o, input.expectedVersion);
      const t = deriveTables().find((x) => x.id === input.toTableId);
      if (!t) throw new PosApiError('NOT_FOUND', 'Không tìm thấy bàn');
      if (t.currentOrderId) throw new PosApiError('TABLE_OCCUPIED', `${t.name} đang có đơn`, { currentOrderId: t.currentOrderId });
      o.tableId = t.id;
      o.tableName = t.name;
      touch(o);
      return o;
    });
  },

  mergeOrders(input) {
    return idem(input, () => {
      me();
      const primary = findOrder(input.primaryOrderId);
      ensureEditable(primary);
      const sources = input.sourceOrderIds.map(findOrder);
      sources.forEach((s, i) => {
        ensureEditable(s);
        checkVersion(s, input.expectedVersions[i]);
      });
      reopenIfBilling(primary);
      for (const s of sources) {
        reopenIfBilling(s);
        primary.lines = [...primary.lines, ...s.lines];
        s.lines = [];
        s.status = 'MERGED';
        s.mergedIntoOrderId = primary.id;
        touch(s);
      }
      touch(primary);
      return primary;
    });
  },

  requestBill(input) {
    return idem(input, () => {
      const o = findOrder(input.orderId);
      ensureEditable(o);
      checkVersion(o, input.expectedVersion);
      const { idempotencyKey: _k, expectedVersion: _v, ...adj } = input;
      const { lines, p, discounts } = priceOrder(o, adj);
      if (lines.length === 0) throw new PosApiError('VALIDATION', 'Đơn chưa có món');
      voidOpenBills(o.id);
      const bill = buildBill(o, lines, p, discounts);
      bills = [bill, ...bills];
      billAdjustments.set(o.id, adj);
      if (o.status !== 'BILLING') {
        o.status = 'BILLING';
        touch(o);
      }
      return bill;
    });
  },

  splitBill(input) {
    return idem(input, () => {
      const o = findOrder(input.orderId);
      ensureEditable(o);
      checkVersion(o, input.expectedVersion);
      const { lines, p, discounts } = priceOrder(o, billAdjustments.get(o.id) ?? { orderId: o.id });
      if (lines.length === 0) throw new PosApiError('VALIDATION', 'Đơn chưa có món');
      voidOpenBills(o.id);
      const parts = computeSplit(lines, p, db.branch.settings, input.plan);
      const created = parts.map((part) =>
        buildBill(
          o,
          lines.filter((l) => part.lineIds.includes(l.id)),
          part,
          discounts,
          { index: part.index, of: parts.length }
        )
      );
      bills = [...created, ...bills];
      if (o.status !== 'BILLING') {
        o.status = 'BILLING';
        touch(o);
      }
      return created;
    });
  },

  startPayment(input) {
    return idem(input, () => {
      me();
      const bill = findBill(input.billId);
      if (bill.status !== 'OPEN') throw new PosApiError('ORDER_LOCKED', 'Hoá đơn đã đóng');
      for (const x of bill.payments) {
        const live = payments.get(x.id);
        if (live) refreshExpiry(live);
      }
      if (bill.payments.some((x) => payments.get(x.id)?.status === 'PENDING'))
        throw new PosApiError('PAYMENT_PENDING', 'Đang có giao dịch chờ, huỷ trước khi đổi phương thức');
      const due = bill.total - bill.paidAmount;
      if (input.amount !== due) throw new PosApiError('VALIDATION', 'Số tiền không khớp hoá đơn', { due });
      if (input.method === 'CARD' || input.method === 'EWALLET')
        throw new PosApiError('VALIDATION', 'Phương thức chưa hỗ trợ ở MVP');

      const p: Payment = {
        id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`,
        billId: bill.id,
        clientRef: input.clientRef,
        method: input.method,
        amount: input.amount,
        status: 'PENDING',
        createdAt: now(),
      };

      if (input.method === 'CASH') {
        const tendered = input.tendered ?? 0;
        if (tendered < input.amount) throw new PosApiError('VALIDATION', 'Tiền khách đưa chưa đủ');
        p.tendered = tendered;
        p.change = tendered - input.amount;
        p.confirmedBy = 'STAFF';
        payments.set(p.id, p);
        bill.payments = [...bill.payments, clone(p)];
        settle(p);
        return p;
      }

      // VIETQR — payload giả lập (không phải EMVCo thật); BE thật sinh qrPayload chuẩn.
      p.qr = {
        payload: `MOCK-VIETQR|BILL:${bill.code}|AMOUNT:${input.amount}|REF:${p.id}`,
        expiresAt: new Date(Date.now() + QR_TTL_MS).toISOString(),
      };
      payments.set(p.id, p);
      bill.payments = [...bill.payments, clone(p)];
      setTimeout(() => {
        const live = payments.get(p.id);
        if (live?.status === 'PENDING' && Date.parse(live.qr!.expiresAt) > Date.now()) {
          live.confirmedBy = 'PROVIDER';
          live.providerRef = `IPN-${newId().slice(0, 8)}`;
          settle(live);
        }
      }, MOCK_IPN_MS);
      return p;
    });
  },

  cancelPayment(input) {
    return idem(input, () => {
      const p = payments.get(input.paymentId);
      if (!p) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
      refreshExpiry(p);
      if (p.status === 'PENDING') {
        p.status = 'CANCELLED';
        syncPayment(p);
      } else if (p.status === 'SUCCEEDED') {
        throw new PosApiError('ORDER_LOCKED', 'Giao dịch đã thành công, không huỷ được');
      }
      return p;
    });
  },

  confirmPaymentManually(input) {
    return idem(input, () => {
      const p = payments.get(input.paymentId);
      if (!p) throw new PosApiError('NOT_FOUND', 'Không tìm thấy giao dịch');
      refreshExpiry(p);
      if (p.status !== 'PENDING') throw new PosApiError('VALIDATION', 'Giao dịch không còn chờ xác nhận');
      const approver = consumeApproval(input.approvalToken, 'CONFIRM_PAYMENT');
      p.confirmedBy = 'STAFF';
      p.approvedBy = approver.id;
      settle(p);
      return p;
    });
  },
};
