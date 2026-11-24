import { ApiError, fetchJson, parseServers, parseStats, serversUrl, trainsUrl, stationsUrl, type FetchLike } from '../adapters/simrailApi';
import type { ServerRow, ServersResult } from '../types/servers';

const MIN_INTERVAL_MS = 10_000;

export class ServerService {
  private pending:Promise<ServersResult>|null=null;
  private cache: { at: number; result: ServersResult } | null = null;
  constructor(private fetchFn: FetchLike, private now: () => number = Date.now) {}

  /** Vrací čerstvá data; při dotazech častějších než 10 s vrací poslední výsledek, aby se API nezahlcovalo. */
  async getServers(force = false): Promise<ServersResult> {
    if (this.cache) {
      const age = this.now() - this.cache.at;
      // Ruční obnovení smí obejít cache až po 3 s, automatické až po 10 s.
      if (age < (force ? 3_000 : MIN_INTERVAL_MS)) return this.cache.result;
    }
    if(this.pending)return this.pending;
    const task=this.load().then(result=>{this.cache={at:this.now(),result};return result;}).finally(()=>this.pending=null);this.pending=task;
    const result = await task;
    this.cache = { at: this.now(), result };
    return result;
  }

  private async load(): Promise<ServersResult> {
    let infos;
    try { infos = parseServers(await fetchJson(this.fetchFn, serversUrl())); }
    catch (e) { return { ok: false, error: `Seznam serverů se nepodařilo načíst: ${(e as Error).message}` }; }

    const rows: ServerRow[] = await Promise.all(infos.map(async (info): Promise<ServerRow> => {
      if (!info.active) return { ...info, stats: null, statsError: null };
      try {
        const [trains, stations] = await Promise.all([
          fetchJson(this.fetchFn, trainsUrl(info.code)),
          fetchJson(this.fetchFn, stationsUrl(info.code))
        ]);
        return { ...info, stats: parseStats(trains, stations), statsError: null };
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : (e as Error).message;
        return { ...info, stats: null, statsError: msg };
      }
    }));
    return { ok: true, snapshot: { fetchedAt: this.now(), servers: rows, source: 'panel.simrail.eu' } };
  }
}
