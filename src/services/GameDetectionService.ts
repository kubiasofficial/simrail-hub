import { join, dirname, resolve, sep } from 'node:path';
import { SIMRAIL_APP_ID, type DetectionResult, type GameInstall } from '../types/game';
import { parseVdf, isObject, type VdfObject } from './vdf';

export interface FsLike {
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
}

/** Vrací cestu ke Steamu z registrů Windows (nebo null). */
export type SteamPathProvider = () => Promise<string | null>;

export class GameDetectionService {
  constructor(private fs: FsLike, private getSteamPath: SteamPathProvider) {}

  /** Vypíše všechny knihovny Steamu z libraryfolders.vdf (podporuje nový i starý formát). */
  async listLibraries(steamPath: string): Promise<{ libraries: string[]; messages: string[] }> {
    const messages: string[] = [];
    const libs = new Set<string>([steamPath]);
    const file = join(steamPath, 'steamapps', 'libraryfolders.vdf');
    try {
      const root = parseVdf(await this.fs.readFile(file));
      const folders = root['libraryfolders'] ?? root['LibraryFolders'];
      if (isObject(folders)) {
        for (const [key, val] of Object.entries(folders)) {
          if (!/^\d+$/.test(key)) continue;
          if (typeof val === 'string') libs.add(val);                       // starý formát
          else if (isObject(val) && typeof val['path'] === 'string') libs.add(val['path']);
        }
      } else messages.push('Soubor libraryfolders.vdf má neočekávanou strukturu.');
    } catch (e) {
      messages.push(`Nepodařilo se přečíst ${file}: ${(e as Error).message}`);
    }
    return { libraries: [...libs], messages };
  }

  private async readManifest(libraryPath: string): Promise<VdfObject | null> {
    const file = join(libraryPath, 'steamapps', `appmanifest_${SIMRAIL_APP_ID}.acf`);
    if (!(await this.fs.exists(file))) return null;
    const root = parseVdf(await this.fs.readFile(file));
    const state = root['AppState'];
    if (!isObject(state) || state['appid'] !== SIMRAIL_APP_ID) return null;
    return state;
  }

  private async installFromLibrary(libraryPath: string, source: GameInstall['source']): Promise<GameInstall | null> {
    const state = await this.readManifest(libraryPath);
    if (!state || typeof state['installdir'] !== 'string') return null;
    const installDir = state['installdir'];
    // Ochrana proti cestám typu ..\..\ v manifestu.
    if (installDir.includes('..') || installDir.includes('/') || installDir.includes('\\')) return null;
    const path = join(libraryPath, 'steamapps', 'common', installDir);
    if (!(await this.fs.exists(path))) return null;
    const size = Number(state['SizeOnDisk']);
    return {
      path, libraryPath, installDir, source,
      buildId: typeof state['buildid'] === 'string' ? state['buildid'] : null,
      sizeOnDisk: Number.isFinite(size) && size > 0 ? size : null
    };
  }

  async detect(): Promise<DetectionResult> {
    const messages: string[] = [];
    const steamPath = await this.getSteamPath();
    if (!steamPath) {
      return { install: null, steamPath: null, libraries: [], messages: ['Steam nebyl v registrech Windows nalezen. Vyberte složku hry ručně.'] };
    }
    const { libraries, messages: libMsgs } = await this.listLibraries(steamPath);
    messages.push(...libMsgs);
    for (const lib of libraries) {
      try {
        const install = await this.installFromLibrary(lib, 'steam-library');
        if (install) return { install, steamPath, libraries, messages };
      } catch (e) {
        messages.push(`Knihovna ${lib}: ${(e as Error).message}`);
      }
    }
    messages.push(`SimRail (App ID ${SIMRAIL_APP_ID}) nebyl v žádné z ${libraries.length} knihoven Steamu nalezen.`);
    return { install: null, steamPath, libraries, messages };
  }

  /** Ověří ručně vybranou složku: musí ležet v steamapps/common a odpovídat manifestu SimRailu. */
  async validateManual(folder: string): Promise<{ install: GameInstall } | { error: string }> {
    const abs = resolve(folder);
    const parts = abs.split(sep);
    const commonIdx = parts.lastIndexOf('common');
    if (commonIdx < 2 || parts[commonIdx - 1].toLowerCase() !== 'steamapps' || parts.length !== commonIdx + 2) {
      return { error: 'Vyberte přímo složku hry uvnitř „steamapps/common“ (např. …/steamapps/common/SimRail).' };
    }
    const libraryPath = dirname(dirname(dirname(abs)));
    try {
      const install = await this.installFromLibrary(libraryPath, 'manual');
      if (!install) return { error: 'V této knihovně Steamu není manifest SimRailu (appmanifest_1422130.acf).' };
      if (resolve(install.path).toLowerCase() !== abs.toLowerCase()) {
        return { error: `Vybraná složka neodpovídá instalaci SimRailu (očekávána složka „${install.installDir}“).` };
      }
      return { install };
    } catch (e) {
      return { error: `Manifest hry se nepodařilo přečíst: ${(e as Error).message}` };
    }
  }
}
