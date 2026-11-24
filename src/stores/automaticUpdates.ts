import {create} from 'zustand';
import type {AutomaticUpdateState} from '@/services/AutomaticUpdates';
interface State {state:AutomaticUpdateState|null;refresh:()=>Promise<void>;check:()=>Promise<void>;install:()=>Promise<void>}
export const useAutomaticUpdates=create<State>((set,get)=>({
 state:null,
 refresh:async()=>{try{const state=await window.simrailHub!.call('update:status');if(JSON.stringify(state)!==JSON.stringify(get().state))set({state});}catch{/* next poll retries */}},
 check:async()=>{try{set({state:await window.simrailHub!.call('update:auto-check')});}catch{set({state:{status:'error',message:'Kontrola aktualizace se nezdařila.'}});}},
 install:async()=>{try{const ok=await window.simrailHub!.call('update:install');if(!ok)set({state:{status:'error',message:'Aktualizace zatím není připravena.'}});}catch{set({state:{status:'error',message:'Instalaci se nepodařilo spustit.'}});}}
}));
