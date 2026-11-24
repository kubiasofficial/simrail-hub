import { describe, it, expect, vi } from 'vitest';
import { ApiError, fetchJson, parseServers, parseStats, pick } from '../src/adapters/simrailApi';
import { ServerService } from '../src/services/ServerService';

// POZOR: vzorová data vycházejí z dokumentace komunitního SDK (@simrail-sdk/api-core-node), nejsou to záznamy živého API.
const serversJson = { result: true, count: 2, description: 'OK', data: [
  { id: 'a1', IsActive: true, ServerCode: 'en1', ServerName: 'EN1 (English)', ServerRegion: 'Europe' },
  { id: 'a2', IsActive: false, ServerCode: 'cz1', ServerName: 'CZ1', ServerRegion: 'Europe' },
  { id: 'bad', ServerName: 'bez kódu' }
] };
const trainsJson = { result: true, count: 3, data: [
  { Type: 'bot', TrainNoLocal: '1' }, { Type: 'user', TrainNoLocal: '2' }, { Type: 'user', TrainNoLocal: '3' }
] };
const stationsJson = { result: true, count: 2, data: [{ Name: 'Katowice', DispatchedBy: [{ SteamId: '1' }] }, { Name: 'Kraków', DispatchedBy: [] }] };

const resp = (body: unknown, ok = true, status = 200) => ({ ok, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

describe('parsování', () => {
  it('přečte servery, vynechá záznamy bez kódu a odvodí jazyk jen z názvu', () => {
    const s = parseServers(serversJson);
    expect(s.map((x) => x.code)).toEqual(['en1', 'cz1']);
    expect(s[0]).toMatchObject({ language: 'English', region: 'Europe', active: true });
    expect(s[1].language).toBeNull();
    expect(s[1].active).toBe(false);
  });
  it('pick ignoruje velikost písmen', () => { expect(pick({ ServerCode: 'x' }, 'servercode')).toBe('x'); });
  it('spočítá hráče a dispečery', () => {
    expect(parseStats(trainsJson, stationsJson)).toEqual({ trainsTotal: 3, trainsUser: 2, trainsBot: 1, dispatchers: 1 });
  });
  it('odmítne neočekávanou strukturu i result:false', () => {
    expect(() => parseServers({ foo: 1 })).toThrow(/struktur/);
    expect(() => parseServers({ result: false, description: 'chyba' })).toThrow(/neúspěch: chyba/);
  });
});

describe('fetchJson', () => {
  it('blokuje neschválené domény', async () => {
    await expect(fetchJson(vi.fn(), 'https://example.com/x')).rejects.toMatchObject({ kind: 'blocked' });
  });
  it('převede HTTP chybu, špatný JSON i síťovou chybu na srozumitelné ApiError', async () => {
    const u = 'https://panel.simrail.eu:8084/servers-open';
    await expect(fetchJson(async () => resp('', false, 503), u)).rejects.toThrow(/HTTP 503/);
    await expect(fetchJson(async () => resp('<html>'), u)).rejects.toThrow(/platný JSON/);
    await expect(fetchJson(async () => { throw new Error('ECONNRESET'); }, u)).rejects.toBeInstanceOf(ApiError);
  });
  it('ohlásí timeout', async () => {
    const hang = (_u: string, init?: { signal?: AbortSignal }) => new Promise<never>((_, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
    await expect(fetchJson(hang, 'https://panel.simrail.eu:8084/servers-open', 20)).rejects.toMatchObject({ kind: 'timeout' });
  });
});

describe('ServerService', () => {
  const route = (url: string) => url.includes('servers-open') ? resp(serversJson) : url.includes('trains-open') ? resp(trainsJson) : resp(stationsJson);

  it('sestaví přehled a pro neaktivní server nevolá statistiky', async () => {
    const f = vi.fn(async (u: string) => route(u));
    const r = await new ServerService(f).getServers();
    expect(r.ok && r.snapshot.servers.find((s) => s.code === 'en1')?.stats?.trainsUser).toBe(2);
    expect(r.ok && r.snapshot.servers.find((s) => s.code === 'cz1')?.stats).toBeNull();
    expect(f.mock.calls.some(([u]) => u.includes('serverCode=cz1'))).toBe(false);
  });
  it('výpadek statistik jednoho serveru nezboří celý seznam', async () => {
    const f = async (u: string) => u.includes('trains-open') ? resp('x', false, 500) : route(u);
    const r = await new ServerService(f).getServers();
    expect(r.ok && r.snapshot.servers[0].statsError).toMatch(/HTTP 500/);
  });
  it('při výpadku seznamu serverů vrátí chybu v češtině', async () => {
    const r = await new ServerService(async () => { throw new Error('offline'); }).getServers();
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toMatch(/Seznam serverů se nepodařilo načíst/);
  });
  it('neomezuje API: dotaz do 10 s vrací cache, ruční až po 3 s', async () => {
    let t = 0; const f = vi.fn(async (u: string) => route(u));
    const s = new ServerService(f, () => t);
    await s.getServers(); const calls = f.mock.calls.length;
    t = 5_000; await s.getServers(); expect(f.mock.calls.length).toBe(calls);
    await s.getServers(true); expect(f.mock.calls.length).toBeGreaterThan(calls);
  });
});
