import {useEffect,useState} from 'react';
import {useSettings} from '@/stores/settings';
import {useAnnouncer} from '@/stores/announcer';
import type {RecordingStatus} from '@/services/localAudio';
export function ServiceAnnouncementPanel({freight}:{freight:boolean}){
 const directory=useSettings(s=>s.settings.recordingsPath),recorded=useSettings(s=>s.settings.announcements.recorded);
 const announce=useAnnouncer(s=>s.announceService);
 const [status,setStatus]=useState<RecordingStatus|null>(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void window.simrailHub!.call('recordings:status').then(r=>{if(!alive)return;if(r.ok){setStatus(r.data);setError('');}else setError(r.error);}).catch(()=>{if(alive)setError('Nahrávky se nepodařilo zkontrolovat.');});return()=>{alive=false;};},[directory]);
 if(freight)return null;
 return <div className="service-announcements"><h4 className="mb-2 mt-4 text-xs font-medium text-slate-200">Vlastní hlášení · ruční spuštění</h4><p className="mb-3 text-[11px] text-slate-400">Důvod zastavení a pokyny se spouštějí pouze ručně.</p>
 <div className="grid grid-cols-2 gap-2 text-xs">{status?.services.map(clip=><button key={clip.id} disabled={!clip.available||!recorded} title={!clip.available?'Místní nahrávka chybí':clip.label} className="rounded-lg border border-line px-2 py-2 text-slate-200 hover:bg-white/5 disabled:opacity-40" onClick={()=>announce('service:'+Date.now(),clip.id,freight)}>{clip.label}</button>)}</div>
 {!recorded&&<p className="mt-2 text-xs text-amber-200">Vlastní nahrávky jsou vypnuté v Nastavení → Hlášení.</p>}{error&&<p role="alert" className="text-xs text-red-300">{error}</p>}</div>;
}
