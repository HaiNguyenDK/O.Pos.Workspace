// src/data/api/mock.ts — mockPosApi: đọc mocks + giả latency. Bản v1 (D1).
// Mutation cập nhật state in-memory để UI thấy thay đổi trong phiên chạy.
import { calcSubtotal, calcTax } from '@/domain/pricing';
import { computeSplit } from '@/domain/split';
import * as db from '@/data/mocks';
import type { PosApi } from '@/data/api/PosApi';
import type {
  AppNotification,
  Bill,
  BillQuery,
  CreateOrderInput,
  DiningTable,
  Order,
  OrderLine,
  Paginated,
  PayMeta,
  PaymentMethod,
  SplitPlan,
} from '@/data/types';

const delay = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms));

// Bản sao có thể mutate trong phiên (mock không persist).
let tables: DiningTable[] = [...db.tables];
let orders: Order[] = db.orders.map((o) => ({ ...o }));
let bills: Bill[] = db.bills.map((b) => ({ ...b }));
let notifications: AppNotification[] = db.notifications.map((n) => ({ ...n }));

let seq = 100;
const nextCode = (prefix: string) => `${prefix}-${String(++seq).padStart(4, '0')}`;
// Timestamp: mock không dùng Date.now() ở tầng script workflow, nhưng runtime app thì được.
const now = () => new Date().toISOString();

function recalc(order: Order): Order {
  const subtotal = calcSubtotal(order.items);
  const tax = calcTax(subtotal);
  return { ...order, subtotal, tax, total: subtotal + tax, updatedAt: now() };
}

export const mockPosApi: PosApi = {
  async loginPin(pin) {
    await delay(400);
    if (pin.length !== 6) throw new Error('PIN phải 6 số');
    return { token: `mock-${pin}`, staff: db.staff[0] };
  },

  async listTables() {
    await delay();
    return tables;
  },

  async getMenu() {
    await delay();
    return { categories: db.categories, items: db.menuItems };
  },

  async getRunningOrders() {
    await delay();
    return orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  },

  async getRunningOrder(tableId) {
    await delay();
    return orders.find((o) => o.tableId === tableId && o.status !== 'completed') ?? null;
  },

  async createOrder(input: CreateOrderInput) {
    await delay();
    const table = input.tableId ? tables.find((t) => t.id === input.tableId) : undefined;
    const order: Order = recalc({
      id: `o${Date.now()}`,
      code: nextCode('DH'),
      customerName: input.customerName,
      tableId: input.tableId,
      tableName: table?.name,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      status: 'pending',
      mode: input.mode,
      createdAt: now(),
      updatedAt: now(),
    });
    orders = [order, ...orders];
    if (table) tables = tables.map((t) => (t.id === table.id ? { ...t, status: 'occupied' } : t));
    return order;
  },

  async sendToKitchen(orderId, lines: OrderLine[]) {
    await delay();
    let updated: Order | undefined;
    orders = orders.map((o) => {
      if (o.id !== orderId) return o;
      updated = recalc({ ...o, items: lines, status: 'preparing' });
      return updated;
    });
    if (!updated) throw new Error('Không tìm thấy đơn');
    return updated;
  },

  async moveTable(orderId, toTableId) {
    await delay();
    const to = tables.find((t) => t.id === toTableId);
    let updated: Order | undefined;
    orders = orders.map((o) =>
      o.id === orderId
        ? (updated = { ...o, tableId: toTableId, tableName: to?.name, updatedAt: now() })
        : o
    );
    if (!updated) throw new Error('Không tìm thấy đơn');
    return updated;
  },

  async mergeTables(orderId, tableIds) {
    await delay();
    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Không tìm thấy đơn');
    return { ...order, updatedAt: now(), note: `merged:${tableIds.join(',')}` } as Order;
  },

  async getBill(orderId) {
    await delay();
    const order = orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Không tìm thấy đơn');
    return {
      id: `b${order.id}`,
      code: nextCode('HD'),
      orderId: order.id,
      customerName: order.customerName,
      tableName: order.tableName,
      tableCode: order.tableId,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      paymentMethod: 'cash',
      paidAt: now(),
    };
  },

  async applyVoucher(orderId, code) {
    await delay();
    const bill = await this.getBill(orderId);
    // Mock: voucher "GIAM10" giảm 10%.
    const discount = code === 'GIAM10' ? Math.round(bill.subtotal * 0.1) : 0;
    return { ...bill, total: bill.total - discount };
  },

  async splitBill(orderId, plan: SplitPlan) {
    await delay();
    const bill = await this.getBill(orderId);
    return computeSplit(bill, plan).map((s, i) => ({
      ...bill,
      id: `${bill.id}-${i}`,
      code: nextCode('HD'),
      total: s.total,
    }));
  },

  async pay(billId, method: PaymentMethod, _meta?: PayMeta) {
    await delay(500);
    const existing = bills.find((b) => b.id === billId);
    const paid: Bill = existing
      ? { ...existing, paymentMethod: method, paidAt: now() }
      : {
          id: billId,
          code: nextCode('HD'),
          orderId: 'unknown',
          customerName: 'Khách',
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0,
          paymentMethod: method,
          paidAt: now(),
        };
    bills = [paid, ...bills.filter((b) => b.id !== billId)];
    return paid;
  },

  async listBills(query?: BillQuery) {
    await delay();
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const filtered = query?.search
      ? bills.filter(
          (b) =>
            b.code.toLowerCase().includes(query.search!.toLowerCase()) ||
            b.customerName.toLowerCase().includes(query.search!.toLowerCase())
        )
      : bills;
    const start = (page - 1) * pageSize;
    const result: Paginated<Bill> = {
      items: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      total: filtered.length,
    };
    return result;
  },

  async listNotifications() {
    await delay();
    return notifications;
  },
};
