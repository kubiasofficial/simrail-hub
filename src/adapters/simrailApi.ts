import type { ServerInfo, ServerStats } from '../types/servers';

/** Jediné povolené zdroje dat. Zdroj: veřejné endpointy panelu SimRailu (viz README, sekce Zdroje dat). */
export const LIVE_DATA_BASE = 'https://panel.simrail.eu:8084';
export const TIMETABLE_BASE = 'https://api1.aws.simrail.eu:8082/api';
const ALLOWED_ORIGINS = new Set(['https://panel.simrail.eu:8084', 'https://api1.aws.simrail.eu:8082']);

export class ApiError extends Error {
  constructor(message: string, public readonly kind: 'network' | 'http' | 'format' | 'timeout' | 'blocked') {
    super(message);
  }
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) =>
  Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function fetchJson(fetchFn: FetchLike, url: string, timeoutMs = 10_000): Promise<unknown> {
  let origin: string;
  try { origin = new URL(url).origin; } catch { throw new ApiError('Neplatná adresa API.', 'blocked'); }
  if (!ALLOWED_ORIGINS.has(origin)) throw new ApiError(`Adresa ${origin} není na seznamu povolených zdrojů.`, 'blocked');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new ApiError(`API vrátilo chybu HTTP ${res.status}.`, 'http');
    const body = await res.text();
    try { return JSON.parse(body); }
    catch { throw new ApiError('API nevrátilo platný JSON.', 'format'); }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError(`API neodpovědělo do ${timeoutMs / 1000} s.`, 'timeout');
    throw new ApiError(`Nepodařilo se spojit s API (${(e as Error).message}).`, 'network');
  } finally { clearTimeout(timer); }
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Vrátí hodnotu pole bez ohledu na velikost písmen; zkouší více názvů (kvůli překlepům v API). */
export function pick(obj: Rec, ...names: string[]): unknown {
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase());
    if (k !== undefined) return obj[k];
  }
  return undefined;
}

/** Rozbalí obálku { result, count, description, data } nebo přijme rovnou pole. */
export function unwrapList(json: unknown): Rec[] {
  let list: unknown = json;
  if (isRec(json)) {
    const result = pick(json, 'result');
    if (result === false) {
      const d = pick(json, 'description');
      throw new ApiError(`API oznámilo neúspěch${typeof d === 'string' && d ? `: ${d}` : '.'}`, 'format');
    }
    list = pick(json, 'data');
  }
  if (!Array.isArray(list)) throw new ApiError('Odpověď API nemá očekávanou strukturu (chybí seznam „data“).', 'format');
  return list.filter(isRec);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parseServers(json: unknown): ServerInfo[] {
  const out: ServerInfo[] = [];
  for (const r of unwrapList(json)) {
    const code = str(pick(r, 'ServerCode', 'serverCode'));
    if (!code) continue; // záznam bez kódu serveru nelze použít
    const name = str(pick(r, 'ServerName', 'serverName')) ?? code;
    const lang = /\(([^)]+)\)\s*$/.exec(name)?.[1] ?? null;
    out.push({
      id: str(pick(r, 'id', 'Id')) ?? code,
      code,
      name,
      region: str(pick(r, 'ServerRegion', 'serverRegion')),
      language: lang,
      active: pick(r, 'IsActive', 'isActive') !== false
    });
  }
  return out;
}

/** Statistiky provozu z trains-open a stations-open. */
export function parseStats(trainsJson: unknown, stationsJson: unknown): ServerStats {
  const trains = unwrapList(trainsJson);
  const stations = unwrapList(stationsJson);
  let user = 0;
  let bot = 0;
  for (const t of trains) {
    const type = str(pick(t, 'Type', 'type'))?.toLowerCase();
    if (type === 'user') user++;
    else if (type === 'bot') bot++;
  }
  const dispatchers = stations.filter((s) => {
    const d = pick(s, 'DispatchedBy', 'dispatchedBy');
    return Array.isArray(d) && d.length > 0;
  }).length;
  return { trainsTotal: trains.length, trainsUser: user, trainsBot: bot, dispatchers };
}

export const serversUrl = () => `${LIVE_DATA_BASE}/servers-open`;
export const trainsUrl = (code: string) => `${LIVE_DATA_BASE}/trains-open?serverCode=${encodeURIComponent(code)}`;
export const stationsUrl = (code: string) => `${LIVE_DATA_BASE}/stations-open?serverCode=${encodeURIComponent(code)}`;
