import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import {haversineM} from '@/services/geo';
import {trainCategory} from '@/services/trainCategory';
import type {Train} from '@/types/trains';
import type {TrainRoute} from '@/types/route';
export function useRailRoute(map:L.Map|null,server:string|null,train:Train|null,demo:boolean,active:boolean){
 const key=train&&server&&!demo?server+':'+(train.runId??train.number):'';
 const [loaded,setLoaded]=useState<{key:string;data:TrainRoute|null;error:string;loading:boolean}>({key:'',data:null,error:'',loading:false});
 const [show,setShow]=useState(true),[reload,setReload]=useState(0);
 const zooming=useRef(false),pendingFit=useRef<(()=>void)|null>(null);
 const paths=useRef<{passed:L.Polyline;halo:L.Polyline;future:L.Polyline}[]>([]);
 const route=loaded.key===key?loaded.data:null;
 useEffect(()=>{
  if(!map)return;
  let frame=0;
  const start=()=>{zooming.current=true;};
  const end=()=>{zooming.current=false;const next=pendingFit.current;pendingFit.current=null;if(next)frame=requestAnimationFrame(next);};
  map.on('zoomstart',start).on('zoomend',end);
  return()=>{map.off('zoomstart',start).off('zoomend',end);cancelAnimationFrame(frame);pendingFit.current=null;};
 },[map]);
 useEffect(()=>{pendingFit.current=null;},[key]);
 useEffect(()=>{setShow(true);},[key]);
 useEffect(()=>{
  if(!key||!server||!train||!active)return;
  if(loaded.key===key&&loaded.data)return;
  let alive=true;setLoaded({key,data:null,error:'',loading:true});
  void window.simrailHub!.call('trains:route',server,train.number).then(r=>{
   if(alive)setLoaded({key,data:r.ok?r.data:null,error:r.ok?'':r.error,loading:false});
  }).catch(e=>{if(alive)setLoaded({key,data:null,error:e.message,loading:false});});
  return()=>{alive=false;};
 },[key,active,reload]);
 useEffect(()=>{
  if(!map||!route||!show)return;
  if(!map.getPane('rail-route')){const pane=map.createPane('rail-route');pane.style.zIndex='450';pane.style.pointerEvents='none';}
  const renderer=L.svg({pane:'rail-route'}),group=L.layerGroup().addTo(map);
  paths.current=route.sections.map(()=>{
   const passed=L.polyline([],{pane:'rail-route',renderer,color:'#899da9',weight:3,opacity:.6,interactive:false,className:'rail-route-passed'}).addTo(group);
   const halo=L.polyline([],{pane:'rail-route',renderer,color:'#edf5f6',weight:7,opacity:.7,interactive:false}).addTo(group);
   const future=L.polyline([],{pane:'rail-route',renderer,color:'#4cace3',weight:4,opacity:1,interactive:false,className:'rail-route-future'}).addTo(group);
   return {passed,halo,future};
  });
  return()=>{paths.current=[];group.remove();renderer.remove();};
 },[map,route,show]);
 useEffect(()=>{
  if(!active||!train||!route||!show)return;
  route.sections.forEach((section,index)=>{
   const layer=paths.current[index];if(!layer)return;
   const coords=section.coordinates,idx=train.timetableIndex;
   let split=idx!==null&&idx>section.toIndex?coords.length-1:0;
   if(idx!==null&&idx>=section.fromIndex&&idx<=section.toIndex){
    let best=1800;
    coords.forEach((point,k)=>{const d=haversineM(point[0],point[1],train.lat,train.lon);if(d<best){best=d;split=k;}});
   }
   layer.passed.setLatLngs(split>0?coords.slice(0,split+1):[]);
   const remaining=split<coords.length-1?coords.slice(split):[];
   layer.halo.setLatLngs(remaining);layer.future.setLatLngs(remaining).setStyle({color:'color-mix(in srgb, '+trainCategory(train).color+', white 25%)'});
  });
 },[active,train,route,show]);
 const fit=()=>{
  if(!map||!route)return;
  const coordinates=route.sections.flatMap(s=>s.coordinates);
  if(coordinates.length){
   const action=()=>{map.stop();map.fitBounds(L.latLngBounds(coordinates),{padding:[40,40],maxZoom:12,animate:true});};
   if(zooming.current)pendingFit.current=action;else action();
  }
 };
 return {route,show,setShow,fit,retry:()=>{setLoaded({key,data:null,error:'',loading:false});setReload(v=>v+1);},loading:loaded.key===key&&loaded.loading,error:loaded.key===key?loaded.error:''};
}
