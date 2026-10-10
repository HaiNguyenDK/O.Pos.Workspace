// src/data/queries — TanStack Query hooks trên PosApi. Query key convention: pos-plan Mục 4.
// idempotencyKey do NƠI GỌI sinh (1 lần / thao tác người dùng) và truyền vào vars,
// để retry / hàng đợi offline dùng lại đúng key.
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '@/data/api';
import type { PosApi } from '@/data/api/PosApi';
import { isPosApiError, type Bill, type Order } from '@/data/types';

export const qk = {
  me: ['me'] as const,
  tables: ['tables'] as const,
  menu: ['menu'] as const,
  runningOrders: ['orders', 'running'] as const,
  order: (orderId: string) => ['order', orderId] as const,
  tableOrder: (tableId: string) => ['order', 'table', tableId] as const,
  bill: (billId: string) => ['bill', billId] as const,
  payment: (paymentId: string) => ['payment', paymentId] as const,
  history: (search?: string) => ['history', search ?? ''] as const,
  notifications: ['notifications'] as const,
  shift: ['shift'] as const,
  currentShift: ['shift', 'current'] as const,
  shiftReport: (shiftId: string) => ['shift', shiftId, 'report'] as const,
};

/** Polling thay realtime cho tới khi BE có subscription (pos-plan Mục 3.2, câu hỏi #5). */
const LIVE_POLL_MS = 5000;

type Args<K extends keyof PosApi> = Parameters<PosApi[K]>[0];

export function useMe(enabled = true) {
  return useQuery({ queryKey: qk.me, queryFn: () => api.me(), enabled, staleTime: 5 * 60 * 1000 });
}

/** Cấu hình chi nhánh (thuế, phí phục vụ) — dùng cho xem trước; số chuẩn luôn từ Bill server trả. */
export function useBranchSettings() {
  return useMe().data?.branch.settings;
}

export function useTables() {
  return useQuery({ queryKey: qk.tables, queryFn: () => api.listTables(), refetchInterval: LIVE_POLL_MS });
}

export function useMenu() {
  return useQuery({ queryKey: qk.menu, queryFn: () => api.getMenu() });
}

export function useRunningOrders() {
  return useQuery({ queryKey: qk.runningOrders, queryFn: () => api.getRunningOrders(), refetchInterval: LIVE_POLL_MS });
}

export function useRunningOrder(tableId: string) {
  return useQuery({
    queryKey: qk.tableOrder(tableId),
    queryFn: () => api.getRunningOrder(tableId),
    enabled: !!tableId,
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: qk.order(orderId ?? ''),
    queryFn: () => api.getOrder(orderId!),
    enabled: !!orderId,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useBill(billId: string | undefined) {
  return useQuery({ queryKey: qk.bill(billId ?? ''), queryFn: () => api.getBill(billId!), enabled: !!billId });
}

/** Poll trạng thái payment (VietQR) cho tới khi kết thúc. */
export function usePayment(paymentId: string | undefined) {
  return useQuery({
    queryKey: qk.payment(paymentId ?? ''),
    queryFn: () => api.getPayment(paymentId!),
    enabled: !!paymentId,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 2000 : false),
  });
}

export function useHistoryInfinite(search?: string) {
  return useInfiniteQuery({
    queryKey: ['history', 'inf', search ?? ''],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.listBills({ search, page: pageParam, pageSize: 8 }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications, queryFn: () => api.listNotifications() });
}

// ── Mutations ──

/** Ghi đơn mới nhất vào cache và làm mới các danh sách liên quan. */
export function syncOrder(qc: QueryClient, order: Order) {
  qc.setQueryData(qk.order(order.id), order);
  qc.invalidateQueries({ queryKey: qk.tables });
  qc.invalidateQueries({ queryKey: qk.runningOrders });
  if (order.tableId) qc.invalidateQueries({ queryKey: qk.tableOrder(order.tableId) });
}

function useOrderMutation<K extends 'openOrder' | 'addLines' | 'voidLine' | 'moveOrder' | 'mergeOrders'>(op: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Args<K>) => (api[op] as (a: Args<K>) => Promise<Order>)(v),
    onSuccess: (order) => syncOrder(qc, order),
  });
}

export const useOpenOrder = () => useOrderMutation('openOrder');
export const useAddLines = () => useOrderMutation('addLines');
export const useVoidLine = () => useOrderMutation('voidLine');
export const useMoveOrder = () => useOrderMutation('moveOrder');
export const useMergeOrders = () => useOrderMutation('mergeOrders');

function syncBills(qc: QueryClient, bills: Bill[]) {
  for (const b of bills) qc.setQueryData(qk.bill(b.id), b);
  qc.invalidateQueries({ queryKey: ['order'] });
  qc.invalidateQueries({ queryKey: qk.runningOrders });
}

export function useRequestBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Args<'requestBill'>) => api.requestBill(v),
    onSuccess: (bill) => syncBills(qc, [bill]),
  });
}

export function useSplitBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Args<'splitBill'>) => api.splitBill(v),
    onSuccess: (bills) => syncBills(qc, bills),
  });
}

function usePaymentMutation<K extends 'startPayment' | 'cancelPayment' | 'confirmPaymentManually'>(op: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Args<K>) => (api[op] as (a: Args<K>) => ReturnType<PosApi[K]>)(v),
    onSuccess: (p) => {
      qc.setQueryData(qk.payment(p.id), p);
      qc.invalidateQueries({ queryKey: qk.bill(p.billId) });
      if (p.status === 'SUCCEEDED') {
        qc.invalidateQueries({ queryKey: qk.tables });
        qc.invalidateQueries({ queryKey: qk.runningOrders });
        qc.invalidateQueries({ queryKey: ['history'] });
        qc.invalidateQueries({ queryKey: qk.shift });
      }
    },
    onError: (e) => {
      // Ca vừa bị chốt ở nơi khác / chưa mở → làm mới trạng thái ca.
      if (isPosApiError(e) && e.code === 'SHIFT_REQUIRED') qc.invalidateQueries({ queryKey: qk.shift });
    },
  });
}

export const useStartPayment = () => usePaymentMutation('startPayment');
export const useCancelPayment = () => usePaymentMutation('cancelPayment');
export const useConfirmPaymentManually = () => usePaymentMutation('confirmPaymentManually');

export function useRequestApproval() {
  return useMutation({ mutationFn: (v: Args<'requestApproval'>) => api.requestApproval(v) });
}

export function useLookupCustomer() {
  return useMutation({ mutationFn: (phone: string) => api.lookupCustomer(phone) });
}

/** Nhiều bill (các phần sau khi chia) — để biết phần nào đã thu. */
export function useBills(billIds: string[]) {
  return useQueries({
    queries: billIds.map((id) => ({ queryKey: qk.bill(id), queryFn: () => api.getBill(id) })),
  });
}

/** Payment kết thúc ngoài mutation (poll VietQR) → làm mới bill + danh sách liên quan. */
export function invalidateAfterPayment(qc: QueryClient, billId: string) {
  qc.invalidateQueries({ queryKey: qk.bill(billId) });
  qc.invalidateQueries({ queryKey: qk.tables });
  qc.invalidateQueries({ queryKey: qk.runningOrders });
  qc.invalidateQueries({ queryKey: ['history'] });
  qc.invalidateQueries({ queryKey: qk.shift });
}

// ── Ca thu ngân & báo cáo X/Z (pos-plan Mục 3.7, D14) ──

/** Ca đang mở của máy này; null = chưa mở ca (thu tiền sẽ bị SHIFT_REQUIRED). */
export function useCurrentShift() {
  return useQuery({ queryKey: qk.currentShift, queryFn: () => api.getCurrentShift() });
}

/** Báo cáo X (ca OPEN, poll để số liệu sống) hoặc Z (ca CLOSED, không đổi). */
export function useShiftReport(shiftId: string | undefined, live = false) {
  return useQuery({
    queryKey: qk.shiftReport(shiftId ?? ''),
    queryFn: () => api.getShiftReport({ shiftId: shiftId! }),
    enabled: !!shiftId,
    refetchInterval: live ? LIVE_POLL_MS * 2 : false,
  });
}

export function useOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Args<'openShift'>) => api.openShift(v),
    onSuccess: (shift) => {
      qc.setQueryData(qk.currentShift, shift);
      qc.invalidateQueries({ queryKey: qk.shift });
    },
    onError: (e) => {
      if (isPosApiError(e) && e.code === 'SHIFT_ALREADY_OPEN') qc.invalidateQueries({ queryKey: qk.shift });
    },
  });
}

export function useAddCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Args<'addCashMovement'>) => api.addCashMovement(v),
    onSuccess: (m) => qc.invalidateQueries({ queryKey: qk.shiftReport(m.shiftId) }),
  });
}

export function useCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Args<'closeShift'>) => api.closeShift(v),
    onSuccess: (z) => {
      qc.setQueryData(qk.shiftReport(z.shift.id), z);
      qc.setQueryData(qk.currentShift, null);
      qc.invalidateQueries({ queryKey: qk.currentShift });
    },
  });
}
