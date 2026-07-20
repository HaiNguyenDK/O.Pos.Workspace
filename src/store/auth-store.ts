// src/store/auth-store.ts — PIN/token qua expo-secure-store (KHÔNG plaintext). Mục 5.
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { api } from '@/data/api';
import type { Staff } from '@/data/types';

const TOKEN_KEY = 'pos.auth.token';

type AuthState = {
  token: string | null;
  staff: Staff | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  staff: null,
  hydrated: false,

  async hydrate() {
    // Timeout chống treo: nếu SecureStore không phản hồi (một số máy Sunmi/keystore
    // chậm), vẫn coi như hydrated để app không kẹt splash.
    try {
      const token = await Promise.race<string | null>([
        SecureStore.getItemAsync(TOKEN_KEY),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      set({ token: token ?? null, hydrated: true });
    } catch {
      set({ token: null, hydrated: true });
    }
  },

  async loginWithPin(pin: string) {
    const { token, staff } = await api.loginPin(pin);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, staff });
  },

  async logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, staff: null });
  },
}));
