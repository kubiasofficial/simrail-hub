import { useEffect, useState, useCallback } from 'react';
import { Archive, Download, Package, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import type { InstalledMod } from '@/types/mods';
import type { Res } from '@/types/ipc';

const MANIFEST_EXAMPLE = `{
  "id": "moje-vyslovnost",
  "name": "Moje výslovnost stanic",
  "author": "Jméno",
  "version": "1.0.0",
  "type": "pronunciation-dictionary",
  "source": "https://example.com/odkaz",
  "compatibility": { "hubMin": "0.1.0" }
}`;
const TYPE_LABEL: Record<string, string> = { 'announcement-templates': 'Šablony hlášení', 'pronunciation-dictionary': 'Slovník výslovnosti' };

export function ModsPage() {
  const [mods, setMods] = useState<InstalledMod[]>([]);
  const [backups, setBackups] = useState<{ name: string; bytes: number }[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const api = window.simrailHub!;

  const reload = useCallback(async () => {
    const [m, b] = await Promise.all([api.call('mods:list'), api.call('mods:backups')]);
    if (m.ok) setMods(m.data); else setMsg({ kind: 'err', text: m.error });
    if (b.ok) setBackups(b.data);
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  const run = async <T,>(fn: () => Promise<Res<T>>, okText?: (d: T) => string) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      if (r.ok) { if (okText) setMsg({ kind: 'ok', text: okText(r.data) }); } else setMsg({ kind: 'err', text: r.error });
      await reload();
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const btn = 'flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-40';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-xl font-semibold text-white">Rozšíření launcheru</h2>
        <button className={btn} disabled={busy} onClick={() => void run(() => api.call('mods:import'), (d) => (d ? 'Modifikace byla naimportována (je vypnutá – zapněte ji v seznamu).' : ''))}><Upload size={14} /> Importovat ZIP</button>
        <button className={btn} disabled={busy} onClick={() => void run(() => api.call('mods:backup'), (n) => `Záloha vytvořena: ${n}`)}><Archive size={14} /> Zálohovat</button>
      </div>

      <div className="panel flex gap-3 rounded-2xl p-4 text-xs text-slate-300">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
        <div><details><summary>Šablony hlášení a slovníky výslovnosti pro váš launcher</summary>
          Správce spravuje rozšíření <b>SimRail Hubu</b> (šablony hlášení a slovníky výslovnosti) a <b>nikdy nezapisuje do složky hry</b>. Pro SimRail jsme nenašli ověřený a zdokumentovaný mechanismus modifikací,
          proto je instalace do herních složek vypnutá. Archivy se kontrolují (manifest, povolené typy a soubory, velikost, bezpečné cesty) a nikdy se z nich nespouští kód.</details>
        </div>
      </div>

      {msg && <div role={msg.kind === 'err' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${msg.kind === 'err' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{msg.text}</div>}

      <div className="panel overflow-hidden rounded-2xl">
        {mods.length === 0 ? (
          <div className="grid place-items-center gap-2 p-10 text-sm text-slate-400"><Package size={26} className="text-slate-500" />Zatím nejsou nainstalovaná žádná rozšíření.<a href="./assets/ceska-vyslovnost.zip" download className="secondary-action">Stáhnout ukázkový český slovník</a><span className="muted">Potom ho vyberte přes Importovat ZIP.</span></div>
        ) : mods.map((m) => (
          <div key={m.id} className="flex items-center gap-4 border-b border-line/50 px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-medium text-white">{m.name}</span><span className="text-xs text-slate-500">v{m.version}</span></div>
              <div className="text-xs text-slate-400">{TYPE_LABEL[m.type] ?? m.type} · {m.author} · <span className="break-all">{m.source}</span></div>
              {!m.compatible && <div className="mt-1 text-xs text-amber-300">{m.compatibilityNote}</div>}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={m.enabled} disabled={busy || !m.compatible} onChange={(e) => void run(() => api.call('mods:set-enabled', m.id, e.target.checked))} /> Aktivní
            </label>
            <button aria-label={`Odinstalovat ${m.name}`} className="rounded p-2 text-slate-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40" disabled={busy}
              onClick={() => { if (confirm(`Odinstalovat modifikaci „${m.name}“?`)) void run(() => api.call('mods:uninstall', m.id), () => 'Modifikace odinstalována.'); }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="panel rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white"><RotateCcw size={14} className="text-sky-soft" /> Obnovení ze zálohy</div>
        {backups.length === 0 ? <div className="text-xs text-slate-500">Zatím žádné zálohy.</div> : backups.map((b) => (
          <div key={b.name} className="flex items-center justify-between py-1 text-xs text-slate-300">
            <span>{b.name} · {(b.bytes / 1024).toFixed(1)} kB</span>
            <button className={btn} disabled={busy} onClick={() => { if (confirm('Obnovit zálohu? Stejně pojmenované modifikace se přepíšou.')) void run(() => api.call('mods:restore', b.name), (d) => `Obnoveno: ${d.restored}${d.skipped.length ? `, přeskočeno: ${d.skipped.join('; ')}` : ''}`); }}><Download size={13} /> Obnovit</button>
          </div>
        ))}
      </div>

      <details className="panel rounded-2xl p-4 text-xs text-slate-400">
        <summary className="cursor-pointer text-sm text-slate-200">Jak vytvořit modifikaci</summary>
        <p className="mt-2">ZIP smí obsahovat jen <code>simrail-hub-mod.json</code> a jeden datový soubor: <code>pronunciations.json</code> (pole <code>[{'{'}"word":"…","spoken":"…"{'}'}]</code>) nebo <code>templates.json</code> (<code>{'{ "cs": { "arrived": "Jsme v {station}." } }'}</code>; druhy: next-station, approaching, arrived, terminal, delay).</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-950 p-3 text-slate-300">{MANIFEST_EXAMPLE}</pre>
      </details>
    </div>
  );
}
