import { describe, it, expect, vi } from 'vitest';
import { SteamService, parseRegQuery, STEAM_LAUNCH_URI } from '../src/services/SteamService';

describe('parseRegQuery', () => {
  it('přečte SteamPath z výstupu reg query', () => {
    const out = '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n';
    expect(parseRegQuery(out, 'SteamPath')).toBe('c:/program files (x86)/steam');
  });
  it('vrátí null, pokud hodnota chybí', () => {
    expect(parseRegQuery('nic', 'SteamPath')).toBeNull();
  });
});

describe('SteamService', () => {
  it('spouští výhradně steam://rungameid/1422130', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    expect(await new SteamService(open).launchGame()).toEqual({ ok: true });
    expect(open).toHaveBeenCalledWith('steam://rungameid/1422130');
    expect(STEAM_LAUNCH_URI).toBe('steam://rungameid/1422130');
  });
  it('vrátí srozumitelnou chybu, když se URI nepodaří otevřít', async () => {
    const r = await new SteamService(vi.fn().mockRejectedValue(new Error('x'))).launchGame();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/Steam se nepodařilo spustit/);
  });
});
