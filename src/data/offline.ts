// src/data/offline.ts — flush hàng đợi "gửi bếp" khi có mạng lại.
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/data/api';
import { qk } from '@/data/queries';
import { useOfflineQueueStore } from '@/store/offline-queue-store';

let flushing = false;

/** Gửi lần lượt các item đã xếp hàng. Dừng nếu 1 item lỗi (coi như còn mất mạng). */
export async function flushOfflineQueue(qc: QueryClient): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const { queue } = useOfflineQueueStore.getState();
    for (const item of queue) {
      try {
        await api.sendToKitchen(item.orderId, item.lines);
        useOfflineQueueStore.getState().remove(item.id);
        sent++;
      } catch {
        break;
      }
    }
    if (sent > 0) qc.invalidateQueries({ queryKey: qk.runningOrders });
  } finally {
    flushing = false;
  }
  return sent;
}
