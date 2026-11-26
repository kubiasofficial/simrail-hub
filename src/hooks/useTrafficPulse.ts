import {useEffect,useRef} from 'react';import L from 'leaflet';import type {TrafficAlert} from '@/services/dispatcher';
export function useTrafficPulse(map:L.Map|null,alert:TrafficAlert|null,active:boolean){
 const marker=useRef<L.Marker|null>(null);
 useEffect(()=>{if(!map||!active||!alert)return;const root=document.createElement('span');root.className='traffic-pulse'+(alert.severity>=3?' severe':'');const dot=document.createElement('span');root.append(dot);const m=L.marker([alert.lat,alert.lon],{interactive:false,zIndexOffset:2000,icon:L.divIcon({className:'traffic-pulse-marker',html:root,iconSize:[64,64],iconAnchor:[32,32]})}).addTo(map);const tip=document.createElement('span');tip.textContent=alert.text;m.bindTooltip(tip);marker.current=m;return()=>{m.remove();marker.current=null;};},[map,alert?.key,active]);
 useEffect(()=>{if(alert&&active){marker.current?.setLatLng([alert.lat,alert.lon]);marker.current?.getElement()?.querySelector('.traffic-pulse')?.classList.toggle('severe',alert.severity>=3);}},[alert,active]);
}
