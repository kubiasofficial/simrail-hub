import {useEffect,useRef} from 'react';import {useSettings} from '@/stores/settings';import {useDispatcherState} from '@/stores/dispatcher';import {useAnnouncer} from '@/stores/announcer';import {TrafficMonitor,detectTraffic,routeCandidateTrains,incidentTrains,followTraffic} from '@/services/dispatcher';import type {Train,TrainDetailPayload} from '@/types/trains';import type {TrainRoute} from '@/types/route';import type {OnboardModel} from '@/services/onboard';
export function useDispatcher(server:string|null,detail:TrainDetailPayload|null,model:OnboardModel|null,trains:Train[],fetchedAt:number,route:TrainRoute|null,standalone:boolean,demo:boolean){
 const config=useSettings(s=>s.settings.dispatcher),monitor=useRef(new TrafficMonitor()),cache=useRef(new Map<string,TrainRoute>()),inFlight=useRef(new Map<string,Promise<TrainRoute|null>>());
 const context=server&&detail?.train&&!demo&&!standalone?server+':'+(detail.train.runId??detail.train.number):'';
 const version=useRef(0);
 useEffect(()=>{version.current++;monitor.current.reset();cache.current.clear();inFlight.current.clear();useAnnouncer.getState().discardRadio();if(!standalone)useDispatcherState.getState().set({server,number:context?detail?.train?.number??null:null,alert:null,candidateKey:null,lastMessage:'',updatedAt:0,status:config.enabled&&context?'Ověřuji trasu a provoz…':'Vypnuto'});return()=>{version.current++;if(!standalone){useAnnouncer.getState().discardRadio();useDispatcherState.getState().set({alert:null,updatedAt:0,status:'Vypnuto'});}};},[context,config.enabled]);
 useEffect(()=>{
  if(!context||!config.enabled||!server||!detail?.train||!model||standalone)return;
  let alive=true;const generation=version.current,own=detail.train;
  const set=(patch:Parameters<ReturnType<typeof useDispatcherState.getState>['set']>[0])=>{if(alive&&generation===version.current)useDispatcherState.getState().set(patch);};
  const unavailable=(status:string)=>{const result=monitor.current.update(null,fetchedAt,Date.now(),false);useAnnouncer.getState().discardRadio();set({alert:result.current,candidateKey:null,updatedAt:0,status});};
  async function run(){
   const fresh=model!.connection==='live'&&Date.now()-fetchedAt<15000&&Date.now()-detail!.fetchedAt<15000;
   if(!fresh||!route){unavailable(!fresh?'Čekám na aktuální provozní data.':'Chybí propojená trasa. Dispečer nehlásí.');return;}
   const discovered=routeCandidateTrains(own,route,trains,config.rangeKm*1000);
   const previous=monitor.current.current;
   const near=discovered&&[...new Map([...discovered,...(previous?incidentTrains(previous,trains,route):[])].filter(t=>t.number!==own.number&&t.serverCode===server).map(t=>[t.number,t])).values()];
   if(!near){unavailable('Polohu vlaku nelze spolehlivě přiřadit k trase.');return;}
   if(near.length>24){unavailable('Příliš mnoho neověřených jízd v okolí. Čekám na přesnější situaci.');return;}
   const keys=new Set(near.map(t=>server+':'+(t.runId??t.number)));for(const key of cache.current.keys())if(!keys.has(key))cache.current.delete(key);
   const missing=near.filter(t=>!cache.current.has(server+':'+(t.runId??t.number)));
   await Promise.all(missing.slice(0,3).map(t=>{const key=server+':'+(t.runId??t.number);let task=inFlight.current.get(key);if(!task){task=window.simrailHub!.call('trains:route',server!,t.number).then(r=>{if(generation!==version.current)return null;if(r.ok&&r.data.runId===t.runId){cache.current.set(key,r.data);return r.data;}return null;}).catch(()=>null).finally(()=>{if(generation===version.current)inFlight.current.delete(key);});inFlight.current.set(key,task);}return task;}));
   if(!alive||generation!==version.current)return;
   if(near.some(t=>!cache.current.has(server+':'+(t.runId??t.number)))){unavailable('Ověřuji směry okolních jízd…');return;}
   const routes=new Map(near.map(t=>[t.number,cache.current.get(server+':'+(t.runId??t.number))!]));
   const input={own,route,trains:near,routes,stations:detail!.stations,rangeM:config.rangeKm*1000};
   const candidate=previous?followTraffic(input,previous):detectTraffic(input);
   if(candidate===undefined){unavailable('Čekám na ověření dříve hlášené komplikace.');return;}
   if(candidate)candidate.trainRuns=Object.fromEntries(candidate.trainIds.map(id=>[id,near.find(t=>t.number===id)?.runId??null]));
   const valid=Date.now()-fetchedAt<15000&&Date.now()-detail!.fetchedAt<15000;
   const result=monitor.current.update(candidate,fetchedAt,Date.now(),valid);
   set({alert:result.current,candidateKey:candidate?.key??null,updatedAt:valid?Date.now():0,status:!valid?'Čekám na aktuální data.':result.current?.state==='checking'?'Ověřuji uklidnění situace…':result.current?'Potvrzená provozní informace':candidate?'Situaci ověřuji několika vzorky…':'V dostupných datech není potvrzené zdržení.'});
   useAnnouncer.getState().reconcileRadio();
   if(result.event){const event=result.event;set({lastMessage:event.text});if(config.audio)useAnnouncer.getState().radio(context+':radio:'+Date.now(),'Vlak '+own.number+', informace dispečera. '+event.text,()=>{const state=useDispatcherState.getState(),settings=useSettings.getState().settings.dispatcher;return settings.enabled&&settings.audio&&state.server===server&&state.number===own.number&&Date.now()-state.updatedAt<15000&&(event.kind==='clear'?!state.alert&&!state.candidateKey:state.alert?.key===event.key&&state.alert.state==='active');});}
  }
  void run();return()=>{alive=false;};
 },[context,config.enabled,config.audio,config.rangeKm,detail,model,trains,fetchedAt,route]);
}
