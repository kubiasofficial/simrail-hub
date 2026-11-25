import {describe,it,expect} from 'vitest';
import {parseTimetables} from '../src/adapters/trainsApi';
import {computeOnboard,DelayTracker} from '../src/services/onboard';
import {AnnouncementTrigger} from '../src/services/announcements';
import {isPassengerStop} from '../src/services/passengerStops';
import {DemoSim} from '../src/services/demoSim';
import {recordingNames} from '../src/services/localAudio';

describe('PH passenger announcements',()=>{
 it('requires explicit CommercialStop/PH, excluding technical, passing and unknown points',()=>{
  expect(['CommercialStop','PH','NoncommercialStop','NoStopOver',null,'Unknown'].map(stopType=>isPassengerStop({stopType}))).toEqual([true,true,false,false,false,false]);
 });
 it('53103 skips Batowice technical stop and announces Glowny using existing recording',()=>{
  const timetable=parseTimetables([{trainNoLocal:'53103',timetable:[
   {nameOfPoint:'Miechów',stopType:'CommercialStop'},
   {nameOfPoint:'Kraków Batowice',stopType:'NoncommercialStop'},
   {nameOfPoint:'Unknown point'},
   {nameOfPoint:'Kraków Przedmieście',stopType:'NoStopOver'},
   {nameOfPoint:'Kraków Główny',stopType:'CommercialStop'},
   {nameOfPoint:'Passing exit',stopType:'NoStopOver'}
  ]}])[0];
  const train={...new DemoSim(0).snapshot(0).train,number:'53103',timetableIndex:1,speedKmh:100};
  const model=computeOnboard({train,timetable,stations:[],nowSod:null,tracker:new DelayTracker(),connection:'live'});
  expect(model.next).toBe('Kraków Główny');expect(model.previous).toBe('Miechów');
  expect(model.rows[1]).toMatchObject({isStop:true,passengerStop:false});
  const events=new AnnouncementTrigger().update({runKey:'53103',index:1,speedKmh:100,distToNextStopM:null,points:timetable.points,delayMin:null}).events;
  expect(events).toEqual([{key:'next:4',kind:'next-station',station:'Kraków Główny'}]);
  expect(recordingNames({...events[0],trainNumber:'53103',isFreight:false})).toEqual(['pristi_stanice.wav','krakow_glowny.wav']);
 });
});

it('35104 uses its own northbound PH order and the existing Miechow recording',()=>{
 const timetable=parseTimetables([{trainNoLocal:'35104',timetable:[
 {nameOfPoint:'Kraków Główny',stopType:'CommercialStop'},
 {nameOfPoint:'Kraków Batowice',stopType:'NoncommercialStop'},
 {nameOfPoint:'Miechów',stopType:'CommercialStop'},
 {nameOfPoint:'Kozłów',stopType:'CommercialStop'}]}])[0];
 const train={...new DemoSim(0).snapshot(0).train,number:'35104',timetableIndex:1,speedKmh:100};
 const model=computeOnboard({train,timetable,stations:[],nowSod:null,tracker:new DelayTracker(),connection:'live'});
 expect(model.next).toBe('Miechów');expect(model.previous).toBe('Kraków Główny');
 const events=new AnnouncementTrigger().update({runKey:'35104',index:1,speedKmh:100,distToNextStopM:null,points:timetable.points,delayMin:null}).events;
 expect(events).toEqual([{key:'next:2',kind:'next-station',station:'Miechów'}]);
 expect(recordingNames({...events[0],trainNumber:'35104',isFreight:false})).toEqual(['pristi_stanice.wav','miechow.wav']);
});
