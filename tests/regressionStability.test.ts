import {it,expect} from 'vitest';
import {SharedApiFetch,apiBodyLimit} from '../src/services/SharedApiFetch';
import {fetchJson} from '../src/adapters/simrailApi';
import {serverTimeToSod} from '../src/adapters/trainsApi';
import {DelayTracker,computeOnboard} from '../src/services/onboard';
import {DemoSim} from '../src/services/demoSim';
import {TrainTrackingService} from '../src/services/TrainTrackingService';

it('accepts a valid timetable above the old 20 MiB limit and keeps other responses bounded',async()=>{
 const body='[]'+' '.repeat(21*1024*1024),network=async()=>({ok:true,status:200,text:async()=>body});
 const url='https://api1.aws.simrail.eu:8082/api/getAllTimetables?serverCode=cz1';
 expect(await fetchJson(new SharedApiFetch(network).fetch,url)).toEqual([]);
 await expect(new SharedApiFetch(network).fetch('https://panel.simrail.eu:8084/trains-open')).rejects.toThrow(/velká/);
 expect(apiBodyLimit(url)).toBe(64*1024*1024);
});

it('server epoch clock stays aligned with timetable in winter, summer and over midnight',()=>{
 for(const date of ['2026-11-25T14:24:08Z','2026-07-01T14:24:08Z']){
   expect(serverTimeToSod(Date.parse(date))).toBe(14*3600+24*60+8);
   expect(serverTimeToSod(Date.parse(date)/1000)).toBe(14*3600+24*60+8);
 }
 expect(serverTimeToSod(Date.parse('2026-11-25T23:59:59Z'))).toBe(86399);
 expect(serverTimeToSod(Date.parse('2026-11-26T00:00:01Z'))).toBe(1);
});

const points=[0,1,2,3].map(index=>({index,pointId:null,km:null,platform:null,track:null,name:'Point '+index,arrival:'12:00:00',departure:'12:00:00',isStop:false,stopType:'NoStopOver',maxSpeed:null}));
it('first selection cannot claim that an upcoming point proves delay',()=>{
 const tracker=new DelayTracker();tracker.observe('a',1,13*3600,points);
 expect(tracker.current(points,1,13*3600)).toBeNull();
});
it('observes only consecutive passages, resets after jumps, clock loss, stale data and another run',()=>{
 const tracker=new DelayTracker(),time=12*3600+300;
 tracker.observe('a',0,time,points);tracker.observe('a',1,time+5,points);
 expect(tracker.current(points,1,time+5)).toEqual({min:5,kind:'observed'});
 tracker.observe('a',3,time+10,points);expect(tracker.current(points,3,time+10)).toBeNull();
 tracker.observe('a',2,time+15,points);tracker.observe('a',3,time+20,points);
 expect(tracker.current(points,3,time+20)?.min).toBe(5);
 tracker.observe('b',1,time+25,points);expect(tracker.current(points,1,time+25)).toBeNull();
 tracker.observe('b',2,null,points);tracker.observe('b',3,time+30,points);
 expect(tracker.current(points,3,time+30)).toBeNull();
});
it('does not clamp an invalid API index into the last station',()=>{
 const sim=new DemoSim(0).snapshot(0),tracker=new DelayTracker();
 const model=computeOnboard({...sim,train:{...sim.train,timetableIndex:99999},tracker,connection:'live'});
 expect(model.hasTimetable).toBe(false);expect(model.delayMin).toBeNull();
});
it('stale snapshots clear a previously observed delay',()=>{
 const sim=new DemoSim(0),tracker=new DelayTracker();
 for(let t=0;t<=200;t+=5){const snap=sim.snapshot(t);computeOnboard({...snap,tracker,connection:'live'});}
 const snap=sim.snapshot(205);
 expect(computeOnboard({...snap,tracker,connection:'stale'}).delayMin).toBeNull();
});
it('runId takes precedence over a duplicate train number and never silently picks another run',async()=>{
 const train={TrainNoLocal:'53',RunId:'correct',TrainData:{Latitude:50,Longitude:20,Velocity:40,VDDelayedTimetableIndex:0}};
 const tables=[{trainNoLocal:'53',runId:'wrong',timetable:[]},{trainNoLocal:'53',runId:'correct',timetable:[]}];
 const fetcher=async(url:string)=>({ok:true,status:200,text:async()=>JSON.stringify(url.includes('trains-open')?{data:[train]}:url.includes('Timetables')?tables:url.includes('getTime')?1795616648000:{data:[]})});
 const service=new TrainTrackingService(fetcher);
 const result=await service.getDetail('cz1','53');expect(result.ok&&result.data.timetable?.runId).toBe('correct');
 const missing=new TrainTrackingService(async(url:string)=>({ok:true,status:200,text:async()=>JSON.stringify(url.includes('trains-open')?{data:[train]}:url.includes('Timetables')?[tables[0]]:url.includes('getTime')?1795616648000:{data:[]})}));
 const next=await missing.getDetail('cz1','53');expect(next.ok&&next.data.timetable).toBeNull();
});

it('measures a passage through midnight without adding a day or a timezone',()=>{
 const route=points.map(p=>({...p,arrival:'23:59:00',departure:'23:59:00'}));
 const tracker=new DelayTracker();tracker.observe('night',0,86390,route);tracker.observe('night',1,60,route);
 expect(tracker.current(route,1,60)).toEqual({min:2,kind:'observed'});
});
