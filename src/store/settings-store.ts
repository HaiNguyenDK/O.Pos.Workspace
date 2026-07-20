// src/store/settings-store.ts — cài đặt app, persist qua AsyncStorage. Mục 5.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Lang = 'vi' | 'en';

type SettingsState = {
  language: Lang;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  printerName: string | null; // BLE pairing — set ở Sprint 3
  serviceCharge: boolean; // bật phí phục vụ 5%
  setLanguage: (l: Lang) => void;
  toggleSound: () => void;
  toggleHaptics: () => void;
  setPrinter: (name: string | null) => void;
  toggleServiceCharge: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'vi',
      soundEnabled: true,
      hapticsEnabled: true,
      printerName: null,
      serviceCharge: false,
      setLanguage: (language) => set({ language }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      setPrinter: (printerName) => set({ printerName }),
      toggleServiceCharge: () => set((s) => ({ serviceCharge: !s.serviceCharge })),
    }),
    { name: 'pos.settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);
