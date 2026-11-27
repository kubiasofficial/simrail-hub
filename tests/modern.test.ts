import { describe,it,expect,vi } from 'vitest';
import { parseStations,parseTrains } from '../src/adapters/trainsApi';
import { SteamProfiles } from '../src/services/SteamProfiles';
import { computeOnboard,DelayTracker } from '../src/services/onboard';
import { DemoSim } from '../src/services/demoSim';
import { MobileServer } from '../src/services/MobileServer';
import type { TrainTrackingService } from '../src/services/TrainTrackingService';
import { resolve } from 'node:path';
describe('documented SimRail fields',()=>{
 it('retains vehicles and Steam identity from TrainData',()=>{
  const t=parseTrains({data:[{TrainNoLocal:'123',Vehicles:['EN57/EN57-612'],Type:'user',TrainData:{Latititute:50,Longitute:19,ControlledBySteamID:'76561198000000000'}}]},'cz1').trains[0];
  expect(t.vehicles).toEqual(['EN57/EN57-612']);expect(t.steamId).toBe('76561198000000000');
 });
 it('retains station photos and dispatcher IDs without inventing avatars',()=>{
  const s=parseStations({data:[{Name:'A',Latititude:50,Longitude:19,MainImageURL:'https://api.simrail.eu:8083/a.jpg',DispatchedBy:[{SteamId:'76561198000000000'},{SteamId:'invalid'}]}]})[0];
  expect(s.dispatchers).toEqual([{steamId:'76561198000000000'}]);expect(s.imageUrl).toContain('/a.jpg');
 });
});
describe('Steam profile lookup',()=>{
 it('deduplicates concurrent requests and accepts only trusted avatar hosts',async()=>{
  const fn=vi.fn(async()=>({ok:true,text:async()=>'<profile><avatarMedium><![CDATA[https://avatars.fastly.steamstatic.com/test.jpg]]></avatarMedium></profile>'}));const profiles=new SteamProfiles(fn);
  const r=await Promise.all([profiles.avatar('76561198000000000'),profiles.avatar('76561198000000000')]);expect(r[0]).toContain('steamstatic.com');expect(fn).toHaveBeenCalledTimes(1);await profiles.avatar('76561198000000000');expect(fn).toHaveBeenCalledTimes(1);
 });
 it('rejects invalid IDs, third-party image URLs, and unavailable profiles',async()=>{
  const fn=vi.fn(async()=>({ok:true,text:async()=>'<avatarMedium>https://evil.example/a.jpg</avatarMedium>'}));const p=new SteamProfiles(fn);expect(await p.avatar('../')).toBeNull();expect(fn).not.toHaveBeenCalled();expect(await p.avatar('76561198000000000')).toBeNull();
 });
});
it('keeps arrival trigger distance distinct from next displayed stop distance',()=>{
 const snap=new DemoSim(0).snapshot(0);const m=computeOnboard({...snap,nowSod:snap.nowSod,tracker:new DelayTracker(),connection:'demo'});
 expect(m.phase).toBe('standing');expect(m.distanceToNextStopM).toBeLessThan(300);expect(m.distanceToFollowingStopM).toBeGreaterThan(300);
});
it('mobile pairing gates data, restricts methods, blocks traversal and invalidates old sessions',async()=>{
 const snap=new DemoSim(0).snapshot(0);
 const tracking={getDetail:async()=>({ok:true,data:{...snap,serverSod:snap.nowSod,notes:[]}})} as unknown as TrainTrackingService;
 const service=new MobileServer(tracking,resolve('public'),()=>({test:[{address:'192.168.0.2',family:'IPv4',internal:false,netmask:'255.255.255.0',mac:'00:00:00:00:00:00',cidr:'192.168.0.2/24'}]}));
 try{const session=await service.start('cz1','123');const target=new URL(session.urls[0]);const base=`http://127.0.0.1:${target.port}`;
 expect((await fetch(base+'/api/state')).status).toBe(401);
 const pair=await fetch(base+target.pathname+target.search,{redirect:'manual'});expect(pair.status).toBe(200);expect(pair.headers.get('location')).toBeNull();expect(pair.headers.get('set-cookie')).toContain('SameSite=Lax');expect(await pair.text()).toContain('Palubní displej');const cookie=pair.headers.get('set-cookie')!.split(';')[0];
 const reused=await service.start('cz1','123');expect(reused.urls).toEqual(session.urls);expect(reused.expiresAt).toEqual(session.expiresAt);
 const headers={cookie};expect((await fetch(base+'/api/state',{headers})).status).toBe(200);expect((await fetch(base+'/api/state',{method:'POST',headers})).status).toBe(405);expect((await fetch(base+'/package.json',{headers})).status).toBe(404);
 const replacement=await service.start('cz1','456');const newer=new URL(replacement.urls[0]);expect((await fetch('http://127.0.0.1:'+newer.port+'/api/state',{headers})).status).toBe(401);
 }finally{service.stop();}
});
