import {it,expect} from 'vitest';import {detectTraffic,routeCandidateTrains,incidentTrains,followTraffic,TrafficMonitor,type TrafficAlert} from '../src/services/dispatcher';import type {Train} from '../src/types/trains';import type {TrainRoute} from '../src/types/route';
const train=(number:string,lon:number,speedKmh=10):Train=>({id:number,runId:'run-'+number,number,serverCode:'cz1',name:'R',type:'bot',startStation:'A',endStation:'B',lat:50,lon,speedKmh,timetableIndex:0,signalSpeedKmh:null,distanceToSignalM:null,inBorderArea:false});
const route=(t:Train,reverse=false):TrainRoute=>({trainNumber:t.number,runId:t.runId,sections:[{fromIndex:0,toIndex:1,coordinates:reverse?[[50,19.05],[50,19]]:[[50,19],[50,19.05]]}],stops:[{name:reverse?'B':'A',index:0,lat:50,lon:reverse?19.05:19,passengerStop:true},{name:reverse?'A':'B',index:1,lat:50,lon:reverse?19:19.05,passengerStop:true}],totalPoints:2,matchedPoints:2,missingSections:0,sourceDate:'2026-11-26',first:'A',last:'B'});
const own=train('1',19.005,100);
function input(others:Train[]){return {own,route:route(own),trains:others,routes:new Map(others.map(t=>[t.number,route(t)])),stations:[{name:'B',prefix:null,lat:50,lon:19.05}],rangeM:5000};}
it('detects an actually slower train ahead on a matching directed section, including AI and freight',()=>{const t={...train('2',19.025),name:'TME',vehicles:['412W/a']};expect(detectTraffic(input([t]))).toMatchObject({kind:'slow',trainIds:['2']});});
it('excludes the own train, behind, other server, parallel track, opposite route and unknown route',()=>{
 const t=train('2',19.025);for(const other of [own,train('2',19.001),{...t,serverCode:'pl1'},{...t,lat:50.001}])expect(detectTraffic(input([other]))).toBeNull();
 const reverse=input([t]);reverse.routes.set(t.number,route(t,true));expect(detectTraffic(reverse)).toBeNull();const unknown=input([t]);unknown.routes.clear();expect(detectTraffic(unknown)).toBeNull();
 const oldRun=input([t]);oldRun.routes.set(t.number,{...route(t),runId:'old'});expect(detectTraffic(oldRun)).toBeNull();
});
it('distinguishes a moving density from a confirmed group of stopped trains at a station',()=>{
 expect(detectTraffic(input([train('2',19.02),train('3',19.03),train('4',19.04)]))).toMatchObject({kind:'density',count:3});
 expect(detectTraffic(input([train('2',19.049,0),train('3',19.0495,0),train('4',19.05,0)]))).toMatchObject({kind:'station',count:3});
});
it('never stitches a gap, follows no beeline and requires a reliable own position/index',()=>{
 const t=train('2',19.035),i=input([t]);i.route.sections=[{fromIndex:0,toIndex:1,coordinates:[[50,19],[50,19.02]]},{fromIndex:2,toIndex:3,coordinates:[[50,19.025],[50,19.05]]}];expect(routeCandidateTrains(own,i.route,[t],5000)).toEqual([]);expect(detectTraffic(i)).toBeNull();
 expect(routeCandidateTrains({...own,timetableIndex:null},route(own),[t],5000)).toBeNull();expect(routeCandidateTrains({...own,lat:51},route(own),[t],5000)).toBeNull();
 const range=input([t]);range.rangeM=1000;expect(detectTraffic(range)).toBeNull();
});
const alert:TrafficAlert={key:'slow:2',kind:'slow',text:'Traffic',lat:50,lon:19.025,distanceM:1500,count:1,severity:1,trainIds:['2']};
it('requires 20 seconds and three fresh distinct samples; repeated cached payloads cannot confirm',()=>{
 const m=new TrafficMonitor();expect(m.update(alert,100000,100000,true).event).toBeNull();expect(m.update(alert,100000,105000,true).current).toBeNull();expect(m.update(alert,110000,110000,true).event).toBeNull();expect(m.update(alert,120000,120000,true).event).toEqual(alert);
});
it('repeats at most after five minutes, can escalate after one minute, and announces clear only after confirmation',()=>{
 const m=new TrafficMonitor();let events:TrafficAlert[]=[];for(let n=100000;n<=420000;n+=10000){const r=m.update(alert,n,n,true);if(r.event)events.push(r.event);}expect(events).toHaveLength(2);
 for(let n=430000;n<490000;n+=10000)expect(m.update(null,n,n,true).event).toBeNull();expect(m.update(null,490000,490000,true).event?.kind).toBe('clear');expect(m.update(null,500000,500000,true).event).toBeNull();
 const e=new TrafficMonitor();for(let n=100000;n<=170000;n+=10000)e.update(alert,n,n,true);expect(e.update({...alert,count:3,severity:2},180000,180000,true).event?.count).toBe(3);
});
it('stale data/reset never produces a reassuring cleared message',()=>{const m=new TrafficMonitor();for(let n=100000;n<=120000;n+=10000)m.update(alert,n,n,true);expect(m.update(null,120000,140000,false)).toMatchObject({current:{key:alert.key,state:'unverified'},event:null});for(let n=150000;n<210000;n+=10000)expect(m.update(null,n,n,true).event).toBeNull();m.reset();expect(m.current).toBeNull();});

it('does not call three separate sections a single congested interstation section',()=>{
 const base=route(own),coords=[19,19.02,19.04,19.06];const shaped={...base,stops:coords.map((lon,index)=>({name:String.fromCharCode(65+index),index,lat:50,lon,passengerStop:true})),sections:coords.slice(1).map((lon,i)=>({fromIndex:i,toIndex:i+1,coordinates:[[50,coords[i]],[50,lon]] as [number,number][]}))};
 const self={...own,lon:19.001},others=[train('2',19.01),{...train('3',19.03),timetableIndex:1},{...train('4',19.05),timetableIndex:2}];
 expect(detectTraffic({own:self,route:shaped,trains:others,routes:new Map(others.map(t=>[t.number,{...shaped,runId:t.runId,trainNumber:t.number}])),stations:[],rangeM:5000})?.kind).toBe('slow');
});

it('keeps a confirmed pulse until sixty seconds of consecutive fresh clear evidence, restarting after an outage',()=>{
 const m=new TrafficMonitor();for(let n=100000;n<=120000;n+=10000)m.update(alert,n,n,true);
 for(let n=130000;n<=170000;n+=10000)expect(m.update(null,n,n,true).current).toMatchObject({key:alert.key,state:'checking'});
 expect(m.update(null,170000,200000,false).current?.state).toBe('unverified');
 for(let n=210000;n<270000;n+=10000)expect(m.update(null,n,n,true).current?.key).toBe(alert.key);
 expect(m.update(null,270000,270000,true)).toMatchObject({current:null,event:{kind:'clear'}});
});
it('continues tracking the same slow train when the driver brakes, passes it or reduces the discovery radius',()=>{
 const other=train('2',19.025,10),initial=input([other]),detected=detectTraffic(initial)!;
 const slowOwn={...own,lon:19.03,speedKmh:0};const follow={...initial,own:slowOwn,rangeM:200};
 expect(detectTraffic(follow)).toBeNull();
 expect(incidentTrains(detected,[other],follow.route)).toEqual([other]);
 expect(followTraffic(follow,detected)).toMatchObject({key:detected.key,trainIds:['2']});
 expect(followTraffic({...follow,trains:[]},detected)).toBeUndefined();
 expect(followTraffic({...follow,trains:[{...other,runId:'new-run',speedKmh:80}]},{...detected,trainRuns:{'2':other.runId}})).toBeUndefined();
 expect(followTraffic({...follow,trains:[{...other,speedKmh:80}]},detected)).toBeNull();
});
it('only clears density or a station queue when verified train speeds or counts improve',()=>{
 const others=[train('2',19.049,0),train('3',19.0495,0),train('4',19.05,0)],i=input(others),detected=detectTraffic(i)!;
 expect(followTraffic({...i,own:{...own,speedKmh:0}},detected)).toMatchObject({kind:'station',count:3});
 expect(followTraffic({...i,trains:others.slice(0,2)},detected)).toBeUndefined();
 expect(followTraffic({...i,trains:others.map(t=>({...t,speedKmh:50,lon:19.06}))},detected)).toBeNull();
});

it('reports approaching only on verified route distance and applies verbosity cooldowns',()=>{
 for(const mode of ['brief','normal','detailed'] as const){
  const m=new TrafficMonitor();for(let n=100000;n<=120000;n+=10000)m.update({...alert,distanceM:4000,distanceBasis:'route'},n,n,true,mode);
  let event:TrafficAlert|null=null;for(let n=130000;n<=240000;n+=10000){const r=m.update({...alert,distanceM:n>=180000?1500:4000,distanceBasis:'route'},n,n,true,mode);if(r.event)event=r.event;}
  expect(event?.reason??null).toBe(mode==='brief'?null:'approaching');
 }
 const m=new TrafficMonitor();for(let n=100000;n<=250000;n+=10000)expect(m.update({...alert,distanceM:n<180000?4000:500,distanceBasis:'air'},n,n,true).event?.reason).not.toBe('approaching');
});
