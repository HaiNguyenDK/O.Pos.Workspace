// src/data/api/be/notifications.ts — inbox thông báo (passiontech-notification, ĐÃ CÓ trên BE). Cờ: `notifications`.
// Schema: apps/passiontech-notification/graph/schema.graphqls — notificationServiceListNotifications(input: { skip, limit, type, role })
// → { items { id type title body isRead extra createdAt … } total }.
import { gql } from '@/data/api/graphql-client';
import type { PosApi } from '@/data/api/PosApi';
import type { AppNotification, NotificationKind } from '@/data/types';

export type BeNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  extra?: Record<string, unknown> | null;
  createdAt: string;
};

export const LIST_NOTIFICATIONS = /* GraphQL */ `
  query PosNotifications($input: ListNotificationsInput!) {
    notificationServiceListNotifications(input: $input) {
      items { id type title body isRead extra createdAt }
      total
    }
  }
`;

const PAGE_SIZE = 50;

/**
 * ⏳ chờ BE xác nhận tên/field: giá trị `type` cho thông báo POS (routing key POS chưa có — Mục 3.7)
 * và `extra.tableId`. Tạm đoán theo từ khoá.
 */
export function toNotificationKind(type: string): NotificationKind {
  const t = type.toLowerCase();
  if (t.includes('ready')) return 'ready';
  if (t.includes('assign')) return 'assigned';
  if (t.includes('promo') || t.includes('marketing')) return 'promo';
  return 'alert';
}

export function toNotification(n: BeNotification): AppNotification {
  const tableId = n.extra && typeof n.extra.tableId === 'string' ? n.extra.tableId : undefined;
  return {
    id: n.id,
    kind: toNotificationKind(n.type),
    title: n.title,
    body: n.body,
    tableId,
    read: n.isRead,
    createdAt: n.createdAt,
  };
}

export const beNotificationsApi = {
  async listNotifications() {
    const data = await gql<{ notificationServiceListNotifications: { items: BeNotification[]; total: number } | null }>(
      LIST_NOTIFICATIONS,
      { input: { skip: 0, limit: PAGE_SIZE } }
    );
    return (data.notificationServiceListNotifications?.items ?? []).map(toNotification);
  },
} satisfies Pick<PosApi, 'listNotifications'>;
