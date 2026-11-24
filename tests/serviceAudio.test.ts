import {it,expect} from 'vitest';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmp} from './helpers';
import {LocalRecordings,recordingNames,encodeWav,decodeWav} from '../src/services/localAudio';
import {SERVICE_ANNOUNCEMENTS,isServiceAnnouncementId} from '../src/services/serviceAnnouncements';
const request={kind:'delay' as const,station:null,trainNumber:'23905',isFreight:false};
it('uses generic personal recordings in passenger trains beyond the 53xxx station set',()=>{
 expect(recordingNames(request)).toEqual(['zpozdeni.wav']);
 expect(recordingNames({...request,kind:'terminal'})).toEqual(['konecna.wav']);
 expect(recordingNames({...request,isFreight:true})).toBeNull();
 for(const [service,clip] of Object.entries(SERVICE_ANNOUNCEMENTS)){
  expect(recordingNames({...request,service:service as keyof typeof SERVICE_ANNOUNCEMENTS})).toEqual([clip.file]);
  expect(recordingNames({...request,isFreight:true,service:service as keyof typeof SERVICE_ANNOUNCEMENTS})).toBeNull();
 }
});
it('accepts only whitelisted clips and maps the door/exit announcement to vystupovani',()=>{
 expect(SERVICE_ANNOUNCEMENTS.exit.file).toBe('vystupovani.wav');
 for(const value of ['../../secret','constructor','__proto__','toString',null,12])expect(isServiceAnnouncementId(value)).toBe(false);
 expect(recordingNames({...request,service:'../../secret' as never})).toBeNull();
});
it('renders one clip with exactly one optional gong, reports each available recording',async()=>{
 const directory=await tmp(),service=new LocalRecordings(directory);
 expect(await service.render({...request,service:'welcome'},true)).toBeNull();
 const samples=new Float32Array(9600).fill(.1);
 await writeFile(join(directory,'vitejte.wav'),encodeWav(samples));
 const status=await service.status();
 expect(status.services.filter(s=>s.available).map(s=>s.id)).toEqual(['welcome']);
 const plain=decodeWav((await service.render({...request,service:'welcome'},false))!);
 const gong=decodeWav((await service.render({...request,service:'welcome'},true))!);
 expect(plain.length).toBe(9600);expect(gong.length-plain.length).toBe(64800);
});
