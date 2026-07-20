// src/data/types.ts — SOURCE OF TRUTH cho mọi surface (copy từ Shared Contract Mục 3.1).
// KHÔNG đổi tên field/enum value. Muốn đổi → cập nhật plan chính + đồng bộ mọi surface.

export type MenuCategory = { id: string; name: string };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  available: number;
  sold: number;
  emoji: string;
  imageGradient: string; // "linear-gradient(...)" — mobile map sang expo-linear-gradient
};

export type TableStatus = 'available' | 'occupied' | 'reserved';
export type TableSize = 'small' | 'large';

export type DiningTable = {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  size: TableSize;
  zone: string;
};

export type Customer = { id: string; name: string; phone?: string };

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'qr' | 'ewallet';
export type ServiceMode = 'dine-in' | 'take-away';

export type OrderLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

export type Order = {
  id: string;
  code: string;
  customerId?: string;
  customerName: string;
  tableId?: string;
  tableName?: string;
  items: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  mode: ServiceMode;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

export type Bill = {
  id: string;
  code: string;
  orderId: string;
  customerName: string;
  tableName?: string;
  tableCode?: string;
  items: OrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paidAt: string; // ISO 8601
};

// ── Auxiliary types cho PosApi (Mục 3.2) ──

export type Staff = { id: string; name: string; role: 'waiter' | 'cashier' | 'manager' };

export type CreateOrderInput = {
  tableId?: string;
  customerName: string;
  guests?: number;
  mode: ServiceMode;
  note?: string;
};

export type Voucher = { code: string; type: 'percent' | 'amount'; value: number };

export type SplitPlan =
  | { mode: 'even'; buckets: number; portions?: number[] }
  | { mode: 'by-item'; assignments: Record<string /* menuItemId */, number /* bucketIndex */> };

export type PayMeta = { tendered?: number; voucher?: Voucher; tip?: number; discount?: number };

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
