import { contextBridge, ipcRenderer } from 'electron';
import { IPC, CALL_CHANNELS, TTS_PROGRESS, type SimRailHubApi, type WindowState, type TtsProgressDto } from '../types/ipc';

const api: SimRailHubApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  minimize: () => ipcRenderer.invoke(IPC.winMinimize),
  toggleMaximize: () => ipcRenderer.invoke(IPC.winToggleMaximize),
  close: () => ipcRenderer.invoke(IPC.winClose),
  getWindowState: () => ipcRenderer.invoke(IPC.winState),
  detectGame: () => ipcRenderer.invoke(IPC.gameDetect),
  launchGame: () => ipcRenderer.invoke(IPC.gameLaunch),
  pickGameFolder: () => ipcRenderer.invoke(IPC.gamePickFolder),
  clearManualGamePath: () => ipcRenderer.invoke(IPC.gameClearManual),
  getServers: (force) => ipcRenderer.invoke(IPC.serversGet, force === true),
  call: (channel, ...args) => {
    if (!CALL_CHANNELS.includes(channel)) return Promise.reject(new Error(`Nepovolený IPC kanál: ${String(channel)}`));
    return ipcRenderer.invoke(channel, ...args);
  },
  onTtsProgress: (cb) => {
    const h = (_e: Electron.IpcRendererEvent, p: TtsProgressDto) => cb(p);
    ipcRenderer.on(TTS_PROGRESS, h);
    return () => ipcRenderer.removeListener(TTS_PROGRESS, h);
  },
  onWindowStateChanged: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, s: WindowState) => cb(s);
    ipcRenderer.on(IPC.winStateChanged, handler);
    return () => ipcRenderer.removeListener(IPC.winStateChanged, handler);
  }
};

contextBridge.exposeInMainWorld('simrailHub', api);
