import {it,expect} from 'vitest';
import {buildShift} from '../src/services/shiftPlanner';
import {normalizeSettings,applyPatch} from '../src/services/settingsSchema';
import type {Timetable,Train} from '../src/types/trains';
const stop=(name:string,index:number,arrival:string,departure=arrival)=>({name,index,pointId:null,arrival,departure,isStop:true,stopType:'CommercialStop',maxSpeed:100,km:index,platform:null,track:null});
const a:Timetable={runId:'a',trainNumber:'16105',startStation:'A',endStation:'B',vehicleType:'EU07',category:'MPE',continuesAs:'61180',points:[stop('A',0,'10:05'),stop('B',1,'10:30')]};
const b:Timetable={runId:'b',trainNumber:'61180',startStation:'B',endStation:'A',vehicleType:'EU07',category:'MPE',points:[stop('B',0,'11:00'),stop('A',1,'11:30')]};
const stations=['A','B'].map((name,i)=>({name,lat:50+i,lon:20,prefix:null}));
const req={transport:'passenger' as const,origin:'A',endSod:12*3600,breakMinutes:30,ownedDlc:[]};
it('chains real trains in the same station, respects a break and explicit continuesAs',()=>{const p=buildShift('cz1',req,[a,b],stations,[],10*3600);expect(p.legs.map(l=>l.number)).toEqual(['16105','61180']);expect(p.legs[1].sameConsist).toBe(true);expect(p.legs[1].availability).toBe('future');});
it('rejects occupied, already passed, unknown vehicle and missing-DLC trains',()=>{
 const live={runId:'a',number:a.trainNumber,type:'user',timetableIndex:0} as Train;
 expect(buildShift('cz1',req,[a],stations,[live],36000).legs).toEqual([]);
 expect(buildShift('cz1',req,[a],stations,[{...live,type:'bot',timetableIndex:1}],36000).legs).toEqual([]);
 expect(buildShift('cz1',req,[{...a,vehicleType:''}],stations,[],36000).legs).toEqual([]);
 expect(buildShift('cz1',req,[{...a,vehicleType:'BR285'}],stations,[],36000).legs).toEqual([]);
 expect(buildShift('cz1',{...req,ownedDlc:[5240850]},[{...a,vehicleType:'BR285'}],stations,[],36000).legs).toHaveLength(1);
});
it('never invents a transfer, end outside known stations, or time beyond shift',()=>{
 expect(buildShift('cz1',req,[a,{...b,points:[stop('C',0,'11:00'),stop('A',1,'11:30')]}],stations,[],36000).legs).toHaveLength(1);
 expect(buildShift('cz1',req,[a],stations.slice(0,1),[],36000).legs).toHaveLength(0);
 expect(buildShift('cz1',{...req,endSod:10*3600+1200},[a],stations,[],36000).legs).toHaveLength(0);
});
it('handles midnight and rejects excessive span or zero length shift',()=>{
 const x={...a,points:[stop('A',0,'23:50'),stop('B',1,'00:20')]};
 expect(buildShift('cz1',{...req,endSod:3600},[x],stations,[],23*3600+40*60).legs[0].arrival).toBe(86400+1200);
 expect(()=>buildShift('cz1',{...req,endSod:36000},[a],stations,[],36000)).toThrow();
});
it('separates freight and passenger planning and stores DLC arrays without object merging',()=>{
 expect(buildShift('cz1',{...req,transport:'freight'},[a],stations,[],36000).legs).toEqual([]);
 expect(buildShift('cz1',{...req,transport:'freight'},[{...a,category:'TME'}],stations,[],36000).legs).toHaveLength(1);
 expect(applyPatch(normalizeSettings({ownedDlc:[1,2]}),{ownedDlc:[3]}).ownedDlc).toEqual([3]);
});

it('respects the remaining observed break when replanning from a confirmed destination',()=>{expect(buildShift('cz1',{...req,startDelayMinutes:30},[a],stations,[],36000).legs).toEqual([]);expect(buildShift('cz1',req,[{...a,vehicleType:'Unknown future locomotive'}],stations,[],36000).legs).toEqual([]);});
