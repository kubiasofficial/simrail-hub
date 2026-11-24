import {it,expect} from 'vitest';
import {DlcService} from '../src/services/DlcService';
import snapshot from '../src/data/dlc-snapshot.json';
import type {FetchLike} from '../src/adapters/simrailApi';
it('includes announced upcoming DLC even if the base app lists released DLC only, and shares concurrent requests',async()=>{
 const calls:string[]=[];const fetcher:FetchLike=async url=>{calls.push(url);const id=Number(new URL(url).searchParams.get('appids'));const item=snapshot.items.find(x=>x.id===id);const data=id===1422130?{dlc:snapshot.items.filter(x=>!x.upcoming).map(x=>x.id)}:{name:item!.name,header_image:item!.image,release_date:{coming_soon:item!.upcoming,date:item!.releaseDate},price_overview:item!.price?{final_formatted:item!.price,currency:item!.currency}:undefined};return {ok:true,status:200,text:async()=>JSON.stringify({[id]:{success:true,data}})};};
 const service=new DlcService(fetcher,()=>2000000000000);const [a,b]=await Promise.all([service.get(),service.get()]);
 expect(a).toBe(b);expect(a.items.find(x=>x.id===5548340)?.upcoming).toBe(true);expect(calls).toHaveLength(snapshot.items.length+1);
 await service.get();expect(calls).toHaveLength(snapshot.items.length+1);
});
it('hides cached Czech prices in other regions and delays retries after a failed fetch',async()=>{
 let now=2000000000000,count=0;const service=new DlcService(async()=>{count++;throw Error('offline');},()=>now);
 const first=await service.get('pl');expect(first.cached).toBe(true);expect(first.items.every(x=>x.price===null)).toBe(true);const before=count;
 await service.get('pl');expect(count).toBe(before);now+=60001;await service.get('pl');expect(count).toBeGreaterThan(before);
 await expect(service.get('xx')).rejects.toThrow();
});
