import {journeyDelay,journeyMotion,nextStopTimes} from './journeyPresentation';
import type {TrainDetailPayload} from '../types/trains';
import type {OnboardModel} from './onboard';
import {trainCategory} from './trainCategory';
import type {TrainRoute} from '../types/route';
import {createServer,type Server} from 'node:http';
import {networkInterfaces} from 'node:os';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {isIPv4} from 'node:net';
import type {TrainTrackingService} from './TrainTrackingService';
import {computeOnboard,DelayTracker} from './onboard';

export function privateAddress(raw:string):boolean{
 const ip=raw.replace(/^::ffff:/,'');if(!isIPv4(ip))return false;const [a,b]=ip.split('.').map(Number);
 return a===127||a===10||(a===192&&b===168)||(a===172&&b>=16&&b<=31);
}
export const MOBILE_REVISION='2026-11-28.1';
type MobileBase=TrainDetailPayload&{category:ReturnType<typeof trainCategory>|null;model:OnboardModel|null};
export class MobileServer{
 private server:Server|null=null;private token='';private expiresAt=0;private code='';private train='';private tracker=new DelayTracker();
 private cached:{at:number;value:MobileBase}|null=null;private pending:Promise<ReturnType<MobileServer['present']>>|null=null;private generation=0;
 private urls:string[]=[];private network='';private starting:Promise<{urls:string[];expiresAt:number}>|null=null;
 constructor(private tracking:TrainTrackingService,private staticDir:string,private interfaces:typeof networkInterfaces=networkInterfaces,private now:()=>number=Date.now,private routeProvider?:(code:string,train:string)=>Promise<TrainRoute>,private identity:{version:string;channel:string;buildId:string|null}={version:'development',channel:'test',buildId:null}){}
 stop(){this.generation++;this.pending=null;this.server?.closeAllConnections();this.server?.close();this.server=null;this.token='';this.cached=null;this.urls=[];}
 private valid(value:string){const a=Buffer.from(value),b=Buffer.from(this.token);return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)&&this.now()<this.expiresAt;}
 private present(value:MobileBase){
  const serverNowMs=this.now(),dataAgeMs=Math.max(0,serverNowMs-value.fetchedAt),connection=dataAgeMs>=30000?'lost':dataAgeMs>=15000?'stale':'live';
  const model=value.model?{...value.model,connection:connection as OnboardModel['connection']}:null;
  return {...value,model,serverNowMs,dataAgeMs,app:{...this.identity,mobileRevision:MOBILE_REVISION},presentation:model?{motion:journeyMotion(model),delay:journeyDelay(model),times:nextStopTimes(model)}:null};
 }
 private async state(){
  if(this.cached&&this.now()-this.cached.at<4500)return this.present(this.cached.value);if(this.pending)return this.pending;
  const generation=this.generation,tracker=this.tracker;
  const task=(async()=>{const r=await this.tracking.getDetail(this.code,this.train);if(!r.ok)throw Error(r.error);if(generation!==this.generation)throw Error('Párování bylo změněno.');
   const age=this.now()-r.data.fetchedAt;const connection=age>=30000?'lost':age>=15000?'stale':'live';
   const value:MobileBase={...r.data,category:r.data.train?trainCategory(r.data.train):null,model:r.data.train?computeOnboard({train:r.data.train,timetable:r.data.timetable,stations:r.data.stations,nowSod:r.data.serverSod,tracker,connection}):null};
   this.cached={at:this.now(),value};return this.present(value);
  })().finally(()=>{if(this.pending===task)this.pending=null;});this.pending=task;return task;
 }
 async start(code:string,train:string):Promise<{urls:string[];expiresAt:number}>{
  if(this.starting){const generation=this.generation;await this.starting.catch(()=>undefined);if(generation!==this.generation)throw Error('Párování bylo zrušeno.');return this.start(code,train);}
  const task=this.startServer(code,train);this.starting=task;try{return await task;}finally{if(this.starting===task)this.starting=null;}
 }
 private async startServer(code:string,train:string){
  if(!/^[\w-]{1,40}$/.test(code)||!/^\d{1,12}$/.test(train))throw Error('Vyberte platný server a vlak.');
  const ips=[...new Set(Object.values(this.interfaces()).flat().filter((x):x is NonNullable<typeof x>=>!!x&&!x.internal&&x.family==='IPv4'&&privateAddress(x.address)).map(x=>x.address))].sort();
  const network=ips.join('|');if(this.server&&this.code===code&&this.train===train&&network===this.network&&this.now()<this.expiresAt)return {urls:this.urls,expiresAt:this.expiresAt};
  this.stop();if(!ips.length)throw Error('Počítač není připojený k místní síti. Připojte telefon a počítač ke stejné Wi-Fi.');
  this.network=network;this.code=code;this.train=train;this.tracker=new DelayTracker();this.token=randomBytes(24).toString('hex');this.expiresAt=this.now()+12*3600000;
  const generation=this.generation,hosts=new Set<string>(),rates=new Map<string,{at:number;count:number}>();let active=0;
  const assets:Record<string,[string,string]>={'/':['mobile/index.html','text/html; charset=utf-8'],'/app.js':['mobile/app.js','text/javascript; charset=utf-8'],'/style.css':['mobile/style.css','text/css'],'/leaflet.js':['vendor/leaflet.js','text/javascript'],'/leaflet.css':['vendor/leaflet.css','text/css']};
  const server=createServer({maxHeaderSize:8192},async(req,res)=>{
   res.setTimeout(25000,()=>res.destroy());
   const remote=(req.socket.remoteAddress??'').replace(/^::ffff:/,'');const host=req.headers.host??'';
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
   const deny=(status:number,message='Připojení není dostupné.')=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(message);};
   if(!privateAddress(remote)||!hosts.has(host)||((host.startsWith('localhost:')||host.startsWith('127.'))&&!remote.startsWith('127.'))){deny(403);return;}
   if(req.method!=='GET'){deny(405);return;}if(!req.url?.startsWith('/')||req.url.startsWith('//')){deny(400);return;}
   const time=this.now(),rate=rates.get(remote);if(!rate||time-rate.at>=60000)rates.set(remote,{at:time,count:1});else if(++rate.count>120){res.setHeader('Retry-After','60');deny(429);return;}
   if(rates.size>128){for(const [key,value] of rates)if(time-value.at>=60000)rates.delete(key);if(rates.size>128){deny(429);return;}}
   if(active>=16){deny(503);return;}active++;res.once('close',()=>active--);
   const url=new URL(req.url,'http://'+host),key=url.searchParams.get('pair');
   if(key&&this.valid(key)){
    res.setHeader('Set-Cookie','hub='+this.token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+Math.max(0,Math.floor((this.expiresAt-time)/1000)));
    try{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(join(this.staticDir,'mobile/index.html')));}catch{deny(503);}return;
   }
   if((req.headers.origin&&req.headers.origin!=='http://'+host)||req.headers['sec-fetch-site']==='cross-site'){deny(403);return;}
   const cookie=/(?:^|;\s*)hub=([a-f0-9]+)/.exec(req.headers.cookie??'')?.[1]??'';
   if(!this.valid(cookie)){deny(401,'Připojení vypršelo. Načtěte nový QR kód v launcheru.');return;}
   try{
    if(url.pathname==='/api/route'){if(!this.routeProvider){deny(503);return;}const generation=this.generation,value=await this.routeProvider(this.code,this.train);if(generation!==this.generation){deny(401);return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;}
    if(url.pathname==='/api/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await this.state()));return;}
    const asset=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:null;if(!asset){deny(404);return;}res.setHeader('Content-Type',asset[1]);res.end(await readFile(join(this.staticDir,asset[0])));
   }catch{if(!res.destroyed){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Data se nepodařilo načíst. Připojení zkusíme znovu.'}));}}
  });
  server.maxConnections=32;server.maxHeadersCount=30;server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'0.0.0.0',()=>{server.off('error',reject);resolve();});});
  if(generation!==this.generation){server.closeAllConnections();server.close();throw Error('Párování bylo zrušeno.');}
  this.server=server;const port=(server.address() as {port:number}).port;
  for(const ip of [...ips,'127.0.0.1','localhost'])hosts.add(ip+':'+port);
  this.urls=ips.map(ip=>'http://'+ip+':'+port+'/?pair='+this.token);return {urls:this.urls,expiresAt:this.expiresAt};
 }
}
