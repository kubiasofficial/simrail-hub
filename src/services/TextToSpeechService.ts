import { mkdir, readFile, writeFile, rename, rm, stat, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Database } from './Database';

export interface VoiceInfo { id: string; label: string; lang: 'cs'; onnxUrl: string; jsonUrl: string; sizeMB: number; license: string }

const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/cs/cs_CZ/jirka';
/** Katalog hlasů – jen ověřené české modely. Licence viz MODEL_CARD v repozitáři rhasspy/piper-voices. */
export const VOICES: VoiceInfo[] = [
  { id: 'cs_CZ-jirka-medium', label: 'Čeština – Jirka (střední kvalita, 22 kHz)', lang: 'cs', sizeMB: 63, license: 'Dataset CC0 (NabuCasa/voice-datasets); model dolaďován z anglického hlasu „lessac“ – před komerčním použitím ověřte licenci základního modelu.', onnxUrl: `${HF}/medium/cs_CZ-jirka-medium.onnx`, jsonUrl: `${HF}/medium/cs_CZ-jirka-medium.onnx.json` },
  { id: 'cs_CZ-jirka-low', label: 'Čeština – Jirka (nižší kvalita, 16 kHz, rychlejší)', lang: 'cs', sizeMB: 0, license: 'Dataset CC0 (NabuCasa/voice-datasets); model dolaďován z anglického hlasu „lessac“ – před komerčním použitím ověřte licenci základního modelu.', onnxUrl: `${HF}/low/cs_CZ-jirka-low.onnx`, jsonUrl: `${HF}/low/cs_CZ-jirka-low.onnx.json` }
];

/** Binárka Piper 2023.11.14-2 pro Windows (MIT). SHA-256 jsme spočítali ze staženého archivu. */
export const PIPER_PACKAGE = {
  url: 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',
  sha256: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea'
};
const ALLOWED_HOSTS = ['github.com', 'huggingface.co'];
const MAX_CACHE_BYTES = 200 * 1024 * 1024;
export const MAX_TEXT = 500;

export interface TtsDeps {
  platform: string;
  downloadFile(url: string, dest: string, onProgress: (fraction: number | null) => void): Promise<{ sha256: string; bytes: number }>;
  extractZip(zip: string, dest: string): Promise<void>;
  runPiper(exe: string, args: string[], text: string, cwd: string): Promise<void>;
}
export interface TtsStatus {
  supported: boolean; piperInstalled: boolean;
  voices: (Omit<VoiceInfo, 'onnxUrl' | 'jsonUrl'> & { installed: boolean })[];
  cacheBytes: number; cacheFiles: number;
}
export type TtsProgress = { task: string; fraction: number | null };

const exists = (p: string) => access(p).then(() => true, () => false);

export class TextToSpeechService {
  constructor(private dir: string, private db: Database, private deps: TtsDeps) {}
  private compatible = new Set<string>();
  private repairing = new Map<string, Promise<void>>();
  private async ensureCompatibleVoice(id: string): Promise<void> {
    if (this.compatible.has(id)) return;
    const waiting = this.repairing.get(id); if (waiting) return waiting;
    const run = (async () => {
      const meta = JSON.parse(await readFile(`${this.voicePath(id)}.json`, 'utf8')) as { phoneme_id_map?: Record<string, unknown> };
      // The installed MIT Piper only accepts one Unicode code point per phoneme key.
      // New upstream main models contain vowel clusters; pin and reinstall the matching v1 model AND config.
      if (meta.phoneme_id_map && Object.keys(meta.phoneme_id_map).some(k => [...k].length !== 1)) {
        await this.installVoice(id, () => undefined);
      }
      this.compatible.add(id);
    })().finally(() => this.repairing.delete(id));
    this.repairing.set(id, run); return run;
  }
  private piperExe = () => join(this.dir, 'piper', 'piper.exe');
  private voicePath = (id: string) => join(this.dir, 'voices', `${id}.onnx`);
  private cacheDir = () => join(this.dir, 'cache');
  private get supported() { return this.deps.platform === 'win32'; }

  async status(): Promise<TtsStatus> {
    const row = this.db.db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(bytes),0) AS b FROM tts_cache').get() as { n: number; b: number };
    return {
      supported: this.supported,
      piperInstalled: await exists(this.piperExe()),
      voices: await Promise.all(VOICES.map(async ({ onnxUrl: _o, jsonUrl: _j, ...v }) => ({ ...v, installed: await exists(this.voicePath(v.id)) }))),
      cacheBytes: row.b, cacheFiles: row.n
    };
  }

  private checkHost(url: string) {
    if (!ALLOWED_HOSTS.includes(new URL(url).hostname)) throw new Error('Adresa stahování není na seznamu povolených zdrojů.');
  }

  async installPiper(onProgress: (p: TtsProgress) => void): Promise<void> {
    if (!this.supported) throw new Error('Piper je v této verzi podporován pouze na Windows. Použijte systémový hlas.');
    this.checkHost(PIPER_PACKAGE.url);
    await mkdir(this.dir, { recursive: true });
    const zip = join(this.dir, 'piper.zip.part');
    try {
      const r = await this.deps.downloadFile(PIPER_PACKAGE.url, zip, (f) => onProgress({ task: 'Stahuji Piper', fraction: f }));
      if (r.sha256 !== PIPER_PACKAGE.sha256) throw new Error('Kontrolní součet staženého archivu Piperu nesouhlasí – instalace přerušena.');
      onProgress({ task: 'Rozbaluji Piper', fraction: null });
      await this.deps.extractZip(zip, this.dir);
      if (!(await exists(this.piperExe()))) throw new Error('Po rozbalení chybí piper.exe.');
    } finally { await rm(zip, { force: true }); }
  }

  async installVoice(id: string, onProgress: (p: TtsProgress) => void): Promise<void> {
    const v = VOICES.find((x) => x.id === id);
    if (!v) throw new Error('Neznámý hlas.');
    this.checkHost(v.onnxUrl); this.checkHost(v.jsonUrl);
    await mkdir(join(this.dir, 'voices'), { recursive: true });
    const onnx = this.voicePath(id), json = `${onnx}.json`;
    try {
      await this.deps.downloadFile(v.jsonUrl, `${json}.part`, () => undefined);
      const meta = JSON.parse(await readFile(`${json}.part`, 'utf8')) as { audio?: { sample_rate?: number } };
      if (!meta.audio?.sample_rate) throw new Error('Konfigurace hlasu je neplatná.');
      const r = await this.deps.downloadFile(v.onnxUrl, `${onnx}.part`, (f) => onProgress({ task: `Stahuji hlas ${v.id}`, fraction: f }));
      if (r.bytes < 1_000_000) throw new Error('Stažený model hlasu je podezřele malý.');
      await rename(`${json}.part`, json); await rename(`${onnx}.part`, onnx);
    } finally { await rm(`${onnx}.part`, { force: true }); await rm(`${json}.part`, { force: true }); }
  }

  /** Vygeneruje WAV (nebo vrátí z cache). Rychlost 0,5–2 (vyšší = rychlejší řeč). */
  async synthesize(text: string, voiceId: string, rate: number): Promise<Uint8Array> {
    const t = text.trim();
    if (!t || t.length > MAX_TEXT) throw new Error(`Text hlášení musí mít 1–${MAX_TEXT} znaků.`);
    if (!VOICES.some((v) => v.id === voiceId)) throw new Error('Neznámý hlas.');
    const r = Math.min(2, Math.max(0.5, rate));
    if (!(await exists(this.piperExe()))) throw new Error('Piper není nainstalován (Nastavení → Hlášení).');
    if (!(await exists(this.voicePath(voiceId)))) throw new Error('Vybraný hlas není stažený.');
    await this.ensureCompatibleVoice(voiceId);
    const hash = createHash('sha256').update(`v1|${voiceId}|${r.toFixed(2)}|${t}`).digest('hex');
    const file = join(this.cacheDir(), `${hash}.wav`);
    if (await exists(file)) return new Uint8Array(await readFile(file));
    await mkdir(this.cacheDir(), { recursive: true });
    const tmp = `${file}.part`;
    try {
      await this.deps.runPiper(this.piperExe(), ['--model', this.voicePath(voiceId), '--output_file', tmp, '--length_scale', (1 / r).toFixed(3)], t.replace(/\s+/g, ' '), join(this.dir, 'piper'));
      await rename(tmp, file);
    } finally { await rm(tmp, { force: true }); }
    const bytes = (await stat(file)).size;
    this.db.db.prepare('INSERT OR REPLACE INTO tts_cache(hash, file, bytes, created) VALUES(?,?,?,?)').run(hash, file, bytes, Date.now());
    await this.evict();
    return new Uint8Array(await readFile(file));
  }

  private async evict(): Promise<void> {
    const total = (this.db.db.prepare('SELECT COALESCE(SUM(bytes),0) AS b FROM tts_cache').get() as { b: number }).b;
    if (total <= MAX_CACHE_BYTES) return;
    const rows = this.db.db.prepare('SELECT hash, file, bytes FROM tts_cache ORDER BY created ASC').all() as { hash: string; file: string; bytes: number }[];
    let sum = total;
    for (const r of rows) {
      if (sum <= MAX_CACHE_BYTES * 0.8) break;
      await rm(r.file, { force: true }); this.db.db.prepare('DELETE FROM tts_cache WHERE hash = ?').run(r.hash); sum -= r.bytes;
    }
  }

  async clearCache(): Promise<number> {
    const n = (this.db.db.prepare('SELECT COUNT(*) AS n FROM tts_cache').get() as { n: number }).n;
    await rm(this.cacheDir(), { recursive: true, force: true });
    this.db.db.exec('DELETE FROM tts_cache');
    return n;
  }

  /* Editor výslovnosti – uloženo v SQLite. */
  listPronunciations(): { word: string; spoken: string }[] {
    return this.db.db.prepare('SELECT word, spoken FROM pronunciations ORDER BY word COLLATE NOCASE').all() as { word: string; spoken: string }[];
  }
  setPronunciation(word: string, spoken: string): void {
    const w = word.trim(), s = spoken.trim();
    if (!w || !s || w.length > 80 || s.length > 80) throw new Error('Slovo i výslovnost musí mít 1–80 znaků.');
    this.db.db.prepare('INSERT INTO pronunciations(word, spoken) VALUES(?,?) ON CONFLICT(word) DO UPDATE SET spoken = excluded.spoken').run(w, s);
  }
  deletePronunciation(word: string): void { this.db.db.prepare('DELETE FROM pronunciations WHERE word = ?').run(word); }
  async listCacheFiles(): Promise<number> { try { return (await readdir(this.cacheDir())).length; } catch { return 0; } }
  async writeText(file: string, text: string) { await writeFile(file, text); }
}
