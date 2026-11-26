import {nextStopTimes} from '../services/journeyPresentation';
import type {OnboardModel} from '../services/onboard';
export function JourneyTimes({model}:{model:OnboardModel}){
 const times=nextStopTimes(model);
 return <dl className="journey-stop-times" aria-label="Časy následující zastávky">{(['arrival','departure'] as const).map(kind=>{
  const value=times[kind],day=value.dayOffset>0?' +'+value.dayOffset+' den':value.dayOffset<0?' '+value.dayOffset+' den':'';
  return <div key={kind} className="journey-stop-time" data-estimated={value.estimated}>
   <dt>{kind==='arrival'?'Příjezd':'Odjezd'}</dt><dd><span className="journey-time-value" key={value.display+':'+value.estimated+':'+value.dayOffset}>{value.display??'—'}</span>{day&&<sup title="Posun dne oproti plánovanému času">{day}</sup>}<small>{value.plan?value.estimated?'odhad · plán '+value.plan:'plán':'údaj chybí'}</small></dd>
  </div>;
 })}</dl>;
}
