import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { SIMRAIL_APP_ID, type LaunchResult } from '../types/game';
import type { SteamPathProvider } from './GameDetectionService';

const run = promisify(execFile);

/** Z výstupu `reg query` vytáhne hodnotu typu REG_SZ. */
export function parseRegQuery(output: string, valueName: string): string | null {
  const re = new RegExp(`^\\s*${valueName}\\s+REG_SZ\\s+(.+?)\\s*$`, 'im');
  return re.exec(output)?.[1] ?? null;
}

const REG_LOOKUPS: [string, string][] = [
  ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
  ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
  ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath']
];

export const windowsSteamPath: SteamPathProvider = async () => {
  if (process.platform !== 'win32') return null;
  for (const [key, name] of REG_LOOKUPS) {
    try {
      const { stdout } = await run('reg', ['query', key, '/v', name], { windowsHide: true });
      const v = parseRegQuery(stdout, name);
      if (v) return v.replace(/\//g, '\\');
    } catch { /* klíč neexistuje – zkusíme další */ }
  }
  return null;
};

export const STEAM_LAUNCH_URI = `steam://rungameid/${SIMRAIL_APP_ID}`;

export class SteamService {
  constructor(private openExternal: (url: string) => Promise<void>) {}

  /** Spustí SimRail přes Steam URI. Jiné URI se nikdy neotevře. */
  async launchGame(): Promise<LaunchResult> {
    try {
      await this.openExternal(STEAM_LAUNCH_URI);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `Steam se nepodařilo spustit: ${(e as Error).message}. Je Steam nainstalovaný?` };
    }
  }
}
