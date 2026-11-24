import { create } from 'zustand';
import type { ServersSnapshot } from '@/types/servers';

interface ServersState {
  snapshot: ServersSnapshot | null;
  error: string | null;
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
}

export const useServers = create<ServersState>((set, get) => ({
  snapshot: null, error: null, loading: false,
  refresh: async (force = false) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const r = await window.simrailHub!.getServers(force);
      // Při chybě necháme poslední úspěšná data (označíme je jako zastaralá v UI).
      if (r.ok) set({ snapshot: r.snapshot, error: null, loading: false });
      else set({ error: r.error, loading: false });
    } catch (e) {
      set({ error: `Chyba komunikace s aplikací: ${(e as Error).message}`, loading: false });
    }
  }
}));
