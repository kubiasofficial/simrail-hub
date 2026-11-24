import { readFile } from 'node:fs/promises';
import { Database } from './Database';
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../types/settings';
import { applyPatch, normalizeSettings } from './settingsSchema';

const KEY = 'settings';

/** Perzistentní nastavení v SQLite (AppData). Při prvním spuštění převezme starý settings.json z kroku 2. */
export class SettingsService {
  private cache: Settings | null = null;
  constructor(private database: Database, private legacyJsonFile?: string) {}

  async get(): Promise<Settings> {
    if (this.cache) return this.cache;
    const stored = this.database.getKv(KEY);
    if (stored) {
      try { this.cache = normalizeSettings(JSON.parse(stored)); return this.cache; } catch { /* poškozeno → výchozí */ }
    } else if (this.legacyJsonFile) {
      try {
        const legacy = JSON.parse(await readFile(this.legacyJsonFile, 'utf8')) as { manualGamePath?: unknown };
        this.cache = normalizeSettings({ manualGamePath: legacy.manualGamePath });
        this.database.setKv(KEY, JSON.stringify(this.cache));
        return this.cache;
      } catch { /* žádný starý soubor */ }
    }
    this.cache = structuredClone(DEFAULT_SETTINGS);
    return this.cache;
  }

  async update(patch: SettingsPatch): Promise<Settings> {
    const next = applyPatch(await this.get(), patch);
    this.database.setKv(KEY, JSON.stringify(next));
    this.cache = next;
    return next;
  }
}
