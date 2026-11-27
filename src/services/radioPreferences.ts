export interface RadioStation {id:string;name:string;url:string}
export interface RadioPreferences {volume:number;muted:boolean;duck:'lower'|'mute'|'off';selectedId:string;stations:RadioStation[]}
// Direct audio source linked by https://www.kiss.cz/online/ (checked 2026-11-27).
export const KISS:RadioStation={id:'kiss',name:'Rádio Kiss',url:'https://stream.rcs.revma.com/asn0cmvb938uv'};
export const DEFAULT_RADIO:RadioPreferences={volume:.65,muted:false,duck:'lower',selectedId:'kiss',stations:[KISS]};
export function validStream(value:unknown):value is string {if(typeof value!=='string'||value.length>2000)return false;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch{return false;}}
export function normalizeRadio(raw:unknown):RadioPreferences{
 const r=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const stations:RadioStation[]=[KISS];
 if(Array.isArray(r.stations))for(const value of r.stations.slice(0,12)){if(stations.length>=12)break;if(!value||typeof value!=='object')continue;const s=value as RadioStation;if(typeof s.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(s.id)||stations.some(t=>t.id===s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>60||!validStream(s.url))continue;stations.push({id:s.id,name:s.name.trim(),url:s.url});}
 const selectedId=typeof r.selectedId==='string'&&stations.some(s=>s.id===r.selectedId)?r.selectedId:'kiss';
 return {volume:typeof r.volume==='number'&&Number.isFinite(r.volume)?Math.max(0,Math.min(1,r.volume)):.65,muted:r.muted===true,duck:r.duck==='mute'||r.duck==='off'?r.duck:'lower',selectedId,stations};
}
export function effectiveRadioVolume(p:Pick<RadioPreferences,'volume'|'muted'|'duck'>,speaking:boolean){return p.muted?0:p.volume*(speaking?(p.duck==='mute'?0:p.duck==='lower'?.15:1):1);}
