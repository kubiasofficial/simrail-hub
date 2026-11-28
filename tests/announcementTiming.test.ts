import {it,expect,vi,afterEach} from 'vitest';
import {AnnouncementQueue} from '../src/services/announcementQueue';
import {AnnouncementTrigger} from '../src/services/announcements';
import {DemoSim} from '../src/services/demoSim';
import {delaySeverity} from '../src/services/delayPresentation';
afterEach(()=>vi.useRealTimers());
it('spaces automatic announcements from the end, but manual commands bypass the gap',async()=>{
 vi.useFakeTimers();const played:string[]=[];
 const queue=new AnnouncementQueue(async s=>{played.push(s.text);},Date.now,undefined,{gapMs:()=>30000});
 queue.enqueue({key:'a',kind:'next-station',automatic:true,station:'A',segments:[{lang:'cs',text:'A'}]});
 await vi.advanceTimersByTimeAsync(0);
 queue.enqueue({key:'b',kind:'approaching',automatic:true,station:'B',segments:[{lang:'cs',text:'B'}]});
 await vi.advanceTimersByTimeAsync(29999);expect(played).toEqual(['A']);
 queue.enqueue({key:'manual',kind:'delay',segments:[{lang:'cs',text:'Manual'}]});await vi.advanceTimersByTimeAsync(0);
 expect(played).toEqual(['A','Manual']);await vi.advanceTimersByTimeAsync(29999);expect(played).toHaveLength(2);
 await vi.advanceTimersByTimeAsync(1);expect(played).toEqual(['A','Manual','B']);queue.clear();
});
it('arrival removes obsolete queued next-station and approaching messages',async()=>{
 vi.useFakeTimers();const played:string[]=[];const queue=new AnnouncementQueue(async s=>{played.push(s.text);},Date.now,undefined,{gapMs:()=>30000});
 queue.enqueue({key:'initial',kind:'delay',automatic:true,segments:[{lang:'cs',text:'initial'}]});await vi.advanceTimersByTimeAsync(0);
 queue.enqueue({key:'next',kind:'next-station',automatic:true,station:'B',segments:[{lang:'cs',text:'next'}]});
 queue.enqueue({key:'approach',kind:'approaching',automatic:true,station:'B',segments:[{lang:'cs',text:'approach'}]});
 queue.enqueue({key:'arrival',kind:'arrived',automatic:true,station:'B',segments:[{lang:'cs',text:'arrival'}]});
 await vi.advanceTimersByTimeAsync(30000);expect(played).toEqual(['initial','arrival']);queue.clear();
});
it('delay repeats after 15 minutes even when unchanged and resets when recovered',()=>{
 let now=0;const trigger=new AnnouncementTrigger(undefined,()=>now),sim=new DemoSim(0);
 const input={runKey:'run',index:1,speedKmh:60,distToNextStopM:9000,points:sim.timetable.points,delayMin:23};
 trigger.update(input);
 expect(trigger.update(input).events.map(x=>x.kind)).toEqual(['delay']);
 now=899999;expect(trigger.update({...input,delayMin:30}).events).toEqual([]);
 now=900000;expect(trigger.update(input).events.map(x=>x.kind)).toEqual(['delay']);
 trigger.update({...input,delayMin:0});expect(trigger.update({...input,delayMin:1}).events).toEqual([]);expect(trigger.update({...input,delayMin:4.99}).events).toEqual([]);expect(trigger.update({...input,delayMin:5}).events.map(x=>x.kind)).toEqual(['delay']);
});
it('selecting a train already approaching a station emits one relevant station event',()=>{
 const sim=new DemoSim(0),trigger=new AnnouncementTrigger();
 const input={runKey:'new',index:1,speedKmh:50,distToNextStopM:500,points:sim.timetable.points,delayMin:20};
 expect(trigger.update(input).events.map(x=>x.kind)).toEqual(['approaching']);
 expect(trigger.update({...input,speedKmh:0,distToNextStopM:100}).events.map(x=>x.kind)).toEqual(['arrived']);
 expect(trigger.update({...input,distToNextStopM:3000}).events.some(x=>x.kind==='next-station')).toBe(false);
});
it('critical delay starts strictly above 20 minutes',()=>{
 expect([null,-1,0,1,5,6,20,21].map(delaySeverity)).toEqual(['unknown','early','ontime','small','small','late','late','critical']);
});
