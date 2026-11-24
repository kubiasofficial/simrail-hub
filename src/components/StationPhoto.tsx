import { useState } from 'react';
import { stationMedia } from '@/data/wikiMedia';

export function StationPhoto({name,apiImage}:{name:string;apiImage?:string}) {
  const wiki=stationMedia(name);
  const [failed,setFailed]=useState<string[]>([]);
  const image=[wiki?.image,apiImage].find((url):url is string=>!!url&&!failed.includes(url));
  if(!image)return null;
  const isWiki=image===wiki?.image;
  return <figure className="station-figure"><img className="station-photo" src={image} alt={`Snímek ze hry: ${name}`} onError={()=>setFailed(previous=>[...previous,image])}/><figcaption>{isWiki?<a href={wiki.page} target="_blank" rel="noreferrer">Snímek ze hry · SimRail Wiki ↗</a>:<span>Snímek ze hry · SimRail API</span>}</figcaption></figure>;
}
