import {parseSod} from '../adapters/trainsApi';
import {fmtSod,type OnboardModel} from './onboard';
import {delaySeverity,type DelaySeverity} from './delayPresentation';
export interface JourneyTime {plan:string|null;display:string|null;estimated:boolean;dayOffset:number}
export function hasObservedDelay(m:OnboardModel):boolean {return (m.connection==='live'||m.connection==='demo')&&m.delayKind==='observed'&&m.delayMin!==null&&Number.isFinite(m.delayMin);}
export function nextStopTimes(m:OnboardModel):{arrival:JourneyTime;departure:JourneyTime} {
 const standing=m.rows.find(r=>r.standing),target=m.rows.find(r=>r.status==='target');
 const lower=standing?standing.index+1:target?.index;
 const next=lower!==undefined&&m.next?m.rows.find(r=>r.passengerStop&&r.status!=='passed'&&r.index>=lower&&r.name===m.next):null;
 const time=(raw:string|null,departure=false):JourneyTime=>{
  const sod=parseSod(raw);if(sod===null)return {plan:null,display:null,estimated:false,dayOffset:0};
  const plan=fmtSod(sod),estimated=hasObservedDelay(m);
  // A passenger departure is never predicted before its scheduled departure.
  const delay=estimated?(departure?Math.max(0,m.delayMin!):m.delayMin!)*60:0;
  return {plan,display:fmtSod(sod+delay),estimated,dayOffset:Math.floor((sod+delay)/86400)};
 };
 return {arrival:time(next?.arrival??null),departure:time(next?.departure??null,true)};
}
export function journeyDelay(m:OnboardModel):{severity:DelaySeverity;label:string;caption:string;observed:boolean} {
 const observed=hasObservedDelay(m),minutes=m.delayMin;
 if(!observed)return {severity:'unknown',label:'Zatím neurčeno',caption:m.connection==='stale'||m.connection==='lost'?'Čekám na aktuální data':m.delayKind==='estimate'&&minutes!==null&&minutes>0?'Předběžně nejméně +'+minutes+' min · čekám na průjezd':'Čekám na první potvrzený průjezd',observed:false};
 return {severity:delaySeverity(minutes),label:minutes===0?'Včas':(minutes!>0?'+':'−')+Math.abs(minutes!)+' min',caption:'Odhad podle posledního průjezdu',observed:true};
}
export function journeyMotion(m:OnboardModel):{label:string;caption:string;key:string} {
 if(m.connection==='stale'||m.connection==='lost')return {key:'unknown',label:'ČEKÁM NA DATA',caption:'Poslední poloha není potvrzená'};
 if(m.current&&m.phase==='standing')return {key:'station',label:'VE STANICI',caption:m.current};
 if(m.phase==='moving')return {key:'moving',label:'NA TRATI',caption:'Mezi stanicemi'};
 if(m.phase==='standing-unknown')return {key:'stopped',label:'STOJÍ',caption:'Poloha ve stanici zatím nepotvrzena'};
 return {key:'unknown',label:'POLOHA NEPOTVRZENA',caption:'Čekám na rychlost a polohu'};
}
