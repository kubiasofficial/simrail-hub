import catalog from './wiki-media.json';

export type WikiVehicle = {label:string;page:string;image:string|null;variants:Record<string,string>};
export type WikiStation = {name:string;image:string;page:string};
const vehicles = catalog.vehicles as Record<string,WikiVehicle>;
const aliases:Record<string,string>={'4e':'eu07','102e':'ep08','71e':'cd163','cd163':'cd163','201e':'et22','dragon2':'dragon','e6acta':'dragon','traxx':'traxx','e186':'traxx','br285':'br285','pendolino':'pendolino','en57':'kibel','en71':'kibel','kibel':'kibel','elf':'elf','impuls':'impuls','36wed':'impuls','ty2':'ty2'};
const key=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const variant=(s:string)=>s.split('/').pop()!.split(':')[0].replace(/\s+variant\s*$/i,'').trim();
export function vehicleInfo(items:string[]) {
  for(const value of items){
    const label=variant(value),id=key(label);
    const exact=Object.values(vehicles).find(v=>v.variants[id]);
    // EP08 can be reported under the API's 4E group. Prefer the visible vehicle designation.
    const byDesignation=/^ep08/i.test(label)?'ep08':/^en71/i.test(label)?'kibel':undefined;
    const family=exact??vehicles[byDesignation??aliases[value.split('/')[0].toLowerCase()]];
    if(family)return {label,family:family.label,image:exact?.variants[id]??family.image,fallbackImage:family.image,page:family.page,exact:!!exact,known:true};
  }
  return {label:items[0]?variant(items[0]):'Vozidlo nerozpoznáno',family:'Železniční vozidlo',image:null,fallbackImage:null,page:null,exact:false,known:false};
}
export const stationKey=(s:string)=>s.toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
export function stationMedia(name:string):WikiStation|null {
  return (catalog.stations as Record<string,WikiStation>)[stationKey(name)]??null;
}
export const heroMedia=catalog.hero;
