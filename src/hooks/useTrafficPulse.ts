import {useEffect,useRef} from 'react';
import L from 'leaflet';
import type {TrafficAlert} from '@/services/dispatcher';
import {trafficTooltip} from '@/services/trafficTooltip';

export function useTrafficPulse(map:L.Map|null,alert:TrafficAlert|null,active:boolean){
 const marker=useRef<L.Marker|null>(null),latest=useRef(alert),fading=useRef<ReturnType<typeof setTimeout>|null>(null);
 latest.current=alert;
 useEffect(()=>{
  if(!map||!active)return;
  const close=()=>marker.current?.closeTooltip();map.on('click',close);
  return()=>{map.off('click',close);if(fading.current)clearTimeout(fading.current);marker.current?.remove();marker.current=null;};
 },[map,active]);
 useEffect(()=>{
  if(!map||!active)return;
  if(fading.current){clearTimeout(fading.current);fading.current=null;}
  if(!alert){
   const old=marker.current;if(!old)return;
   old.closeTooltip();old.getElement()?.classList.add('traffic-resolved');
   fading.current=setTimeout(()=>{old.remove();if(marker.current===old)marker.current=null;fading.current=null;},500);
   return;
  }
  let m=marker.current;
  if(!m){
   const root=document.createElement('span');root.className='traffic-pulse';
   const dot=document.createElement('button');dot.type='button';dot.className='traffic-pulse-hit';root.append(dot);
   m=L.marker([alert.lat,alert.lon],{interactive:true,keyboard:false,zIndexOffset:2000,icon:L.divIcon({className:'traffic-pulse-marker',html:root,iconSize:[64,64],iconAnchor:[32,32]})}).addTo(map);
   const tip=document.createElement('span');tip.className='traffic-tooltip-text';m.bindTooltip(tip,{direction:'auto',offset:[12,0],className:'traffic-tooltip',opacity:1});
   const created=m;
   dot.addEventListener('focus',()=>created.openTooltip());dot.addEventListener('blur',()=>created.closeTooltip());
   dot.addEventListener('click',e=>{e.stopPropagation();created.openTooltip();});
   dot.addEventListener('keydown',e=>{if(e.key==='Escape'){created.closeTooltip();dot.blur();}});
   L.DomEvent.disableClickPropagation(dot);marker.current=m;
  }
  m.setLatLng([alert.lat,alert.lon]);m.getElement()?.classList.remove('traffic-resolved');
  const update=()=>{
   const current=latest.current;if(!current)return;
   const stale=current.state==='unverified'||!!current.observedAt&&Date.now()-current.observedAt>15000;
   const root=m.getElement()?.querySelector('.traffic-pulse');root?.classList.toggle('severe',current.severity>=3);root?.classList.toggle('unverified',stale);
   const text=trafficTooltip(current),tip=m.getTooltip()?.getContent();if(tip instanceof HTMLElement)tip.textContent=text;
   m.getTooltip()?.update();
   m.getElement()?.querySelector('button')?.setAttribute('aria-label',text);
  };
  update();m.on('tooltipopen',update);
  const timer=setInterval(()=>{if(m.isTooltipOpen()||latest.current?.observedAt&&Date.now()-latest.current.observedAt>15000)update();},1000);
  return()=>{clearInterval(timer);m.off('tooltipopen',update);};
 },[map,active,alert]);
}
