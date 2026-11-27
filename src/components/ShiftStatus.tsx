import {useEffect,useState} from 'react';
import {Coffee,CalendarClock} from 'lucide-react';
import {useShift} from '@/stores/shift';
import {useNavigation} from '@/stores/navigation';
import {fmtSod} from '@/services/onboard';
export function ShiftStatus(){const {plan,phase,cursor,arrivedAt}=useShift(),navigate=useNavigation(s=>s.setPage),[now,setNow]=useState(Date.now());
 useEffect(()=>{if(phase!=='break')return;const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[phase]);
 if(!plan||phase==='done')return null;const next=plan.legs[cursor+(phase==='break'?1:0)];if(!next)return null;
 const seconds=arrivedAt?Math.max(0,Math.ceil((arrivedAt+plan.request.breakMinutes*60000-now)/1000)):0;
 return <div className="shift-global-status" role="status">{phase==='break'?<Coffee size={16}/>:<CalendarClock size={16}/>}<span>{phase==='break'?(seconds>0?'Přestávka · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'Přestávka skončila'):phase==='paused'?'Směna pozastavena':'Směna'} · {phase==='break'?'Další vlak ':'Vlak '}{next.number} · {next.from} · odjezd {fmtSod(next.departure)}</span><button onClick={()=>navigate('shift')}>Otevřít směnu →</button></div>;
}
