import { create } from 'zustand';

export type PageId = 'home' | 'servers' | 'map' | 'dashboard' | 'mods' | 'settings' | 'history';

interface NavState {
  page: PageId;
  setPage: (p: PageId) => void;
}

const initial = (): PageId => {
  const m = /page=(\w+)/.exec(location.hash);
  const ids: PageId[] = ['home', 'servers', 'map', 'dashboard', 'mods', 'settings', 'history'];
  return (ids as string[]).includes(m?.[1] ?? '') ? (m![1] as PageId) : 'home';
};

export const useNavigation = create<NavState>((set) => ({
  page: initial(),
  setPage: (page) => set({ page })
}));
