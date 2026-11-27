import {randomUUID} from 'node:crypto';
import type {Database} from './Database';
import type {DiscordPayload,CommunityConnection} from '../types/driving';
import type {DeliveryContext,SendResult} from './DrivingJournal';
export const COMMUNITY_RELAY='https://simrail-hub-community.suslik-kuba.workers.dev';
interface Vault {encrypt:(text:string)=>string;decrypt:(text:string)=>string}
interface Credential {token:string;expires:number}
interface Pending {code:string;pollSecret:string;activationUrl:string;expires:number}
const TOKEN=/^[a-f0-9]{64}$/;
export class CommunityRelay {
 private clientId:string;private credential:Credential|null=null;private pending:Pending|null=null;private nextPoll=0;private flight:Promise<void>|null=null;private error:string|null=null;
 constructor(private db:Pick<Database,'getKv'|'setKv'>,private vault:Vault,private fetcher:typeof fetch,private open:(url:string)=>Promise<void>,private base=COMMUNITY_RELAY,private now:()=>number=Date.now){
  const stored=db.getKv('community.client.v1');this.clientId=stored&&/^[a-f0-9-]{36}$/i.test(stored)?stored:randomUUID();db.setKv('community.client.v1',this.clientId);
  try{const raw=db.getKv('community.credential.v1');if(raw){const c=JSON.parse(vault.decrypt(raw)) as Credential;if(TOKEN.test(c.token)&&Number.isFinite(c.expires)&&c.expires>now())this.credential=c;}}catch{/* re-verification is offered if Windows cannot decrypt the old credential */}
 }
 private snapshot():CommunityConnection{return {mode:'community',verified:!!this.credential&&this.credential.expires>this.now(),pending:!!this.pending&&this.pending.expires>this.now(),error:this.error};}
 private async request(path:string,body:unknown,auth=false){const headers:Record<string,string>={'Content-Type':'application/json'};if(auth&&this.credential){headers.Authorization='Bearer '+this.credential.token;headers['X-SimRail-Client']=this.clientId;}const r=await this.fetcher(this.base+path,{method:'POST',redirect:'error',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const text=await r.text();if(text.length>65536)throw Error('response too large');return {status:r.status,ok:r.ok,body:JSON.parse(text) as Record<string,unknown>};}
 async connect():Promise<CommunityConnection>{
  this.error=null;
  try{if(!this.pending||this.pending.expires<=this.now()){
   const r=await this.request('/v1/register',{clientId:this.clientId});if(!r.ok)throw Error('registrace');const q=r.body,u=new URL(String(q.activationUrl));if(typeof q.code!=='string'||!/^[a-f0-9-]{36}$/i.test(q.code)||typeof q.pollSecret!=='string'||!TOKEN.test(q.pollSecret)||u.origin!==this.base||u.pathname!=='/activate'||u.searchParams.get('code')!==q.code)throw Error('response');
   this.pending={code:q.code,pollSecret:q.pollSecret,activationUrl:u.href,expires:this.now()+600000};this.nextPoll=this.now()+3000;
  }await this.open(this.pending.activationUrl);return this.snapshot();}catch{this.error='Ověření se nepodařilo otevřít. Zkontroluj připojení a zkus to znovu.';throw Error(this.error);}
 }
 private async poll(){const pending=this.pending;if(!pending)return;try{const r=await this.request('/v1/register-status',{code:pending.code,pollSecret:pending.pollSecret});if(this.pending!==pending)return;if(r.status===410){this.pending=null;this.error='Ověření vypršelo. Otevři ho znovu.';return;}if(!r.ok){this.error='Čekám na dostupnost ověřovací služby.';return;}if(r.body.state==='ready'&&typeof r.body.token==='string'&&TOKEN.test(r.body.token)&&typeof r.body.expires==='number'&&Number.isFinite(r.body.expires)&&r.body.expires>this.now()){
   const c={token:r.body.token,expires:r.body.expires};this.db.setKv('community.credential.v1',this.vault.encrypt(JSON.stringify(c)));this.credential=c;this.pending=null;this.error=null;
  }}catch{this.error='Čekám na spojení s ověřovací službou.';}}
 async status():Promise<CommunityConnection>{if(this.pending&&this.pending.expires<=this.now()){this.pending=null;this.error='Ověření vypršelo. Otevři ho znovu.';}if(this.pending&&this.now()>=this.nextPoll){if(!this.flight){this.nextPoll=this.now()+5000;this.flight=this.poll().finally(()=>{this.flight=null;});}await this.flight;}return this.snapshot();}
 ensureReady(){if(!this.snapshot().verified)throw Error('Nejdřív ověř propojení s komunitním Discordem.');}
 async send(payload:DiscordPayload,event:DeliveryContext):Promise<SendResult>{
  if(!this.snapshot().verified)return {kind:'failed',error:'Propojení Discordu vypršelo. Ověř ho znovu a zopakuj oznámení.'};
  try{const r=await this.request('/v1/events',{eventId:event.id,kind:event.kind,revision:event.manualRevision??0,payload},true);
   if(r.status===401){this.credential=null;this.db.setKv('community.credential.v1','');this.error='Propojení vypršelo. Ověř ho znovu.';return {kind:'failed',error:this.error};}
   const b=r.body;if(b.kind==='sent'&&typeof b.messageId==='string'&&/^\d+$/.test(b.messageId))return {kind:'sent',messageId:b.messageId};
   if(b.kind==='unknown')return {kind:'unknown',error:typeof b.error==='string'?b.error.slice(0,500):'Ověř doručení na Discordu.'};
   const error=typeof b.error==='string'?b.error.slice(0,500):'Komunitní služba oznámení nepotvrdila.';
   if(r.status===429&&typeof b.retryAfterMs==='number'&&Number.isFinite(b.retryAfterMs))return {kind:'failed',error,retryAfterMs:Math.max(1000,Math.min(3600000,b.retryAfterMs))};
   if(b.kind==='failed'||r.status>=400&&r.status<500)return {kind:'failed',error};return {kind:'unknown',error};
  }catch{return {kind:'unknown',error:'Spojení skončilo bez potvrzení. Ověř zprávu na Discordu před opakováním.'};}
 }
}
