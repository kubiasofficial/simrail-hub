import type {FetchLike} from '../adapters/simrailApi';
type Reply=Awaited<ReturnType<FetchLike>>;
const ORIGINS=new Set(['https://panel.simrail.eu:8084','https://api1.aws.simrail.eu:8082']);
/** Process-wide JSON cache: shares raw responses between map, server tiles and mobile display.
 * A failed request is never returned as fresh data. Backoff is 2s..30s per URL. */
export class SharedApiFetch {
 private cache=new Map<string,{until:number;body:string;status:number}>();
 private pending=new Map<string,Promise<Reply>>();
 private failures=new Map<string,{until:number;count:number;error:Error}>();
 constructor(private fetcher:FetchLike,private now:()=>number=Date.now){}
 readonly fetch:FetchLike=(url,init)=>{
  for(const [key,entry] of this.cache)if(entry.until<=this.now())this.cache.delete(key);
  const u=new URL(url);if(!ORIGINS.has(u.origin))return this.fetcher(url,init);
  const hit=this.cache.get(url);if(hit&&hit.until>this.now())return Promise.resolve({ok:true,status:hit.status,text:async()=>hit.body});
  const waiting=this.pending.get(url);if(waiting)return waiting;
  const failed=this.failures.get(url);if(failed&&failed.until>this.now())return Promise.reject(failed.error);
  if(this.pending.size>=64)return Promise.reject(Error('Probíhá příliš mnoho požadavků.'));
  const task=this.load(url,init).finally(()=>this.pending.delete(url));this.pending.set(url,task);return task;
 };
 private async load(url:string,init:Parameters<FetchLike>[1]):Promise<Reply>{
  const controller=new AbortController();let rejectTimeout!:(e:Error)=>void;
  const deadline=new Promise<never>((_,reject)=>rejectTimeout=reject);const timer=setTimeout(()=>{controller.abort();rejectTimeout(Error('API neodpovědělo v časovém limitu.'));},url.includes('timetables')?20000:10000);
  try{
   const response=await Promise.race([this.fetcher(url,{...init,signal:controller.signal}),deadline]);const body=await Promise.race([response.text(),deadline]);
   if(!response.ok)throw Error('API vrátilo HTTP '+response.status+'.');
   if(body.length>20*1024*1024)throw Error('Odpověď API je příliš velká.');
   JSON.parse(body);
   const ttl=url.includes('stations-open')?30000:url.includes('timetables')?0:url.includes('servers-open')?10000:1500;
   this.cache.delete(url);if(ttl)this.cache.set(url,{until:this.now()+ttl,body,status:response.status});this.failures.delete(url);
   let bytes=0;for(const c of this.cache.values())bytes+=c.body.length*2;
   while(this.cache.size>128||bytes>32*1024*1024){const key=this.cache.keys().next().value!;bytes-=this.cache.get(key)!.body.length*2;this.cache.delete(key);}
   return {ok:true,status:response.status,text:async()=>body};
  }catch(e){const count=(this.failures.get(url)?.count??0)+1,error=e instanceof Error?e:Error('API není dostupné.');
   this.failures.set(url,{count,until:this.now()+Math.min(30000,2000*2**Math.min(4,count-1)),error});
   while(this.failures.size>128)this.failures.delete(this.failures.keys().next().value!);
   throw error;
  }finally{clearTimeout(timer);}
 }
}
