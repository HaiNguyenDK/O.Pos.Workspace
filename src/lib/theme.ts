// src/lib/theme.ts — Design tokens (JS mirror of global.css @theme).
// Dùng khi cần màu ở tầng JS (icon color, StatusChip, gradient...). Nguồn chốt:
// docs/waiter-pos-mobile-sprint0.md Mục 3 — GIỮ ĐỒNG BỘ với src/global.css.

export const color = {
  brand: { DEFAULT: '#F37021', bright: '#FF8C00' }, // cam — thay accent xanh lá
  bg: { app: '#0B0B0C', surface: '#1A1A1D', elevated: '#242428' },
  line: '#2A2A2E',
  text: { primary: '#FFFFFF', muted: '#A1A1AA' },
  cta: { cart: '#EF4444' },
  status: {
    available: '#22C55E',
    occupied: '#F97316',
    reserved: '#3B82F6',
    pending: '#F59E0B',
    ready: '#22C55E',
    paid: '#71717A',
    cancelled: '#EF4444',
  },
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, phone: 54 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// Navigation theme (expo-router / react-navigation) — nền tối, accent cam.
export const navTheme = {
  dark: true,
  colors: {
    primary: color.brand.DEFAULT,
    background: color.bg.app,
    card: color.bg.surface,
    text: color.text.primary,
    border: color.line,
    notification: color.brand.DEFAULT,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
};
