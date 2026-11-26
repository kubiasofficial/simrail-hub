import type {TrafficAlert} from './dispatcher';

export function trafficTooltip(alert:TrafficAlert,now=Date.now()):string {
 const stale=alert.state==='unverified'||!!alert.observedAt&&now-alert.observedAt>15000;
 const title=stale?'Čekáme na aktuální údaje':alert.state==='checking'?'Ověřuji uklidnění situace':alert.kind==='station'?'Provoz ve stanici':alert.kind==='density'?'Zvýšený provoz':'Pomalu jedoucí vlak';
 const lines=[title,alert.text];
 if(alert.sectionFrom&&alert.sectionTo)lines.push('Úsek: '+alert.sectionFrom+' → '+alert.sectionTo);
 lines.push('Počet vlaků: '+alert.count);
 lines.push('Vzdálenost'+(alert.distanceBasis==='air'?' vzdušnou čarou':' po trase')+': přibližně '+(alert.distanceM<1000?Math.round(alert.distanceM/100)*100+' m':(alert.distanceM/1000).toFixed(1)+' km'));
 if(alert.observedAt)lines.push('Poslední ověření před '+Math.max(0,Math.floor((now-alert.observedAt)/1000))+' s');
 if(stale)lines.push('Uvolnění provozu zatím není potvrzené.');
 return lines.join('\n');
}
