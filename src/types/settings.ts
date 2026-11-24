export type AnnouncementLang = 'cs' | 'pl' | 'cs-pl';
export type TtsEngine = 'piper' | 'system';

export interface Settings {
  autoDetectGame: boolean;
  manualGamePath: string | null;
  recordingsPath: string | null;
  /** Spouštění je vždy přes Steam URI (jiná cesta není podporována). */
  launchViaSteam: true;
  appLanguage: 'cs';
  theme: 'blue' | 'graphite';
  dataRefreshSeconds: number;
  selectedServer: string | null;
  map: { basemap: 'osm' | 'osm-dark' | 'light'; railwayOverlay: boolean; followSelected: boolean };
  announcements: {
    auto: boolean;
    gong: boolean;
    recorded: boolean;
    language: AnnouncementLang;
    engine: TtsEngine;
    voiceId: string;
    volume: number;
    rate: number;
  };
  updates: { repo: string | null };
  /** Průvodce prvním spuštěním (nastavení hlášení) byl odložen/dokončen. */
  onboarding: { dismissed: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  autoDetectGame: true,
  manualGamePath: null,
  recordingsPath: null,
  launchViaSteam: true,
  appLanguage: 'cs',
  theme: 'blue',
  dataRefreshSeconds: 30,
  selectedServer: null,
  map: { basemap: 'osm-dark', railwayOverlay: true, followSelected: false },
  announcements: { auto: false, gong:true, recorded:true, language: 'cs', engine: 'piper', voiceId: 'cs_CZ-jirka-medium', volume: 0.8, rate: 1 },
  updates: { repo: 'kubiasofficial/simrail-hub' },
  onboarding: { dismissed: false }
};

export type SettingsPatch = { [K in keyof Settings]?: Settings[K] extends object ? Partial<Settings[K]> : Settings[K] };
