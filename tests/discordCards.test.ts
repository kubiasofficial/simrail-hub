import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {validateEvent} from '../community-relay/worker.mjs';
import {discordPayload} from '../src/services/DrivingJournal';
const NOW=Date.parse('2026-11-28T08:00:00Z');
const card=(kind:string,title:string,values:Record<string,string>)=>validateEvent({eventId:randomUUID(),kind,revision:0,payload:discordPayload(title,Object.entries(values).map(([name,value])=>({name,value})),NOW)},NOW);
const start=()=>card('drive-start','kubiasofficial právě převzal vlak 53117',{'Trasa':'Gdynia Główna → Kraków Płaszów','Začátek řízení':'Warszawa Wschodnia','Místo':'Stanice podle aktuální polohy a zastavení vlaku','Server':'CZ1'});
it('turns an unchanged released-client payload into a compact branded takeover card',()=>{
 const p=start(),e=p.embeds[0];expect(p.username).toBe('SimRail Hub');expect(p.avatar_url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/kubiasofficial\/simrail-hub\/main\/build\/icon\.png$/);
 expect(e.title).toBe('🚆 Převzetí vlaku · 53117');expect(e.description).toBe('Strojvůdce **kubiasofficial**');expect(e.fields.map((f:any)=>f.name)).toEqual(['Trasa vlaku','Převzetí','Server']);
 expect(e.fields.find((f:any)=>f.name==='Server')).toMatchObject({value:'🇨🇿 CZ1',inline:true});expect(e.fields[0].inline).toBe(false);expect(e.footer.text).toBe('SimRail Hub · Komunitní evidence');
});
it('keeps manually entered locations and interrupted elapsed time truthful while removing redundant field labels',()=>{
 const e=card('drive-end','Eidik ukončil řízení vlaku 14035',{'Trasa':'Warszawa Grochów → Wien Westbahnhof','Začátek řízení':'Warszawa Centralna','Konec řízení':'Katovice','Místo':'Ručně uvedené strojvedoucím','Doba evidence':'183 min · zahrnuje přerušení aplikace','Server':'CZ1','Zpoždění – odhad z launcheru':'+6 min','Poznámka':'Díky za jízdu.'}).embeds[0];
 expect(e.title).toContain('14035');expect(e.fields.find((f:any)=>f.name==='Čas evidence').value).toBe('3 h 3 min\nVčetně přerušení');expect(e.fields.find((f:any)=>f.name==='Ukončení · zadáno ručně').value).toBe('Katovice');expect(e.fields.some((f:any)=>f.name==='Místo')).toBe(false);expect(e.fields.find((f:any)=>f.name==='Zpoždění · odhad').value).toBe('+6 min');expect(e.fields.find((f:any)=>f.name==='Poznámka').value).toContain('Díky');
});
it('does not manufacture a verified station when the location is approximate, unknown or manually entered',()=>{
 for(const location of ['V blízkosti stanice Koluszki','Na úseku A → B','Poloha při převzetí nedostupná']){
  const e=card('drive-start','Tester právě převzal vlak 1935',{'Trasa':'A → B','Začátek řízení':location,'Místo':'Úsek odvozený z aktuálního indexu jízdního řádu','Server':'INT1'}).embeds[0];
  expect(e.fields.find((f:any)=>f.name==='Převzetí').value).toBe(location);expect(e.fields.find((f:any)=>f.name==='Server').value).toBe('🌐 INT1');expect(JSON.stringify(e)).not.toMatch(/ověřen|potvrzen|✅/i);
 }
});
it('formats shift plans as readable lines and retains the requirement to confirm a completed shift',()=>{
 const e=card('shift-start','Tester zahájil směnu',{'Doprava':'Osobní','Server':'PL3','Plánovaný konec':'18:00 · čas serveru','Plánované jízdy':'16133: A → B \| 61180: B → A','Přestávka':'30 min'}).embeds[0];
 expect(e.fields.find((f:any)=>f.name==='Plán jízd').value).toBe('1. 16133: A → B\n2. 61180: B → A');
 const last=card('shift-arrival','Tester dorazil do cíle poslední plánované jízdy',{'Vlak':'61180','Místo pozorovaného příjezdu':'A','Stav':'Plánované jízdy pozorovány; ukončení směny potvrď v launcheru.','Zdroj':'PH příjezd pozorovaný launcherem při sledování vlaku.','Server':'PL3'}).embeds[0];
 expect(last.fields.find((f:any)=>f.name==='Další krok').value).toContain('potvrď');expect(last.footer.text).toContain('Pozorovaný příjezd');
});
it('does not turn nickname markdown into links or mentions and never accepts a caller-supplied avatar',()=>{
 const p=card('drive-start','@everyone **admin** [link](https://evil.invalid) právě převzal vlak 53117',{'Trasa':'[link](https://evil.invalid)','Začátek řízení':'@everyone','Server':'CZ1'}),e=p.embeds[0];
 expect(p.allowed_mentions.parse).toEqual([]);expect(e.description).not.toContain('@everyone');expect(e.description).not.toContain('[link](');expect(e.fields[0].value).not.toContain('[link](');expect(p.avatar_url).not.toContain('evil');
});
it('keeps transformed embeds within Discord limits even when escaping expands hostile input',()=>{
 const e=card('drive-end','Tester ukončil řízení vlaku 1',{'Trasa':'['.repeat(1024),'Začátek řízení':'['.repeat(1024),'Konec řízení':'['.repeat(1024),'Doba evidence':'191 min','Server':'CZ1','Poznámka':'['.repeat(1024),'Zpoždění – odhad z launcheru':'+1 min'}).embeds[0];
 expect(e.fields.every((f:any)=>f.value.length<=1024&&f.value.length>0)).toBe(true);expect(e.fields.reduce((n:number,f:any)=>n+f.name.length+f.value.length,0)+e.title.length+e.description.length+e.footer.text.length).toBeLessThanOrEqual(6000);
});
