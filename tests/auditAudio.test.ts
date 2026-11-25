import {it,expect,vi,afterEach} from 'vitest';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';import {join} from 'node:path';
import {TextToSpeechService,VOICES,PIPER_PACKAGE,type TtsDeps} from '../src/services/TextToSpeechService';
import {Database} from '../src/services/Database';import {tmp} from './helpers';
import {AnnouncementQueue} from '../src/services/announcementQueue';
import {DelayTracker} from '../src/services/onboard';
import {DemoSim} from '../src/services/demoSim';
import {SettingsService} from '../src/services/SettingsService';
afterEach(()=>vi.useRealTimers());
async function service(){const d=await tmp(),db=new Database(':memory:');let active=0,peak=0;
 const deps:TtsDeps={platform:'win32',downloadFile:vi.fn(async(url,dest)=>{await mkdir(join(dest,'..'),{recursive:true});await writeFile(dest,url.endsWith('.json')?'{"audio":{"sample_rate":22050}}':Buffer.alloc(2000000));return {bytes:2000000,sha256:VOICES.find(v=>v.jsonUrl===url)?.configSha256??VOICES.find(v=>v.onnxUrl===url)?.sha256??PIPER_PACKAGE.sha256};}),
 extractZip:async(_,dest)=>{await mkdir(join(dest,'piper'),{recursive:true});await writeFile(join(dest,'piper/piper.exe'),'fake');},
 runPiper:vi.fn(async(_,args)=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));await writeFile(args[args.indexOf('--output_file')+1],'RIFFfake');active--;})};
 const svc=new TextToSpeechService(d,db,deps);await svc.installPiper(()=>{});await svc.installVoice('cs_CZ-jirka-medium',()=>{});return {d,db,deps,svc,peak:()=>peak};
}
it('deduplicates identical synthesis and serializes other Piper jobs',async()=>{
 const {svc,deps,peak,db}=await service();await Promise.all([svc.synthesize('A','cs_CZ-jirka-medium',1),svc.synthesize('A','cs_CZ-jirka-medium',1),svc.synthesize('B','cs_CZ-jirka-medium',1)]);
 expect(deps.runPiper).toHaveBeenCalledTimes(2);expect(peak()).toBe(1);db.close();
});
it('rejects corrupted voice downloads without overwriting the installed model',async()=>{
 const {svc,deps,d,db}=await service();const file=join(d,'voices/cs_CZ-jirka-medium.onnx');const before=await readFile(file);
 vi.mocked(deps.downloadFile).mockImplementationOnce(async(_,dest)=>{await writeFile(dest,'broken');return {bytes:6,sha256:'wrong'};});
 await expect(svc.installVoice('cs_CZ-jirka-medium',()=>{})).rejects.toThrow(/součet/);expect(await readFile(file)).toEqual(before);await expect(access(file+'.json.part')).rejects.toThrow();db.close();
});
it('cache eviction never deletes a path supplied by a corrupted database row',async()=>{
 const {svc,d,db}=await service(),sentinel=join(d,'important.txt');await writeFile(sentinel,'keep');
 db.db.prepare('INSERT INTO tts_cache VALUES(?,?,?,?)').run('a'.repeat(64),sentinel,220*1024*1024,0);
 await svc.synthesize('New','cs_CZ-jirka-medium',1);expect(await readFile(sentinel,'utf8')).toBe('keep');db.close();
});
it('removes obsolete delayed speech and can announce a revisited run after resetting history',async()=>{
 vi.useFakeTimers();const played:string[]=[];const queue=new AnnouncementQueue(async s=>{played.push(s.text);},Date.now,undefined,{gapMs:()=>30000});
 const first={key:'first',kind:'next-station' as const,automatic:true,station:'A',segments:[{lang:'cs' as const,text:'A'}]};queue.enqueue(first);await vi.advanceTimersByTimeAsync(0);
 queue.enqueue({key:'delay',kind:'delay',automatic:true,segments:[{lang:'cs',text:'delay'}]});queue.discard(x=>x.kind==='delay');await vi.advanceTimersByTimeAsync(30000);expect(played).toEqual(['A']);
 queue.clear();queue.resetHistory();expect(queue.enqueue(first)).toBe(true);await vi.advanceTimersByTimeAsync(0);expect(played).toEqual(['A','A']);queue.clear();
});
it('invalidates observed delay on clock loss or rollback',()=>{
 const points=new DemoSim(0).timetable.points,tracker=new DelayTracker();tracker.observe('run',0,28800,points);tracker.observe('run',1,28830,points);
 expect(tracker.current(points,1,28830)).not.toBeNull();tracker.observe('run',1,null,points);expect(tracker.current(points,1,null)).toBeNull();
 tracker.observe('run',0,100,points);expect(tracker.current(points,0,100)).toBeNull();
});
it('preserves raw damaged settings before saving repaired defaults',async()=>{
 const db=new Database(':memory:');db.setKv('settings','{broken');const svc=new SettingsService(db);await svc.get();await svc.update({theme:'graphite'});expect(db.getKv('settings.corrupt.backup')).toBe('{broken');expect(JSON.parse(db.getKv('settings')!).theme).toBe('graphite');db.close();
});
