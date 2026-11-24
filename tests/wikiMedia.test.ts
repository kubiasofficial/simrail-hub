import {describe,it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {vehicleInfo,stationMedia} from '../src/data/wikiMedia';
import catalog from '../src/data/wiki-media.json';

describe('wiki images matched to actual API vehicle identifiers',()=>{
 it('recognizes a variant after reversing/brake suffixes and ignores preceding wagons',()=>{
  const info=vehicleInfo(['412W/412W_123:G:48@Coal','4E/EU07-005:R']);
  expect(info.exact).toBe(true);expect(info.image).toContain('eu07-005.png');expect(info.family).toBe('EU07 / EP07');
 });
 it('keeps EP08 separate when the API reports the 4E group',()=>{
  const info=vehicleInfo(['4E/EP08-001:R']);expect(info.family).toBe('EP08');expect(info.image).toContain('ep08-001.png');
 });
 it('distinguishes ET22 and Czech locomotives from EU07',()=>{
  expect(vehicleInfo(['201E/ET22-836:G']).image).toContain('et22-836.png');
  expect(vehicleInfo(['CD163/163_021-9:R']).image).toContain('163_021-9.png');
 });
 it('strips the Variant suffix and uses a labeled family image for an unknown variant',()=>{
  expect(vehicleInfo(['Pendolino/ED250-018 Variant']).exact).toBe(true);
  const info=vehicleInfo(['4E/EU07-999:R']);expect(info.exact).toBe(false);expect(info.image).toContain('eu07-005.png');
  expect(vehicleInfo(['Unknown/Unknown-1']).image).toBeNull();
 });
 it('matches station names with Polish diacritics without inventing station matches',()=>{
  expect(stationMedia('Katowice')?.image).toContain('katowice/');
  expect(stationMedia('Bedzin')?.name).toBe('Będzin');expect(stationMedia('Unknown station')).toBeNull();
 });
 it('ships all local family fallbacks and only links remote images on the official wiki',()=>{
  for(const item of Object.values(catalog.vehicles)){
   expect(existsSync(resolve('public',item.image.slice(2)))).toBe(true);
   for(const image of Object.values(item.variants))expect(image.startsWith('./assets/wiki/')||image.startsWith('https://wiki.simrail.eu/vehicle/')).toBe(true);
  }
  for(const station of Object.values(catalog.stations))expect(station.image.startsWith('https://wiki.simrail.eu/stations/')).toBe(true);
 });
});
