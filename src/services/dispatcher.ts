import type {Train,StationCoord} from '../types/trains';
import type {TrainRoute,RailCoord} from '../types/route';
import {haversineM} from './geo';
import {normName} from './onboard';
export type DispatcherVerbosity='brief'|'normal'|'detailed';
export interface TrafficAlert {reason?:'new'|'approaching'|'worse'|'reminder'|'clear';key:string;kind:'slow'|'density'|'station'|'clear';text:string;lat:number;lon:number;distanceM:number;count:number;severity:number;trainIds:string[];trainRuns?:Record<string,string|null>;distanceBasis?:'route'|'air';sectionFrom?:string;sectionTo?:string;observedAt?:number;state?:'active'|'checking'|'unverified'}
interface Span {from:string;to:string;fromIndex:number;toIndex:number;points:RailCoord[];offset:number;length:number;group:number}
interface Projection {span:Span;along:number;cross:number;point:RailCoord}
const distance=(a:RailCoord,b:RailCoord)=>haversineM(a[0],a[1],b[0],b[1]);
export function routeSpans(route:TrainRoute):Span[]{
 let offset=0,group=0,last:TrainRoute['sections'][number]|undefined;
 return route.sections.map(s=>{if(last&&(s.fromIndex!==last.toIndex||distance(last.coordinates.at(-1)!,s.coordinates[0])>100)){offset=0;group++;}
 const length=s.coordinates.reduce((sum,p,i)=>sum+(i?distance(s.coordinates[i-1],p):0),0),span={from:route.stops.find(p=>p.index===s.fromIndex)?.name??'',to:route.stops.find(p=>p.index===s.toIndex)?.name??'',fromIndex:s.fromIndex,toIndex:s.toIndex,points:s.coordinates,offset,length,group};offset+=length;last=s;return span;});
}
function project(at:RailCoord,spans:Span[]):Projection|null{
 let best:Projection|null=null;
 for(const span of spans){let along=0;for(let i=1;i<span.points.length;i++){const a=span.points[i-1],b=span.points[i],scale=Math.cos(at[0]*Math.PI/180),x=(b[1]-a[1])*scale*111320,y=(b[0]-a[0])*111320,px=(at[1]-a[1])*scale*111320,py=(at[0]-a[0])*111320,len=distance(a,b),t=x*x+y*y?Math.max(0,Math.min(1,(px*x+py*y)/(x*x+y*y))):0,cross=Math.hypot(px-x*t,py-y*t);
 if(!best||cross<best.cross)best={span,along:span.offset+along+len*t,cross,point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]};along+=len;}}
 return best;
}
export interface TrafficInput {own:Train;route:TrainRoute;trains:Train[];routes:Map<string,TrainRoute>;stations:StationCoord[];rangeM:number}
export function detectTraffic(input:TrafficInput):TrafficAlert|null{
 const {own,route,trains,routes,stations,rangeM}=input,idx=own.timetableIndex;
 if(idx===null||route.runId!==own.runId||!route.sections.length)return null;
 const spans=routeSpans(route),self=project([own.lat,own.lon],spans.filter(s=>idx>=s.fromIndex&&idx<=s.toIndex));if(!self||self.cross>80)return null;
 const ahead=spans.filter(s=>s.group===self.span.group&&s.offset+s.length>=self.along&&s.offset<=self.along+rangeM);
 const matches:{train:Train;p:Projection;dist:number}[]=[];
 for(const train of trains){if(train.number===own.number||train.serverCode!==own.serverCode||train.speedKmh===null||haversineM(own.lat,own.lon,train.lat,train.lon)>rangeM+200)continue;
 const p=project([train.lat,train.lon],ahead);if(!p||p.cross>35)continue;const dist=p.along-self.along;if(dist<100||dist>rangeM)continue;
 const other=routes.get(train.number);if(!other||other.runId!==train.runId||train.timetableIndex===null)continue;
 const compatible=routeSpans(other).filter(s=>s.from&&s.to&&normName(s.from)===normName(p.span.from)&&normName(s.to)===normName(p.span.to)&&train.timetableIndex!>=s.fromIndex&&train.timetableIndex!<=s.toIndex);
 const onOther=project([train.lat,train.lon],compatible);if(!onOther||onOther.cross>35)continue;
 matches.push({train,p,dist});
 }
 matches.sort((a,b)=>a.dist-b.dist);
 const stationAlerts:TrafficAlert[]=[];
 for(const stop of route.stops){const span=ahead.find(s=>s.toIndex===stop.index);if(!span)continue;const dist=span.offset+span.length-self.along;if(dist<=100||dist>rangeM)continue;const coord=stations.find(s=>normName(s.name)===normName(stop.name));if(!coord)continue;
 const stopped=matches.filter(m=>m.train.speedKmh!<=1&&haversineM(m.train.lat,m.train.lon,coord.lat,coord.lon)<=200);
 if(stopped.length>=3)stationAlerts.push({sectionFrom:span.from,sectionTo:span.to,key:'station:'+normName(stop.name),kind:'station',text:'Ve stanici '+stop.name+' stojí několik vlaků v navazujícím směru. Při příjezdu může dojít ke zdržení.',lat:coord.lat,lon:coord.lon,distanceM:dist,count:stopped.length,severity:stopped.length>=5?3:2,trainIds:stopped.map(m=>m.train.number)});
 }
 if(stationAlerts.length)return stationAlerts.sort((a,b)=>a.distanceM-b.distanceM)[0];
 const slow=matches.filter(m=>m.train.speedKmh!<=Math.min(40,(own.speedKmh??0)-15));
 const groups=new Map<string,typeof slow>();for(const item of slow){const key=item.p.span.from+':'+item.p.span.to;const group=groups.get(key)??[];group.push(item);groups.set(key,group);}
 const dense=[...groups.values()].find(group=>group.length>=3);
 if(dense){const first=dense[0];return {sectionFrom:first.p.span.from,sectionTo:first.p.span.to,key:'density:'+normName(first.p.span.from)+':'+normName(first.p.span.to),kind:'density',text:'Mezi stanicemi '+first.p.span.from+' a '+first.p.span.to+' je zvýšený provoz pomalu jedoucích vlaků. Může dojít ke zpomalení.',lat:first.train.lat,lon:first.train.lon,distanceM:first.dist,count:dense.length,severity:2,trainIds:dense.map(m=>m.train.number)};}
 if(slow.length){const first=slow[0];return {sectionFrom:first.p.span.from,sectionTo:first.p.span.to,key:'slow:'+first.train.number,kind:'slow',text:'Ve vzdálenosti přibližně '+Math.round(first.dist/100)*100+' metrů před vámi se nachází '+(first.train.speedKmh!<=1?'stojící':'pomalu jedoucí')+' vlak. Sledujte návěstidla.',lat:first.train.lat,lon:first.train.lon,distanceM:first.dist,count:1,severity:first.dist<1000?2:1,trainIds:[first.train.number]};}
 return null;
}

/** Cheap geographic prefilter; null means the selected train cannot be placed reliably. */
export function routeCandidateTrains(own:Train,route:TrainRoute,trains:Train[],rangeM:number):Train[]|null {
 const idx=own.timetableIndex;if(idx===null||own.runId!==route.runId)return null;const spans=routeSpans(route),self=project([own.lat,own.lon],spans.filter(s=>idx>=s.fromIndex&&idx<=s.toIndex));if(!self||self.cross>80)return null;
 const ahead=spans.filter(s=>s.group===self.span.group&&s.offset+s.length>=self.along&&s.offset<=self.along+rangeM);
 return trains.filter(t=>{if(t.number===own.number||t.serverCode!==own.serverCode||t.speedKmh===null||haversineM(own.lat,own.lon,t.lat,t.lon)>rangeM+200)return false;const p=project([t.lat,t.lon],ahead);return !!p&&p.cross<=35&&p.along-self.along>=100&&p.along-self.along<=rangeM;});
}

/** Keep watching a confirmed incident independently of the driver's speed and discovery radius. */
export function incidentTrains(alert:TrafficAlert,trains:Train[],route:TrainRoute):Train[]{
 const spans=routeSpans(route).filter(s=>normName(s.from)===normName(alert.sectionFrom??'')&&normName(s.to)===normName(alert.sectionTo??''));
 return trains.filter(t=>alert.trainIds.includes(t.number)||!!spans.length&&project([t.lat,t.lon],spans)!.cross<=35);
}
/** undefined means we cannot verify resolution; null means fresh data shows the issue has eased. */
export function followTraffic(input:TrafficInput,previous:TrafficAlert):TrafficAlert|null|undefined {
 const {own,route,trains,routes,stations}=input;
 if(!route.sections.length||own.runId!==route.runId)return undefined;
 const sameSection=routeSpans(route).filter(s=>normName(s.from)===normName(previous.sectionFrom??'')&&normName(s.to)===normName(previous.sectionTo??''));
 const matches:{train:Train;p:Projection}[]=[];
 for(const train of trains){
  if(train.number===own.number||train.serverCode!==own.serverCode)continue;
  if(previous.kind==='slow'&&!previous.trainIds.includes(train.number))continue;
  if(previous.trainRuns&&previous.trainIds.includes(train.number)&&previous.trainRuns[train.number]!==train.runId)return undefined;
  const other=routes.get(train.number);
  if(train.speedKmh===null||!other||other.runId!==train.runId||train.timetableIndex===null){if(previous.trainIds.includes(train.number))return undefined;continue;}
  if(previous.kind!=='slow'&&train.speedKmh!>(previous.kind==='station'?1:40))continue;
  const ownSpans=previous.kind==='slow'?routeSpans(route):sameSection;
  const otherSpans=routeSpans(other).filter(s=>train.timetableIndex!>=s.fromIndex&&train.timetableIndex!<=s.toIndex&&ownSpans.some(o=>normName(o.from)===normName(s.from)&&normName(o.to)===normName(s.to)));
  const p=project([train.lat,train.lon],otherSpans);
  if(!p||p.cross>35){if(previous.trainIds.includes(train.number))return undefined;continue;}
  matches.push({train,p});
 }
 if(previous.trainIds.some(id=>!trains.some(t=>t.number===id)))return undefined;
 const routeDistance=(lat:number,lon:number)=>{const spans=routeSpans(route),self=project([own.lat,own.lon],spans.filter(s=>own.timetableIndex!==null&&own.timetableIndex>=s.fromIndex&&own.timetableIndex<=s.toIndex)),target=project([lat,lon],spans);return self&&target&&self.cross<=80&&target.cross<=35&&self.span.group===target.span.group&&target.along>=self.along?{distanceBasis:'route' as const,distanceM:target.along-self.along}:{distanceBasis:'air' as const,distanceM:haversineM(own.lat,own.lon,lat,lon)};};
 if(previous.kind==='slow'){
  const first=matches[0];if(!first)return undefined;if(first.train.speedKmh!>40)return null;
  return {...previous,lat:first.train.lat,lon:first.train.lon,...routeDistance(first.train.lat,first.train.lon),severity:routeDistance(first.train.lat,first.train.lon).distanceM<1000?2:1,text:'Vlak '+first.train.number+' v dříve hlášeném úseku stále '+(first.train.speedKmh!<=1?'stojí.':'jede pomalu.')+' Sledujte návěstidla.'};
 }
 let slow=matches.filter(m=>m.train.speedKmh!<=40);
 if(previous.kind==='station'){
  const station=stations.find(s=>normName(s.name)===normName(previous.sectionTo??''));if(!station)return undefined;
  slow=slow.filter(m=>m.train.speedKmh!<=1&&haversineM(m.train.lat,m.train.lon,station.lat,station.lon)<=200);
 }
 if(slow.length<3)return null;
 const first=slow[0];return {...previous,count:slow.length,trainIds:slow.map(m=>m.train.number),lat:previous.kind==='station'?previous.lat:first.train.lat,lon:previous.kind==='station'?previous.lon:first.train.lon,severity:slow.length>=5?3:2,...routeDistance(previous.kind==='station'?previous.lat:first.train.lat,previous.kind==='station'?previous.lon:first.train.lon)};
}

function dispatcherUpdateText(alert:TrafficAlert,reason:string,verbosity:DispatcherVerbosity):string {
 const section=alert.sectionFrom&&alert.sectionTo?' mezi stanicemi '+alert.sectionFrom+' a '+alert.sectionTo:'';
 if(reason==='approaching')return 'Blížíte se k dříve hlášené komplikaci'+section+'. Vzdálenost po trase je přibližně '+Math.round(alert.distanceM/100)*100+' metrů. Sledujte návěstidla.';
 if(reason==='worse')return 'Provozní situace'+section+' se zhoršila. '+alert.text;
 return 'Komplikace'+section+' přetrvává. '+(verbosity==='brief'?'Sledujte návěstidla.':alert.text);
}

export class TrafficMonitor {
 private key='';private first=0;private samples=0;private sampleAt=0;private lastNow=0;private announced:TrafficAlert|null=null;private lastSpoken=0;private clearSince=0;private clearSamples=0;
 current:TrafficAlert|null=null;
 reset(){this.key='';this.first=0;this.samples=0;this.sampleAt=0;this.lastNow=0;this.announced=null;this.lastSpoken=0;this.clearSince=0;this.clearSamples=0;this.current=null;}
 update(alert:TrafficAlert|null,sampleAt:number,now:number,fresh:boolean,verbosity:DispatcherVerbosity='normal'):{current:TrafficAlert|null;event:TrafficAlert|null}{
  if(!fresh||now-sampleAt>15000||sampleAt>now+1000||!!this.lastNow&&now-this.lastNow>20000){
   this.key='';this.first=0;this.samples=0;this.sampleAt=0;this.clearSince=0;this.clearSamples=0;
   if(this.current)this.current={...this.current,state:'unverified'};
   this.lastNow=now;
   if(!fresh||now-sampleAt>15000||sampleAt>now+1000)return {current:this.current,event:null};
  }
  this.lastNow=now;if(sampleAt===this.sampleAt)return {current:this.current,event:null};this.sampleAt=sampleAt;
  if(alert){
   this.clearSince=0;this.clearSamples=0;
   // An already confirmed incident survives brief missing data without another discovery delay.
   const confirmed=this.current?.key===alert.key;
   if(alert.key!==this.key){this.key=alert.key;this.first=now;this.samples=1;}else this.samples++;
   if(!confirmed&&(now-this.first<20000||this.samples<3))return {current:this.current,event:null};
   this.current={...alert,observedAt:sampleAt,state:'active'};
   const worse=this.announced&&this.announced.key===alert.key&&(alert.severity>this.announced.severity||alert.count>=this.announced.count+2);
   const elapsed=now-this.lastSpoken;
   const nearing=this.announced?.key===alert.key&&alert.distanceBasis!=='air'&&this.announced.distanceBasis!=='air'&&alert.distanceM>0&&alert.distanceM<=this.announced.distanceM*.5&&this.announced.distanceM-alert.distanceM>=500;
   const repeat=verbosity==='brief'?10*60000:5*60000;
   const reason=!this.announced||this.announced.key!==alert.key?'new':worse?'worse':nearing&&verbosity!=='brief'?'approaching':'reminder';
   const announce=!this.announced||reason==='new'&&elapsed>=60000||reason==='worse'&&elapsed>=60000||reason==='approaching'&&elapsed>=(verbosity==='detailed'?60000:120000)||elapsed>=repeat;
   if(announce){this.announced={...alert};this.lastSpoken=now;return {current:this.current,event:reason==='new'?alert:{...alert,reason,text:dispatcherUpdateText(alert,reason,verbosity)}};}
   return {current:this.current,event:null};
  }
  this.key='';this.first=0;this.samples=0;
  if(this.current){
   if(!this.clearSince)this.clearSince=now;this.clearSamples++;
   this.current={...this.current,observedAt:sampleAt,state:'checking'};
   if(now-this.clearSince>=60000&&this.clearSamples>=3){const previous=this.current;this.current=null;this.announced=null;this.clearSince=0;this.clearSamples=0;this.lastSpoken=now;return {current:null,event:{...previous,key:'clear:'+previous.key,kind:'clear',reason:'clear',text:'Provoz '+(previous.sectionFrom&&previous.sectionTo?'mezi stanicemi '+previous.sectionFrom+' a '+previous.sectionTo:'v dříve hlášeném úseku')+' se uvolnil.',severity:0}};}
  }
  return {current:this.current,event:null};
 }
}
