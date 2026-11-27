import {APP_LOCALES,LANGUAGE_NAMES,type AppLocale} from '@/types/locale';
import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { Download, FileDown, FolderSearch, Loader2, RefreshCw, Trash2, Volume2, Undo2 } from 'lucide-react';
import { useSettings } from '@/stores/settings';
import { useGame } from '@/stores/game';
import { useServers } from '@/stores/servers';
import { useAnnouncer } from '@/stores/announcer';
import {UpdatePanel} from '@/components/UpdatePanel';
import {RecordingPanel} from '@/components/RecordingPanel';
import type { DiagInfo, TtsStatusDto, TtsProgressDto } from '@/types/ipc';

const NA = 'Nedostupné';
const field = 'rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-sky-brand';
const btn = 'flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-40';

type SettingsTab='Obecné'|'Mapa'|'Hlášení'|'Aktualizace';
const SettingsTabContext=createContext<SettingsTab>('Obecné');
const SECTION_TABS:Record<string,SettingsTab>={'Hra':'Obecné','Aplikace':'Obecné','Data a servery':'Obecné','Mapa':'Mapa','Hlášení a hlas':'Hlášení','Editor výslovnosti':'Hlášení','Mezipaměť hlášení':'Hlášení','Diagnostika':'Obecné'};
function Section({ title, children }: { title: string; children: ReactNode }) {
  const tab=useContext(SettingsTabContext);if(SECTION_TABS[title]!==tab)return null;
  return <section className="panel rounded-2xl p-5"><h3 className="mb-4 font-medium text-white">{title}</h3><div className="flex flex-col gap-3.5">{children}</div></section>;
}
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-6"><div className="min-w-0"><div className="text-sm text-slate-200">{label}</div>{hint && <div className="text-xs text-slate-500">{hint}</div>}</div><div className="flex shrink-0 items-center gap-2">{children}</div></div>;
}
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

export function SettingsPage() {
  const { settings: s, update, error } = useSettings();
  const game = useGame();
  const servers = useServers();
  const ann = useAnnouncer();
  const api = window.simrailHub!;
  const [tts, setTts] = useState<TtsStatusDto | null>(null);
  const [ttsMsg, setTtsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<TtsProgressDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [dict, setDict] = useState<{ word: string; spoken: string }[]>([]);
  const [nw, setNw] = useState(''); const [ns, setNs] = useState('');
  const [diag, setDiag] = useState<DiagInfo | null>(null);
  const [tab,setTab]=useState<SettingsTab>('Obecné');
  const [diagMsg, setDiagMsg] = useState<string | null>(null);

  const reloadTts = useCallback(async () => {
    const [t, d] = await Promise.all([api.call('tts:status'), api.call('dict:list')]);
    if (t.ok) setTts(t.data); else setTtsMsg({ ok: false, text: t.error });
    if (d.ok) setDict(d.data);
  }, [api]);
  useEffect(() => {
    void reloadTts(); void api.call('diag:info').then(setDiag); void servers.refresh(false); if (!game.result) void game.detect();
    return api.onTtsProgress(setProgress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doTts = async (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    setBusy(true); setTtsMsg(null);
    try { const r = await fn(); setTtsMsg({ ok: r.ok, text: r.ok ? okText : r.error ?? 'Operace selhala.' }); } catch (e) { setTtsMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); setProgress(null); await reloadTts(); }
  };
  const voice = tts?.voices.find((v) => v.id === s.announcements.voiceId);
  const install = game.result?.install ?? null;

  return (
    <SettingsTabContext.Provider value={tab}><div className="settings-layout mx-auto flex max-w-3xl flex-col gap-5 pb-10">
      <h2 className="text-xl font-semibold text-white">Nastavení</h2>
      <div className="settings-tabs" aria-label="Kategorie nastavení">{(['Obecné','Mapa','Hlášení','Aktualizace'] as SettingsTab[]).map((t)=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div>
      {tab==='Aktualizace'&&<UpdatePanel/>}
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      <Section title="Hra">
        <Row label="Cesta k SimRailu" hint={install ? install.path : NA}>
          <button className={btn} onClick={() => void game.pickFolder()}><FolderSearch size={14} /> Vybrat</button>
          {s.manualGamePath && <button className={btn} onClick={() => void game.clearManual().then(() => update({ manualGamePath: null }))}><Undo2 size={14} /> Zrušit</button>}
        </Row>
        <Row label="Automatické hledání hry" hint="Registry Windows a knihovny Steamu"><input type="checkbox" checked={s.autoDetectGame} onChange={(e) => void update({ autoDetectGame: e.target.checked }).then(() => game.detect())} /></Row>
        <Row label="Spouštění přes Steam" hint="Vždy přes steam://rungameid/1422130 (jiný způsob není podporován)"><input type="checkbox" checked disabled /></Row>
        {game.error && <div role="alert" className="text-xs text-red-300">{game.error}</div>}
      </Section>

      <Section title="Aplikace">
        <Row label="Animace rozhraní" hint="Jemné přechody a plynulý pohyb značek na mapě"><input type="checkbox" checked={s.animations} onChange={e=>void update({animations:e.target.checked})}/></Row>
        <Row label="Jazyk aplikace" hint="Jazyk rozhraní nemění jazyk zvukových hlášení."><select className={field} value={s.appLanguage} onChange={e=>void update({appLanguage:e.target.value as AppLocale})}>{APP_LOCALES.map(locale=><option key={locale} value={locale}>{LANGUAGE_NAMES[locale]}</option>)}</select></Row>
        <Row label="Motiv"><select className={field} value={s.theme} onChange={(e) => void update({ theme: e.target.value as 'blue' | 'graphite' })}><option value="blue">Tmavě modrý</option><option value="graphite">Antracitový</option></select></Row>
      </Section>

      <Section title="Data a servery">
        <Row label="Aktualizace seznamu serverů" hint="Interval automatického obnovení (15–300 s)">
          <input type="number" min={15} max={300} className={`${field} w-24`} value={s.dataRefreshSeconds} onChange={(e) => void update({ dataRefreshSeconds: Number(e.target.value) })} /> s
        </Row>
        <Row label="Výchozí server" hint="Používá mapa a palubní počítač">
          <select className={field} value={s.selectedServer ?? ''} onChange={(e) => void update({ selectedServer: e.target.value || null })}>
            <option value="">Automaticky (český server, pokud je aktivní)</option>
            {(servers.snapshot?.servers ?? []).filter((x) => x.active).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </Row>
      </Section>

      <Section title="Mapa">
        <Row label="Podklad"><select className={field} value={s.map.basemap} onChange={(e) => void update({ map: { basemap: e.target.value as 'osm' | 'osm-dark' | 'light' } })}><option value="osm">OpenStreetMap</option><option value="light">Světlý přehledný</option><option value="osm-dark">Tmavý (OpenStreetMap)</option></select></Row>
        <Row label="Železniční vrstva (OpenRailwayMap)"><input type="checkbox" checked={s.map.railwayOverlay} onChange={(e) => void update({ map: { railwayOverlay: e.target.checked } })} /></Row>
        <Row label="Sledovat vybraný vlak"><input type="checkbox" checked={s.map.followSelected} onChange={(e) => void update({ map: { followSelected: e.target.checked } })} /></Row>
      </Section>

      {tab==='Hlášení'&&<RecordingPanel/>}
      <Section title="Hlášení a hlas">
        <Row label="Uvítání po odjezdu" hint="Jednou po odjezdu ze stanice, ve které jsi začal sledovat; bez uvítání při připojení k jedoucímu vlaku."><input type="checkbox" checked={s.announcements.welcome} onChange={e=>void update({announcements:{welcome:e.target.checked}})}/></Row>
        <Row label="Upozornění na zavazadla" hint="Nejdříve minutu po dokončení uvítání."><input type="checkbox" checked={s.announcements.luggage} onChange={e=>void update({announcements:{luggage:e.target.checked}})}/></Row>
        <Row label="Informace během cesty" hint="Ohleduplnost po 10 minutách a pomoc po 25 minutách. Mezi těmito zprávami nejméně 15 minut; mimo blízkost zastávek."><input type="checkbox" checked={s.announcements.journeyInfo} onChange={e=>void update({announcements:{journeyInfo:e.target.checked}})}/></Row>
        <Row label="Vánoční hlášení" hint="Pouze 24. prosince podle českého data. Uvítání a rozloučení na doloženém řiditelném úseku, pokud máš nahrávky."><input type="checkbox" checked={s.announcements.seasonal} onChange={e=>void update({announcements:{seasonal:e.target.checked}})}/></Row>
        <Row label="Čekání na odjezd" hint="Po 5 minutách souvislého stání před návěstí Stůj; mimo potvrzenou PH zastávku naváže Nevystupujte."><input type="checkbox" checked={s.announcements.waiting} onChange={e=>void update({announcements:{waiting:e.target.checked}})}/></Row>
        <Row label="Mezera mezi automatickými hlášeními" hint="Od konce hlášení do začátku dalšího. Omluva za zpoždění nejdříve po 15 minutách."><select className={field} value={s.announcements.gapSeconds} onChange={e=>void update({announcements:{gapSeconds:Number(e.target.value)}})}>{[10,15,20,30,45,60].map(n=><option key={n} value={n}>{n} s</option>)}</select></Row>
        <Row label="Automatická hlášení" hint="Podle jízdního řádu, polohy a rychlosti"><input type="checkbox" checked={s.announcements.auto} onChange={(e) => void update({ announcements: { auto: e.target.checked } })} /></Row>
        <Row label="Jazyk hlášení"><select className={field} value={s.announcements.language} onChange={(e) => void update({ announcements: { language: e.target.value as 'cs' | 'pl' | 'cs-pl' } })}><option value="cs">Česky</option><option value="pl">Polsky</option><option value="cs-pl">Česky + polsky</option></select></Row>
        <Row label="Hlasový engine" hint="Piper = offline, přirozenější; systémový hlas = bez stahování, jen pokud je ve Windows český hlas">
          <select className={field} value={s.announcements.engine} onChange={(e) => void update({ announcements: { engine: e.target.value as 'piper' | 'system' } })}><option value="piper">Piper TTS (offline)</option><option value="system">Systémový hlas</option></select>
        </Row>
        {s.announcements.engine === 'piper' && (
          <>
            <Row label="Model hlasu" hint={voice ? voice.license : undefined}>
              <select className={field} value={s.announcements.voiceId} onChange={(e) => void update({ announcements: { voiceId: e.target.value } })}>
                {(tts?.voices ?? []).map((v) => <option key={v.id} value={v.id}>{v.label}{v.installed ? ' ✓' : ''}</option>)}
              </select>
            </Row>
            {tts && !tts.supported && <div className="text-xs text-amber-300">Piper je v této verzi podporován jen na Windows – na tomto systému použijte systémový hlas.</div>}
            {tts?.supported && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-xs text-slate-300">
                <span>Piper: {tts.piperInstalled ? 'nainstalován ✓' : 'není nainstalován'}</span>
                {!tts.piperInstalled && <button className={btn} disabled={busy} onClick={() => void doTts(() => api.call('tts:install-piper'), 'Piper byl nainstalován.')}><Download size={13} /> Nainstalovat Piper (~22 MB)</button>}
                <span className="ml-3">Vybraný hlas: {voice?.installed ? 'stažen ✓' : 'není stažen'}</span>
                {voice && !voice.installed && <button className={btn} disabled={busy} onClick={() => void doTts(() => api.call('tts:install-voice', s.announcements.voiceId), 'Hlas byl stažen.')}><Download size={13} /> Stáhnout hlas</button>}
                {busy && progress && <span className="flex items-center gap-1.5 text-sky-soft"><Loader2 size={13} className="animate-spin" />{progress.task}{progress.fraction !== null ? ` ${Math.round(progress.fraction * 100)} %` : ''}</span>}
              </div>
            )}
          </>
        )}
        <Row label="Hlasitost"><input type="range" min={0} max={1} step={0.05} value={s.announcements.volume} onChange={(e) => void update({ announcements: { volume: Number(e.target.value) } })} /><span className="w-10 text-right text-xs text-slate-400">{Math.round(s.announcements.volume * 100)} %</span></Row>
        <Row label="Rychlost řeči"><input type="range" min={0.5} max={2} step={0.05} value={s.announcements.rate} onChange={(e) => void update({ announcements: { rate: Number(e.target.value) } })} /><span className="w-10 text-right text-xs text-slate-400">{s.announcements.rate.toFixed(2)}×</span></Row>
        <Row label="Testovací přehrání">
          <button className={btn} onClick={() => void ann.speakText({ lang: s.announcements.language === 'pl' ? 'pl' : 'cs', text: s.announcements.language === 'pl' ? 'Szanowni Państwo, następna stacja Katowice.' : 'Vážení cestující, příští stanice Katovice.' })}><Volume2 size={14} /> Přehrát</button>
        </Row>
        {ttsMsg && <div role={ttsMsg.ok ? 'status' : 'alert'} className={`rounded-lg border p-2 text-xs ${ttsMsg.ok ? 'border-emerald-500/30 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>{ttsMsg.text}</div>}
        {ann.lastError && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{ann.lastError}</div>}
      </Section>

      <div className="settings-advanced"><Section title="Editor výslovnosti">
        <div className="text-xs text-slate-500">Slovo nebo název stanice se před syntézou nahradí zadaným zněním (bez ohledu na velikost písmen a diakritiku). Výchozí české tvary (Katowice → Katovice, Kraków Główny → Krakov hlavní) jsou už zabudované.</div>
        <div className="flex gap-2">
          <input className={`${field} flex-1`} placeholder="Slovo / stanice" value={nw} onChange={(e) => setNw(e.target.value)} aria-label="Slovo" />
          <input className={`${field} flex-1`} placeholder="Jak se má vyslovit" value={ns} onChange={(e) => setNs(e.target.value)} aria-label="Výslovnost" />
          <button className={btn} disabled={!nw.trim() || !ns.trim()} onClick={async () => { const r = await api.call('dict:set', nw, ns); if (r.ok) { setNw(''); setNs(''); await reloadTts(); await ann.reloadContent(); } else setTtsMsg({ ok: false, text: r.error }); }}>Přidat</button>
        </div>
        {dict.map((d) => (
          <div key={d.word} className="flex items-center justify-between rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-slate-300">
            <span>{d.word} → <b className="text-white">{d.spoken}</b></span>
            <span className="flex gap-1">
              <button aria-label={`Přehrát ${d.word}`} className="rounded p-1.5 hover:bg-white/10" onClick={() => void ann.speakText({ lang: 'cs', text: d.spoken })}><Volume2 size={14} /></button>
              <button aria-label={`Smazat ${d.word}`} className="rounded p-1.5 hover:bg-red-500/15 hover:text-red-300" onClick={async () => { await api.call('dict:delete', d.word); await reloadTts(); await ann.reloadContent(); }}><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
      </Section>

      <Section title="Mezipaměť hlášení">
        <Row label="Vygenerovaná hlášení" hint="Při opakovaném hlášení se zvuk nemusí znovu generovat">
          <span className="text-xs text-slate-400">{tts ? `${tts.cacheFiles} souborů · ${mb(tts.cacheBytes)}` : NA}</span>
          <button className={btn} onClick={() => void doTts(() => api.call('tts:clear-cache'), 'Mezipaměť byla vymazána.')}><Trash2 size={14} /> Vymazat</button>
        </Row>
      </Section>

<Section title="Diagnostika">
        {diag ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {([['Verze aplikace', diag.appVersion], ['Electron / Chrome / Node', `${diag.electron} / ${diag.chrome} / ${diag.node}`], ['Systém', `${diag.platform} ${diag.arch}`], ['Data aplikace', diag.userData], ['Databáze', diag.dbFile], ['Složka modifikací', diag.modsDir], ['Log', diag.logFile]] as [string, string][]).map(([k, v]) => (
              <><dt key={k} className="text-slate-500">{k}</dt><dd key={`${k}v`} className="break-all text-slate-300">{v}</dd></>
            ))}
            <dt className="text-slate-500">SimRail API</dt><dd className={servers.error ? 'text-amber-300' : 'text-slate-300'}>{servers.error ?? (servers.snapshot ? `v pořádku (${servers.snapshot.servers.length} serverů)` : NA)}</dd>
            <dt className="text-slate-500">Hra</dt><dd className="text-slate-300">{install ? install.path : (game.result?.messages[0] ?? NA)}</dd>
          </dl>
        ) : <div className="text-xs text-slate-500">{NA}</div>}
        <div className="flex items-center gap-3">
          <button className={btn} onClick={async () => { const r = await api.call('diag:export-logs'); setDiagMsg(r.ok ? (r.data ? `Uloženo: ${r.data}` : 'Export zrušen.') : r.error); }}><FileDown size={14} /> Exportovat logy</button>
          {diagMsg && <span className="text-xs text-slate-400">{diagMsg}</span>}
        </div>
      </Section>
    </div></div></SettingsTabContext.Provider>
  );
}
