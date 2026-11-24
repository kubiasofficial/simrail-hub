import {useVisualActivity} from '@/hooks/useVisualActivity';
import {delaySeverity} from '@/services/delayPresentation';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ArrowDown, ExternalLink, Megaphone, Pause, Play, RotateCcw, SkipForward, Square, TrainFront, TriangleAlert, Wifi, WifiOff } from 'lucide-react';
import {ServiceAnnouncementPanel} from '@/components/ServiceAnnouncementPanel';
import { MobilePairing } from '@/components/MobilePairing';
import { VehicleCard } from '@/components/VehicleCard';
import { useTrainFeed, type FeedSource } from '@/hooks/useTrainFeed';
import { useSelection } from '@/stores/selection';
import { pickDefaultServer } from '@/services/serverPrefs';
import { useServers } from '@/stores/servers';
import { useSettings } from '@/stores/settings';
import { useDemo } from '@/stores/demo';
import { useAnnouncer } from '@/stores/announcer';
import { AnnouncementTrigger, type AnnKind } from '@/services/announcements';
import type { DelayClass, OnboardModel } from '@/services/onboard';
import type { Train } from '@/types/trains';
import { isFreightTrain } from '@/services/trainPurpose';

const NA = 'Nedostupné';
const DELAY_STYLE: Record<DelayClass, string> = {
  none: 'border-slate-600/50 bg-slate-500/10 text-slate-300',
  ontime: 'border-slate-500/50 bg-slate-500/15 text-slate-200',
  early: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
  late: 'border-amber-400/50 bg-amber-400/15 text-amber-300',
  verylate: 'border-red-500/50 bg-red-500/15 text-red-300'
};
const DELAY_TEXT: Record<DelayClass, string> = { none: 'text-slate-400', ontime: 'text-slate-200', early: 'text-emerald-300', late: 'text-amber-300', verylate: 'text-red-300' };
const fmtDelay = (m: OnboardModel) => (m.delayMin === null ? NA : m.delayMin === 0 ? 'Podle jízdního řádu' : `${m.delayMin > 0 ? '+' : '−'}${Math.abs(m.delayMin)} min`);

function Conn({ c }: { c: OnboardModel['connection'] }) {
  const map = { live: ['Online', 'text-emerald-300', Wifi], stale: ['Zastaralá data', 'text-amber-300', WifiOff], lost: ['Spojení ztraceno', 'text-red-300', WifiOff], demo: ['DEMO', 'text-amber-300', Wifi] } as const;
  const [label, cls, Icon] = map[c];
  return <span className={`inline-flex items-center gap-1.5 text-xs ${cls}`}><Icon size={14} />{label}</span>;
}

function Station({ label, value, tone }: { label: string; value: string | null; tone?: string }) {
  return (
    <div className="panel rounded-xl px-4 py-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 truncate text-base font-semibold ${value ? tone ?? 'text-white' : 'text-slate-500'}`}>{value ?? NA}</div>
    </div>
  );
}

export function DashboardPage({ standalone = false, active = true }: { standalone?: boolean; active?:boolean }) {
  const sel = useSelection();
  const { snapshot, refresh } = useServers();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const demo = useDemo();
  const ann = useAnnouncer();
  const [showPassed, setShowPassed] = useState(false);
  const visual=useVisualActivity();
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(!active||!visual)return;setNow(Date.now());const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[active,visual]);
  const activeRow = useRef<HTMLLIElement>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  // v samostatném okně se zdroj čte z adresy (#dashboard?server=…&train=…)
  useEffect(() => {
    if (!standalone) return;
    const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
    const server = q.get('server');
    sel.set(server === 'demo' ? { mode: 'demo' } : { mode: 'live', server, train: q.get('train') });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standalone]);

  useEffect(() => { void refresh(false); void ann.reloadContent(); }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const servers = useMemo(() => (snapshot?.servers ?? []).filter((s) => s.active), [snapshot]);
  const server = sel.server ?? pickDefaultServer(servers, settings.selectedServer);

  useEffect(() => {
    if (sel.mode !== 'live' || !server || standalone) return;
    let alive = true;
    const run = async () => {
      try { const r = await window.simrailHub!.call('trains:list', server); if (!alive) return; if (r.ok) { setTrains(r.data.trains); setListError(null); } else setListError(r.error); }
      catch (e) { if (alive) setListError((e as Error).message); }
    };
    void run(); const id = setInterval(run, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, [sel.mode, server, standalone]);

  const src: FeedSource = { mode: sel.mode, server, train: sel.train };
  const feed = useTrainFeed(src);
  const m = feed.model;
  const isDemo = sel.mode === 'demo';
  const currentIndex = m?.rows.find(r => r.status === 'target')?.index;
  useEffect(() => { if(!active||!visual)return; activeRow.current?.scrollIntoView({ block:'nearest', behavior:'smooth' }); }, [currentIndex,active,visual]);

  // automatická hlášení
  const trigger = useRef(new AnnouncementTrigger());
  const [disabled, setDisabled] = useState<string[]>([]);
  useEffect(() => { trigger.current.reset(); }, [sel.mode, server, sel.train]);
  const auto = settings.announcements.auto;
  useEffect(()=>{if(!auto)useAnnouncer.getState().stop();},[auto]);
  useEffect(()=>{if(m?.connection==='lost'||m?.connection==='stale')useAnnouncer.getState().stop();},[m?.connection]);
  const detail = feed.detail;
  const freight = !isDemo && isFreightTrain(detail?.train);
  useEffect(() => { ann.resetRun(); }, [sel.mode,server,sel.train,freight]); // stop queued speech when switching to freight
  useEffect(() => {
    if (standalone || !auto || freight || !m || m.connection==='stale'||m.connection==='lost'||!detail?.train) { setDisabled([]); return; }
    const runKey = `${isDemo ? 'demo' : server}:${detail.train.runId ?? detail.train.number}`;
    ann.reconcile(m.current??m.next,m.delayMin);
    const r = trigger.current.update({ runKey, index: detail.train.timetableIndex, speedKmh: detail.train.speedKmh, distToNextStopM: m.distanceToNextStopM, points: detail.timetable?.points ?? [], delayMin: m.delayMin });
    setDisabled(r.disabled);
    for (const e of r.events) ann.announce(`${runKey}:${e.key}`, e.kind, { station: e.station, delayMin: e.delayMin, trainNumber:detail.train.number,isFreight:freight,automatic:true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, auto, freight]);

  const manual = useCallback((kind: AnnKind) => {
    if (!m || freight) return;
    const station = kind === 'arrived' ? m.current ?? m.next : m.next;
    ann.announce(`manual:${Date.now()}`, kind, { station, delayMin: m.delayMin ?? undefined,trainNumber:m.trainNumber,isFreight:freight });
  }, [m, ann, freight]);

  const field = 'rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-sky-brand';

  return (
    <div className={`mx-auto flex max-w-6xl flex-col gap-4 ${standalone ? 'p-5' : ''}`}>
      {/* zdroj dat */}
      {!standalone && (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-2 text-xl font-semibold text-white">Palubní počítač</h2>
          <div className="flex overflow-hidden rounded-lg border border-line text-sm">
            <button onClick={() => sel.set({ mode: 'live' })} className={`px-3 py-1.5 ${!isDemo ? 'bg-sky-brand/20 text-white' : 'text-slate-400'}`}>Živá data</button>
            <button onClick={() => { sel.set({ mode: 'demo' }); demo.restart(); }} className={`px-3 py-1.5 ${isDemo ? 'bg-amber-500/25 text-amber-200' : 'text-slate-400'}`}>DEMO</button>
          </div>
          {!isDemo && (
            <>
              <select className={field} aria-label="Server" value={server ?? ''} onChange={(e) => sel.set({ server: e.target.value, train: null })}>
                {servers.length === 0 && <option value="">Servery nejsou dostupné</option>}
                {servers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
              <select className={`${field} min-w-56`} aria-label="Vlak" value={sel.train ?? ''} onChange={(e) => sel.set({ train: e.target.value || null })}>
                <option value="">{trains.length ? 'Vyberte vlak ručně…' : listError ? NA : 'Žádné vlaky'}</option>
                {[...trains].sort((a, b) => (a.type === 'user' ? 0 : 1) - (b.type === 'user' ? 0 : 1) || a.number.localeCompare(b.number)).map((t) => (
                  <option key={t.id} value={t.number}>{t.number}{t.name ? ` – ${t.name}` : ''}{t.type === 'user' ? ' (hráč)' : ''}</option>
                ))}
              </select>
            </>
          )}
          {!isDemo && <MobilePairing server={server} train={sel.train}/>}
          <button
            onClick={() => void window.simrailHub!.call('dashboard:open', isDemo ? 'demo' : server, isDemo ? null : sel.train)}
            disabled={!isDemo && !sel.train}
            title="Otevře palubní počítač v samostatném okně (druhý monitor, OBS)"
            className="ml-auto flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-40"
          ><ExternalLink size={14} /> Samostatné okno</button>
        </div>
      )}

      {listError && !isDemo && <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{listError}</div>}

      {!m ? (
        <div className="panel grid place-items-center gap-2 rounded-2xl p-12 text-center text-slate-400">
          <TrainFront size={28} className="text-slate-500" />
          <div className="text-white">{isDemo ? 'Načítám demo…' : sel.train ? 'Čekám na data vlaku…' : 'Vyberte vlak, nebo zapněte režim DEMO.'}</div>
          {feed.error && <div role="alert" className="max-w-lg text-sm text-amber-200">{feed.error}</div>}
          {feed.notes.map((n, i) => <div key={i} className="max-w-lg text-xs text-slate-500">{n}</div>)}
          <div className="max-w-md text-xs text-slate-500">Bez přímé telemetrie ze hry se vlak vybírá ručně. Data se berou z veřejného API panelu SimRailu.</div>
        </div>
      ) : (
        <>
          {isDemo && <div className="rounded-xl bg-amber-500/90 px-4 py-1.5 text-center text-sm font-bold text-ink-950">DEMO – simulovaná data, nejde o skutečný vlak</div>}

          <section className="journey-overview journey-summary"><div className="train-compact"><VehicleCard vehicles={feed.detail?.train?.vehicles??[]} number={m.trainNumber}/><p>{m.start??'—'} → {m.end??'—'}</p><Conn c={m.connection}/></div>
          <div className="journey-station-panel"><div className="journey-stations"><div><span>Předchozí</span><strong key={'previous:'+m.previous}>{m.previous??'—'}</strong></div><div className="current-station"><span>Aktuální</span><strong key={'current:'+m.current}>{m.current??(m.phase==='moving'?'Mezi stanicemi':m.phase==='standing-unknown'?'Stojí mimo potvrzenou stanici':'—')}</strong></div><div><span>Následující</span><strong key={'next:'+m.next}>{m.next??'—'}</strong></div></div>
          <div className="journey-metrics"><div className="journey-speed"><strong>{m.speedKmh===null?'—':Math.round(m.speedKmh)}</strong><span>km/h</span></div><div className="delay-indicator" data-severity={delaySeverity(m.delayMin)} key={delaySeverity(m.delayMin)} role="status"><span>Zpoždění{m.delayKind==='estimate'?' · odhad':''}</span><strong>{fmtDelay(m)}</strong>{(m.delayMin??0)>20&&<small>Výrazné zpoždění</small>}</div></div>
          <small className="journey-updated">{feed.updatedAt?'Poslední data '+new Date(feed.updatedAt).toLocaleTimeString('cs-CZ'):'Čekám na data'}</small></div></section>
          <div className="grid grid-cols-[1fr_20rem] gap-4">
            {/* seznam stanic */}
            <div className="panel rounded-2xl p-4">
              {m.rows.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">Jízdní řád vlaku není k dispozici ({NA}).{feed.notes.map((n, i) => <div key={i} className="mt-1 text-xs text-slate-500">{n}</div>)}</div>
              ) : (
                <><div className="schedule-heading"><strong>Jízdní řád</strong><button className="secondary-action" onClick={() => setShowPassed(!showPassed)}>{showPassed ? 'Skrýt projeté stanice' : 'Zobrazit projeté stanice'}</button><button className="secondary-action" onClick={() => activeRow.current?.scrollIntoView({block:'center',behavior:'smooth'})}>Aktuální poloha</button></div><div className="schedule-columns"><span>Stanice</span><span>Plán</span><span>Odhad</span></div><ol className="relative">
                  {m.rows.filter(r => showPassed || r.status !== 'passed').map((r) => (
                    <li ref={r.status === 'target' ? activeRow : undefined} key={r.index} className="relative pl-8">
                      <span className="absolute bottom-0 left-[11px] top-0 w-px bg-line" />
                      {r.status === 'target' && m.phase === 'moving' && (
                        <span className="absolute -top-1 left-[3px] z-10 text-sky-soft" aria-hidden><ArrowDown size={16} className="flow-arrow" /></span>
                      )}
                      <span className={`absolute left-1.5 top-3.5 z-0 rounded-full ${!r.passengerStop ? 'h-2 w-2 translate-x-[3px] border border-slate-500 bg-ink-900' : `h-3 w-3 translate-x-[1px] ${r.status === 'passed' ? 'bg-slate-600' : r.standing ? 'bg-emerald-400' : 'bg-sky-brand'}`}`} />
                      <div className={`my-0.5 flex items-center gap-3 rounded-xl border px-3 py-2 ${r.standing ? 'border-emerald-400/70 bg-emerald-400/5 shadow-[0_0_0_1px_rgba(52,211,153,.25)]' : r.status === 'target' ? 'border-sky-brand/40 bg-sky-brand/5' : 'border-transparent'}`}>
                        <div className="min-w-0 flex-1">
                          <div className={`truncate ${!r.passengerStop ? 'text-sm text-slate-500' : r.status === 'passed' ? 'text-slate-500' : 'font-medium text-white'}`}>{r.name}</div>
                          {r.passengerStop && <div className="text-[10px] text-slate-400">PH · zastávka pro cestující</div>}
                          {r.isStop === true && !r.passengerStop && <div className="text-[10px] text-slate-500">Technický pobyt · bez hlášení</div>}
                          {r.isStop === false && <div className="text-[10px] text-slate-600">průjezd</div>}
                          {r.isStop === null && <div className="text-[10px] text-slate-600">typ zastavení neznámý</div>}
                        </div>
                        <div className="w-24 text-right text-xs text-slate-400">{r.arrival ? <div>příj. {r.arrival}</div> : null}{r.departure ? <div>odj. {r.departure}</div> : null}</div>
                        <div className={`w-20 text-right text-sm font-medium ${r.estimated ? DELAY_TEXT[m.delayClass] : 'text-slate-600'}`}>{r.status !== 'passed' && r.estimated ? r.estimated : ''}</div>
                      </div>
                    </li>
                  ))}
                </ol></>
              )}
            </div>

            {/* pravý sloupec */}
            <div className="flex flex-col gap-4">
              <div className="panel rounded-2xl p-4 text-sm">
                <div className="mb-2 font-medium text-white">Poloha a jízda</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-slate-500">Rychlost</dt><dd className="text-slate-200">{m.speedKmh === null ? NA : `${Math.round(m.speedKmh)} km/h`}</dd>
                  <dt className="text-slate-500">Souřadnice</dt><dd className="text-slate-200">{m.lat.toFixed(5)}, {m.lon.toFixed(5)}</dd>
                  <dt className="text-slate-500">K další zastávce (vzdušně)</dt><dd className="text-slate-200">{m.distanceToFollowingStopM === null ? NA : m.distanceToFollowingStopM >= 1000 ? `${(m.distanceToFollowingStopM / 1000).toFixed(1)} km` : `${Math.round(m.distanceToFollowingStopM)} m`}</dd>
                  <dt className="text-slate-500">Stav</dt><dd className="text-slate-200">{{ standing: 'Stojí ve stanici', moving: 'Jede', 'standing-unknown': 'Stojí', unknown: NA }[m.phase]}</dd>
                </dl>
                {feed.notes.filter((n) => !n.startsWith('DEMO')).map((n, i) => <div key={i} className="mt-2 text-[11px] text-slate-500">{n}</div>)}
              </div>

              <div className="panel rounded-2xl p-4 text-sm">
                <div className="mb-3 flex items-center gap-2 font-medium text-white"><Megaphone size={15} className="text-sky-soft" /> Hlášení</div>
                {freight ? <p className="text-sm text-slate-400">Nákladní vlak · hlášení pro cestující jsou vypnutá.</p> : <>
                <label className="mb-3 flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={auto} onChange={(e) => void updateSettings({ announcements: { auto: e.target.checked } })} /> Automatická hlášení
                </label>
                {auto&&ann.nextAllowedAt>now&&!ann.playing&&<p className="announcement-cooldown">Další automatické hlášení nejdříve za {Math.ceil((ann.nextAllowedAt-now)/1000)} s</p>}
                {auto && disabled.map((d, i) => <div key={i} className="mb-2 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-100"><TriangleAlert size={13} className="mt-0.5 shrink-0" />{d}</div>)}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([['next-station', 'Příští stanice'], ['approaching', 'Blížíme se'], ['arrived', 'Příjezd'], ['terminal', 'Konečná'], ['delay', 'Zpoždění']] as [AnnKind, string][]).map(([k, label]) => (
                    <button key={k} onClick={() => manual(k)} disabled={ ((k === 'next-station' || k === 'approaching') && !m.next) || (k === 'arrived' && !(m.current ?? m.next))}
                      className="rounded-lg border border-line px-2 py-1.5 text-slate-200 hover:bg-white/5 disabled:opacity-40">{label}</button>
                  ))}
                  <button onClick={() => ann.stop()} className="flex items-center justify-center gap-1 rounded-lg border border-line px-2 py-1.5 text-slate-300 hover:bg-white/5"><Square size={11} /> Zastavit</button>
                </div>
                <details className="manual-announcements"><summary>Vlastní hlášení · ruční ovládání</summary><ServiceAnnouncementPanel freight={freight}/></details>
                <div className="mt-3 text-[11px] text-sky-soft" role="status">{ann.lastSource==='recorded'?'Zdroj: vlastní nahrávka':ann.lastSource==='tts'?'Zdroj: syntetický hlas':''}</div>
                <div className="mt-3 min-h-8 text-[11px] text-slate-400">{ann.pending > 0 && <span>Ve frontě: {ann.pending} · </span>}{ann.lastText ? `Naposledy: „${ann.lastText}“` : 'Zatím nic nebylo přehráno.'}</div>
                {ann.lastError && <div role="alert" className="friendly-error"><strong>Hlášení se nepodařilo přehrát.</strong><p>Zkontrolujte hlas v Nastavení nebo vyzkoušejte systémový hlas.</p><button className="secondary-action" onClick={() => void navigator.clipboard.writeText(ann.lastError ?? '')}>Kopírovat chybu</button><details><summary>Technické podrobnosti</summary>{ann.lastError}</details></div>}
                </>}
              </div>

              {isDemo && (
                <div className="panel rounded-2xl border-amber-500/30 p-4 text-xs">
                  <div className="mb-3 font-medium text-amber-200">Ovládání DEMO</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => demo.setRunning(!demo.running)} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-slate-200 hover:bg-white/5">{demo.running ? <Pause size={12} /> : <Play size={12} />}{demo.running ? 'Pauza' : 'Spustit'}</button>
                    <button onClick={() => demo.restart()} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-slate-200 hover:bg-white/5"><RotateCcw size={12} /> Restart</button>
                    <button onClick={() => demo.jumpToNextStop()} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-slate-200 hover:bg-white/5"><SkipForward size={12} /> Před zastávku</button>
                    <button onClick={() => demo.addDelay(5)} className="rounded-lg border border-line px-2.5 py-1.5 text-slate-200 hover:bg-white/5">+5 min zpoždění</button>
                    <button onClick={() => demo.addDelay(12)} className="rounded-lg border border-line px-2.5 py-1.5 text-slate-200 hover:bg-white/5">+12 min</button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-slate-400">Rychlost:
                    <select className={field} value={demo.speed} onChange={(e) => demo.setSpeed(Number(e.target.value))}>{[1, 5, 10, 30, 60].map((s) => <option key={s} value={s}>{s}×</option>)}</select>
                    Zpoždění při startu:
                    <select className={field} value={demo.initialDelayMin} onChange={(e) => demo.restart(Number(e.target.value))}>{[0, 3, 8, 20].map((s) => <option key={s} value={s}>{s} min</option>)}</select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
