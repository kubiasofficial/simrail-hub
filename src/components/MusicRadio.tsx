import {useEffect,useRef,useState} from 'react';
import {Radio,Play,Pause,SkipBack,SkipForward,VolumeX,Volume2,Settings2,Plus,Trash2} from 'lucide-react';
import {AppDialog} from './AppDialog';
import {useMusicRadio,attachMusicRadio} from '@/stores/musicRadio';
import {useSettings} from '@/stores/settings';
import {useAudioFocus} from '@/stores/audioFocus';
import type {RadioNowPlaying} from '@/services/RadioMetadataService';
import {validStream} from '@/services/radioPreferences';
function VolumeKnob({value,onChange}:{value:number;onChange:(value:number)=>void}){const ref=useRef<HTMLDivElement>(null),latest=useRef({value,onChange});latest.current={value,onChange};
 useEffect(()=>{const el=ref.current!;const wheel=(e:WheelEvent)=>{e.preventDefault();const p=latest.current;p.onChange(Math.max(0,Math.min(1,p.value+(e.deltaY<0?.02:-.02))));};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 return <div className="radio-volume"><div ref={ref} className="radio-knob" style={{'--volume':value,'--angle':(-135+value*270)+'deg'} as React.CSSProperties}><div className="radio-knob-face"><i/></div><input aria-label="Hlasitost rádia" type="range" min="0" max="100" step="1" value={Math.round(value*100)} onChange={e=>onChange(Number(e.target.value)/100)}/></div><div><span>HLASITOST</span><strong>{Math.round(value*100)} %</strong><small>Táhni nebo použij kolečko</small></div></div>;
}
function RadioTrack({track}:{track:RadioNowPlaying|null}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const valid=track&&track.validUntil>now;
 return <div className="radio-track" title={valid?track.artist+' — '+track.title:undefined}><small>PRÁVĚ HRAJE</small>{valid?<><strong className={track.title.length>28?'is-long':''}>{track.title}</strong><span>{track.artist}</span></>:<span>Živé vysílání · název skladby není dostupný</span>}</div>;
}
function RadioDialog({track}:{track:RadioNowPlaying|null}){const state=useMusicRadio(),p=useSettings(s=>s.settings.radio),update=useSettings(s=>s.update),focus=useAudioFocus(s=>s.count>0),[manage,setManage]=useState(false),[name,setName]=useState(''),[url,setUrl]=useState(''),[error,setError]=useState('');const station=p.stations.find(s=>s.id===p.selectedId)??p.stations[0],status={off:'Připraveno k přehrávání',loading:'Připojuji ke stanici…',playing:'Přehrává se živé vysílání',buffering:'Čekám na data…',error:'Spojení přerušeno'}[state.status];
 const add=async()=>{if(!name.trim()||name.length>60||!validStream(url.trim())){setError('Zadej název a přímý HTTPS odkaz na audio stream. Odkaz na webovou stránku nestačí.');return;}if(p.stations.length>=12){setError('Lze uložit nejvýše 12 stanic.');return;}await update({radio:{stations:[...p.stations,{id:crypto.randomUUID(),name:name.trim(),url:url.trim()}]}});setName('');setUrl('');setError('');};
 return <AppDialog title="Rádio" close={state.hide} className="music-radio-dialog"><section className="radio-chassis"><div className="radio-top"><div className={'radio-display '+(state.status==='playing'?'is-playing':'')}><div className="radio-brand">{station.id==='kiss'?<><span>Kiss</span><small>RÁDIO</small></>:<Radio size={52}/>}</div><div className="radio-station-copy"><h3>{station.name}</h3><RadioTrack track={track}/><p role="status"><i className={state.status==='playing'?'online':''}/>{status}</p><div className="radio-bars" aria-hidden="true">{[3,6,9,5,12,8,15,10].map((h,i)=><i key={i} style={{height:h,animationDelay:(i*.13)+'s'}}/>)}</div></div></div><VolumeKnob value={p.volume} onChange={volume=>void update({radio:{volume}})}/></div>
 <div className="radio-play-controls"><button disabled={p.stations.length<2} onClick={()=>state.step(-1)}><SkipBack/>Předchozí</button><button className="radio-play" onClick={state.toggle}>{state.wanted&&state.status!=='error'?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}{state.wanted&&state.status!=='error'?'Pozastavit':state.status==='error'?'Zkusit znovu':'Přehrát'}</button><button disabled={p.stations.length<2} onClick={()=>state.step(1)}><SkipForward/>Další</button><button aria-pressed={p.muted} onClick={()=>void update({radio:{muted:!p.muted}})}>{p.muted?<Volume2/>:<VolumeX/>}{p.muted?'Zapnout zvuk':'Ztlumit'}</button></div>
 <div className="radio-presets"><h3>PŘEDVOLBY</h3><div>{p.stations.map((s,i)=><button key={s.id} aria-pressed={s.id===p.selectedId} onClick={()=>void state.select(s.id)}><b>{i+1}</b>{s.name}</button>)}{p.stations.length<4&&Array.from({length:4-p.stations.length},(_,i)=><button key={'empty'+i} onClick={()=>setManage(true)}><b>{p.stations.length+i+1}</b>Vybrat stanici</button>)}<button onClick={()=>setManage(!manage)} aria-expanded={manage}><Settings2 size={17}/>Správa stanic</button></div></div></section>
 <div className="radio-duck"><label>Při hlášení<select aria-label="Rádio při hlášení" value={p.duck} onChange={e=>void update({radio:{duck:e.target.value as typeof p.duck}})}><option value="lower">Plynule ztišit</option><option value="mute">Úplně umlčet</option><option value="off">Ponechat hlasitost</option></select></label><span>{focus&&p.duck!=='off'?'Rádio je ztišené kvůli hlášení.':'Po dohrání se hlasitost vrátí.'}</span></div>
 {state.error&&<p className="radio-error" role="alert">{state.error}</p>}
 {manage&&<section className="radio-management"><h3>Vlastní stanice</h3><p>Použij přímý HTTPS stream MP3 nebo AAC z oficiálního přehrávače stanice.</p><form onSubmit={e=>{e.preventDefault();void add();}}><label>Název<input maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Název rádia"/></label><label>HTTPS stream<input type="url" value={url} maxLength={2000} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label><button><Plus size={17}/>Přidat</button></form>{error&&<p role="alert">{error}</p>}{p.stations.filter(s=>s.id!=='kiss').map(s=><div className="radio-custom-station" key={s.id}><span>{s.name}</span><button aria-label={'Odebrat '+s.name} onClick={()=>void update({radio:{stations:p.stations.filter(x=>x.id!==s.id),selectedId:p.selectedId===s.id?'kiss':p.selectedId}})}><Trash2 size={15}/>Odebrat</button></div>)}</section>}
 <footer className="radio-footer"><span>Zavřením panelu se přehrávání nezastaví.</span><button onClick={state.stop}>Vypnout rádio</button><a href="https://www.kiss.cz/online/" target="_blank" rel="noreferrer">Oficiální přehrávač Kiss ↗</a></footer></AppDialog>;
}
export function MusicRadioHost(){
 const ref=useRef<HTMLAudioElement>(null),open=useMusicRadio(s=>s.open),wanted=useMusicRadio(s=>s.wanted),station=useSettings(s=>s.settings.radio.selectedId);
 const [metadata,setMetadata]=useState<{station:string;track:RadioNowPlaying|null}|null>(null);
 useEffect(()=>attachMusicRadio(ref.current!),[]);
 useEffect(()=>{
  setMetadata(null);if(!wanted||station!=='kiss')return;
  let alive=true,timer:ReturnType<typeof setTimeout>|undefined;
  const poll=async()=>{try{const r=await window.simrailHub!.call('radio:now-playing',station);if(alive)setMetadata({station,track:r.ok?r.data:null});}catch{if(alive)setMetadata(null);}finally{if(alive)timer=setTimeout(()=>void poll(),20000);}};
  void poll();return()=>{alive=false;if(timer)clearTimeout(timer);};
 },[wanted,station]);
 const track=wanted&&metadata?.station===station?metadata.track:null;
 return <><audio ref={ref} data-radio-audio="true" preload="none" aria-hidden="true"/>{open&&<RadioDialog track={track}/>}</>;
}
export function MusicRadioButton(){const show=useMusicRadio(s=>s.show),status=useMusicRadio(s=>s.status);return <button className="secondary-action music-radio-button" onClick={show} aria-haspopup="dialog"><Radio size={16}/><span>Rádio</span>{status==='playing'&&<i aria-label="Rádio hraje"/>}</button>;}
