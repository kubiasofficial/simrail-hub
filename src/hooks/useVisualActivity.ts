import {useEffect,useState} from 'react';
/** Visual work pauses independently of polling, audio and the mobile server. */
export function useVisualActivity(){
 const [active,setActive]=useState(true);
 useEffect(()=>{let alive=true;const api=window.simrailHub!;void api.getWindowState().then(s=>{if(alive)setActive(!s.minimized);}).catch(()=>undefined);
  const off=api.onWindowStateChanged(s=>setActive(!s.minimized));return()=>{alive=false;off();};
 },[]);useEffect(()=>{document.documentElement.dataset.windowActive=active?'true':'false';},[active]);return active;
}
