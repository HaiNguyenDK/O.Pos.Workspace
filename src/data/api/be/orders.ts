// src/data/api/be/orders.ts — bàn + đơn tại bàn trên BE (passiontech-restaurant). Cờ: `orders`.
// SDL đề xuất: docs/pos/pos-be-api-request.md Mục 3.1. BE CHƯA làm — chỉ bật cờ khi BE đã deploy.
// Tên kiểu input (…GqlInput) theo quy ước BE hiện có (vd PaymentServiceCreatePaymentGqlInput).
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import { currentBranchId, money, opt } from '@/data/api/be/common';
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

// ── Kiểu BE (Mục 3.1) ──

export type BeRestaurantTable = {
  id: string;
  branchId: string;
  name: string;
  zone: string;
  seats: number;
  size: TableSize;
  status: TableStatus;
  currentOrderId?: string | null;
};

// ⏳ chờ BE xác nhận tên/field: PosLineModifier và VoidInfo chưa có định nghĩa trong SDL đề xuất —
// dùng đúng tên field của contract (LineModifier, OrderLine.voided).
type BeLineModifier = { optionId: string; name: string; priceDelta: number };
type BeVoidInfo = { reason: string; by: string; approvedBy?: string | null; at: string };

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
  mode: ServiceMode;
  guests?: number | null;
  status: OrderStatus;
  lines?: BePosOrderLine[] | null;
  version: number;
  mergedIntoOrderId?: string | null;
  openedBy: string;
  createdAt: string;
  updatedAt: string;
};

// ── Tài liệu GraphQL ──

const TABLE_FIELDS = 'id branchId name zone seats size status currentOrderId';

export const ORDER_FIELDS = `
  id code branchId tableId tableName customerName note mode guests status version mergedIntoOrderId openedBy createdAt updatedAt
  lines {
    id menuItemId name unitPrice quantity note lineTotal status firedAt
    modifiers { optionId name priceDelta }
    voided { reason by approvedBy at }
  }
`;

export const TABLES_QUERY = /* GraphQL */ `
  query PosTables($branchId: ID!) {
    restaurantServiceTables(branchId: $branchId) { ${TABLE_FIELDS} }
  }
`;

export const RUNNING_ORDERS_QUERY = /* GraphQL */ `
  query PosRunningOrders($branchId: ID!) {
    restaurantServiceRunningOrders(branchId: $branchId) { ${ORDER_FIELDS} }
  }
`;

export const ORDER_QUERY = /* GraphQL */ `
  query PosOrder($id: ID!) {
    restaurantServicePosOrder(id: $id) { ${ORDER_FIELDS} }
  }
`;

// ⏳ chờ BE xác nhận tên/field: tên kiểu input (SDL đề xuất viết input inline).
export const OPEN_ORDER = /* GraphQL */ `
  mutation PosOpenOrder($input: RestaurantServiceOpenOrderGqlInput!) {
    restaurantServiceOpenOrder(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const ADD_LINES = /* GraphQL */ `
  mutation PosAddLines($input: RestaurantServiceAddLinesGqlInput!) {
    restaurantServiceAddLines(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const VOID_LINE = /* GraphQL */ `
  mutation PosVoidLine($input: RestaurantServiceVoidLineGqlInput!) {
    restaurantServiceVoidLine(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const MOVE_ORDER = /* GraphQL */ `
  mutation PosMoveOrder($input: RestaurantServiceMoveOrderGqlInput!) {
    restaurantServiceMoveOrder(input: $input) { ${ORDER_FIELDS} }
  }
`;

export const MERGE_ORDERS = /* GraphQL */ `
  mutation PosMergeOrders($input: RestaurantServiceMergeOrdersGqlInput!) {
    restaurantServiceMergeOrders(input: $input) { ${ORDER_FIELDS} }
  }
`;

// ── Ánh xạ BE → contract ──

export function toTable(t: BeRestaurantTable): DiningTable {
  return {
    id: t.id,
    branchId: t.branchId,
    name: t.name,
    zone: t.zone,
    seats: t.seats,
    size: t.size,
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
    voided: l.voided
      ? { reason: l.voided.reason, by: l.voided.by, approvedBy: opt(l.voided.approvedBy), at: l.voided.at }
      : undefined,
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
    mode: o.mode,
    guests: opt(o.guests),
    note: opt(o.note),
    status: o.status,
    lines: (o.lines ?? []).map(toOrderLine),
    version: o.version,
    mergedIntoOrderId: opt(o.mergedIntoOrderId),
    openedBy: o.openedBy,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

const looksLikeOrder = (v: unknown): v is BePosOrder =>
  !!v && typeof v === 'object' && 'id' in v && 'version' in v && 'status' in v;

/**
 * VERSION_CONFLICT trả kèm đơn mới nhất trong extensions (Mục 3.1) → đổi sang Order contract,
 * để UI hiển thị lại giống mock (`data.order`).
 */
export async function withConflictOrder<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isPosApiError(e) && e.code === 'VERSION_CONFLICT' && looksLikeOrder(e.data?.order)) {
      throw new PosApiError(e.code, e.message, { ...e.data, order: toOrder(e.data.order) });
    }
    throw e;
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

  /** SDL không có query theo bàn → lọc từ RunningOrders của chi nhánh. */
  async getRunningOrder(tableId) {
    const orders = await fetchRunningOrders();
    return orders.find((o) => o.tableId === tableId) ?? null;
  },

  async getOrder(orderId) {
    const data = await gql<{ restaurantServicePosOrder: BePosOrder | null }>(ORDER_QUERY, { id: orderId });
    if (!data.restaurantServicePosOrder) throw new PosApiError('NOT_FOUND', 'Không tìm thấy đơn');
    return toOrder(data.restaurantServicePosOrder);
  },

  async openOrder(input) {
    const data = await gql<{ restaurantServiceOpenOrder: BePosOrder }>(OPEN_ORDER, {
      input: {
        idempotencyKey: input.idempotencyKey,
        branchId: currentBranchId(),
        tableId: input.tableId,
        mode: input.mode,
        guests: input.guests,
        customerName: input.customerName,
        note: input.note,
      },
    });
    return toOrder(data.restaurantServiceOpenOrder);
  },

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

  async moveOrder(input) {
    const data = await withConflictOrder(
      gql<{ restaurantServiceMoveOrder: BePosOrder }>(MOVE_ORDER, {
        input: {
          idempotencyKey: input.idempotencyKey,
          orderId: input.orderId,
          toTableId: input.toTableId,
          expectedVersion: input.expectedVersion,
        },
      })
    );
    return toOrder(data.restaurantServiceMoveOrder);
  },

  async mergeOrders(input) {
    const data = await withConflictOrder(
      gql<{ restaurantServiceMergeOrders: BePosOrder }>(MERGE_ORDERS, {
        input: {
          idempotencyKey: input.idempotencyKey,
          primaryOrderId: input.primaryOrderId,
          sourceOrderIds: input.sourceOrderIds,
          expectedVersions: input.expectedVersions,
        },
      })
    );
    return toOrder(data.restaurantServiceMergeOrders);
  },
} satisfies Pick<
  PosApi,
  'listTables' | 'getRunningOrders' | 'getRunningOrder' | 'getOrder' | 'openOrder' | 'addLines' | 'voidLine' | 'moveOrder' | 'mergeOrders'
>;
