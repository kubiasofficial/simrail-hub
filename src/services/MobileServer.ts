import { createServer, type Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TrainTrackingService } from './TrainTrackingService';
import { computeOnboard, DelayTracker } from './onboard';

export class MobileServer {
  private server: Server | null = null;
  private token=''; private expiresAt=0; private code=''; private train=''; private tracker=new DelayTracker();
  private cached: {at:number;value:unknown}|null=null; private pending:Promise<unknown>|null=null; private generation=0;
  private urls:string[]=[];
  constructor(private tracking:TrainTrackingService, private staticDir:string,private interfaces:typeof networkInterfaces=networkInterfaces) {}
  stop() { this.generation++;this.pending=null;this.server?.closeAllConnections();this.server?.close();this.server=null;this.token='';this.cached=null;this.urls=[]; }
  private valid(value:string) {const a=Buffer.from(value),b=Buffer.from(this.token);return a.length===b.length&&a.length>0&&timingSafeEqual(a,b)&&Date.now()<this.expiresAt;}
  private async state() {
    if(this.cached&&Date.now()-this.cached.at<4500)return this.cached.value;
    if(this.pending)return this.pending;
    const generation=this.generation;const tracker=this.tracker;
    const task=(async()=>{const r=await this.tracking.getDetail(this.code,this.train);if(!r.ok)throw new Error(r.error);if(generation!==this.generation)throw new Error('Párování bylo změněno.');
      const value={...r.data,model:r.data.train?computeOnboard({train:r.data.train,timetable:r.data.timetable,stations:r.data.stations,nowSod:r.data.serverSod,tracker,connection:'live'}):null};this.cached={at:Date.now(),value};return value;})().finally(()=>{if(this.pending===task)this.pending=null;});this.pending=task;return task;
  }
  async start(code:string,train:string) {
    if(!/^[\w-]{1,40}$/.test(code)||!/^\d{1,12}$/.test(train))throw new Error('Vyberte platný server a vlak.');
    if(this.server&&this.code===code&&this.train===train&&Date.now()<this.expiresAt)return {urls:this.urls,expiresAt:this.expiresAt};
    this.stop();this.code=code;this.train=train;this.tracker=new DelayTracker();this.token=randomBytes(24).toString('hex');this.expiresAt=Date.now()+12*3600000;
    const assets:Record<string,[string,string]>={'/':['mobile/index.html','text/html; charset=utf-8'],'/app.js':['mobile/app.js','text/javascript; charset=utf-8'],'/style.css':['mobile/style.css','text/css'],'/leaflet.js':['vendor/leaflet.js','text/javascript'],'/leaflet.css':['vendor/leaflet.css','text/css']};
    const server=createServer(async(req,res)=>{
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'");
      if(req.method!=='GET'){res.writeHead(405);res.end();return;}
      const remote=req.socket.remoteAddress??'';
      if(!/^(::ffff:)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(remote)&&remote!=='::1'){res.writeHead(403);res.end();return;}
      const url=new URL(req.url??'/','http://localhost');
      const key=url.searchParams.get('pair');
      // Serve the landing page directly: QR scanner/in-app browsers may discard a Strict
      // cookie across a cross-site redirect and incorrectly display an expired session.
      if(key&&this.valid(key)){
        res.setHeader('Set-Cookie',`hub=${this.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
        try{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(join(this.staticDir,'mobile/index.html')));}catch{res.writeHead(503);res.end('Mobilní stránku se nepodařilo načíst.');}return;
      }
      const cookie=/(?:^|;\s*)hub=([a-f0-9]+)/.exec(req.headers.cookie??'')?.[1]??'';
      if(!this.valid(cookie)){res.writeHead(401,{'Content-Type':'text/plain; charset=utf-8'});res.end('Připojení vypršelo. Načtěte nový QR kód v launcheru.');return;}
      try{
        if(url.pathname==='/api/state'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await this.state()));return;}
        const asset=assets[url.pathname];if(!asset){res.writeHead(404);res.end();return;}
        const content=await readFile(join(this.staticDir,asset[0]));res.setHeader('Content-Type',asset[1]);res.end(content);
      }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Data se nepodařilo načíst. Připojení zkusíme znovu.'}));}
    });
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'0.0.0.0',()=>{server.off('error',reject);resolve();});});this.server=server;
    const port=(server.address() as {port:number}).port;
    const ips=Object.values(this.interfaces()).flat().filter((x):x is NonNullable<typeof x>=>!!x&&!x.internal&&x.family==='IPv4'&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address)).map(x=>x.address);
    if(!ips.length){this.stop();throw new Error('Počítač není připojený k místní síti. Připojte telefon a počítač ke stejné Wi-Fi.');}
    this.urls=ips.map(ip=>`http://${ip}:${port}/?pair=${this.token}`);
    return {urls:this.urls,expiresAt:this.expiresAt};
  }
}
