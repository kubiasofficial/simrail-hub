import {CLOUD} from './cloudConfig';
import type {Settings,SettingsPatch} from '../types/settings';
import {normalizeSettings} from './settingsSchema';

export interface AccountStatus {email:string;uid:string}
type Session=AccountStatus&{idToken:string;refreshToken:string;expires:number};
export function portableSettings(settings:Settings):SettingsPatch {
 const {animations,theme,appLanguage,appCountry,dataRefreshSeconds,selectedServer,map,announcements}=settings;
 return {animations,theme,appLanguage,appCountry,dataRefreshSeconds,selectedServer,map,announcements};
}
export class CloudAccount {
 private session:Session|null=null;
 constructor(private request:typeof fetch=fetch){}
 status():AccountStatus|null{return this.session?{email:this.session.email,uid:this.session.uid}:null;}
 logout(){this.session=null;}
 private async json(url:string,method:string,body?:unknown,token?:string){
  const form=url.startsWith('https://securetoken.googleapis.com/');
  const r=await this.request(url,{method,headers:{'Content-Type':form?'application/x-www-form-urlencoded':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:form?new URLSearchParams(body as Record<string,string>).toString():JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await r.json() as any;
  if(!r.ok){if(r.status===404&&url.includes('firestore.googleapis.com'))throw Error('V cloudu zatím není uložené nastavení. Nejprve ho uložte.');const code=String(data.error?.message??r.status).split(' : ')[0];const messages:Record<string,string>={INVALID_LOGIN_CREDENTIALS:'Nesprávný e-mail nebo heslo.',EMAIL_EXISTS:'Účet s tímto e-mailem již existuje.',WEAK_PASSWORD:'Heslo musí mít alespoň 8 znaků.',TOO_MANY_ATTEMPTS_TRY_LATER:'Příliš mnoho pokusů. Zkuste to později.',OPERATION_NOT_ALLOWED:'Přihlašování zatím není zapnuté.',PERMISSION_DENIED:'K těmto datům nemáte přístup.'};throw Error(messages[code]??'Cloudová operace selhala ('+code+').');}
  return data;
 }
 async login(email:string,password:string,create=false){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Zadejte platný e-mail.');
  if(password.length<(create?8:1)||password.length>256)throw Error('Pro nový účet použijte heslo o délce 8 až 256 znaků.');
  const data=await this.json(`https://identitytoolkit.googleapis.com/v1/accounts:${create?'signUp':'signInWithPassword'}?key=${CLOUD.apiKey}`,'POST',{email,password,returnSecureToken:true});
  this.session={email:data.email??email,uid:data.localId,idToken:data.idToken,refreshToken:data.refreshToken,expires:Date.now()+Number(data.expiresIn)*1000};return this.status()!;
 }
 private async active(){
  if(!this.session)throw Error('Nejprve se přihlaste.');
  if(this.session.expires-Date.now()<60000){const data=await this.json(`https://securetoken.googleapis.com/v1/token?key=${CLOUD.apiKey}`,'POST',{grant_type:'refresh_token',refresh_token:this.session.refreshToken});this.session={...this.session,idToken:data.id_token,refreshToken:data.refresh_token,expires:Date.now()+Number(data.expires_in)*1000};}
  return this.session;
 }
 private document(uid:string){return `https://firestore.googleapis.com/v1/projects/${CLOUD.projectId}/databases/(default)/documents/users/${uid}/settings/current`;}
 async save(settings:Settings){const s=await this.active();await this.json(this.document(s.uid),'PATCH',{fields:{payload:{stringValue:JSON.stringify(portableSettings(settings))},updatedAt:{timestampValue:new Date().toISOString()},schemaVersion:{integerValue:'1'}}},s.idToken);return null;}
 async load():Promise<SettingsPatch>{const s=await this.active();const d=await this.json(this.document(s.uid),'GET',undefined,s.idToken);const raw=JSON.parse(d.fields?.payload?.stringValue??'{}');return portableSettings(normalizeSettings(raw));}
 async reset(email:string){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Zadejte platný e-mail.');await this.json(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${CLOUD.apiKey}`,'POST',{requestType:'PASSWORD_RESET',email});return null;}
 async remove(){const s=await this.active();const r=await this.request(this.document(s.uid),{method:'DELETE',headers:{Authorization:'Bearer '+s.idToken},signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404)throw Error('Cloudová nastavení nelze odstranit.');await this.json(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${CLOUD.apiKey}`,'POST',{idToken:s.idToken});this.logout();return null;}
}
