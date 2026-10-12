// src/data/offline.ts — flush hàng đợi "gửi bếp" khi có mạng lại.
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/data/api';
import { syncOrder } from '@/data/queries';
import { isPosApiError } from '@/data/types';
import { toNewLine } from '@/store/cart-store';
import { useOfflineQueueStore } from '@/store/offline-queue-store';

let flushing = false;

/**
 * Gửi lần lượt theo thứ tự, dùng lại đúng idempotencyKey đã lưu.
 * - Lỗi mạng → dừng, chờ lần có mạng sau.
 * - Lỗi nghiệp vụ (đơn đã đóng, món hết…) → đánh dấu lỗi, bỏ qua mục đó, gửi tiếp mục sau.
 */
export async function flushOfflineQueue(qc: QueryClient): Promise<{ sent: number; failed: number }> {
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const store = useOfflineQueueStore.getState;
    for (const item of store().queue.filter((q) => !q.error)) {
      try {
        const order = await api.addLines({
          idempotencyKey: item.idempotencyKey,
          orderId: item.orderId,
          lines: item.lines.map(toNewLine),
        });
        store().remove(item.idempotencyKey);
        syncOrder(qc, order);
        sent++;
      } catch (e) {
        if (!isPosApiError(e)) break;
        store().markFailed(item.idempotencyKey, e.message);
        failed++;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}
