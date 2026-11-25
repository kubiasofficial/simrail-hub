import {runtimeIdentity} from './runtimeIdentity';
import {pathToFileURL} from 'node:url';
import {appDocument,externalHttps} from '../services/windowSecurity';
import { app, BrowserWindow, ipcMain, shell, session,dialog } from 'electron';
import { join } from 'node:path';
import { registerGameIpc } from './gameIpc';
import { createContext } from './appContext';
import { registerCallIpc } from './callIpc';
import { registerServerIpc } from './serverIpc';
import { IPC, type AppInfo, type WindowState } from '../types/ipc';

// Resolve identity before acquiring the lock, creating SQLite or Chromium sessions.
app.setName(runtimeIdentity.name);
if(runtimeIdentity.channel==='test') {
 if(!app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',join(app.getPath('appData'),runtimeIdentity.profileName));
 app.setPath('sessionData',app.getPath('userData'));
}
if(process.platform==='win32')app.setAppUserModelId(runtimeIdentity.appId);

const isDev = !app.isPackaged && process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';
let mainWindow: BrowserWindow | null = null;
let dashboardWindow:BrowserWindow|null=null;
const ENTRY=pathToFileURL(join(__dirname,'../../dist/index.html')).href;
function trustedFrame(e:Electron.IpcMainInvokeEvent){return appWindows.has(e.sender.id)&&e.senderFrame===e.sender.mainFrame&&appDocument(e.senderFrame.url,ENTRY,isDev?DEV_URL:undefined);}
const appWindows = new Set<number>();

function senderIsMain(e: Electron.IpcMainInvokeEvent): boolean {
  return !!mainWindow && e.sender === mainWindow.webContents && trustedFrame(e);
}

const WEB_PREFS = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
  autoplayPolicy: 'no-user-gesture-required'
  , offscreen: !app.isPackaged && process.argv.includes('--verify-hidden'), backgroundThrottling: false
} as const;

function secureWindow(win: BrowserWindow): void {
  if(runtimeIdentity.channel==='test')win.on('page-title-updated',event=>event.preventDefault());
  const contentsId=win.webContents.id;
  appWindows.add(contentsId);
  win.on('closed', () => appWindows.delete(contentsId));
  win.webContents.setWindowOpenHandler(({ url }) => { if (externalHttps(url)) void shell.openExternal(url); return { action: 'deny' }; });
  const emit=()=>win.webContents.send(IPC.winStateChanged,{maximized:win.isMaximized(),minimized:win.isMinimized()});
  win.on('minimize',emit);win.on('restore',emit);win.on('maximize',emit);win.on('unmaximize',emit);
  win.webContents.on('will-attach-webview',e=>e.preventDefault());
  win.webContents.on('will-frame-navigate',e=>{if(!appDocument(e.url,ENTRY,isDev?DEV_URL:undefined))e.preventDefault();});
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = appDocument(url,ENTRY,isDev?DEV_URL:undefined);
    if (!allowed) e.preventDefault();
  });
}

/** Samostatné okno palubního počítače (druhý monitor / OBS – klasický rám, aby šlo zachytit okno). */
function openDashboardWindow(server: string | null, train: string | null): void {
  const previous=dashboardWindow&&!dashboardWindow.isDestroyed()?dashboardWindow:null;
  const win = previous??new BrowserWindow({ width: 1100, height: 720, minWidth: 700, minHeight: 480, backgroundColor: '#0b1220', title: runtimeIdentity.name+' – Palubní počítač', autoHideMenuBar: true, webPreferences: WEB_PREFS });
  dashboardWindow=win;if(!previous){win.once('closed',()=>{if(dashboardWindow===win)dashboardWindow=null;});secureWindow(win);}
  const q = new URLSearchParams({ ...(server ? { server } : {}), ...(train ? { train } : {}) }).toString();
  const hash = `dashboard${q ? `?${q}` : ''}`;
  if(previous){if(win.isMinimized())win.restore();win.show();win.focus();}
  if (isDev) void win.loadURL(`${DEV_URL}/#${hash}`);
  else void win.loadFile(join(__dirname, '../../dist/index.html'), { hash });
}

function createWindow(): void {
  const sz = /^--size=(\d+)x(\d+)$/.exec(process.argv.find((a) => a.startsWith('--size=')) ?? '');
  mainWindow = new BrowserWindow({
    width: sz ? Number(sz[1]) : 1280,
    height: sz ? Number(sz[2]) : 800,
    minWidth: 1000,
    minHeight: sz ? 300 : 640,
    frame: false,
    backgroundColor: '#0b1220',
    show: false,
    title: runtimeIdentity.name,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: WEB_PREFS
  });
  secureWindow(mainWindow);

  mainWindow.once('ready-to-show', () => { if (!process.argv.includes('--verify-hidden')) mainWindow?.show(); });
  mainWindow.on('closed', () => { mainWindow = null; });

  // Testovací přepínač --hash=page=map otevře rovnou zvolenou stránku (používá se při ověřování vzhledu).
  const startHash = process.argv.find((a) => a.startsWith('--hash='))?.slice(7) ?? '';
  if (isDev) void mainWindow.loadURL(`${DEV_URL}/#${startHash}`);
  else void mainWindow.loadFile(join(__dirname, '../../dist/index.html'), { hash: startHash });
}

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, (e): AppInfo => {
    if (!trustedFrame(e)) throw new Error('Nepovolený odesílatel IPC');
    return { version: app.getVersion(), platform: process.platform, electron: process.versions.electron, channel:runtimeIdentity.channel, buildId:runtimeIdentity.buildId };
  });
  ipcMain.handle(IPC.winMinimize, (e) => { if (senderIsMain(e)) mainWindow?.minimize(); });
  ipcMain.handle(IPC.winToggleMaximize, (e): WindowState => {
    if (!senderIsMain(e) || !mainWindow) return { maximized: false };
    if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
    return { maximized: mainWindow.isMaximized() };
  });
  ipcMain.handle(IPC.winClose, (e) => { if (senderIsMain(e)) mainWindow?.close(); });
  ipcMain.handle(IPC.winState, (e): WindowState => {
    if (!trustedFrame(e)) return { maximized: false,minimized:false };
    const win=BrowserWindow.fromWebContents(e.sender);return { maximized:!!win?.isMaximized(),minimized:!!win?.isMinimized() };
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  void app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeSendHeaders({urls:['https://tile.openstreetmap.org/*']},(details,callback)=>{callback({requestHeaders:{...details.requestHeaders,'User-Agent':'SimRailHub/'+app.getVersion()+' (+https://github.com/kubiasofficial/simrail-hub)'}});});
    session.defaultSession.setPermissionCheckHandler(()=>false);
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    registerIpc();
    const ctx = createContext();
    process.on('uncaughtException', (e) => ctx.log.error('main', 'neošetřená výjimka', e));
    process.on('unhandledRejection', (e) => ctx.log.error('main', 'neošetřené odmítnutí', e));
    ctx.log.info('main', `SimRail Hub ${app.getVersion()} spuštěn`);
    registerGameIpc(() => mainWindow, ctx.settings, trustedFrame);
    registerCallIpc(ctx, openDashboardWindow, trustedFrame);
    registerServerIpc(() => mainWindow, ctx.fetchFn, trustedFrame);
    createWindow();
  }).catch(()=>{dialog.showErrorBox('SimRail Hub nelze spustit','Místní data se nepodařilo otevřít. Původní soubory zůstaly zachované. Zálohujte složku aplikace v AppData a kontaktujte podporu.');app.quit();});
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
