import {DEFAULT_RADIO,type RadioPreferences} from '../services/radioPreferences';
import type {AppLocale} from './locale';
export type AnnouncementLang = 'cs' | 'pl' | 'cs-pl';
export type TtsEngine = 'piper' | 'system';

export interface Settings {
  autoDetectGame: boolean;
  manualGamePath: string | null;
  recordingsPath: string | null;
  /** Spouštění je vždy přes Steam URI (jiná cesta není podporována). */
  launchViaSteam: true;
  appLanguage: AppLocale;
  appCountry:string;
  animations:boolean;
  ownedDlc:number[];
  radio:RadioPreferences;
  theme: 'blue' | 'graphite';
  dataRefreshSeconds: number;
  selectedServer: string | null;
  map: { basemap: 'osm' | 'osm-dark' | 'light'; railwayOverlay: boolean; followSelected: boolean; sneakPeek:boolean };
  announcements: {
    auto: boolean;
    welcome:boolean; luggage:boolean; waiting:boolean; journeyInfo:boolean; exit:boolean; seasonal:boolean;
    gapSeconds:number;
    gong: boolean;
    gongEnd:boolean;
    gongVolume:number;
    recorded: boolean;
    language: AnnouncementLang;
    engine: TtsEngine;
    voiceId: string;
    volume: number;
    rate: number;
  };
  dispatcher:{enabled:boolean;audio:boolean;rangeKm:number;verbosity:'brief'|'normal'|'detailed';volume:number;radioVolume:number};
  updates: { repo: string | null };
  /** Průvodce prvním spuštěním (nastavení hlášení) byl odložen/dokončen. */
  onboarding: { dismissed: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  autoDetectGame: true,
  manualGamePath: null,
  recordingsPath: null,
  launchViaSteam: true,
  appLanguage: 'cs',appCountry:'cz',
  animations:true,
  ownedDlc:[],
  radio:structuredClone(DEFAULT_RADIO),
  theme: 'blue',
  dataRefreshSeconds: 30,
  selectedServer: null,
  map: { basemap: 'osm-dark', railwayOverlay: true, followSelected: false, sneakPeek:false },
  announcements: { auto: false, welcome:true, luggage:true, waiting:true, journeyInfo:true, exit:true, seasonal:true, gapSeconds:30, gong:true, gongEnd:true, gongVolume:0.8, recorded:true, language: 'cs', engine: 'piper', voiceId: 'cs_CZ-jirka-medium', volume: 0.8, rate: 1 },
  dispatcher:{enabled:false,audio:false,rangeKm:5,verbosity:'normal',volume:0.8,radioVolume:0.65},
  updates: { repo: 'kubiasofficial/simrail-hub' },
  onboarding: { dismissed: false }
};

export type SettingsPatch = { [K in keyof Settings]?: Settings[K] extends object ? Partial<Settings[K]> : Settings[K] };
