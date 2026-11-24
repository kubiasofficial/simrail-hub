import { useEffect } from 'react';

/** Zavolá fn hned a pak každých intervalMs, dokud je komponenta připojená a okno viditelné. */
export function useAutoRefresh(fn: () => void, intervalMs: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    fn();
    const id = setInterval(() => { if (!document.hidden) fn(); }, intervalMs);
    return () => clearInterval(id);
  }, [fn, intervalMs, enabled]);
}
