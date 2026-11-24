import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {SharedApiFetch} from '../services/SharedApiFetch';
import { app, net, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { execFile, spawn,type ChildProcess } from 'node:child_process';
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
  const fetchFn: FetchLike = new SharedApiFetch(fixtures ? fixtureFetch : netFetch).fetch;
  const modsDir = join(userData, 'mods');
  const mods = new ModManager(modsDir, join(userData, 'backups'), app.getVersion());

  const children=new Set<ChildProcess>();
  app.once('before-quit',()=>{for(const child of children)child.kill();children.clear();});
  const deps: TtsDeps = {
    platform: fixtures ? 'win32' : process.platform, // v ukázkovém režimu jen kvůli zobrazení průvodce na snímcích
    async downloadFile(url, dest, onProgress) {
      await mkdir(join(dest, '..'), { recursive: true });
      const signal=AbortSignal.timeout(120000),res=await net.fetch(url,{signal});
      if(!res.ok||!res.body)throw Error('Stahování selhalo (HTTP '+res.status+').');
      const total=Number(res.headers.get('content-length'))||0,hash=createHash('sha256');let bytes=0;
      const meter=new Transform({transform(chunk:Buffer,_encoding,done){bytes+=chunk.length;
        if(bytes>(url.endsWith('.json')?1024*1024:200*1024*1024)){done(Error('Stažený soubor překročil povolenou velikost.'));return;}
        hash.update(chunk);onProgress(total?bytes/total:null);done(null,chunk);
      }});
      await pipeline(Readable.fromWeb(res.body as never),meter,createWriteStream(dest),{signal});
      return { sha256: hash.digest('hex'), bytes };
    },
    extractZip: (zip, dest) => new Promise((resolve, reject) =>
      execFile('tar', ['-xf', zip, '-C', dest], { windowsHide: true }, (e) => (e ? reject(new Error(`Rozbalení selhalo: ${e.message}`)) : resolve()))),
    runPiper: (exe, args, text, cwd) => new Promise((resolve, reject) => {
      const p = spawn(exe, args, { cwd, windowsHide: true });children.add(p);p.once('close',()=>children.delete(p));p.stdin.on('error',()=>undefined);
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
