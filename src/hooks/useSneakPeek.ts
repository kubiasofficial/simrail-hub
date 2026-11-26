import {useCallback,useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import {loadSneakPeek} from '@/services/sneakPeek';
import type {SneakPeekCatalog,SneakPeekRoute} from '@/types/sneakPeek';
export function useSneakPeek(map:L.Map|null,enabled:boolean,active:boolean,onSelect:(route:SneakPeekRoute)=>void){
 const zooming=useRef(false),pendingFit=useRef<SneakPeekRoute|null>(null);
 const available=useRef(enabled&&active);available.current=enabled&&active;
 const fitNow=(target:L.Map,route:SneakPeekRoute)=>{target.invalidateSize({animate:false});target.stop();target.fitBounds(L.latLngBounds(route.geometry),{padding:[45,45],maxZoom:10,animate:false});};
 useEffect(()=>{
  if(!map)return;
  const start=()=>{zooming.current=true;};
  const end=()=>{zooming.current=false;const next=pendingFit.current;pendingFit.current=null;if(next&&available.current)fitNow(map,next);};
  map.on('zoomstart',start).on('zoomend',end);
  return()=>{map.off('zoomstart',start).off('zoomend',end);pendingFit.current=null;zooming.current=false;};
 },[map]);
 useEffect(()=>{if(!enabled||!active)pendingFit.current=null;},[enabled,active]);
 const [catalog,setCatalog]=useState<SneakPeekCatalog|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!enabled||catalog)return;let alive=true;setError('');void loadSneakPeek().then(data=>{if(alive)setCatalog(data);}).catch(()=>{if(alive)setError('Náhled se nepodařilo načíst.');});return()=>{alive=false;};},[enabled,catalog,retry]);
 useEffect(()=>{
  if(!map||!enabled||!active||!catalog)return;
  if(!map.getPane('sneak-peek')){const pane=map.createPane('sneak-peek');pane.style.zIndex='420';}
  const renderer=L.svg({pane:'sneak-peek'}),group=L.layerGroup().addTo(map),stations=L.layerGroup().addTo(group);
  for(const route of catalog.routes){
   L.polyline(route.geometry,{pane:'sneak-peek',renderer,color:'#c9a5fb',weight:10,opacity:.12,interactive:false,className:'peek-route-halo'}).addTo(group);
   const line=L.polyline(route.geometry,{pane:'sneak-peek',renderer,color:'#c9a5fb',weight:3,opacity:.95,dashArray:'8 8',className:'peek-route-line'}).addTo(group);
   const label=document.createElement('span');label.textContent=route.name+' · Připravovaná trať · orientační průběh OSM';line.bindTooltip(label,{sticky:true,className:'peek-tooltip'}).on('click',()=>onSelect(route));
  }
  let lastZoom=-1;
  const update=()=>{const zoom=map.getZoom();if((zoom>=10)===(lastZoom>=10)&&lastZoom!==-1)return;lastZoom=zoom;stations.clearLayers();if(zoom<10)return;
   for(const route of catalog.routes)for(const station of route.stations){
    const icon=document.createElement('span');icon.className='peek-station-symbol';icon.setAttribute('aria-hidden','true');icon.textContent='◇';
    const marker=L.marker([station.lat,station.lon],{title:station.name+' · připravovaná trať',alt:station.name+' · náhled OSM',icon:L.divIcon({className:'peek-station-marker',html:icon,iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:-100}).addTo(stations);
    const tip=document.createElement('span');tip.textContent=station.name+' · orientační bod OSM'+(station.apiNamePresent?' · název už je v API':'');marker.bindTooltip(tip,{className:'peek-tooltip'}).on('click',()=>onSelect(route));
   }
  };
  update();map.on('zoomend',update);
  map.attributionControl.addAttribution('Náhled tratě: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · ODbL');
  return()=>{map.off('zoomend',update);group.remove();renderer.remove();map.attributionControl.removeAttribution('Náhled tratě: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · ODbL');};
 },[map,enabled,active,catalog,onSelect]);
 const fit=useCallback((route:SneakPeekRoute)=>{if(!map)return;if(zooming.current)pendingFit.current=route;else fitNow(map,route);},[map]);
 return {routes:catalog?.routes??[],loading:enabled&&!catalog&&!error,error,retry:()=>setRetry(n=>n+1),fit};
}
