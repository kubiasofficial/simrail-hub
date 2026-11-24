import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../types/settings';

const clamp = (n: unknown, min: number, max: number, def: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], def: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : def;
const strOrNull = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

/** Přijme libovolný (i poškozený) objekt a vrátí vždy platné nastavení; neznámé klíče zahodí. */
export function normalizeSettings(raw: unknown): Settings {
  const r = rec(raw);
  const d = DEFAULT_SETTINGS;
  const map = rec(r.map);
  const an = rec(r.announcements);
  const up = rec(r.updates);
  const ob = rec(r.onboarding);
  return {
    autoDetectGame: bool(r.autoDetectGame, d.autoDetectGame),
    manualGamePath: strOrNull(r.manualGamePath),
    launchViaSteam: true,
    appLanguage: 'cs',
    theme: oneOf(r.theme, ['blue', 'graphite'] as const, d.theme),
    dataRefreshSeconds: clamp(r.dataRefreshSeconds, 15, 300, d.dataRefreshSeconds),
    selectedServer: strOrNull(r.selectedServer, 50),
    map: {
      basemap: oneOf(map.basemap, ['osm', 'osm-dark', 'light'] as const, d.map.basemap),
      railwayOverlay: bool(map.railwayOverlay, d.map.railwayOverlay),
      followSelected: bool(map.followSelected, d.map.followSelected)
    },
    announcements: {
      auto: bool(an.auto, d.announcements.auto),
      language: oneOf(an.language, ['cs', 'pl', 'cs-pl'] as const, d.announcements.language),
      engine: oneOf(an.engine, ['piper', 'system'] as const, d.announcements.engine),
      voiceId: strOrNull(an.voiceId, 100) ?? d.announcements.voiceId,
      volume: clamp(an.volume, 0, 1, d.announcements.volume),
      rate: clamp(an.rate, 0.5, 2, d.announcements.rate)
    },
    updates: { repo: typeof up.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(up.repo) ? up.repo : d.updates.repo },
    onboarding: { dismissed: bool(ob.dismissed, false) }
  };
}

/** Sloučí částečnou změnu do aktuálního nastavení (jen o jednu úroveň hloubky) a znovu zvaliduje. */
export function applyPatch(current: Settings, patch: SettingsPatch): Settings {
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(rec(patch))) {
    const cur = (current as unknown as Record<string, unknown>)[k];
    merged[k] = typeof v === 'object' && v !== null && typeof cur === 'object' && cur !== null ? { ...cur, ...v } : v;
  }
  return normalizeSettings(merged);
}
