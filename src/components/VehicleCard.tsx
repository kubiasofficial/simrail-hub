import { useState } from 'react';
import { TrainFront } from 'lucide-react';
import { vehicleInfo } from '@/data/wikiMedia';
export { vehicleInfo } from '@/data/wikiMedia';

export function VehicleCard({vehicles,number}:{vehicles:string[];number?:string}) {
  const info=vehicleInfo(vehicles);
  const [failedImages,setFailedImages]=useState<string[]>([]);
  const image=[info.image,info.fallbackImage].find((url):url is string=>!!url&&!failedImages.includes(url));
  const exact=info.exact&&image===info.image;
  return <div className="vehicle-card">
    {image?<img src={image} alt={`Snímek ze hry: ${info.family}${exact?' · '+info.label:''}`} onError={()=>setFailedImages(previous=>[...previous,image])}/>:<div className="vehicle-placeholder"><TrainFront size={64}/><span>Snímek vozidla není dostupný</span></div>}
    {image&&<span className="vehicle-caption">{exact?'SNÍMEK ZE HRY · VARIANTA':'SNÍMEK ZE HRY · UKÁZKA TYPU'}</span>}
    <div><small>{info.family}{number?` · ${number}`:''}</small><strong>{info.label}</strong>{image&&info.page&&<a className="vehicle-source" href={info.page} target="_blank" rel="noreferrer">Zdroj: SimRail Wiki ↗</a>}</div>
  </div>;
}
