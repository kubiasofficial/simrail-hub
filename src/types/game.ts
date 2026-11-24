export const SIMRAIL_APP_ID = '1422130';

export type DetectionSource = 'steam-library' | 'manual';

export interface GameInstall {
  /** Absolutní cesta ke složce hry (…/steamapps/common/<installdir>). */
  path: string;
  libraryPath: string;
  installDir: string;
  buildId: string | null;
  sizeOnDisk: number | null;
  source: DetectionSource;
}

export interface DetectionResult {
  install: GameInstall | null;
  steamPath: string | null;
  libraries: string[];
  /** Srozumitelné důvody, proč se hra nenašla (nebo upozornění). */
  messages: string[];
}

export type LaunchResult = { ok: true } | { ok: false; error: string };
export type PickFolderResult =
  | { ok: true; result: DetectionResult }
  | { ok: false; error: string }
  | { ok: false; canceled: true };
