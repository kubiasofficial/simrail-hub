import {SERVICE_ANNOUNCEMENTS,isServiceAnnouncementId,type ServiceAnnouncementId,type ServiceRecordingStatus} from './serviceAnnouncements';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import type {AnnKind} from './announcements';

const RATE=48000;
const STATIONS:Record<string,string>={'warszawa wschodnia':'warszawa_wschodnia','warszawa centralna':'warszawa_centralna','warszawa zachodnia':'warszawa_zachodnia','opoczno poludnie':'opoczno_poludnie','wloszczowa polnoc':'wloszczowa_polnoc','kozlow':'kozlow','miechow':'miechow','krakow glowny':'krakow_glowny','katowice':'katowice','sosnowiec glowny':'sosnowiec_glowny','zawiercie':'zawiercie','lask':'lask','pabianice':'pabianice','lodz kaliska':'lodz_kaliska','lodz zabieniec':'lodz_zabieniec','zgierz':'zgierz','lowicz glowny':'lowicz_glowny','grodzisk mazowiecki':'grodzisk_mazowiecki','zyrardow':'zyrardow','skierniewice':'skierniewice','koluszki':'koluszki','lodz widzew':'lodz_widzew','lodz chojny':'lodz_chojny','zdunska wola':'zdunska_wola','sosnowiec poludniowy':'sosnowiec_poludniowy'};
const PHRASES:Partial<Record<AnnKind,string>>={'next-station':'pristi_stanice',approaching:'prijizdime_do_stanice',arrived:'stanice'};
const norm=(s:string)=>s.toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
export const RECORDING_FILES=[...Object.values(PHRASES),...Object.values(STATIONS).slice(0,8)].map(s=>s+'.wav');
export interface RecordingRequest {kind:AnnKind;station:string|null;trainNumber:string|null;isFreight:boolean;service?:ServiceAnnouncementId}
export interface RecordingStatus {directory:string;available:boolean;missing:string[];services:ServiceRecordingStatus[]}
export function recordingNames(request:RecordingRequest):string[]|null {
 if(request.isFreight)return null;
 if(request.service!==undefined)return isServiceAnnouncementId(request.service)?[SERVICE_ANNOUNCEMENTS[request.service].file]:null;
 if(request.kind==='delay'||request.kind==='terminal')return [SERVICE_ANNOUNCEMENTS[request.kind].file];
 if(!/^(?:16|61|35|53|45|54)\d{2,3}$/.test(request.trainNumber??''))return null;
 const phrase=PHRASES[request.kind],station=STATIONS[norm(request.station??'')];
 return phrase&&station?[phrase+'.wav',station+'.wav']:null;
}
export function encodeWav(samples:Float32Array):Uint8Array {
 const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(RATE,24);b.writeUInt32LE(RATE*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
 return new Uint8Array(b);
}
export function decodeWav(b:Uint8Array):Float32Array {
 const v=Buffer.from(b);let fmt=false,data:Buffer|undefined;
 if(v.length<44||v.toString('ascii',0,4)!=='RIFF'||v.toString('ascii',8,12)!=='WAVE')throw Error('Nahrávka není platný WAV.');
 for(let pos=12;pos+8<=v.length;){const id=v.toString('ascii',pos,pos+4),size=v.readUInt32LE(pos+4),start=pos+8;if(start+size>v.length)throw Error('Neúplný WAV soubor.');if(id==='fmt '&&size>=16)fmt=v.readUInt16LE(start)===1&&v.readUInt16LE(start+2)===1&&v.readUInt32LE(start+4)===RATE&&v.readUInt16LE(start+14)===16;if(id==='data')data=v.subarray(start,start+size);pos=start+size+(size%2);}
 if(!fmt||!data||!data.length||data.length%2)throw Error('Nahrávky musí být WAV PCM, mono, 48 kHz, 16 bitů.');
 const samples=new Float32Array(data.length/2);for(let i=0;i<samples.length;i++)samples[i]=data.readInt16LE(i*2)/32768;
 return samples;
}
export function trimSilence(samples:Float32Array):Float32Array {
 let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));if(peak<.00001)throw Error('Nahrávka neobsahuje zvuk.');
 const threshold=Math.max(.0025,peak*.018),step=480;let first=-1,last=0;
 for(let pos=0;pos<samples.length;pos+=step){let energy=0;const count=Math.min(step,samples.length-pos);for(let i=0;i<count;i++)energy+=samples[pos+i]**2;if(Math.sqrt(energy/count)>threshold){if(first<0)first=pos;last=pos+count;}}
 if(first<0)return samples;
 return samples.slice(Math.max(0,first-3840),Math.min(samples.length,last+5760));
}
export function gongSamples():Float32Array {
 // Original three-tone bell, synthesized locally; no railway recording or external API.
 const output=new Float32Array(Math.round(RATE*1.25));
 [587.33,739.99,880].forEach((frequency,note)=>{const start=Math.round(note*.28*RATE);for(let i=0;start+i<output.length;i++){const t=i/RATE,attack=Math.min(1,t/.012),envelope=attack*Math.exp(-t*5);output[start+i]+=.24*envelope*(Math.sin(2*Math.PI*frequency*t)+.2*Math.sin(2*Math.PI*frequency*2.01*t)+.07*Math.sin(2*Math.PI*frequency*4.17*t));}});
 return output;
}
export function joinSamples(parts:Float32Array[]):Float32Array {const result=new Float32Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
export class LocalRecordings {
 constructor(private directory:string){}
 async status():Promise<RecordingStatus>{const missing:string[]=[];for(const file of RECORDING_FILES){try{const info=await stat(join(this.directory,file));if(!info.isFile())missing.push(file);}catch{missing.push(file);}}const services:ServiceRecordingStatus[]=[];
 for(const [id,entry] of Object.entries(SERVICE_ANNOUNCEMENTS)){let available=false;try{available=(await stat(join(this.directory,entry.file))).isFile();}catch{/* optional recording */}
 services.push({id:id as ServiceAnnouncementId,label:entry.label,available});}
 return {directory:this.directory,available:missing.length===0,missing,services};}
 async render(request:RecordingRequest,gong:boolean):Promise<Uint8Array|null>{
  const names=recordingNames(request);if(!names)return null;
  const audio:Float32Array[]=[];
  for(const name of names){let b:Buffer;try{const file=join(this.directory,name),info=await stat(file);if(info.size>5*1024*1024)throw Error('Nahrávka je příliš velká.');b=await readFile(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}audio.push(trimSilence(decodeWav(b)));}
  return encodeWav(joinSamples([...(gong?[gongSamples(),new Float32Array(4800)]:[]),...audio.flatMap((samples,index)=>index?[new Float32Array(4800),samples]:[samples])]));
 }
}

/** Original local radio squelch: deterministic filtered noise with a short release click. */
export function radioSamples(closing=false):Float32Array {
 const out=new Float32Array(Math.round(RATE*(closing?.32:.45)));let seed=271828,low=0;
 for(let i=0;i<out.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;low+=.12*(white-low);const t=i/RATE,envelope=Math.min(1,t/.012)*Math.min(1,(out.length-i)/(RATE*.04));out[i]=((white-low)*.12+Math.sin(2*Math.PI*(closing?1350:950)*t)*.035*Math.exp(-t*18))*envelope;}
 return out;
}
