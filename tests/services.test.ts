import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { ModManager, readModArchive, isSafeEntryName } from '../src/services/ModManager';
import { TextToSpeechService, PIPER_PACKAGE, VOICES, type TtsDeps } from '../src/services/TextToSpeechService';
import { TrainTrackingService } from '../src/services/TrainTrackingService';
import { AnnouncementQueue } from '../src/services/announcementQueue';
import { Database } from '../src/services/Database';
import { tmp } from './helpers';

const manifest = (o: Record<string, unknown> = {}) => ({ id: 'test-mod', name: 'Test', author: 'A', version: '1.0.0', type: 'pronunciation-dictionary', source: 'https://example.com', ...o });
const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
const good = (m = manifest(), content = '[{"word":"Katowice","spoken":"Katovice"}]') => zip({ 'simrail-hub-mod.json': JSON.stringify(m), 'pronunciations.json': content });

describe('ModManager – bezpečnost a funkce', () => {
  it('importuje platnou modifikaci (vypnutou), umožní zapnutí a poskytne obsah', async () => {
    const d = await tmp(); const mm = new ModManager(join(d, 'mods'), join(d, 'bk'), '0.1.0');
    const r = await mm.importArchive(good());
    expect(r.mod.enabled).toBe(false);
    await mm.setEnabled('test-mod', true);
    expect((await mm.active()).pronunciations).toEqual([{ word: 'Katowice', spoken: 'Katovice' }]);
    await mm.setEnabled('test-mod', false);
    expect((await mm.active()).pronunciations).toEqual([]);
  });
  it('odmítne typ určený pro složku hry i neznámé typy', () => {
    for (const type of ['game-livery', 'script', 'executable']) {
      expect(() => readModArchive(good(manifest({ type })))).toThrow(/není podporován/);
    }
  });
  it('odmítne zip-slip, spustitelné a nadbytečné soubory', () => {
    expect(() => readModArchive(zip({ 'simrail-hub-mod.json': JSON.stringify(manifest()), 'pronunciations.json': '[]', '../evil.txt': 'x' }))).toThrow(/nebezpečnou cestu/);
    expect(() => readModArchive(zip({ 'simrail-hub-mod.json': JSON.stringify(manifest()), 'pronunciations.json': '[]', 'run.exe': 'MZ' }))).toThrow(/nepovolený soubor/);
    expect(() => readModArchive(zip({ 'simrail-hub-mod.json': JSON.stringify(manifest()), 'pronunciations.json': '[]', 'C:\\x.dll': 'x' }))).toThrow();
    expect(isSafeEntryName('a/../b')).toBe(false);
    expect(isSafeEntryName('/abs')).toBe(false);
  });
  it('odmítne id s path traversal, špatné verze, neplatný JSON a obří archiv', () => {
    expect(() => readModArchive(good(manifest({ id: '../x' })))).toThrow(/id/);
    expect(() => readModArchive(good(manifest({ version: 'abc' })))).toThrow(/version/);
    expect(() => readModArchive(good(manifest(), '{rozbité'))).toThrow(/JSON/);
    expect(() => readModArchive(new Uint8Array(1_100_000))).toThrow(/velký/);
    expect(() => readModArchive(new Uint8Array([1, 2, 3]))).toThrow(/ZIP/);
  });
  it('kontroluje verze: novější aktualizuje (zachová zapnutí), stejná/starší odmítne', async () => {
    const d = await tmp(); const mm = new ModManager(join(d, 'mods'), join(d, 'bk'), '0.1.0');
    await mm.importArchive(good()); await mm.setEnabled('test-mod', true);
    await expect(mm.importArchive(good())).rejects.toThrow(/není novější/);
    const up = await mm.importArchive(good(manifest({ version: '1.1.0' })));
    expect(up.mod.version).toBe('1.1.0'); expect(up.mod.enabled).toBe(true);
  });
  it('nekompatibilní modifikaci nelze zapnout', async () => {
    const d = await tmp(); const mm = new ModManager(join(d, 'mods'), join(d, 'bk'), '0.1.0');
    await mm.importArchive(good(manifest({ compatibility: { hubMin: '9.0.0' } })));
    await expect(mm.setEnabled('test-mod', true)).rejects.toThrow(/9\.0\.0/);
  });
  it('odinstalace, záloha a obnovení fungují', async () => {
    const d = await tmp(); const mm = new ModManager(join(d, 'mods'), join(d, 'bk'), '0.1.0');
    await mm.importArchive(good()); await mm.setEnabled('test-mod', true);
    const name = await mm.backup();
    await mm.uninstall('test-mod'); expect(await mm.list()).toEqual([]);
    expect((await mm.listBackups())[0].name).toBe(name);
    const r = await mm.restore(name);
    expect(r.restored).toBe(1);
    expect((await mm.list())[0]).toMatchObject({ id: 'test-mod', enabled: true });
    await expect(mm.restore('../../etc/passwd')).rejects.toThrow(/Neplatný/);
    await expect(mm.uninstall('../x')).rejects.toThrow(/Neplatné/);
  });
  it('obnovení přeskočí poškozenou zálohu modifikace', async () => {
    const d = await tmp(); const mm = new ModManager(join(d, 'mods'), join(d, 'bk'), '0.1.0');
    await mkdir(join(d, 'bk'), { recursive: true });
    await writeFile(join(d, 'bk', 'mods-x.zip'), zip({ 'evil/simrail-hub-mod.json': JSON.stringify(manifest({ id: 'evil', type: 'script' })), 'evil/x.js': 'alert(1)' }));
    const r = await mm.restore('mods-x.zip');
    expect(r.restored).toBe(0); expect(r.skipped[0]).toMatch(/evil/);
  });
});

describe('TextToSpeechService (s falešnými závislostmi)', () => {
  const mk = async (over: Partial<TtsDeps> = {}) => {
    const d = await tmp();
    const deps: TtsDeps = {
      platform: 'win32',
      downloadFile: vi.fn(async (_u, dest) => { await mkdir(join(dest, '..'), { recursive: true }); await writeFile(dest, dest.endsWith('.json.part') ? '{"audio":{"sample_rate":22050}}' : Buffer.alloc(2_000_000)); return { sha256: VOICES.find(v=>v.onnxUrl===_u)?.sha256??VOICES.find(v=>v.jsonUrl===_u)?.configSha256??PIPER_PACKAGE.sha256, bytes: 2_000_000 }; }),
      extractZip: vi.fn(async (_z, dest) => { await mkdir(join(dest, 'piper'), { recursive: true }); await writeFile(join(dest, 'piper', 'piper.exe'), 'x'); }),
      runPiper: vi.fn(async (_e, args) => { await writeFile(args[args.indexOf('--output_file') + 1], 'RIFFfake'); }),
      ...over
    };
    return { d, deps, svc: new TextToSpeechService(d, new Database(':memory:'), deps) };
  };
  it('nainstaluje Piper a hlas, syntetizuje a podruhé použije cache', async () => {
    const { svc, deps } = await mk();
    await svc.installPiper(() => undefined); await svc.installVoice('cs_CZ-jirka-medium', () => undefined);
    expect((await svc.status()).piperInstalled).toBe(true);
    await svc.synthesize('Vážení cestující', 'cs_CZ-jirka-medium', 1);
    await svc.synthesize('Vážení cestující', 'cs_CZ-jirka-medium', 1);
    expect(deps.runPiper).toHaveBeenCalledTimes(1);
    const rate = (deps.runPiper as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(rate[rate.indexOf('--length_scale') + 1]).toBe('1.000');
    expect((await svc.status()).cacheFiles).toBe(1);
    expect(await svc.clearCache()).toBe(1);
    expect((await svc.status()).cacheFiles).toBe(0);
  });
  it('opraví nekompatibilní fonémy stažením odpovídajícího modelu i konfigurace před spuštěním Piperu', async () => {
    const { svc, deps, d } = await mk();
    await svc.installPiper(() => undefined);
    await svc.installVoice('cs_CZ-jirka-medium', () => undefined);
    await writeFile(join(d, 'voices', 'cs_CZ-jirka-medium.onnx.json'), JSON.stringify({audio:{sample_rate:22050},phoneme_id_map:{'aɪ':[161]}}));
    vi.mocked(deps.downloadFile).mockClear();
    await svc.synthesize('Příští stanice Katovice', 'cs_CZ-jirka-medium', 1);
    expect(deps.downloadFile).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deps.downloadFile).mock.calls.map(c=>c[0])).toEqual([
      expect.stringContaining('/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx.json'),
      expect.stringContaining('/resolve/v1.0.0/cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx')
    ]);
    expect(deps.runPiper).toHaveBeenCalledTimes(1);
    await svc.synthesize('Další hlášení', 'cs_CZ-jirka-medium', 1);
    expect(deps.downloadFile).toHaveBeenCalledTimes(2);
  });
  it('odmítne archiv s jiným kontrolním součtem a nenechá po sobě soubory', async () => {
    const { svc } = await mk({ downloadFile: vi.fn(async () => ({ sha256: 'deadbeef', bytes: 1 })) });
    await expect(svc.installPiper(() => undefined)).rejects.toThrow(/Kontrolní součet/);
    expect((await svc.status()).piperInstalled).toBe(false);
  });
  it('mimo Windows odmítne instalaci Piperu srozumitelně', async () => {
    const { svc } = await mk({ platform: 'linux' });
    await expect(svc.installPiper(() => undefined)).rejects.toThrow(/pouze na Windows/);
  });
  it('validuje vstupy syntézy a chybějící součásti', async () => {
    const { svc } = await mk();
    await expect(svc.synthesize('x'.repeat(501), 'cs_CZ-jirka-medium', 1)).rejects.toThrow(/1–500/);
    await expect(svc.synthesize('ahoj', 'neznamy', 1)).rejects.toThrow(/Neznámý hlas/);
    await expect(svc.synthesize('ahoj', 'cs_CZ-jirka-medium', 1)).rejects.toThrow(/Piper není nainstalován/);
  });
  it('editor výslovnosti ukládá, přepisuje a maže', async () => {
    const { svc } = await mk();
    svc.setPronunciation('Katowice', 'Katovice'); svc.setPronunciation('Katowice', 'Katovíce');
    expect(svc.listPronunciations()).toEqual([{ word: 'Katowice', spoken: 'Katovíce' }]);
    svc.deletePronunciation('Katowice'); expect(svc.listPronunciations()).toEqual([]);
    expect(() => svc.setPronunciation('', 'x')).toThrow();
  });
});

describe('TrainTrackingService', () => {
  const resp = (b: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, text: async () => JSON.stringify(b) });
  const trains = { result: true, data: [{ TrainNoLocal: '1', RunId: 'r', TrainData: { Latitude: 50, Longitude: 19, Velocity: 10, VDDelayedTimetableIndex: 0 } }] };
  it('poskládá detail vlaku včetně jízdního řádu a času a ošetří chybějící části', async () => {
    const f = vi.fn(async (u: string) => u.includes('trains-open') ? resp(trains) : u.includes('stations-open') ? resp({ data: [] }) : u.includes('getAllTimetables') ? resp([{ trainNoLocal: '1', runId: 'r', timetable: [{ nameOfPoint: 'A' }] }]) : resp('12:30:00'));
    const r = await new TrainTrackingService(f).getDetail('en1', '1');
    expect(r.ok && r.data.timetable?.points).toHaveLength(1);
    expect(r.ok && r.data.serverSod).toBe(12 * 3600 + 1800);
  });
  it('výpadek jízdních řádů nezboří detail, jen přidá poznámku', async () => {
    const f = async (u: string) => u.includes('getAllTimetables') ? resp('x', false) : u.includes('trains-open') ? resp(trains) : resp({ data: [] });
    const r = await new TrainTrackingService(f).getDetail('en1', '1');
    expect(r.ok && r.data.timetable).toBeNull();
    expect(r.ok && r.data.notes.join(' ')).toMatch(/Jízdní řády nejsou dostupné/);
  });
  it('cachuje polohy 3 s', async () => {
    let t = 0; const f = vi.fn(async () => resp(trains)); const s = new TrainTrackingService(f, () => t);
    await s.getTrains('a'); t = 2000; await s.getTrains('a'); expect(f).toHaveBeenCalledTimes(1);
    t = 4000; await s.getTrains('a'); expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('AnnouncementQueue', () => {
  it('přehrává po jednom, podle priority a bez duplicit', async () => {
    const played: string[] = []; let release!: () => void;
    const q = new AnnouncementQueue((seg) => new Promise<void>((res) => { played.push(seg.text); release = res; }));
    const seg = (t: string) => [{ lang: 'cs' as const, text: t }];
    q.enqueue({ key: 'a', kind: 'delay', segments: seg('zpoždění') });
    q.enqueue({ key: 'b', kind: 'next-station', segments: seg('příští') });
    q.enqueue({ key: 'c', kind: 'arrived', segments: seg('příjezd') });
    expect(q.enqueue({ key: 'c', kind: 'arrived', segments: seg('příjezd') })).toBe(false);
    await Promise.resolve();
    expect(played).toEqual(['zpoždění']); // první už hraje
    release(); await new Promise((r) => setTimeout(r, 0)); release(); await new Promise((r) => setTimeout(r, 0)); release(); await new Promise((r) => setTimeout(r, 0));
    expect(played).toEqual(['zpoždění', 'příjezd', 'příští']);
  });
  it('zahodí zastaralé hlášení „blížíme se“', async () => {
    let t = 0; const played: string[] = []; let release!: () => void;
    const q = new AnnouncementQueue((s) => new Promise<void>((r) => { played.push(s.text); release = r; }), () => t);
    q.enqueue({ key: 'x', kind: 'terminal', segments: [{ lang: 'cs', text: 'konečná' }] });
    q.enqueue({ key: 'y', kind: 'approaching', segments: [{ lang: 'cs', text: 'blížíme' }] });
    await Promise.resolve(); t = 120_000; release(); await new Promise((r) => setTimeout(r, 0));
    expect(played).toEqual(['konečná']);
  });
  it('chyba přehrání nezastaví frontu', async () => {
    const played: string[] = []; let n = 0;
    const q = new AnnouncementQueue(async (s) => { played.push(s.text); if (n++ === 0) throw new Error('x'); });
    q.enqueue({ key: '1', kind: 'arrived', segments: [{ lang: 'cs', text: 'a' }, { lang: 'pl', text: 'b' }] });
    await new Promise((r) => setTimeout(r, 5));
    expect(played).toEqual(['a', 'b']);
  });
});
