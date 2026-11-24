import type { FetchLike } from '../adapters/simrailApi';
import {CLOUD} from './cloudConfig';

export interface UpdateInfo { status: 'unconfigured' | 'current' | 'available' | 'error'; latest?: string; url?: string; message: string }

/** Porovná verze „1.2.3“ (předčíslí v je ignorováno). Vrací >0, když a je novější než b. */
export function compareVersions(a: string, b: string): number {
  const p = (v: string) => v.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Kontrola nové verze přes GitHub Releases uživatelem nastaveného repozitáře (owner/name). */
export class UpdateService {
  constructor(private fetchFn: FetchLike, private currentVersion: string) {}
  async check(repo: string | null): Promise<UpdateInfo> {
    repo=repo??CLOUD.repository;
    try {
      const res = await this.fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.status === 404) return { status: 'error', message: 'Repozitář nebo vydání nebylo nalezeno.' };
      if (!res.ok) return { status: 'error', message: `GitHub vrátil chybu HTTP ${res.status}.` };
      const j = JSON.parse(await res.text()) as { tag_name?: string; html_url?: string };
      if (!j.tag_name) return { status: 'error', message: 'Odpověď GitHubu neobsahuje číslo verze.' };
      return compareVersions(j.tag_name, this.currentVersion) > 0
        ? { status: 'available', latest: j.tag_name, url: j.html_url, message: `Je dostupná verze ${j.tag_name}.` }
        : { status: 'current', latest: j.tag_name, message: 'Používáte nejnovější verzi.' };
    } catch (e) {
      return { status: 'error', message: `Kontrola se nezdařila: ${(e as Error).message}` };
    }
  }
}
