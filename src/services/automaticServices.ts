import type {Train,TimetablePoint} from '../types/trains';
import type {OnboardModel} from './onboard';
import {diffSod} from './onboard';
import {parseSod} from '../adapters/trainsApi';
import {isPassengerStop} from './passengerStops';
import type {ServiceAnnouncementId} from './serviceAnnouncements';
export interface ServiceOptions {welcome:boolean;luggage:boolean;waiting:boolean}
export interface ServiceEvent {key:string;ids:ServiceAnnouncementId[];valid:()=>boolean;complete:()=>void}
export interface ServiceInput {run:string;train:Train;points:TimetablePoint[];model:OnboardModel;serverSod:number|null;fetchedAt:number;enabled:boolean;freight:boolean;options:ServiceOptions}
/** Only observed departure from the initial monitored PH can welcome; no catch-up on joining mid-run. */
export class AutomaticServices {
 private run='';private fired=new Set<string>();private originStanding=false;private initialized=false;private originIndex:number|null=null;private welcomeAt:number|null=null;
 private waitingAt:number|null=null;private lastSample:number|null=null;private lastTime=0;private episode=0;private waitingFired=false;private latest:ServiceInput|null=null;
 constructor(private now:()=>number=Date.now){}
 reset(){this.run='';this.fired.clear();this.originStanding=false;this.initialized=false;this.originIndex=null;this.welcomeAt=null;this.waitingAt=null;this.lastSample=null;this.waitingFired=false;this.latest=null;this.lastTime=0;this.episode++;}
 private usable(i:ServiceInput){return i.enabled&&!i.freight&&(i.model.connection==='live'||i.model.connection==='demo')&&this.now()-i.fetchedAt>=0&&this.now()-i.fetchedAt<=15000;}
 private redWait(i:ServiceInput){
  if(!this.usable(i)||i.train.speedKmh===null||i.train.speedKmh>1||i.train.signalSpeedKmh!==0||i.train.distanceToSignalM===null||i.train.distanceToSignalM<0||i.train.distanceToSignalM>250)return false;
  // Never call planned commercial/technical dwell a red-signal delay.
  const p=i.points[i.train.timetableIndex??-1],departure=p?parseSod(p.departure):null;
  if(p?.isStop&&(i.model.current===p.name||!isPassengerStop(p))&&departure!==null&&(i.serverSod===null||diffSod(i.serverSod,departure)<=0))return false;
  return true;
 }
 update(i:ServiceInput):ServiceEvent[]{
  if(i.run!==this.run){this.reset();this.run=i.run;}
  this.latest=i;const now=this.now(),events:ServiceEvent[]=[];
  if(!this.usable(i)){this.waitingAt=null;this.waitingFired=false;this.lastSample=null;this.originStanding=false;this.episode++;return events;}
  if(this.lastSample===i.fetchedAt)return events;
  const gap=this.lastTime>0&&now-this.lastTime>20000;this.lastTime=now;this.lastSample=i.fetchedAt;
  if(gap){this.waitingAt=null;this.originStanding=false;this.waitingFired=false;this.episode++;}
  const capturedRun=this.run;
  const valid=()=>this.latest!==null&&this.run===capturedRun&&this.usable(this.latest);
  const idx=i.train.timetableIndex;
  if(!this.initialized){this.initialized=true;const origin=i.points.find(p=>p.name===i.model.current&&isPassengerStop(p));if(origin&&i.train.speedKmh!==null&&i.train.speedKmh<=1){this.originStanding=true;this.originIndex=origin.index;}}
  if(this.originIndex!==null&&this.originStanding&&i.train.speedKmh!==null&&i.train.speedKmh>=5&&idx!==null&&idx>=this.originIndex&&!this.fired.has('welcome')){
   this.originStanding=false;this.fired.add('welcome');
   if(i.options.welcome)events.push({key:'welcome',ids:['welcome'],valid:()=>valid()&&!!this.latest?.options.welcome,complete:()=>{if(this.run===capturedRun)this.welcomeAt=this.now();}});
   else this.welcomeAt=now;
  }
  if(i.options.luggage&&this.welcomeAt!==null&&now-this.welcomeAt>=60000&&!this.fired.has('luggage')){
   this.fired.add('luggage');events.push({key:'luggage',ids:['luggage'],valid:()=>valid()&&!!this.latest?.options.luggage,complete:()=>{}});
  }
  if(i.options.waiting&&this.redWait(i)){
   this.waitingAt??=now;
   if(now-this.waitingAt>=300000&&!this.waitingFired){
    this.waitingFired=true;const episode=this.episode;
    // Outside a confirmed PH platform only: do not tell boarding passengers not to alight.
    const outside=!i.model.current;
    events.push({key:'wait:'+episode,ids:outside?['departure_wait','stay_onboard']:['departure_wait'],valid:()=>valid()&&this.episode===episode&&!!this.latest?.options.waiting&&this.redWait(this.latest!)&&(!outside||!this.latest?.model.current),complete:()=>{}});
   }
  }else{this.waitingAt=null;if(this.waitingFired)this.episode++;this.waitingFired=false;}
  return events;
 }
}
