import {ArrowUpRight,LocateFixed} from 'lucide-react';
import {previewRelease} from '@/services/sneakPeek';
import type {SneakPeekRoute} from '@/types/sneakPeek';
export function SneakPeekDetail({route,onFit}:{route:SneakPeekRoute;onFit:()=>void}){
 const date=(s:string)=>new Date(s).toLocaleDateString('cs');
 return <section className="peek-detail" aria-label="Detail připravované tratě">
  <div className="peek-cover"><img src={route.image} alt="Lublin Region – oficiální obrázek DLC"/><span>SNEAK PEEK</span></div>
  <div className="peek-detail-body"><span className="peek-status">Připravovaná trať</span><h2>{route.name}</h2><p className="peek-corridor">{route.corridor}</p>
   <dl className="peek-facts"><div><dt>Plán vydání</dt><dd>{previewRelease(route)}</dd></div><div><dt>Zakreslený úsek</dt><dd>přibližně {route.lengthKm.toLocaleString('cs')} km</dd></div></dl>
   <button className="secondary-action" onClick={onFit}><LocateFixed size={15}/>Zobrazit celou trať</button>
   <p className="peek-notice">Orientační průběh skutečné železnice podle OSM. Přesná herní geometrie ani zastávky konkrétních vlaků tím nejsou potvrzené.</p>
   <h3>Co už je v API</h3><p>Na serveru {route.apiEvidence.server.toUpperCase()} jsou v jízdních řádech názvy {route.apiEvidence.stationNames.join(', ')||'zatím nedoložené'}. {route.apiEvidence.coordinateStationCount===0?'API při kontrole neposkytlo souřadnice stanic tohoto úseku.':'Souřadnice náhledu pocházejí z OSM.'}</p>
   <details className="peek-stations"><summary>Body náhledu ({route.stations.length})</summary><ol>{route.stations.map(s=><li key={s.id}>{s.name}{s.apiNamePresent&&<small>název v API</small>}</li>)}</ol></details>
   <a className="peek-steam-link" href={route.officialUrl} target="_blank" rel="noreferrer">Podrobnosti DLC na Steamu<ArrowUpRight size={15}/></a>
   <details className="peek-sources"><summary>Původ a stáří údajů</summary><p>DLC a plán vydání ověřeny {date(route.officialCheckedAt)}. API {route.apiEvidence.server.toUpperCase()} zkontrolováno {date(route.apiEvidence.checkedAt)}. Náhled se neobnovuje jako živý provoz.</p><a href={route.geometrySource.url} target="_blank" rel="noreferrer">Kolejový průběh: OpenStreetMap ↗</a><a href={route.geometrySource.licenseUrl} target="_blank" rel="noreferrer">ODbL 1.0 · staženo {date(route.geometrySource.retrievedAt)} ↗</a></details>
  </div></section>;
}
