// src/data/api/graphql.ts — PosApi trên BE passiontech (GraphQL federation).
// Chỉ các thao tác BE ĐÃ CÓ gọi thật; phần BE chưa có (đơn, bếp, bill, thanh toán, PIN máy dùng chung)
// tạm dùng mock — xem docs/pos/pos-be-api-request.md. Khi BE làm xong, thay từng hàm, không sửa màn hình.
import { apiConfig } from '@/data/api/config';
import { gql } from '@/data/api/graphql-client';
import { mockPosApi, registerMenu } from '@/data/api/mock';
import { apiSession } from '@/data/api/session';
import type { PosApi } from '@/data/api/PosApi';
import * as db from '@/data/mocks';
import { PosApiError, type Branch, type MenuCategory, type MenuItem, type ModifierGroup } from '@/data/types';

// ── Kiểu dữ liệu BE (chỉ các field dùng tới) ──

type BeCategory = {
  id: string;
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

const CATEGORIES_QUERY = /* GraphQL */ `
  query PosCategories {
    categoryServiceAllCategories { id name type isEnabled isDeleted displayOrder }
  }
`;

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

export function toCategories(list: BeCategory[]): MenuCategory[] {
  return list
    .filter((c) => c.isEnabled && !c.isDeleted && (c.type ?? 'Product') === 'Product')
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c) => ({ id: c.id, name: c.name, sortOrder: c.displayOrder }));
}

async function fetchAllProducts(): Promise<BeProduct[]> {
  const out: BeProduct[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const data = await gql<{ productServiceSearchProducts: BeProduct[] }>(PRODUCTS_QUERY, {
      input: { isEnabled: true, type: 'PRODUCT' },
      pagination: { skip, limit: PAGE, sort: [{ field: 'displayOrder', direction: 'ASC' }] },
    });
    out.push(...data.productServiceSearchProducts);
    if (data.productServiceSearchProducts.length < PAGE) return out;
  }
}

export const graphqlPosApi: PosApi = {
  // BE chưa có PIN máy dùng chung (3.3) — PIN hiện tại của BE gắn 1 user–1 máy và token không có tenant.
  ...mockPosApi,

  async getMenu() {
    const [cats, products] = await Promise.all([
      gql<{ categoryServiceAllCategories: BeCategory[] }>(CATEGORIES_QUERY),
      fetchAllProducts(),
    ]);
    const categories = toCategories(cats.categoryServiceAllCategories);
    const ids = new Set(categories.map((c) => c.id));
    const items = products
      .map((p) => toMenuItem(p, ids))
      .filter((x): x is MenuItem => !!x)
      .filter((x) => ids.has(x.categoryId));
    registerMenu(items); // đơn/bếp còn chạy mock → mock phải nhận được món thật
    return { categories, items };
  },

  async me() {
    const session = apiSession.get();
    if (!session) throw new PosApiError('UNAUTHENTICATED', 'Phiên đăng nhập đã hết, vui lòng nhập PIN');
    const branchId = apiConfig.branchId || session.staff.branchId;
    let branch: Branch = { ...db.branch, id: branchId };
    if (branchId && branchId !== db.BRANCH_ID) {
      const data = await gql<{ entityServiceBranchById: BeBranch }>(BRANCH_QUERY, { id: branchId });
      const b = data.entityServiceBranchById;
      // BE chưa có BranchSettings (3.6) → dùng cấu hình mặc định.
      branch = { id: b.id, name: b.name, address: b.address, settings: db.branch.settings };
    }
    return { staff: session.staff, branch };
  },
};
