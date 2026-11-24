import { app, net, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { Database } from '../services/Database';
import { SettingsService } from '../services/SettingsService';
import { LogService } from '../services/LogService';
import { ModManager } from '../services/ModManager';
import { TextToSpeechService, type TtsDeps } from '../services/TextToSpeechService';
import { TrainTrackingService } from '../services/TrainTrackingService';
import { UpdateService } from '../services/UpdateService';
import { TTS_PROGRESS } from '../types/ipc';
import type { FetchLike } from '../adapters/simrailApi';
import { fixtureFetch } from './docsFixtures';

export interface AppContext {
  db: Database; settings: SettingsService; log: LogService; mods: ModManager; tts: TextToSpeechService;
  tracking: TrainTrackingService; updates: UpdateService; fetchFn: FetchLike; fixtures: boolean;
  paths: { userData: string; db: string; mods: string };
  broadcastProgress(p: { task: string; fraction: number | null }): void;
}

export function createContext(): AppContext {
  const userData = app.getPath('userData');
  const log = new LogService(join(userData, 'logs'));
  const dbFile = join(userData, 'simrail-hub.db');
  const db = new Database(dbFile);
  const settings = new SettingsService(db, join(userData, 'settings.json'));
  // Ukázková data jen v nebalené aplikaci a jen s výslovným přepínačem (fotodokumentace).
  const fixtures = !app.isPackaged && process.argv.includes('--docs-fixtures');
  const netFetch: FetchLike = async (url, init) => {
    const r = await net.fetch(url, init);
    return { ok: r.ok, status: r.status, text: () => r.text() };
  };
  const fetchFn: FetchLike = fixtures ? fixtureFetch : netFetch;
  const modsDir = join(userData, 'mods');
  const mods = new ModManager(modsDir, join(userData, 'backups'), app.getVersion());

  const deps: TtsDeps = {
    platform: fixtures ? 'win32' : process.platform, // v ukázkovém režimu jen kvůli zobrazení průvodce na snímcích
    async downloadFile(url, dest, onProgress) {
      await mkdir(join(dest, '..'), { recursive: true });
      const res = await net.fetch(url);
      if (!res.ok || !res.body) throw new Error(`Stahování selhalo (HTTP ${res.status}).`);
      const total = Number(res.headers.get('content-length')) || 0;
      const hash = createHash('sha256'); const out = createWriteStream(dest); let bytes = 0;
      const reader = res.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          hash.update(value); bytes += value.length;
          if (!out.write(value)) await new Promise((r) => out.once('drain', r));
          onProgress(total ? bytes / total : null);
        }
      } finally { await new Promise<void>((r) => out.end(r)); }
      return { sha256: hash.digest('hex'), bytes };
    },
    extractZip: (zip, dest) => new Promise((resolve, reject) =>
      execFile('tar', ['-xf', zip, '-C', dest], { windowsHide: true }, (e) => (e ? reject(new Error(`Rozbalení selhalo: ${e.message}`)) : resolve()))),
    runPiper: (exe, args, text, cwd) => new Promise((resolve, reject) => {
      const p = spawn(exe, args, { cwd, windowsHide: true });
      let err = '';
      const timer = setTimeout(() => { p.kill(); reject(new Error('Piper neodpověděl do 30 s.')); }, 30_000);
      p.stderr.on('data', (d) => { err = (err + String(d)).slice(-300); });
      p.on('error', (e) => { clearTimeout(timer); reject(e); });
      p.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Piper skončil s chybou ${code}: ${err.trim()}`)); });
      p.stdin.end(`${text}\n`);
    })
  };
  const tts = new TextToSpeechService(join(userData, 'tts'), db, deps);
  return {
    db, settings, log, mods, tts, fetchFn, fixtures,
    tracking: new TrainTrackingService(fetchFn),
    updates: new UpdateService(netFetch, app.getVersion()),
    paths: { userData, db: dbFile, mods: modsDir },
    broadcastProgress: (p) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(TTS_PROGRESS, p))
  };
}
