// src/components/ui/connectivity-banner.tsx — báo mất mạng + số đơn đang chờ gửi bếp.
// Đồng thời tự flush hàng đợi khi có mạng lại (mount 1 lần ở app layout).
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff } from 'lucide-react-native';
import { Text, View } from '@/tw';
import { flushOfflineQueue } from '@/data/offline';
import { useIsOnline } from '@/lib/connectivity';
import { toast } from '@/lib/toast';
import { useOfflineQueueStore } from '@/store/offline-queue-store';

export function ConnectivityBanner() {
  const { t } = useTranslation();
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
        if (sent > 0) toast.success(t('cart.sent'), t('offline.flushed', { count: sent }));
        if (f > 0) toast.error(t('offline.flushFailed'), t('offline.flushFailedHint'));
      });
    }
    wasOnline.current = online;
  }, [online, pending, qc, t]);

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
          ? pending > 0
            ? t('offline.offlinePending', { count: pending })
            : t('offline.offline')
          : pending > 0
            ? t('offline.sending', { count: pending })
            : t('offline.failed', { count: failed })}
      </Text>
    </View>
  );
}
