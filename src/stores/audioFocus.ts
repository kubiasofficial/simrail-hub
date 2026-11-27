import {create} from 'zustand';
export const useAudioFocus=create<{count:number}>(()=>({count:0}));
const holds=new Set<string>();
export function holdAudioFocus(key:string){holds.add(key);useAudioFocus.setState({count:holds.size});}
export function releaseAudioFocus(key:string){holds.delete(key);useAudioFocus.setState({count:holds.size});}
export function clearAudioFocus(){holds.clear();useAudioFocus.setState({count:0});}
export async function focusedAudio<T>(fn:()=>Promise<T>):Promise<T>{const key='preview:'+crypto.randomUUID();holdAudioFocus(key);try{return await fn();}finally{releaseAudioFocus(key);}}
