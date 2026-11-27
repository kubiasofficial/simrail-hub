import {create} from 'zustand';
import type {DrivingStatus,DriveStartRequest} from '@/types/driving';
import type {Res} from '@/types/ipc';
import type {ShiftPlan} from '@/types/shift';
export interface DriveObservation {server:string;number:string;runId:string|null;station:string|null;previous:string|null;next:string|null;delay:number|null;at:number}
interface State {data:DrivingStatus|null;error:string;start:DriveStartRequest|null;endOpen:boolean;shiftStart:ShiftPlan|null;shiftEnd:boolean;clearShift:boolean;deliveriesOpen:boolean;observation:DriveObservation|null;afterEnd:(()=>void)|null;
 refresh:()=>Promise<void>;accept:(r:Res<DrivingStatus>)=>DrivingStatus;openStart:(q:DriveStartRequest)=>void;openEnd:(after?:()=>void)=>void;observe:(o:DriveObservation)=>void;}
export const useDriving=create<State>((set,get)=>({data:null,error:'',start:null,endOpen:false,shiftStart:null,shiftEnd:false,clearShift:false,deliveriesOpen:false,observation:null,afterEnd:null,
 accept:r=>{if(!r.ok)throw Error(r.error);const old=get().data;if(!old||r.data.revision>=old.revision)set({data:r.data,error:'',...(old?.drive?.id!==r.data.drive?.id?{observation:null}:{})});return r.data;},
 refresh:async()=>{try{get().accept(await window.simrailHub!.call('driving:status'));}catch(e){set({error:(e as Error).message});}},openStart:start=>set({start}),openEnd:after=>set({endOpen:true,afterEnd:after??null}),observe:observation=>{const drive=get().data?.drive;if(drive?.server===observation.server&&drive.number===observation.number&&(!drive.runId||drive.runId===observation.runId))set({observation});}
}));
