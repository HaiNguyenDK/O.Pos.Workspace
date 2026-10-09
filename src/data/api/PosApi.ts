// src/data/api/PosApi.ts — interface ỔN ĐỊNH, KHÔNG đổi khi mock→real (pos-plan Mục 3.2).
// UI không bao giờ fetch trực tiếp — chỉ gọi query hook → PosApi. Đổi backend = thay 1 file impl.
// Tên op phía BE có tiền tố service (vd addLines ↔ restaurantServiceAddLines) — xem docs/pos/pos-be-api-request.md.
import type {
  Approval,
  ApprovalAction,
  AppNotification,
  Bill,
  BillQuery,
  Branch,
  Customer,
  DiningTable,
  Idem,
  MenuCategory,
  MenuItem,
  NewLineInput,
  OpenOrderInput,
  Order,
  Paginated,
  Payment,
  RequestBillInput,
  SplitPlan,
  Staff,
  StartPaymentInput,
} from '@/data/types';

export type LoginResult = { accessToken: string; refreshToken: string; expiresAt: string; staff: Staff };

export interface PosApi {
  // Auth (BE: REST /api/v1/auth/pos/*)
  loginPin(pin: string): Promise<LoginResult>;
  requestApproval(input: { pin: string; action: ApprovalAction }): Promise<Approval>;
  me(): Promise<{ staff: Staff; branch: Branch }>;

  // Đọc
  listTables(): Promise<DiningTable[]>;
  getMenu(): Promise<{ categories: MenuCategory[]; items: MenuItem[] }>;
  getRunningOrders(): Promise<Order[]>;
  getRunningOrder(tableId: string): Promise<Order | null>;
  getOrder(orderId: string): Promise<Order>;
  getBill(billId: string): Promise<Bill>;
  getPayment(paymentId: string): Promise<Payment>;
  listBills(query?: BillQuery): Promise<Paginated<Bill>>;
  listNotifications(): Promise<AppNotification[]>;
  lookupCustomer(phone: string): Promise<Customer | null>; // P1 — BE: membershipServiceLookupByPhone

  // Đơn
  openOrder(input: OpenOrderInput): Promise<Order>;
  addLines(input: Idem & { orderId: string; lines: NewLineInput[] }): Promise<Order>;
  voidLine(input: Idem & { orderId: string; lineId: string; reason: string; approvalToken?: string }): Promise<Order>;
  moveOrder(input: Idem & { orderId: string; toTableId: string; expectedVersion: number }): Promise<Order>;
  mergeOrders(
    input: Idem & { primaryOrderId: string; sourceOrderIds: string[]; expectedVersions: number[] }
  ): Promise<Order>;

  // Bill — server tính tiền (D7)
  requestBill(input: RequestBillInput): Promise<Bill>;
  splitBill(input: Idem & { orderId: string; expectedVersion: number; plan: SplitPlan }): Promise<Bill[]>;

  // Thanh toán
  startPayment(input: StartPaymentInput): Promise<Payment>;
  cancelPayment(input: Idem & { paymentId: string }): Promise<Payment>;
  confirmPaymentManually(
    input: Idem & { paymentId: string; approvalToken: string; reason: string }
  ): Promise<Payment>;
}
