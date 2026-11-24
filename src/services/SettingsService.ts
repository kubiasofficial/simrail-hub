import { readFile } from 'node:fs/promises';
import { Database } from './Database';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../types/settings';
import { applyPatch, normalizeSettings } from './settingsSchema';

const KEY = 'settings';

/** Perzistentní nastavení v SQLite (AppData). Při prvním spuštění převezme starý settings.json z kroku 2. */
export class SettingsService {
  private cache: Settings | null = null;
  private loading:Promise<Settings>|null=null;
  private updating:Promise<unknown>=Promise.resolve();
  constructor(private database: Database, private legacyJsonFile?: string) {}

  get():Promise<Settings>{if(this.cache)return Promise.resolve(this.cache);if(!this.loading)this.loading=this.load().finally(()=>this.loading=null);return this.loading;}
  private async load(): Promise<Settings> {
    if (this.cache) return this.cache;
    const stored = this.database.getKv(KEY);
    if (stored) {
      try { this.cache = normalizeSettings(JSON.parse(stored)); return this.cache; } catch { if(!this.database.getKv('settings.corrupt.backup'))this.database.setKv('settings.corrupt.backup',stored); }
    } else if (this.legacyJsonFile) {
      try {
        const legacy:unknown = JSON.parse(await readFile(this.legacyJsonFile, 'utf8'));
        this.cache = normalizeSettings(legacy);
        this.database.setKv(KEY, JSON.stringify(this.cache));
        return this.cache;
      } catch { /* žádný starý soubor */ }
    }
    this.cache = structuredClone(DEFAULT_SETTINGS);
    return this.cache;
  }

  update(patch:SettingsPatch):Promise<Settings>{const run=this.updating.then(()=>this.apply(patch));this.updating=run.catch(()=>undefined);return run;}
  private async apply(patch: SettingsPatch): Promise<Settings> {
    const next = applyPatch(await this.get(), patch);
    this.database.setKv(KEY, JSON.stringify(next));
    this.cache = next;
    return next;
  }
}
