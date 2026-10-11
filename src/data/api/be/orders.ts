// src/data/api/be/orders.ts — bàn + đơn tại bàn trên BE (passiontech-restaurant). Cờ: `orders`.
// Schema thật: apps/passiontech-restaurant/internal/handler/graphql/{table,pos_order}.graphqls @ bb3e223c6.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { currentBranchId, money, opt, type BeStaffRef } from '@/data/api/be/common';
import {
  isPosApiError,
  PosApiError,
  type DiningTable,
  type LineStatus,
  type Order,
  type OrderLine,
  type OrderStatus,
  type ServiceMode,
  type TableSize,
  type TableStatus,
} from '@/data/types';

// ── Kiểu BE ──

export type BeServiceMode = 'DINE_IN' | 'TAKEAWAY';
export type BeTableSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export type BeRestaurantTable = {
  id: string;
  branchId: string;
  name: string;
  zone: string;
  seats: number;
  size: BeTableSize;
  status: TableStatus;
  currentOrderId?: string | null;
};

type BeLineModifier = { optionId: string; name: string; priceDelta: number };
/** PosServiceVoidInfo — BE không có approvedBy (người duyệt chỉ nằm trong audit của approval). */
type BeVoidInfo = { reason: string; by: BeStaffRef; at: string };

export type BePosOrderLine = {
  id: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  modifiers?: BeLineModifier[] | null;
  quantity: number;
  note?: string | null;
  lineTotal: number;
  status: LineStatus;
  firedAt: string;
  voided?: BeVoidInfo | null;
};

export type BePosOrder = {
  id: string;
  code: string;
  branchId: string;
  tableId?: string | null;
  tableName?: string | null;
  customerName?: string | null;
  note?: string | null;
  mode: BeServiceMode;
  guests?: number | null;
  status: OrderStatus;
  lines?: BePosOrderLine[] | null;
  version: number;
  mergedIntoOrderId?: string | null;
  openedBy: BeStaffRef;
  createdAt: string;
  updatedAt: string;
};

// ── Tài liệu GraphQL ──

const TABLE_FIELDS = 'id branchId name zone seats size status currentOrderId';

export const ORDER_FIELDS = `
  id code branchId tableId tableName customerName note mode guests status version mergedIntoOrderId createdAt updatedAt
  openedBy { id name }
  lines {
    id menuItemId name unitPrice quantity note lineTotal status firedAt
    modifiers { optionId name priceDelta }
    voided { reason at by { id name } }
  }
`;

export const TABLES_QUERY = /* GraphQL */ `
  query PosTables($branchId: String!) {
    restaurantServiceTables(branchId: $branchId) { ${TABLE_FIELDS} }
  }
`;

export const RUNNING_ORDERS_QUERY = /* GraphQL */ `
  query PosRunningOrders($branchId: String!) {
    restaurantServiceRunningOrders(branchId: $branchId) { ${ORDER_FIELDS} }
  }
`;

export const ORDER_QUERY = /* GraphQL */ `
  query PosOrder($id: ID!) {
    restaurantServicePosOrder(id: $id) { ${ORDER_FIELDS} }
  }
`;

export const OPEN_ORDER = /* GraphQL */ `
  mutation PosOpenOrder($input: RestaurantServiceOpenOrderInput!) {
    restaurantServiceOpenOrder(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const ADD_LINES = /* GraphQL */ `
  mutation PosAddLines($input: RestaurantServiceAddLinesInput!) {
    restaurantServiceAddLines(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const VOID_LINE = /* GraphQL */ `
  mutation PosVoidLine($input: RestaurantServiceVoidLineInput!) {
    restaurantServiceVoidLine(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const MOVE_ORDER = /* GraphQL */ `
  mutation PosMoveOrder($input: RestaurantServiceMoveOrderInput!) {
    restaurantServiceMoveOrder(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const MERGE_ORDERS = /* GraphQL */ `
  mutation PosMergeOrders($input: RestaurantServiceMergeOrdersInput!) {
    restaurantServiceMergeOrders(input: $input) { ${ORDER_FIELDS} }
  }
`;

// ── Ánh xạ BE ↔ contract ──

export const toServiceMode = (m: BeServiceMode | string): ServiceMode => (m === 'TAKEAWAY' ? 'TAKE_AWAY' : 'DINE_IN');
export const toBeServiceMode = (m: ServiceMode): BeServiceMode => (m === 'TAKE_AWAY' ? 'TAKEAWAY' : 'DINE_IN');

/**
 * TableSize BE có thêm MEDIUM; contract chỉ SMALL | LARGE (pos-plan 3.1). MEDIUM → LARGE:
 * trong mock bàn 4 chỗ đã là LARGE, SMALL chỉ dành cho bàn 2 chỗ → MEDIUM gần LARGE hơn.
 */
export const toTableSize = (s: BeTableSize | string): TableSize => (s === 'SMALL' ? 'SMALL' : 'LARGE');

export function toTable(t: BeRestaurantTable): DiningTable {
  return {
    id: t.id,
    branchId: t.branchId,
    name: t.name,
    zone: t.zone,
    seats: t.seats,
    size: toTableSize(t.size),
    status: t.status,
    currentOrderId: opt(t.currentOrderId),
  };
}

export function toOrderLine(l: BePosOrderLine): OrderLine {
  return {
    id: l.id,
    menuItemId: l.menuItemId,
    name: l.name,
    unitPrice: money(l.unitPrice),
    modifiers: (l.modifiers ?? []).map((m) => ({ optionId: m.optionId, name: m.name, priceDelta: money(m.priceDelta) })),
    quantity: l.quantity,
    note: opt(l.note),
    lineTotal: money(l.lineTotal),
    status: l.status,
    firedAt: l.firedAt,
    // Contract lưu id người huỷ (giống mock); BE không trả approvedBy.
    voided: l.voided ? { reason: l.voided.reason, by: l.voided.by.id, at: l.voided.at } : undefined,
  };
}

export function toOrder(o: BePosOrder): Order {
  return {
    id: o.id,
    code: o.code,
    branchId: o.branchId,
    tableId: opt(o.tableId),
    tableName: opt(o.tableName),
    customerName: opt(o.customerName),
    mode: toServiceMode(o.mode),
    guests: opt(o.guests),
    note: opt(o.note),
    status: o.status,
    lines: (o.lines ?? []).map(toOrderLine),
    version: o.version,
    mergedIntoOrderId: opt(o.mergedIntoOrderId),
    openedBy: o.openedBy.id,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function fetchOrder(orderId: string): Promise<Order | null> {
  const data = await gql<{ restaurantServicePosOrder: BePosOrder | null }>(ORDER_QUERY, { id: orderId });
  return data.restaurantServicePosOrder ? toOrder(data.restaurantServicePosOrder) : null;
}

/**
 * VERSION_CONFLICT (212702) của BE chỉ kèm `latestVersion` (⚠️ BE bug #17 be-review-2026-10-11) → đọc lại
 * restaurantServicePosOrder để đưa đơn mới nhất vào `data.order` như mock/contract. `candidates`: các đơn có thể
 * lệch version kèm version client đang giữ; chọn đơn đầu tiên đã đổi version, không xác định được thì lấy đơn cuối danh sách.
 * Đọc lại lỗi → ném lỗi gốc (vẫn có latestVersion).
 */
export async function withConflictOrder<T>(p: Promise<T>, candidates: { id: string; expectedVersion?: number }[]): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (!isPosApiError(e) || e.code !== 'VERSION_CONFLICT' || candidates.length === 0) throw e;
    let order: Order | null = null;
    try {
      const fresh = await Promise.all(candidates.map((c) => fetchOrder(c.id)));
      const idx = candidates.findIndex((c, i) => fresh[i] && c.expectedVersion !== undefined && fresh[i]!.version !== c.expectedVersion);
      order = fresh[idx >= 0 ? idx : fresh.length - 1];
    } catch {
      throw e;
    }
    if (!order) throw e;
    throw new PosApiError(e.code, e.message, { ...e.data, order });
  }
}

async function fetchRunningOrders(): Promise<Order[]> {
  const data = await gql<{ restaurantServiceRunningOrders: BePosOrder[] }>(RUNNING_ORDERS_QUERY, {
    branchId: currentBranchId(),
  });
  return data.restaurantServiceRunningOrders.map(toOrder);
}

// ── PosApi ──

export const beOrdersApi = {
  async listTables() {
    const data = await gql<{ restaurantServiceTables: BeRestaurantTable[] }>(TABLES_QUERY, { branchId: currentBranchId() });
    return data.restaurantServiceTables.map(toTable);
  },

  getRunningOrders: fetchRunningOrders,

  /** BE không có query theo bàn → lọc từ RunningOrders của chi nhánh. */
  async getRunningOrder(tableId) {
    const orders = await fetchRunningOrders();
    return orders.find((o) => o.tableId === tableId) ?? null;
  },

  async getOrder(orderId) {
    const order = await fetchOrder(orderId);
    if (!order) throw new PosApiError('NOT_FOUND', 'Không tìm thấy đơn');
    return order;
  },

  async openOrder(input) {
    const data = await gql<{ restaurantServiceOpenOrder: BePosOrder }>(OPEN_ORDER, {
      input: {
        idempotencyKey: input.idempotencyKey,
        branchId: currentBranchId(),
        tableId: input.tableId,
        mode: toBeServiceMode(input.mode),
        guests: input.guests,
        customerName: input.customerName,
        note: input.note,
      },
    });
    return toOrder(data.restaurantServiceOpenOrder);
  },

  // ⚠️ BE bug #3 (be-review-2026-10-11): thêm/huỷ món khi đơn BILLING không huỷ/tính lại bill OPEN cũ.
  // ⚠️ BE bug #4: món nhiều variant chỉ lấy variant đầu; option id lạ được nhận với 0đ.
  async addLines(input) {
    const data = await gql<{ restaurantServiceAddLines: BePosOrder }>(ADD_LINES, {
      input: {
        idempotencyKey: input.idempotencyKey,
        orderId: input.orderId,
        lines: input.lines.map((l) => ({
          lineId: l.lineId,
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          modifierOptionIds: l.modifierOptionIds,
          note: l.note,
        })),
      },
    });
    return toOrder(data.restaurantServiceAddLines);
  },

  // ⚠️ BE bug #16: idempotencyKey được nhận nhưng không dùng — retry sau khi đã huỷ trả lỗi thay vì kết quả cũ.
  // ⚠️ BE bug #18: BE cho huỷ cả món đã SERVED (contract: chỉ trước SERVED) — UI vẫn chặn theo contract.
  async voidLine(input) {
    const data = await gql<{ restaurantServiceVoidLine: BePosOrder }>(VOID_LINE, {
      input: {
        idempotencyKey: input.idempotencyKey,
        orderId: input.orderId,
        lineId: input.lineId,
        reason: input.reason,
        approvalToken: input.approvalToken,
      },
    });
    return toOrder(data.restaurantServiceVoidLine);
  },

  // ⚠️ BE bug #15: mọi thao tác KDS tăng version đơn → chuyển bàn hay gặp VERSION_CONFLICT. ⚠️ BE bug #16 (idempotency).
  async moveOrder(input) {
    const data = await withConflictOrder(
      gql<{ restaurantServiceMoveOrder: BePosOrder }>(MOVE_ORDER, {
        input: {
          idempotencyKey: input.idempotencyKey,
          orderId: input.orderId,
          toTableId: input.toTableId,
          expectedVersion: input.expectedVersion,
        },
      }),
      [{ id: input.orderId, expectedVersion: input.expectedVersion }]
    );
    return toOrder(data.restaurantServiceMoveOrder);
  },

  // ⚠️ BE bug #16 (idempotency key không dùng).
  async mergeOrders(input) {
    const data = await withConflictOrder(
      gql<{ restaurantServiceMergeOrders: BePosOrder }>(MERGE_ORDERS, {
        input: {
          idempotencyKey: input.idempotencyKey,
          primaryOrderId: input.primaryOrderId,
          sourceOrderIds: input.sourceOrderIds,
          expectedVersions: input.expectedVersions,
        },
      }),
      // expectedVersions khớp thứ tự sourceOrderIds (BE pos_order_usecase MergeOrders); không đổi được → đơn chính.
      [
        ...input.sourceOrderIds.map((id, i) => ({ id, expectedVersion: input.expectedVersions[i] })),
        { id: input.primaryOrderId },
      ]
    );
    return toOrder(data.restaurantServiceMergeOrders);
  },
} satisfies Pick<
  PosApi,
  'listTables' | 'getRunningOrders' | 'getRunningOrder' | 'getOrder' | 'openOrder' | 'addLines' | 'voidLine' | 'moveOrder' | 'mergeOrders'
>;
