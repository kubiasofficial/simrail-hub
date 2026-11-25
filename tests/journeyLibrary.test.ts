import {it,expect} from 'vitest';
import {observeJourney,readLibrary} from '../src/services/journeyHistory';
import {filterTrains,EMPTY_FILTER} from '../src/services/trainFilters';
import {computeOnboard,DelayTracker} from '../src/services/onboard';import {DemoSim} from '../src/services/demoSim';
function fixture(){const s=new DemoSim(0).snapshot(0);const m=computeOnboard({...s,nowSod:s.nowSod,tracker:new DelayTracker(),connection:'live'});return {...s,m};}
it('records only live watched runs, throttles unchanged samples and marks previous watches finished',()=>{
 const {train,m}=fixture();let list=observeJourney([],'cz1',train,m,100000);
 expect(list).toHaveLength(1);expect(list[0].delayMin).toBeNull();expect(list[0].passages).toEqual([]);
 expect(observeJourney(list,'cz1',train,m,110000)).toBe(list);
 expect(observeJourney(list,'cz1',train,{...m,connection:'stale'},180000)).toBe(list);
 list=observeJourney(list,'cz1',{...train,number:'35104'},m,180000);expect(list).toHaveLength(2);expect(list[1].finished).toBe(true);
});
it('stores only observed consecutive PH passages and bounds local history',()=>{
 const {train,m}=fixture(),t={...train,timetableIndex:0};const initial=observeJourney([],'cz1',t,m,100000);
 const model={...m,delayKind:'observed' as const,delayMin:4,rows:[{...m.rows[0],index:0,passengerStop:true,name:'PH'},{...m.rows[0],index:1,passengerStop:false,name:'PT'}]};
 const next=observeJourney(initial,'cz1',{...t,timetableIndex:1},model,110000);expect(next[0].passages).toEqual([{index:0,name:'PH',at:110000,delayMin:4}]);
 const afterPT=observeJourney(next,'cz1',{...t,timetableIndex:2},model,120000);expect(afterPT[0].passages).toHaveLength(1);
 let list=afterPT;for(let i=0;i<120;i++)list=observeJourney(list,'cz1',{...t,runId:'run'+i},model,130000+i);expect(list).toHaveLength(100);
 expect(readLibrary(JSON.stringify({version:1,favorites:['cz1:35104','../evil:1'],journeys:list})).favorites).toEqual(['cz1:35104']);
 expect(readLibrary('{broken').journeys).toEqual([]);expect(readLibrary(JSON.stringify({version:1,favorites:[],journeys:[{id:'bad'}]})).journeys).toEqual([]);
});
it('combines category, actual driver, endpoints and server-specific favorites',()=>{
 const {train}=fixture();const a={...train,number:'35104',name:'TLK',type:'user' as const,startStation:'Kraków Główny',endStation:'Gdynia Główna'},b={...a,number:'53103',type:'bot' as const,startStation:'Gdynia',endStation:'Kraków'};
 expect(filterTrains([a,b],{...EMPTY_FILTER,driver:'user',category:'TLK',origin:'krakow',destination:'gdynia',favoritesOnly:true},'cz1',['cz1:35104'])).toEqual([a]);
 expect(filterTrains([a,b],{...EMPTY_FILTER,favoritesOnly:true},'pl1',['cz1:35104'])).toEqual([]);
});
