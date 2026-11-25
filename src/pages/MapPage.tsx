import {Star} from 'lucide-react';
import {TrainFilters} from '@/components/TrainFilters';
import {useJourneyLibrary} from '@/stores/journeyLibrary';
import {EMPTY_FILTER,filterTrains} from '@/services/trainFilters';
import {useRailRoute} from '@/hooks/useRailRoute';
import {trainCategory,CATEGORIES} from '@/services/trainCategory';
import {useVisualActivity} from '@/hooks/useVisualActivity';
import {useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {Search,X,Gauge,LocateFixed,Layers,TrainFront,MapPin,ArrowUpRight} from 'lucide-react';
import {MapMarkers} from '@/components/map/MapMarkers';
import {useServers} from '@/stores/servers';
import {useSettings} from '@/stores/settings';
import {useSelection} from '@/stores/selection';
import {useNavigation} from '@/stores/navigation';
import {pickDefaultServer} from '@/services/serverPrefs';
import {normName} from '@/services/onboard';
import {useDemo} from '@/stores/demo';
import {VehicleCard} from '@/components/VehicleCard';
import {StationPhoto} from '@/components/StationPhoto';
import type {Train,StationCoord} from '@/types/trains';
const OSM_ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
const BASES={osm:['https://tile.openstreetmap.org/{z}/{x}/{y}.png',OSM_ATTRIBUTION],'osm-dark':['https://tile.openstreetmap.org/{z}/{x}/{y}.png',OSM_ATTRIBUTION],light:['https://tile.openstreetmap.org/{z}/{x}/{y}.png',OSM_ATTRIBUTION]} as const;
function StationBoard({server,name}:{server:string|null;name:string}) {
  const [rows,setRows]=useState<{number:string;arrival:string|null;departure:string|null;destination:string|null}[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;setLoading(true);setRows([]);setError('');if(!server){setLoading(false);return;}void window.simrailHub!.call('stations:board',server,name).then(r=>{if(!live)return;if(r.ok)setRows(r.data);else setError(r.error);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[server,name]);
  const time=(s:string|null)=>s?.match(/\d{2}:\d{2}/)?.[0]??'—';
  return <section className="station-board"><h3>Plánované příjezdy a odjezdy</h3>{loading?<p>Načítám jízdní řády…</p>:error?<p role="alert">{error}</p>:rows.length?rows.map((r,i)=><article key={r.number+':'+i}><strong>{r.number} · {r.destination??'—'}</strong><small>Příjezd {time(r.arrival)} · odjezd {time(r.departure)}</small></article>):<p>Pro tuto stanici nejsou v dostupných jízdních řádech zastávky.</p>}<p className="muted">Plán podle API. Nejde o skutečné příjezdy ani úplný přehled všech spojů.</p></section>;
}
export function MapPage(){
 const library=useJourneyLibrary();const [filter,setFilter]=useState({...EMPTY_FILTER}),[filtersOpen,setFiltersOpen]=useState(false);
 const visual=useVisualActivity(),pageActive=useNavigation(s=>s.page==='map'),mapActive=visual&&pageActive;
 const {snapshot,refresh}=useServers(),settings=useSettings(s=>s.settings),update=useSettings(s=>s.update),selection=useSelection(),demo=useDemo();
 const server=selection.server??pickDefaultServer((snapshot?.servers??[]).filter(s=>s.active),settings.selectedServer);
 const [trains,setTrains]=useState<Train[]>([]),[stations,setStations]=useState<StationCoord[]>([]),[error,setError]=useState(''),[updated,setUpdated]=useState(0);
 const [selectedTrain,setSelectedTrain]=useState<string|null>(selection.train),[selectedStation,setSelectedStation]=useState<StationCoord|null>(null);
 const [query,setQuery]=useState(''),[showTrains,setShowTrains]=useState(true),[showStations,setShowStations]=useState(true),[layers,setLayers]=useState(false),[demoOn,setDemoOn]=useState(false),[view,setView]=useState(0),[now,setNow]=useState(Date.now());
 const canvas=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),markers=useRef<MapMarkers|null>(null),fitted=useRef(false);
 useEffect(()=>{void refresh(false);const id=setInterval(()=>{if(visual)setNow(Date.now());},1000);return()=>clearInterval(id);},[refresh,visual]);
 useEffect(()=>{
  if(!canvas.current)return;
  const m=L.map(canvas.current,{center:[51.2,19.6],zoom:7,preferCanvas:true,zoomControl:false});map.current=m;L.control.zoom({position:'bottomright'}).addTo(m);
  markers.current=new MapMarkers(m,t=>{setSelectedTrain(t.number);setSelectedStation(null);},s=>{setSelectedStation(s);setSelectedTrain(null);});
  let timer:ReturnType<typeof setTimeout>;const change=()=>{clearTimeout(timer);timer=setTimeout(()=>setView(v=>v+1),80);};m.on('zoomend moveend',change);
  const observer=new ResizeObserver(()=>m.invalidateSize({animate:false}));observer.observe(canvas.current);
  return()=>{clearTimeout(timer);observer.disconnect();markers.current?.clear();m.remove();map.current=null;};
 },[]);
 useEffect(()=>{const m=map.current;if(!m)return;const source=BASES[settings.map.basemap];const layer=L.tileLayer(source[0],{attribution:source[1],className:'map-base map-base-'+settings.map.basemap,maxZoom:19,keepBuffer:1,updateWhenIdle:true}).addTo(m);layer.bringToBack();return()=>{layer.remove();};},[settings.map.basemap]);
 const detailZoom=map.current?.getZoom()??7;
 useEffect(()=>{const m=map.current;if(!m||!settings.map.railwayOverlay||detailZoom<11)return;const layer=L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',{subdomains:'abc',attribution:'© OpenRailwayMap (CC-BY-SA)',opacity:.4,maxZoom:19}).addTo(m);return()=>{layer.remove();};},[settings.map.railwayOverlay,detailZoom]);
 useEffect(()=>{fitted.current=false;markers.current?.clear();setTrains([]);setStations([]);setSelectedStation(null);setError('');setUpdated(0);if(demoOn||!server)return;
  let alive=true,busy=false;const run=async()=>{if(busy)return;busy=true;try{const [t,s]=await Promise.all([window.simrailHub!.call('trains:list',server),window.simrailHub!.call('stations:list',server)]);if(!alive)return;if(t.ok){setTrains(t.data.trains);setUpdated(t.data.fetchedAt);setError('');}else setError(t.error);if(s.ok){setStations(s.data);if(!s.data.length)setError('API nevrátilo souřadnice stanic.');}else setError(s.error);}catch(e){if(alive)setError((e as Error).message);}finally{busy=false;}};
  void run();const id=setInterval(run,5000);return()=>{alive=false;clearInterval(id);};
 },[server,demoOn]);
 useEffect(()=>{if(!demoOn||selection.mode==='demo')return;const id=setInterval(()=>useDemo.getState().tick(.25),250);return()=>clearInterval(id);},[demoOn,selection.mode]);
 const simulated=useMemo(()=>demoOn?demo.sim.snapshot(demo.t):null,[demoOn,demo.sim,demo.t]);
 const allTrains=simulated?[simulated.train]:trains;
 const visible=useMemo(()=>filterTrains(allTrains,filter,server,library.data.favorites),[allTrains,filter,server,library.data.favorites]),points=simulated?simulated.stations:stations;
 const selected=visible.find(t=>t.number===selectedTrain)??null;
 const rail=useRailRoute(map.current,server,selected,demoOn,mapActive);
 const routeStops=useMemo(()=>new Set(rail.show?rail.route?.stops.filter(s=>s.passengerStop).map(s=>s.name)??[]:[]),[rail.route,rail.show]);
 useEffect(()=>{setSelectedTrain(selection.train);setSelectedStation(null);},[selection.train]);
 useEffect(()=>{const m=map.current;if(!m)return;if(!fitted.current&&visible.length){m.fitBounds(L.latLngBounds(visible.map(t=>[t.lat,t.lon] as [number,number])),{padding:[55,55],maxZoom:9});fitted.current=true;}if(!mapActive)return;markers.current?.sync(visible,points,{train:selectedTrain,station:selectedStation?.name??null,trains:showTrains,stations:showStations,routeStops});},[visible,points,selectedTrain,selectedStation,showTrains,showStations,view,mapActive,routeStops]);
 useEffect(()=>{if(mapActive&&selected&&settings.map.followSelected)map.current?.panTo([selected.lat,selected.lon],{animate:true,duration:.7});},[selected?.lat,selected?.lon,settings.map.followSelected,mapActive]);
 const q=normName(query),matches=q?[...visible.filter(t=>normName(t.number+' '+t.name).includes(q)).slice(0,5).map(t=>({name:'Vlak '+t.number,lat:t.lat,lon:t.lon,train:t,station:null})),...points.filter(s=>normName(s.name).includes(q)).slice(0,5).map(s=>({name:s.name,lat:s.lat,lon:s.lon,train:null,station:s}))]:[];
 const age=updated?Math.max(0,Math.floor((now-updated)/1000)):null;
 return <div className="live-map"><header className="live-map-toolbar"><div><h1>Živá mapa</h1><p className={age!==null&&age>15?'stale':''}>{demoOn?'DEMO · simulovaný provoz':visible.length+' vlaků · '+points.length+' stanic · '+(age===null?'čekám na data':age>30?'data zastaralá':'před '+age+' s')}</p></div><select aria-label="Server mapy" value={server??''} onChange={e=>{selection.set({server:e.target.value,train:null});setSelectedTrain(null);}}>{(snapshot?.servers??[]).filter(s=>s.active).map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</select><div className="map-search-v2"><Search size={17}/><input aria-label="Vyhledat vlak nebo stanici" placeholder="Číslo vlaku nebo stanice…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Vymazat hledání" onClick={()=>setQuery('')}><X size={14}/></button>}{matches.length>0&&<div className="search-results">{matches.map(r=><button key={r.name} onClick={()=>{map.current?.setView([r.lat,r.lon],13);setSelectedTrain(r.train?.number??null);setSelectedStation(r.station);setQuery('');}}>{r.name}</button>)}</div>}</div><label className="map-demo"><input type="checkbox" checked={demoOn} onChange={e=>{setDemoOn(e.target.checked);if(e.target.checked)demo.setRunning(true);}}/>DEMO</label><button className="secondary-action" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}>Filtry ({visible.length}/{allTrains.length})</button></header>
 {filtersOpen&&<TrainFilters value={filter} onChange={setFilter} count={visible.length} total={allTrains.length}/>}
 <div className={'live-map-workspace'+(selected||selectedStation?' has-detail':'')}><div className="live-map-canvas"><div ref={canvas} className="map-container"/>
 <div className="map-layer-control"><button className="map-layer-toggle" aria-expanded={layers} onClick={()=>setLayers(!layers)}><Layers size={16}/>Vrstvy a vzhled</button>{layers&&<div className="map-layer-options"><label>Vzhled mapy<select aria-label="Vzhled mapy" value={settings.map.basemap} onChange={e=>void update({map:{basemap:e.target.value as 'osm'|'osm-dark'|'light'}})}><option value="osm-dark">Tmavá přehledná</option><option value="light">Světlá přehledná</option><option value="osm">OpenStreetMap</option></select></label><div className="map-class-legend"><strong>Barvy vlaků</strong>{Object.values(CATEGORIES).filter(c=>c.key!=='unknown').map(c=><span key={c.key}><i style={{background:c.color}}/>{c.label}</span>)}</div><label><input type="checkbox" checked={showTrains} onChange={e=>setShowTrains(e.target.checked)}/>Vlaky</label><label><input type="checkbox" checked={showStations} onChange={e=>setShowStations(e.target.checked)}/>Stanice</label><label><input type="checkbox" checked={settings.map.railwayOverlay} onChange={e=>void update({map:{railwayOverlay:e.target.checked}})}/>Detailní koleje při přiblížení</label><button onClick={()=>{if(visible.length)map.current?.fitBounds(L.latLngBounds(visible.map(t=>[t.lat,t.lon] as [number,number])),{padding:[50,50],maxZoom:9});}}><LocateFixed size={14}/>Zobrazit celý provoz</button></div>}</div>
 {selected&&!demoOn&&<div className="map-route-status" role="status"><strong>Trasa vlaku {selected.number}</strong>{rail.loading?<span>Načítám traťový průběh…</span>:rail.error?<><span>{rail.error}</span><button onClick={rail.retry}>Zkusit znovu</button></>:rail.route?.sections.length?<><span>{rail.route.first} → {rail.route.last}</span><div className="route-state-legend"><span><i/>Projeté</span><span><i style={{background:trainCategory(selected).color}}/>Zbývá</span></div><small>Dostupný herní úsek · koleje OSM{rail.route.missingSections?' · neúplná návaznost':''}</small><div><button onClick={()=>rail.setShow(!rail.show)}>{rail.show?'Skrýt trasu':'Zobrazit trasu'}</button><button onClick={rail.fit}>Celý úsek</button></div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" title="Odvozený průběh po kolejích mezi známými body jízdního řádu. Přesná kolej je orientační.">© OpenStreetMap · ODbL</a></>:<span>Pro tuto jízdu chybí propojená traťová data.</span>}</div>}
 {error&&<div className="map-error"  role="status">{error}</div>}<div className="map-legend-v2"><TrainFront size={14}/>Vlak <span className="legend-square"/>Stanice <span className="legend-player"/>Hráč</div></div>
 {(selected||selectedStation)&&<aside className="live-map-detail"><button className="detail-close" aria-label="Zavřít detail" onClick={()=>{setSelectedTrain(null);setSelectedStation(null);}}><X size={17}/></button>
 {selected?<><VehicleCard vehicles={selected.vehicles??[]} number={selected.number}/><div className="map-detail-content"><button className="secondary-action" aria-label="Oblíbený vybraný vlak" aria-pressed={!!server&&library.data.favorites.includes(server+':'+selected.number)} onClick={()=>{if(server)library.toggle(server,selected.number);}}><Star size={14} fill={server&&library.data.favorites.includes(server+':'+selected.number)?'currentColor':'none'}/>Oblíbený</button><div className="eyebrow">VYBRANÝ VLAK</div><h2>{selected.number}<span className="train-category-chip" style={{borderColor:trainCategory(selected).color}}>{trainCategory(selected).label||'Kategorie neurčena'}</span><small>{selected.name}</small></h2><p>{selected.startStation??'—'} → {selected.endStation??'—'}</p><div className="map-detail-speed"><strong>{selected.speedKmh===null?'—':Math.round(selected.speedKmh)}<small>km/h</small></strong><span>{selected.type==='user'?'Řídí hráč':'Řídí AI'}</span></div>{selected.avatarUrl&&<img className="profile-photo" src={selected.avatarUrl} alt="Steam avatar strojvedoucího"/>}<button className="secondary-action route-follow-button" onClick={()=>{void update({map:{followSelected:!settings.map.followSelected}});}}><LocateFixed size={14}/>{settings.map.followSelected?'Uvolnit mapu':'Sledovat vlak'}</button><button className="button button-primary" onClick={()=>{selection.set({mode:demoOn?'demo':'live',server,train:selected.number});useNavigation.getState().setPage('dashboard');}}><Gauge size={16}/>Palubní počítač</button><label className="follow-control"><input type="checkbox" checked={settings.map.followSelected} onChange={e=>void update({map:{followSelected:e.target.checked}})}/>Sledovat vlak</label></div></>:
 selectedStation&&<div className="map-detail-content"><div className="eyebrow">ŽELEZNIČNÍ STANICE</div><h2>{selectedStation.name}</h2><StationPhoto name={selectedStation.name} apiImage={selectedStation.imageUrl??undefined}/><p>{selectedStation.dispatchers?.length?selectedStation.dispatchers.length+' dispečerů online':'Bez hráče na stanovišti'}</p><div className="profile-row">{selectedStation.dispatchers?.map(d=><a key={d.steamId} href={'https://steamcommunity.com/profiles/'+d.steamId} target="_blank" rel="noreferrer">{d.avatarUrl?<img src={d.avatarUrl} alt="Steam avatar dispečera"/>:<UserFallback/>}Steam profil <ArrowUpRight size={13}/></a>)}</div><StationBoard server={server} name={selectedStation.name}/></div>}</aside>}</div></div>;
}
function UserFallback(){return <MapPin size={24}/>;}
