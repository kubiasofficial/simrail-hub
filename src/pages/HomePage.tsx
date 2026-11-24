import {UpdatePanel} from '@/components/UpdatePanel';
import { useEffect, useState } from 'react';
import { Play, FolderOpen, Users, Activity, RefreshCw, FolderSearch, Undo2 } from 'lucide-react';
import type { AppInfo } from '@/types/ipc';
import { useGame } from '@/stores/game';
import { useServers } from '@/stores/servers';
import { useSelection } from '@/stores/selection';
import { useNavigation } from '@/stores/navigation';
import { Onboarding } from './Onboarding';
import { heroMedia } from '@/data/wikiMedia';

const NA = 'Nedostupné';

function Stat({ icon, label, value, note, muted }: { icon: React.ReactNode; label: string; value: string; note?: string; muted?: boolean }) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">{icon}{label}</div>
      <div className={`mt-2 text-lg font-semibold ${muted ? 'text-slate-500' : 'text-white'}`}>{value}</div>
      {note && <div className="mt-1 break-all text-xs text-slate-500">{note}</div>}
    </div>
  );
}

export function HomePage() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const { result, loading, error, launching, detect, launch, pickFolder, clearManual } = useGame();

  useEffect(() => {
    void window.simrailHub?.getAppInfo().then(setInfo).catch(() => setInfo(null));
    void detect();
  }, [detect]);

  const { snapshot, error: srvError, refresh } = useServers();
  useEffect(() => { void refresh(false); }, [refresh]);
  const drivers = snapshot ? snapshot.servers.reduce((n, s) => n + (s.stats?.trainsUser ?? 0), 0) : null;
  const reachable = snapshot ? snapshot.servers.filter((s) => s.stats).length : 0;
  const install = result?.install ?? null;
  const manual = install?.source === 'manual';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <section className="panel hero-banner relative overflow-hidden rounded-3xl p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-brand/20 blur-3xl" />
        <span className="eyebrow">VAŠE DALŠÍ JÍZDA ZAČÍNÁ TADY</span><h1 className="font-display text-4xl font-semibold tracking-tight text-white">SimRail Hub<span className="hero-rail" aria-hidden="true"/></h1>
        <p className="mt-1 max-w-lg text-slate-400">Vyberte server, sledujte provoz a vydejte se na trať.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void launch()}
            disabled={launching}
            className="flex items-center gap-2 rounded-xl bg-sky-brand px-6 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-sky-soft disabled:opacity-50"
          >
            <Play size={16} fill="currentColor" /> {launching ? 'SPOUŠTÍM…' : 'SPUSTIT HRU'}
          </button>
          <button onClick={() => void pickFolder()} className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-white/5">
            <FolderSearch size={16} /> Vybrat složku ručně
          </button>
          {manual && (
            <button onClick={() => void clearManual()} className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-slate-400 transition-colors hover:text-white">
              <Undo2 size={15} /> Zpět na automatické hledání
            </button>
          )}
        </div>
        {!install && !loading && result && (
          <p className="mt-3 text-xs text-slate-500">Hru jsme nenašli, ale Steam ji i tak zkusí spustit, pokud je nainstalovaná.</p>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        <a className="hero-source" href={heroMedia.page} target="_blank" rel="noreferrer">Snímek ze hry · SimRail Wiki ↗</a>
      </section>

      {useSelection.getState().train && <section className="panel resume-card"><div><strong>Vlak {useSelection.getState().train}</strong><small>Poslední výběr · {useSelection.getState().server}</small></div><button className="secondary-action" onClick={()=>useNavigation.getState().setPage('dashboard')}>Pokračovat ve sledování</button></section>}
      <section className="quick-links"><button onClick={() => useNavigation.getState().setPage('map')}>Živá mapa <small>Vlaky a stanice na jednom místě</small></button><button onClick={() => useNavigation.getState().setPage('dashboard')}>Palubní počítač <small>Váš jízdní řád a mobilní displej</small></button></section>
      <Onboarding />

      <section className="grid grid-cols-3 gap-4">
        <Stat
          icon={<FolderOpen size={14} />}
          label="Stav instalace"
          value={loading && !result ? 'Hledám…' : install ? (manual ? 'Nalezeno (ručně)' : 'Nainstalováno') : NA}
          muted={!install}
          note={install ? install.path : undefined}
        />
        <Stat icon={<Users size={14} />} label="Vlaky řízené hráči" value={snapshot && reachable > 0 ? String(drivers) : NA} muted={!(snapshot && reachable > 0)} note={snapshot && reachable > 0 ? 'Vlaky řízené hráči na všech serverech' : srvError ?? undefined} />
        <Stat icon={<Activity size={14} />} label="Služba SimRail API" value={snapshot ? `${snapshot.servers.filter((s) => s.active).length} aktivních serverů` : NA} muted={!snapshot} note={snapshot ? 'panel.simrail.eu odpovídá' : srvError ?? undefined} />
      </section>

      {result && result.messages.length > 0 && (
        <section className="panel rounded-2xl p-4 text-xs text-slate-400">
          <div className="mb-1 font-medium text-slate-300">Diagnostika detekce</div>
          <ul className="list-disc pl-5">{result.messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </section>
      )}

      <UpdatePanel/>
    </div>
  );
}
