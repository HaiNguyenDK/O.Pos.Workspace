// src/data/mocks/index.ts — mock data build TỪ Shared Contract (D1: không có web prototype).
// Đủ để chạy Sprint 0. Mở rộng khi làm màn mới. Tiền tệ: VND.
import type {
  AppNotification,
  Bill,
  DiningTable,
  MenuCategory,
  MenuItem,
  Order,
  Staff,
} from '@/data/types';

export const staff: Staff[] = [
  { id: 's1', name: 'Nguyễn Văn A', role: 'waiter' },
  { id: 's2', name: 'Trần Thị B', role: 'cashier' },
];

export const categories: MenuCategory[] = [
  { id: 'c1', name: 'Món chính' },
  { id: 'c2', name: 'Khai vị' },
  { id: 'c3', name: 'Đồ uống' },
  { id: 'c4', name: 'Tráng miệng' },
];

export const menuItems: MenuItem[] = [
  {
    id: 'm1',
    categoryId: 'c1',
    name: 'Phở bò tái',
    description: 'Phở bò truyền thống, nước dùng hầm xương',
    price: 65000,
    available: 40,
    sold: 128,
    emoji: '🍜',
    imageGradient: 'linear-gradient(135deg, #F37021, #7c2d12)',
  },
  {
    id: 'm2',
    categoryId: 'c1',
    name: 'Cơm gà xối mỡ',
    description: 'Gà chiên giòn, cơm chiên vàng',
    price: 55000,
    available: 30,
    sold: 96,
    emoji: '🍗',
    imageGradient: 'linear-gradient(135deg, #f59e0b, #78350f)',
  },
  {
    id: 'm3',
    categoryId: 'c2',
    name: 'Gỏi cuốn',
    description: 'Tôm thịt, rau sống, chấm mắm nêm',
    price: 35000,
    available: 25,
    sold: 64,
    emoji: '🥢',
    imageGradient: 'linear-gradient(135deg, #22c55e, #14532d)',
  },
  {
    id: 'm4',
    categoryId: 'c3',
    name: 'Trà đào cam sả',
    description: 'Giải nhiệt, thơm mát',
    price: 30000,
    available: 50,
    sold: 210,
    emoji: '🧋',
    imageGradient: 'linear-gradient(135deg, #f97316, #b45309)',
  },
  {
    id: 'm5',
    categoryId: 'c3',
    name: 'Cà phê sữa đá',
    description: 'Cà phê phin đậm đà',
    price: 25000,
    available: 80,
    sold: 342,
    emoji: '☕',
    imageGradient: 'linear-gradient(135deg, #78350f, #1c1917)',
  },
  {
    id: 'm6',
    categoryId: 'c4',
    name: 'Bánh flan',
    description: 'Mềm mịn, caramel',
    price: 20000,
    available: 18,
    sold: 77,
    emoji: '🍮',
    imageGradient: 'linear-gradient(135deg, #fbbf24, #92400e)',
  },
];

export const tables: DiningTable[] = [
  { id: 't1', name: 'Bàn 1', seats: 2, status: 'available', size: 'small', zone: 'Tầng 1' },
  { id: 't2', name: 'Bàn 2', seats: 4, status: 'occupied', size: 'large', zone: 'Tầng 1' },
  { id: 't3', name: 'Bàn 3', seats: 4, status: 'reserved', size: 'large', zone: 'Tầng 1' },
  { id: 't4', name: 'Bàn 4', seats: 2, status: 'available', size: 'small', zone: 'Tầng 1' },
  { id: 't5', name: 'Bàn 5', seats: 6, status: 'occupied', size: 'large', zone: 'Sân vườn' },
  { id: 't6', name: 'Bàn 6', seats: 2, status: 'available', size: 'small', zone: 'Sân vườn' },
  { id: 't7', name: 'VIP 1', seats: 8, status: 'reserved', size: 'large', zone: 'Phòng VIP' },
  { id: 't8', name: 'VIP 2', seats: 8, status: 'available', size: 'large', zone: 'Phòng VIP' },
];

export const orders: Order[] = [
  {
    id: 'o1',
    code: 'DH-0012',
    customerName: 'Khách bàn 2',
    tableId: 't2',
    tableName: 'Bàn 2',
    items: [
      { menuItemId: 'm1', name: 'Phở bò tái', price: 65000, quantity: 2 },
      { menuItemId: 'm5', name: 'Cà phê sữa đá', price: 25000, quantity: 2 },
    ],
    subtotal: 180000,
    tax: 18000,
    total: 198000,
    status: 'preparing',
    mode: 'dine-in',
    createdAt: '2026-07-20T10:15:00.000Z',
    updatedAt: '2026-07-20T10:20:00.000Z',
  },
  {
    id: 'o2',
    code: 'DH-0013',
    customerName: 'Khách bàn 5',
    tableId: 't5',
    tableName: 'Bàn 5',
    items: [{ menuItemId: 'm2', name: 'Cơm gà xối mỡ', price: 55000, quantity: 3 }],
    subtotal: 165000,
    tax: 16500,
    total: 181500,
    status: 'ready',
    mode: 'dine-in',
    createdAt: '2026-07-20T10:30:00.000Z',
    updatedAt: '2026-07-20T10:40:00.000Z',
  },
];

export const bills: Bill[] = [
  {
    id: 'b1',
    code: 'HD-0009',
    orderId: 'o0',
    customerName: 'Khách lẻ',
    tableName: 'Bàn 1',
    tableCode: 't1',
    items: [{ menuItemId: 'm4', name: 'Trà đào cam sả', price: 30000, quantity: 2 }],
    subtotal: 60000,
    tax: 6000,
    total: 66000,
    paymentMethod: 'cash',
    paidAt: '2026-07-20T09:50:00.000Z',
  },
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
