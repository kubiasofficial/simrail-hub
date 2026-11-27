import type {Timetable,StationCoord,Train} from '../types/trains';
import type {ShiftRequest,ShiftPlan,ShiftLeg} from '../types/shift';
import {parseSod} from '../adapters/trainsApi';
import {normName} from './onboard';
import {isPassengerStop} from './passengerStops';
const DAY=86400;
export const requiredVehicleDlc=(vehicle:string):number[]|null=>/BR.?285|285\s*\(/i.test(vehicle)?[5240850]:/163/.test(vehicle)?[4009020]:/36WEd|impuls/i.test(vehicle)?[4380650]:/ET22/i.test(vehicle)?[2868050]:/EU07|EP07|EP08|ED250|E186|EU43|TRAXX|EN57|EN71|ET25|E6ACT|Dragon/i.test(vehicle)?[]:null;
export function buildShift(server:string,request:ShiftRequest,timetables:Timetable[],stations:StationCoord[],trains:Train[],serverSod:number,now=Date.now()):ShiftPlan{
 const span=(request.endSod-serverSod+DAY)%DAY;
 if(span<900||span>16*3600)throw Error('Konec směny musí být za 15 minut až 16 hodin podle času serveru.');
 if(!request.origin.trim())throw Error('Vyber výchozí stanici.');
 const end=serverSod+span,known=new Set(stations.map(s=>normName(s.name))),used=new Set<string>(),legs:ShiftLeg[]=[];
 let station=request.origin,ready=serverSod+(request.startDelayMinutes??0)*60,previous:Timetable|undefined;
 for(let n=0;n<12;n++){
  const candidates:{leg:ShiftLeg;schedule:Timetable}[]=[];
  for(const t of timetables){
   const key=t.runId??t.trainNumber;if(used.has(key))continue;
   const freight=/^(T|Z|L)[A-Z]{2}$/.test(t.category??'');
   if(request.transport==='freight'?!freight:!t.points.some(isPassengerStop)||freight)continue;
   // Unknown vehicle metadata cannot establish DLC eligibility.
   if(!t.vehicleType)continue;
   const dlc=requiredVehicleDlc(t.vehicleType);if(!dlc||dlc.some(id=>!request.ownedDlc.includes(id)))continue;
   const live=trains.find(x=>x.runId?x.runId===t.runId:x.number===t.trainNumber);
   if(live?.type==='user')continue;
   const stops=t.points.filter(p=>known.has(normName(p.name))&&(request.transport==='freight'||isPassengerStop(p)));
   const from=stops.find(p=>normName(p.name)===normName(station));if(!from)continue;
   const ds=parseSod(from.departure??from.arrival);if(ds===null)continue;
   const dep=serverSod+(ds-serverSod+DAY)%DAY;if(dep<ready||dep>end)continue;
   // Already passed a proposed takeover point: no phantom future occurrence today.
   if(live&&live.timetableIndex!==null&&live.timetableIndex>from.index)continue;
   const destinations=stops.filter(p=>p.index>from.index).map(p=>({point:p,sod:parseSod(p.arrival??p.departure)})).filter(p=>p.sod!==null).map(p=>({point:p.point,arrival:dep+(p.sod!-ds+DAY)%DAY})).filter(p=>p.arrival>dep&&p.arrival<=end&&p.arrival-dep<=8*3600);
   const to=destinations.at(-1);if(!to)continue;
   candidates.push({schedule:t,leg:{id:key+':'+from.index,number:t.trainNumber,runId:t.runId,from:from.name,to:to.point.name,departure:dep,arrival:to.arrival,takeoverArrival:parseSod(from.arrival)===null?null:dep-(ds-parseSod(from.arrival)!+DAY)%DAY,vehicle:t.vehicleType,requiredDlc:dlc,availability:live?.type==='bot'?'ai':'future',sameConsist:!!previous?.continuesAs&&previous.continuesAs===t.trainNumber}});
  }
  candidates.sort((a,b)=>a.leg.departure-b.leg.departure||Number(b.leg.sameConsist)-Number(a.leg.sameConsist));
  const next=candidates[0];if(!next)break;
  legs.push(next.leg);used.add(next.schedule.runId??next.schedule.trainNumber);previous=next.schedule;station=next.leg.to;ready=next.leg.arrival+request.breakMinutes*60;
 }
 return {schema:1,server,generatedAt:now,serverSod,end,request,legs,notes:[
 'Návrh vychází z plánovaných časů. Vlak nelze rezervovat; před převzetím ověř dostupnost.',
 'DLC se filtrují podle známého typu vozidla. Požadavky na trať a zbývající vozidla soupravy ověř ve hře.',
 ...(legs.length?[]:['Pro vybrané místo, čas a DLC nebyla nalezena doložená návaznost. Zkus jiné zadání.'])]};
}
