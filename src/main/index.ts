import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import { join } from 'node:path';
import { registerGameIpc } from './gameIpc';
import { createContext } from './appContext';
import { registerCallIpc } from './callIpc';
import { registerServerIpc } from './serverIpc';
import { IPC, type AppInfo, type WindowState } from '../types/ipc';

const isDev = !app.isPackaged && process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';
let mainWindow: BrowserWindow | null = null;
const appWindows = new Set<number>();

function senderIsMain(e: Electron.IpcMainInvokeEvent): boolean {
  return !!mainWindow && e.sender === mainWindow.webContents;
}

const WEB_PREFS = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
  autoplayPolicy: 'no-user-gesture-required'
  , offscreen: !app.isPackaged && process.argv.includes('--verify-hidden'), backgroundThrottling: false
} as const;

function secureWindow(win: BrowserWindow): void {
  const contentsId=win.webContents.id;
  appWindows.add(contentsId);
  win.on('closed', () => appWindows.delete(contentsId));
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = isDev ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) e.preventDefault();
  });
}

/** Samostatné okno palubního počítače (druhý monitor / OBS – klasický rám, aby šlo zachytit okno). */
function openDashboardWindow(server: string | null, train: string | null): void {
  const win = new BrowserWindow({ width: 1100, height: 720, minWidth: 700, minHeight: 480, backgroundColor: '#0b1220', title: 'SimRail Hub – Palubní počítač', autoHideMenuBar: true, webPreferences: WEB_PREFS });
  secureWindow(win);
  const q = new URLSearchParams({ ...(server ? { server } : {}), ...(train ? { train } : {}) }).toString();
  const hash = `dashboard${q ? `?${q}` : ''}`;
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
    title: 'SimRail Hub',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: WEB_PREFS
  });
  secureWindow(mainWindow);

  mainWindow.once('ready-to-show', () => { if (!process.argv.includes('--verify-hidden')) mainWindow?.show(); });
  const emitState = () => {
    const s: WindowState = { maximized: !!mainWindow?.isMaximized() };
    mainWindow?.webContents.send(IPC.winStateChanged, s);
  };
  mainWindow.on('maximize', emitState);
  mainWindow.on('unmaximize', emitState);
  mainWindow.on('closed', () => { mainWindow = null; });

  // Testovací přepínač --hash=page=map otevře rovnou zvolenou stránku (používá se při ověřování vzhledu).
  const startHash = process.argv.find((a) => a.startsWith('--hash='))?.slice(7) ?? '';
  if (isDev) void mainWindow.loadURL(`${DEV_URL}/#${startHash}`);
  else void mainWindow.loadFile(join(__dirname, '../../dist/index.html'), { hash: startHash });
}

function registerIpc(): void {
  ipcMain.handle(IPC.appInfo, (e): AppInfo => {
    if (!senderIsMain(e)) throw new Error('Nepovolený odesílatel IPC');
    return { version: app.getVersion(), platform: process.platform, electron: process.versions.electron };
  });
  ipcMain.handle(IPC.winMinimize, (e) => { if (senderIsMain(e)) mainWindow?.minimize(); });
  ipcMain.handle(IPC.winToggleMaximize, (e): WindowState => {
    if (!senderIsMain(e) || !mainWindow) return { maximized: false };
    if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
    return { maximized: mainWindow.isMaximized() };
  });
  ipcMain.handle(IPC.winClose, (e) => { if (senderIsMain(e)) mainWindow?.close(); });
  ipcMain.handle(IPC.winState, (e): WindowState => {
    if (!senderIsMain(e)) return { maximized: false };
    return { maximized: !!mainWindow?.isMaximized() };
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    registerIpc();
    const ctx = createContext();
    process.on('uncaughtException', (e) => ctx.log.error('main', 'neošetřená výjimka', e));
    process.on('unhandledRejection', (e) => ctx.log.error('main', 'neošetřené odmítnutí', e));
    ctx.log.info('main', `SimRail Hub ${app.getVersion()} spuštěn`);
    registerGameIpc(() => mainWindow, ctx.settings);
    registerCallIpc(ctx, openDashboardWindow, (e) => appWindows.has(e.sender.id));
    registerServerIpc(() => mainWindow, ctx.fetchFn);
    createWindow();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
