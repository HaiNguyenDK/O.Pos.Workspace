// src/store/offline-queue-store.ts — hàng đợi "gửi bếp" khi mất mạng (persist AsyncStorage).
// Chỉ addLines được xếp hàng (pos-plan Mục 5). Mỗi mục giữ nguyên idempotencyKey + lineId để
// gửi lại bao nhiêu lần cũng không tạo món trùng. Lỗi nghiệp vụ → đánh dấu `error`, không tự thử lại.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartLine } from '@/store/cart-store';

export type QueuedSend = {
  idempotencyKey: string;
  orderId: string;
  tableName?: string;
  lines: CartLine[];
  createdAt: string; // ISO
  error?: string; // lỗi nghiệp vụ khi flush — cần waiter xử lý
};

type QueueState = {
  queue: QueuedSend[];
  enqueue: (item: Omit<QueuedSend, 'createdAt' | 'error'>) => void;
  remove: (idempotencyKey: string) => void;
  markFailed: (idempotencyKey: string, error: string) => void;
  clear: () => void;
};

export const useOfflineQueueStore = create<QueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (item) => set((s) => ({ queue: [...s.queue, { ...item, createdAt: new Date().toISOString() }] })),
      remove: (key) => set((s) => ({ queue: s.queue.filter((q) => q.idempotencyKey !== key) })),
      markFailed: (key, error) =>
        set((s) => ({ queue: s.queue.map((q) => (q.idempotencyKey === key ? { ...q, error } : q)) })),
      clear: () => set({ queue: [] }),
    }),
    { name: 'pos.offline.queue.v2', storage: createJSONStorage(() => AsyncStorage) }
  )
);
