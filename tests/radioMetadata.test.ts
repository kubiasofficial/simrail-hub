import {it,expect,vi} from 'vitest';
import {parseRadioMetadata,RadioMetadataService} from '../src/services/RadioMetadataService';
const now=1800000000000;
const song={from:now/1000-20,to:now/1000+120,c_artist:'A &amp; B',c_title:'<b>Song</b> &quot;Live&quot;'};
it('decodes official metadata safely and rejects old, future or malformed song records',()=>{
 expect(parseRadioMetadata(song,now)).toMatchObject({artist:'A & B',title:'Song "Live"',validUntil:now+60000});
 for(const raw of [null,{}, {...song,to:now/1000}, {...song,from:now/1000+10},{...song,c_title:''},{...song,to:'oops'}])expect(parseRadioMetadata(raw,now)).toBeNull();
});
it('coalesces requests, caches briefly, never requests custom stream URLs, and expires old titles',async()=>{
 let clock=now;const fetcher=vi.fn(async()=>new Response(JSON.stringify(song)));const service=new RadioMetadataService(fetcher as typeof fetch,()=>clock);
 expect(await service.get('https://localhost/private')).toBeNull();expect(fetcher).not.toHaveBeenCalled();
 const [a,b]=await Promise.all([service.get('kiss'),service.get('kiss')]);expect(a).toEqual(b);expect(fetcher).toHaveBeenCalledTimes(1);
 clock+=19000;expect(await service.get('kiss')).toEqual(a);expect(fetcher).toHaveBeenCalledTimes(1);
 clock+=2000;await service.get('kiss');expect(fetcher).toHaveBeenCalledTimes(2);
 clock=now+121000;expect(await service.get('kiss')).toBeNull();
});
it('metadata errors and oversized streams fail closed without affecting playback',async()=>{
 for(const fetcher of [async()=>{throw Error('offline');},async()=>new Response('x'.repeat(17000)),async()=>new Response('{}',{status:503})])expect(await new RadioMetadataService(fetcher as typeof fetch,()=>now).get('kiss')).toBeNull();
});
