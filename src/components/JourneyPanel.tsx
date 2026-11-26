import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {OnboardModel} from '../services/onboard';
import {journeyDelay,journeyMotion} from '../services/journeyPresentation';
import {trainCategory} from '../services/trainCategory';
import {JourneyTimes} from './JourneyTimes';
import type {Train} from '../types/trains';
export function JourneyPanel({model:m,train,updatedAt,active=true}:{model:OnboardModel;train:Train|null;updatedAt:number|null;active?:boolean}){
 const category=trainCategory(train??{name:null}),delay=journeyDelay(m),motion=journeyMotion(m);
 const fresh=m.connection==='live'||m.connection==='demo',distance=m.distanceToFollowingStopM;
 const distanceLabel=distance===null?null:distance>=1000?(distance/1000).toLocaleString('cs',{maximumFractionDigits:1,minimumFractionDigits:1})+' km':Math.round(distance)+' m';
 const near=!!m.next&&fresh&&m.phase==='moving'&&distance!==null&&distance>=0&&distance<=1000;
 const markerLocation=!fresh?null:m.current?'current':m.next?'next':null;
 const rows=useRef<HTMLDivElement>(null),current=useRef<HTMLDivElement>(null),next=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const container=rows.current,target=markerLocation==='current'?current.current:markerLocation==='next'?next.current:null;
  if(!active||!container||!target)return;
  const measure=()=>{const label=target.querySelector(':scope > span')??target;const box=label.getBoundingClientRect();container.style.setProperty('--journey-active-y',(box.top+box.height/2-container.getBoundingClientRect().top)+'px');};measure();
  const observer=new ResizeObserver(measure);observer.observe(container);return()=>observer.disconnect();
 },[active,markerLocation,m.current,m.next]);
 const run=train?(train.serverCode+':'+(train.runId??train.number)):m.trainNumber;
 const previousDelay=useRef({run,value:m.delayMin,observed:delay.observed}),[worsening,setWorsening]=useState(false);
 useEffect(()=>{
  const previous=previousDelay.current;previousDelay.current={run,value:m.delayMin,observed:delay.observed};
  const worse=active&&previous.run===run&&previous.observed&&delay.observed&&m.delayMin!==null&&previous.value!==null&&m.delayMin>previous.value;
  setWorsening(worse);if(!worse)return;const timer=setTimeout(()=>setWorsening(false),1000);return()=>clearTimeout(timer);
 },[run,m.delayMin,delay.observed,active]);
 return <div className="journey-station-panel journey-panel-v2 journey-panel-v3" data-near={near} data-motion={motion.key} data-severity={delay.severity} data-animate={active}>
  <div className="journey-panel-heading"><span>TVÁ JÍZDA</span>{category.label&&<span className="train-category-chip" style={{borderColor:category.color}}>{category.label}</span>}<span className="journey-train-number">{m.trainNumber}</span></div>
  <div className="journey-stations" ref={rows}>
   {markerLocation&&<span className="journey-active-marker" data-location={markerLocation} aria-hidden="true"/>}
   <div className="previous-station"><span>Předchozí</span><strong key={'previous:'+m.previous}>{m.previous??'Začátek trasy'}</strong></div>
   <div ref={current} className={'current-station'+(m.current&&fresh?' at-station':'')}><span>Aktuální</span><div className="journey-motion" key={motion.key+':'+m.current}><strong>{motion.label}</strong><small>{motion.caption}</small></div></div>
   <div ref={next} className="next-station"><span>Následující</span><div className="journey-next-content"><div className="journey-next-destination"><strong key={'next:'+m.next}>{m.next??(m.current?'Konečná stanice':'Další zastávka není známá')}</strong>{m.next&&distanceLabel&&<small>Do zastávky přibližně <b>{distanceLabel}</b><span> · vzdušně</span></small>}</div>{m.next&&<JourneyTimes model={m}/>}</div></div>
  </div>
  <div className="journey-metrics"><div className="journey-speed"><span>Rychlost</span><div><strong key={m.speedKmh===null?'unknown':Math.round(m.speedKmh)}>{m.speedKmh===null?'—':Math.round(m.speedKmh)}</strong><span>km/h</span></div></div>
   <div className={'delay-indicator'+(worsening?' delay-worsening':'')} data-severity={delay.severity} data-source={m.delayKind??'unknown'} role="status" aria-label="Zpoždění vlaku" aria-atomic="true">
    <span>{delay.observed?'Zpoždění · odhad':'Zpoždění'}</span><strong key={delay.label} className={delay.observed&&m.delayMin!==0?'delay-number':''}>{delay.label}</strong><small>{delay.severity==='critical'?'Výrazné zpoždění · ':''}{delay.caption}</small>
   </div></div>
  <small className="journey-updated">{updatedAt?'Poslední data '+new Date(updatedAt).toLocaleTimeString('cs-CZ'):'Čekám na data'}</small>
 </div>;
}
