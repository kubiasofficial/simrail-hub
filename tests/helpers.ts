import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FsLike } from '../src/services/GameDetectionService';

export const realFs: FsLike = {
  readFile: (p) => readFile(p, 'utf8'),
  exists: (p) => access(p).then(() => true, () => false)
};

export const tmp = () => mkdtemp(join(tmpdir(), 'simrailhub-'));

/** Vytvoří knihovnu Steamu; s installdir přidá i manifest a složku hry. */
export async function makeLibrary(root: string, installDir?: string, appId = '1422130') {
  await mkdir(join(root, 'steamapps', 'common'), { recursive: true });
  if (installDir) {
    await mkdir(join(root, 'steamapps', 'common', installDir), { recursive: true });
    await writeFile(join(root, 'steamapps', `appmanifest_1422130.acf`),
      `"AppState"\n{\n\t"appid"\t\t"${appId}"\n\t"installdir"\t\t"${installDir}"\n\t"SizeOnDisk"\t\t"12345678"\n\t"buildid"\t\t"999"\n}\n`);
  }
}

export async function writeLibraryFolders(steamRoot: string, paths: string[]) {
  const esc = (p: string) => p.replace(/\\/g, '\\\\');
  const body = paths.map((p, i) => `\t"${i}"\n\t{\n\t\t"path"\t\t"${esc(p)}"\n\t\t"apps"\n\t\t{\n\t\t\t"1422130"\t\t"1"\n\t\t}\n\t}`).join('\n');
  await mkdir(join(steamRoot, 'steamapps'), { recursive: true });
  await writeFile(join(steamRoot, 'steamapps', 'libraryfolders.vdf'), `"libraryfolders"\n{\n${body}\n}\n`);
}
