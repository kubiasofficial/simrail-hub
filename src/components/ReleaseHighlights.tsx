import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,ArrowUpRight,Radio,TrainFront,Map,Volume2,Download} from 'lucide-react';
import {CURRENT_RELEASE as release} from '@/data/currentRelease';
import {useReleaseHighlights} from '@/stores/releaseHighlights';
import {useSettings} from '@/stores/settings';
import {useNavigation} from '@/stores/navigation';
import {useAutomaticUpdates} from '@/stores/automaticUpdates';
import {useVisualActivity} from '@/hooks/useVisualActivity';
import {releaseSeenKey,isNewerRelease,canShowInstalledRelease} from '@/services/releaseHighlights';
type Prompt={kind:'installed'|'ready';version:string;key:string};
export function ReleaseHighlights(){
 const {requested,close:closeRequest}=useReleaseHighlights(),settings=useSettings(),page=useNavigation(s=>s.page),updates=useAutomaticUpdates(),visual=useVisualActivity();
 const [info,setInfo]=useState<{version:string;channel:string}|null>(null),[seen,setSeen]=useState(true),[automatic,setAutomatic]=useState<Prompt|null>(null),[dismissed,setDismissed]=useState<string[]>([]);
 useEffect(()=>{let alive=true;void window.simrailHub!.getAppInfo().then(v=>{if(alive){setInfo(v);try{setSeen(localStorage.getItem(releaseSeenKey(v.version))==='1');}catch{setSeen(false);}}}).catch(()=>undefined);return()=>{alive=false;};},[]);
 const ready=info?.channel==='stable'&&updates.state?.status==='ready'&&updates.state.version&&isNewerRelease(updates.state.version,info.version)?updates.state.version:null;
 const installed=info&&canShowInstalledRelease(info.channel,info.version,release.version,seen);
 const candidate:Prompt|null=ready?{kind:'ready',version:ready,key:'ready:'+ready}:installed?{kind:'installed',version:release.version,key:'installed:'+release.version}:null;
 useEffect(()=>{
  if(!candidate||requested||automatic||dismissed.includes(candidate.key)||!settings.loaded||page!=='home'||!visual)return;
  const timer=setInterval(()=>{if(!document.querySelector('dialog[open]'))setAutomatic(candidate);},500);return()=>clearInterval(timer);
 },[candidate?.key,requested,automatic,dismissed,settings.loaded,page,visual]);
 const prompt=requested?{kind:'installed' as const,version:release.version,key:'manual:'+release.version}:automatic;
 const close=useCallback(()=>{
  if(prompt?.kind==='installed'&&info?.channel==='stable'&&info.version===release.version){try{localStorage.setItem(releaseSeenKey(info.version),'1');}catch{/* Session state still prevents repeated popups. */}setSeen(true);}
  if(prompt)setDismissed(v=>[...v,prompt.key]);setAutomatic(null);closeRequest();
 },[prompt?.key,info?.version,info?.channel,closeRequest]);
 if(!prompt)return null;
 return <ReleaseDialog prompt={prompt} onClose={close} onInstall={()=>{close();void updates.install();}}/>;
}
function ReleaseDialog({prompt,onClose,onInstall}:{prompt:Prompt;onClose:()=>void;onInstall:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),known=prompt.version===release.version;
 useLayoutEffect(()=>{const dialog=ref.current!,opener=document.activeElement as HTMLElement|null;dialog.showModal();const close=()=>onClose();dialog.addEventListener('close',close);return()=>{dialog.removeEventListener('close',close);dialog.close();opener?.focus({preventScroll:true});};},[onClose]);
 const icons={display:TrainFront,dispatcher:Radio,preview:Map};
 return createPortal(<dialog ref={ref} className="release-dialog" aria-labelledby="release-dialog-title" onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
  <div className="release-dialog-art"><img src={known?release.banner:'./assets/wiki/hero.jpg'} alt={known?'SimRail Hub '+release.version+' – '+release.title:'SimRail – snímek ze hry'}/><button className="release-dialog-close" aria-label="Zavřít novinky aktualizace" onClick={onClose}><X size={19}/></button></div>
  <div className="release-dialog-copy"><div className="release-dialog-kicker"><span>{prompt.kind==='ready'?'AKTUALIZACE JE PŘIPRAVENÁ':'CO JE NOVÉHO'}</span><span>VERZE {prompt.version}</span></div><h2 id="release-dialog-title">{prompt.kind==='ready'?'Nová verze čeká na restart.':release.subtitle}</h2>
   {known?<><div className="release-dialog-features">{release.features.map(feature=>{const Icon=icons[feature.id];return <article key={feature.id}><Icon size={19}/><div><h3>{feature.title}{'tag' in feature&&<span>{feature.tag}</span>}</h3><p>{feature.text}</p></div></article>;})}</div><p className="release-dialog-sound"><Volume2 size={16}/>{release.soundNote}</p></>:<p className="release-dialog-generic">Aktualizace {prompt.version} je stažená. Restartuj launcher, až se ti to bude hodit.</p>}
   <footer>{prompt.kind==='ready'?<><button className="release-dialog-primary" onClick={onInstall}><Download size={16}/>Restartovat a aktualizovat</button><button className="release-dialog-secondary" onClick={onClose}>Později</button></>:<button className="release-dialog-primary" onClick={onClose}>Pokračovat do launcheru</button>}<a href={'https://github.com/kubiasofficial/simrail-hub/releases/tag/v'+prompt.version} target="_blank" rel="noreferrer">Přehled změn<ArrowUpRight size={14}/></a></footer>
  </div></dialog>,document.body);
}
