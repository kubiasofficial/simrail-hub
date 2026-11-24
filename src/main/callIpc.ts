import { app, dialog, ipcMain, BrowserWindow } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppContext } from './appContext';
import type { CallChannel, IpcMap, Res } from '../types/ipc';
import { normalizeSettings } from '../services/settingsSchema';
import { MobileServer } from '../services/MobileServer';
import {CloudAccount} from '../services/CloudAccount';
import { MAX_TEXT } from '../services/TextToSpeechService';
import { ModError } from '../services/ModManager';

type Handler<C extends CallChannel> = (...args: IpcMap[C]['args']) => Promise<IpcMap[C]['result']> | IpcMap[C]['result'];

const str = (v: unknown, max: number, what: string): string => {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) throw new Error(`Neplatný argument „${what}“.`);
  return v;
};

export function registerCallIpc(ctx: AppContext, openDashboard: (server: string | null, train: string | null) => void, isTrusted: (e: Electron.IpcMainInvokeEvent) => boolean): void {
  const { settings, tracking, tts, mods, log } = ctx;
  const mobile = new MobileServer(tracking, join(__dirname, '../../dist'));
  const cloud=new CloudAccount();
  app.on('before-quit', () => mobile.stop());
  const ok = <T>(data: T, message?: string): Res<T> => ({ ok: true, data, message });
  /** Obalí službu: chyby se zalogují a vrátí se srozumitelně v češtině, nikdy nespadne hlavní proces. */
  const safe = async <T>(scope: string, fn: () => Promise<T>): Promise<Res<T>> => {
    try { return ok(await fn()); }
    catch (e) { log.error(scope, 'operace selhala', e); return { ok: false, error: (e as Error).message }; }
  };
  const on = <C extends CallChannel>(channel: C, h: (...a: unknown[]) => unknown) => {
    ipcMain.handle(channel, async (e, ...args: unknown[]) => {
      if (!isTrusted(e)) throw new Error('Nepovolený odesílatel IPC');
      return h(...args);
    });
  };
  const modList = async () => mods.list();
  on('cloud:status',()=>cloud.status());
  on('cloud:login',(email,password,create)=>safe('cloud',()=>cloud.login(str(email,254,'e-mail'),str(password,256,'heslo'),create===true)));
  on('cloud:logout',()=>safe('cloud',async()=>{cloud.logout();return null;}));
  on('cloud:save',()=>safe('cloud',async()=>cloud.save(await settings.get())));
  on('cloud:load',()=>safe('cloud',async()=>settings.update(await cloud.load())));
  on('cloud:reset',email=>safe('cloud',()=>cloud.reset(str(email,254,'e-mail'))));
  on('cloud:delete',()=>safe('cloud',()=>cloud.remove()));

  on('settings:get', () => settings.get());
  on('settings:update', async (patch) => {
    if (typeof patch !== 'object' || patch === null) throw new Error('Neplatná nastavení.');
    return settings.update(patch as never);
  });
  on('stations:board', (code, name) => safe('stations', () => tracking.getStationBoard(str(code,40,'server'),str(name,200,'stanice'))));
  on('stations:list', (code) => safe('stations', () => tracking.getStations(str(code, 40, 'server'))));
  on('mobile:start', (code, train) => safe('mobile', () => mobile.start(str(code, 40, 'server'), str(train, 40, 'vlak'))));
  on('mobile:stop', () => safe('mobile', async () => { mobile.stop(); return null; }));
  on('trains:list', (code) => tracking.getTrains(str(code, 40, 'server')));
  on('trains:detail', (code, num) => tracking.getDetail(str(code, 40, 'server'), str(num, 40, 'vlak')));

  on('tts:status', () => safe('tts', () => tts.status()));
  on('tts:install-piper', () => safe('tts', async () => { await tts.installPiper(ctx.broadcastProgress); return null; }));
  on('tts:install-voice', (id) => safe('tts', async () => { await tts.installVoice(str(id, 60, 'hlas'), ctx.broadcastProgress); return null; }));
  on('tts:synthesize', (text, voice, rate) => safe('tts', () => tts.synthesize(str(text, MAX_TEXT, 'text'), str(voice, 60, 'hlas'), typeof rate === 'number' ? rate : 1)));
  on('tts:clear-cache', () => safe('tts', () => tts.clearCache()));
  on('dict:list', () => safe('dict', async () => tts.listPronunciations()));
  on('dict:set', (w, s) => safe('dict', async () => { tts.setPronunciation(str(w, 80, 'slovo'), str(s, 80, 'výslovnost')); return null; }));
  on('dict:delete', (w) => safe('dict', async () => { tts.deletePronunciation(str(w, 80, 'slovo')); return null; }));

  on('mods:list', () => safe('mods', modList));
  on('mods:import', () => safe('mods', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const r = await dialog.showOpenDialog(win, { title: 'Importovat modifikaci', properties: ['openFile'], filters: [{ name: 'Modifikace SimRail Hub (ZIP)', extensions: ['zip'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    if ((await stat(r.filePaths[0])).size > 1_000_000) throw new ModError('Archiv je příliš velký (max. 1 MB).');
    await mods.importArchive(new Uint8Array(await readFile(r.filePaths[0])));
    return modList();
  }));
  on('mods:set-enabled', (id, en) => safe('mods', async () => { await mods.setEnabled(str(id, 64, 'id'), en === true); return modList(); }));
  on('mods:uninstall', (id) => safe('mods', async () => { await mods.uninstall(str(id, 64, 'id')); return modList(); }));
  on('mods:backup', () => safe('mods', () => mods.backup()));
  on('mods:backups', () => safe('mods', () => mods.listBackups()));
  on('mods:restore', (name) => safe('mods', () => mods.restore(str(name, 80, 'záloha'))));
  on('mods:active', () => safe('mods', () => mods.active()));

  on('dashboard:open', (server, train) => safe('okno', async () => { openDashboard(typeof server === 'string' ? server : null, typeof train === 'string' ? train : null); return null; }));

  on('diag:info', () => ({
    appVersion: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node,
    platform: process.platform, arch: process.arch, fixtures: ctx.fixtures, userData: ctx.paths.userData, logFile: log.path, dbFile: ctx.paths.db, modsDir: ctx.paths.mods
  }));
  on('diag:export-logs', () => safe('diag', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const r = await dialog.showSaveDialog(win, { title: 'Exportovat logy', defaultPath: join(app.getPath('documents'), `simrail-hub-log-${Date.now()}.txt`), filters: [{ name: 'Text', extensions: ['txt'] }] });
    if (r.canceled || !r.filePath) return null;
    const s = normalizeSettings(await settings.get());
    const header = `SimRail Hub ${app.getVersion()} | Electron ${process.versions.electron} | ${process.platform} ${process.arch}\nNastavení (bez osobních údajů): téma=${s.theme}, obnovení=${s.dataRefreshSeconds}s, TTS=${s.announcements.engine}\n${'-'.repeat(60)}\n`;
    await writeFile(r.filePath, header + log.read());
    return r.filePath;
  }));
  on('update:check', async () => ctx.updates.check((await settings.get()).updates.repo));
}
