// src/components/notification-router.tsx — nghe tap notification bếp → deep link vào bàn.
// Mount 1 lần trong (app)/_layout (đã qua auth). Render null.
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { setupNotifications } from '@/native/notifications';

export function NotificationRouter() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    const tableId = response.notification.request.content.data?.tableId as string | undefined;
    if (tableId) {
      handled.current = id;
      router.push(`/(app)/table/${tableId}`);
    }
  }, [response, router]);

  return null;
}
