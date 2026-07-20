// src/data/api/PosApi.ts — interface ỔN ĐỊNH, KHÔNG đổi khi mock→real (Mục 3.2).
// UI không bao giờ fetch trực tiếp — chỉ gọi query hook → PosApi. Đổi backend = thay 1 file impl.
import type {
  AppNotification,
  Bill,
  BillQuery,
  CreateOrderInput,
  DiningTable,
  MenuCategory,
  MenuItem,
  Order,
  OrderLine,
  Paginated,
  PayMeta,
  PaymentMethod,
  SplitPlan,
  Staff,
} from '@/data/types';

export interface PosApi {
  // Auth
  loginPin(pin: string): Promise<{ token: string; staff: Staff }>;
  // Tables & orders
  listTables(): Promise<DiningTable[]>;
  getMenu(): Promise<{ categories: MenuCategory[]; items: MenuItem[] }>;
  getRunningOrders(): Promise<Order[]>;
  getRunningOrder(tableId: string): Promise<Order | null>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  sendToKitchen(orderId: string, lines: OrderLine[]): Promise<Order>;
  moveTable(orderId: string, toTableId: string): Promise<Order>;
  mergeTables(orderId: string, tableIds: string[]): Promise<Order>;
  // Billing & payment
  getBill(orderId: string): Promise<Bill>;
  applyVoucher(orderId: string, code: string): Promise<Bill>;
  splitBill(orderId: string, plan: SplitPlan): Promise<Bill[]>;
  pay(billId: string, method: PaymentMethod, meta?: PayMeta): Promise<Bill>;
  // History & notifications
  listBills(query?: BillQuery): Promise<Paginated<Bill>>;
  listNotifications(): Promise<AppNotification[]>;
}
