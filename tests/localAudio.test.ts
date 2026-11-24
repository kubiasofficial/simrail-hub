import {it,expect} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmp} from './helpers';
import {LocalRecordings,recordingNames,encodeWav,decodeWav,trimSilence,gongSamples} from '../src/services/localAudio';
import {portableSettings} from '../src/services/CloudAccount';
import {DEFAULT_SETTINGS} from '../src/types/settings';
it('selects the phrase and exact playable station only for passenger trains 53xxx',()=>{
 const request={kind:'next-station' as const,station:'Kraków Główny',trainNumber:'53103',isFreight:false};
 expect(recordingNames(request)).toEqual(['pristi_stanice.wav','krakow_glowny.wav']);
 expect(recordingNames({...request,isFreight:true})).toBeNull();
 expect(recordingNames({...request,trainNumber:'5301'})).toBeNull();
 expect(recordingNames({...request,station:'Zakopane'})).toBeNull();
 expect(recordingNames({...request,station:'../../outside'})).toBeNull();
 expect(recordingNames({...request,kind:'delay'})).toEqual(['zpozdeni.wav']);
});
it('synthesizes a bounded gong and encodes a playable PCM WAV',()=>{
 const samples=gongSamples();expect(samples.length).toBe(60000);
 expect(Math.max(...samples.slice(0,10000))).toBeGreaterThan(.1);
 expect(samples.every(x=>Math.abs(x)<1)).toBe(true);
 const decoded=decodeWav(encodeWav(samples));expect(decoded.length).toBe(samples.length);
 expect(()=>decodeWav(new Uint8Array(44))).toThrow();
});
it('trims long pauses while preserving padding around speech',()=>{
 const samples=new Float32Array(48000*3);samples.fill(.1,48000,96000);
 const trimmed=trimSilence(samples);expect(trimmed.length).toBeGreaterThan(48000);expect(trimmed.length).toBeLessThan(60000);
});
it('renders gong, phrase, pause and station as a single cancellable sound; missing files allow TTS',async()=>{
 const directory=await tmp();const service=new LocalRecordings(directory);
 const request={kind:'next-station' as const,station:'Kraków Główny',trainNumber:'53103',isFreight:false};
 expect(await service.render(request,true)).toBeNull();
 const tone=new Float32Array(4800).fill(.1);for(const name of ['pristi_stanice.wav','krakow_glowny.wav'])await writeFile(join(directory,name),encodeWav(tone));
 const plain=decodeWav((await service.render(request,false))!);const withGong=decodeWav((await service.render(request,true))!);
 expect(withGong.length-plain.length).toBe(64800);
 expect((await service.status()).missing).toHaveLength(9);
});
it('does not put local recording folders into cloud settings',()=>{
 expect(portableSettings({...DEFAULT_SETTINGS,recordingsPath:'C:/private/voice'})).not.toHaveProperty('recordingsPath');
});
