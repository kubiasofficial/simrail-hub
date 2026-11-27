import type {AnnKind,Segment} from './announcements';
export interface QueueItem {key:string;kind:AnnKind;segments:Segment[];enqueuedAt:number;automatic?:boolean;station?:string|null;channel?:'passenger'|'dispatcher';valid?:()=>boolean;service?:boolean;onComplete?:()=>void}
const PRIORITY:Record<AnnKind,number>={terminal:0,arrived:1,approaching:2,'next-station':3,delay:4};
const MAX_AGE_MS:Partial<Record<AnnKind,number>>={approaching:60000,'next-station':120000,delay:120000};
interface QueueOptions {gapMs?:()=>number;onCooldown?:(until:number)=>void;before?:(item:QueueItem)=>Promise<void>;after?:(item:QueueItem)=>Promise<void>}
export class AnnouncementQueue {
 private items:QueueItem[]=[];private seen=new Set<string>();private busy=false;private generation=0;private nextAutomaticAt=0;private wake:(()=>void)|null=null;
 constructor(private play:(seg:Segment)=>Promise<void>,private now:()=>number=Date.now,private onChange?:(pending:number)=>void,private options:QueueOptions={}){}
 get pending(){return this.items.length;}
 discard(predicate:(item:QueueItem)=>boolean){this.items=this.items.filter(item=>!predicate(item));this.onChange?.(this.pending);this.wake?.();}
 enqueue(item:Omit<QueueItem,'enqueuedAt'>):boolean{
  if(this.seen.has(item.key))return false;this.seen.add(item.key);
  if(item.channel!=='dispatcher'&&item.automatic&&item.station)this.items=this.items.filter(old=>old.channel==='dispatcher'||!old.automatic||old.station!==item.station||old.kind==='delay'||PRIORITY[old.kind]<=PRIORITY[item.kind]);
  this.items.push({...item,enqueuedAt:this.now()});this.sort();this.onChange?.(this.pending);this.wake?.();void this.drain();return true;
 }
 private sort(){this.items.sort((a,b)=>Number(!!a.automatic)-Number(!!b.automatic)||(a.channel==='dispatcher'?-1:PRIORITY[a.kind])-(b.channel==='dispatcher'?-1:PRIORITY[b.kind])||a.enqueuedAt-b.enqueuedAt);}
 clear(){this.generation++;this.items=[];this.nextAutomaticAt=0;this.options.onCooldown?.(0);this.onChange?.(0);this.wake?.();}
 resetHistory(){this.seen.clear();}
 private wait(ms:number){return new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);this.wake=null;resolve();};const timer=setTimeout(done,ms);this.wake=done;});}
 private async drain(){
  if(this.busy)return;this.busy=true;
  try{while(this.items.length){
   this.sort();const candidate=this.items[0];
   if(candidate.automatic&&this.now()<this.nextAutomaticAt){this.options.onCooldown?.(this.nextAutomaticAt);await this.wait(this.nextAutomaticAt-this.now());continue;}
   const item=this.items.shift()!;this.onChange?.(this.pending);const max=MAX_AGE_MS[item.kind];
   if(item.valid&&!item.valid()||max!==undefined&&this.now()-item.enqueuedAt>max)continue;
   const generation=this.generation;
   let failed=false;
   try{if(item.valid&&!item.valid())continue;await this.options.before?.(item);}catch{failed=true;}
   if(!failed)for(const segment of item.segments){if(generation!==this.generation||item.valid&&!item.valid())break;try{await this.play(segment);}catch{failed=true;}}
   if(!failed&&generation===this.generation)try{await this.options.after?.(item);}catch{/* failed outro does not block the next item */}
   if(!failed&&generation===this.generation&&(!item.valid||item.valid()))item.onComplete?.();
   if(generation===this.generation){this.nextAutomaticAt=this.now()+Math.max(0,this.options.gapMs?.()??0);this.options.onCooldown?.(this.nextAutomaticAt);}
  }}finally{this.busy=false;}
 }
}
