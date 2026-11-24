import {it,expect,vi,afterEach} from 'vitest';
import {SharedApiFetch} from '../src/services/SharedApiFetch';
import {fetchJson} from '../src/adapters/simrailApi';
import {ServerService} from '../src/services/ServerService';
import {SettingsService} from '../src/services/SettingsService';
import {Database} from '../src/services/Database';
import {writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {tmp} from './helpers';import {voiceForLanguage} from '../src/services/voiceCatalog';
afterEach(()=>vi.useRealTimers());
it('shares in-flight requests and a bounded TTL across consumers',async()=>{
 let now=100;const network=vi.fn(async()=>({ok:true,status:200,text:async()=>'{"data":[]}'}));const cache=new SharedApiFetch(network,()=>now);
 const url='https://panel.simrail.eu:8084/trains-open?serverCode=cz1';await Promise.all([cache.fetch(url),cache.fetch(url),cache.fetch(url)]);expect(network).toHaveBeenCalledTimes(1);
 now+=1499;await cache.fetch(url);expect(network).toHaveBeenCalledTimes(1);now+=1;await cache.fetch(url);expect(network).toHaveBeenCalledTimes(2);
});
it('backs off repeated network errors without presenting stale data as fresh',async()=>{
 let now=0;const network=vi.fn(async()=>{throw Error('offline');}),cache=new SharedApiFetch(network,()=>now);const url='https://panel.simrail.eu:8084/trains-open?serverCode=cz1';
 await expect(cache.fetch(url)).rejects.toThrow('offline');now=1999;await expect(cache.fetch(url)).rejects.toThrow();expect(network).toHaveBeenCalledTimes(1);
 now=2000;await expect(cache.fetch(url)).rejects.toThrow();expect(network).toHaveBeenCalledTimes(2);
 now=5999;await expect(cache.fetch(url)).rejects.toThrow();expect(network).toHaveBeenCalledTimes(2);
});
it('times out a stalled response body even when the adapter ignores abort',async()=>{
 vi.useFakeTimers();const result=fetchJson(async()=>({ok:true,status:200,text:()=>new Promise(()=>{})}),'https://panel.simrail.eu:8084/servers-open',50);const assertion=expect(result).rejects.toMatchObject({kind:'timeout'});await vi.advanceTimersByTimeAsync(51);await assertion;
});
it('shared network requests release stalled work after deadline',async()=>{
 vi.useFakeTimers();const cache=new SharedApiFetch(async()=>new Promise(()=>{}));const result=cache.fetch('https://panel.simrail.eu:8084/servers-open');const assertion=expect(result).rejects.toThrow(/limit/);await vi.advanceTimersByTimeAsync(10001);await assertion;
});
it('legacy JSON migration preserves all recognized local preferences',async()=>{
 const d=await tmp(),file=join(d,'settings.json');await writeFile(file,JSON.stringify({appLanguage:'pl',manualGamePath:'C:/Games/SimRail',theme:'graphite',announcements:{gapSeconds:45},recordingsPath:'C:/private/voices'}));
 const db=new Database(':memory:'),settings=new SettingsService(db,file);expect(await settings.get()).toMatchObject({appLanguage:'pl',manualGamePath:'C:/Games/SimRail',theme:'graphite',announcements:{gapSeconds:45},recordingsPath:'C:/private/voices'});db.close();
});
it('simultaneous local updates do not overwrite unrelated preference changes',async()=>{
 const db=new Database(':memory:'),settings=new SettingsService(db);await Promise.all([settings.update({theme:'graphite'}),settings.update({appLanguage:'pl'}),settings.update({map:{followSelected:true}})]);expect(await settings.get()).toMatchObject({theme:'graphite',appLanguage:'pl',map:{followSelected:true}});db.close();
});
it('selects Czech and Polish models by segment language',()=>{expect(voiceForLanguage('pl','cs_CZ-jirka-medium')).toBe('pl_PL-darkman-medium');expect(voiceForLanguage('cs','pl_PL-darkman-medium')).toBe('cs_CZ-jirka-medium');});

it('recognizes the real camel-case timetable endpoint without retaining a second long-lived JSON copy',async()=>{
 const network=vi.fn(async()=>({ok:true,status:200,text:async()=>'[]'})),cache=new SharedApiFetch(network);
 const url='https://api1.aws.simrail.eu:8082/api/getAllTimetables?serverCode=cz1';
 await cache.fetch(url);await cache.fetch(url);expect(network).toHaveBeenCalledTimes(2);
 vi.useFakeTimers();const stalled=new SharedApiFetch(async()=>new Promise(()=>{}));let rejected=false;const waiting=stalled.fetch(url).catch(()=>{rejected=true;});
 await vi.advanceTimersByTimeAsync(10001);expect(rejected).toBe(false);await vi.advanceTimersByTimeAsync(10000);await waiting;expect(rejected).toBe(true);
});
