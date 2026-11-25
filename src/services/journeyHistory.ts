import type {OnboardModel} from './onboard';
import type {Train} from '../types/trains';
export interface JourneyRecord {id:string;server:string;number:string;runId:string|null;start:string|null;end:string|null;firstSeen:number;lastSeen:number;finished:boolean;passages:{index:number;name:string;at:number;delayMin:number|null}[];lastIndex:number|null;delayMin:number|null}
export interface JourneyLibrary {version:1;favorites:string[];journeys:JourneyRecord[]}
export const EMPTY_LIBRARY:JourneyLibrary={version:1,favorites:[],journeys:[]};
const text=(x:unknown,max=160):x is string=>typeof x==='string'&&x.length<=max;
const maybeText=(x:unknown)=>x===null||text(x);
const time=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const delay=(x:unknown)=>x===null||typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=720;
const index=(x:unknown)=>x===null||Number.isInteger(x)&&Number(x)>=0&&Number(x)<10000;
export function readLibrary(raw:string|null):JourneyLibrary{
 try{if(!raw||raw.length>2000000)return {...EMPTY_LIBRARY};const v=JSON.parse(raw);if(v.version!==1||!Array.isArray(v.favorites)||!Array.isArray(v.journeys))return {...EMPTY_LIBRARY};
 const journeys=v.journeys.filter((x:JourneyRecord)=>x&&text(x.id,200)&&/^[\w-]{1,40}$/.test(x.server)&&/^\d{1,12}$/.test(x.number)&&maybeText(x.runId)&&maybeText(x.start)&&maybeText(x.end)&&time(x.firstSeen)&&time(x.lastSeen)&&typeof x.finished==='boolean'&&index(x.lastIndex)&&delay(x.delayMin)&&Array.isArray(x.passages)&&x.passages.length<=256&&x.passages.every(p=>p&&index(p.index)&&text(p.name)&&time(p.at)&&delay(p.delayMin))).slice(0,100);
 return {version:1,favorites:v.favorites.filter((x:unknown)=>typeof x==='string'&&/^[\w-]{1,40}:\d{1,12}$/.test(x)).slice(0,100),journeys};
 }catch{return {...EMPTY_LIBRARY};}
}
export function observeJourney(current:JourneyRecord[],server:string,train:Train,m:OnboardModel,now:number):JourneyRecord[]{
 if(m.connection!=='live')return current;
 const idx=train.timetableIndex,first=current[0],same=first&&!first.finished&&first.server===server&&first.number===train.number&&first.runId===train.runId&&now-first.lastSeen<1800000;
 if(same&&idx===first.lastIndex&&now-first.lastSeen<60000)return current;
 const changed=same&&idx!==null&&first.lastIndex!==null&&idx===first.lastIndex+1;
 const row=changed?m.rows.find(r=>r.index===idx-1&&r.passengerStop):null;
 const record:JourneyRecord=same?{...first,lastSeen:now,lastIndex:idx,delayMin:m.delayKind==='observed'?m.delayMin:null,passages:row?[...first.passages,{index:row.index,name:row.name,at:now,delayMin:m.delayKind==='observed'?m.delayMin:null}].slice(-256):first.passages}:{id:server+':'+train.number+':'+now,server,number:train.number,runId:train.runId,start:m.start,end:m.end,firstSeen:now,lastSeen:now,finished:false,passages:[],lastIndex:idx,delayMin:m.delayKind==='observed'?m.delayMin:null};
 const rest=same?current.slice(1):current.map(r=>r.finished?r:{...r,finished:true});return [record,...rest].slice(0,100);
}
