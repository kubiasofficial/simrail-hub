import {it,expect} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmp} from './helpers';
import {LocalRecordings,encodeWav,decodeWav,RECORDING_FILES} from '../src/services/localAudio';
it('ships all approved public clips with verified hashes, format and nonempty speech',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../assets/recordings/manifest.json',import.meta.url),'utf8'));
 expect(manifest.files).toHaveLength(174);expect(new Set(manifest.files.map((r:{file:string})=>r.file)).size).toBe(174);
 for(const clip of manifest.files){expect(clip.file).toMatch(/^[a-z0-9_]+\.wav$/);const bytes=await readFile(new URL('../assets/recordings/'+clip.file,import.meta.url));expect(bytes.length).toBe(clip.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(clip.sha256);const samples=decodeWav(bytes);expect(samples.length).toBeGreaterThan(4800);expect(samples.some(x=>Math.abs(x)>.01)).toBe(true);}
 expect(manifest.optionalMissing).toEqual(['vanoce_behem_jizdy.wav']);
 for(const name of RECORDING_FILES)expect(manifest.files.some((r:{file:string})=>r.file===name)).toBe(true);
});
it('uses bundled phrase and station when a chosen personal folder is empty, while local overrides win per file',async()=>{
 const own=await tmp(),bundled=await tmp();const short=new Float32Array(4800).fill(.1),long=new Float32Array(9600).fill(.1);
 await writeFile(join(bundled,'pristi_stanice.wav'),encodeWav(long));await writeFile(join(bundled,'kutno.wav'),encodeWav(long));
 const service=new LocalRecordings(own,bundled),request={kind:'next-station' as const,station:'Kutno',trainNumber:'1801',isFreight:false};
 expect(decodeWav((await service.render(request,false))!).length).toBe(24000);
 await writeFile(join(own,'kutno.wav'),encodeWav(short));expect(decodeWav((await service.render(request,false))!).length).toBe(19200);
 expect(await service.render({...request,isFreight:true},false)).toBeNull();
 expect(await service.render({...request,station:'Unknown'},false)).toBeNull();
});
it('makes the built-in pack usable on a clean machine with no personal directory',async()=>{
 const service=new LocalRecordings(join(await tmp(),'does-not-exist'),fileURLToPath(new URL('../assets/recordings/',import.meta.url)));
 const status=await service.status();expect(status.available).toBe(true);expect(status.services.filter(s=>s.available)).toHaveLength(14);
 expect(await service.render({kind:'delay',station:null,trainNumber:'23901',isFreight:false,service:'christmas_farewell'},false)).not.toBeNull();
});
