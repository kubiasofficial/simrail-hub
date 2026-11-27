import type {StationCoord} from '../types/trains';
// API stations-open describes dispatcher stations, not every passenger stop.
// OSM station nodes checked 2026-11-27; positions are approximate platform centres.
export const STATION_FALLBACKS: (StationCoord & {osmNode:number})[] = [
 {name:'Warszawa Wschodnia',prefix:null,lat:52.2515889,lon:21.0523678,osmNode:33210583},
 {name:'Warszawa Centralna',prefix:null,lat:52.2288207,lon:21.0031600,osmNode:9814916146},
 {name:'Warszawa Zachodnia',prefix:null,lat:52.2201572,lon:20.9651719,osmNode:3390821831}
];
const key=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function withStationFallbacks(stations:StationCoord[]):StationCoord[]{
 const names=new Set(stations.map(s=>key(s.name)));
 return [...stations,...STATION_FALLBACKS.filter(s=>!names.has(key(s.name))).map(({osmNode:_,...s})=>({...s,dispatchers:[]}))];
}
