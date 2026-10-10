// src/store/terminal-store.ts — trạng thái kích hoạt máy (chế độ graphql). Xem data/api/terminal.ts.
// Máy chưa kích hoạt (hoặc chưa chọn chi nhánh) → màn (auth)/activate trước màn PIN.
import { create } from 'zustand';
import { apiConfig } from '@/data/api/config';
import { terminalSession, type TerminalSession } from '@/data/api/terminal';
import { loadDeviceId } from '@/lib/device';

type TerminalState = {
  session: TerminalSession | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (s: TerminalSession) => Promise<void>;
  setBranch: (branch: { id: string; name: string }) => Promise<void>;
  deactivate: () => Promise<void>;
};

/** Chế độ mock không cần kích hoạt. */
export const needsActivation = apiConfig.mode === 'graphql';

export const useTerminalStore = create<TerminalState>((set, get) => ({
  session: null,
  hydrated: !needsActivation,

  async hydrate() {
    if (!needsActivation) return;
    try {
      // X-Device-Id phải có trước mọi request REST/GraphQL (token gắn với máy).
      await loadDeviceId();
      const session = await Promise.race([
        terminalSession.load(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      set({ session, hydrated: true });
    } catch {
      set({ session: null, hydrated: true });
    }
  },

  async setSession(session) {
    await terminalSession.save(session);
    set({ session });
  },

  async setBranch(branch) {
    const current = get().session ?? terminalSession.get();
    if (!current) return;
    const next = { ...current, branchId: branch.id, branchName: branch.name };
    await terminalSession.save(next);
    set({ session: next });
  },

  async deactivate() {
    await terminalSession.save(null);
    set({ session: null });
  },
}));
