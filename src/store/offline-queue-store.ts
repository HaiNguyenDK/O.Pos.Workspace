// src/store/offline-queue-store.ts — hàng đợi "gửi bếp" khi mất mạng (persist AsyncStorage).
// Mất mạng → enqueue; có mạng lại → flush (data/offline.ts). Không làm conflict resolution ở v1.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OrderLine } from '@/data/types';

export type QueuedSend = {
  id: string;
  orderId: string;
  tableName?: string;
  lines: OrderLine[];
  createdAt: string; // ISO
};

type QueueState = {
  queue: QueuedSend[];
  enqueue: (item: Omit<QueuedSend, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useOfflineQueueStore = create<QueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (item) =>
        set((s) => ({
          queue: [
            ...s.queue,
            { ...item, id: `q${Date.now()}${Math.floor(Math.random() * 1000)}`, createdAt: new Date().toISOString() },
          ],
        })),
      remove: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
      clear: () => set({ queue: [] }),
    }),
    { name: 'pos.offline.queue', storage: createJSONStorage(() => AsyncStorage) }
  )
);
