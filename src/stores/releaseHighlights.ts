import {create} from 'zustand';
export const useReleaseHighlights=create<{requested:boolean;open:()=>void;close:()=>void}>(set=>({requested:false,open:()=>set({requested:true}),close:()=>set({requested:false})}));
