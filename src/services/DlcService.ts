import snapshot from '../data/dlc-snapshot.json';
import type {DlcCatalog,DlcItem} from '../types/dlc';
import type {FetchLike} from '../adapters/simrailApi';
export class DlcService {
 private cache=new Map<string,DlcCatalog>();private cachedAt=new Map<string,number>();private pending=new Map<string,Promise<DlcCatalog>>();
 constructor(private fetchFn:FetchLike,private now:()=>number=Date.now){}
 async get(region='cz'):Promise<DlcCatalog>{
  if(!/^(cz|de|pl|fr|sk|at|be|bg|hr|cy|dk|ee|fi|gr|hu|ie|it|lv|lt|lu|mt|nl|pt|ro|si|es|se|gb|us)$/.test(region))throw Error('Nepodporovaný region obchodu.');
  const hit=this.cache.get(region);if(hit&&this.now()-(this.cachedAt.get(region)??0)<(hit.cached?60000:3600000))return hit;
  const busy=this.pending.get(region);if(busy)return busy;
  const work=this.load(region).finally(()=>this.pending.delete(region));this.pending.set(region,work);return work;
 }
 private async details(id:number,region:string):Promise<Record<string,unknown>>{
  const r=await this.fetchFn('https://store.steampowered.com/api/appdetails?appids='+id+'&cc='+region+'&l=czech',{signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Steam není dostupný.');const body=await r.text();if(body.length>2000000)throw Error('Neplatná odpověď Steamu.');
  const value=JSON.parse(body)[String(id)];if(!value?.success||!value.data)throw Error('Položka na Steamu není dostupná.');return value.data;
 }
 private async load(region:string):Promise<DlcCatalog>{
  const seed=snapshot.items as DlcItem[];let ids=seed.map(x=>x.id);let failed=false;
  try{const base=await this.details(1422130,region);if(Array.isArray(base.dlc))ids=[...new Set([...ids,...base.dlc.filter((id):id is number=>Number.isInteger(id)&&id>0)])].slice(0,40);}catch{failed=true;}
  const items:DlcItem[]=[];
  for(let offset=0;offset<ids.length;offset+=3){
   const batch=await Promise.all(ids.slice(offset,offset+3).map(async id=>{
    const fallback=seed.find(x=>x.id===id);
    try{const v=await this.details(id,region);const date=v.release_date as {date?:string;coming_soon?:boolean}|undefined,p=v.price_overview as {final_formatted?:string;currency?:string;discount_percent?:number}|undefined;
     return {id,name:String(v.name??'DLC').replace('SimRail - The Railway Simulator: ',''),image:String(v.header_image??fallback?.image??''),fallbackImage:fallback?.fallbackImage??'',url:'https://store.steampowered.com/app/'+id+'/',upcoming:date?.coming_soon===true,releaseDate:date?.date||null,price:p?.final_formatted??null,currency:p?.currency??null,discount:p?.discount_percent??0} satisfies DlcItem;
    }catch{failed=true;return fallback?{...fallback,...(region!=='cz'?{price:null,currency:null}:{})}:null;}
   }));items.push(...batch.filter((x):x is DlcItem=>x!==null));
  }
  const result:DlcCatalog={items,region,checkedAt:failed?snapshot.checkedAt:this.now(),cached:failed};this.cache.set(region,result);this.cachedAt.set(region,this.now());return result;
 }
}
