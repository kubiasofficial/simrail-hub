import { useMemo, useState, useCallback, useEffect } from 'react';
import { RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { useSelection } from '@/stores/selection';
import { useNavigation } from '@/stores/navigation';
import { useServers } from '@/stores/servers';
import { useSettings } from '@/stores/settings';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { ServerRow } from '@/types/servers';
import { isCzechServer, sortServers } from '@/services/serverPrefs';

const NA = 'Nedostupné';
type Filter = 'all' | 'active' | 'inactive';

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  return s < 60 ? `před ${s} s` : `před ${Math.round(s / 60)} min`;
}

export function ServersPage() {
  const { snapshot, error, loading, refresh } = useServers();
  const [favorites,setFavorites]=useState<string[]>(()=>{try{const v=JSON.parse(localStorage.getItem('simrail:favorites:v1')??'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,50):[];}catch{return [];}});
  const toggleFavorite=(code:string)=>setFavorites(current=>{const next=current.includes(code)?current.filter(x=>x!==code):[...current,code];localStorage.setItem('simrail:favorites:v1',JSON.stringify(next));return next;});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [region, setRegion] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [auto, setAuto] = useState(true);
  const refreshSeconds = useSettings((st) => st.settings.dataRefreshSeconds);

  const tick = useCallback(() => { void refresh(false); }, [refresh]);
  useAutoRefresh(tick, refreshSeconds * 1000, auto);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const regions = useMemo(
    () => [...new Set((snapshot?.servers ?? []).map((s) => s.region).filter((r): r is string => !!r))].sort(),
    [snapshot]
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortServers(snapshot?.servers ?? []).filter((s: ServerRow) =>
      (filter === 'all' || (filter === 'active') === s.active) &&
      (region === 'all' || s.region === region) &&
      (!q || `${s.name} ${s.code} ${s.region ?? ''} ${s.language ?? ''}`.toLowerCase().includes(q)));
  }, [snapshot, query, filter, region]);
  const favoriteRows=[...rows].sort((a,b)=>Number(favorites.includes(b.code))-Number(favorites.includes(a.code)));

  const field = 'rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-brand';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="mr-auto text-xl font-semibold text-white">Online servery</h2>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className={`${field} w-44 pl-8`} placeholder="Hledat server…" aria-label="Hledat server" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className={field} aria-label="Stav serveru" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">Všechny stavy</option><option value="active">Aktivní</option><option value="inactive">Neaktivní</option>
        </select>
        <select className={field} aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">Všechny regiony</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Automaticky ({refreshSeconds} s)
        </label>
        <button onClick={() => void refresh(true)} disabled={loading} className="flex items-center gap-2 rounded-lg bg-sky-brand/15 px-3 py-2 text-sm text-sky-soft ring-1 ring-sky-brand/30 hover:bg-sky-brand/25 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Obnovit
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <div>{error}{snapshot && <div className="mt-1 text-xs text-amber-200/70">Zobrazena poslední úspěšně načtená data ({ago(snapshot.fetchedAt, now)}).</div>}</div>
        </div>
      )}

      {!snapshot && loading && <p className="text-sm text-slate-400">Načítám servery…</p>}
      {!snapshot && !loading && !error && <p className="text-sm text-slate-400">Zatím nejsou žádná data.</p>}

      {snapshot && (
        <div className="panel overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Server</th><th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">Jazyk</th><th className="px-4 py-3 font-medium">Stav</th>
                <th className="px-4 py-3 font-medium" title="Vlaky řízené hráči (typ „user“)">Strojvedoucí</th>
                <th className="px-4 py-3 font-medium">Dispečeři</th><th className="px-4 py-3 font-medium">Vlaky celkem</th><th className="px-4 py-3 font-medium">Otevřít</th>
              </tr>
            </thead>
            <tbody>
              {favoriteRows.map((s) => (
                <tr key={s.code} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3"><div className="flex items-center gap-2 font-medium text-white"><button className="favorite-button" aria-label={`Oblíbený server ${s.name}`} aria-pressed={favorites.includes(s.code)} onClick={()=>toggleFavorite(s.code)}>{favorites.includes(s.code)?'★':'☆'}</button>{s.name}{isCzechServer(s) && <span className="rounded bg-sky-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-soft">ČESKÝ</span>}</div><div className="text-xs text-slate-500">{s.code}</div></td>
                  <td className="px-4 py-3 text-slate-300">{s.region ?? NA}</td>
                  <td className="px-4 py-3 text-slate-300">{s.language ?? NA}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${s.active ? 'text-emerald-300' : 'text-slate-500'}`}>
                      <span className={`h-2 w-2 rounded-full ${s.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />{s.active ? 'Aktivní' : 'Neaktivní'}
                    </span>
                  </td>
                  {s.stats ? (
                    <>
                      <td className="px-4 py-3 text-white">{s.stats.trainsUser}</td>
                      <td className="px-4 py-3 text-white">{s.stats.dispatchers}</td>
                      <td className="px-4 py-3 text-slate-300">{s.stats.trainsTotal}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="px-4 py-3 text-xs text-slate-500">{s.statsError ? `${NA}: ${s.statsError}` : s.active ? NA : '—'}</td>
                  )}<td className="px-4 py-3"><button className="secondary-action" disabled={!s.active} onClick={() => { useSelection.getState().set({ server:s.code, train:null }); useNavigation.getState().setPage('map'); }}>Mapa</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Žádný server neodpovídá filtrům.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {snapshot && <p className="text-xs text-slate-500">Zdroj: {snapshot.source} · aktualizováno {ago(snapshot.fetchedAt, now)}. Počet hráčů = vlaky řízené hráči; počet hráčů ve hře API neposkytuje.</p>}
    </div>
  );
}
