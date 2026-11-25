import {Star} from 'lucide-react';
import {TrainFilters} from '@/components/TrainFilters';
import {EMPTY_FILTER,filterTrains} from '@/services/trainFilters';
import {useJourneyLibrary} from '@/stores/journeyLibrary';
import {useEffect,useId,useRef,useState} from 'react';
import {Search} from 'lucide-react';
import type {Train} from '@/types/trains';
export function TrainPicker({server,trains,selected,onSelect}:{server:string|null;trains:Train[];selected:string|null;onSelect:(number:string)=>void}){
 const {data,toggle}=useJourneyLibrary();const [filter,setFilter]=useState({...EMPTY_FILTER});
 const filtered=filterTrains(trains,filter,server,data.favorites);
 const [draft,setDraft]=useState(selected??''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),listId=useId();
 useEffect(()=>{generation.current++;setDraft(selected??'');setError('');setBusy(false);},[server,selected]);
 useEffect(()=>()=>{generation.current++;},[]);
 const choose=async()=>{
  const number=draft.trim();if(!server||busy)return;
  if(!/^\d{1,12}$/.test(number)){setError('Zadej číslo vlaku, například 53103.');return;}
  const request=++generation.current;setError('');setBusy(true);
  try{
   let found=trains.some(t=>t.number===number);
   if(!found){const reply=await window.simrailHub!.call('trains:list',server);if(!reply.ok)throw Error(reply.error);found=reply.data.trains.some(t=>t.number===number);}
   if(request!==generation.current)return;
   if(!found){setError('Vlak '+number+' na vybraném serveru právě nejede.');return;}
   onSelect(number);
  }catch(e){if(request===generation.current)setError(e instanceof Error?e.message:'Vlak se nepodařilo vyhledat.');}
  finally{if(request===generation.current)setBusy(false);}
 };
 const suggestions=filtered.filter(t=>!draft||t.number.startsWith(draft.trim())).slice(0,40);
 return <div className="train-picker"><form onSubmit={e=>{e.preventDefault();void choose();}} aria-label="Vybrat vlak podle čísla">
 <Search size={16}/><input aria-label="Číslo vlaku" list={listId} inputMode="numeric" autoComplete="off" placeholder="Zadej číslo vlaku…" value={draft} disabled={!server} onChange={e=>{generation.current++;setBusy(false);setDraft(e.target.value);setError('');}}/>
 <datalist id={listId}>{suggestions.map(t=><option key={t.id} value={t.number}>{t.name??'Vlak'}{t.type==='user'?' · hráč':''}</option>)}</datalist>
 <button type="submit" disabled={!server||busy||!draft.trim()} aria-busy={busy}>{busy?'Hledám…':'Sledovat'}</button></form>
 {server&&selected&&<button className="train-favorite secondary-action" aria-label="Oblíbený sledovaný vlak" aria-pressed={data.favorites.includes(server+':'+selected)} onClick={()=>toggle(server,selected)}><Star size={14} fill={data.favorites.includes(server+':'+selected)?'currentColor':'none'}/>Oblíbený</button>}
 <details className="picker-filters"><summary>Filtry nabídky vlaků ({filtered.length})</summary><TrainFilters value={filter} onChange={setFilter} count={filtered.length} total={trains.length}/></details>
 {error&&<p role="alert">{error}</p>}</div>;
}
