import {it,expect} from 'vitest';
import {PASSENGER_STATION_LOCATIONS} from '../src/services/passengerStationLocations';
import {computeOnboard,DelayTracker,findStation} from '../src/services/onboard';
import {AnnouncementTrigger} from '../src/services/announcements';
import {recordingNames} from '../src/services/localAudio';
import {haversineM} from '../src/services/geo';
import type {Train,TimetablePoint,StationCoord} from '../src/types/trains';
const apiStations:StationCoord[]=[
 {name:'Katowice',prefix:'KO',lat:50.25686264038086,lon:19.01921844482422},
 {name:'Sosnowiec Główny',prefix:'SG',lat:50.27600860595703,lon:19.120859146118164},
 {name:'Sosnowiec Południowy',prefix:'Spł1',lat:50.27341079711914,lon:19.121028900146484}
];
const reference=[{name:'Katowice',lat:50.2576071,lon:19.0171456},...PASSENGER_STATION_LOCATIONS];
const point=(name:string,index:number,ph=true):TimetablePoint=>({name,index,pointId:String(100+index),line:1,arrival:'12:00',departure:'12:02',isStop:ph,stopType:ph?'PH':'NoStopOver',km:index,maxSpeed:100,platform:null,track:null});
const base:Train={id:'qa',runId:'qa',number:'23901',serverCode:'cz1',name:'R',type:'bot',startStation:null,endStation:null,lat:0,lon:0,speedKmh:0,timetableIndex:1,signalSpeedKmh:null,distanceToSignalM:null,inBorderArea:false};
it('uses verified passenger reference points without moving live dispatcher markers or confusing the two Sosnowiec stations',()=>{
 for(const s of PASSENGER_STATION_LOCATIONS){const original=apiStations.find(p=>p.name===s.name)!;expect(haversineM(original.lat,original.lon,s.lat,s.lon)).toBeGreaterThan(300);expect(findStation(s.name,apiStations)).toMatchObject({lat:s.lat,lon:s.lon,prefix:original.prefix});expect(apiStations.find(p=>p.name===s.name)).toEqual(original);}
 expect(findStation('Sosnowiec Glowny',apiStations)?.lat).toBe(PASSENGER_STATION_LOCATIONS[0].lat);
 expect(findStation('Sosnowiec Poludniowy',apiStations)?.lat).toBe(PASSENGER_STATION_LOCATIONS[1].lat);
});
it('announces Katowice and both Sosnowiec PH stops in both directions, including an API index advanced during dwell',()=>{
 for(const order of [reference,[...reference].reverse()]){
  const points=[point('Origin outside',0,false),...order.flatMap((s,n)=>[point(s.name,n*2+1),point('Technical after '+s.name,n*2+2,false)])];
  for(const station of order){const index=points.findIndex(p=>p.name===station.name),trigger=new AnnouncementTrigger(),tracker=new DelayTracker();
   const train={...base,timetableIndex:index,lat:station.lat+.012,lon:station.lon,speedKmh:60};
   const model=()=>computeOnboard({train,timetable:{trainNumber:train.number,runId:'qa',startStation:null,endStation:null,points},stations:apiStations,nowSod:43200,tracker,connection:'live'});
   const update=()=>{const m=model();return trigger.update({runKey:'qa',index:m.rows.find(r=>r.standing)?.index??train.timetableIndex,speedKmh:train.speedKmh,distToNextStopM:m.current?(m.distanceToCurrentStopM??m.distanceToNextStopM):m.distanceToNextStopM,points,delayMin:null});};
   expect(update().events.map(e=>e.kind)).toEqual(['approaching']);
   train.lat=station.lat;train.speedKmh=0;train.timetableIndex=index+1;
   expect(model().current).toBe(station.name);const events=update().events;expect(events.map(e=>e.kind)).toEqual(['arrived']);expect(events[0].station).toBe(station.name);expect(update().events).toEqual([]);
   expect(recordingNames({kind:'arrived',station:station.name,trainNumber:'23901',isFreight:false})?.[1]).toBe(station.name==='Katowice'?'katowice.wav':station.name==='Sosnowiec Główny'?'sosnowiec_glowny.wav':'sosnowiec_poludniowy.wav');
  }
 }
});
it('does not turn a noncommercial stop or a nearby unrelated station into a passenger arrival',()=>{
 const points=[point('Outside',0,false),{...point('Katowice',1),stopType:'NoncommercialStop'},point('Other PH',2)];
 const train={...base,lat:apiStations[0].lat,lon:apiStations[0].lon,timetableIndex:2};
 const m=computeOnboard({train,timetable:{trainNumber:train.number,runId:'qa',startStation:null,endStation:null,points},stations:apiStations,nowSod:43200,tracker:new DelayTracker(),connection:'live'});
 expect(m.current).toBeNull();expect(m.distanceToNextStopM).toBeNull();
});
