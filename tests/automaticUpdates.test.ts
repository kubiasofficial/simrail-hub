import {EventEmitter} from 'node:events';
import {describe,it,expect,vi} from 'vitest';
import type {AppUpdater} from 'electron-updater';
import {AutomaticUpdates} from '../src/services/AutomaticUpdates';
class Fake extends EventEmitter {
 autoDownload=true;autoInstallOnAppQuit=true;allowPrerelease=true;allowDowngrade=true;
 checkForUpdates=vi.fn(async()=>{this.emit('checking-for-update');this.emit('update-available',{version:'0.4.1'});return null;});
 downloadUpdate=vi.fn(async()=>{this.emit('download-progress',{percent:40});this.emit('update-downloaded',{version:'0.4.1'});return [];});
 quitAndInstall=vi.fn();
}
describe('automatic update lifecycle',()=>{
 it('downloads in background and installs only after an explicit click',async()=>{
  const engine=new Fake(),service=new AutomaticUpdates(engine as unknown as AppUpdater,true);
  expect(service.install()).toBe(false);
  await service.check();
  expect(engine.autoInstallOnAppQuit).toBe(false);expect(engine.autoDownload).toBe(false);expect(engine.allowDowngrade).toBe(false);
  expect(service.status()).toMatchObject({status:'ready',version:'0.4.1',percent:100});
  expect(engine.quitAndInstall).not.toHaveBeenCalled();
  await service.check();expect(engine.checkForUpdates).toHaveBeenCalledTimes(1);
  expect(service.install()).toBe(true);expect(engine.quitAndInstall).toHaveBeenCalledWith(true,true);
 });
 it('handles interrupted download and allows a retry without installing a partial file',async()=>{
  const engine=new Fake();engine.downloadUpdate.mockRejectedValueOnce(new Error('offline'));
  const service=new AutomaticUpdates(engine as unknown as AppUpdater,true);
  await service.check();await new Promise(r=>setImmediate(r));
  expect(service.status().status).toBe('error');expect(service.install()).toBe(false);
  await service.check();expect(service.status().status).toBe('ready');expect(engine.downloadUpdate).toHaveBeenCalledTimes(2);
 });
 it('portable/development app explains one-time installation and never runs the updater',async()=>{
  const engine=new Fake(),service=new AutomaticUpdates(engine as unknown as AppUpdater,false);
  expect((await service.check()).status).toBe('manual');expect(service.install()).toBe(false);expect(engine.checkForUpdates).not.toHaveBeenCalled();
 });
 it('deduplicates checks and repeated available events while downloading',async()=>{
  const engine=new Fake();let complete:()=>void=()=>{};
  engine.downloadUpdate.mockImplementation(()=>new Promise(resolve=>{complete=()=>resolve([]);}));
  const service=new AutomaticUpdates(engine as unknown as AppUpdater,true);
  await service.check();await service.check();engine.emit('update-available',{version:'0.4.1'});
  expect(engine.downloadUpdate).toHaveBeenCalledTimes(1);
  expect(engine.checkForUpdates).toHaveBeenCalledTimes(1);
  engine.emit('download-progress',{percent:42});expect(service.status()).toMatchObject({status:'downloading',percent:42});complete();
 });
});
