import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Database } from '../src/services/Database';
import { SettingsService } from '../src/services/SettingsService';
import { normalizeSettings, applyPatch } from '../src/services/settingsSchema';
import { DEFAULT_SETTINGS } from '../src/types/settings';
import { compareVersions, UpdateService } from '../src/services/UpdateService';
import { tmp } from './helpers';

describe('Nastavení (SQLite)', () => {
  it('přežije restart (nová instance nad stejným souborem)', async () => {
    const f = join(await tmp(), 'hub.db');
    const a = new Database(f);
    await new SettingsService(a).update({ theme: 'graphite', announcements: { volume: 0.3 } });
    a.close();
    const s = await new SettingsService(new Database(f)).get();
    expect(s.theme).toBe('graphite');
    expect(s.announcements.volume).toBe(0.3);
    expect(s.announcements.voiceId).toBe(DEFAULT_SETTINGS.announcements.voiceId); // hluboké sloučení
  });
  it('převezme ruční cestu ze starého settings.json', async () => {
    const dir = await tmp(); const legacy = join(dir, 'settings.json');
    await writeFile(legacy, JSON.stringify({ manualGamePath: 'D:\\SteamLibrary\\steamapps\\common\\SimRail' }));
    const s = await new SettingsService(new Database(join(dir, 'hub.db')), legacy).get();
    expect(s.manualGamePath).toContain('SimRail');
  });
  it('neplatné hodnoty ořízne nebo nahradí výchozími a neznámé klíče zahodí', () => {
    const s = normalizeSettings({ dataRefreshSeconds: 1, theme: 'neon', hack: 1, announcements: { volume: 9, rate: 'x' }, updates: { repo: 'a b/c' } });
    expect(s.dataRefreshSeconds).toBe(15);
    expect(s.theme).toBe('blue');
    expect(s.announcements.volume).toBe(1);
    expect(s.announcements.rate).toBe(1);
    expect(s.updates.repo).toBe(DEFAULT_SETTINGS.updates.repo);
    expect('hack' in s).toBe(false);
  });
  it('launchViaSteam nejde vypnout', () => {
    expect(applyPatch(DEFAULT_SETTINGS, { launchViaSteam: false as unknown as true }).launchViaSteam).toBe(true);
  });
  it('při poškozených datech v DB použije výchozí hodnoty', async () => {
    const db = new Database(':memory:'); db.setKv('settings', '{rozbité');
    expect((await new SettingsService(db).get()).theme).toBe('blue');
  });
});

describe('UpdateService', () => {
  it('porovnává verze', () => {
    expect(compareVersions('v0.2.0', '0.1.9')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
  });
  const resp = (body: unknown, status = 200) => async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
  it('bez vlastního repozitáře kontroluje oficiální projekt launcheru', async () => {
    let requested='';const fetcher=async(url:string)=>{requested=url;return resp({tag_name:'v0.3.0',html_url:'https://github.com/kubiasofficial/simrail-hub/releases/tag/v0.3.0'})();};
    expect((await new UpdateService(fetcher, '0.2.2').check(null)).status).toBe('available');expect(requested).toBe('https://api.github.com/repos/kubiasofficial/simrail-hub/releases/latest');
  });
  it('rozpozná novou verzi i chybu', async () => {
    expect((await new UpdateService(resp({ tag_name: 'v0.2.0', html_url: 'u' }), '0.1.0').check('a/b')).status).toBe('available');
    expect((await new UpdateService(resp({}, 404), '0.1.0').check('a/b')).status).toBe('error');
  });
});
