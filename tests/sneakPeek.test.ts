import {it,expect} from 'vitest';
import raw from '../src/data/sneak-peek.json';
import {validateSneakPeek,previewRelease} from '../src/services/sneakPeek';
import {normalizeSettings,applyPatch} from '../src/services/settingsSchema';
import {DEFAULT_SETTINGS} from '../src/types/settings';
import {haversineM} from '../src/services/geo';
it('loads a sourced upcoming corridor without claiming API or exact game coordinates',()=>{
 const {routes}=validateSneakPeek(raw),r=routes[0];expect(routes).toHaveLength(1);expect(r.name).toBe('Lublin Region');expect(r.lengthKm).toBeGreaterThan(140);expect(r.lengthKm).toBeLessThan(155);expect(r.geometry.length).toBeGreaterThan(100);expect(r.geometrySource.license).toBe('ODbL-1.0');expect(r.apiEvidence.coordinateStationCount).toBe(0);expect(r.apiEvidence.stationNames).toEqual(['Nałęczów','Lublin Zachodni','Lublin Główny']);
 const first=r.stations[0],last=r.stations.at(-1)!;expect(first.name).toBe('Dęblin');expect(last.name).toBe('Chełm');expect(haversineM(...r.geometry[0],first.lat,first.lon)).toBeLessThan(100);expect(haversineM(...r.geometry.at(-1)!,last.lat,last.lon)).toBeLessThan(100);
 for(let i=1;i<r.geometry.length;i++)expect(haversineM(...r.geometry[i-1],...r.geometry[i])).toBeLessThan(10000);
});
it('rejects invalid data, duplicate IDs, invalid coordinates and unrelated store links',()=>{
 expect(()=>validateSneakPeek({version:2,routes:[]})).toThrow();const invalid=()=>structuredClone(raw);
 let v=invalid();v.routes.push(v.routes[0]);expect(()=>validateSneakPeek(v)).toThrow();
 v=invalid();v.routes[0].geometry[0][0]=91;expect(()=>validateSneakPeek(v)).toThrow();
 v=invalid();v.routes[0].officialUrl='https://example.com/app/5548340/';expect(()=>validateSneakPeek(v)).toThrow();
 v=invalid();v.routes[0].officialUrl='https://store.steampowered.com/app/1234/';expect(()=>validateSneakPeek(v)).toThrow();
 v=invalid();v.routes[0].releaseMonth='2026-99';expect(()=>validateSneakPeek(v)).toThrow();
});
it('keeps sneak peek off for old settings and persists only an explicit boolean preference',()=>{
 expect(normalizeSettings({map:{basemap:'light'}}).map.sneakPeek).toBe(false);expect(normalizeSettings({map:{sneakPeek:'true'}}).map.sneakPeek).toBe(false);const enabled=applyPatch(DEFAULT_SETTINGS,{map:{sneakPeek:true}});expect(enabled.map.sneakPeek).toBe(true);expect(enabled.dispatcher).toEqual(DEFAULT_SETTINGS.dispatcher);expect(enabled.map.basemap).toBe(DEFAULT_SETTINGS.map.basemap);expect(normalizeSettings(enabled).map.sneakPeek).toBe(true);
});
it('labels an elapsed planned release as needing verification instead of marking the route playable',()=>{const r=validateSneakPeek(raw).routes[0];expect(previewRelease(r,new Date('2026-11-26T12:00:00Z'))).toBe('prosinec 2026');expect(previewRelease(r,new Date('2027-01-01T12:00:00Z'))).toContain('ověřit');});
