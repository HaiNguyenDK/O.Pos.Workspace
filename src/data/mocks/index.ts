// src/data/mocks/index.ts — mock data dựng TỪ Shared Contract (pos-plan Mục 3.1; D1).
// Đủ để chạy toàn luồng. Tiền tệ: VND số nguyên (D4).
import { calcBill, lineTotal, lineUnitPrice } from '@/domain/pricing';
import type {
  AppNotification,
  Bill,
  Branch,
  Customer,
  DiningTable,
  MenuCategory,
  MenuItem,
  Order,
  OrderLine,
  PaymentMethod,
  Staff,
} from '@/data/types';

export const BRANCH_ID = 'br1';

export const branch: Branch = {
  id: BRANCH_ID,
  name: 'Kopag — Chi nhánh 1',
  address: '12 Lê Lợi, Q.1, TP.HCM',
  phone: '028 3822 0000',
  // ⏳ taxRate / pricesIncludeTax chờ kế toán chốt (pos-plan Mục 8 #4).
  settings: { taxRate: 0.1, pricesIncludeTax: false, serviceChargeRate: 0.05, cashRounding: 0 },
};

/** PIN mock: mỗi nhân viên một PIN 6 số, duy nhất trong chi nhánh. */
export const staff: (Staff & { pin: string })[] = [
  { id: 's1', name: 'Nguyễn Văn A', role: 'WAITER', branchId: BRANCH_ID, pin: '111111' },
  { id: 's2', name: 'Trần Thị B', role: 'CASHIER', branchId: BRANCH_ID, pin: '222222' },
  { id: 's3', name: 'Lê Quản Lý', role: 'MANAGER', branchId: BRANCH_ID, pin: '999999' },
];

export const categories: MenuCategory[] = [
  { id: 'c1', name: 'Món chính', sortOrder: 1 },
  { id: 'c2', name: 'Khai vị', sortOrder: 2 },
  { id: 'c3', name: 'Đồ uống', sortOrder: 3 },
  { id: 'c4', name: 'Tráng miệng', sortOrder: 4 },
];

const item = (
  id: string,
  categoryId: string,
  name: string,
  description: string,
  price: number,
  emoji: string,
  imageGradient: string,
  station: MenuItem['station'] = 'KITCHEN'
): MenuItem => ({
  id,
  categoryId,
  name,
  description,
  price,
  isAvailable: true,
  station,
  modifierGroups: [],
  emoji,
  imageGradient,
});

const opt = (id: string, name: string, priceDelta = 0) => ({ id, name, priceDelta });

export const menuItems: MenuItem[] = [
  {
    ...item('m1', 'c1', 'Phở bò tái', 'Phở bò truyền thống, nước dùng hầm xương', 65000, '🍜', 'linear-gradient(135deg, #F37021, #7c2d12)'),
    modifierGroups: [
      { id: 'g-size', name: 'Size', min: 1, max: 1, options: [opt('o-thuong', 'Thường'), opt('o-dacbiet', 'Đặc biệt', 15000)] },
      { id: 'g-them', name: 'Thêm', min: 0, max: 2, options: [opt('o-thembo', 'Thêm bò', 20000), opt('o-thembanh', 'Thêm bánh', 5000)] },
    ],
  },
  item('m2', 'c1', 'Cơm gà xối mỡ', 'Gà chiên giòn, cơm chiên vàng', 55000, '🍗', 'linear-gradient(135deg, #f59e0b, #78350f)'),
  item('m3', 'c2', 'Gỏi cuốn', 'Tôm thịt, rau sống, chấm mắm nêm', 35000, '🥢', 'linear-gradient(135deg, #22c55e, #14532d)'),
  {
    ...item('m4', 'c3', 'Trà đào cam sả', 'Giải nhiệt, thơm mát', 30000, '🧋', 'linear-gradient(135deg, #f97316, #b45309)', 'BAR'),
    modifierGroups: [
      { id: 'g-topping', name: 'Topping', min: 0, max: 3, options: [opt('o-tranchau', 'Trân châu', 8000), opt('o-thach', 'Thạch đào', 6000), opt('o-kem', 'Kem cheese', 10000)] },
    ],
  },
  {
    ...item('m5', 'c3', 'Cà phê sữa đá', 'Cà phê phin đậm đà', 25000, '☕', 'linear-gradient(135deg, #78350f, #1c1917)', 'BAR'),
    modifierGroups: [
      { id: 'g-duong', name: 'Đường', min: 1, max: 1, options: [opt('o-duong-bt', 'Bình thường'), opt('o-it-duong', 'Ít đường'), opt('o-ko-duong', 'Không đường')] },
      { id: 'g-da', name: 'Đá', min: 0, max: 1, options: [opt('o-it-da', 'Ít đá'), opt('o-ko-da', 'Không đá')] },
    ],
  },
  item('m6', 'c4', 'Bánh flan', 'Mềm mịn, caramel', 20000, '🍮', 'linear-gradient(135deg, #fbbf24, #92400e)', 'DESSERT'),
];

const table = (
  id: string,
  name: string,
  seats: number,
  size: DiningTable['size'],
  zone: string,
  status: DiningTable['status'] = 'AVAILABLE',
  currentOrderId?: string
): DiningTable => ({ id, branchId: BRANCH_ID, name, seats, size, zone, status, currentOrderId });

export const tables: DiningTable[] = [
  table('t1', 'Bàn 1', 2, 'SMALL', 'Tầng 1'),
  table('t2', 'Bàn 2', 4, 'LARGE', 'Tầng 1', 'OCCUPIED', 'o1'),
  table('t3', 'Bàn 3', 4, 'LARGE', 'Tầng 1', 'RESERVED'),
  table('t4', 'Bàn 4', 2, 'SMALL', 'Tầng 1'),
  table('t5', 'Bàn 5', 6, 'LARGE', 'Sân vườn', 'OCCUPIED', 'o2'),
  table('t6', 'Bàn 6', 2, 'SMALL', 'Sân vườn'),
  table('t7', 'VIP 1', 8, 'LARGE', 'Phòng VIP', 'RESERVED'),
  table('t8', 'VIP 2', 8, 'LARGE', 'Phòng VIP'),
];

const menuById = (id: string) => menuItems.find((m) => m.id === id)!;

export function mkLine(
  id: string,
  menuItemId: string,
  quantity: number,
  firedAt: string,
  status: OrderLine['status'] = 'FIRED',
  note?: string
): OrderLine {
  const m = menuById(menuItemId);
  const base = { unitPrice: m.price, modifiers: [], quantity };
  return { id, menuItemId, name: m.name, ...base, note, lineTotal: lineTotal(base), status, firedAt };
}

export const orders: Order[] = [
  {
    id: 'o1',
    code: 'DH-0012',
    branchId: BRANCH_ID,
    customerName: 'Khách bàn 2',
    tableId: 't2',
    tableName: 'Bàn 2',
    mode: 'DINE_IN',
    guests: 4,
    status: 'OPEN',
    lines: [
      mkLine('l-o1-1', 'm1', 2, '2026-07-20T10:16:00.000Z', 'PREPARING'),
      mkLine('l-o1-2', 'm5', 2, '2026-07-20T10:16:00.000Z', 'READY'),
    ],
    version: 3,
    openedBy: 's1',
    createdAt: '2026-07-20T10:15:00.000Z',
    updatedAt: '2026-07-20T10:20:00.000Z',
  },
  {
    id: 'o2',
    code: 'DH-0013',
    branchId: BRANCH_ID,
    customerName: 'Khách bàn 5',
    tableId: 't5',
    tableName: 'Bàn 5',
    mode: 'DINE_IN',
    guests: 3,
    status: 'OPEN',
    lines: [mkLine('l-o2-1', 'm2', 3, '2026-07-20T10:31:00.000Z', 'READY')],
    version: 2,
    openedBy: 's1',
    createdAt: '2026-07-20T10:30:00.000Z',
    updatedAt: '2026-07-20T10:40:00.000Z',
  },
];

/** Bill đã thanh toán cho lịch sử — số tiền tính qua domain/pricing để luôn khớp công thức. */
function paidBill(
  n: number,
  tableName: string,
  customerName: string,
  items: [menuItemId: string, qty: number][],
  method: PaymentMethod,
  paidAt: string
): Bill {
  const lines = items.map(([mid, qty], i) => mkLine(`l-h${n}-${i}`, mid, qty, paidAt, 'SERVED'));
  const p = calcBill(lines, branch.settings);
  const id = `b${n}`;
  return {
    id,
    code: `HD-${String(n + 8).padStart(4, '0')}`,
    orderId: `oh${n}`,
    tableName,
    customerName,
    lines: lines.map((l) => ({
      lineId: l.id,
      name: l.name,
      quantity: l.quantity,
      modifiers: l.modifiers.map((x) => x.name),
      unitPrice: lineUnitPrice(l),
      lineTotal: l.lineTotal,
    })),
    subtotal: p.subtotal,
    discounts: [],
    discountTotal: 0,
    serviceCharge: 0,
    taxRate: branch.settings.taxRate,
    tax: p.tax,
    tip: 0,
    total: p.total,
    paidAmount: p.total,
    status: 'PAID',
    payments: [
      {
        id: `p${n}`,
        billId: id,
        clientRef: `seed-${n}`,
        method,
        amount: p.total,
        status: 'SUCCEEDED',
        confirmedBy: method === 'CASH' ? 'STAFF' : 'PROVIDER',
        createdAt: paidAt,
        succeededAt: paidAt,
      },
    ],
    createdAt: paidAt,
    paidAt,
  };
}

export const bills: Bill[] = [
  paidBill(1, 'Bàn 1', 'Khách lẻ', [['m4', 2]], 'CASH', '2026-07-20T09:50:00.000Z'),
  paidBill(2, 'Bàn 3', 'Anh Minh', [['m1', 3]], 'VIETQR', '2026-07-20T10:05:00.000Z'),
  paidBill(3, 'VIP 1', 'Chị Lan', [['m2', 4], ['m5', 4]], 'CASH', '2026-07-20T10:22:00.000Z'),
  paidBill(4, 'Bàn 6', 'Khách lẻ', [['m4', 2], ['m6', 3]], 'CASH', '2026-07-20T10:35:00.000Z'),
  paidBill(5, 'Bàn 2', 'Anh Tú', [['m3', 2]], 'VIETQR', '2026-07-20T10:48:00.000Z'),
  paidBill(6, 'Bàn 5', 'Chị Hoa', [['m1', 2], ['m4', 2]], 'VIETQR', '2026-07-20T11:02:00.000Z'),
  paidBill(7, 'Bàn 4', 'Khách lẻ', [['m5', 6]], 'CASH', '2026-07-20T11:15:00.000Z'),
  paidBill(8, 'VIP 2', 'Anh Bảo', [['m2', 5], ['m6', 5]], 'CASH', '2026-07-20T11:28:00.000Z'),
  paidBill(9, 'Bàn 1', 'Chị Mai', [['m3', 3], ['m4', 3]], 'VIETQR', '2026-07-20T11:40:00.000Z'),
  paidBill(10, 'Bàn 3', 'Khách lẻ', [['m1', 1]], 'CASH', '2026-07-20T11:52:00.000Z'),
];

/** Mã voucher mock — BE thật: voucherServiceValidateVoucher (P1). */
export const vouchers: Record<string, { type: 'PERCENT' | 'AMOUNT'; value: number }> = {
  GIAM10: { type: 'PERCENT', value: 10 },
  GIAM20: { type: 'PERCENT', value: 20 },
  GIAM50K: { type: 'AMOUNT', value: 50000 },
};

/** Khách thân thiết mock — BE thật: membershipServiceLookupByPhone (P1). */
export const customers: Customer[] = [
  { id: 'cu1', name: 'Chị Lan', phone: '0901234567', tier: 'GOLD', pointBalance: 1250 },
  { id: 'cu2', name: 'Anh Minh', phone: '0912345678', tier: 'SILVER', pointBalance: 430 },
];

export const notifications: AppNotification[] = [
  {
    id: 'n1',
    kind: 'ready',
    title: 'Món sẵn sàng',
    body: 'Bàn 5 — Cơm gà xối mỡ đã xong',
    tableId: 't5',
    read: false,
    createdAt: '2026-07-20T10:40:00.000Z',
  },
  {
    id: 'n2',
    kind: 'assigned',
    title: 'Bàn mới',
    body: 'Bạn được phân công Bàn 2',
    tableId: 't2',
    read: true,
    createdAt: '2026-07-20T10:14:00.000Z',
  },
];
