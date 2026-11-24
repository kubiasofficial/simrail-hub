import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {isFreightTrain} from '../src/services/trainPurpose';
import {AnnouncementTrigger} from '../src/services/announcements';
import {AnnouncementQueue} from '../src/services/announcementQueue';
import {DemoSim} from '../src/services/demoSim';

it('identifies freight consists and freight/service categories including light engines',()=>{
 expect(isFreightTrain({name:null,vehicles:['4E/EU07-005:R','412W/wagon']})).toBe(true);
 expect(isFreightTrain({name:'TME',vehicles:['4E/EU07-193:G','4E/EU07-096:G']})).toBe(true);
 expect(isFreightTrain({name:'ZNE',vehicles:['CD163/163_035-9:P']})).toBe(true);
 expect(isFreightTrain({name:'MPE – TLK',vehicles:['4E/EU07-005:R','11xa/111A']})).toBe(false);
 expect(isFreightTrain({name:'MOJ',vehicles:['EN57/EN57-612']})).toBe(false);
});
it('suppresses every passenger announcement on freight without changing passenger settings',()=>{
 const snap=new DemoSim(0).snapshot(0);const trigger=new AnnouncementTrigger();
 const input={runKey:'test',index:0,speedKmh:40,distToNextStopM:500,points:snap.timetable!.points,delayMin:15};
 expect(trigger.update({...input,isFreight:true}).events).toEqual([]);
 expect(trigger.update({...input,isFreight:false}).events.length).toBeGreaterThan(0);
});
it('stopping a bilingual announcement prevents its second language from starting',async()=>{
 const played:string[]=[];let finish!:()=>void;
 const queue=new AnnouncementQueue(async seg=>{played.push(seg.lang);await new Promise<void>(r=>{finish=r;});});
 queue.enqueue({key:'test',kind:'arrived',segments:[{lang:'cs',text:'A'},{lang:'pl',text:'B'}]});
 await Promise.resolve();queue.clear();finish();await new Promise(r=>setTimeout(r,0));expect(played).toEqual(['cs']);
});
it('allows synthesized WAV blob playback without weakening script restrictions',()=>{
 const html=readFileSync('src/renderer/index.html','utf8');
 expect(html).toContain("media-src 'self' blob:");expect(html).toContain("script-src 'self'");
});
