import {Download,RefreshCw,CheckCircle2} from 'lucide-react';
import {useAutomaticUpdates} from '@/stores/automaticUpdates';
export function UpdatePanel({compact=false}:{compact?:boolean}){
 const {state,check,install}=useAutomaticUpdates();
 if(compact&&state?.status!=='ready'&&state?.status!=='downloading')return null;
 return <section className={compact?'update-banner':'panel update-panel'} aria-label="Aktualizace launcheru">
  <div className="update-heading"><span className="update-orb">{state?.status==='ready'?<CheckCircle2 size={20}/>:<Download size={20}/>}</span><div><h3>Aktualizace launcheru{state?.version?' · '+state.version:''}</h3><p role="status">{state?.message??'Načítám stav aktualizací…'}</p></div></div>
  {state?.status==='downloading'&&<progress aria-label="Průběh stahování aktualizace" max={100} value={state.percent??0}/>}
  <div className="update-actions">{state?.status==='ready'?<button className="primary-action" onClick={()=>void install()}>Restartovat a aktualizovat</button>:state?.status==='manual'?<a className="secondary-action" href="https://github.com/kubiasofficial/simrail-hub/releases/latest" target="_blank" rel="noreferrer">Získat instalační verzi</a>:!compact&&<button className="secondary-action" disabled={state?.status==='checking'||state?.status==='downloading'} onClick={()=>void check()}><RefreshCw size={15}/> Zkontrolovat</button>}</div>
 </section>;
}
