import {CommunityRelay} from '../services/CommunityRelay';
import {DrivingJournal,sendDiscord,validDiscordWebhook,cleanText} from '../services/DrivingJournal';
import {computeOnboard,DelayTracker} from '../services/onboard';
import {TrainRouteService} from '../services/TrainRouteService';
import {runtimeIdentity} from './runtimeIdentity';
import {net} from 'electron';
import {DlcService} from '../services/DlcService';
import { autoUpdater } from 'electron-updater';
import { AutomaticUpdates } from '../services/AutomaticUpdates';
import { app, dialog, ipcMain, BrowserWindow, powerMonitor, safeStorage, shell } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppContext } from './appContext';
import type { CallChannel, IpcMap, Res } from '../types/ipc';
import { normalizeSettings } from '../services/settingsSchema';
import { MobileServer } from '../services/MobileServer';
import {LocalRecordings,encodeWav,gongSamples,radioSamples,type RecordingRequest} from '../services/localAudio';
import {isServiceAnnouncementId} from '../services/serviceAnnouncements';
import { MAX_TEXT } from '../services/TextToSpeechService';
import { ModError } from '../services/ModManager';

type Handler<C extends CallChannel> = (...args: IpcMap[C]['args']) => Promise<IpcMap[C]['result']> | IpcMap[C]['result'];

const str = (v: unknown, max: number, what: string): string => {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) throw new Error(`Neplatný argument „${what}“.`);
  return v;
};
const serverCode=(v:unknown)=>{const s=str(v,40,'server');if(!/^[\w-]+$/.test(s))throw Error('Neplatný server.');return s;};
const trainNumber=(v:unknown)=>{const s=str(v,12,'vlak');if(!/^\d+$/.test(s))throw Error('Neplatné číslo vlaku.');return s;};

export function registerCallIpc(ctx: AppContext, openDashboard: (server: string | null, train: string | null) => void, isTrusted: (e: Electron.IpcMainInvokeEvent) => boolean,stopDashboard:()=>void=()=>{}): void {
  const { settings, tracking, tts, mods, log } = ctx;
  const routes = new TrainRouteService(tracking,join(__dirname,'../../dist/data/rail-network.json'));
  const mobile = new MobileServer(tracking, join(__dirname, '../../dist'),undefined,undefined,(code,number)=>routes.get(code,number));
  const dlc=new DlcService(async(url,init)=>{const r=await net.fetch(url,init);return {ok:r.ok,status:r.status,text:()=>r.text()};});

  const testChannel=runtimeIdentity.channel==='test';
  const testUpdateMessage='Testovací verze má vlastní data. Nové testovací sestavení připravujeme samostatně; veřejné aktualizace sem neinstalujeme.';
  const automaticUpdates=new AutomaticUpdates(testChannel?null:autoUpdater,!testChannel&&app.isPackaged&&!process.env.PORTABLE_EXECUTABLE_FILE,testChannel?testUpdateMessage:undefined);
  const updateTimer=setTimeout(()=>void automaticUpdates.check(),15000);
  const updateInterval=setInterval(()=>void automaticUpdates.check(),6*60*60*1000);
  app.on('before-quit',()=>{clearTimeout(updateTimer);clearInterval(updateInterval);});
  ipcMain.handle('update:status',e=>{if(!isTrusted(e))throw Error('Nepovolený odesílatel');return automaticUpdates.status();});
  ipcMain.handle('update:auto-check',e=>{if(!isTrusted(e))throw Error('Nepovolený odesílatel');return automaticUpdates.check();});
  ipcMain.handle('update:install',e=>{if(!isTrusted(e))throw Error('Nepovolený odesílatel');return automaticUpdates.install();});

  app.on('before-quit', () => mobile.stop());
  powerMonitor.on('suspend',()=>mobile.stop());
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
  const recordings=async()=>new LocalRecordings((await settings.get()).recordingsPath??join(app.getPath('desktop'),'simrail-hub','hlaseni'));
  let community:CommunityRelay|null=null;
  let journalPromise:Promise<DrivingJournal>|null=null;
  const journal=()=>journalPromise??=(async()=>{
    let webhook='';if(runtimeIdentity.channel==='test'&&!ctx.fixtures){try{const value=(await readFile(join(app.getPath('desktop'),'simrail-hub','.local-config','driving-webhook.secret'),'utf8')).trim();if(validDiscordWebhook(value))webhook=value;}catch{/* local configuration is optional */}}
    if(!webhook&&!ctx.fixtures)community=new CommunityRelay(ctx.db,{encrypt:text=>{if(!safeStorage.isEncryptionAvailable())throw Error('Šifrování Windows není dostupné.');return safeStorage.encryptString(text).toString('base64');},decrypt:text=>safeStorage.decryptString(Buffer.from(text,'base64'))},net.fetch.bind(net) as typeof fetch,url=>shell.openExternal(url));
    const service=new DrivingJournal(ctx.db,!!webhook||!!community,(payload,event)=>community?community.send(payload,event):sendDiscord(webhook,payload,net.fetch.bind(net) as typeof fetch));
    app.once('before-quit',()=>service.dispose());return service;
  })();
  const object=(raw:unknown)=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Neplatné zadání evidence.');return raw as Record<string,unknown>;};
  const drivingStatus=async()=>{const service=await journal();return {...service.status(),connection:community?await community.status():{mode:service.status().configured?'direct' as const:'disabled' as const,verified:service.status().configured,pending:false,error:null}};};
  on('driving:status',()=>safe('driving',drivingStatus));
  on('driving:connect',()=>safe('driving',async()=>{await journal();if(community)await community.connect();return drivingStatus();}));
  on('driving:resume',id=>safe('driving',async()=>(await journal()).resume(cleanText(id,100))));
  on('driving:retry',(id,confirmed)=>safe('driving',async()=>(await journal()).retry(cleanText(id,100),confirmed===true)));
  on('driving:start',raw=>safe('driving',async()=>{
    const q=object(raw),nickname=cleanText(q.nickname,80),server=serverCode(q.server),number=trainNumber(q.number),location=cleanText(q.location,150);await journal();community?.ensureReady();
    const result=await tracking.getDetail(server,number);if(!result.ok||!result.data.train)throw Error('Vlak nyní není dostupný. Ověř jeho číslo a server.');
    const detail=result.data,t=detail.train!;if(q.runId!==null&&(typeof q.runId!=='string'||q.runId!==t.runId))throw Error('Spoj se mezitím změnil. Vyber vlak znovu.');
    const model=computeOnboard({train:t,timetable:detail.timetable,stations:detail.stations,nowSod:detail.serverSod,tracker:new DelayTracker(),connection:Date.now()-detail.fetchedAt<15000?'live':'stale'});
    return (await journal()).startDrive({nickname,server,number,runId:t.runId,from:detail.timetable?.startStation??t.startStation??'Neuvedeno',to:detail.timetable?.endStation??t.endStation??'Neuvedeno',origin:location,originVerified:model.connection==='live'&&model.current===location});
  }));
  on('driving:end',raw=>safe('driving',async()=>{
    const q=object(raw),id=cleanText(q.id,100),location=cleanText(q.location,150),note=q.note===''?'':cleanText(q.note,500),service=await journal(),active=service.status().drive;let verified=false;
    if(active){const d=await tracking.getDetail(active.server,active.number);if(d.ok&&d.data.train){const model=computeOnboard({train:d.data.train,timetable:d.data.timetable,stations:d.data.stations,nowSod:d.data.serverSod,tracker:new DelayTracker(),connection:Date.now()-d.data.fetchedAt<15000?'live':'stale'});verified=model.connection==='live'&&model.current===location;}}
    const delay=typeof q.delayMin==='number'&&Number.isFinite(q.delayMin)&&Math.abs(q.delayMin)<=720&&typeof q.delayAt==='number'&&Math.abs(Date.now()-q.delayAt)<=15000?q.delayMin:null;
    return service.endDrive(id,location,verified,note,delay);
  }));
  on('driving:shift-start',raw=>safe('driving',async()=>{
    const q=object(raw),nickname=cleanText(q.nickname,80),p=object(q.plan),request=object(p.request),server=serverCode(p.server);await journal();community?.ensureReady();
    if(!Array.isArray(p.legs)||!p.legs.length||p.legs.length>12||typeof p.generatedAt!=='number'||!Number.isFinite(p.generatedAt)||!['passenger','freight'].includes(String(request.transport))||typeof p.end!=='number'||!Number.isFinite(p.end)||typeof request.breakMinutes!=='number'||request.breakMinutes<5||request.breakMinutes>120)throw Error('Neplatný plán směny.');
    const legs=p.legs.map(raw=>{const l=object(raw);return {id:cleanText(l.id,150),number:trainNumber(l.number),from:cleanText(l.from,150),to:cleanText(l.to,150)};});
    return (await journal()).startShift({nickname,server,transport:request.transport as 'passenger'|'freight',planKey:server+':'+p.generatedAt,plannedEnd:p.end,breakMinutes:request.breakMinutes,legs});
  }));
  on('driving:shift-progress',(id,legId,ready)=>safe('driving',async()=>(await journal()).progressShift(cleanText(id,100),cleanText(legId,150),ready===true)));
  on('driving:shift-end',id=>safe('driving',async()=>(await journal()).endShift(cleanText(id,100))));
  on('shift:plan',(code,raw)=>safe('shift',async()=>{
    const c=serverCode(code);if(!raw||typeof raw!=='object')throw Error('Neplatné zadání směny.');
    const q=raw as import('../types/shift').ShiftRequest;
    if(!['passenger','freight'].includes(q.transport)||typeof q.origin!=='string'||q.origin.length>150||!Number.isInteger(q.endSod)||q.endSod<0||q.endSod>=86400||!Number.isInteger(q.breakMinutes)||q.breakMinutes<5||q.breakMinutes>120||!Array.isArray(q.ownedDlc)||q.ownedDlc.length>50||q.ownedDlc.some(x=>!Number.isSafeInteger(x)||x<1)||q.startDelayMinutes!==undefined&&(!Number.isInteger(q.startDelayMinutes)||q.startDelayMinutes<0||q.startDelayMinutes>120))throw Error('Neplatné zadání směny.');
    return tracking.planShift(c,q);
  }));
  on('dlc:list',region=>safe('dlc',()=>dlc.get(typeof region==='string'?region:'cz')));
  on('audio:radio',closing=>safe('audio',async()=>encodeWav(radioSamples(closing===true))));
  on('audio:gong',()=>safe('audio',async()=>encodeWav(gongSamples())));
  on('recordings:status',()=>safe('audio',async()=>(await recordings()).status()));
  on('recordings:choose',()=>safe('audio',async()=>{const choice=await dialog.showOpenDialog({title:'Složka soukromých nahrávek',properties:['openDirectory'],defaultPath:join(app.getPath('desktop'),'simrail-hub','hlaseni')});if(choice.canceled||!choice.filePaths[0])return null;await settings.update({recordingsPath:choice.filePaths[0]});return (await recordings()).status();}));
  on('recordings:render',(raw,gong)=>safe('audio',async()=>{if(!raw||typeof raw!=='object')throw Error('Neplatné hlášení.');const q=raw as RecordingRequest;if(q.service!==undefined&&!isServiceAnnouncementId(q.service))throw Error('Neplatná nahrávka.');if(!['next-station','approaching','arrived','terminal','delay'].includes(q.kind)||typeof q.isFreight!=='boolean'||(q.station!==null&&typeof q.station!=='string')||(q.trainNumber!==null&&typeof q.trainNumber!=='string'))throw Error('Neplatné hlášení.');return (await recordings()).render(q,gong===true);}));


  on('settings:get', () => settings.get());
  on('settings:update', async (patch) => {
    if (typeof patch !== 'object' || patch === null) throw new Error('Neplatná nastavení.');
    return settings.update(patch as never);
  });
  on('stations:board', (code, name) => safe('stations', () => tracking.getStationBoard(serverCode(code),str(name,200,'stanice'))));
  on('stations:list', (code) => safe('stations', async () => {const notes:string[]=[];const data=await tracking.getStations(serverCode(code),notes);if(notes.length)throw Error(notes.join(' '));return data;}));
  on('mobile:start', (code, train) => safe('mobile', () => mobile.start(serverCode(code), trainNumber(train))));
  on('mobile:stop', () => safe('mobile', async () => { mobile.stop(); return null; }));
  on('trains:list', (code) => tracking.getTrains(serverCode(code)));
  on('trains:route',(code,num)=>safe('trasa',()=>routes.get(serverCode(code),trainNumber(num))));
  on('dashboard:stop',()=>safe('okno',async()=>{stopDashboard();return null;}));
  on('trains:detail', (code, num) => tracking.getDetail(serverCode(code), trainNumber(num)));

  on('tts:status', () => safe('tts', () => tts.status()));
  on('tts:install-piper', () => safe('tts', async () => { await tts.installPiper(ctx.broadcastProgress); return null; }));
  on('tts:install-voice', (id) => safe('tts', async () => { await tts.installVoice(str(id, 60, 'hlas'), ctx.broadcastProgress); return null; }));
  on('tts:synthesize', (text, voice, rate) => safe('tts', () => tts.synthesize(str(text, MAX_TEXT, 'text'), str(voice, 60, 'hlas'), typeof rate === 'number'&&Number.isFinite(rate) ? rate : 1)));
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

  on('dashboard:open', (server, train) => safe('okno', async () => { openDashboard(server===null?null:serverCode(server),train===null?null:trainNumber(train)); return null; }));

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
  on('update:check', async () => testChannel?{status:'unconfigured',message:testUpdateMessage}:ctx.updates.check((await settings.get()).updates.repo));
}
