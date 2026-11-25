import {create} from 'zustand';
import {readLibrary,observeJourney,type JourneyLibrary} from '@/services/journeyHistory';
import type {Train} from '@/types/trains';import type {OnboardModel} from '@/services/onboard';
const KEY='simrail:journeys:v1';
function load(){try{const data=readLibrary(localStorage.getItem(KEY));return {...data,journeys:data.journeys.map(r=>({...r,finished:true}))};}catch{return readLibrary(null);}}
function save(data:JourneyLibrary){try{localStorage.setItem(KEY,JSON.stringify(data));return true;}catch{return false;}}
interface Library {data:JourneyLibrary;persisted:boolean;toggle:(server:string,number:string)=>void;observe:(server:string,train:Train,m:OnboardModel)=>void;finish:()=>void;clear:()=>void}
export const useJourneyLibrary=create<Library>((set,get)=>({data:load(),persisted:true,
 toggle:(server,number)=>{if(!/^[\w-]{1,40}$/.test(server)||!/^\d{1,12}$/.test(number))return;const old=get().data,key=server+':'+number,data={...old,favorites:old.favorites.includes(key)?old.favorites.filter(x=>x!==key):[key,...old.favorites].slice(0,100)};set({data,persisted:save(data)});},
 observe:(server,train,m)=>{const old=get().data,journeys=observeJourney(old.journeys,server,train,m,Date.now());if(journeys===old.journeys)return;const data={...old,journeys};set({data,persisted:save(data)});},
 finish:()=>{const old=get().data;if(!old.journeys.some(r=>!r.finished))return;const data={...old,journeys:old.journeys.map(r=>r.finished?r:{...r,finished:true})};set({data,persisted:save(data)});},
 clear:()=>{const data={...get().data,journeys:[]};set({data,persisted:save(data)});}
}));
