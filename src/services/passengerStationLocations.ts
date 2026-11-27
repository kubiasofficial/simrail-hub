import type {StationCoord} from '../types/trains';
// OSM railway=stop platform reference points, checked 2026-11-28.
// Dispatcher API coordinates are retained on the map; these points serve passenger proximity only.
export const PASSENGER_STATION_LOCATIONS=[
 {name:'Sosnowiec Główny',lat:50.2791423,lon:19.1262529,osmNode:12585026591},
 {name:'Sosnowiec Południowy',lat:50.2703012,lon:19.1248035,osmNode:10567112402}
] as const;
const key=(name:string)=>name.toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export function passengerStationLocation(name:string,station:StationCoord|null):StationCoord|null {
 const platform=PASSENGER_STATION_LOCATIONS.find(s=>key(s.name)===key(name));
 return platform?{...station,name:platform.name,prefix:station?.prefix??null,lat:platform.lat,lon:platform.lon}:station;
}
