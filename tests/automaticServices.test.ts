import {it,expect} from 'vitest';
import {AutomaticServices,type ServiceInput} from '../src/services/automaticServices';
import {computeOnboard,DelayTracker} from '../src/services/onboard';
import {withStationFallbacks,STATION_FALLBACKS} from '../src/services/stationFallbacks';
import {AnnouncementTrigger} from '../src/services/announcements';
import type {Train,TimetablePoint} from '../src/types/trains';
const points:TimetablePoint[]=['Warszawa Wschodnia','Warszawa Centralna','Warszawa Zachodnia'].map((name,index)=>({index,name,pointId:null,arrival:'12:00',departure:'12:01',isStop:true,stopType:'CommercialStop',maxSpeed:100,km:index,platform:null,track:null}));
const train:Train={id:'1',runId:'a',serverCode:'cz1',number:'16105',name:'TLK',type:'bot',startStation:points[0].name,endStation:points[2].name,lat:STATION_FALLBACKS[0].lat,lon:STATION_FALLBACKS[0].lon,speedKmh:0,timetableIndex:0,signalSpeedKmh:0,distanceToSignalM:50,inBorderArea:false};
const model=()=>computeOnboard({train,timetable:{runId:'a',trainNumber:'16105',startStation:points[0].name,endStation:points[2].name,points},stations:withStationFallbacks([]),nowSod:12*3600,tracker:new DelayTracker(),connection:'live'});
it('restores all Warsaw PH proximity triggers in both directions without replacing live coordinates',()=>{
 for(const ps of [points,[...points].reverse().map((p,index)=>({...p,index}))])for(const p of ps){const s=STATION_FALLBACKS.find(s=>s.name===p.name)!;const t={...train,lat:s.lat,lon:s.lon,timetableIndex:p.index,speedKmh:25};const m=computeOnboard({train:t,timetable:{runId:'a',trainNumber:t.number,startStation:null,endStation:null,points:ps},stations:withStationFallbacks([]),nowSod:43200,tracker:new DelayTracker(),connection:'live'});expect(m.distanceToNextStopM).toBe(0);const e=new AnnouncementTrigger().update({runKey:'a',index:p.index,speedKmh:25,points:ps,delayMin:null,distToNextStopM:m.distanceToNextStopM});expect(e.events.length).toBe(1);}
 expect(withStationFallbacks([{...STATION_FALLBACKS[0],lat:52}]).find(s=>s.name===points[0].name)?.lat).toBe(52);
});
const setup=(start=1000)=>{let now=start;const trigger=new AutomaticServices(()=>now);const input:ServiceInput={run:'a',train:{...train},points,model:model(),serverSod:44000,fetchedAt:now,enabled:true,freight:false,options:{welcome:true,luggage:true,waiting:true}};return {trigger,input,tick:(delta=5000)=>{now+=delta;input.fetchedAt=now;return trigger.update(input);},now:()=>now};};
it('welcomes only after observed origin departure and waits a minute after finished welcome for luggage',()=>{const {trigger,input,tick}=setup();trigger.update(input);input.train.speedKmh=20;input.model.current=null;const e=tick();expect(e.map(e=>e.ids)).toEqual([['welcome']]);expect(tick(70000)).toEqual([]);e[0].complete();expect(tick(59000)).toEqual([]);expect(tick(5000).map(e=>e.ids)).toEqual([['luggage']]);expect(tick()).toEqual([]);});
it('does not welcome joining a moving train mid-route',()=>{const {trigger,input,tick}=setup();input.train.speedKmh=60;input.train.timetableIndex=2;input.model.current=null;expect(trigger.update(input)).toEqual([]);expect(tick()).toEqual([]);});
it('requires five minutes of fresh continuous red-signal evidence; resets on loss and cancels queued warning after movement',()=>{const {trigger,input,tick}=setup();input.model.current=null;trigger.update(input);for(let k=0;k<59;k++)expect(tick()).toEqual([]);const events=tick();expect(events[0].ids).toEqual(['departure_wait','stay_onboard']);expect(tick()).toEqual([]);input.train.speedKmh=10;tick();expect(events[0].valid()).toBe(false);});
it('does not infer red from speed, planned dwell, freight, stale snapshots, or a sampling gap',()=>{for(const variant of ['missing','dwell','freight','stale','gap']){const {trigger,input,tick}=setup();input.model.current=null;if(variant==='missing')input.train.signalSpeedKmh=null;if(variant==='dwell'){input.serverSod=43200;input.model.current=points[0].name;}if(variant==='freight')input.freight=true;if(variant==='stale')input.model.connection='stale';trigger.update(input);if(variant==='gap')expect(tick(300000)).toEqual([]);else for(let k=0;k<65;k++)expect(tick()).toEqual([]);}});

it('can welcome at the monitored Warsaw stop even if the global timetable starts outside the game',()=>{const {trigger,input,tick}=setup();input.train.timetableIndex=1;input.model.current=points[1].name;trigger.update(input);input.model.current=null;input.train.speedKmh=20;expect(tick()[0].ids).toEqual(['welcome']);});
it('does not treat a future PH timetable as planned dwell when stopped outside that station',()=>{const {trigger,input,tick}=setup();input.model.current=null;input.serverSod=43200;trigger.update(input);for(let k=0;k<59;k++)tick();expect(tick()[0].ids).toEqual(['departure_wait','stay_onboard']);});

const holidaySetup=(date='2026-12-24T10:00:00Z')=>{
 const s=setup(Date.parse(date));s.input.points=points.map((p,index)=>({...p,pointId:String(index+100),line:8}));
 s.input.options={welcome:true,luggage:false,waiting:false,journeyInfo:true,seasonal:true};
 s.input.availableServices=['christmas_welcome','christmas_farewell','consideration','assistance','tickets'];
 s.input.model.distanceToNextStopM=10000;return s;
};
it('replaces only the first playable PH welcome on Christmas Eve and never catches up on moving joins',()=>{
 const s=holidaySetup();s.trigger.update(s.input);s.input.train.speedKmh=50;s.input.model.current=null;
 expect(s.tick().map(e=>e.ids)).toEqual([['christmas_welcome']]);expect(s.tick()).toEqual([]);
 const moving=holidaySetup();moving.input.train.speedKmh=50;moving.input.model.current=null;expect(moving.trigger.update(moving.input)).toEqual([]);
 const intermediate=holidaySetup();intermediate.input.model.current=points[1].name;intermediate.input.train.timetableIndex=1;intermediate.trigger.update(intermediate.input);intermediate.input.model.current=null;intermediate.input.train.speedKmh=50;expect(intermediate.tick()[0].ids).toEqual(['welcome']);
});
it('uses normal welcome off date, when seasonal disabled, or when the Christmas recording is absent',()=>{
 for(const mode of ['offdate','disabled','missing']){const s=holidaySetup(mode==='offdate'?'2026-12-25T10:00:00Z':undefined);if(mode==='disabled')s.input.options.seasonal=false;if(mode==='missing')s.input.availableServices=[];s.trigger.update(s.input);s.input.train.speedKmh=50;s.input.model.current=null;expect(s.tick()[0].ids).toEqual(['welcome']);}
});
it('farewell belongs to the last real PH, ignores timetable-only continuation, cancels when date or run changes',()=>{
 const s=holidaySetup();s.input.points.push({...s.input.points[2],index:3,name:'Outside map',line:0,pointId:'99998'});
 s.trigger.update(s.input);s.input.train.speedKmh=50;s.input.model.current=null;s.tick()[0].complete();
 s.input.train.timetableIndex=2;s.input.model.next=points[2].name;s.input.model.distanceToNextStopM=1500;
 const events=s.tick();expect(events.map(e=>e.ids)).toEqual([['christmas_farewell']]);expect(events[0].valid()).toBe(true);expect(s.tick()).toEqual([]);
 s.input.options.seasonal=false;s.tick();expect(events[0].valid()).toBe(false);
 const freight=holidaySetup();freight.input.freight=true;expect(freight.trigger.update(freight.input)).toEqual([]);
});
it('does not invent a last playable station without line and point metadata',()=>{
 const s=holidaySetup();s.input.points=points;s.trigger.update(s.input);s.input.train.speedKmh=50;s.input.model.current=null;s.tick();s.input.train.timetableIndex=2;s.input.model.next=points[2].name;s.input.model.distanceToNextStopM=500;
 expect(s.tick()).toEqual([]);
});
it('spaces journey information by fifteen minutes, defers near stations and never announces ticket inspection automatically',()=>{
 const s=holidaySetup('2026-11-27T10:00:00Z');s.trigger.update(s.input);s.input.train.speedKmh=50;s.input.model.current=null;s.tick()[0].complete();
 let events:ReturnType<AutomaticServices['update']>=[];
 for(let k=0;k<120;k++)events=s.tick();expect(events.map(e=>e.ids)).toEqual([['consideration']]);events[0].complete();
 s.input.model.distanceToNextStopM=500;for(let k=0;k<180;k++)expect(s.tick()).toEqual([]);
 s.input.model.distanceToNextStopM=10000;events=s.tick();expect(events.map(e=>e.ids)).toEqual([['assistance']]);events[0].complete();
 for(let k=0;k<400;k++)expect(s.tick().flatMap(e=>e.ids)).not.toContain('tickets');
});
it('skips missing journey files and cancels a queued message on stale data or proximity to a PH',()=>{
 const s=holidaySetup();s.input.availableServices=['consideration'];s.trigger.update(s.input);s.input.train.speedKmh=50;s.input.model.current=null;s.tick()[0].complete();let events:ReturnType<AutomaticServices['update']>=[];
 for(let k=0;k<120;k++)events=s.tick();expect(events[0].ids).toEqual(['consideration']);s.input.model.distanceToNextStopM=200;s.tick();expect(events[0].valid()).toBe(false);
 s.input.model.distanceToNextStopM=10000;s.input.model.connection='stale';s.tick();expect(events[0].valid()).toBe(false);
});
