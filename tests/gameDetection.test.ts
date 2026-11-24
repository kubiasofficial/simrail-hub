import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { GameDetectionService } from '../src/services/GameDetectionService';
import { realFs, tmp, makeLibrary, writeLibraryFolders } from './helpers';

describe('GameDetectionService', () => {
  it('najde hru ve druhé knihovně (více disků)', async () => {
    const steam = await tmp(); const lib2 = await tmp();
    await makeLibrary(steam); await makeLibrary(lib2, 'SimRail');
    await writeLibraryFolders(steam, [steam, lib2]);
    const r = await new GameDetectionService(realFs, async () => steam).detect();
    expect(r.install?.path).toBe(join(lib2, 'steamapps', 'common', 'SimRail'));
    expect(r.install?.buildId).toBe('999');
    expect(r.libraries).toHaveLength(2);
  });

  it('zvládne starý formát libraryfolders.vdf', async () => {
    const steam = await tmp(); const lib2 = await tmp();
    await makeLibrary(lib2, 'SimRail');
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(steam, 'steamapps'), { recursive: true });
    await writeFile(join(steam, 'steamapps', 'libraryfolders.vdf'), `"LibraryFolders"\n{\n "TimeNextStatsReport" "1"\n "1" "${lib2.replace(/\\/g, '\\\\')}"\n}`);
    const r = await new GameDetectionService(realFs, async () => steam).detect();
    expect(r.install?.libraryPath).toBe(lib2);
  });

  it('vrátí srozumitelnou zprávu, když Steam chybí', async () => {
    const r = await new GameDetectionService(realFs, async () => null).detect();
    expect(r.install).toBeNull();
    expect(r.messages[0]).toMatch(/Steam nebyl/);
  });

  it('nenajde hru bez manifestu nebo s cizím appid', async () => {
    const steam = await tmp(); const lib = await tmp();
    await makeLibrary(steam); await makeLibrary(lib, 'SimRail', '999');
    await writeLibraryFolders(steam, [steam, lib]);
    const r = await new GameDetectionService(realFs, async () => steam).detect();
    expect(r.install).toBeNull();
    expect(r.messages.at(-1)).toMatch(/nebyl v žádné/);
  });

  it('odmítne installdir s path traversal v manifestu', async () => {
    const steam = await tmp();
    await makeLibrary(steam, '..');
    await writeLibraryFolders(steam, [steam]);
    const r = await new GameDetectionService(realFs, async () => steam).detect();
    expect(r.install).toBeNull();
  });

  it('přežije poškozený libraryfolders.vdf a hledá aspoň v hlavní knihovně', async () => {
    const steam = await tmp(); await makeLibrary(steam, 'SimRail');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(steam, 'steamapps', 'libraryfolders.vdf'), '"libraryfolders" {');
    const r = await new GameDetectionService(realFs, async () => steam).detect();
    expect(r.install?.source).toBe('steam-library');
    expect(r.messages.join(' ')).toMatch(/Nepodařilo se přečíst/);
  });

  describe('ruční výběr složky', () => {
    it('přijme správnou složku', async () => {
      const lib = await tmp(); await makeLibrary(lib, 'SimRail');
      const v = await new GameDetectionService(realFs, async () => null).validateManual(join(lib, 'steamapps', 'common', 'SimRail'));
      expect('install' in v && v.install.source).toBe('manual');
    });
    it('odmítne složku mimo steamapps/common', async () => {
      const v = await new GameDetectionService(realFs, async () => null).validateManual(await tmp());
      expect('error' in v).toBe(true);
    });
    it('odmítne jinou hru v téže knihovně', async () => {
      const lib = await tmp(); await makeLibrary(lib, 'SimRail');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(lib, 'steamapps', 'common', 'JinaHra'));
      const v = await new GameDetectionService(realFs, async () => null).validateManual(join(lib, 'steamapps', 'common', 'JinaHra'));
      expect('error' in v && v.error).toMatch(/neodpovídá/);
    });
    it('odmítne podsložku hry', async () => {
      const lib = await tmp(); await makeLibrary(lib, 'SimRail');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(lib, 'steamapps', 'common', 'SimRail', 'Content'));
      const v = await new GameDetectionService(realFs, async () => null).validateManual(join(lib, 'steamapps', 'common', 'SimRail', 'Content'));
      expect('error' in v).toBe(true);
    });
  });
});
