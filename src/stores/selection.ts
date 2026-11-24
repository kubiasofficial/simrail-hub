import { create } from 'zustand';

interface SelectionState {
  mode: 'live' | 'demo';
  server: string | null;
  train: string | null;
  set: (p: Partial<Pick<SelectionState, 'mode' | 'server' | 'train'>>) => void;
}
const fromHash = (): Pick<SelectionState, 'mode' | 'server' | 'train'> => {
  const q = new URLSearchParams(location.hash.replace(/^#/, '').replace(/^[^&?]*[?]/, ''));
  let saved: {server?:string;train?:string}={};try{saved=JSON.parse(localStorage.getItem('simrail:selection:v1')??'{}')??{};}catch{/* corrupt storage */}
  return { mode: q.get('mode') === 'demo' ? 'demo' : 'live', server: q.get('server') ?? (typeof saved.server==='string'?saved.server:null), train: q.get('train') ?? (typeof saved.train==='string'?saved.train:null) };
};
export const useSelection = create<SelectionState>((set) => ({ ...fromHash(), set: (p) => set(current=>{const next={...current,...p};try{if(next.mode==='live')localStorage.setItem('simrail:selection:v1',JSON.stringify({server:next.server,train:next.train}));}catch{/* storage unavailable */}return p;}) }));
