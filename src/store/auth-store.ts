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
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    set({ token, hydrated: true });
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
