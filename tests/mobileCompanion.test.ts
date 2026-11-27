import {it,expect} from 'vitest';import {resolve} from 'node:path';
import {MobileServer} from '../src/services/MobileServer';import {DemoSim} from '../src/services/demoSim';
it('mobile sends actual freshness and category; rail routes use the same private cookie',async()=>{
 const snap=new DemoSim(0).snapshot(0),now=200000;
 const tracking={getDetail:async()=>({ok:true,data:{...snap,train:{...snap.train,name:'EIP'},serverSod:snap.nowSod,fetchedAt:now-45000,notes:[]}})};
 let routeCalls=0;const route={trainNumber:'35104',runId:'r',sections:[],stops:[],totalPoints:1,matchedPoints:0,missingSections:0,sourceDate:'2026-11-25',first:null,last:null};
 const service=new MobileServer(tracking as never,resolve('public'),(()=>({wifi:[{address:'192.168.1.2',family:'IPv4',internal:false}]})) as never,()=>now,async(code,number)=>{expect(code).toBe('cz1');expect(number).toBe('35104');routeCalls++;return route;});
 try{const pair=await service.start('cz1','35104'),url=new URL(pair.urls[0]);url.hostname='127.0.0.1';const root=await fetch(url),cookie=root.headers.get('set-cookie')!.split(';')[0],base=url.origin;
 expect((await fetch(base+'/api/route')).status).toBe(401);expect(routeCalls).toBe(0);
 const data=await fetch(base+'/api/state',{headers:{cookie}}).then(r=>r.json());expect(data.fetchedAt).toBe(now-45000);expect(data.model.connection).toBe('lost');expect(data.category.key).toBe('EIP');
 expect(await fetch(base+'/api/route',{headers:{cookie}}).then(r=>r.json())).toEqual(route);expect(routeCalls).toBe(1);
 expect((await fetch(base+'/api/route',{method:'POST',headers:{cookie}})).status).toBe(405);
 expect((await fetch(base+'/api/route',{headers:{cookie,Origin:'https://example.com'}})).status).toBe(403);expect(routeCalls).toBe(1);
 }finally{service.stop();}
});

it('reports host-measured data age and build identity and updates stale status even when the snapshot is cached',async()=>{
 const snap=new DemoSim(0).snapshot(0);let now=200000,calls=0;
 const tracking={getDetail:async()=>{calls++;return {ok:true,data:{...snap,serverSod:snap.nowSod,fetchedAt:186000,notes:[]}};}};
 const service=new MobileServer(tracking as never,resolve('public'),(()=>({wifi:[{address:'192.168.1.2',family:'IPv4',internal:false}]})) as never,()=>now,undefined,{version:'0.8.3',channel:'test',buildId:'verified-test'});
 try{const pair=await service.start('cz1','35104'),url=new URL(pair.urls[0]);url.hostname='127.0.0.1';const root=await fetch(url),cookie=root.headers.get('set-cookie')!.split(';')[0];
 const get=()=>fetch(url.origin+'/api/state',{headers:{cookie}}).then(r=>r.json());
 const first=await get();expect(first.dataAgeMs).toBe(14000);expect(first.serverNowMs).toBe(now);expect(first.app).toMatchObject({version:'0.8.3',channel:'test',buildId:'verified-test',mobileRevision:'2026-11-28.1'});expect(first.model.connection).toBe('live');expect(first.presentation.times).toHaveProperty('arrival');
 now+=2000;const second=await get();expect(calls).toBe(1);expect(second.fetchedAt).toBe(first.fetchedAt);expect(second.dataAgeMs).toBe(16000);expect(second.model.connection).toBe('stale');
 expect((await fetch(url.origin+'/app.js?v=20261128-1',{headers:{cookie}})).headers.get('cache-control')).toBe('no-store');
 }finally{service.stop();}
});
