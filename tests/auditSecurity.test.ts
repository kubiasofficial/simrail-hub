import {it,expect,afterEach} from 'vitest';
import {request} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {MobileServer,privateAddress} from '../src/services/MobileServer';
import {appDocument,externalHttps} from '../src/services/windowSecurity';
import {boundedUnzip} from '../src/services/boundedZip';
import {ModManager,readModArchive,validModId} from '../src/services/ModManager';
import {LogService} from '../src/services/LogService';
import {tmp} from './helpers';
const servers:MobileServer[]=[];afterEach(()=>{for(const s of servers.splice(0))s.stop();});
async function mobile(){let now=10000;const d=await tmp();await mkdir(join(d,'mobile'));await writeFile(join(d,'mobile/index.html'),'<html>mobile</html>');
 const tracking={getDetail:async()=>({ok:true,data:{train:null,timetable:null,stations:[],serverSod:null,fetchedAt:now,notes:[]}})};
 const s=new MobileServer(tracking as never,d,(()=>({wifi:[{address:'192.168.1.2',internal:false,family:'IPv4'}]})) as never,()=>now);servers.push(s);
 const pair=await s.start('cz1','53103');const url=new URL(pair.urls[0]);url.hostname='127.0.0.1';
 return {s,url,advance:(ms:number)=>now+=ms};
}
function get(url:URL,headers:Record<string,string>={},method='GET'):Promise<{status:number;headers:Record<string,unknown>;body:string}>{
 return new Promise((resolve,reject)=>{const req=request(url,{method,headers},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,body}));});req.on('error',reject);req.end();});
}
it('mobile pairs, requires a cookie, rejects rebinding, cross-origin requests and unsafe methods',async()=>{
 const {url}=await mobile();const root=await get(url);expect(root.status).toBe(200);expect(root.headers['cache-control']).toBe('no-store');
 const set=(root.headers['set-cookie'] as string[])[0];expect(set).toContain('HttpOnly');expect(set).toContain('SameSite=Lax');const cookie=set.split(';')[0],api=new URL('/api/state',url);
 expect((await get(api)).status).toBe(401);expect((await get(api,{Cookie:cookie})).status).toBe(200);
 expect((await get(api,{Cookie:cookie,Host:'attacker.example:'+url.port})).status).toBe(403);
 expect((await get(api,{Cookie:cookie,Origin:'https://attacker.example'})).status).toBe(403);
 expect((await get(api,{Cookie:cookie,'Sec-Fetch-Site':'cross-site'})).status).toBe(403);
 expect((await get(api,{Cookie:cookie},'POST')).status).toBe(405);
});
it('mobile expires and invalidates old cookies when changing trains',async()=>{
 const {s,url,advance}=await mobile();const root=await get(url);const cookie=(root.headers['set-cookie'] as string[])[0].split(';')[0];
 advance(12*3600000+1);expect((await get(new URL('/api/state',url),{Cookie:cookie})).status).toBe(401);
 const fresh=await s.start('cz1','53105');const next=new URL(fresh.urls[0]);next.hostname='127.0.0.1';expect((await get(new URL('/api/state',next),{Cookie:cookie})).status).toBe(401);
 s.stop();await expect(get(next)).rejects.toThrow();
});
it('mobile rate limit bounds repeated requests',async()=>{const {url}=await mobile();const api=new URL('/api/state',url);let code=0;for(let n=0;n<121;n++)code=(await get(api)).status;expect(code).toBe(429);});
it('private address validation rejects public and malformed ranges',()=>{expect(['127.0.0.1','10.0.0.1','192.168.2.2','172.16.0.1','::ffff:192.168.1.2'].every(privateAddress)).toBe(true);expect(['8.8.8.8','172.15.0.1','192.168.999.1','evil','::1'].some(privateAddress)).toBe(false);});
it('privileged documents and external URLs have explicit boundaries',()=>{
 const entry='file:///C:/app/dist/index.html';expect(appDocument(entry+'#dashboard?server=cz1',entry)).toBe(true);
 expect(appDocument('file:///C:/private/file.html',entry)).toBe(false);expect(appDocument('https://example.com',entry)).toBe(false);
 expect(appDocument('http://localhost:5173.evil/',entry,'http://localhost:5173')).toBe(false);
 expect(externalHttps('https://store.steampowered.com/app/1422130/')).toBe(true);
 for(const url of ['javascript:alert(1)','file:///C:/x','https://user:secret@example.com','https://example.com/\n'])expect(externalHttps(url)).toBe(false);
});
it('ZIP actual output size is bounded before retaining an expanded bomb',()=>{
 const bomb=zipSync({'large.json':strToU8('a'.repeat(3000000))});expect(bomb.byteLength).toBeLessThan(10000);
 expect(()=>boundedUnzip(bomb,2000000,8)).toThrow(/velký/);
});
it('corrupt or oversized backup leaves installed modifications unchanged',async()=>{
 const d=await tmp(),mods=new ModManager(join(d,'mods'),join(d,'backup'),'0.5.0');const manifest={id:'safe-mod',name:'Safe',version:'1.0',author:'A',source:'local',type:'pronunciation-dictionary'};
 await mods.importArchive(zipSync({'simrail-hub-mod.json':strToU8(JSON.stringify(manifest)),'pronunciations.json':strToU8('[]')}));
 await mkdir(join(d,'backup'));await writeFile(join(d,'backup/mods-bomb.zip'),zipSync({'huge':strToU8('x'.repeat(41000000))}));
 await expect(mods.restore('mods-bomb.zip')).rejects.toThrow();expect((await mods.list())[0].id).toBe('safe-mod');
});
it('logs redact bearer tokens, cookies and QR query parameters',async()=>{
 const d=await tmp(),log=new LogService(d);log.error('mobile','http://192.168.1.2/?pair=abcdef1234',Error('Bearer sensitive.token hub=deadbeef'));
 const text=log.read();expect(text).not.toContain('abcdef1234');expect(text).not.toContain('sensitive.token');expect(text).not.toContain('deadbeef');expect(text).toContain('[redacted]');
});

it('rejects Windows device names and trailing-dot aliases for modification IDs',()=>{
 for(const id of ['con','nul','com1','lpt9.data','safe-mod.'])expect(validModId(id)).toBe(false);
 expect(validModId('safe-mod')).toBe(true);
});
it('rejects duplicated ZIP entries rather than silently overwriting them',()=>{
 const raw=Buffer.from(zipSync({'one.json':strToU8('{}'),'two.json':strToU8('{}')}));
 for(let offset=0;(offset=raw.indexOf('two.json',offset))>=0;offset+=8)raw.write('one.json',offset,'ascii');
 expect(()=>boundedUnzip(raw,10000,8)).toThrow(/duplicitní/);
});
