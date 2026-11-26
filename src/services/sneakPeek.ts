import type {SneakPeekCatalog,SneakPeekRoute} from '../types/sneakPeek';
let pending:Promise<SneakPeekCatalog>|null=null;
export function validateSneakPeek(value:unknown):SneakPeekCatalog {
 const v=value as SneakPeekCatalog;
 if(v?.version!==1||!Array.isArray(v.routes)||v.routes.length>12)throw Error('Náhled tratí není platný.');
 const ids=new Set<string>();
 for(const r of v.routes){
  if(!r.id||ids.has(r.id)||!r.name||!Array.isArray(r.geometry)||r.geometry.length<2||r.geometry.length>10000||!Array.isArray(r.stations)||r.stations.length>100||!/^https:\/\/store\.steampowered\.com\/app\/\d+\//.test(r.officialUrl)||!new RegExp('^https://store\\.steampowered\\.com/app/'+r.steamAppId+'/(?:[A-Za-z0-9_-]+/)?$').test(r.officialUrl)||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(r.releaseMonth))throw Error('Neplatný úsek náhledu.');
  ids.add(r.id);
  if(r.geometry.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>90||Math.abs(p[1])>180)||r.stations.some(s=>!s.name||!Number.isFinite(s.lat)||!Number.isFinite(s.lon)))throw Error('Neplatné souřadnice náhledu.');
 }
 return v;
}
export function loadSneakPeek():Promise<SneakPeekCatalog>{
 if(!pending)pending=import('../data/sneak-peek.json').then(m=>validateSneakPeek(m.default)).catch(e=>{pending=null;throw e;});
 return pending;
}
export function previewRelease(route:SneakPeekRoute,now=new Date()):string {
 const [year,month]=route.releaseMonth.split('-').map(Number);
 const label=new Intl.DateTimeFormat('cs',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
 return label+(now.getUTCFullYear()*12+now.getUTCMonth()>year*12+month-1?' · termín je potřeba znovu ověřit':'');
}
