import {serverFlag} from '@/services/serverFlags';
import { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { RefreshCw, Search, TriangleAlert, UserRound, TrainFront, Globe2, Star, ArrowUpRight } from 'lucide-react';
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
  const toggleFavorite=useCallback((code:string)=>setFavorites(current=>{const next=current.includes(code)?current.filter(x=>x!==code):[...current,code];try{localStorage.setItem('simrail:favorites:v1',JSON.stringify(next));}catch{}return next;}),[]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [onlyFavorites,setOnlyFavorites]=useState(false);
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
      (!onlyFavorites||favorites.includes(s.code)) &&
      (filter === 'all' || (filter === 'active') === s.active) &&
      (region === 'all' || s.region === region) &&
      (!q || `${s.name} ${s.code} ${s.region ?? ''} ${s.language ?? ''}`.toLowerCase().includes(q)));
  }, [snapshot, query, filter, region,onlyFavorites,favorites]);
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
        <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={onlyFavorites} onChange={e=>setOnlyFavorites(e.target.checked)}/>Jen oblíbené servery</label>
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

      {snapshot&&<div className="server-grid">{favoriteRows.map(server=><ServerTile key={server.code} server={server} favorite={favorites.includes(server.code)} toggleFavorite={toggleFavorite}/>)}{!rows.length&&<p className="muted">Žádný server neodpovídá filtrům.</p>}</div>}
      {snapshot && <p className="text-xs text-slate-500">Zdroj: {snapshot.source} · aktualizováno {ago(snapshot.fetchedAt, now)}. Počet hráčů = vlaky řízené hráči; počet hráčů ve hře API neposkytuje.</p>}
    </div>
  );
}

const ServerTile=memo(function ServerTile({server:s,favorite,toggleFavorite}:{server:ServerRow;favorite:boolean;toggleFavorite:(code:string)=>void}){
 const flag=serverFlag(s);
 return <article className={'server-tile'+(!s.active?' offline':'')+(favorite?' favorite':'')}>
 <header><div className="server-identity">{flag?<img className="server-flag" src={flag} alt="Vlajka serveru"/>:<Globe2 className="server-globe"/>}<div><h3>{s.code.toUpperCase()}</h3><p>{s.name}</p></div></div><button className="favorite-button" aria-label={'Oblíbený server '+s.name} aria-pressed={favorite} onClick={()=>toggleFavorite(s.code)}><Star size={17} fill={favorite?'currentColor':'none'}/></button></header>
 <div className="server-state"><span className={s.active?'online-dot':'offline-dot'}/>{s.active?'Online':'Offline'}<small>{s.region??'—'}</small></div>
 <div className="server-counts"><div><UserRound/><strong>{s.stats?s.stats.trainsUser+' / '+s.stats.dispatchers:'—'}</strong><span>Strojvedoucí / dispečeři</span></div><div><TrainFront/><strong>{s.stats?s.stats.trainsUser+' / '+s.stats.trainsBot:'—'}</strong><span>Hráčské / AI vlaky</span></div></div>
 {s.statsError&&<p className="server-stats-error">Statistiky nejsou dostupné.</p>}
 <button className="button server-open" disabled={!s.active} onClick={()=>{useSelection.getState().set({server:s.code,train:null});useNavigation.getState().setPage('map');}}>Otevřít mapu <ArrowUpRight size={15}/></button></article>;
});
