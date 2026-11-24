import type { ServerRow } from '../types/servers';

/** Je to český server? (kód začíná „cz“ nebo název obsahuje Czech/Česk.) */
export const isCzechServer = (s: Pick<ServerRow, 'code' | 'name'>): boolean =>
  /^cz/i.test(s.code) || /czech|česk|^cz\d/i.test(s.name);

/** Seřadí servery: aktivní české první, pak ostatní aktivní, pak neaktivní. */
export function sortServers<T extends Pick<ServerRow, 'code' | 'name' | 'active'>>(servers: T[]): T[] {
  const rank = (s: T) => (s.active ? 0 : 2) + (isCzechServer(s) ? 0 : 1);
  return [...servers].sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code));
}

/** Výchozí server: uložená volba (pokud je aktivní) → první aktivní český → první aktivní. */
export function pickDefaultServer(servers: Pick<ServerRow, 'code' | 'name' | 'active'>[], preferred: string | null): string | null {
  const active = sortServers(servers.filter((s) => s.active));
  if (preferred && active.some((s) => s.code === preferred)) return preferred;
  return active[0]?.code ?? null;
}
