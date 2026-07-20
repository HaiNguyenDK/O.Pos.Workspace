// src/lib/i18n.ts — i18next + react-i18next + expo-localization.
// Key dùng chung (Mục 3.5). vi mặc định, en. Mở rộng key khi làm màn mới.
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  vi: {
    translation: {
      appName: 'Waiter POS',
      common: {
        cancel: 'Huỷ',
        confirm: 'Xác nhận',
        save: 'Lưu',
        back: 'Quay lại',
        retry: 'Thử lại',
        loading: 'Đang tải…',
        empty: 'Chưa có dữ liệu',
        error: 'Có lỗi xảy ra',
        search: 'Tìm kiếm',
      },
      pin: { title: 'Nhập mã PIN', wrong: 'Sai mã PIN', hint: '6 số' },
      home: { tabTables: 'Bàn', tabOrders: 'Đơn đang chạy', title: 'Sơ đồ bàn' },
      table: {
        available: 'Trống',
        occupied: 'Có khách',
        reserved: 'Đã đặt',
        seats: '{{count}} chỗ',
      },
      cart: { sendToKitchen: 'Gửi bếp', empty: 'Giỏ trống' },
      payment: { cash: 'Tiền mặt', qr: 'VietQR', card: 'Thẻ', success: 'Thanh toán thành công' },
      nav: {
        home: 'Trang chủ',
        history: 'Lịch sử',
        settings: 'Cài đặt',
        notifications: 'Thông báo',
      },
    },
  },
  en: {
    translation: {
      appName: 'Waiter POS',
      common: {
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        back: 'Back',
        retry: 'Retry',
        loading: 'Loading…',
        empty: 'No data yet',
        error: 'Something went wrong',
        search: 'Search',
      },
      pin: { title: 'Enter PIN', wrong: 'Wrong PIN', hint: '6 digits' },
      home: { tabTables: 'Tables', tabOrders: 'Running orders', title: 'Floor plan' },
      table: {
        available: 'Available',
        occupied: 'Occupied',
        reserved: 'Reserved',
        seats: '{{count}} seats',
      },
      cart: { sendToKitchen: 'Send to kitchen', empty: 'Cart is empty' },
      payment: { cash: 'Cash', qr: 'VietQR', card: 'Card', success: 'Payment successful' },
      nav: { home: 'Home', history: 'History', settings: 'Settings', notifications: 'Notifications' },
    },
  },
} as const;

const deviceLang = getLocales()[0]?.languageCode === 'en' ? 'en' : 'vi';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: deviceLang,
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export default i18n;
