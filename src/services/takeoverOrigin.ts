import type {TrainDetailPayload} from '../types/trains';
import type {DriveOriginSource} from '../types/driving';
import {haversineM} from './geo';
export interface TakeoverOrigin {origin:string;originVerified:boolean;originSource:DriveOriginSource}
const validPosition=(lat:number,lon:number)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0);
/** The authoritative origin is recomputed in the main process at confirmation. */
export function takeoverOrigin(detail:Pick<TrainDetailPayload,'train'|'stations'|'timetable'|'fetchedAt'>,now=Date.now()):TakeoverOrigin{
 const train=detail.train,age=now-detail.fetchedAt;
 if(!train||!Number.isFinite(age)||age< -5000||age>15000)return {origin:'Poloha při převzetí nedostupná – chybí čerstvá data',originVerified:false,originSource:'unavailable'};
 const hasPosition=validPosition(train.lat,train.lon);
 if(hasPosition){
  let nearest:{name:string;distance:number}|null=null;
  for(const station of detail.stations){if(!station.name?.trim()||!validPosition(station.lat,station.lon))continue;const distance=haversineM(train.lat,train.lon,station.lat,station.lon);if(distance<=300&&(!nearest||distance<nearest.distance))nearest={name:station.name,distance};}
  if(nearest){const standing=train.speedKmh!==null&&Number.isFinite(train.speedKmh)&&train.speedKmh>=0&&train.speedKmh<=1;return {origin:standing?nearest.name:'V blízkosti stanice '+nearest.name,originVerified:standing,originSource:standing?'station':'near-station'};}
 }
 const points=detail.timetable?.points??[],index=train.timetableIndex;
 if(index!==null&&Number.isInteger(index)&&index>=0&&index<points.length){const next=points[index],previous=index>0?points[index-1]:null;if(previous?.name&&next?.name&&previous.name!==next.name)return {origin:'Na úseku '+previous.name+' → '+next.name,originVerified:false,originSource:'section'};if(next?.name)return {origin:'Před bodem '+next.name+' podle jízdního řádu',originVerified:false,originSource:'section'};}
 if(hasPosition)return {origin:'Poloha vlaku '+train.lat.toFixed(5)+', '+train.lon.toFixed(5),originVerified:false,originSource:'coordinates'};
 return {origin:'Poloha při převzetí nedostupná',originVerified:false,originSource:'unavailable'};
}
export function originDescription(source:DriveOriginSource|undefined,verified:boolean){
 switch(source){case 'station':return 'Stanice podle aktuální polohy a zastavení vlaku';case 'near-station':return 'Blízkost stanice podle aktuální polohy vlaku';case 'section':return 'Úsek odvozený z aktuálního indexu jízdního řádu';case 'coordinates':return 'Aktuální souřadnice vlaku; stanice ani úsek nebyly určeny';case 'unavailable':return 'Poloha nebyla spolehlivě dostupná';default:return verified?'Potvrzená PH zastávka podle polohy':'Ručně uvedené strojvedoucím';}
}
