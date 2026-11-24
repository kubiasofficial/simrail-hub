import type {AppUpdater} from 'electron-updater';
export interface AutomaticUpdateState {
 status:'idle'|'checking'|'current'|'downloading'|'ready'|'error'|'manual';
 version?:string; percent?:number; message:string;
}
export class AutomaticUpdates {
 private state:AutomaticUpdateState;
 private checking=false; private downloading=false;
 constructor(private engine:AppUpdater|null, supported:boolean) {
  this.state=supported&&engine?{status:'idle',message:'Aktualizace se stahují automaticky na pozadí.'}:{status:'manual',message:'Pro automatické aktualizace jednou nainstalujte instalační verzi SimRail Hub.'};
  if(!supported||!engine){this.engine=null;return;}
  engine.autoDownload=false; engine.autoInstallOnAppQuit=false; engine.allowPrerelease=false; engine.allowDowngrade=false;
  engine.on('checking-for-update',()=>{if(!this.downloading)this.state={status:'checking',message:'Hledám novou verzi…'};});
  engine.on('update-not-available',()=>{if(!this.downloading)this.state={status:'current',message:'Používáte nejnovější verzi.'};});
  engine.on('update-available',info=>{
   if(this.downloading||this.state.status==='ready')return;
   this.downloading=true;this.state={status:'downloading',version:info.version,percent:0,message:'Stahuji aktualizaci na pozadí…'};
   void engine.downloadUpdate().catch(e=>this.fail()).finally(()=>{this.downloading=false;});
  });
  engine.on('download-progress',p=>{this.state={...this.state,status:'downloading',percent:Math.max(0,Math.min(100,p.percent)),message:'Stahuji aktualizaci na pozadí…'};});
  engine.on('update-downloaded',info=>{this.state={status:'ready',version:info.version,percent:100,message:'Aktualizace je připravena. Restartujte, až se vám to hodí.'};});
  engine.on('error',()=>this.fail());
 }
 private fail(){this.state={status:'error',message:'Aktualizace se nezdařila. Zkuste kontrolu znovu.'};}
 status():AutomaticUpdateState{return {...this.state};}
 async check():Promise<AutomaticUpdateState>{
  if(!this.engine||this.checking||this.downloading||this.state.status==='ready')return this.status();
  this.checking=true;try{await this.engine.checkForUpdates();}catch{this.fail();}finally{this.checking=false;}
  return this.status();
 }
 install():boolean{if(!this.engine||this.state.status!=='ready')return false;this.engine.quitAndInstall(true,true);return true;}
}
