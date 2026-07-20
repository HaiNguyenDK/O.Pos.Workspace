// src/native/notifications.ts — push từ bếp "món sẵn sàng" → deep link vào bàn.
// Remote thật cần FCM (google-services.json + server). Demo dùng LOCAL notification để
// minh hoạ trọn vẹn luồng nhận → tap → deep link (không cần server).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground: vẫn hiện banner + kêu.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const KITCHEN_CHANNEL = 'kitchen';

export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(KITCHEN_CHANNEL, {
      name: 'Thông báo bếp',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F37021',
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Mock "món sẵn sàng" — thay cho FCM ở demo. data.tableId để deep link. */
export async function notifyKitchenReady(tableId: string, tableName: string): Promise<boolean> {
  if (!(await requestNotificationPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Món sẵn sàng 🍽️',
      body: `${tableName} — món đã xong, mời phục vụ`,
      data: { tableId },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: KITCHEN_CHANNEL,
    },
  });
  return true;
}
