// src/components/ui/connectivity-banner.tsx — báo mất mạng + số đơn đang chờ gửi bếp.
// Đồng thời tự flush hàng đợi khi có mạng lại (mount 1 lần ở app layout).
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff } from 'lucide-react-native';
import { Text, View } from '@/tw';
import { flushOfflineQueue } from '@/data/offline';
import { useIsOnline } from '@/lib/connectivity';
import { toast } from '@/lib/toast';
import { useOfflineQueueStore } from '@/store/offline-queue-store';

export function ConnectivityBanner() {
  const online = useIsOnline();
  const pending = useOfflineQueueStore((s) => s.queue.filter((q) => !q.error).length);
  const failed = useOfflineQueueStore((s) => s.queue.filter((q) => q.error).length);
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const wasOnline = useRef(online);

  // Vừa có mạng lại → flush hàng đợi.
  useEffect(() => {
    if (online && !wasOnline.current && pending > 0) {
      flushOfflineQueue(qc).then(({ sent, failed: f }) => {
        if (sent > 0) toast.success('Đã gửi bếp', `${sent} lượt chờ đã được gửi`);
        if (f > 0) toast.error('Có món không gửi được', 'Mở đơn để xem và xử lý');
      });
    }
    wasOnline.current = online;
  }, [online, pending, qc]);

  if (online && pending === 0 && failed === 0) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 flex-row items-center justify-center px-4 py-1.5"
      style={{ bottom: 0, paddingBottom: insets.bottom + 6, backgroundColor: online ? 'rgba(245,158,11,0.95)' : 'rgba(239,68,68,0.95)' }}
    >
      <CloudOff size={14} color="#fff" />
      <Text className="ml-2 text-xs font-bold text-white">
        {!online
          ? `Mất mạng${pending > 0 ? ` · ${pending} lượt chờ gửi` : ''}`
          : pending > 0
            ? `Đang gửi ${pending} lượt chờ…`
            : `${failed} lượt gửi bếp lỗi — mở đơn để xử lý`}
      </Text>
    </View>
  );
}
