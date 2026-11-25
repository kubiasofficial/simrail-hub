import L from 'leaflet';
import type {Train,StationCoord} from '@/types/trains';
import {bearingDeg,haversineM} from '@/services/geo';
const trainSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M12 3v7M8 18l-2 3m10-3 2 3M8 21h8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>';
interface Entry {marker:L.Marker;signature:string}
interface Options {train:string|null;station:string|null;trains:boolean;stations:boolean}
export class MapMarkers{
 private entries=new Map<string,Entry>();private positions=new Map<string,{lat:number;lon:number;bearing:number|null}>();private operations={created:0,moved:0,icons:0,removed:0};
 constructor(private map:L.Map,private selectTrain:(train:Train)=>void,private selectStation:(station:StationCoord)=>void){}
 private avatar(url:string|null|undefined,root:HTMLElement){
  if(!url||!/^https:\/\/(avatars\.[a-z.]*steamstatic\.com|steamcdn-a\.akamaihd\.net)\//.test(url))return;
  const image=document.createElement('img');image.src=url;image.alt='Steam avatar';image.className='steam-avatar';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();root.append(image);
 }
 private upsert(key:string,lat:number,lon:number,signature:string,root:HTMLElement,kind:string,title:string,click:()=>void){
  let entry=this.entries.get(key);
  if(!entry){const marker=L.marker([lat,lon],{icon:L.divIcon({className:'map-entity '+kind,html:root,iconSize:kind==='cluster-entity'?[32,32]:[26,26],iconAnchor:kind==='cluster-entity'?[16,16]:[13,13]}),alt:title,title,zIndexOffset:kind==='station-entity'?100:500}).addTo(this.map);entry={marker,signature};this.entries.set(key,entry);this.operations.created++;}
  else{const previous=entry.marker.getLatLng();if(previous.lat!==lat||previous.lng!==lon){entry.marker.setLatLng([lat,lon]);this.operations.moved++;}if(entry.signature!==signature){entry.marker.getElement()?.replaceChildren(root);entry.signature=signature;this.operations.icons++;}}
  entry.marker.off('click').on('click',click);
 }
 sync(trains:Train[],stations:StationCoord[],options:Options){
  const zoom=this.map.getZoom(),bounds=this.map.getBounds().pad(.18),live=new Set<string>(),labelCells=new Set<string>();
  if(options.stations)for(const station of stations){
   if(!bounds.contains([station.lat,station.lon]))continue;
   const key='station:'+station.name;live.add(key);const selected=options.station===station.name;
   const occupied=(station.dispatchers?.length??0)>0,avatar=station.dispatchers?.[0]?.avatarUrl;
   const root=document.createElement('div');root.className='map-station-symbol'+(occupied?' occupied':'')+(selected?' selected':'');if(zoom>=10)this.avatar(avatar,root);
   const pixel=this.map.latLngToContainerPoint([station.lat,station.lon]),cell=Math.floor(pixel.x/110)+':'+Math.floor(pixel.y/30);
   const label=selected||(zoom>=11&&!labelCells.has(cell));if(label){labelCells.add(cell);const text=document.createElement('span');text.className='map-station-name';text.textContent=station.name;root.append(text);}
   this.upsert(key,station.lat,station.lon,[occupied,selected,zoom>=10?avatar:'',label].join('|'),root,'station-entity',station.name,()=>this.selectStation(station));
  }
  const groups=new Map<string,Train[]>();
  if(options.trains)for(const train of trains){
   if(!bounds.contains([train.lat,train.lon]))continue;
   const position=this.map.project([train.lat,train.lon]);
   const key=zoom<11&&options.train!==train.number?'cluster:'+Math.floor(position.x/42)+':'+Math.floor(position.y/42):'train:'+train.id;
   const group=groups.get(key);if(group)group.push(train);else groups.set(key,[train]);
  }
  for(const [groupKey,group] of groups){
   const train=group[0];const cluster=group.length>1,key=cluster?groupKey:'train:'+train.id;live.add(key);
   const root=document.createElement('div');
   if(cluster){root.className='train-cluster';root.textContent=String(group.length);this.upsert(key,train.lat,train.lon,String(group.length),root,'cluster-entity',group.length+' vlaků',()=>this.map.setView([train.lat,train.lon],Math.min(zoom+2,16)));continue;}
   const selected=options.train===train.number;const old=this.positions.get(train.id);let bearing=old?.bearing??null;if(old&&haversineM(old.lat,old.lon,train.lat,train.lon)>=5)bearing=bearingDeg(old.lat,old.lon,train.lat,train.lon);this.positions.set(train.id,{lat:train.lat,lon:train.lon,bearing});
   root.className='rail-train'+(train.type==='user'?' player':'')+(selected?' chosen':'');
   const body=document.createElement('span');body.className='train-body';body.innerHTML=trainSvg;root.append(body);
   if(bearing!==null){const direction=document.createElement('span');direction.className='train-direction';direction.style.transform='rotate('+bearing+'deg)';const arrow=document.createElement('span');arrow.className='ahead-arrow';direction.append(arrow);root.append(direction);}
   this.avatar(train.avatarUrl,root);
   const pixel=this.map.latLngToContainerPoint([train.lat,train.lon]),cell=Math.floor(pixel.x/110)+':'+Math.floor(pixel.y/30);
   const label=selected||(zoom>=10&&!labelCells.has(cell));if(label)labelCells.add(cell);if(label){const text=document.createElement('span');text.className='train-number';text.textContent=train.number;root.append(text);}
   this.upsert(key,train.lat,train.lon,[train.type,selected,train.avatarUrl,label,bearing].join('|'),root,'train-entity', 'Vlak '+train.number,()=>this.selectTrain(train));
  }
  for(const [key,entry] of this.entries)if(!live.has(key)){entry.marker.remove();this.entries.delete(key);this.operations.removed++;}
  const ids=new Set(trains.map(t=>t.id));for(const id of this.positions.keys())if(!ids.has(id))this.positions.delete(id);
 }
 diagnostics(){return {...this.operations,active:this.entries.size};}
 clear(){for(const entry of this.entries.values())entry.marker.remove();this.entries.clear();this.positions.clear();}
}
