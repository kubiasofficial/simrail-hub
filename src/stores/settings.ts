import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '@/types/settings';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  update: (patch: SettingsPatch) => Promise<void>;
}

export function applyTheme(theme: Settings['theme']) { document.documentElement.dataset.theme = theme; }

let revision=0;
export const useSettings = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS, loaded: false, error: null,
  load: async () => {const current=revision;
    try { const s = await window.simrailHub!.call('settings:get');if(current!==revision)return; applyTheme(s.theme); set({ settings: s, loaded: true, error: null }); }
    catch (e) { set({ loaded: true, error: `Nastavení se nepodařilo načíst: ${(e as Error).message}` }); }
  },
  update: async (patch) => {const current=++revision;
    try { const s = await window.simrailHub!.call('settings:update', patch);if(current!==revision)return; applyTheme(s.theme); set({ settings: s, error: null }); }
    catch (e) { set({ error: `Nastavení se nepodařilo uložit: ${(e as Error).message}` }); }
  }
}));
