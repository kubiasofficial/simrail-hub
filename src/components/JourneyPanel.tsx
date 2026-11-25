import type {OnboardModel} from '../services/onboard';
import {delaySeverity} from '../services/delayPresentation';
import {trainCategory} from '../services/trainCategory';
import type {Train} from '../types/trains';
export function JourneyPanel({model:m,train,updatedAt}:{model:OnboardModel;train:Train|null;updatedAt:number|null}){
 const category=trainCategory(train??{name:null});
 const estimate=m.delayKind==='estimate',severity=estimate?'unknown':delaySeverity(m.delayMin);
 const delay=m.delayMin===null?'Nelze určit':estimate?(m.delayMin>0?'≥ +'+m.delayMin+' min':'Zatím bez zpoždění'):m.delayMin===0?'Podle jízdního řádu':(m.delayMin>0?'+':'−')+Math.abs(m.delayMin)+' min';
 const distance=m.distanceToFollowingStopM;
 const distanceLabel=distance===null?null:distance>=1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m';
 return <div className="journey-station-panel journey-panel-v2">
 <div className="journey-panel-heading"><span>TVÁ JÍZDA</span>{category.label&&<span className="train-category-chip" style={{borderColor:category.color}}>{category.label}</span>}<span className="journey-train-number">{m.trainNumber}</span></div>
 <div className="journey-stations">
 <div className="previous-station"><span>Předchozí</span><strong key={'previous:'+m.previous}>{m.previous??'Začátek trasy'}</strong></div>
 <div className={'current-station'+(m.current?' at-station':'')}><span>Aktuální</span><strong key={'current:'+m.current}>{m.current??(m.phase==='moving'?'Mezi stanicemi':m.phase==='standing-unknown'?'Stojí mimo potvrzenou stanici':'Poloha není známá')}</strong></div>
 <div className="next-station"><span>Následující</span><div><strong key={'next:'+m.next}>{m.next??(m.current?'Konečná stanice':'Další zastávka není známá')}</strong>{m.next&&distanceLabel&&<small>Do zastávky přibližně <b>{distanceLabel}</b><span> · vzdušně</span></small>}</div></div>
 </div>
 <div className="journey-metrics"><div className="journey-speed"><span>Rychlost</span><div><strong>{m.speedKmh===null?'—':Math.round(m.speedKmh)}</strong><span>km/h</span></div></div>
 <div className="delay-indicator" data-severity={severity} data-source={m.delayKind??'unknown'} key={m.delayKind+':'+m.delayMin} role="status" aria-label="Zpoždění vlaku">
 <span>{estimate?'Zpoždění · odhad':'Zpoždění'}</span><strong className={m.delayMin&&m.delayKind==='observed'?'delay-number':''}>{delay}</strong>
 <small>{estimate?'Čekám na první průjezd · předběžný údaj':m.delayKind==='observed'?(m.delayMin??0)>20?'Výrazné zpoždění · poslední průjezd':'Podle posledního průjezdu':'Chybí aktuální čas nebo jízdní řád'}</small>
 </div></div>
 <small className="journey-updated">{updatedAt?'Poslední data '+new Date(updatedAt).toLocaleTimeString('cs-CZ'):'Čekám na data'}</small>
 </div>;
}
