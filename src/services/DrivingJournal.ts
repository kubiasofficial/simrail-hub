import {randomUUID} from 'node:crypto';
import type {Database} from './Database';
import type {DiscordPayload,DriveSession,SharedShift,DeliverySummary,DrivingStatus} from '../types/driving';
export type SendResult={kind:'sent';messageId:string}|{kind:'failed';error:string;retryAfterMs?:number}|{kind:'unknown';error:string};
interface Event extends DeliverySummary {key:string;payload:DiscordPayload;retryAt?:number}
interface Stored {schema:1;revision:number;nickname:string;drive:DriveSession|null;shift:SharedShift|null;events:Event[]}
export const cleanText=(v:unknown,max=150)=>{if(typeof v!=='string')throw Error('Chybí textový údaj.');const s=v.replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!s||s.length>max)throw Error('Textový údaj je prázdný nebo příliš dlouhý.');return s;};
const markdown=(s:string)=>s.replace(/([\\`*_~|<>])/g,'\\$1').replace(/@/g,'@\u200b');
const field=(name:string,value:string|number)=>({name,value:markdown(String(value)).slice(0,1024),inline:false});
const clock=(n:number)=>{const sod=((n%86400)+86400)%86400;return String(Math.floor(sod/3600)).padStart(2,'0')+':'+String(Math.floor(sod%3600/60)).padStart(2,'0');};
export function discordPayload(title:string,fields:{name:string;value:string;inline?:boolean}[],at:number,color=0x87cdec):DiscordPayload{return {allowed_mentions:{parse:[]},embeds:[{title:markdown(title).slice(0,256),fields,color,timestamp:new Date(at).toISOString(),footer:{text:'SimRail Hub TEST · uživatelem potvrzená evidence, bez ověření účtu Steamu'}}]};}
export class DrivingJournal {
 private state:Stored;private interrupted=false;private busy=false;private timer:ReturnType<typeof setTimeout>|null=null;private closed=false;
 constructor(private db:Pick<Database,'getKv'|'setKv'>,private configured:boolean,private send:(p:DiscordPayload)=>Promise<SendResult>,private now:()=>number=Date.now){
  const empty:Stored={schema:1,revision:0,nickname:'',drive:null,shift:null,events:[]};this.state=empty;
  try{const raw=db.getKv('driving.journal.v1');if(raw&&raw.length<2000000){const s=JSON.parse(raw) as Stored;if(s.schema===1&&Array.isArray(s.events)&&s.events.length<=300&&typeof s.nickname==='string'){this.state={...s,revision:Number.isSafeInteger(s.revision)?s.revision:0};this.interrupted=!!s.drive;for(const e of this.state.events)if(e.state==='sending'){e.state='unknown';e.error='Odesílání přerušil restart; ověř zprávu na Discordu.';}}}}catch{this.state=empty;}
  this.persist(this.state);this.kick();
 }
 private persist(s:Stored){this.db.setKv('driving.journal.v1',JSON.stringify(s));}
 private change(fn:(s:Stored)=>void){const next=structuredClone(this.state);fn(next);next.revision=this.state.revision+1;this.persist(next);this.state=next;this.kick();}
 private event(s:Stored,key:string,kind:string,title:string,fields:{name:string;value:string;inline?:boolean}[],color?:number){
  if(s.events.some(e=>e.key===key))return;
  if(s.events.length>=250)s.events=s.events.filter(e=>e.state!=='sent').concat(s.events.filter(e=>e.state==='sent').slice(-80));
  if(s.events.length>=300)throw Error('Fronta oznámení je plná. Zkontroluj doručení zpráv.');
  s.events.push({id:randomUUID(),key,kind,createdAt:this.now(),state:'queued',attempts:0,payload:discordPayload(title,fields,this.now(),color)});
 }
 status():DrivingStatus{return {revision:this.state.revision,configured:this.configured,nickname:this.state.nickname,drive:structuredClone(this.state.drive),shift:structuredClone(this.state.shift),interrupted:this.interrupted,deliveries:this.state.events.slice(-30).map(({payload:_,key:__,retryAt:___,...event})=>event)};}
 startDrive(input:Omit<DriveSession,'id'|'startedAt'|'shiftId'>){
  if(!this.configured)throw Error('Discord není v této TEST instalaci nastavený.');
  const active=this.state.drive;if(active){if(active.server===input.server&&active.number===input.number&&active.runId===input.runId)return this.status();throw Error('Nejdřív ukonči nebo obnov rozpracované řízení.');}
  const drive:DriveSession={...input,id:randomUUID(),startedAt:this.now(),shiftId:this.state.shift?.server===input.server&&this.state.shift.legs.some(l=>l.number===input.number)?this.state.shift.id:null};
  this.change(s=>{s.drive=drive;s.nickname=drive.nickname;this.event(s,drive.id+':start','drive-start',drive.nickname+' právě převzal vlak '+drive.number,[field('Trasa',drive.from+' → '+drive.to),field('Začátek řízení',drive.origin),field('Místo',drive.originVerified?'Potvrzená PH zastávka podle polohy':'Ručně uvedené strojvedoucím'),field('Server',drive.server.toUpperCase()),...(drive.shiftId?[field('Součást směny',this.state.shift?.transport==='freight'?'Nákladní doprava':'Osobní doprava')]:[])]);});this.interrupted=false;return this.status();
 }
 resume(id:string){if(this.state.drive?.id!==id)throw Error('Řízení už není aktivní.');this.interrupted=false;this.change(()=>{});return this.status();}
 endDrive(id:string,location:string,verified:boolean,note:string,delay:number|null){
  const d=this.state.drive;if(!d){if(this.state.events.some(e=>e.key===id+':end'))return this.status();throw Error('Řízení už není aktivní.');}if(d.id!==id)throw Error('Záznam řízení se změnil.');
  this.change(s=>{this.event(s,d.id+':end','drive-end',d.nickname+' ukončil řízení vlaku '+d.number,[field('Trasa',d.from+' → '+d.to),field('Začátek řízení',d.origin),field('Konec řízení',location),field('Místo',verified?'Potvrzená PH zastávka podle polohy':'Ručně uvedené strojvedoucím'),field('Doba evidence',Math.max(0,Math.floor((this.now()-d.startedAt)/60000))+' min'+(this.interrupted?' · zahrnuje přerušení aplikace':'')),field('Server',d.server.toUpperCase()),...(delay!==null?[field('Zpoždění – odhad z launcheru',(delay>0?'+':'')+delay+' min')]:[]),...(note?[field('Poznámka',note)]:[])],0x97d2b1);s.drive=null;});this.interrupted=false;return this.status();
 }
 startShift(input:Omit<SharedShift,'id'|'startedAt'|'completed'|'breakAt'|'readySent'>){
  if(!this.configured)throw Error('Discord není v této TEST instalaci nastavený.');if(this.state.shift){if(this.state.shift.planKey===input.planKey)return this.status();throw Error('Nejdřív ukonči původní sdílenou směnu.');}
  const shift:SharedShift={...input,id:randomUUID(),startedAt:this.now(),completed:[],breakAt:null,readySent:false};this.change(s=>{s.shift=shift;s.nickname=shift.nickname;this.event(s,shift.id+':start','shift-start',shift.nickname+' zahájil směnu',[field('Doprava',shift.transport==='freight'?'Nákladní':'Osobní'),field('Server',shift.server.toUpperCase()),field('Plánovaný konec',clock(shift.plannedEnd)+' · čas serveru'),field('Plánované jízdy',shift.legs.map(l=>l.number+': '+l.from+' → '+l.to).join(' | ').slice(0,950)),field('Přestávka',shift.breakMinutes+' min')],0xbba1ec);});return this.status();
 }
 progressShift(id:string,legId:string,ready:boolean){
  const sh=this.state.shift;if(!sh||sh.id!==id)return this.status();const leg=sh.legs.find(l=>l.id===legId);if(!leg)throw Error('Jízda nepatří do této směny.');
  if(ready){if(sh.completed.at(-1)!==legId)return this.status();if(!sh.breakAt||this.now()<sh.breakAt+sh.breakMinutes*60000||sh.readySent)return this.status();this.change(s=>{s.shift!.readySent=true;this.event(s,sh.id+':ready:'+legId,'shift-ready',sh.nickname+' má konec přestávky',[field('Místo',leg.to),field('Další krok','Ověřit dostupnost navazujícího vlaku v launcheru.'),field('Server',sh.server.toUpperCase())],0x87cdec);});return this.status();}
  if(sh.completed.includes(legId))return this.status();
  if(sh.legs[sh.completed.length]?.id!==legId)throw Error('Nejdřív dokonči předchozí jízdu směny.');
  this.change(s=>{const shift=s.shift!;shift.completed.push(legId);shift.breakAt=this.now();shift.readySent=false;const last=shift.completed.length===shift.legs.length;this.event(s,sh.id+':arrival:'+legId,last?'shift-arrival':'shift-break',sh.nickname+(last?' dorazil do cíle poslední plánované jízdy':' zahájil přestávku ve směně'),[field('Vlak',leg.number),field('Místo pozorovaného příjezdu',leg.to),field('Stav',last?'Plánované jízdy pozorovány; ukončení směny potvrď v launcheru.':'Plánovaná přestávka '+shift.breakMinutes+' min'),field('Zdroj','PH příjezd pozorovaný launcherem při sledování vlaku.'),field('Server',shift.server.toUpperCase())],0xd6be82);});return this.status();
 }
 endShift(id:string){const sh=this.state.shift;if(!sh){if(this.state.events.some(e=>e.key===id+':end'))return this.status();throw Error('Směna už není aktivní.');}if(sh.id!==id)throw Error('Směna se změnila.');if(this.state.drive?.shiftId===id)throw Error('Nejdřív ukonči aktivní řízení vlaku.');this.change(s=>{this.event(s,id+':end','shift-end',sh.nickname+(sh.completed.length===sh.legs.length?' dokončil směnu':' ukončil směnu'),[field('Doprava',sh.transport==='freight'?'Nákladní':'Osobní'),field('Server',sh.server.toUpperCase()),field('Pozorované dokončené jízdy',sh.completed.length+' / '+sh.legs.length),field('Doba evidence',Math.max(0,Math.floor((this.now()-sh.startedAt)/60000))+' min'),field('Vlaky',sh.legs.filter(l=>sh.completed.includes(l.id)).map(l=>l.number).join(', ')||'Zatím žádná dokončená plánovaná jízda')],0xbba1ec);s.shift=null;});return this.status();}
 retry(id:string,confirmed:boolean){const event=this.state.events.find(e=>e.id===id);if(!event||!['failed','unknown'].includes(event.state))return this.status();if(event.state==='unknown'&&!confirmed)throw Error('Výsledek je nejasný. Nejdřív ověř zprávu na Discordu a potvrď riziko duplicity.');if(event.retryAt&&this.now()<event.retryAt)throw Error('Discord žádá chvíli počkat.');this.change(s=>{const e=s.events.find(e=>e.id===id)!;e.state='queued';e.error=undefined;e.retryAt=undefined;e.attempts=0;});return this.status();}
 private kick(){if(this.closed||this.busy||!this.configured)return;if(this.timer)clearTimeout(this.timer);const queued=this.state.events.filter(e=>e.state==='queued');const event=queued.find(e=>(e.retryAt??0)<=this.now());if(!event){if(queued.length)this.timer=setTimeout(()=>this.kick(),Math.max(100,Math.min(...queued.map(e=>e.retryAt??this.now()))-this.now()));return;}this.busy=true;this.change(s=>{const e=s.events.find(e=>e.id===event.id)!;e.state='sending';e.attempts++;});
  void this.send(event.payload).catch(()=>({kind:'unknown',error:'Spojení skončilo bez potvrzení. Ověř doručení na Discordu.'} as SendResult)).then(result=>{if(this.closed)return;this.change(s=>{const e=s.events.find(e=>e.id===event.id)!;if(result.kind==='sent'){e.state='sent';e.messageId=result.messageId;e.error=undefined;}else if(result.kind==='failed'&&result.retryAfterMs!==undefined&&e.attempts<3){e.state='queued';e.retryAt=this.now()+Math.max(1000,Math.min(3600000,result.retryAfterMs));e.error='Discord omezuje rychlost; čekám na další pokus.';}else{e.state=result.kind;e.error=result.error;}});}).finally(()=>{this.busy=false;if(!this.closed)this.timer=setTimeout(()=>this.kick(),1500);});
 }
 dispose(){this.closed=true;if(this.timer)clearTimeout(this.timer);}
}
export function validDiscordWebhook(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='discord.com'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/api\/webhooks\/\d{17,20}\/[A-Za-z0-9_-]{40,200}$/.test(u.pathname);}catch{return false;}}
export async function sendDiscord(url:string,payload:DiscordPayload,fetcher:typeof fetch=fetch):Promise<SendResult>{
 if(!validDiscordWebhook(url))return {kind:'failed',error:'Webhook není platně nastavený.'};
 try{const target=new URL(url);target.searchParams.set('wait','true');const r=await fetcher(target,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
 if(r.status===429){let seconds=30;try{const data=await r.json() as {retry_after?:number};if(typeof data.retry_after==='number'&&Number.isFinite(data.retry_after))seconds=data.retry_after;}catch{}return {kind:'failed',error:'Discord omezuje rychlost odesílání.',retryAfterMs:Math.max(1000,Math.min(3600000,seconds*1000))};}
 if(r.ok){const data=await r.json() as {id?:string};if(typeof data.id==='string'&&/^\d+$/.test(data.id))return {kind:'sent',messageId:data.id};return {kind:'unknown',error:'Discord neposkytl potvrzení zprávy. Ověř doručení.'};}
 return r.status>=500?{kind:'unknown',error:'Discord nepotvrdil doručení. Ověř zprávu před opakováním.'}:{kind:'failed',error:'Discord odmítl zprávu (HTTP '+r.status+').'};
 }catch{return {kind:'unknown',error:'Spojení skončilo bez potvrzení. Ověř zprávu na Discordu.'};}
}
