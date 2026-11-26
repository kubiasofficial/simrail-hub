import {create} from 'zustand';import type {TrafficAlert} from '@/services/dispatcher';
interface DispatchState {server:string|null;number:string|null;alert:TrafficAlert|null;candidateKey:string|null;status:string;updatedAt:number;lastMessage:string;set:(patch:Partial<Omit<DispatchState,'set'>>)=>void}
export const useDispatcherState=create<DispatchState>(set=>({server:null,number:null,alert:null,candidateKey:null,status:'Vypnuto',updatedAt:0,lastMessage:'',set:patch=>set(patch)}));
