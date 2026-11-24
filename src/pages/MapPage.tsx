import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, X, Gauge, LocateFixed, Layers, TrainFront } from 'lucide-react';
import { useServers } from '@/stores/servers';
import { useSettings } from '@/stores/settings';
import { useSelection } from '@/stores/selection';
import { useNavigation } from '@/stores/navigation';
import { pickDefaultServer } from '@/services/serverPrefs';
import { useDemo } from '@/stores/demo';
import { DEMO_ROUTE } from '@/services/demoSim';
import { bearingDeg, haversineM } from '@/services/geo';
import { VehicleCard } from '@/components/VehicleCard';
import { StationPhoto } from '@/components/StationPhoto';
import type { Train, StationCoord } from '@/types/trains';

const BASES = {
  osm: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap'],
  'osm-dark': ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap'],
  light: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap']
} as const;
const railUrl = 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png';
function StationBoard({server,name}:{server:string|null;name:string}) {
  const [rows,setRows]=useState<{number:string;arrival:string|null;departure:string|null;destination:string|null}[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;setLoading(true);setRows([]);setError('');if(!server){setLoading(false);return;}void window.simrailHub!.call('stations:board',server,name).then(r=>{if(!live)return;if(r.ok)setRows(r.data);else setError(r.error);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[server,name]);
  const time=(s:string|null)=>s?.match(/\d{2}:\d{2}/)?.[0]??'—';
  return <section className="station-board"><h3>Plánované příjezdy a odjezdy</h3>{loading?<p>Načítám jízdní řády…</p>:error?<p role="alert">{error}</p>:rows.length?rows.map((r,i)=><article key={r.number+':'+i}><strong>{r.number} · {r.destination??'—'}</strong><small>Příjezd {time(r.arrival)} · odjezd {time(r.departure)}</small></article>):<p>Pro tuto stanici nejsou v dostupných jízdních řádech zastávky.</p>}<p className="muted">Plán podle API. Nejde o skutečné příjezdy ani úplný přehled všech spojů.</p></section>;
}
const trainSvg = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M9 3v7M15 3v7M8 18l-2 3m10-3 2 3M8 21h8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>';
function avatar(url: string | null | undefined, parent: HTMLElement) {
  if (!url || !/^https:\/\/(avatars\.[a-z.]*steamstatic\.com|steamcdn-a\.akamaihd\.net)\//.test(url)) return;
  const img = document.createElement('img'); img.src = url; img.alt = 'Steam avatar hráče'; img.referrerPolicy = 'no-referrer'; img.className = 'steam-avatar'; img.onerror = () => img.remove(); parent.append(img);
}
export function MapPage() {
  const { snapshot, refresh } = useServers(); const { settings, update } = useSettings(); const sel = useSelection(); const setPage = useNavigation(s => s.setPage); const demo = useDemo();
  const servers = (snapshot?.servers ?? []).filter(s => s.active); const server = sel.server ?? pickDefaultServer(servers, settings.selectedServer);
  const [trains, setTrains] = useState<Train[]>([]); const [stations, setStations] = useState<StationCoord[]>([]); const [error, setError] = useState(''); const [stationError, setStationError] = useState('');
  const [demoOn, setDemoOn] = useState(false); const [showStations, setShowStations] = useState(true); const [showTrains, setShowTrains] = useState(true); const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(sel.train); const [station, setStation] = useState<StationCoord | null>(null); const [updated, setUpdated] = useState(0); const [clock, setClock] = useState(Date.now()); const [view, setView] = useState(0);
  const el = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null); const layer = useRef<L.LayerGroup | null>(null); const previous = useRef(new Map<string, {lat:number;lon:number;bearing:number|null}>()); const fitted = useRef(false);
  useEffect(() => { void refresh(false); const id = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(id); }, [refresh]);
  useEffect(() => { if (!el.current) return; const m = L.map(el.current, { center:[51.2,19.6], zoom:7, preferCanvas:true }); map.current = m; layer.current = L.layerGroup().addTo(m); const redraw = () => setView(v=>v+1); m.on('zoomend moveend',redraw); return () => {m.remove();map.current=null;}; }, []);
  useEffect(() => { const m=map.current;if(!m)return; const b=BASES[settings.map.basemap]; const tile=L.tileLayer(b[0],{attribution:b[1],subdomains:'abcd',maxZoom:19,className:`map-theme-${settings.map.basemap}`}).addTo(m); tile.bringToBack(); return ()=>{tile.remove();}; },[settings.map.basemap]);
  useEffect(() => {if(!map.current||!settings.map.railwayOverlay)return;const tile=L.tileLayer(railUrl,{attribution:'© OpenRailwayMap (CC-BY-SA)',subdomains:'abc',opacity:.65,maxZoom:19}).addTo(map.current);return()=>{tile.remove();};},[settings.map.railwayOverlay]);
  useEffect(() => {
    fitted.current=false; previous.current.clear(); setTrains([]);setStations([]);setStation(null);setError('');setStationError('');setUpdated(0);
    if(demoOn||!server)return;let alive=true,busy=false;
    const run=async()=>{if(busy)return;busy=true;try{
      const [t,s]=await Promise.all([window.simrailHub!.call('trains:list',server),window.simrailHub!.call('stations:list',server)]);
      if(!alive)return;if(t.ok){setTrains(t.data.trains);setUpdated(t.data.fetchedAt);setError('');}else setError(t.error);
      if(s.ok){setStations(s.data);setStationError(s.data.length?'':'API nevrátilo žádné souřadnice stanic.');}else setStationError(s.error);
    }catch(e){if(alive)setError((e as Error).message);}finally{busy=false;}};void run();const id=setInterval(run,5000);return()=>{alive=false;clearInterval(id);};
  },[server,demoOn]);
  useEffect(()=>{if(!demoOn)return;const id=setInterval(()=>useDemo.getState().tick(.25),250);return()=>clearInterval(id);},[demoOn]);
  const d=useMemo(()=>demoOn?demo.sim.snapshot(demo.t):null,[demoOn,demo.sim,demo.t]); const visible=d?[d.train]:trains; const points=d?d.stations:stations;
  const selected=visible.find(t=>t.id===selectedId||t.number===selectedId)??null;
  useEffect(()=>{const m=map.current;if(!m)return;const l=layer.current!;l.clearLayers();
    if(showStations)for(const s of points){const root=document.createElement('div');root.className='station-symbol'+((s.dispatchers?.length??0)>0?' occupied':'');root.textContent='';root.classList.toggle('compact',m.getZoom()<9);avatar(s.dispatchers?.[0]?.avatarUrl,root);root.title=s.name+((s.dispatchers?.length??0)>0?' · dispečer online':'');
      const marker=L.marker([s.lat,s.lon],{icon:L.divIcon({className:'station-marker',html:root,iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:100}).addTo(l);marker.on('click',()=>{setStation(s);setSelectedId(null);}); if(m.getZoom()>=10)marker.bindTooltip(s.name,{permanent:true,direction:'bottom',className:'station-label'});}
    const groups=new Map<string,Train[]>();
    if(showTrains)for(const t of visible){const p=m.project([t.lat,t.lon]);const key=m.getZoom()<11&&t.number!==sel.train&&t.id!==selectedId?`${Math.floor(p.x/42)}:${Math.floor(p.y/42)}`:t.id;groups.set(key,[...(groups.get(key)??[]),t]);}
    for(const group of groups.values()) {const t=group[0];const root=document.createElement('div');root.className='rail-train '+(t.type==='user'?'player ':'')+(selected?.id===t.id?'chosen':'');
      if(group.length>1){root.className='train-cluster';root.textContent=String(group.length);const mk=L.marker([t.lat,t.lon],{icon:L.divIcon({className:'',html:root,iconSize:[32,32],iconAnchor:[16,16]})}).addTo(l);mk.on('click',()=>m.setView([t.lat,t.lon],m.getZoom()+2));continue;}
      const icon=document.createElement('span');icon.className='train-body';icon.innerHTML=trainSvg;root.append(icon); // constant local SVG only
      const old=previous.current.get(t.id);let bearing=old?.bearing??null;if(old&&haversineM(old.lat,old.lon,t.lat,t.lon)>=5)bearing=bearingDeg(old.lat,old.lon,t.lat,t.lon);if(!old||haversineM(old.lat,old.lon,t.lat,t.lon)>=5)previous.current.set(t.id,{lat:t.lat,lon:t.lon,bearing});
      if(bearing!==null){const direction=document.createElement('span');direction.className='train-direction';direction.style.transform=`rotate(${bearing}deg)`;const arrow=document.createElement('span');arrow.className='ahead-arrow';direction.append(arrow);root.append(direction);}
      avatar(t.avatarUrl,root);const label=document.createElement('span');label.className='train-number';label.textContent=t.number;if(m.getZoom()>=9||selected?.id===t.id||sel.train===t.number)root.append(label);
      const mk=L.marker([t.lat,t.lon],{icon:L.divIcon({className:'',html:root,iconSize:[30,30],iconAnchor:[15,15]}),zIndexOffset:500,alt:`Vlak ${t.number}`}).addTo(l);mk.on('click',()=>{setSelectedId(t.id);setStation(null);});
    }
    if(!fitted.current&&visible.length){m.fitBounds(L.latLngBounds(visible.map(t=>[t.lat,t.lon] as [number,number])),{padding:[60,60],maxZoom:9});fitted.current=true;}
  },[visible,points,showTrains,showStations,view,selectedId,selected?.id,sel.train]);
  useEffect(()=>{if(selected&&settings.map.followSelected)map.current?.panTo([selected.lat,selected.lon]);},[selected,settings.map.followSelected]);
  const matches=query.trim()? [...visible.filter(t=>`${t.number} ${t.name??''}`.toLowerCase().includes(query.toLowerCase())).slice(0,5).map(t=>({label:`Vlak ${t.number}`,lat:t.lat,lon:t.lon,train:t})),...points.filter(s=>s.name.toLowerCase().includes(query.toLowerCase())).slice(0,5).map(s=>({label:s.name,lat:s.lat,lon:s.lon,station:s}))]:[];
  return <div className="map-page"><header className="map-toolbar"><div><h1>Živá mapa</h1><small className={error||clock-updated>30000?'text-amber-300':'text-emerald-300'}>{demoOn?'DEMO · simulovaná data':updated?`${visible.length} vlaků · ${points.length} stanic · před ${Math.max(0,Math.floor((clock-updated)/1000))} s`:'Načítám provoz…'}</small></div>
    <select aria-label="Server" value={server??''} disabled={demoOn} onChange={e=>{sel.set({server:e.target.value,train:null});void update({selectedServer:e.target.value});}}>{servers.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</select>
    <select aria-label="Vzhled mapy" value={settings.map.basemap} onChange={e=>void update({map:{basemap:e.target.value as keyof typeof BASES}})}><option value="osm-dark">Tmavá mapa</option><option value="light">Světlá mapa</option><option value="osm">Klasická mapa</option></select>
    <label><input type="checkbox" checked={showTrains} onChange={e=>setShowTrains(e.target.checked)}/> Vlaky</label><label><input type="checkbox" checked={showStations} onChange={e=>setShowStations(e.target.checked)}/> Stanice</label>
    <label><input type="checkbox" checked={settings.map.railwayOverlay} onChange={e=>void update({map:{railwayOverlay:e.target.checked}})}/> Koleje</label><label><input type="checkbox" checked={demoOn} onChange={e=>{setDemoOn(e.target.checked);if(e.target.checked)demo.restart();}}/> DEMO</label>
  </header><div className="map-canvas"><div ref={el} className="map-surface" aria-label="Mapa vlaků a stanic"/>
    <div className="map-search"><Search size={17}/><input aria-label="Vyhledat vlak nebo stanici" placeholder="Číslo vlaku nebo stanice…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Vymazat hledání" onClick={()=>setQuery('')}><X size={15}/></button>}{matches.length>0&&<div className="search-results">{matches.map((r,i)=><button key={i} onClick={()=>{map.current?.setView([r.lat,r.lon],13);if('train'in r){setSelectedId(r.train.id);setStation(null);}else if('station'in r){setStation(r.station);setSelectedId(null);}setQuery('');}}>{r.label}</button>)}</div>}</div>
    {(error||stationError)&&<div className="map-warning" role="alert">{error||stationError}</div>}
    <div className="map-legend"><TrainFront size={15}/> Vlak <span className="legend-square"/> Stanice <span className="legend-player"/> Hráč · šipka = směr z pohybu</div>
    {(selected||station)&&<aside className="map-detail panel"><button className="detail-close" aria-label="Zavřít detail" onClick={()=>{setSelectedId(null);setStation(null);}}><X size={18}/></button>
      {selected?<><VehicleCard vehicles={selected.vehicles??[]} number={selected.number}/><h2>{selected.number} <small>{selected.name}</small></h2><p>{selected.startStation??'—'} → {selected.endStation??'—'}</p><div className="metric-pair"><strong>{selected.speedKmh===null?'—':Math.round(selected.speedKmh)} <small>km/h</small></strong><span>{selected.type==='user'?'Řídí hráč':'Řídí počítač'}</span></div>{selected.avatarUrl&&<img className="profile-photo" src={selected.avatarUrl} alt="Steam avatar strojvedoucího"/>}
      <button className="primary-action" onClick={()=>{sel.set({mode:demoOn?'demo':'live',server,train:selected.number});setPage('dashboard');}}><Gauge size={17}/> Palubní počítač</button><label className="follow-control"><input type="checkbox" checked={settings.map.followSelected} onChange={e=>void update({map:{followSelected:e.target.checked}})}/><LocateFixed size={15}/> Sledovat vlak</label></>:
      station&&<><span className="eyebrow">ŽELEZNIČNÍ STANICE</span><h2>{station.name}</h2><StationPhoto key={station.name} name={station.name} apiImage={station.imageUrl??undefined}/><p>{station.dispatchers?.length?`${station.dispatchers.length} dispečerů online`:'Bez hráče na stanovišti'}</p><div className="profile-row">{station.dispatchers?.map(d=><a key={d.steamId} href={`https://steamcommunity.com/profiles/${d.steamId}`} target="_blank" rel="noreferrer">{d.avatarUrl?<img src={d.avatarUrl} alt="Steam avatar dispečera"/>:'Hráč'}<span>Steam profil</span></a>)}</div><StationBoard server={server} name={station.name}/></>}
    </aside>}
  </div></div>;
}
