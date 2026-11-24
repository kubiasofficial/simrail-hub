/** Public profile lookup; never ships a Steam API key. Unavailable/private profiles use the UI fallback. */
export class SteamProfiles {
  private cache = new Map<string, { at: number; avatar: string | null }>();
  private pending = new Map<string, Promise<string | null>>();
  constructor(private fetchFn: (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; text(): Promise<string> }>) {}
  avatar(id: string): Promise<string | null> {
    if (!/^\d{17}$/.test(id)) return Promise.resolve(null);
    const hit = this.cache.get(id);
    if (hit && Date.now() - hit.at < (hit.avatar ? 3600000 : 300000)) return Promise.resolve(hit.avatar);
    const pending = this.pending.get(id); if (pending) return pending;
    const task = this.load(id).finally(() => this.pending.delete(id)); this.pending.set(id, task); return task;
  }
  private async load(id: string): Promise<string | null> {
    let avatar: string | null = null;
    try {
      const r = await this.fetchFn(`https://steamcommunity.com/profiles/${id}/?xml=1`, { signal: AbortSignal.timeout(7000) });
      if (r.ok) {
        const xml = await r.text();
        const raw = /<avatarMedium>\s*(?:<!\[CDATA\[)?(https:[^<\]]+)/.exec(xml)?.[1]?.trim();
        if (raw) { const u = new URL(raw); if (/^(avatars\.(steamstatic\.com|cloudflare\.steamstatic\.com|akamai\.steamstatic\.com|fastly\.steamstatic\.com)|steamcdn-a\.akamaihd\.net)$/.test(u.hostname)) avatar = u.href; }
      }
    } catch { /* missing avatar must not interrupt live telemetry */ }
    this.cache.set(id, { at: Date.now(), avatar });while(this.cache.size>500)this.cache.delete(this.cache.keys().next().value!); return avatar;
  }
}
