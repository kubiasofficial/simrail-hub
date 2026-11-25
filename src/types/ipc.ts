import type { ServersResult } from './servers';
import type { Settings, SettingsPatch } from './settings';
import type { TrainDetailResult, TrainsResult } from './trains';
import type { InstalledMod, ActiveModContent } from './mods';
import type { DetectionResult, LaunchResult, PickFolderResult } from './game';

export interface AppInfo {
  channel: import('../services/releaseChannel').ReleaseChannel;
  buildId: string | null;
  version: string;
  platform: string;
  electron: string;
}

export interface WindowState {
  maximized: boolean;
  minimized?:boolean;
}

/** Povolené IPC kanály – jediný zdroj pravdy pro main i preload. */
export const IPC = {
  appInfo: 'app:info',
  winMinimize: 'window:minimize',
  winToggleMaximize: 'window:toggle-maximize',
  winClose: 'window:close',
  winState: 'window:state',
  winStateChanged: 'window:state-changed',
  gameDetect: 'game:detect',
  gameLaunch: 'game:launch',
  gamePickFolder: 'game:pick-folder',
  gameClearManual: 'game:clear-manual',
  serversGet: 'servers:get'
} as const;

export interface SimRailHubApi {
  getAppInfo(): Promise<AppInfo>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<WindowState>;
  close(): Promise<void>;
  getWindowState(): Promise<WindowState>;
  onWindowStateChanged(cb: (s: WindowState) => void): () => void;
  detectGame(): Promise<DetectionResult>;
  launchGame(): Promise<LaunchResult>;
  pickGameFolder(): Promise<PickFolderResult>;
  clearManualGamePath(): Promise<DetectionResult>;
  getServers(force?: boolean): Promise<ServersResult>;
  call<C extends CallChannel>(channel: C, ...args: IpcMap[C]['args']): Promise<IpcMap[C]['result']>;
  onTtsProgress(cb: (p: TtsProgressDto) => void): () => void;
}

export type Res<T> = { ok: true; data: T; message?: string } | { ok: false; error: string };

export interface TtsStatusDto {
  supported: boolean; piperInstalled: boolean;
  voices: { id: string; label: string; lang: 'cs'|'pl'; sizeMB: number; license: string; installed: boolean }[];
  cacheBytes: number; cacheFiles: number;
}
export interface DiagInfo {
  fixtures: boolean; appVersion: string; electron: string; chrome: string; node: string; platform: string; arch: string;
  userData: string; logFile: string; dbFile: string; modsDir: string;
}
export interface UpdateInfoDto { status: 'unconfigured' | 'current' | 'available' | 'error'; latest?: string; url?: string; message: string }

/** Typované „volací“ kanály (kromě specializovaných metod výše). Preload pustí jen kanály z CALL_CHANNELS. */
export interface IpcMap {
  'dlc:list':{args:[string];result:Res<import('./dlc').DlcCatalog>};
  'audio:gong':{args:[];result:Res<Uint8Array>};
  'recordings:status':{args:[];result:Res<import('../services/localAudio').RecordingStatus>};
  'recordings:choose':{args:[];result:Res<import('../services/localAudio').RecordingStatus|null>};
  'recordings:render':{args:[import('../services/localAudio').RecordingRequest,boolean];result:Res<Uint8Array|null>};
  'settings:get': { args: []; result: Settings };
  'settings:update': { args: [SettingsPatch]; result: Settings };
  'stations:board': { args: [string, string]; result: Res<{ number:string; arrival:string|null; departure:string|null; destination:string|null }[]> };
  'stations:list': { args: [string]; result: Res<import('./trains').StationCoord[]> };
  'mobile:start': { args: [string, string]; result: Res<{ urls: string[]; expiresAt: number }> };
  'mobile:stop': { args: []; result: Res<null> };
  'trains:list': { args: [string]; result: TrainsResult };
  'trains:route': { args:[string,string];result:Res<import('./route').TrainRoute> };
  'dashboard:stop': {args:[];result:Res<null>};
  'trains:detail': { args: [string, string]; result: TrainDetailResult };
  'tts:status': { args: []; result: Res<TtsStatusDto> };
  'tts:install-piper': { args: []; result: Res<null> };
  'tts:install-voice': { args: [string]; result: Res<null> };
  'tts:synthesize': { args: [string, string, number]; result: Res<Uint8Array> };
  'tts:clear-cache': { args: []; result: Res<number> };
  'dict:list': { args: []; result: Res<{ word: string; spoken: string }[]> };
  'dict:set': { args: [string, string]; result: Res<null> };
  'dict:delete': { args: [string]; result: Res<null> };
  'mods:list': { args: []; result: Res<InstalledMod[]> };
  'mods:import': { args: []; result: Res<InstalledMod[] | null> };
  'mods:set-enabled': { args: [string, boolean]; result: Res<InstalledMod[]> };
  'mods:uninstall': { args: [string]; result: Res<InstalledMod[]> };
  'mods:backup': { args: []; result: Res<string> };
  'mods:backups': { args: []; result: Res<{ name: string; bytes: number }[]> };
  'mods:restore': { args: [string]; result: Res<{ restored: number; skipped: string[] }> };
  'mods:active': { args: []; result: Res<ActiveModContent> };
  'dashboard:open': { args: [string | null, string | null]; result: Res<null> };
  'diag:info': { args: []; result: DiagInfo };
  'diag:export-logs': { args: []; result: Res<string | null> };
  'update:status': {args:[];result:import('../services/AutomaticUpdates').AutomaticUpdateState};
  'update:auto-check': {args:[];result:import('../services/AutomaticUpdates').AutomaticUpdateState};
  'update:install': {args:[];result:boolean};
  'update:check': { args: []; result: UpdateInfoDto };
}
export type CallChannel = keyof IpcMap;
export const CALL_CHANNELS: readonly CallChannel[] = [
  'dlc:list','update:status','update:auto-check','update:install','audio:gong','recordings:status','recordings:choose','recordings:render',
  'stations:board', 'stations:list', 'mobile:start', 'mobile:stop', 'settings:get', 'settings:update', 'trains:list', 'trains:detail', 'trains:route','dashboard:stop', 'tts:status', 'tts:install-piper', 'tts:install-voice', 'tts:synthesize',
  'tts:clear-cache', 'dict:list', 'dict:set', 'dict:delete', 'mods:list', 'mods:import', 'mods:set-enabled', 'mods:uninstall', 'mods:backup',
  'mods:backups', 'mods:restore', 'mods:active', 'dashboard:open', 'diag:info', 'diag:export-logs', 'update:check'
];
export const TTS_PROGRESS = 'tts:progress';
export interface TtsProgressDto { task: string; fraction: number | null }
