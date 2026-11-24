import {randomUUID} from 'node:crypto';
import {resolve,relative,isAbsolute} from 'node:path';
import {boundedUnzip} from './boundedZip';
import { mkdir, readFile, writeFile, rm, readdir, stat,rename,lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { SUPPORTED_MOD_TYPES, type ActiveModContent, type InstalledMod, type ModManifest, type ModType } from '../types/mods';
import { compareVersions } from './UpdateService';

export const MANIFEST_FILE = 'simrail-hub-mod.json';
const CONTENT_FILE: Record<ModType, string> = { 'announcement-templates': 'templates.json', 'pronunciation-dictionary': 'pronunciations.json' };
const MAX_ZIP = 1_000_000;
const MAX_UNPACKED = 2_000_000;
const KINDS = ['next-station', 'approaching', 'arrived', 'terminal', 'delay'];

export class ModError extends Error {}
export function validModId(id:string):boolean{return /^[a-z0-9][a-z0-9._-]{1,63}$/.test(id)&&!id.endsWith('.')&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id.split('.')[0]);}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const s = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

/** Bezpečný název položky v archivu: žádné „..“, absolutní cesty, zpětná lomítka ani písmena disků. */
export function isSafeEntryName(name: string): boolean {
  return !!name && !name.includes('..') && !name.startsWith('/') && !name.includes('\\') && !/^[a-zA-Z]:/.test(name) && !name.includes('\0') && !name.includes(':');
}

export function validateManifest(raw: unknown): ModManifest {
  if (!isRec(raw)) throw new ModError('Manifest není platný JSON objekt.');
  const id = s(raw.id, 64);
  if (!id || !validModId(id)) throw new ModError('Neplatné „id“ modifikace (povoleno: malá písmena, číslice, tečka, pomlčka, podtržítko).');
  const type = raw.type;
  if (typeof type !== 'string' || !(SUPPORTED_MOD_TYPES as readonly string[]).includes(type)) {
    throw new ModError(`Typ modifikace „${String(type)}“ není podporován. Podporované typy: ${SUPPORTED_MOD_TYPES.join(', ')}. Instalace do složky hry není povolena, protože SimRail nemá ověřený a zdokumentovaný mechanismus modifikací.`);
  }
  const version = s(raw.version, 32);
  if (!version || !/^\d+(\.\d+){0,3}$/.test(version)) throw new ModError('Neplatná „version“ (očekáváno např. 1.0.0).');
  const name = s(raw.name, 80), author = s(raw.author, 80), source = s(raw.source, 300);
  if (!name || !author || !source) throw new ModError('Manifest musí obsahovat „name“, „author“ a „source“.');
  const comp = isRec(raw.compatibility) ? raw.compatibility : {};
  return {
    id, name, author, version, source, type: type as ModType,
    description: s(raw.description, 300) ?? undefined,
    compatibility: { hubMin: s(comp.hubMin, 32) ?? undefined, hubMax: s(comp.hubMax, 32) ?? undefined }
  };
}

function validateContent(type: ModType, text: string): void {
  let j: unknown;
  try { j = JSON.parse(text); } catch { throw new ModError(`Soubor ${CONTENT_FILE[type]} není platný JSON.`); }
  if (type === 'announcement-templates') {
    if (!isRec(j)) throw new ModError('templates.json musí být objekt { "cs": {…}, "pl": {…} }.');
    for (const [lang, t] of Object.entries(j)) {
      if (lang !== 'cs' && lang !== 'pl') throw new ModError(`Neznámý jazyk šablon „${lang}“.`);
      if (!isRec(t)) throw new ModError('Šablony jazyka musí být objekt.');
      for (const [k, v] of Object.entries(t)) if (!KINDS.includes(k) || typeof v !== 'string' || v.length > 300) throw new ModError(`Neplatná šablona „${k}“.`);
    }
  } else {
    if (!Array.isArray(j) || j.length > 2000) throw new ModError('pronunciations.json musí být pole (max. 2000 položek).');
    for (const e of j) if (!isRec(e) || !s(e.word, 80) || !s(e.spoken, 80)) throw new ModError('Každá položka výslovnosti musí mít „word“ a „spoken“ (max. 80 znaků).');
  }
}

/** Rozbalí a plně zvaliduje archiv v paměti; na disk se nic nezapisuje. */
export function readModArchive(bytes: Uint8Array): { manifest: ModManifest; content: string } {
  if (bytes.length > MAX_ZIP) throw new ModError('Archiv je příliš velký (max. 1 MB).');
  let names: { name: string; size: number }[] = [];
  try { unzipSync(bytes, { filter: (f) => { names.push({ name: f.name, size: f.originalSize }); return false; } }); }
  catch { throw new ModError('Soubor není platný ZIP archiv.'); }
  names = names.filter((n) => !n.name.endsWith('/'));
  if (names.length === 0 || names.length > 4) throw new ModError('Archiv musí obsahovat jen manifest a jeden datový soubor.');
  if (names.some((n) => !isSafeEntryName(n.name))) throw new ModError('Archiv obsahuje nebezpečnou cestu souboru (např. „..“) a byl odmítnut.');
  if (names.reduce((a, n) => a + n.size, 0) > MAX_UNPACKED) throw new ModError('Obsah archivu je po rozbalení příliš velký.');
  const files = boundedUnzip(bytes,MAX_UNPACKED,8);
  const mf = files[MANIFEST_FILE];
  if (!mf) throw new ModError(`V archivu chybí ${MANIFEST_FILE}.`);
  let rawManifest: unknown;
  try { rawManifest = JSON.parse(strFromU8(mf)); } catch { throw new ModError('Manifest není platný JSON.'); }
  const manifest = validateManifest(rawManifest);
  const allowed = new Set([MANIFEST_FILE, CONTENT_FILE[manifest.type]]);
  const extra = names.find((n) => !allowed.has(n.name));
  if (extra) throw new ModError(`Archiv obsahuje nepovolený soubor „${extra.name}“. Spustitelné ani jiné soubory nejsou povoleny.`);
  const body = files[CONTENT_FILE[manifest.type]];
  if (!body) throw new ModError(`V archivu chybí ${CONTENT_FILE[manifest.type]}.`);
  const content = strFromU8(body);
  validateContent(manifest.type, content);
  return { manifest, content };
}

export class ModManager {
  constructor(private modsDir: string, private backupsDir: string, private hubVersion: string) {}
  private stateFile = () => join(this.modsDir, 'state.json');
  private changes:Promise<unknown>=Promise.resolve();
  private serial<T>(run:()=>Promise<T>):Promise<T>{const task=this.changes.then(run);this.changes=task.catch(()=>undefined);return task;}
  private async safeDir(id:string):Promise<string>{
   if(!validModId(id))throw new ModError('Neplatné id modifikace.');
   const root=resolve(this.modsDir),target=resolve(root,id),rel=relative(root,target);
   if(rel.startsWith('..')||isAbsolute(rel)||!rel)throw new ModError('Nebezpečná cílová cesta.');
   const info=await lstat(target).catch(()=>null);if(info?.isSymbolicLink())throw new ModError('Symbolický odkaz není povolen.');return target;
  }
  private async replaceMod(manifest:ModManifest,content:string){
   await mkdir(this.modsDir,{recursive:true});const target=await this.safeDir(manifest.id),stage=join(this.modsDir,'.staging-'+randomUUID()),previous=join(this.modsDir,'.previous-'+randomUUID());
   await mkdir(stage);let moved=false;
   try{
    await writeFile(join(stage,MANIFEST_FILE),JSON.stringify(manifest,null,2));await writeFile(join(stage,CONTENT_FILE[manifest.type]),content);
    const exists=await stat(target).then(()=>true,()=>false);if(exists){await rename(target,previous);moved=true;}
    try{await rename(stage,target);}catch(e){if(moved)await rename(previous,target);throw e;}
    // Retain previous on-disk content for recovery after interruption; list() ignores dot folders.
   }finally{await rm(stage,{recursive:true,force:true});}
  }

  private async readState(): Promise<Record<string, { enabled: boolean; installedAt: number }>> {
    try { const j = JSON.parse(await readFile(this.stateFile(), 'utf8')); return isRec(j) ? (j as never) : {}; } catch { return {}; }
  }
  private async writeState(st: Record<string, unknown>) { await mkdir(this.modsDir, { recursive: true }); const temp=this.stateFile()+'.part';await writeFile(temp, JSON.stringify(st, null, 2));await rename(temp,this.stateFile()); }

  private compat(m: ModManifest): { ok: boolean; note: string | null } {
    const c = m.compatibility;
    if (c?.hubMin && compareVersions(this.hubVersion, c.hubMin) < 0) return { ok: false, note: `Vyžaduje SimRail Hub ${c.hubMin} nebo novější (máte ${this.hubVersion}).` };
    if (c?.hubMax && compareVersions(this.hubVersion, c.hubMax) > 0) return { ok: false, note: `Určeno pro SimRail Hub nejvýše ${c.hubMax} (máte ${this.hubVersion}).` };
    return { ok: true, note: null };
  }

  async list(): Promise<InstalledMod[]> {
    const st = await this.readState();
    let dirs: string[] = [];
    try { dirs = (await readdir(this.modsDir, { withFileTypes: true })).filter((d) => d.isDirectory()&&!d.name.startsWith('.')).map((d) => d.name); } catch { return []; }
    const out: InstalledMod[] = [];
    for (const d of dirs) {
      try {
        const m = validateManifest(JSON.parse(await readFile(join(this.modsDir, d, MANIFEST_FILE), 'utf8')));
        if (m.id !== d) continue;
        const c = this.compat(m);
        out.push({ ...m, enabled: !!st[m.id]?.enabled && c.ok, installedAt: st[m.id]?.installedAt ?? 0, compatible: c.ok, compatibilityNote: c.note });
      } catch { /* poškozená složka přeskočíme */ }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }

  /** Import ZIP: nová verze přepíše starší (stav zapnuto/vypnuto zůstane), stejná nebo starší verze se odmítne. */
  importArchive(bytes:Uint8Array){return this.serial(()=>this.importNow(bytes));}
  private async importNow(bytes: Uint8Array): Promise<{ mod: InstalledMod; message: string }> {
    const { manifest, content } = readModArchive(bytes);
    const existing = (await this.list()).find((m) => m.id === manifest.id);
    if (existing && compareVersions(manifest.version, existing.version) <= 0) {
      throw new ModError(`Modifikace „${manifest.name}“ je už nainstalovaná ve verzi ${existing.version}; importovaná verze ${manifest.version} není novější.`);
    }
    await this.replaceMod(manifest,content);
    const st = await this.readState();
    st[manifest.id] = { enabled: existing?.enabled ?? false, installedAt: Date.now() };
    await this.writeState(st);
    const mod = (await this.list()).find((m) => m.id === manifest.id)!;
    return { mod, message: existing ? `Aktualizováno ${existing.version} → ${manifest.version}.` : 'Nainstalováno (vypnuto – zapněte ho v seznamu).' };
  }

  setEnabled(id:string,enabled:boolean){return this.serial(()=>this.enableNow(id,enabled));}
  private async enableNow(id: string, enabled: boolean): Promise<void> {
    const mod = (await this.list()).find((m) => m.id === id);
    if (!mod) throw new ModError('Modifikace nebyla nalezena.');
    if (enabled && !mod.compatible) throw new ModError(mod.compatibilityNote ?? 'Modifikace není kompatibilní.');
    const st = await this.readState();
    st[id] = { enabled, installedAt: st[id]?.installedAt ?? Date.now() };
    await this.writeState(st);
  }

  uninstall(id:string){return this.serial(()=>this.uninstallNow(id));}
  private async uninstallNow(id: string): Promise<void> {
    if (!validModId(id)) throw new ModError('Neplatné id modifikace.');
    await rm(await this.safeDir(id), { recursive: true, force: true });
    const st = await this.readState(); delete st[id]; await this.writeState(st);
  }

  async active(): Promise<ActiveModContent> {
    const out: ActiveModContent = { templates: {}, pronunciations: [] };
    for (const m of (await this.list()).filter((x) => x.enabled)) {
      const content=await readFile(join(await this.safeDir(m.id), CONTENT_FILE[m.type]),'utf8');validateContent(m.type,content);const j=JSON.parse(content);
      if (m.type === 'announcement-templates') for (const lang of ['cs', 'pl'] as const) out.templates[lang] = { ...out.templates[lang], ...j[lang] };
      else out.pronunciations.push(...(j as { word: string; spoken: string }[]));
    }
    return out;
  }

  backup(){return this.serial(()=>this.backupNow());}
  private async backupNow(): Promise<string> {
    await mkdir(this.backupsDir, { recursive: true });
    const files: Record<string, Uint8Array> = {};let total=0;const installed=await this.list();if(installed.length>40)throw new ModError('Záloha podporuje nejvýše 40 doplňků.');
    for (const m of installed) {
      for (const f of [MANIFEST_FILE, CONTENT_FILE[m.type]]) files[`${m.id}/${f}`] = new Uint8Array(await readFile(join(this.modsDir, m.id, f)));
    }
    for(const file of Object.values(files)){total+=file.byteLength;if(total>MAX_UNPACKED*20)throw new ModError('Obsah zálohy je příliš velký.');}
    files['state.json'] = strToU8(JSON.stringify(await this.readState()));
    const name = `mods-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    const archive=zipSync(files);if(archive.byteLength>MAX_ZIP*20)throw new ModError('Záloha je příliš velká.');await writeFile(join(this.backupsDir, name), archive);
    return name;
  }

  async listBackups(): Promise<{ name: string; bytes: number }[]> {
    try {
      const names = (await readdir(this.backupsDir)).filter((n) => /^mods-[\w-]+\.zip$/.test(n)).sort().reverse();
      return Promise.all(names.map(async (name) => ({ name, bytes: (await stat(join(this.backupsDir, name))).size })));
    } catch { return []; }
  }

  /** Obnovení zálohy: každá modifikace projde stejnou validací jako import; poškozené se přeskočí. */
  restore(name:string){return this.serial(()=>this.restoreNow(name));}
  private async restoreNow(name: string): Promise<{ restored: number; skipped: string[] }> {
    if (!/^mods-[\w-]+\.zip$/.test(name)) throw new ModError('Neplatný název zálohy.');
    if((await stat(join(this.backupsDir,name))).size>MAX_ZIP*20)throw new ModError('Záloha je příliš velká.');
    const bytes = new Uint8Array(await readFile(join(this.backupsDir, name)));
    if (bytes.length > MAX_ZIP * 20) throw new ModError('Záloha je příliš velká.');
    const files = boundedUnzip(bytes,MAX_UNPACKED*20,100);
    const ids = new Set(Object.keys(files).filter(isSafeEntryName).map((n) => n.split('/')[0]).filter((n) => n !== 'state.json'));
    let restored = 0; const skipped: string[] = [];
    const state = isRec(JSON.parse(strFromU8(files['state.json'] ?? strToU8('{}')))) ? JSON.parse(strFromU8(files['state.json'] ?? strToU8('{}'))) : {};
    for (const id of ids) {
      try {
        const sub: Record<string, Uint8Array> = {};
        for (const [n, d] of Object.entries(files)) if (n.startsWith(`${id}/`) && isSafeEntryName(n)) sub[n.slice(id.length + 1)] = d;
        const { manifest, content } = readModArchive(zipSync(sub));
        if (manifest.id !== id) throw new ModError('Id v záloze nesouhlasí.');
        await this.replaceMod(manifest,content);
        const st = await this.readState(); st[id] = { enabled: state[id]?.enabled === true, installedAt: Date.now() }; await this.writeState(st);
        restored++;
      } catch (e) { skipped.push(`${id}: ${(e as Error).message}`); }
    }
    return { restored, skipped };
  }
}
