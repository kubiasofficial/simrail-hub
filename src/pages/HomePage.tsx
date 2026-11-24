import {useCallback,useEffect,useState} from 'react';
import {Play,FolderSearch,Plus,ArrowUpRight,RefreshCw,Check} from 'lucide-react';
import {useGame} from '@/stores/game';
import {useAutomaticUpdates} from '@/stores/automaticUpdates';
import {DlcDialog} from '@/components/DlcDialog';
import heroes from '@/data/home-heroes.json';
function pickHero(){let last=-1;try{last=Number(localStorage.getItem('simrail:hero:last')??'-1');}catch{}const choices=heroes.filter((_,i)=>i!==last);const h=choices[Math.floor(Math.random()*choices.length)]??heroes[0];try{localStorage.setItem('simrail:hero:last',String(heroes.indexOf(h)));}catch{}return h;}
const sessionHero=pickHero();
export function HomePage(){
 const game=useGame(),{state,check,install}=useAutomaticUpdates();const [version,setVersion]=useState(''),[dlc,setDlc]=useState(false);
 const close=useCallback(()=>setDlc(false),[]);
 useEffect(()=>{void game.detect();void window.simrailHub!.getAppInfo().then(x=>setVersion(x.version));},[game.detect]);
 return <div className="home-v2">
 <section className="welcome-hero"><img className="hero-photo" src={sessionHero.image} alt={sessionHero.name}/><div className="hero-shade"/><div className="welcome-copy"><div className="eyebrow"><span/>SIMRAIL HUB</div><h1>Vítej zpátky,<br/><span>strojvedoucí.</span></h1><p>Další cesta začíná tady.</p></div>
 <div className="hero-actions"><button className="button button-primary" disabled={game.launching} onClick={()=>void game.launch()}><Play size={17} fill="currentColor"/>{game.launching?'Spouštím…':'Spustit hru'}</button><button className="button button-secondary" onClick={()=>void game.pickFolder()}><FolderSearch size={17}/>Vybrat složku ručně</button><button className="button button-secondary" onClick={()=>setDlc(true)}><Plus size={17}/>Dostupná DLC</button></div>
 <div className="hero-bottom"><span>{sessionHero.name}</span><a href={sessionHero.source} target="_blank" rel="noreferrer">Snímek ze hry <ArrowUpRight size={12}/></a></div></section>
 {game.error&&<p role="alert" className="friendly-error">{game.error}</p>}
 <div className="home-bottom"><section className="release-news"><div className="section-heading"><h2>Poslední aktualizace</h2><span>24. 11. 2026 · {version}</span></div><h3>Přehlednější jízda.<br/>Klidnější hlášení.</h3><div className="release-items"><p>Nová mapa a serverové dlaždice.</p><p>Rozestupy hlášení a omluva po 15 minutách.</p><p>Menší karta soupravy a výrazné zpoždění.</p></div></section>
 <section className="launcher-version"><div className="section-heading"><h2>Tvůj launcher</h2><span className="status-chip"><Check size={12}/>{state?.status==='ready'?'Připravená aktualizace':state?.status==='downloading'?'Stahování':state?.status==='current'?'Aktuální':'Aktualizace'}</span></div><div className="version-number">{version||'—'}<span>WINDOWS · BETA</span></div><p role="status">{state?.message??'Načítám stav aktualizací…'}</p>
 {state?.status==='downloading'&&<progress aria-label="Stahování aktualizace" max={100} value={state.percent??0}/>}
 {state?.status==='ready'?<button className="button update-button" onClick={()=>void install()}>Restartovat a aktualizovat</button>:state?.status==='manual'?<a className="button update-button" href="https://github.com/kubiasofficial/simrail-hub/releases/latest" target="_blank" rel="noreferrer">Získat instalační verzi</a>:<button className="button update-button" disabled={state?.status==='checking'||state?.status==='downloading'} onClick={()=>void check()}><RefreshCw size={14}/>Vyhledat aktualizace</button>}</section></div>
 <footer className="home-footer"><span>SIMRAIL HUB / Neoficiální komunitní launcher</span><span>Zdarma · Windows 10/11</span></footer>{dlc&&<DlcDialog onClose={close}/>}</div>;
}
