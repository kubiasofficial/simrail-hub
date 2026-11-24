import { ipcMain, type BrowserWindow } from 'electron';
import { IPC } from '../types/ipc';
import { ServerService } from '../services/ServerService';
import type { FetchLike } from '../adapters/simrailApi';

export function registerServerIpc(getWindow: () => BrowserWindow | null, fetchFn: FetchLike,validFrame:(e:Electron.IpcMainInvokeEvent)=>boolean): void {
  const service = new ServerService(fetchFn);
  ipcMain.handle(IPC.serversGet, (e, force: unknown) => {
    const win = getWindow();
    if (!win || !validFrame(e)) throw new Error('Nepovolený odesílatel IPC');
    return service.getServers(force === true);
  });
}
