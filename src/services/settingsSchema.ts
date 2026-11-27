import {normalizeRadio} from './radioPreferences';
import {APP_LOCALES} from '../types/locale';
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
  const dispatch=rec(r.dispatcher);
  const ob = rec(r.onboarding);
  return {
    autoDetectGame: bool(r.autoDetectGame, d.autoDetectGame),
    manualGamePath: strOrNull(r.manualGamePath),
    recordingsPath: strOrNull(r.recordingsPath),
    launchViaSteam: true,
    appLanguage:oneOf(r.appLanguage,APP_LOCALES,'cs'),
    appCountry:oneOf(r.appCountry,['cz','de','pl','fr','sk','at','be','bg','hr','cy','dk','ee','fi','gr','hu','ie','it','lv','lt','lu','mt','nl','pt','ro','si','es','se','gb'] as const,'cz'),
    animations: bool(r.animations,d.animations),
    radio:normalizeRadio(r.radio),
    ownedDlc:Array.isArray(r.ownedDlc)?[...new Set(r.ownedDlc.filter((x):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0))].slice(0,50):[],
    theme: oneOf(r.theme, ['blue', 'graphite'] as const, d.theme),
    dataRefreshSeconds: clamp(r.dataRefreshSeconds, 15, 300, d.dataRefreshSeconds),
    selectedServer: strOrNull(r.selectedServer, 50),
    map: {
      basemap: oneOf(map.basemap, ['osm', 'osm-dark', 'light'] as const, d.map.basemap),
      railwayOverlay: bool(map.railwayOverlay, d.map.railwayOverlay),
      followSelected: bool(map.followSelected, d.map.followSelected),
      sneakPeek:bool(map.sneakPeek,false)
    },
    announcements: {
      auto: bool(an.auto, d.announcements.auto),
      welcome:bool(an.welcome,true), luggage:bool(an.luggage,true), waiting:bool(an.waiting,true),
      gapSeconds:clamp(an.gapSeconds,10,60,d.announcements.gapSeconds),
      gong: bool(an.gong,d.announcements.gong),
      gongEnd:bool(an.gongEnd,bool(an.gong,d.announcements.gongEnd)),
      gongVolume:clamp(an.gongVolume,0,1,clamp(an.volume,0,1,d.announcements.gongVolume)),
      recorded: bool(an.recorded,d.announcements.recorded),
      language: oneOf(an.language, ['cs', 'pl', 'cs-pl'] as const, d.announcements.language),
      engine: oneOf(an.engine, ['piper', 'system'] as const, d.announcements.engine),
      voiceId: strOrNull(an.voiceId, 100) ?? d.announcements.voiceId,
      volume: clamp(an.volume, 0, 1, d.announcements.volume),
      rate: clamp(an.rate, 0.5, 2, d.announcements.rate)
    },
    dispatcher:{enabled:bool(dispatch.enabled,false),audio:bool(dispatch.audio,false),rangeKm:[2,5,10].includes(Number(dispatch.rangeKm))?Number(dispatch.rangeKm):5,volume:clamp(dispatch.volume,0,1,0.8),radioVolume:clamp(dispatch.radioVolume,0,1,0.65)},
    updates: { repo: typeof up.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(up.repo) ? up.repo : d.updates.repo },
    onboarding: { dismissed: bool(ob.dismissed, false) }
  };
}

/** Sloučí částečnou změnu do aktuálního nastavení (jen o jednu úroveň hloubky) a znovu zvaliduje. */
export function applyPatch(current: Settings, patch: SettingsPatch): Settings {
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(rec(patch))) {
    const cur = (current as unknown as Record<string, unknown>)[k];
    merged[k] = typeof v === 'object' && v !== null && !Array.isArray(v) && typeof cur === 'object' && cur !== null ? { ...cur, ...v } : v;
  }
  return normalizeSettings(merged);
}
