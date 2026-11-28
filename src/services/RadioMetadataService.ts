export interface RadioNowPlaying {artist:string;title:string;fetchedAt:number;validUntil:number}
const ENDPOINT='https://www.kiss.cz/prave-hraje.json';
function text(value:unknown):string {
 if(typeof value!=='string')return '';
 return value.replace(/<[^>]*>/g,'').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#39|#34);/g,s=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' ','&#39;':"'",'&#34;':'"'}[s]??s)).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,240);
}
export function parseRadioMetadata(raw:unknown,now:number):RadioNowPlaying|null {
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>,artist=text(r.c_artist),title=text(r.c_title);
 const from=Number(r.from)*1000,to=Number(r.to)*1000;
 if(!artist||!title||!Number.isFinite(from)||!Number.isFinite(to)||from>now+5000||to<=now||to<=from||to-from>3600000)return null;
 return {artist,title,fetchedAt:now,validUntil:Math.min(to,now+60000)};
}
/** Official Kiss player feed only: renderer cannot supply an arbitrary URL. */
export class RadioMetadataService {
 private cached:RadioNowPlaying|null=null;private checkedAt=-Infinity;private pending:Promise<RadioNowPlaying|null>|null=null;
 constructor(private fetcher:typeof fetch,private now:()=>number=Date.now){}
 async get(station:string):Promise<RadioNowPlaying|null>{
  if(station!=='kiss')return null;
  const now=this.now();if(now-this.checkedAt<20000)return this.cached&&this.cached.validUntil>now?this.cached:null;
  if(this.pending)return this.pending;
  this.pending=this.load().finally(()=>{this.pending=null;});return this.pending;
 }
 private async load():Promise<RadioNowPlaying|null>{
  try{
   const r=await this.fetcher(ENDPOINT+'?_='+this.now(),{signal:AbortSignal.timeout(8000),cache:'no-store',redirect:'error'});
   if(!r.ok||Number(r.headers.get('content-length')??0)>16384)throw Error('Metadata unavailable');
   if(!r.body)throw Error('Empty response');const reader=r.body.getReader(),chunks:Uint8Array[]=[];let length=0;
   try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>16384)throw Error('Metadata too large');chunks.push(next.value);}}finally{await reader.cancel().catch(()=>undefined);}
   const joined=new Uint8Array(length);let offset=0;for(const part of chunks){joined.set(part,offset);offset+=part.length;}
   this.cached=parseRadioMetadata(JSON.parse(new TextDecoder().decode(joined)),this.now());
  }catch{this.cached=null;}
  this.checkedAt=this.now();return this.cached;
 }
}
