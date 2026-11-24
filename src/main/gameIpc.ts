import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { readFile, access } from 'node:fs/promises';
import type { SettingsService } from '../services/SettingsService';
import { IPC } from '../types/ipc';
import type { DetectionResult, PickFolderResult } from '../types/game';
import { GameDetectionService } from '../services/GameDetectionService';
import { SteamService, windowsSteamPath } from '../services/SteamService';

export function registerGameIpc(getWindow: () => BrowserWindow | null, settings: SettingsService,validFrame:(e:Electron.IpcMainInvokeEvent)=>boolean): void {
  const detection = new GameDetectionService(
    { readFile: (p) => readFile(p, 'utf8'), exists: (p) => access(p).then(() => true, () => false) },
    windowsSteamPath
  );
  const steam = new SteamService((url) => shell.openExternal(url));
  const trusted = (e: Electron.IpcMainInvokeEvent) => validFrame(e)&&!!getWindow() && e.sender === getWindow()!.webContents;

  async function detectAll(): Promise<DetectionResult> {
    const { manualGamePath, autoDetectGame } = await settings.get();
    if (manualGamePath) {
      const v = await detection.validateManual(manualGamePath);
      if ('install' in v) {
        return { install: v.install, steamPath: null, libraries: [v.install.libraryPath], messages: [] };
      }
      const auto = await detection.detect();
      auto.messages.unshift(`Uložená ruční cesta už není platná: ${v.error}`);
      return auto;
    }
    if (!autoDetectGame) return { install: null, steamPath: null, libraries: [], messages: ['Automatické hledání je vypnuto. Vyberte složku hry ručně nebo ho zapněte v Nastavení.'] };
    return detection.detect();
  }

  ipcMain.handle(IPC.gameDetect, async (e) => {
    if (!trusted(e)) throw new Error('Nepovolený odesílatel IPC');
    return detectAll();
  });
  ipcMain.handle(IPC.gameLaunch, async (e) => {
    if (!trusted(e)) throw new Error('Nepovolený odesílatel IPC');
    return steam.launchGame();
  });
  ipcMain.handle(IPC.gamePickFolder, async (e): Promise<PickFolderResult> => {
    if (!trusted(e)) throw new Error('Nepovolený odesílatel IPC');
    const win = getWindow()!;
    const r = await dialog.showOpenDialog(win, { title: 'Vyberte složku SimRailu', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    const v = await detection.validateManual(r.filePaths[0]);
    if ('error' in v) return { ok: false, error: v.error };
    await settings.update({ manualGamePath: v.install.path });
    return { ok: true, result: await detectAll() };
  });
  ipcMain.handle(IPC.gameClearManual, async (e) => {
    if (!trusted(e)) throw new Error('Nepovolený odesílatel IPC');
    await settings.update({ manualGamePath: null });
    return detectAll();
  });
}
