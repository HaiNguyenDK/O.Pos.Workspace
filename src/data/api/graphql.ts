// src/data/api/graphql.ts — PosApi trên BE passiontech (GraphQL federation).
// Menu + chi nhánh luôn gọi BE thật. Các nhóm POS (đơn, bill, thanh toán, duyệt, PIN, ca, thông báo) có adapter
// theo shape thật của BE @ 4f4594354 ở data/api/be/* — chỉ gọi thật khi nhóm được bật trong EXPO_PUBLIC_BE_FEATURES,
// còn lại chạy mock. Xem docs/pos/be-review-2026-10-11.md. BE deploy nhóm nào → bật cờ, không sửa màn hình.
import { beApprovalsApi } from '@/data/api/be/approvals';
import { beBillsApi } from '@/data/api/be/bills';
import { beNotificationsApi } from '@/data/api/be/notifications';
import { beOrdersApi } from '@/data/api/be/orders';
import { bePaymentsApi } from '@/data/api/be/payments';
import { bePinApi } from '@/data/api/be/pin';
import { beShiftsApi } from '@/data/api/be/shifts';
import { apiConfig, type BeFeature } from '@/data/api/config';
import { gql } from '@/data/api/graphql-client';
import { mockPosApi, registerMenu } from '@/data/api/mock';
import { apiSession } from '@/data/api/session';
import { terminalSession } from '@/data/api/terminal';
import type { PosApi } from '@/data/api/PosApi';
import * as db from '@/data/mocks';
import { currentBranchId } from '@/data/api/be/common';
import {
  PosApiError,
  type Branch,
  type MenuCategory,
  type MenuItem,
  type ModifierGroup,
  type Station,
} from '@/data/types';

// ── Kiểu dữ liệu BE (chỉ các field dùng tới) ──

type BeCategory = {
  id: string;
  children?: BeCategory[] | null;
  name: string;
  type?: 'Product' | 'Service' | null;
  isEnabled: boolean;
  isDeleted: boolean;
  displayOrder: number;
};

type BeVariant = { name?: string | null; sku: string; price: number; isEnabled: boolean; isAvailable: boolean };

export type BeProduct = {
  id: string;
  title: string;
  categoryIds: string[];
  description?: string | null;
  shortDescription?: string | null;
  thumbnailUrl?: string | null;
  mediaUrls?: string[] | null;
  variants?: BeVariant[] | null;
  currency: 'VND' | 'USD';
  isEnabled: boolean;
  isDeleted: boolean;
  displayOrder: number;
};

type BeBranch = { id: string; name: string; address: string; status: string };

type BeBranchSettings = { taxRate: number; pricesIncludeTax: boolean; serviceChargeRate: number; cashRounding: number };
type BeBranchV2 = BeBranch & { phoneNumber?: string | null; settings?: BeBranchSettings | null };

/** productServiceMenu (cờ `menu-v2`) — product subgraph @ 4f4594354 (updatedSince/version = epoch giây). */
type BeMenuVariant = { name?: string | null; sku: string; priceVnd: number; isEnabled: boolean; isAvailable: boolean };
type BeModifierGroup = {
  id: string;
  name: string;
  min: number;
  max: number;
  options: { id: string; name: string; priceDelta: number }[];
};
export type BeMenuProduct = {
  id: string;
  title: string;
  type?: 'PRODUCT' | 'SERVICE' | null;
  categoryIds: string[];
  description?: string | null;
  shortDescription?: string | null;
  thumbnailUrl?: string | null;
  mediaUrls?: string[] | null;
  currency: 'VND' | 'USD';
  isEnabled: boolean;
  isDeleted: boolean;
  displayOrder: number;
  station?: string | null;
  /** Đã áp cờ còn/hết theo chi nhánh (productServiceSetAvailability). */
  isAvailable: boolean;
  modifierGroups?: BeModifierGroup[] | null;
  variants?: BeMenuVariant[] | null;
};

// Bản public: `categoryServiceAllCategories` cần quyền cấp tổ chức, tài khoản tenant bị 100008.
const CATEGORIES_QUERY = /* GraphQL */ `
  query PosCategories {
    categoryServicePublicCategories {
      id name type isEnabled isDeleted displayOrder
      children {
        id name type isEnabled isDeleted displayOrder
        children { id name type isEnabled isDeleted displayOrder }
      }
    }
  }
`;

const BRANCHES_QUERY = /* GraphQL */ `
  query PosBranches($input: EntityServiceListBranchesGqlInput!) {
    entityServiceListBranches(input: $input) { id name address status }
  }
`;

/** Món có danh mục không đọc được / đã ẩn. */
export const OTHER_CATEGORY: MenuCategory = { id: 'other', name: 'Khác', sortOrder: 9999 };

const PRODUCTS_QUERY = /* GraphQL */ `
  query PosProducts($input: ProductServiceSearchProductGqlInput!, $pagination: PaginationArgs!) {
    productServiceSearchProducts(input: $input, pagination: $pagination) {
      id title categoryIds description shortDescription thumbnailUrl mediaUrls currency
      isEnabled isDeleted displayOrder
      variants { name sku price isEnabled isAvailable }
    }
  }
`;

const BRANCH_QUERY = /* GraphQL */ `
  query PosBranch($id: String!) {
    entityServiceBranchById(id: $id) { id name address status }
  }
`;

// Cờ `branch-settings`: Branch.phoneNumber + settings (entity @ 4f4594354) — đã lên gateway ogw (2026-10-12).
export const BRANCH_QUERY_V2 = /* GraphQL */ `
  query PosBranchV2($id: String!) {
    entityServiceBranchById(id: $id) {
      id name address status phoneNumber
      settings { taxRate pricesIncludeTax serviceChargeRate cashRounding }
    }
  }
`;

// Cờ `menu-v2`: menu POS theo chi nhánh (modifierGroups, station, priceVnd, còn/hết theo chi nhánh).
// Không gửi updatedSince → luôn lấy đủ (removedIds chỉ có ý nghĩa khi lấy delta).
export const MENU_V2_QUERY = /* GraphQL */ `
  query PosMenuV2($branchId: String!) {
    productServiceMenu(branchId: $branchId) {
      version
      items {
        id title type categoryIds description shortDescription thumbnailUrl mediaUrls currency
        isEnabled isDeleted displayOrder station isAvailable
        modifierGroups { id name min max options { id name priceDelta } }
        variants { name sku priceVnd isEnabled isAvailable }
      }
    }
  }
`;

const PAGE = 100; // BE giới hạn 1–100 mỗi trang

// ── Ánh xạ BE → contract ──

/**
 * Product BE → MenuItem.
 * - Giá BE là Float → làm tròn tới đồng (D4). Chỉ nhận VND.
 * - Nhiều variant (SKU) → nhóm modifier "Loại" bắt buộc chọn 1, giá base = variant rẻ nhất, priceDelta = chênh lệch.
 * - BE chưa có modifier/station (pos-be-api-request 3.5) → station KITCHEN, không có nhóm modifier khác.
 */
export function toMenuItem(p: BeProduct, categoryIds: Set<string>): MenuItem | null {
  if (p.isDeleted || p.currency !== 'VND') return null;
  const variants = (p.variants ?? []).filter((v) => v.isEnabled);
  if (variants.length === 0) return null;
  const prices = variants.map((v) => Math.round(v.price));
  const base = Math.min(...prices);
  const groups: ModifierGroup[] =
    variants.length > 1
      ? [
          {
            id: `variant:${p.id}`,
            name: 'Loại',
            min: 1,
            max: 1,
            options: variants.map((v, i) => ({ id: `sku:${v.sku}`, name: v.name || v.sku, priceDelta: prices[i] - base })),
          },
        ]
      : [];
  return {
    id: p.id,
    categoryId: p.categoryIds.find((c) => categoryIds.has(c)) ?? p.categoryIds[0] ?? '',
    name: p.title,
    description: p.shortDescription ?? p.description ?? undefined,
    price: base,
    isAvailable: p.isEnabled && variants.some((v) => v.isAvailable),
    station: 'KITCHEN',
    modifierGroups: groups,
    imageUrl: p.thumbnailUrl ?? p.mediaUrls?.[0] ?? undefined,
  };
}

const STATIONS: Station[] = ['KITCHEN', 'GRILL', 'COLD', 'BAR', 'DESSERT'];
export const toStation = (s: string | null | undefined): Station => {
  const v = (s ?? '').trim().toUpperCase() as Station;
  return STATIONS.includes(v) ? v : 'KITCHEN';
};

/**
 * Món của productServiceMenu (cờ `menu-v2`) → MenuItem. Khác bản cũ:
 * - modifierGroups/station lấy từ BE.
 * - Giá theo priceVnd (BE AddLines tính bằng cùng công thức làm tròn — BE-24).
 * - Size (BE câu hỏi 1, PR #800): AddLines nhận `variantId` = SKU, bắt buộc khi > 1 variant đang bật.
 *   Contract không có variant → > 1 variant: nhóm "Loại" (min 1, max 1) đứng đầu, option id `sku:<sku>`,
 *   giá món = variant rẻ nhất, priceDelta = chênh lệch; be/orders.ts tách option này thành variantId.
 *   1 variant: không sinh nhóm, BE tự lấy variant đó.
 * - Chỉ món type PRODUCT (type null coi như PRODUCT, giống toCategories) đang bật, chưa xoá, VND.
 */
export function toMenuItemV2(p: BeMenuProduct, categoryIds: Set<string>): MenuItem | null {
  if (p.isDeleted || !p.isEnabled || (p.type ?? 'PRODUCT') !== 'PRODUCT' || p.currency !== 'VND') return null;
  const enabled = (p.variants ?? []).filter((v) => v.isEnabled);
  if (enabled.length === 0) return null;
  // Size hết ở chi nhánh không được chọn; hết cả → vẫn liệt kê (món đã isAvailable=false).
  const sellable = enabled.filter((v) => v.isAvailable);
  const pool = sellable.length > 0 ? sellable : enabled;
  const prices = pool.map((v) => Math.round(v.priceVnd));
  const base = Math.min(...prices);
  // BE bắt buộc variantId khi > 1 variant đang BẬT (kể cả khi chỉ còn 1 size bán được) → vẫn sinh nhóm.
  const sizeGroup: ModifierGroup[] =
    enabled.length > 1
      ? [
          {
            id: `variant:${p.id}`,
            name: 'Loại',
            min: 1,
            max: 1,
            options: pool.map((v, i) => ({ id: `sku:${v.sku}`, name: v.name || v.sku, priceDelta: prices[i] - base })),
          },
        ]
      : [];
  return {
    id: p.id,
    categoryId: p.categoryIds.find((c) => categoryIds.has(c)) ?? p.categoryIds[0] ?? '',
    name: p.title,
    description: p.shortDescription ?? p.description ?? undefined,
    price: base,
    isAvailable: p.isAvailable && enabled.some((v) => v.isAvailable),
    station: toStation(p.station),
    modifierGroups: sizeGroup.concat(
      (p.modifierGroups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      min: g.min,
      max: g.max,
        options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: Math.round(o.priceDelta) })),
      }))
    ),
    imageUrl: p.thumbnailUrl ?? p.mediaUrls?.[0] ?? undefined,
  };
}

/** Làm phẳng cây danh mục BE. */
export function flattenCategories(tree: BeCategory[]): BeCategory[] {
  const flat: BeCategory[] = [];
  const walk = (nodes?: BeCategory[] | null) => {
    for (const n of nodes ?? []) {
      flat.push(n);
      walk(n.children);
    }
  };
  walk(tree);
  return flat;
}

export function toCategories(tree: BeCategory[]): MenuCategory[] {
  return flattenCategories(tree)
    .filter((c) => c.isEnabled && !c.isDeleted && (c.type ?? 'Product') === 'Product')
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c) => ({ id: c.id, name: c.name, sortOrder: c.displayOrder }));
}

/** Cờ `menu-v2`: 1 lần gọi trả cả menu của chi nhánh. */
async function fetchMenuV2(): Promise<BeMenuProduct[]> {
  const data = await gql<{ productServiceMenu: { items: BeMenuProduct[] } }>(MENU_V2_QUERY, { branchId: currentBranchId() });
  return [...data.productServiceMenu.items].sort((a, b) => a.displayOrder - b.displayOrder);
}

async function fetchAllProducts(): Promise<BeProduct[]> {
  const out: BeProduct[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const data = await gql<{ productServiceSearchProducts: BeProduct[] }>(PRODUCTS_QUERY, {
      input: { isEnabled: true, type: 'PRODUCT' },
      // BE đang chạy chưa nhận `pagination.sort` (VALIDATION_INVALID_TYPE_VARIABLE) → sắp xếp ở FE.
      pagination: { skip, limit: PAGE },
    });
    out.push(...data.productServiceSearchProducts);
    if (data.productServiceSearchProducts.length < PAGE) return out.sort((a, b) => a.displayOrder - b.displayOrder);
  }
}

/**
 * Bọc 1 thao tác: lúc GỌI mới xét cờ → nhóm bật thì gọi BE thật, tắt thì gọi mock.
 * (Xét lúc gọi để script verify đổi cờ khi chạy; app đọc cờ từ env 1 lần lúc khởi động.)
 */
function gate<K extends keyof PosApi>(feature: BeFeature, key: K, real: PosApi[K]): PosApi[K] {
  const call = (...args: unknown[]) => {
    const impl = (apiConfig.beFeatures.has(feature) ? real : mockPosApi[key]) as (...a: unknown[]) => unknown;
    return impl(...args);
  };
  return call as PosApi[K];
}

function gateAll<K extends keyof PosApi>(feature: BeFeature, real: Pick<PosApi, K>): Pick<PosApi, K> {
  const out = {} as Pick<PosApi, K>;
  for (const key of Object.keys(real) as K[]) out[key] = gate(feature, key, real[key]);
  return out;
}

/** Nhóm cờ → các thao tác PosApi (đối chiếu pos-be-api-request Mục 3). */
export const BE_FEATURE_OPS: Record<BeFeature, (keyof PosApi)[]> = {
  orders: Object.keys(beOrdersApi) as (keyof PosApi)[],
  bills: Object.keys(beBillsApi) as (keyof PosApi)[],
  payments: Object.keys(bePaymentsApi) as (keyof PosApi)[],
  approvals: Object.keys(beApprovalsApi) as (keyof PosApi)[],
  pin: Object.keys(bePinApi) as (keyof PosApi)[],
  shifts: Object.keys(beShiftsApi) as (keyof PosApi)[],
  notifications: Object.keys(beNotificationsApi) as (keyof PosApi)[],
  // Hai cờ dưới không thay op bằng mock — chỉ đổi đường gọi BE bên trong getMenu / me.
  'menu-v2': ['getMenu'],
  'branch-settings': ['me'],
};

export const graphqlPosApi: PosApi = {
  // Mặc định mock; lookupCustomer (P1, membershipServiceLookupByPhone) chưa có nhóm cờ.
  ...mockPosApi,
  ...gateAll('orders', beOrdersApi),
  ...gateAll('bills', beBillsApi),
  ...gateAll('payments', bePaymentsApi),
  ...gateAll('approvals', beApprovalsApi),
  ...gateAll('pin', bePinApi),
  ...gateAll('shifts', beShiftsApi),
  ...gateAll('notifications', beNotificationsApi),

  async getMenu() {
    const v2 = apiConfig.beFeatures.has('menu-v2');
    const [cats, products] = await Promise.all([
      // Không đọc được danh mục thì vẫn bán được: mọi món vào "Khác".
      gql<{ categoryServicePublicCategories: BeCategory[] }>(CATEGORIES_QUERY).catch(() => null),
      v2 ? fetchMenuV2() : fetchAllProducts(),
    ]);
    const mapItem = (p: BeProduct | BeMenuProduct, known: Set<string>) =>
      v2 ? toMenuItemV2(p as BeMenuProduct, known) : toMenuItem(p as BeProduct, known);
    const tree = cats?.categoryServicePublicCategories ?? [];
    const known = toCategories(tree);
    const ids = new Set(known.map((c) => c.id));
    // Danh mục có trong cây nhưng bị loại (dịch vụ/tắt/xoá) → bỏ món; id lạ (không có trong cây) → "Khác".
    const excluded = new Set(flattenCategories(tree).map((c) => c.id).filter((id) => !ids.has(id)));
    const items = (products as (BeProduct | BeMenuProduct)[])
      .map((p) => mapItem(p, ids))
      .filter((x): x is MenuItem => !!x && !excluded.has(x.categoryId))
      .map((x) => (ids.has(x.categoryId) ? x : { ...x, categoryId: OTHER_CATEGORY.id }));
    const used = new Set(items.map((x) => x.categoryId));
    const categories = [...known, OTHER_CATEGORY].filter((c) => used.has(c.id));
    registerMenu(items); // đơn/bếp còn chạy mock → mock phải nhận được món thật
    return { categories, items };
  },

  async me() {
    const session = apiSession.get();
    if (!session) throw new PosApiError('UNAUTHENTICATED', 'Phiên đăng nhập đã hết, vui lòng nhập PIN');
    const branchId = terminalSession.get()?.branchId || apiConfig.branchId || session.staff.branchId;
    let branch: Branch = { ...db.branch, id: branchId };
    if (branchId && branchId !== db.BRANCH_ID) {
      if (apiConfig.beFeatures.has('branch-settings')) {
        const data = await gql<{ entityServiceBranchById: BeBranchV2 }>(BRANCH_QUERY_V2, { id: branchId });
        const b = data.entityServiceBranchById;
        branch = {
          id: b.id,
          name: b.name,
          address: b.address,
          phone: b.phoneNumber || undefined,
          // Chi nhánh chưa cấu hình settings → mặc định của app (chỉ để hiển thị/xem trước — tiền thật do server tính).
          // ⚠️ BE-25 (be-recheck-2026-10-12): khi đó restaurant tính VAT 0% → bill có thể khác số app hiển thị.
          settings: b.settings
            ? {
                taxRate: b.settings.taxRate,
                pricesIncludeTax: b.settings.pricesIncludeTax,
                serviceChargeRate: b.settings.serviceChargeRate,
                cashRounding: b.settings.cashRounding,
              }
            : db.branch.settings,
        };
      } else {
        const data = await gql<{ entityServiceBranchById: BeBranch }>(BRANCH_QUERY, { id: branchId });
        const b = data.entityServiceBranchById;
        // Cờ `branch-settings` tắt (Branch.settings chưa lên gateway) → dùng cấu hình mặc định.
        branch = { id: b.id, name: b.name, address: b.address, settings: db.branch.settings };
      }
    }
    return { staff: session.staff, branch };
  },
};

export type BranchOption = { id: string; name: string; address?: string };

/** Chi nhánh đang hoạt động của tenant — cho bước chọn chi nhánh khi kích hoạt máy. */
export async function listBranches(): Promise<BranchOption[]> {
  const data = await gql<{ entityServiceListBranches: BeBranch[] }>(BRANCHES_QUERY, {
    input: { status: 'ACTIVE', limit: 100 },
  });
  return data.entityServiceListBranches.map((b) => ({ id: b.id, name: b.name, address: b.address }));
}
