import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {STATION_RECORDINGS} from '../src/services/stationRecordings';
import {LocalRecordings,recordingNames,decodeWav} from '../src/services/localAudio';
import {AnnouncementTrigger} from '../src/services/announcements';
it('resolves every station on arbitrary passenger train numbers, while keeping freight silent',async()=>{
 const manifest=JSON.parse(await readFile('assets/recordings/manifest.json','utf8')),files=new Set(manifest.files.map((e:{file:string})=>e.file));
 expect(Object.keys(STATION_RECORDINGS)).toHaveLength(156);
 expect(new Set(Object.values(STATION_RECORDINGS)).size).toBe(156);
 const phrase={'next-station':'pristi_stanice',approaching:'prijizdime_do_stanice',arrived:'stanice'} as const;
 for(const [station,file] of Object.entries(STATION_RECORDINGS)){
  expect(files.has(file+'.wav')).toBe(true);
  for(const trainNumber of ['1935','32960','61105','999001'])for(const kind of Object.keys(phrase) as (keyof typeof phrase)[]){
   expect(recordingNames({kind,station,trainNumber,isFreight:false})).toEqual([phrase[kind]+'.wav',file+'.wav']);
   expect(recordingNames({kind,station,trainNumber,isFreight:true})).toBeNull();
  }
 }
 const service=new LocalRecordings('missing-private-folder','assets/recordings');
 for(const station of Object.keys(STATION_RECORDINGS)){
  const bytes=await service.render({kind:'arrived',station,trainNumber:'32960',isFreight:false},false);
  expect(bytes).not.toBeNull();expect(decodeWav(bytes!).length).toBeGreaterThan(4800);
 }
});
it('prepares all nine confirmed Lublin names without enabling or packaging them for current services',async()=>{
 const upcoming=JSON.parse(await readFile('assets/upcoming-recordings/lublin-region/manifest.json','utf8'));
 expect(upcoming.files).toHaveLength(9);expect(upcoming.automaticPlayback).toBe(false);
 const bundled=JSON.parse(await readFile('assets/recordings/manifest.json','utf8'));
 for(const clip of upcoming.files){
  expect(recordingNames({kind:'arrived',station:clip.station,trainNumber:'53103',isFreight:false})).toBeNull();
  expect(bundled.files.some((e:{file:string})=>e.file===clip.file)).toBe(false);
  expect(decodeWav(await readFile(join('assets/upcoming-recordings/lublin-region',clip.file))).length).toBeGreaterThan(4800);
 }
});
it('a newly recorded name never turns a transit or technical point into a passenger announcement',()=>{
 const point={index:0,name:'Sędziszów',pointId:'1',arrival:'12:00',departure:'12:01',isStop:true,maxSpeed:120,km:1,platform:null,track:null};
 for(const stopType of ['NoStopOver','TechnicalStop']){
  const result=new AnnouncementTrigger().update({runKey:stopType,index:0,speedKmh:30,distToNextStopM:100,points:[{...point,stopType}],delayMin:null});
  expect(result.events).toEqual([]);
 }
});
