import {create} from 'zustand';
import type {ShiftPlan} from '@/types/shift';
import type {Train} from '@/types/trains';
import type {OnboardModel} from '@/services/onboard';
import {normName} from '@/services/onboard';
const KEY='simrail:shift:v1';
type Progress={plan:ShiftPlan|null;cursor:number;phase:'ready'|'driving'|'break'|'done';arrivedAt:number|null;moved:boolean};
const empty:Progress={plan:null,cursor:0,phase:'ready',arrivedAt:null,moved:false};
function restore():Progress{try{const raw=localStorage.getItem(KEY);if(!raw||raw.length>50000)return empty;const p=JSON.parse(raw) as Progress;if(p.plan?.schema!==1||!Array.isArray(p.plan.legs)||p.plan.legs.length>12||!Number.isInteger(p.cursor)||p.cursor<0||p.cursor>=p.plan.legs.length||!['ready','driving','break','done'].includes(p.phase)||!p.plan.legs.every(l=>typeof l.number==='string'&&/^\d{1,12}$/.test(l.number)&&typeof l.from==='string'&&typeof l.to==='string'&&Number.isFinite(l.departure)&&Number.isFinite(l.arrival))||typeof p.plan.server!=='string'||!Number.isFinite(p.plan.request?.breakMinutes)||p.plan.request.breakMinutes<5||p.plan.request.breakMinutes>120||p.arrivedAt!==null&&!Number.isFinite(p.arrivedAt))return empty;return {...p,moved:false};}catch{return empty;}}
function save(p:Progress){try{localStorage.setItem(KEY,JSON.stringify(p));}catch{/* current session remains usable */}}
interface ShiftState extends Progress {setPlan:(p:ShiftPlan)=>void;clear:()=>void;take:()=>void;next:()=>void;observe:(t:Train,m:OnboardModel)=>void}
export const useShift=create<ShiftState>((set,get)=>{
 const apply=(patch:Partial<Progress>)=>{const s=get();const next={plan:s.plan,cursor:s.cursor,phase:s.phase,arrivedAt:s.arrivedAt,moved:s.moved,...patch};save(next);set(next);};
 return {...restore(),setPlan:plan=>apply({plan,cursor:0,phase:'ready',arrivedAt:null,moved:false}),clear:()=>apply(empty),take:()=>apply({phase:'driving',moved:false}),next:()=>{const s=get();if(!s.plan||s.phase!=='break'||!s.arrivedAt||Date.now()<s.arrivedAt+s.plan.request.breakMinutes*60000)return;apply({cursor:s.cursor+1,phase:'ready',arrivedAt:null,moved:false});},observe:(t,m)=>{
  const s=get(),leg=s.plan?.legs[s.cursor];if(!leg||s.phase!=='driving'||s.plan?.server!==t.serverCode||leg.number!==t.number||leg.runId&&leg.runId!==t.runId||m.connection!=='live')return;
  if(m.phase==='moving'&&!s.moved)apply({moved:true});
  if(s.moved&&m.phase==='standing'&&m.current&&normName(m.current)===normName(leg.to))apply({phase:s.cursor===s.plan!.legs.length-1?'done':'break',arrivedAt:Date.now(),moved:false});
 }};
});
