import {useEffect,useRef,useState} from 'react';
import type {Train} from '@/types/trains';import type {TrainRoute} from '@/types/route';
export function useOnboardRoute(server:string|null,train:Train|null,live:boolean){
 const key=server&&train&&live?server+':'+(train.runId??train.number):'';
 const [state,setState]=useState<{key:string;route:TrainRoute|null;error:string}>({key:'',route:null,error:''});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{if(!key||!server||!train)return;let alive=true;setState({key,route:null,error:''});void window.simrailHub!.call('trains:route',server,train.number).then(r=>{if(alive)setState({key,route:r.ok?r.data:null,error:r.ok?'':r.error});}).catch(()=>{if(alive)setState({key,route:null,error:'Traťová data nejsou dostupná.'});});return()=>{alive=false;};},[key,retry]);
 const attempts=useRef(0);useEffect(()=>{attempts.current=0;},[key]);
 useEffect(()=>{if(!key||state.key!==key||!state.error||attempts.current>=2)return;const timer=setTimeout(()=>{attempts.current++;setRetry(v=>v+1);},30000);return()=>clearTimeout(timer);},[key,state]);
 return {route:state.key===key?state.route:null,error:state.key===key?state.error:'',loading:!!key&&(state.key!==key||!state.route&&!state.error)};
}
