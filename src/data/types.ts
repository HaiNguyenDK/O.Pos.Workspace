// src/data/types.ts — SOURCE OF TRUTH cho mọi surface: docs/pos/pos-plan.md Mục 3.1.
// KHÔNG đổi tên field/enum value. Muốn đổi → sửa pos-plan.md trước (Mục 9), rồi đồng bộ mọi surface.

/** Tiền: số nguyên, đơn vị đồng (D4). */
export type Money = number;

// ── Tổ chức & người dùng ──

export type StaffRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';
export type Staff = { id: string; name: string; role: StaffRole; branchId: string };

export type BranchSettings = {
  taxRate: number; // ⏳ 10% hay 8% — pos-plan Mục 8 #4
  pricesIncludeTax: boolean;
  serviceChargeRate: number; // 0 = không thu
  cashRounding: number; // 0 = không làm tròn
};
export type Branch = { id: string; name: string; address?: string; phone?: string; settings: BranchSettings };

// ── Bàn & menu ──

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
export type TableSize = 'SMALL' | 'LARGE';

export type DiningTable = {
  id: string;
  branchId: string;
  name: string;
  zone: string;
  seats: number;
  size: TableSize;
  status: TableStatus; // server suy ra từ đơn — client không set
  currentOrderId?: string;
};

export type MenuCategory = { id: string; name: string; sortOrder: number };

export type Station = 'KITCHEN' | 'GRILL' | 'COLD' | 'BAR' | 'DESSERT';
export type ModifierOption = { id: string; name: string; priceDelta: Money };
export type ModifierGroup = { id: string; name: string; min: number; max: number; options: ModifierOption[] };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: Money;
  isAvailable: boolean;
  station: Station;
  modifierGroups: ModifierGroup[];
  imageUrl?: string;
  // Chỉ dùng cho mock/prototype (BE dùng imageUrl):
  emoji?: string;
  imageGradient?: string; // "linear-gradient(...)" — map sang expo-linear-gradient
};

// ── Đơn & dòng món ──

export type ServiceMode = 'DINE_IN' | 'TAKE_AWAY';
export type OrderStatus = 'OPEN' | 'BILLING' | 'PAID' | 'VOIDED' | 'MERGED';
export type LineStatus = 'FIRED' | 'PREPARING' | 'READY' | 'SERVED' | 'VOIDED';

export type LineModifier = { optionId: string; name: string; priceDelta: Money };

export type OrderLine = {
  id: string; // = lineId client sinh (UUID v4)
  menuItemId: string;
  name: string; // snapshot
  unitPrice: Money; // snapshot, chưa gồm modifier
  modifiers: LineModifier[];
  quantity: number;
  note?: string;
  lineTotal: Money;
  status: LineStatus;
  firedAt: string;
  voided?: { reason: string; by: string; approvedBy?: string; at: string };
};

export type Order = {
  id: string;
  code: string;
  branchId: string;
  tableId?: string;
  tableName?: string;
  customerName?: string;
  mode: ServiceMode;
  guests?: number;
  note?: string;
  status: OrderStatus;
  lines: OrderLine[];
  version: number;
  mergedIntoOrderId?: string;
  openedBy: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
};

// ── Bill & thanh toán ──

export type BillStatus = 'OPEN' | 'PAID' | 'VOID';
export type DiscountType = 'PERCENT' | 'AMOUNT';

export type Discount = {
  kind: 'VOUCHER' | 'MANUAL';
  code?: string;
  type: DiscountType;
  value: number;
  amount: Money;
  reason?: string;
  approvedBy?: string;
};

/** Snapshot dòng món trên bill — đủ để in hoá đơn mà không cần đọc lại đơn. */
export type BillLine = {
  lineId: string;
  name: string;
  quantity: number;
  unitPrice: Money; // đã gồm modifier
  lineTotal: Money;
  note?: string;
};

export type PaymentMethod = 'CASH' | 'VIETQR' | 'CARD' | 'EWALLET';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

export type Payment = {
  id: string;
  billId: string;
  clientRef: string;
  method: PaymentMethod;
  amount: Money;
  tendered?: Money;
  change?: Money;
  qr?: { payload: string; expiresAt: string };
  status: PaymentStatus;
  providerRef?: string;
  confirmedBy?: 'PROVIDER' | 'STAFF';
  approvedBy?: string;
  createdAt: string;
  succeededAt?: string;
};

export type Bill = {
  id: string;
  code: string;
  orderId: string;
  tableName?: string;
  customerName?: string;
  part?: { index: number; of: number };
  lines: BillLine[];
  subtotal: Money;
  discounts: Discount[];
  discountTotal: Money;
  serviceCharge: Money;
  taxRate: number;
  tax: Money;
  tip: Money;
  total: Money;
  paidAmount: Money;
  status: BillStatus;
  payments: Payment[];
  createdAt: string;
  paidAt?: string;
};

// ── Input của thao tác (Mục 3.2). Mọi mutation có idempotencyKey (UUID v4, sinh 1 lần / thao tác). ──

export type Idem = { idempotencyKey: string };

export type OpenOrderInput = Idem & {
  tableId?: string;
  mode: ServiceMode;
  guests?: number;
  customerName?: string;
  note?: string;
};

export type NewLineInput = {
  lineId: string;
  menuItemId: string;
  quantity: number;
  modifierOptionIds: string[];
  note?: string;
};

export type ManualDiscountInput = { type: DiscountType; value: number; reason: string; approvalToken?: string };

export type RequestBillInput = Idem & {
  orderId: string;
  expectedVersion: number;
  voucherCode?: string;
  customerId?: string; // khách thân thiết (tích điểm khi PAID — P1)
  manualDiscount?: ManualDiscountInput;
  serviceCharge?: boolean;
  tip?: Money;
};

export type SplitPlan =
  | { mode: 'EVEN'; parts: number }
  | { mode: 'BY_LINE'; parts: number; assignments: Record<string /* lineId */, number /* partIndex */> };

export type StartPaymentInput = Idem & {
  billId: string;
  clientRef: string;
  method: PaymentMethod;
  amount: Money;
  tendered?: Money;
};

export type ApprovalAction = 'VOID_LINE' | 'MANUAL_DISCOUNT' | 'CONFIRM_PAYMENT';
export type Approval = { approvalToken: string; approver: { id: string; name: string }; expiresAt: string };

export type Customer = { id: string; name: string; phone: string; tier?: string; pointBalance: number };

// ── Đọc ──

export type BillQuery = { search?: string; page?: number; pageSize?: number };
export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

export type NotificationKind = 'ready' | 'assigned' | 'alert' | 'promo';
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  tableId?: string;
  read: boolean;
  createdAt: string; // ISO 8601
};

// ── Lỗi (Mục 3.2). BE trả extensions.code dạng số — adapter thật ánh xạ sang tên này. ──

export type PosErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'APPROVAL_REQUIRED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'VERSION_CONFLICT'
  | 'TABLE_OCCUPIED'
  | 'ITEM_UNAVAILABLE'
  | 'ORDER_LOCKED'
  | 'PAYMENT_PENDING'
  | 'IDEMPOTENCY_MISMATCH'
  | 'PROVIDER_ERROR';

export class PosApiError extends Error {
  constructor(
    public code: PosErrorCode,
    message: string,
    public data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PosApiError';
  }
}

/** Lỗi nghiệp vụ (server đã nhận và từ chối) — khác lỗi mạng (có thể thử lại). */
export const isPosApiError = (e: unknown): e is PosApiError => e instanceof PosApiError;
