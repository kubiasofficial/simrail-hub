import { create } from 'zustand';
import type { DetectionResult } from '@/types/game';

interface GameState {
  result: DetectionResult | null;
  loading: boolean;
  error: string | null;
  launching: boolean;
  detect: () => Promise<void>;
  launch: () => Promise<void>;
  pickFolder: () => Promise<void>;
  clearManual: () => Promise<void>;
}

const api = () => window.simrailHub;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useGame = create<GameState>((set) => ({
  result: null, loading: false, error: null, launching: false,
  detect: async () => {
    set({ loading: true, error: null });
    try { set({ result: (await api()!.detectGame()), loading: false }); }
    catch (e) { set({ loading: false, error: `Detekce hry selhala: ${msg(e)}` }); }
  },
  launch: async () => {
    set({ launching: true, error: null });
    try {
      const r = await api()!.launchGame();
      set({ launching: false, error: r.ok ? null : r.error });
    } catch (e) { set({ launching: false, error: msg(e) }); }
  },
  pickFolder: async () => {
    try {
      const r = await api()!.pickGameFolder();
      if (r.ok) set({ result: r.result, error: null });
      else if (!('canceled' in r)) set({ error: r.error });
    } catch (e) { set({ error: msg(e) }); }
  },
  clearManual: async () => {
    try { set({ result: await api()!.clearManualGamePath(), error: null }); }
    catch (e) { set({ error: msg(e) }); }
  }
}));
