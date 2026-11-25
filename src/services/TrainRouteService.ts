import {readFile} from 'node:fs/promises';
import {RailGraph} from './RailGraph';
import {findStation} from './onboard';
import {isPassengerStop} from './passengerStops';
import type {RailNetwork,TrainRoute} from '../types/route';
import type {TrainTrackingService} from './TrainTrackingService';
export class TrainRouteService {
 private pending=new Map<string,Promise<TrainRoute>>();
 private loading:Promise<RailGraph>|null=null;private sourceDate='';private cache=new Map<string,TrainRoute>();
 constructor(private tracking:TrainTrackingService,private networkFile:string){}
 private graph(){
  if(!this.loading)this.loading=readFile(this.networkFile,'utf8').then(raw=>{const data=JSON.parse(raw) as RailNetwork;this.sourceDate=data.source.osmTimestamp;return new RailGraph(data);}).catch(e=>{this.loading=null;throw e;});
  return this.loading;
 }
 get(code:string,number:string):Promise<TrainRoute>{
  const key=code+':'+number,waiting=this.pending.get(key);if(waiting)return waiting;
  if(this.pending.size>=8)return Promise.reject(Error('Počkej na dokončení načítané trasy.'));
  const task=this.load(code,number).finally(()=>this.pending.delete(key));this.pending.set(key,task);return task;
 }
 private async load(code:string,number:string):Promise<TrainRoute>{
  const detail=await this.tracking.getDetail(code,number);
  if(!detail.ok)throw Error(detail.error);
  const {train,timetable,stations,notes}=detail.data;
  if(!train||!timetable)throw Error('Pro vybraný vlak chybí jízdní řád.');
  if(notes.some(n=>n.startsWith('Jízdní řády nejsou dostupné')||n.startsWith('Souřadnice stanic nejsou dostupné')))throw Error('Traťová data vyžadují aktuální jízdní řád a stanice.');
  const key=code+':'+(train.runId??number);const cached=this.cache.get(key);if(cached)return cached;
  const graph=await this.graph(),stops:TrainRoute['stops']=[];
  timetable.points.forEach((p,index)=>{const s=findStation(p.name,stations);if(s)stops.push({name:p.name,index,lat:s.lat,lon:s.lon,passengerStop:isPassengerStop(p)});});
  const sections:TrainRoute['sections']=[];let missingSections=0;
  for(let i=1;i<stops.length;i++){
   const a=stops[i-1],b=stops[i];const coordinates=graph.path([a.lat,a.lon],[b.lat,b.lon]);
   if(coordinates?.length)sections.push({fromIndex:a.index,toIndex:b.index,coordinates});else missingSections++;
   // Give polling and audio callbacks time between graph searches.
   await new Promise<void>(resolve=>setImmediate(resolve));
  }
  const result:TrainRoute={trainNumber:number,runId:train.runId,sections,stops,totalPoints:timetable.points.length,matchedPoints:stops.length,missingSections,sourceDate:this.sourceDate,first:stops[0]?.name??null,last:stops.at(-1)?.name??null};
  if(this.cache.size>=24)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,result);return result;
 }
}
