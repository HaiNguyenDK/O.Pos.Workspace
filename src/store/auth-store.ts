// src/store/auth-store.ts — phiên đăng nhập PIN qua expo-secure-store (KHÔNG lưu PIN). pos-plan Mục 5.
// Lưu token + staff + hạn dùng để khởi động lại app vẫn biết ai đang đăng nhập.
// Hết hạn hoặc bỏ máy quá lâu → về màn PIN (máy dùng chung).
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { api } from '@/data/api';
import { apiSession, type ApiSession } from '@/data/api/session';
import { loadDeviceId } from '@/lib/device';
import type { Staff } from '@/data/types';

const SESSION_KEY = 'pos.auth.session';
/** Bỏ máy (app ở nền) quá lâu → đăng xuất. ⏳ chờ chốt giá trị (pos-plan Mục 5). */
export const IDLE_LOGOUT_MS = 15 * 60 * 1000;

type AuthState = {
  token: string | null;
  staff: Staff | null;
  expiresAt: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  isExpired: () => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  staff: null,
  expiresAt: null,
  hydrated: false,

  async hydrate() {
    // Timeout chống treo: nếu SecureStore không phản hồi (một số máy Sunmi/keystore
    // chậm), vẫn coi như hydrated để app không kẹt splash.
    try {
      loadDeviceId().catch(() => {}); // không chặn splash; chỉ cần cho chế độ GraphQL
      const raw = await Promise.race<string | null>([
        SecureStore.getItemAsync(SESSION_KEY),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      const session = raw ? (JSON.parse(raw) as ApiSession) : null;
      if (session && Date.parse(session.expiresAt) > Date.now()) {
        apiSession.set(session);
        set({ token: session.accessToken, staff: session.staff, expiresAt: session.expiresAt, hydrated: true });
        return;
      }
      if (session) await SecureStore.deleteItemAsync(SESSION_KEY);
      set({ hydrated: true });
    } catch {
      set({ token: null, staff: null, expiresAt: null, hydrated: true });
    }
  },

  async loginWithPin(pin: string) {
    const res = await api.loginPin(pin);
    const session: ApiSession = {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: res.expiresAt,
      staff: res.staff,
    };
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    apiSession.set(session);
    set({ token: res.accessToken, staff: res.staff, expiresAt: res.expiresAt });
  },

  async logout() {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    apiSession.set(null);
    set({ token: null, staff: null, expiresAt: null });
  },

  isExpired: () => {
    const exp = get().expiresAt;
    return !!exp && Date.parse(exp) <= Date.now();
  },
}));
