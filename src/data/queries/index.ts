// src/data/queries — TanStack Query hooks trên PosApi. Query key convention Mục 4.
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/data/api';
import type { CreateOrderInput, OrderLine, PaymentMethod, PayMeta } from '@/data/types';

export const qk = {
  tables: ['tables'] as const,
  menu: ['menu'] as const,
  runningOrders: ['orders', 'running'] as const,
  order: (tableId: string) => ['order', tableId] as const,
  bill: (orderId: string) => ['bill', orderId] as const,
  history: (search?: string) => ['history', search ?? ''] as const,
  notifications: ['notifications'] as const,
};

export function useTables() {
  return useQuery({ queryKey: qk.tables, queryFn: () => api.listTables() });
}

export function useMenu() {
  return useQuery({ queryKey: qk.menu, queryFn: () => api.getMenu() });
}

export function useRunningOrders() {
  return useQuery({ queryKey: qk.runningOrders, queryFn: () => api.getRunningOrders() });
}

export function useRunningOrder(tableId: string) {
  return useQuery({
    queryKey: qk.order(tableId),
    queryFn: () => api.getRunningOrder(tableId),
    enabled: !!tableId,
  });
}

export function useBill(orderId: string) {
  return useQuery({
    queryKey: qk.bill(orderId),
    queryFn: () => api.getBill(orderId),
    enabled: !!orderId,
  });
}

export function useHistory(search?: string) {
  return useQuery({ queryKey: qk.history(search), queryFn: () => api.listBills({ search }) });
}

const PAGE_SIZE = 8;
export function useHistoryInfinite(search?: string) {
  return useInfiniteQuery({
    queryKey: ['history', 'inf', search ?? ''],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.listBills({ search, page: pageParam, pageSize: PAGE_SIZE }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications, queryFn: () => api.listNotifications() });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.createOrder(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables });
      qc.invalidateQueries({ queryKey: qk.runningOrders });
    },
  });
}

export function useSendToKitchen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { orderId: string; lines: OrderLine[] }) =>
      api.sendToKitchen(v.orderId, v.lines),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.runningOrders }),
  });
}

export function useMoveTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { orderId: string; toTableId: string }) =>
      api.moveTable(v.orderId, v.toTableId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables });
      qc.invalidateQueries({ queryKey: qk.runningOrders });
    },
  });
}

export function useMergeTables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { orderId: string; tableIds: string[] }) =>
      api.mergeTables(v.orderId, v.tableIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables });
      qc.invalidateQueries({ queryKey: qk.runningOrders });
    },
  });
}

export function usePay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { billId: string; method: PaymentMethod; meta?: PayMeta }) =>
      api.pay(v.billId, v.method, v.meta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables });
      qc.invalidateQueries({ queryKey: qk.runningOrders });
      qc.invalidateQueries({ queryKey: qk.history() });
    },
  });
}
